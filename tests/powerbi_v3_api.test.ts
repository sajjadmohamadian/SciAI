import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app } from "../server.ts";

describe("Power BI v3 profile and combined-model API", () => {
  let server: http.Server;
  let baseUrl = "";
  const previous = { token: process.env.SCIAI_API_TOKEN, bypass: process.env.SCIAI_DEV_AUTH_BYPASS, host: process.env.HOST };
  before(async () => {
    delete process.env.SCIAI_API_TOKEN;
    process.env.SCIAI_DEV_AUTH_BYPASS = "true";
    process.env.HOST = "localhost";
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previous.token === undefined) delete process.env.SCIAI_API_TOKEN; else process.env.SCIAI_API_TOKEN = previous.token;
    if (previous.bypass === undefined) delete process.env.SCIAI_DEV_AUTH_BYPASS; else process.env.SCIAI_DEV_AUTH_BYPASS = previous.bypass;
    if (previous.host === undefined) delete process.env.HOST; else process.env.HOST = previous.host;
  });
  const post = async (path: string, body: unknown) => fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  test("requires explicit pinned inputs and builds an immutable evidence package", async () => {
    const sourceResponse = await post("/api/powerbi/v2/sources", {
      name: "Synthetic v3 regional reference", owner: "Synthetic test", description: "Synthetic aggregate rows", kind: "external_reference", aggregateOnly: true,
      provenance: { publisher: "Synthetic publisher", dataset: "Annual totals", reference: "v3-api-fixture" },
      columns: [{ name: "year", type: "number", role: "dimension" }, { name: "publication_count", type: "number", role: "metric" }],
    });
    assert.equal(sourceResponse.status, 201);
    const source = await sourceResponse.json() as { id: string };
    const snapshotResponse = await post(`/api/powerbi/v2/sources/${source.id}/snapshots`, { format: "json", asOf: "2026-10-01", content: '[{"year":2024,"publication_count":20},{"year":2025,"publication_count":25}]' });
    assert.equal(snapshotResponse.status, 201);
    const snapshot = await snapshotResponse.json() as { id: string };
    const profileResponse = await post("/api/powerbi/v3/profiles", { source_id: source.id, kind: "combined_portfolio", dimensions: ["year"], metrics: ["publication_count"], allowed_join_keys: [{ source_column: "year", target: "publication_year", normalization: "exact" }] });
    assert.equal(profileResponse.status, 201);
    const profile = await profileResponse.json() as { id: string };
    const mappingResponse = await post("/api/powerbi/v3/mappings", { profile_id: profile.id, target_dataset_id: "dataset-bio-1", target_dataset_version_id: "version-bio-1", source_column: "year", target_field: "publication_year", normalization: "exact" });
    assert.equal(mappingResponse.status, 201);
    const mapping = await mappingResponse.json() as { id: string };
    const missingPin = await post("/api/powerbi/v3/combined-models", { dataset_id: "dataset-bio-1", snapshot_id: snapshot.id, profile_id: profile.id, mapping_id: mapping.id });
    assert.equal(missingPin.status, 400);
    const build = await post("/api/powerbi/v3/combined-models", { dataset_id: "dataset-bio-1", dataset_version_id: "version-bio-1", snapshot_id: snapshot.id, profile_id: profile.id, mapping_id: mapping.id });
    assert.equal(build.status, 201);
    const model = await build.json() as { manifest: { id: string; model_hash: string; dataset_version_id: string }; evidence: unknown[] };
    assert(model.manifest.id);
    assert.match(model.manifest.model_hash, /^[a-f0-9]{64}$/);
    assert.equal(model.manifest.dataset_version_id, "version-bio-1");
    assert(Array.isArray(model.evidence));
    const evidence = await fetch(`${baseUrl}/api/powerbi/v3/combined-models/${model.manifest.id}/evidence`);
    assert.equal(evidence.status, 200);
    const table = await fetch(`${baseUrl}/api/powerbi/v3/combined-models/${model.manifest.id}/tables/combined_aggregate?limit=1`);
    assert.equal(table.status, 200);
    assert.equal((await table.json()).limit, 1);
  });
});
