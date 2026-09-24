import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app } from "../server.ts";

describe("API Contracts & Analysis Route Aliases Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  const TEST_TOKEN = "sciai-contract-test-token-789";

  before(async () => {
    process.env.SCIAI_API_TOKEN = TEST_TOKEN;
    process.env.SCIAI_DEV_AUTH_BYPASS = "false";
    process.env.HOST = "localhost";

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("Analysis List Route Parity (GET /api/analyses vs /api/analysis vs /analyses)", () => {
    test("GET /api/analyses, GET /api/analysis, and GET /analyses return equivalent shapes", async () => {
      const resPlural = await fetch(`${baseUrl}/api/analyses`);
      const resSingular = await fetch(`${baseUrl}/api/analysis`);
      const resRoot = await fetch(`${baseUrl}/analyses`);

      assert.equal(resPlural.status, 200);
      assert.equal(resSingular.status, 200);
      assert.equal(resRoot.status, 200);

      const jsonPlural = await resPlural.json();
      const jsonSingular = await resSingular.json();
      const jsonRoot = await resRoot.json();

      assert(Array.isArray(jsonPlural), "Analyses endpoint must return an array");
      assert.deepEqual(jsonPlural, jsonSingular, "/api/analyses and /api/analysis must return identical data");
      assert.deepEqual(jsonPlural, jsonRoot, "/api/analyses and /analyses must return identical data");
    });
  });

  describe("Protected POST /api/analyses/run & Aliases", () => {
    test("POST /api/analyses/run without auth returns 401 unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability_id: "publication.year_distribution" }),
      });
      assert.equal(res.status, 401);
      const json = await res.json();
      assert(json.error?.includes("Authentication required"));
    });

    test("All alias POST routes enforce authentication equivalently", async () => {
      const aliases = [
        "/api/analyses/run",
        "/api/analysis/run",
        "/analyses/run",
        "/analysis/run",
      ];

      for (const route of aliases) {
        const res = await fetch(`${baseUrl}${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        assert.equal(res.status, 401, `${route} must require authentication`);
      }
    });

    test("POST /api/analyses/run with valid token succeeds and runs computation", async () => {
      const payload = {
        capability_id: "publication.year_distribution",
        name: "Test Year Distribution",
      };

      const res = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert(json.id, "Returned analysis must have an id");
      assert.equal(json.status, "completed");
      assert.equal(json.capability_id, "publication.year_distribution");
      assert(Array.isArray(json.result?.records));
    });

    test("POST /api/analysis/run (singular alias) produces equivalent response structure", async () => {
      const payload = {
        capability_id: "publication.year_distribution",
        name: "Test Singular Alias Run",
      };

      const res = await fetch(`${baseUrl}/api/analysis/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, "completed");
      assert.equal(json.capability_id, "publication.year_distribution");
    });

    test("Validation error returns 400 with standard error envelope", async () => {
      const res = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({
          author_counting_mode: "invalid_mode_xyz",
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert(typeof json.error === "string");
      assert(json.error.includes("Invalid author_counting_mode"));
    });

    test("Validation error on invalid observation year", async () => {
      const res = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({
          observation_year: 1500, // out of range (< 1800)
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert(json.error?.includes("Invalid observation_year"));
    });
  });

  describe("Analysis Retrieval by ID & Records (Canonical & Aliases)", () => {
    let createdAnalysisId: string;

    before(async () => {
      // Create a known analysis to query
      const res = await fetch(`${baseUrl}/api/analyses/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({
          capability_id: "citation.total",
          name: "Test Retrieval Analysis",
        }),
      });
      const data = await res.json();
      createdAnalysisId = data.id;
    });

    test("GET /api/analyses/:id and GET /api/analysis/:id return identical analysis", async () => {
      const resPlural = await fetch(`${baseUrl}/api/analyses/${createdAnalysisId}`);
      const resSingular = await fetch(`${baseUrl}/api/analysis/${createdAnalysisId}`);

      assert.equal(resPlural.status, 200);
      assert.equal(resSingular.status, 200);

      const jsonPlural = await resPlural.json();
      const jsonSingular = await resSingular.json();
      assert.deepEqual(jsonPlural, jsonSingular);
      assert.equal(jsonPlural.id, createdAnalysisId);
    });

    test("GET /api/analyses/:id/records and GET /api/analysis/:id/records return identical records", async () => {
      const resPlural = await fetch(`${baseUrl}/api/analyses/${createdAnalysisId}/records`);
      const resSingular = await fetch(`${baseUrl}/api/analysis/${createdAnalysisId}/records`);

      assert.equal(resPlural.status, 200);
      assert.equal(resSingular.status, 200);

      const jsonPlural = await resPlural.json();
      const jsonSingular = await resSingular.json();
      assert.deepEqual(jsonPlural, jsonSingular);
      assert(Array.isArray(jsonPlural));
    });

    test("GET with non-existent analysis_id returns 404", async () => {
      const res = await fetch(`${baseUrl}/api/analyses/non-existent-analysis-id-9999`);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert(json.error?.includes("Analysis not found"));
    });
  });

  describe("Protected AI provider route contracts", () => {
    test("AI route preserves response fields and adds provenance when providers are unavailable", async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const res = await fetch(`${baseUrl}/api/ai/rag-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({ query: "What is in the corpus?" }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.status, "unavailable");
      assert.equal(json.answer, "unavailable");
      assert.equal(json.ai_provenance.provider, "unavailable");
      assert(Array.isArray(json.ai_provenance.attemptedProviders));
    });

    test("AI route rejects invalid provider with 400", async () => {
      const res = await fetch(`${baseUrl}/api/ai/rag-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({ query: "test", provider: "bad-provider" }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert(json.error?.includes("Invalid AI provider"));
    });
  });
});
