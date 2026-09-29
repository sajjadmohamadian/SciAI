import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Dataset } from "../src/types.js";

describe("Bulk dataset deletion API", () => {
  const token = "bulk-delete-test-token";
  const originalDbPath = process.env.SCIAI_DB_PATH;
  const originalToken = process.env.SCIAI_API_TOKEN;
  const originalBypass = process.env.SCIAI_DEV_AUTH_BYPASS;
  const originalHost = process.env.HOST;
  let tempDir: string;
  let server: http.Server;
  let baseUrl: string;
  let database: typeof import("../server/db.js");

  const request = (datasetIds: unknown, authenticated = true) => fetch(`${baseUrl}/api/datasets/bulk-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dataset_ids: datasetIds }),
  });

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-bulk-delete-"));
    const dbPath = path.join(tempDir, "fixture.db");
    process.env.SCIAI_DB_PATH = dbPath;
    process.env.SCIAI_API_TOKEN = token;
    process.env.SCIAI_DEV_AUTH_BYPASS = "false";
    process.env.HOST = "localhost";

    database = await import("../server/db.js");
    database.initDb(dbPath);
    for (const id of ["bulk-a", "bulk-b", "bulk-keep"]) {
      const dataset: Dataset = { id, name: id, source: "Test", record_count: 1 };
      database.upsertDataset(dataset);
      database.upsertDatasetVersion({ id: `version-${id}`, dataset_id: id, version: 1, record_count: 1 });
      database.upsertVersionDocuments(`version-${id}`, [
        { id: `document-${id}`, title: id, authors: [], year: 2024, source: "Test", citations: 0, keywords: [] },
      ]);
    }
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

  test("requires authentication and validates the entire requested set", async () => {
    assert.equal((await request(["bulk-a"], false)).status, 401);
    for (const ids of [[], ["bulk-a", "bulk-a"], ["bulk-a", ""], "bulk-a", Array(101).fill("bulk-a")]) {
      assert.equal((await request(ids)).status, 400);
    }
    const missing = await request(["bulk-a", "nonexistent"]);
    assert.equal(missing.status, 404);
    assert(database.getDatasetById("bulk-a"));
  });

  test("rolls back all datasets and leaves caches unchanged on transaction failure", async () => {
    database.getDb().exec(`CREATE TRIGGER reject_bulk_delete BEFORE DELETE ON datasets
      WHEN OLD.id = 'bulk-b' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`);
    try {
      const response = await request(["bulk-a", "bulk-b"]);
      assert.equal(response.status, 500);
      assert(database.getDatasetById("bulk-a"));
      assert(database.getDatasetById("bulk-b"));
      assert.equal((await fetch(`${baseUrl}/api/datasets/bulk-a`)).status, 200);
      assert.equal((await fetch(`${baseUrl}/api/datasets/bulk-b`)).status, 200);
    } finally {
      database.getDb().exec("DROP TRIGGER reject_bulk_delete");
    }
  });

  test("deletes selected datasets and cached versions while preserving unselected datasets", async () => {
    const response = await request(["bulk-a", "bulk-b"]);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.deleted_dataset_ids, ["bulk-a", "bulk-b"]);
    assert.equal(result.deleted_versions_count, 2);
    for (const id of ["bulk-a", "bulk-b"]) {
      assert.equal(database.getDatasetById(id), null);
      assert.equal(database.getDatasetVersionById(`version-${id}`), null);
      assert.equal(database.getVersionDocumentsById(`version-${id}`), null);
      assert.equal((await fetch(`${baseUrl}/api/datasets/${id}`)).status, 404);
    }
    assert(database.getDatasetById("bulk-keep"));
    assert.equal((await fetch(`${baseUrl}/api/datasets/bulk-keep`)).status, 200);
    const versions = await fetch(`${baseUrl}/api/datasets/bulk-a/versions`);
    assert.deepEqual(await versions.json(), []);
  });
});
