import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb, initDb } from "../server/db.js";
import { createSource, createSnapshot, type CreateSourceInput } from "../server/powerbi/snapshots.js";
import {
  createProfile,
  createMapping,
  createCombinedModel,
  getCombinedModel,
  getCombinedRows,
} from "../server/powerbi/profiles.js";

describe("Power BI v3 governed combined evidence model", () => {
  let directory: string;
  const sourceInput: CreateSourceInput = {
    name: "Synthetic unit output", owner: "Research office", description: "Synthetic aggregate fixture",
    kind: "internal_aggregate", aggregateOnly: true,
    provenance: { publisher: "Synthetic office", dataset: "Unit output", reference: "fixture-2026" },
    columns: [
      { name: "year", type: "number", role: "dimension" },
      { name: "publication_count", type: "number", role: "metric" },
      { name: "group_size", type: "number", role: "group_size" },
    ],
  };
  beforeEach(() => {
    closeDb();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-powerbi-v3-"));
    initDb(path.join(directory, "test.db"));
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("creates a pinned profile, mapping, deterministic combined rows and evidence", () => {
    const source = createSource(sourceInput);
    const snapshot = createSnapshot({ sourceId: source.id, format: "json", asOf: "2026-09-30", content: JSON.stringify([
      { year: 2024, publication_count: 18, group_size: 8 },
      { year: 2025, publication_count: 23, group_size: 9 },
    ]) });
    const profile = createProfile({ source_id: source.id, kind: "combined_portfolio", dimensions: ["year"], metrics: ["publication_count"], allowed_join_keys: [{ source_column: "year", target: "publication_year", normalization: "exact" }] });
    const mapping = createMapping({ profile_id: profile.id, target_dataset_id: "dataset-synthetic", target_dataset_version_id: "version-synthetic", source_column: "year", target_field: "publication_year", normalization: "exact" });
    const input = {
      dataset_id: "dataset-synthetic", dataset_version_id: "version-synthetic", snapshot_id: snapshot.id, profile_id: profile.id, mapping_id: mapping.id,
      target_rows: [
        { publication_year: 2024, publication_count: 10, citation_total: 42 },
        { publication_year: 2025, publication_count: 12, citation_total: 55 },
        { publication_year: 2026, publication_count: 2, citation_total: 3 },
      ],
      target_schema: [
        { name: "publication_year", type: "number" as const },
        { name: "publication_count", type: "number" as const },
        { name: "citation_total", type: "number" as const },
      ],
    };
    const first = createCombinedModel(input);
    const second = createCombinedModel(input);
    assert.equal(first.manifest.row_count, 2);
    assert.equal(first.manifest.model_hash, second.manifest.model_hash);
    assert.equal(first.evidence.find((item) => item.metric === "unmatched_group_count")?.value, 1);
    assert.equal(first.rows[0].source_publication_count, 18);
    assert.equal(first.manifest.snapshot_ids[0], snapshot.id);
    assert.equal(first.manifest.dataset_version_id, "version-synthetic");
    assert.equal(getCombinedModel(first.manifest.id)?.rows.length, 2);
    assert.deepEqual(getCombinedRows(first.manifest.id, 0, 1)?.rows.length, 1);
  });

  test("rejects unapproved mappings and duplicate source aggregate keys", () => {
    const source = createSource(sourceInput);
    const snapshot = createSnapshot({ sourceId: source.id, format: "json", asOf: "2026-09-30", content: '[{"year":2024,"publication_count":18,"group_size":8}]' });
    const profile = createProfile({ source_id: source.id, kind: "organizational_intelligence", dimensions: ["year"], metrics: ["publication_count"], allowed_join_keys: [{ source_column: "year", target: "publication_year", normalization: "exact" }] });
    assert.throws(() => createMapping({ profile_id: profile.id, target_dataset_id: "d", target_dataset_version_id: "v", source_column: "year", target_field: "country", normalization: "exact" }), /not permitted/);
    const mapping = createMapping({ profile_id: profile.id, target_dataset_id: "d", target_dataset_version_id: "v", source_column: "year", target_field: "publication_year", normalization: "exact" });
    const second = createSnapshot({ sourceId: source.id, format: "json", asOf: "2026-10-01", content: '[{"year":2024,"publication_count":19,"group_size":8},{"year":2024,"publication_count":20,"group_size":9}]' });
    assert.throws(() => createCombinedModel({ dataset_id: "d", dataset_version_id: "v", snapshot_id: second.id, profile_id: profile.id, mapping_id: mapping.id, target_rows: [{ publication_year: 2024 }], target_schema: [{ name: "publication_year", type: "number" }] }), /duplicate|source/i);
    const db = getDb();
    assert.throws(() => db.prepare("UPDATE powerbi_profiles SET version = 9 WHERE id = ?").run(profile.id), /immutable/);
    assert.equal(snapshot.id.length > 0, true);
  });
});
