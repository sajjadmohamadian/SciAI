import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app } from "../server.ts";
import { getAnalysisById } from "../server/db.ts";

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
      assert.equal(getAnalysisById(json.id), null, "Executed results must not be saved to SQLite");
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
      process.env.SCIAI_OLLAMA_ENABLED = "false";

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

  describe("Power BI v2 aggregate export", () => {
    test("catalog and snapshot rows require authentication", async () => {
      for (const endpoint of ["/api/powerbi/v2/sources", "/api/powerbi/v2/tables/missing", "/api/powerbi/v2/manifest/missing"]) {
        assert.equal((await fetch(`${baseUrl}${endpoint}`)).status, 401);
      }
    });

    test("shared-token installations refuse snapshot catalog and registration, even on a loopback bind", async () => {
      const auth = { Authorization: `Bearer ${TEST_TOKEN}` };
      assert.equal((await fetch(`${baseUrl}/api/powerbi/v2/sources`, { headers: auth })).status, 403);
      assert.equal((await fetch(`${baseUrl}/api/powerbi/v2/sources`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "external_reference" }),
      })).status, 403);
    });

    test("registers an aggregate source and exposes immutable paginated external rows on private local mode", async () => {
      const configuredToken = process.env.SCIAI_API_TOKEN;
      process.env.SCIAI_API_TOKEN = "";
      process.env.SCIAI_DEV_AUTH_BYPASS = "true";
      try {
        const create = await fetch(`${baseUrl}/api/powerbi/v2/sources`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Public reference series", owner: "Research office", description: "Synthetic regional counts",
            kind: "external_reference", aggregateOnly: true, provenance: { publisher: "Agency", dataset: "Annual output", reference: "2025 series" },
            columns: [{ name: "region", type: "string", role: "dimension" }, { name: "publication_count", type: "number", role: "metric" }] }),
        });
        assert.equal(create.status, 201);
        const source = await create.json();
        const upload = await fetch(`${baseUrl}/api/powerbi/v2/sources/${source.id}/snapshots`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "csv", asOf: "2025-12-31", content: "region,publication_count\nNorth,4\nSouth,7" }),
        });
        assert.equal(upload.status, 201);
        const snapshot = await upload.json();
        assert.equal(snapshot.version, 1);
        const page = await fetch(`${baseUrl}/api/powerbi/v2/tables/${snapshot.id}?offset=0&limit=1`);
        assert.equal(page.status, 200);
        const result = await page.json();
        assert.deepEqual(result.rows, [{ region: "North", publication_count: 4 }]);
        assert.equal(result.next_offset, 1);
        const manifest = await fetch(`${baseUrl}/api/powerbi/v2/manifest/${snapshot.id}`);
        assert.equal(manifest.status, 200);
        assert.equal((await manifest.json()).snapshot.id, snapshot.id);
        assert.equal((await fetch(`${baseUrl}/api/powerbi/v2/tables/${snapshot.id}?limit=1000`)).status, 400);
      } finally {
        if (configuredToken === undefined) delete process.env.SCIAI_API_TOKEN;
        else process.env.SCIAI_API_TOKEN = configuredToken;
        process.env.SCIAI_DEV_AUTH_BYPASS = "false";
      }
    });
  });

  describe("Power BI legacy export safety", () => {
    test("PBIDS requires authentication and does not trust a supplied Host header", async () => {
      const denied = await fetch(`${baseUrl}/api/powerbi/download-pbids?dataset_id=missing`);
      assert.equal(denied.status, 401);
      const missing = await fetch(`${baseUrl}/api/powerbi/download-pbids?dataset_id=missing`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}`, Host: "evil.example" },
      });
      assert.equal(missing.status, 404);
    });

    test("explicit unknown datasets and versions never silently fall back", async () => {
      const response = await fetch(`${baseUrl}/api/powerbi/feed/not-a-dataset`);
      assert.equal(response.status, 404);
      const table = await fetch(`${baseUrl}/api/powerbi/tables/fact_documents?dataset_id=not-a-dataset`);
      assert.equal(table.status, 404);
    });

    test("all displayed bibliometric table URLs resolve for a pinned dataset", async () => {
      for (const table of ["dim_thematicclusters", "dim_geographiccollaborations"]) {
        const response = await fetch(`${baseUrl}/api/powerbi/tables/${table}?dataset_id=dataset-bio-1`);
        assert.equal(response.status, 200, table);
        assert(Array.isArray(await response.json()));
      }
      const unrelatedVersion = await fetch(`${baseUrl}/api/powerbi/feed/dataset-bio-1?version_id=version-bio-2`);
      assert.equal(unrelatedVersion.status, 404);
    });

    test("a refresh request cannot mutate an unknown dataset", async () => {
      const response = await fetch(`${baseUrl}/api/powerbi/simulate-live-refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: "not-a-dataset" }),
      });
      assert.equal(response.status, 404);
    });
  });
});
