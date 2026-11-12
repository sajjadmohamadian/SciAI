import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

type Identity = { id: string; email: string; role: string; active: boolean; must_change_password: boolean };
type Session = { cookie: string; csrf: string; user: Identity };

// Run this suite in its own process, like the other server API suites: the server
// and database modules retain singleton state after their first import.
describe("User authentication HTTP API", { concurrency: false }, () => {
  const bootstrapEmail = "api-bootstrap@example.test";
  const bootstrapPassword = "Synthetic-Bootstrap-Password!42";
  const adminPassword = "Synthetic-Changed-Admin-Password!42";
  const temporaryPassword = "Synthetic-Temporary-Password!42";
  const changedPassword = "Synthetic-Changed-User-Password!42";
  const sharedToken = "synthetic-auth-api-integration-token";
  const environment = {
    NODE_ENV: "test",
    SCIAI_USER_AUTH_ENABLED: "true",
    SCIAI_DB_PATH: "",
    SCIAI_BOOTSTRAP_ADMIN_EMAIL: bootstrapEmail,
    SCIAI_BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword,
    SCIAI_BOOTSTRAP_EMAIL: "",
    SCIAI_BOOTSTRAP_PASSWORD: "",
    SCIAI_API_TOKEN: sharedToken,
    API_TOKEN: "",
    SCIAI_DEV_AUTH_BYPASS: "false",
    SCIAI_PUBLIC_UPLOADS: "false",
    HOST: "127.0.0.1",
    APP_URL: "",
  };
  const originalEnvironment = new Map<string, string | undefined>();
  let tempDir: string;
  let server: http.Server | undefined;
  let database: typeof import("../server/db.js") | undefined;
  let baseUrl: string;
  let admin: Session;
  let bootstrapResponse: Response;
  let bootstrapBody: { user: Identity; csrf_token: string };
  let bootstrapSession: Session;
  let forcedMe: Response;
  let forcedResearch: Response;
  let forcedAdmin: Response;
  let rotatedResponse: Response;
  let rateLimitedRequests = 0;

  async function request(route: string, options: {
    method?: string; body?: unknown; session?: Session; csrf?: boolean; headers?: Record<string, string>;
  } = {}) {
    if (["/api/auth/login", "/api/auth/password", "/api/auth/reset"].includes(route)) {
      rateLimitedRequests++;
      assert(rateLimitedRequests < 20, "Keep the suite below the shared authentication rate limit");
    }
    return fetch(`${baseUrl}${route}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.session ? { Cookie: options.session.cookie } : {}),
        ...(options.session && options.csrf !== false ? { "X-CSRF-Token": options.session.csrf } : {}),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      redirect: "manual",
    });
  }

  function sessionFrom(response: Response, body: { user: Identity; csrf_token: string }): Session {
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) => cookie.startsWith("sciai_session="));
    assert(sessionCookie, "A session cookie must be issued");
    assert.match(sessionCookie, /; HttpOnly(?:;|$)/i);
    assert.match(sessionCookie, /; SameSite=Lax(?:;|$)/i);
    assert.match(sessionCookie, /; Path=\/(?:;|$)/i);
    assert.match(sessionCookie, /; Max-Age=[1-9]\d*(?:;|$)/i);
    const cookie = sessionCookie.split(";", 1)[0];
    const token = decodeURIComponent(cookie.slice("sciai_session=".length));
    assert.equal(typeof body.csrf_token, "string");
    assert(body.csrf_token.length > 0);
    assert.notEqual(body.csrf_token, token);
    assert(!JSON.stringify(body).includes(token), "The session bearer must not appear in JSON");
    assert.deepEqual(Object.keys(body).sort(), ["csrf_token", "user"]);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { cookie, csrf: body.csrf_token, user: body.user };
  }

  async function login(email: string, password: string): Promise<Session> {
    const response = await request("/api/auth/login", { method: "POST", body: { email, password } });
    assert.equal(response.status, 200);
    return sessionFrom(response, await response.json());
  }

  async function createUser(email: string): Promise<Identity> {
    const response = await request("/api/admin/users", {
      method: "POST", session: admin, body: { email, password: temporaryPassword, role: "user" },
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.email, email);
    assert.equal(body.user.role, "user");
    assert.equal(body.user.active, true);
    assert.equal(body.user.password, undefined);
    assert.equal(body.user.password_hash, undefined);
    return body.user;
  }

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-auth-api-"));
    environment.SCIAI_DB_PATH = path.join(tempDir, "fixture.db");
    for (const [key, value] of Object.entries(environment)) {
      originalEnvironment.set(key, process.env[key]);
      process.env[key] = value;
    }
    // No static DB/service imports: even their default paths must see the fixture
    // environment. Bootstrap explicitly without starting Vite or static serving.
    database = await import("../server/db.js");
    database.initDb(environment.SCIAI_DB_PATH);
    const { ensureBootstrap } = await import("../server/auth/service.js");
    const bootstrapped = await ensureBootstrap();
    assert(bootstrapped);
    assert.equal(bootstrapped.email, bootstrapEmail);
    assert.equal(bootstrapped.mustChangePassword, true);
    const { app } = await import("../server.ts");
    server = http.createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", () => { server!.off("error", reject); resolve(); });
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.APP_URL = baseUrl;
    // Establish a reusable administrator fixture so a regression in one test
    // does not prevent unrelated lifecycle groups from exercising their routes.
    bootstrapResponse = await request("/api/auth/login", {
      method: "POST", body: { email: bootstrapEmail, password: bootstrapPassword },
    });
    assert.equal(bootstrapResponse.status, 200);
    bootstrapBody = await bootstrapResponse.json();
    bootstrapSession = sessionFrom(bootstrapResponse, bootstrapBody);
    forcedMe = await request("/api/auth/me", { session: bootstrapSession });
    forcedResearch = await request("/api/projects", { session: bootstrapSession });
    forcedAdmin = await request("/api/admin/users", { session: bootstrapSession });
    rotatedResponse = await request("/api/auth/password", {
      method: "POST", session: bootstrapSession,
      body: { current_password: bootstrapPassword, new_password: adminPassword },
    });
    assert.equal(rotatedResponse.status, 200);
    admin = sessionFrom(rotatedResponse, await rotatedResponse.json());
  });

  after(async () => {
    try {
      if (server?.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
      }
    } finally {
      try {
        database?.closeDb();
        if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
      } finally {
        for (const [key, value] of originalEnvironment) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  test("all research read aliases require a session, even with an invalid bearer", async () => {
    const aliases = [
      "/projects", "/projects/missing", "/projects/missing/dashboard", "/projects/missing/overview",
      "/projects/missing/datasets", "/projects/missing/analyses",
      "/datasets", "/datasets/missing", "/datasets/missing/versions", "/datasets/merge/latest",
      "/datasets/missing/prisma", "/datasets/missing/health", "/datasets/missing/methodology",
      "/datasets/missing/documents", "/datasets/missing/export",
      ...["/analyses", "/analysis"].flatMap((prefix) => [prefix, `${prefix}/capabilities`, `${prefix}/engines`, `${prefix}/missing`, `${prefix}/missing/records`]),
      "/benchmark/default", "/network/default", "/thematic/default",
      "/powerbi/feed", "/powerbi/tables/documents", "/powerbi/download-pbids",
    ];
    const paths = [...aliases, ...aliases.map((alias) => `/api${alias}`),
      "/api/powerbi/v2/sources", "/api/powerbi/v3/profiles", "/api/openalex/search?query=synthetic"];
    for (const route of paths) {
      for (const headers of [{}, { Authorization: "Bearer invalid-synthetic-token" }]) {
        const response = await request(route, { headers });
        assert.equal(response.status, 401, `Unauthenticated GET ${route}`);
        assert.equal((await response.json()).code, "session_required");
      }
    }
    assert.equal((await request("/api/auth/me")).status, 401);
  });

  test("bootstrap login is forced-password-only and password changes require CSRF and rotate sessions", async () => {
    assert.equal(bootstrapBody.user.role, "admin");
    assert.equal(bootstrapBody.user.must_change_password, true);
    assert.equal(forcedMe.status, 200);
    assert.deepEqual(await forcedMe.json(), bootstrapBody);
    for (const response of [forcedResearch, forcedAdmin]) {
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "password_change_required");
    }
    assert.equal(admin.user.must_change_password, false);
    assert.notEqual(admin.cookie, bootstrapSession.cookie);
    assert.notEqual(admin.csrf, bootstrapSession.csrf);
    assert.equal((await request("/api/auth/me", { session: bootstrapSession })).status, 401);
    const me = await request("/api/auth/me", { session: admin });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: admin.user, csrf_token: admin.csrf });
    assert.equal(me.headers.get("cache-control"), "no-store");
    const noCsrf = await request("/api/auth/password", {
      method: "POST", session: admin, csrf: false,
      body: { current_password: adminPassword, new_password: changedPassword },
    });
    assert.equal(noCsrf.status, 403);
    assert.equal((await noCsrf.json()).code, "csrf_invalid");
    assert.equal((await request("/api/auth/me", { session: admin })).status, 200);
    assert.equal((await request("/api/projects", { session: admin })).status, 200);
  });

  test("administrator-created accounts require a password change before research or administration", async () => {
    const user = await createUser("api-forced@example.test");
    // This is an API contract, not a service fixture override: a failing assertion
    // must expose an endpoint that forgets to mark temporary credentials.
    assert.equal(user.must_change_password, true);
    const session = await login(user.email, temporaryPassword);
    const me = await request("/api/auth/me", { session });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.must_change_password, true);
    for (const route of ["/api/projects", "/api/admin/users"]) {
      assert.equal((await request(route, { session })).status, 403);
    }
  });

  test("ordinary users cannot administer; role edits, disabling and soft deletion revoke sessions", async () => {
    const user = await createUser("api-lifecycle@example.test");
    const initial = await login(user.email, temporaryPassword);
    const changed = await request("/api/auth/password", {
      method: "POST", session: initial,
      body: { current_password: temporaryPassword, new_password: changedPassword },
    });
    assert.equal(changed.status, 200);
    let session = sessionFrom(changed, await changed.json());
    assert.equal(session.user.must_change_password, false);
    assert.notEqual(session.cookie, initial.cookie);
    assert.equal((await request("/api/auth/me", { session: initial })).status, 401);
    assert.equal((await request("/api/projects", { session })).status, 200);
    assert.equal((await request("/api/admin/users", { session })).status, 403);
    assert.equal((await request("/api/admin/users", {
      method: "POST", session, body: { email: "must-not-exist@example.test", password: temporaryPassword },
    })).status, 403);
    let updated = await request(`/api/admin/users/${user.id}`, {
      method: "PATCH", session: admin, body: { role: "admin" },
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).user.role, "admin");
    assert.equal((await request("/api/auth/me", { session })).status, 401);
    session = await login(user.email, changedPassword);
    assert.equal(session.user.role, "admin");
    updated = await request(`/api/admin/users/${user.id}`, {
      method: "PATCH", session: admin, body: { active: false },
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).user.active, false);
    assert.equal((await request("/api/auth/me", { session })).status, 401);
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: user.email, password: changedPassword },
    })).status, 401);
    assert.equal((await request(`/api/admin/users/${user.id}`, {
      method: "PATCH", session: admin, body: { active: true, role: "user" },
    })).status, 200);
    session = await login(user.email, changedPassword);
    assert.equal((await request(`/api/admin/users/${user.id}`, { method: "DELETE", session: admin })).status, 200);
    assert.equal((await request("/api/auth/me", { session })).status, 401);
    assert.equal((await request("/api/projects", { session })).status, 401);
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: user.email, password: changedPassword },
    })).status, 401);
    const listed = await request("/api/admin/users", { session: admin });
    assert.equal(listed.status, 200);
    const retained = (await listed.json()).users.find((entry: Identity) => entry.id === user.id);
    assert(retained, "Soft deletion must retain the account identity");
    assert.equal(retained.active, false);
  });

  test("administrator reset tokens revoke sessions and can be redeemed only once", async () => {
    const user = await createUser("api-reset@example.test");
    const session = await login(user.email, temporaryPassword);
    const issued = await request(`/api/admin/users/${user.id}/password-reset`, { method: "POST", session: admin });
    assert.equal(issued.status, 200);
    const reset = await issued.json();
    assert.equal(typeof reset.reset_token, "string");
    assert(Date.parse(reset.expires_at) > Date.now());
    assert.equal((await request("/api/auth/me", { session })).status, 401);
    assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password: temporaryPassword } })).status, 401, "Reset-pending accounts must reject the old password before token redemption");
    const redeemed = await request("/api/auth/reset", {
      method: "POST", body: { token: reset.reset_token, new_password: changedPassword },
    });
    assert.equal(redeemed.status, 200);
    assert.deepEqual(await redeemed.json(), { success: true });
    assert.equal(redeemed.headers.get("set-cookie"), null);
    assert.equal((await request("/api/auth/reset", {
      method: "POST", body: { token: reset.reset_token, new_password: temporaryPassword },
    })).status, 400);
    const replacement = await login(user.email, changedPassword);
    assert.equal(replacement.user.must_change_password, false);
    assert.equal((await request("/api/projects", { session: replacement })).status, 200);
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: user.email, password: temporaryPassword },
    })).status, 401);
    assert.equal((await request("/api/auth/logout", { method: "POST", session: replacement })).status, 200);
    assert.equal((await request("/api/auth/me", { session: replacement })).status, 401);
  });

  test("hostile origins are rejected and the local-only Power BI guard survives user authentication", async () => {
    for (const headers of [{ Origin: "https://hostile.example.test" }, { Origin: baseUrl, "Sec-Fetch-Site": "cross-site" }]) {
      assert.equal((await request("/api/auth/login", {
        method: "POST", headers, body: { email: bootstrapEmail, password: adminPassword },
      })).status, 403);
    }
    const mutation = { method: "POST", session: admin, body: { email: "hostile-create@example.test", password: temporaryPassword } };
    assert.equal((await request("/api/admin/users", { ...mutation, headers: { Origin: "https://hostile.example.test" } })).status, 403);
    assert.equal((await request("/api/admin/users", { ...mutation, headers: { Origin: baseUrl, "Sec-Fetch-Site": "cross-site" } })).status, 403);
    const allowed = await request("/api/admin/users", { ...mutation, headers: { Origin: baseUrl } });
    assert.equal(allowed.status, 201, "APP_URL must accept the actual ephemeral origin");
    for (const route of ["/api/powerbi/v2/sources", "/api/powerbi/v3/profiles"]) {
      for (const options of [{ session: admin }, { headers: { Authorization: `Bearer ${sharedToken}` } }]) {
        const response = await request(route, options);
        assert.equal(response.status, 403);
        const body = await response.json();
        if ("session" in options) assert.match(body.error, /single-operator|shared API token/i);
        else assert.match(body.error, /administrator/i);
      }
    }
  });

  test("health is public and malformed or duplicate session cookies fail closed without 500", async () => {
    for (const route of ["/health", "/api/health"]) {
      const response = await request(route);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "ok");
    }
    for (const cookie of ["sciai_session=%E0%A4%A", "sciai_session=not-a-token", "sciai_session=", `${admin.cookie}; ${admin.cookie}`]) {
      for (const route of ["/api/auth/me", "/api/projects"]) {
        assert.equal((await request(route, { headers: { Cookie: cookie } })).status, 401, `${route}: ${cookie}`);
      }
    }
  });
});
