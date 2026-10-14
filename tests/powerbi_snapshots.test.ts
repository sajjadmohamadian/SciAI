import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb, initDb } from "../server/db.js";
import {
  createSource, listSources, createSnapshot, listSnapshots, getSnapshot, getSnapshotRows,
  SNAPSHOT_LIMITS, type CreateSourceInput,
} from "../server/powerbi/snapshots.js";

describe("Power BI v2 aggregate snapshot persistence", () => {
  let directory: string;
  const internal: CreateSourceInput = {
    name: "Department output", owner: "Planning office", description: "Aggregated annual department output",
    kind: "internal_aggregate", aggregateOnly: true,
    provenance: { publisher: "Planning office", dataset: "Annual output", reference: "2025 internal release" },
    columns: [
      { name: "department", type: "string", role: "dimension" },
      { name: "publication_count", type: "number", role: "metric" },
      { name: "group_size", type: "number", role: "group_size" },
    ],
  };
  beforeEach(() => {
    closeDb();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-powerbi-snapshots-"));
    initDb(path.join(directory, "test.db"));
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("creates an immutable source and paginates stable typed CSV rows", () => {
    const source = createSource(internal);
    assert.equal(source.classification, "non_sensitive_aggregate");
    assert.deepEqual(listSources(), [source]);
    const csv = 'group_size,publication_count,department\r\n6,12,"Research, North"\r\n8,4,South\r\n9,7,West\r\n';
    const first = createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: csv });
    assert.equal(first.as_of, "2025-12-31");
    assert.match(first.imported_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(first.version, 1);
    assert.equal(first.previous_snapshot_id, null);
    assert.equal(first.row_count, 3);
    assert.match(first.content_sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(getSnapshot(first.id), first);
    assert.deepEqual(getSnapshotRows(first.id, { offset: 0, limit: 2 })?.rows, [
      { department: "Research, North", publication_count: 12, group_size: 6 },
      { department: "South", publication_count: 4, group_size: 8 },
    ]);
    assert.equal(getSnapshotRows(first.id, { offset: 0, limit: 2 })?.next_offset, 2);
    assert.deepEqual(getSnapshotRows(first.id, { offset: 2, limit: 2 })?.rows, [
      { department: "West", publication_count: 7, group_size: 9 },
    ]);
    assert.equal(getSnapshotRows(first.id, { offset: 3 })?.next_offset, null);
    assert.equal(getSnapshot("missing"), null);
    assert.equal(getSnapshotRows("missing"), null);
    assert.equal(listSnapshots(source.id).length, 1);

    closeDb();
    initDb(path.join(directory, "test.db"));
    assert.deepEqual(getSnapshot(first.id), first);
    assert.equal(getSnapshotRows(first.id)?.rows.length, 3);
    assert.deepEqual(listSources(), [source]);
  });

  test("refresh versions and content fingerprints are deterministic without changing historical data", () => {
    const source = createSource(internal);
    const csv = "department,publication_count,group_size\nNorth,12,6";
    const one = createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: csv });
    const two = createSnapshot({ sourceId: source.id, format: "json", asOf: "2025-12-31", content: JSON.stringify([
      { department: "North", publication_count: 12, group_size: 6 },
    ]) });
    assert.equal(two.version, 2);
    assert.equal(two.previous_snapshot_id, one.id);
    assert.equal(one.content_sha256, two.content_sha256);
    assert.deepEqual(listSnapshots(source.id).map(({ id }) => id), [two.id, one.id]);
    assert.equal(getSnapshotRows(one.id)?.rows[0].publication_count, 12);
    const other = createSource({ ...internal, name: "Another unit" });
    assert.equal(createSnapshot({ sourceId: other.id, format: "csv", asOf: "2025-12-31", content: csv }).version, 1);
  });

  test("rejects suspicious or unapproved columns, false aggregate attestation and small internal groups", () => {
    assert.throws(() => createSource({ ...internal, aggregateOnly: false as true }), /Aggregate-only/);
    for (const bad of ["employee_id", "email", "patient_count", "salary_sum", "name", "secret_count"]) {
      assert.throws(() => createSource({ ...internal, columns: [internal.columns[0], { name: bad, type: "number", role: "metric" }, internal.columns[2]] }), /sensitive|server-approved/i);
    }
    assert.throws(() => createSource({ ...internal, columns: [internal.columns[0], internal.columns[1]] }), /group_size/);
    assert.throws(() => createSource({ ...internal, columns: [internal.columns[0], internal.columns[0], internal.columns[1], internal.columns[2]] }), /duplicate/);
    const source = createSource(internal);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-02-30", content: "department,publication_count,group_size\nNorth,4,5" }), /ISO calendar date/);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "json", asOf: "2025-12-31", content: '[{"department":"North","publication_count":2,"group_size":4}]' }), /privacy minimum/);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "json", asOf: "2025-12-31", content: '[{"department":"North","publication_count":2,"group_size":5,"person":"Jane"}]' }), /approved columns/);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: "department,publication_count,group_size\nJane@example.com,2,5" }), /non-sensitive/);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: "department,publication_count,group_size\n=cmd,2,5" }), /non-sensitive/);
    assert.deepEqual(listSnapshots(source.id), []);
  });

  test("validates CSV structure, JSON types, payload bounds, and pagination", () => {
    const source = createSource(internal);
    const put = (format: "csv" | "json", content: string) => createSnapshot({ sourceId: source.id, format, asOf: "2025-12-31", content });
    assert.throws(() => put("csv", "department,department,group_size\nNorth,4,5"), /unique headers/);
    assert.throws(() => put("csv", 'department,publication_count,group_size\n"unclosed,4,5'), /Unterminated/);
    assert.throws(() => put("csv", "department,publication_count,group_size\nNorth,4"), /width/);
    assert.throws(() => put("json", '[{"department":"North","publication_count":"4","group_size":5}]'), /finite number/);
    assert.throws(() => put("json", '{}'), /row count/);
    assert.throws(() => put("csv", "x".repeat(SNAPSHOT_LIMITS.maxBytes + 1)), /1 MiB/);
    const snapshot = put("csv", "department,publication_count,group_size\nNorth,4,5");
    for (const options of [{ offset: -1 }, { offset: 1.5 }, { limit: 0 }, { limit: 101 }]) {
      assert.throws(() => getSnapshotRows(snapshot.id, options), /pagination/);
    }
  });

  test("rollback preserves no partial snapshot and DB triggers reject edits/deletes", () => {
    const source = createSource(internal);
    const db = getDb();
    db.exec(`CREATE TRIGGER fail_second_row BEFORE INSERT ON powerbi_snapshot_rows
      WHEN NEW.row_index = 1 BEGIN SELECT RAISE(ABORT, 'second row failure'); END`);
    assert.throws(() => createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: "department,publication_count,group_size\nNorth,4,5\nSouth,7,8" }), /second row failure/);
    assert.deepEqual(listSnapshots(source.id), []);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM powerbi_snapshot_rows").get() as { n: number }).n, 0);
    db.exec("DROP TRIGGER fail_second_row");
    const snapshot = createSnapshot({ sourceId: source.id, format: "csv", asOf: "2025-12-31", content: "department,publication_count,group_size\nNorth,4,5" });
    assert.equal(snapshot.version, 1);
    assert.throws(() => db.prepare("UPDATE powerbi_snapshots SET version = 10 WHERE id = ?").run(snapshot.id), /immutable/);
    assert.throws(() => db.prepare("DELETE FROM powerbi_snapshot_rows WHERE snapshot_id = ?").run(snapshot.id), /immutable/);
    assert.throws(() => db.prepare("UPDATE powerbi_sources SET kind = 'external_reference' WHERE id = ?").run(source.id), /immutable/);
    assert.equal(getSnapshotRows(snapshot.id)?.rows.length, 1);
  });

  test("external reference snapshots can omit the internal privacy group count", () => {
    const source = createSource({
      ...internal, kind: "external_reference",
      columns: internal.columns.slice(0, 2),
      provenance: { publisher: "Public agency", dataset: "Regional totals", reference: "Agency release 2025" },
    });
    const snapshot = createSnapshot({ sourceId: source.id, format: "json", asOf: "2025-12-31", content: '[{"department":"North","publication_count":2}]' });
    assert.deepEqual(getSnapshotRows(snapshot.id)?.rows, [{ department: "North", publication_count: 2 }]);
  });
});
