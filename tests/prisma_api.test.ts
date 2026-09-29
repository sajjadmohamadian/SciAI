import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { BibliometricDocument, Dataset, DatasetVersion } from "../src/types.js";

describe("PRISMA API routes and persistence", () => {
  const token = "prisma-api-test-token";
  const datasetId = "prisma-api-dataset";
  const sourceVersionId = "prisma-api-source-version";
  const otherDatasetId = "prisma-api-other-dataset";
  const otherVersionId = "prisma-api-other-version";
  const originalDbPath = process.env.SCIAI_DB_PATH;
  const originalToken = process.env.SCIAI_API_TOKEN;
  const originalBypass = process.env.SCIAI_DEV_AUTH_BYPASS;
  const originalHost = process.env.HOST;
  let tempDir: string;
  let dbPath: string;
  let server: http.Server;
  let baseUrl: string;
  let database: typeof import("../server/db.js");

  const document = (id: string, title: string, doi?: string): BibliometricDocument => ({
    id, title, doi, authors: ["Test Author"], year: 2024,
    source: "Test Journal", citations: 0, keywords: [],
  });

  const request = (route: string, method = "GET", body?: object) => fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-prisma-api-"));
    dbPath = path.join(tempDir, "prisma.db");
    process.env.SCIAI_DB_PATH = dbPath;
    process.env.SCIAI_API_TOKEN = token;
    process.env.SCIAI_DEV_AUTH_BYPASS = "false";
    process.env.HOST = "localhost";

    // Seed only this isolated database before importing the server, so its cache
    // hydrates our controlled fixtures rather than application sample datasets.
    database = await import("../server/db.js");
    database.initDb(dbPath);
    const dataset: Dataset = {
      id: datasetId, name: "PRISMA route fixture", source: "Scopus",
      record_count: 4, status: "available", created_at: "2024-01-01T00:00:00.000Z",
    };
    const otherDataset: Dataset = {
      ...dataset, id: otherDatasetId, name: "Unrelated PRISMA fixture", record_count: 1,
    };
    const sourceVersion: DatasetVersion = {
      id: sourceVersionId, dataset_id: datasetId, version: 1, version_number: 1,
      record_count: 4, document_count: 4, created_at: "2024-01-01T00:00:00.000Z",
      metadata: { ingestion: { raw_input_count: 4, source_counts: { Scopus: 4 }, duplicates_removed: 0, final_unique_count: 4 } },
    };
    database.upsertDataset(dataset);
    database.upsertDataset(otherDataset);
    database.upsertDatasetVersion(sourceVersion);
    database.upsertDatasetVersion({
      ...sourceVersion, id: otherVersionId, dataset_id: otherDatasetId,
      record_count: 1, document_count: 1,
      metadata: { ingestion: { raw_input_count: 1, source_counts: { Scopus: 1 }, duplicates_removed: 0, final_unique_count: 1 } },
    });
    database.upsertVersionDocuments(sourceVersionId, [
      document("retain-doi", "First unique research article", "10.1234/first"),
      document("duplicate-doi", "Different title, same DOI", "https://doi.org/10.1234/first"),
      document("retain-title", "Second unique research article"),
      document("duplicate-title", "Second unique research article"),
    ]);
    database.upsertVersionDocuments(otherVersionId, [document("other-doc", "Unrelated research article")]);
    database.closeDb();

    const { app } = await import("../server.ts");
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    database?.closeDb();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    for (const [name, value] of [
      ["SCIAI_DB_PATH", originalDbPath], ["SCIAI_API_TOKEN", originalToken],
      ["SCIAI_DEV_AUTH_BYPASS", originalBypass], ["HOST", originalHost],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test("missing datasets and versions return 404", async () => {
    const missingDataset = await request("/api/datasets/prisma-api-missing/prisma");
    assert.equal(missingDataset.status, 404);
    assert.equal((await missingDataset.json()).error, "Dataset not found");

    const missingVersion = await request(`/api/datasets/${datasetId}/prisma?version_id=prisma-api-missing`);
    assert.equal(missingVersion.status, 404);
    assert.equal((await missingVersion.json()).error, "Dataset version not found");

    const missingWrite = await request(`/api/datasets/${datasetId}/versions/prisma-api-missing/prisma`, "PUT", {});
    assert.equal(missingWrite.status, 404);
    const missingDedup = await request(`/api/datasets/${datasetId}/dedup`, "POST", { version_id: "prisma-api-missing" });
    assert.equal(missingDedup.status, 404);
  });

  test("versions from another dataset are rejected on read, write and dedup", async () => {
    const read = await request(`/api/datasets/${datasetId}/prisma?version_id=${otherVersionId}`);
    const write = await request(`/api/datasets/${datasetId}/versions/${otherVersionId}/prisma`, "PUT", { included_studies: 1 });
    const dedup = await request(`/api/datasets/${datasetId}/dedup`, "POST", { version_id: otherVersionId });
    for (const response of [read, write, dedup]) {
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error, "Dataset version not found");
    }
    assert.equal(database.getDatasetVersionById(otherVersionId)?.metadata?.prisma, undefined);
    assert.equal(database.loadAllDatasetVersions().length, 2);
  });

  test("invalid manual writes preserve the previous workflow in API and SQLite", async () => {
    const route = `/api/datasets/${datasetId}/versions/${sourceVersionId}/prisma`;
    const valid = await request(route, "PUT", {
      identified_registers: 0, removed_automation: 0, removed_other: 0,
      excluded_screening: 1, not_retrieved: 0,
      exclusion_reasons: [{ reason: "Out of scope", count: 1 }], included_studies: 2,
    });
    assert.equal(valid.status, 200);
    const saved = await valid.json();
    assert.equal(saved.consistency.valid, true);
    assert.equal(saved.flow.included_studies.value, 2);
    const persistedBefore = database.getDatasetVersionById(sourceVersionId);
    assert.deepEqual(persistedBefore?.metadata?.prisma, saved.version.metadata.prisma);

    const malformed = await request(route, "PUT", { included_studies: -1 });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json()).details.join(" "), /included_studies/);
    const contradictory = await request(route, "PUT", { excluded_screening: 5 });
    assert.equal(contradictory.status, 400);
    assert.match((await contradictory.json()).details.join(" "), /Screening exclusions/);

    const readBack = await request(`/datasets/${datasetId}/prisma?version_id=${sourceVersionId}`);
    assert.equal(readBack.status, 200);
    const body = await readBack.json();
    assert.deepEqual(body.version.metadata.prisma, persistedBefore?.metadata?.prisma);
    assert.equal(body.flow.excluded_screening.value, 1);
    assert.deepEqual(database.getDatasetVersionById(sourceVersionId), persistedBefore);
  });

  test("dedup creates a new version with auditable lineage without changing its parent", async () => {
    const response = await request(`/api/datasets/${datasetId}/dedup`, "POST", { version_id: sourceVersionId });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.source_version.id, sourceVersionId);
    assert.notEqual(result.version.id, sourceVersionId);
    assert.equal(result.version.dataset_id, datasetId);
    assert.equal(result.version.version_number, 2);
    assert.equal(result.version.record_count, 2);
    assert.equal(result.summary.total_raw_inputs, 4);
    assert.equal(result.summary.duplicates_resolved, 2);
    assert.equal(result.summary.final_unique_count, 2);
    assert.deepEqual(result.summary.audit_log.map((entry: any) => ({
      document_id: entry.document_id, retained_id: entry.retained_id, rule: entry.rule,
    })), [
      { document_id: "duplicate-doi", retained_id: "retain-doi", rule: "exact_doi" },
      { document_id: "duplicate-title", retained_id: "retain-title", rule: "exact_title" },
    ]);
    assert.equal(result.version.metadata.ingestion.parent_version_id, sourceVersionId);
    assert.equal(result.version.metadata.ingestion.operation, "exact_doi_title_deduplication");
    assert.equal(result.version.metadata.ingestion.method_version, result.flow.method_version);
    assert.deepEqual(result.version.metadata.ingestion.cluster_summary, [
      { retained_id: "retain-doi", removed_count: 1 },
      { retained_id: "retain-title", removed_count: 1 },
    ]);
    assert.equal(result.version.metadata.ingestion.raw_input_count, 4);
    assert.equal(result.version.metadata.ingestion.duplicates_removed, 2);
    assert.equal(result.version.metadata.ingestion.final_unique_count, 2);
    assert.deepEqual(result.version.metadata.ingestion.removed_document_ids, ["duplicate-doi", "duplicate-title"]);
    assert.deepEqual(result.version.metadata.ingestion.dedup_audit, result.summary.audit_log);
    assert.equal(result.version.metadata.prisma, undefined, "Review decisions must not carry into a new version");
    assert.equal(result.flow.removed_duplicates.value, 2);
    assert.equal(result.flow.consistency.valid, true);
    assert.deepEqual(database.getVersionDocumentsById(result.version.id)?.map((doc) => doc.id), ["retain-doi", "retain-title"]);
    assert.equal(database.getVersionDocumentsById(sourceVersionId)?.length, 4);
    const firstPage = await request(`/api/datasets/${datasetId}/documents?version_id=${result.version.id}&limit=1&offset=0`);
    assert.equal(firstPage.status, 200);
    const page = await firstPage.json();
    assert.equal(page.version_id, result.version.id);
    assert.equal(page.total, 2);
    assert.equal(page.documents.length, 1);
    assert.equal((database.getDatasetVersionById(sourceVersionId)?.metadata?.ingestion as { duplicates_removed?: number })?.duplicates_removed, 0);

    // Reopen the isolated SQLite file to check committed versions, documents,
    // lineage and manual review independently of the server's in-memory maps.
    database.closeDb();
    database.initDb(dbPath);
    assert.deepEqual(database.getDatasetVersionById(result.version.id), result.version);
    assert.deepEqual(database.getVersionDocumentsById(result.version.id)?.map((doc) => doc.id), ["retain-doi", "retain-title"]);
    assert.equal((database.getDatasetVersionById(sourceVersionId)?.metadata?.prisma as { manual?: { included_studies?: number } })?.manual?.included_studies, 2);
    assert.equal(database.getVersionDocumentsById(sourceVersionId)?.length, 4);
    assert.equal(database.getDatasetById(datasetId)?.record_count, 2);

    const latest = await request(`/api/datasets/${datasetId}/prisma`);
    assert.equal(latest.status, 200);
    const latestBody = await latest.json();
    assert.equal(latestBody.version.id, result.version.id);
    assert.equal(latestBody.document_count, 2);
    assert.equal(latestBody.flow.removed_duplicates.value, 2);
  });

  test("AI report rejects server-owned contradictory flow despite client-supplied counts", async () => {
    const invalidVersionId = "prisma-api-inconsistent-version";
    database.upsertDatasetVersion({
      id: invalidVersionId, dataset_id: datasetId, version: 0, version_number: 0,
      record_count: 4, document_count: 4, created_at: "2023-01-01T00:00:00.000Z",
      metadata: { ingestion: { raw_input_count: 4, source_counts: { Scopus: 4 }, duplicates_removed: 5, final_unique_count: 4 } },
    });
    database.upsertVersionDocuments(invalidVersionId, database.getVersionDocumentsById(sourceVersionId) || []);
    const response = await request("/api/ai/prisma-report", "POST", {
      dataset_id: datasetId, dataset_version_id: invalidVersionId,
      identifiedDatabases: 100, removedDuplicates: 0, screened: 100, includedStudies: 100,
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).details.join(" "), /duplicates/i);
  });
});
