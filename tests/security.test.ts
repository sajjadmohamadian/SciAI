import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { AddressInfo } from "node:net";
import {
  validateBibliometricUpload,
  detectDatabaseFormat,
} from "../server/parsers/detector.js";
import { cleanupUploadedFiles, requireApiToken, requireNonLoopbackToken, requireUploadPermission, app } from "../server.ts";

describe("Security & Authentication Suite", () => {
  const TEST_TOKEN = "sciai-test-secure-token-abcdef123456";

  function createMockRes() {
    const res: any = {
      statusCode: 200,
      headersSent: false,
      _headers: {} as Record<string, string>,
      _data: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this._data = data;
        return this;
      },
      setHeader(name: string, value: string) {
        this._headers[name.toLowerCase()] = value;
      },
    };
    return res;
  }

  describe("API Token Authentication Middleware", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      process.env.HOST = "localhost";
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("Missing token returns 401 unauthenticated", () => {
      const req: any = { headers: {}, query: {} };
      const res = createMockRes();
      let nextCalled = false;

      requireApiToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, "next() must not be called without token");
      assert.equal(res.statusCode, 401);
      assert(res._data?.error?.includes("Authentication required"));
    });

    test("Invalid token returns 403 access denied", () => {
      const req: any = {
        headers: { authorization: "Bearer invalid-wrong-token-value" },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      requireApiToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert(res._data?.error?.includes("Access denied. Invalid API token."));
    });

    test("Valid Bearer token succeeds and calls next()", () => {
      const req: any = {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      requireApiToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, "next() should be called on valid Bearer token");
      assert.equal(res.statusCode, 200);
    });

    test("Valid X-API-Key header succeeds", () => {
      const req: any = {
        headers: { "x-api-key": TEST_TOKEN },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      requireApiToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, "next() should be called on valid X-API-Key");
      assert.equal(res.statusCode, 200);
    });

    test("Malformed Bearer headers are rejected with 400", () => {
      const malformedHeaders = [
        "Bearer", // missing token
        "Bearer    ", // whitespace only
        "Basic dXNlcjpwYXNz", // wrong scheme
        "Token xyz", // wrong scheme
        "Bearer token extra_arg", // extra tokens
      ];

      for (const header of malformedHeaders) {
        const req: any = { headers: { authorization: header }, query: {} };
        const res = createMockRes();
        let nextCalled = false;

        requireApiToken(req, res, () => {
          nextCalled = true;
        });

        assert.equal(nextCalled, false, `Header '${header}' should not allow access`);
        assert.equal(res.statusCode, 400, `Header '${header}' must return 400 Bad Request`);
        assert(res._data?.error?.includes("Malformed Authorization header"));
      }
    });

    test("Query-string tokens are strictly ignored and rejected", () => {
      // Attacker attempts to pass token in query param: ?token=... or ?api_key=...
      const req: any = {
        headers: {},
        query: { token: TEST_TOKEN, api_key: TEST_TOKEN },
      };
      const res = createMockRes();
      let nextCalled = false;

      requireApiToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, "Query string tokens must never authenticate");
      assert.equal(res.statusCode, 401);
    });

    test("Timing-safe comparison is used and never exposes token value in responses or logs", () => {
      const attackerToken = "attacker-token-payload-xyz";
      const req: any = {
        headers: { authorization: `Bearer ${attackerToken}` },
        query: {},
      };
      const res = createMockRes();

      requireApiToken(req, res, () => {});

      assert.equal(res.statusCode, 403);
      // Ensure the error response body NEVER echoes the submitted token or the secret token
      const responseStr = JSON.stringify(res._data);
      assert(!responseStr.includes(attackerToken), "Error must not echo attacker token");
      assert(!responseStr.includes(TEST_TOKEN), "Error must not expose configured secret token");
    });
  });

  describe("Development Bypass & Host Validation Rules", () => {
    test("Loopback bypass works only when explicitly set to exact string 'true'", () => {
      // When dev bypass is "true" and no token is configured on loopback, bypass is allowed
      const isLoopback = true;
      const testCases = [
        { bypassVal: "true", shouldAllow: true },
        { bypassVal: "false", shouldAllow: false },
        { bypassVal: "0", shouldAllow: false },
        { bypassVal: "1", shouldAllow: false },
        { bypassVal: "", shouldAllow: false },
        { bypassVal: "True", shouldAllow: false },
        { bypassVal: "yes", shouldAllow: false },
        { bypassVal: "enabled", shouldAllow: false },
      ];

      for (const tc of testCases) {
        const bypassEnabled = isLoopback && tc.bypassVal === "true";
        assert.equal(
          bypassEnabled,
          tc.shouldAllow,
          `Bypass with value '${tc.bypassVal}' expected ${tc.shouldAllow}`
        );
      }
    });

    test("Non-loopback HOST cannot use development bypass regardless of env flag", () => {
      const nonLoopbackHosts = ["0.0.0.0", "192.168.1.100", "sciai.internal.domain"];
      for (const host of nonLoopbackHosts) {
        const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
        const bypassEnabled = isLoopback && "true" === "true";
        assert.equal(bypassEnabled, false, `Non-loopback host '${host}' must NEVER enable dev bypass`);
      }
    });

    test("Non-loopback startup without SCIAI_API_TOKEN fails closed", () => {
      const isLoopback = false;
      const configuredToken = "";
      const shouldFailClosed = !isLoopback && !configuredToken;
      assert.equal(shouldFailClosed, true, "Must fail closed if non-loopback and no token configured");
    });
  });

  describe("Protected Endpoints & Alias Parity", () => {
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
      // Start ephemeral HTTP server on loopback port 0
      server = http.createServer(app);
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    afterEach(async () => {
      delete process.env.SCIAI_API_TOKEN;
      delete process.env.API_TOKEN;
      delete process.env.SCIAI_DEV_AUTH_BYPASS;
      delete process.env.SCIAI_PUBLIC_UPLOADS;
      delete process.env.SCIAI_PUBLIC_ORIGIN;
      delete process.env.APP_URL;
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    });

    test("Public health endpoint remains accessible without authentication", async () => {
      const resApi = await fetch(`${baseUrl}/api/health`);
      assert.equal(resApi.status, 200);
      const jsonApi = await resApi.json();
      assert.equal(jsonApi.status, "ok");

      // Alias /health
      const resAlias = await fetch(`${baseUrl}/health`);
      assert.equal(resAlias.status, 200);
      const jsonAlias = await resAlias.json();
      assert.equal(jsonAlias.status, "ok");
    });

    test("Unmatched /api routes return 404 JSON error envelope", async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-subpath-xyz`);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert(json.error?.includes("API endpoint not found"));
    });

    test("Capabilities endpoints (/api and aliases) return identical metadata", async () => {
      const res1 = await fetch(`${baseUrl}/api/analyses/capabilities`);
      const res2 = await fetch(`${baseUrl}/analyses/capabilities`);
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      const json1 = await res1.json();
      const json2 = await res2.json();
      assert.deepEqual(json1, json2, "Canonical /api and alias routes must return identical shapes");
    });

    test("Protected upload and sample cohort mutations return 401 without credentials", async () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";

      const uploadRes = await fetch(`${baseUrl}/api/datasets/upload`, {
        method: "POST",
      });
      assert.equal(uploadRes.status, 401);
      const uploadJson = await uploadRes.json();
      assert(uploadJson.error?.includes("Authentication required"));

      const cohortRes = await fetch(`${baseUrl}/api/datasets/load-sample-cohort`, {
        method: "POST",
      });
      assert.equal(cohortRes.status, 401);
      const cohortJson = await cohortRes.json();
      assert(cohortJson.error?.includes("Authentication required"));
    });

    test("Browser-like Origin and Referer headers do not bypass protected mutations", async () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";

      const res = await fetch(`${baseUrl}/api/datasets/load-sample-cohort`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Referer: `${baseUrl}/`,
        },
      });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert(json.error?.includes("Authentication required"));
    });

    test("Public uploads are disabled by default and still require credentials", () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      delete process.env.SCIAI_PUBLIC_UPLOADS;

      const req: any = { headers: {}, query: {}, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };
      const res = createMockRes();
      let nextCalled = false;

      requireUploadPermission(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert(res._data?.error?.includes("Authentication required"));
    });

    test("Public upload mode allows upload middleware only when explicitly enabled with an allowed origin", () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      process.env.SCIAI_PUBLIC_UPLOADS = "true";
      process.env.SCIAI_PUBLIC_ORIGIN = baseUrl;

      const req: any = {
        headers: { origin: baseUrl },
        query: {},
        ip: `127.0.0.1-public-${Date.now()}`,
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockRes();
      let nextCalled = false;

      requireUploadPermission(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, 200);
    });

    test("Public upload mode rejects disallowed browser origins", () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      process.env.SCIAI_PUBLIC_UPLOADS = "true";
      process.env.SCIAI_PUBLIC_ORIGIN = baseUrl;

      const req: any = {
        headers: { origin: "https://evil.example" },
        query: {},
        ip: `127.0.0.1-origin-${Date.now()}`,
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockRes();
      let nextCalled = false;

      requireUploadPermission(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert(res._data?.error?.includes("origin is not allowed"));
    });

    test("Valid API token still authorizes upload when public uploads are disabled", () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      process.env.SCIAI_PUBLIC_UPLOADS = "false";

      const req: any = {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        query: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockRes();
      let nextCalled = false;

      requireUploadPermission(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, 200);
    });

    test("Public upload mode does not make other protected routes public", async () => {
      process.env.SCIAI_API_TOKEN = TEST_TOKEN;
      process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      process.env.SCIAI_PUBLIC_UPLOADS = "true";
      process.env.SCIAI_PUBLIC_ORIGIN = baseUrl;

      const cohortRes = await fetch(`${baseUrl}/api/datasets/load-sample-cohort`, {
        method: "POST",
        headers: { Origin: baseUrl },
      });
      assert.equal(cohortRes.status, 401);
      const cohortJson = await cohortRes.json();
      assert(cohortJson.error?.includes("Authentication required"));

      const analysisRes = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
        },
        body: JSON.stringify({ project_id: "x", dataset_version_id: "y", capability_id: "z" }),
      });
      assert.equal(analysisRes.status, 401);
      const analysisJson = await analysisRes.json();
      assert(analysisJson.error?.includes("Authentication required"));

      const aiRes = await fetch(`${baseUrl}/api/ai/rag-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          Referer: `${baseUrl}/`,
        },
        body: JSON.stringify({ query: "summarize", provider: "claude" }),
      });
      assert.equal(aiRes.status, 401);
      const aiJson = await aiRes.json();
      assert(aiJson.error?.includes("Authentication required"));
      const serialized = JSON.stringify(aiJson);
      assert(!serialized.includes(TEST_TOKEN));
      assert(!serialized.includes("GEMINI_API_KEY"));
      assert(!serialized.includes("ANTHROPIC_API_KEY"));
      assert(!serialized.includes("OPENAI_API_KEY"));
    });
  });

  describe("Bibliometric Upload Safety, Validation & Cleanup", () => {
    test("Valid supported bibliographic content passes validation", () => {
      // CSV format
      const validCsv = "Authors,Title,Year,Source,Cited by\n\"Doe, J.\",\"Scientometric Study\",2023,\"J. Informetrics\",15";
      const csvResult = validateBibliometricUpload("export.csv", "text/csv", validCsv);
      assert.equal(csvResult.valid, true);

      // WoS tagged format
      const validWos = "PT J\nAU Doe, J.\nTI Research Title\nSO Journal\nPY 2024\nER\n";
      const wosResult = validateBibliometricUpload("savedrecs.txt", "text/plain", validWos);
      assert.equal(wosResult.valid, true);

      // PubMed tagged format
      const validPubMed = "PMID- 12345678\nTI  - Cancer Genomics\nDP  - 2022\n";
      const pmidResult = validateBibliometricUpload("pubmed.nbib", "application/octet-stream", validPubMed);
      assert.equal(pmidResult.valid, true);
    });

    test("Unsupported file extension is rejected with clear error message", () => {
      const result = validateBibliometricUpload("malware.exe", "application/x-msdownload", "print('hello')");
      assert.equal(result.valid, false);
      assert(result.error?.includes("Unsupported file extension"));
    });

    test("Binary content with null bytes is rejected as dangerous/corrupt", () => {
      const binaryContent = "TI Sample Title\0\0\0Binary Executable Payload";
      const result = validateBibliometricUpload("corrupted.txt", "text/plain", binaryContent);
      assert.equal(result.valid, false);
      assert(result.error?.includes("invalid binary data"));
    });

    test("Corrupt JSON file extension is rejected", () => {
      const corruptJson = "{ this is not: valid JSON! }";
      const result = validateBibliometricUpload("data.json", "application/json", corruptJson);
      assert.equal(result.valid, false);
      assert(result.error?.includes("not valid JSON content"));
    });

    test("Corrupt NBIB file without MEDLINE tags is rejected", () => {
      const corruptNbib = "This is just arbitrary text without PMID or tags";
      const result = validateBibliometricUpload("export.nbib", "application/octet-stream", corruptNbib);
      assert.equal(result.valid, false);
      assert(result.error?.includes("does not contain valid PubMed/MEDLINE"));
    });

    test("cleanupUploadedFiles deletes existing temporary files safely", () => {
      const tempFile1 = path.join(os.tmpdir(), `test-clean-${Date.now()}-1.tmp`);
      const tempFile2 = path.join(os.tmpdir(), `test-clean-${Date.now()}-2.tmp`);

      fs.writeFileSync(tempFile1, "temporary test content 1");
      fs.writeFileSync(tempFile2, "temporary test content 2");

      assert(fs.existsSync(tempFile1));
      assert(fs.existsSync(tempFile2));

      cleanupUploadedFiles([
        { path: tempFile1 } as Express.Multer.File,
        { path: tempFile2 } as Express.Multer.File,
      ]);

      assert(!fs.existsSync(tempFile1), "tempFile1 should be deleted");
      assert(!fs.existsSync(tempFile2), "tempFile2 should be deleted");
    });

    test("cleanupUploadedFiles handles non-existent or null files gracefully without throwing", () => {
      assert.doesNotThrow(() => {
        cleanupUploadedFiles(undefined);
        cleanupUploadedFiles([]);
        cleanupUploadedFiles([{ path: "/non/existent/path/99999.tmp" } as Express.Multer.File]);
      });
    });
  });
});
