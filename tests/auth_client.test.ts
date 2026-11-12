import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar } from "../src/components/Sidebar.js";
import { createAuthFetch } from "../src/utils/authFetch.js";
import { apiJson, apiRequest, ApiRequestError } from "../src/utils/apiClient.js";

const origin = "https://sciai.example";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("session-aware browser requests", () => {
  test("navigation preserves reports and AI while hiding administration from users and local mode", () => {
    for (const isAdmin of [false, true]) {
      const html = renderToStaticMarkup(createElement(Sidebar, { activeTab: "overview", onChangeTab: () => {}, isAdmin }));
      assert(html.includes("Executive Reports"));
      assert(html.includes("AI Research Assistance"));
      assert(html.includes("Dataset &amp; Corpus Pipeline"));
      assert.equal(html.includes("User Administration"), isAdmin);
    }
    const local = renderToStaticMarkup(createElement(Sidebar, { activeTab: "overview", onChangeTab: () => {} }));
    assert.equal(local.includes("User Administration"), false);
  });
  test("attaches in-memory CSRF only to same-origin mutations with every header representation", async () => {
    const session = { enabled: true, csrfToken: "memory-only" };
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const wrapped = createAuthFetch(async (input, init) => {
      calls.push({ input, init }); return new Response("{}");
    }, origin, () => session, () => assert.fail("unexpected expiry"));
    for (const headers of [{ Accept: "application/json" }, [["Accept", "application/json"]] as [string, string][], new Headers({ Accept: "application/json" })]) {
      await wrapped("/api/admin/users", { method: "POST", headers });
      const result = new Headers(calls.at(-1)?.init?.headers);
      assert.equal(result.get("x-csrf-token"), "memory-only");
      assert.equal(result.get("accept"), "application/json");
      assert.equal(result.get("authorization"), null);
    }
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      await wrapped("/api/admin/users", { method });
      assert.equal(new Headers(calls.at(-1)?.init?.headers).has("x-csrf-token"), false);
    }
    await wrapped("https://external.example/upload", { method: "POST", headers: { "X-CSRF-Token": "stale", Accept: "application/json" } });
    assert.equal(new Headers(calls.at(-1)?.init?.headers).has("x-csrf-token"), false);
    assert.equal(new Headers(calls.at(-1)?.init?.headers).get("accept"), "application/json");
  });

  test("preserves raw Request bodies, FormData boundaries, signals, and caller overrides", async () => {
    const session = { enabled: true, csrfToken: "token" };
    let seenInput: RequestInfo | URL | undefined;
    let seenInit: RequestInit | undefined;
    const wrapped = createAuthFetch(async (input, init) => {
      seenInput = input; seenInit = init; return new Response("{}");
    }, origin, () => session, () => {});
    const body = new FormData(); body.append("file", new Blob(["synthetic"]), "test.txt");
    const controller = new AbortController();
    await wrapped("/api/datasets/upload", { method: "POST", body, signal: controller.signal });
    assert.equal(seenInit?.body, body);
    assert.equal(seenInit?.signal, controller.signal);
    assert.equal(new Headers(seenInit?.headers).get("content-type"), null);
    const request = new Request(`${origin}/api/test`, { method: "PUT", body, headers: { Accept: "application/json" } });
    const boundary = request.headers.get("content-type");
    await wrapped(request);
    assert.equal(seenInput, request);
    assert.equal(request.bodyUsed, false);
    assert.equal(new Headers(seenInit?.headers).get("content-type"), boundary);
    assert.equal(new Headers(seenInit?.headers).get("x-csrf-token"), "token");
    await wrapped(request, { method: "GET", headers: { "X-Custom": "override" } });
    assert.equal(seenInit?.method, "GET");
    assert.equal(new Headers(seenInit?.headers).get("x-csrf-token"), null);
    assert.equal(new Headers(seenInit?.headers).get("accept"), null);
  });

  test("does not leak CSRF headers carried by an external Request", async () => {
    const request = new Request("https://external.example/api", { method: "POST", body: "test", headers: { "X-CSRF-Token": "secret", "Content-Type": "text/plain" } });
    const wrapped = createAuthFetch(async (input, init) => {
      assert.equal(input, request);
      assert.equal(new Headers(init?.headers).get("x-csrf-token"), null);
      assert.equal(new Headers(init?.headers).get("content-type"), "text/plain");
      return new Response("{}");
    }, origin, () => ({ enabled: true, csrfToken: "secret" }), () => assert.fail());
    await wrapped(request);
  });

  test("disabled auth supports local API mutations without session credentials", async () => {
    const session = { enabled: false, csrfToken: null };
    const wrapped = createAuthFetch(async (_input, init) => {
      assert.equal(new Headers(init?.headers).has("x-csrf-token"), false);
      return new Response("{}", { status: 401 });
    }, origin, () => session, () => assert.fail("disabled sessions must not expire"));
    await wrapped("/api/analyses/run", { method: "POST", body: "{}" });
  });

  test("expiry invalidates once and never treats rejected login/reset or external APIs as expiry", async () => {
    let session = { enabled: true, csrfToken: "current" as string | null };
    let expired = 0;
    const wrapped = createAuthFetch(async () => new Response("{}", { status: 401 }), origin, () => session, () => { expired++; session = { enabled: true, csrfToken: null }; });
    await wrapped("/api/auth/login", { method: "POST" });
    await wrapped("/api/auth/reset", { method: "POST" });
    await wrapped("https://external.example/api");
    assert.equal(expired, 0);
    await wrapped("/projects/synthetic/dashboard");
    await wrapped("/api/protected");
    assert.equal(expired, 1);
  });

  test("a stale 401 cannot log out a newly rotated or signed-in session", async () => {
    let session = { enabled: true, csrfToken: "old" };
    let resolve!: (response: Response) => void;
    const wrapped = createAuthFetch(() => new Promise<Response>((done) => { resolve = done; }), origin, () => session, () => assert.fail("stale request expired new session"));
    const pending = wrapped("/api/protected");
    session = { enabled: true, csrfToken: "rotated" };
    resolve(new Response("{}", { status: 401 }));
    await pending;
  });

  test("all raw fetch callers and apiJson share the same CSRF policy", async () => {
    const session = { enabled: true, csrfToken: "shared" };
    globalThis.fetch = createAuthFetch(async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("x-csrf-token"), "shared");
      assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }, origin, () => session, () => {});
    assert.deepEqual(await apiJson("/api/auth/password", { current_password: "synthetic", new_password: "synthetic-only" }), { success: true });
  });

  test("account API failures report actionable server errors instead of API-token guidance", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401, headers: { "Content-Type": "application/json" } });
    await assert.rejects(apiRequest("/api/auth/login"), (error: unknown) => {
      assert(error instanceof ApiRequestError);
      assert.equal(error.message, "Invalid email or password");
      assert.equal(error.code, "auth_required"); return true;
    });
  });
});
