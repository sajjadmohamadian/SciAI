import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app } from "../server.ts";
import { createSession, csrfForToken, listUsers, ensureBootstrap } from "../server/auth/service.ts";

describe("Power BI v3 profile and combined-model API", () => {
  let server: http.Server;
  let baseUrl = "";
  let sessionCookie = "";
  let csrfToken = "";
  const previous = {
    token: process.env.SCIAI_API_TOKEN,
    apiToken: process.env.API_TOKEN,
    bypass: process.env.SCIAI_DEV_AUTH_BYPASS,
    publicUploads: process.env.SCIAI_ALLOW_PUBLIC_UPLOADS,
    host: process.env.HOST,
  };

  before(async () => {
    delete process.env.SCIAI_API_TOKEN;
    delete process.env.API_TOKEN;
    delete process.env.SCIAI_ALLOW_PUBLIC_UPLOADS;
    process.env.SCIAI_DEV_AUTH_BYPASS = "true";
    process.env.HOST = "localhost";

    await ensureBootstrap();
    const admin = listUsers().find((u) => u.role === "admin" && u.status === "active");
    if (admin) {
      const created = createSession(admin.id);
      sessionCookie = `sciai_session=${encodeURIComponent(created.token)}`;
      csrfToken = csrfForToken(created.token);
    }

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previous.token === undefined) delete process.env.SCIAI_API_TOKEN; else process.env.SCIAI_API_TOKEN = previous.token;
    if (previous.apiToken === undefined) delete process.env.API_TOKEN; else process.env.API_TOKEN = previous.apiToken;
    if (previous.bypass === undefined) delete process.env.SCIAI_DEV_AUTH_BYPASS; else process.env.SCIAI_DEV_AUTH_BYPASS = previous.bypass;
    if (previous.publicUploads === undefined) delete process.env.SCIAI_ALLOW_PUBLIC_UPLOADS; else process.env.SCIAI_ALLOW_PUBLIC_UPLOADS = previous.publicUploads;
    if (previous.host === undefined) delete process.env.HOST; else process.env.HOST = previous.host;
  });

  const buildHeaders = (json = false): Record<string, string> => {
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    if (sessionCookie) h["Cookie"] = sessionCookie;
    if (csrfToken && json) h["x-csrf-token"] = csrfToken;
    return h;
  };

  const post = async (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    });

  const get = async (path: string) =>
    fetch(`${baseUrl}${path}`, {
      headers: buildHeaders(false),
    });

  test("requires explicit pinned inputs and builds an immutable evidence package", async () => {
    const sourceResponse = await post("/api/powerbi/v2/sources", {
      name: "Synthetic v3 regional reference",
      owner: "Synthetic test",
      description: "Synthetic aggregate rows",
      kind: "external_reference",
      aggregateOnly: true,
      provenance: { publisher: "Synthetic publisher", dataset: "Annual totals", reference: "v3-api-fixture" },
      columns: [
        { name: "year", type: "number", role: "dimension" },
        { name: "publication_count", type: "number", role: "metric" },
      ],
    });
    assert.equal(sourceResponse.status, 201);
    const source = (await sourceResponse.json()) as { id: string };

    const snapshotResponse = await post(`/api/powerbi/v2/sources/${source.id}/snapshots`, {
      format: "json",
      asOf: "2026-10-01",
      content: '[{"year":2024,"publication_count":20},{"year":2025,"publication_count":25}]',
    });
    assert.equal(snapshotResponse.status, 201);
    const snapshot = (await snapshotResponse.json()) as { id: string };

    const profileResponse = await post("/api/powerbi/v3/profiles", {
      source_id: source.id,
      kind: "combined_portfolio",
      dimensions: ["year"],
      metrics: ["publication_count"],
      allowed_join_keys: [{ source_column: "year", target: "publication_year", normalization: "exact" }],
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { id: string };

    const dsRes = await get("/api/datasets");
    const datasets = dsRes.ok ? ((await dsRes.json()) as Array<{ id: string }>) : [];
    const targetDatasetId = datasets[0]?.id || "dataset-bio-1";
    const verRes = await get(`/api/datasets/${encodeURIComponent(targetDatasetId)}/versions`);
    const versions = verRes.ok ? ((await verRes.json()) as Array<{ id: string }>) : [];
    const targetVersionId = versions[0]?.id || "version-bio-1";

    const mappingResponse = await post("/api/powerbi/v3/mappings", {
      profile_id: profile.id,
      target_dataset_id: targetDatasetId,
      target_dataset_version_id: targetVersionId,
      source_column: "year",
      target_field: "publication_year",
      normalization: "exact",
    });
    assert.equal(mappingResponse.status, 201);
    const mapping = (await mappingResponse.json()) as { id: string };

    const missingPin = await post("/api/powerbi/v3/combined-models", {
      dataset_id: targetDatasetId,
      snapshot_id: snapshot.id,
      profile_id: profile.id,
      mapping_id: mapping.id,
    });
    assert.equal(missingPin.status, 400);

    const build = await post("/api/powerbi/v3/combined-models", {
      dataset_id: targetDatasetId,
      dataset_version_id: targetVersionId,
      snapshot_id: snapshot.id,
      profile_id: profile.id,
      mapping_id: mapping.id,
    });
    assert.equal(build.status, 201);
    const model = (await build.json()) as {
      manifest: { id: string; model_hash: string; dataset_version_id: string };
      evidence: unknown[];
    };
    assert(model.manifest.id);
    assert.match(model.manifest.model_hash, /^[a-f0-9]{64}$/);
    assert.equal(model.manifest.dataset_version_id, targetVersionId);
    assert(Array.isArray(model.evidence));

    const evidence = await get(`/api/powerbi/v3/combined-models/${model.manifest.id}/evidence`);
    assert.equal(evidence.status, 200);

    const table = await get(`/api/powerbi/v3/combined-models/${model.manifest.id}/tables/combined_aggregate?limit=1`);
    assert.equal(table.status, 200);
    assert.equal((await table.json()).limit, 1);
  });
});


