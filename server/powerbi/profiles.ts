import { createHash, randomUUID } from "node:crypto";
import { getDb, runTransaction } from "../db.js";
import {
  getSnapshot,
  getSnapshotRows,
  type SnapshotRow,
  type SnapshotSource,
  type SnapshotMetadata,
  type ColumnType,
} from "./snapshots.js";

export const POWERBI_CONTRACT_VERSION = "3.0";
export const POWERBI_CALCULATION_VERSION = "combined-aggregate-v1";

export type ProfileKind = "external_research" | "organizational_intelligence" | "combined_portfolio";
export type CoverageState = "available" | "not_collected" | "not_applicable" | "unavailable";
export type JoinTarget = "publication_year" | "country" | "journal_source" | "keyword";
export type Normalization = "exact" | "trim_lower" | "iso_date";

export interface ProfileJoinKey {
  source_column: string;
  target: JoinTarget;
  normalization: Normalization;
}

export interface PowerBIProfile {
  id: string;
  source_id: string;
  version: number;
  contract_version: typeof POWERBI_CONTRACT_VERSION;
  kind: ProfileKind;
  domain: "aggregate";
  grain: { dimensions: string[]; metrics: string[] };
  allowed_join_keys: ProfileJoinKey[];
  coverage: Record<string, CoverageState>;
  classification: "non_sensitive_aggregate";
  scope: "local_operator";
  created_at: string;
}

export interface CreateProfileInput {
  source_id: string;
  kind: ProfileKind;
  dimensions: string[];
  metrics: string[];
  allowed_join_keys: ProfileJoinKey[];
  coverage?: Record<string, CoverageState>;
}

export interface PowerBIMapping {
  id: string;
  profile_id: string;
  profile_version: number;
  version: number;
  target_dataset_id: string;
  target_dataset_version_id: string;
  source_column: string;
  target_field: JoinTarget;
  normalization: Normalization;
  cardinality: "many_to_one";
  join_scope: "aggregate_group_only";
  created_at: string;
}

export interface CreateMappingInput {
  profile_id: string;
  target_dataset_id: string;
  target_dataset_version_id: string;
  source_column: string;
  target_field: JoinTarget;
  normalization: Normalization;
}

export interface EvidenceRecord {
  id: string;
  metric: string;
  value: number | string | null;
  unit?: string;
  numerator?: number;
  denominator?: number;
  evidence_type: "observed" | "calculated" | "derived";
  source_refs: Array<{ source_id?: string; snapshot_id?: string; dataset_version_id?: string }>;
  method_version: string;
  interpretation_boundary: string;
  limitations: string[];
}

export interface CombinedModelManifest {
  id: string;
  contract_version: typeof POWERBI_CONTRACT_VERSION;
  kind: "combined_portfolio";
  dataset_id: string;
  dataset_version_id: string;
  snapshot_ids: string[];
  profile_ids: string[];
  mapping_ids: string[];
  input_hashes: Record<string, string>;
  model_hash: string;
  calculation_version: typeof POWERBI_CALCULATION_VERSION;
  output_schema: Array<{ name: string; type: ColumnType | "unknown" }>;
  row_count: number;
  coverage: Record<string, CoverageState>;
  limitations: string[];
  created_at: string;
}

export interface CombinedModel {
  manifest: CombinedModelManifest;
  rows: Array<Record<string, string | number | boolean | null>>;
  evidence: EvidenceRecord[];
}

export interface CreateCombinedModelInput {
  dataset_id: string;
  dataset_version_id: string;
  snapshot_id: string;
  profile_id: string;
  mapping_id: string;
  /** Aggregate bibliometric rows prepared by the caller from a pinned dataset version. */
  target_rows: Array<Record<string, string | number | boolean | null>>;
  target_schema: Array<{ name: string; type: ColumnType | "unknown" }>;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function nonEmpty(value: unknown, label: string, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`);
  return value.trim();
}
function listStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24 || value.some((item) => typeof item !== "string" || !/^[a-z][a-z0-9_]{0,47}$/.test(item))) throw new Error(`${label} must contain approved field names`);
  return [...new Set(value)];
}
function canonical(value: unknown): string { return JSON.stringify(value, Object.keys(object(value, "canonical value")).sort()); }
function keyValue(value: unknown, normalization: Normalization): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (value === null) return null;
    if (normalization === "trim_lower") return String(value).trim().toLowerCase();
    if (normalization === "iso_date") {
      const text = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      if (typeof value === "number" && Number.isInteger(value)) return value;
      throw new Error("iso_date normalization requires an ISO date value");
    }
    return value as string | number | boolean;
  }
  throw new Error("Join key value has an unsupported type");
}
function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function sourceAndSnapshot(snapshotId: string): { snapshot: SnapshotMetadata; source: SnapshotSource } {
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot) throw new Error("Snapshot not found");
  const sourceRow = getDb().prepare("SELECT data FROM powerbi_sources WHERE id = ?").get(snapshot.source_id) as { data: string } | undefined;
  if (!sourceRow) throw new Error("Snapshot source not found");
  return { snapshot, source: JSON.parse(sourceRow.data) as SnapshotSource };
}

export function createProfile(input: CreateProfileInput): PowerBIProfile {
  const value = object(input, "Profile");
  const sourceId = nonEmpty(value.source_id, "source_id");
  const sourceRow = getDb().prepare("SELECT data FROM powerbi_sources WHERE id = ?").get(sourceId) as { data: string } | undefined;
  if (!sourceRow) throw new Error("Source not found");
  const source = JSON.parse(sourceRow.data) as SnapshotSource;
  const kind = value.kind;
  if (kind !== "external_research" && kind !== "organizational_intelligence" && kind !== "combined_portfolio") throw new Error("Unsupported profile kind");
  const dimensions = listStrings(value.dimensions, "dimensions");
  const metrics = listStrings(value.metrics, "metrics");
  const sourceNames = new Set(source.columns.map((column) => column.name));
  if (dimensions.some((name) => !sourceNames.has(name)) || metrics.some((name) => !sourceNames.has(name))) throw new Error("Profile fields must exist in the approved source schema");
  const keys = value.allowed_join_keys;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 4) throw new Error("At least one join key is required");
  const allowedTargets = new Set<JoinTarget>(["publication_year", "country", "journal_source", "keyword"]);
  const allowedNormalizations = new Set<Normalization>(["exact", "trim_lower", "iso_date"]);
  const joinKeys = keys.map((item, index) => {
    const key = object(item, `allowed_join_keys[${index}]`);
    const sourceColumn = nonEmpty(key.source_column, "source_column", 48);
    if (!sourceNames.has(sourceColumn) || !dimensions.includes(sourceColumn)) throw new Error("Join key must be an approved dimension");
    if (!allowedTargets.has(key.target as JoinTarget) || !allowedNormalizations.has(key.normalization as Normalization)) throw new Error("Unsupported join key target or normalization");
    return { source_column: sourceColumn, target: key.target as JoinTarget, normalization: key.normalization as Normalization };
  });
  const db = getDb();
  const previous = db.prepare("SELECT MAX(version) AS version FROM powerbi_profiles WHERE source_id = ?").get(sourceId) as { version?: number } | undefined;
  const coverage: Record<string, CoverageState> = Object.fromEntries(metrics.map((metric) => [metric, "available" as CoverageState]));
  if (value.coverage !== undefined) {
    const rawCoverage = object(value.coverage, "coverage");
    const allowedStates = new Set<CoverageState>(["available", "not_collected", "not_applicable", "unavailable"]);
    for (const [field, state] of Object.entries(rawCoverage)) {
      if (!metrics.includes(field) || !allowedStates.has(state as CoverageState)) throw new Error("Coverage must use metric names and approved states");
      coverage[field] = state as CoverageState;
    }
  }
  const profile: PowerBIProfile = {
    id: randomUUID(), source_id: sourceId, version: Number(previous?.version || 0) + 1,
    contract_version: POWERBI_CONTRACT_VERSION, kind, domain: "aggregate",
    grain: { dimensions, metrics }, allowed_join_keys: joinKeys,
    coverage,
    classification: "non_sensitive_aggregate", scope: "local_operator", created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO powerbi_profiles (id, source_id, version, data) VALUES (?, ?, ?, ?)").run(profile.id, sourceId, profile.version, JSON.stringify(profile));
  return profile;
}

export function getProfile(id: string): PowerBIProfile | null {
  const row = getDb().prepare("SELECT data FROM powerbi_profiles WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as PowerBIProfile : null;
}
export function listProfiles(sourceId?: string): PowerBIProfile[] {
  const rows = sourceId ? getDb().prepare("SELECT data FROM powerbi_profiles WHERE source_id = ? ORDER BY version DESC").all(sourceId) : getDb().prepare("SELECT data FROM powerbi_profiles ORDER BY rowid DESC").all();
  return (rows as Array<{ data: string }>).map((row) => JSON.parse(row.data) as PowerBIProfile);
}

export function createMapping(input: CreateMappingInput): PowerBIMapping {
  const profile = getProfile(input.profile_id);
  if (!profile) throw new Error("Profile not found");
  const sourceRow = getDb().prepare("SELECT data FROM powerbi_sources WHERE id = ?").get(profile.source_id) as { data: string } | undefined;
  if (!sourceRow) throw new Error("Profile source not found");
  const source = JSON.parse(sourceRow.data) as SnapshotSource;
  const sourceColumn = nonEmpty(input.source_column, "source_column", 48);
  const join = profile.allowed_join_keys.find((item) => item.source_column === sourceColumn && item.target === input.target_field && item.normalization === input.normalization);
  if (!join) throw new Error("Mapping is not permitted by the profile");
  if (!/^[-a-zA-Z0-9_]+$/.test(input.target_dataset_id) || !nonEmpty(input.target_dataset_version_id, "target_dataset_version_id")) throw new Error("Target dataset/version is required");
  if (!["publication_year", "country", "journal_source", "keyword"].includes(input.target_field) || !["exact", "trim_lower", "iso_date"].includes(input.normalization)) throw new Error("Unsupported mapping");
  const db = getDb();
  const previous = db.prepare("SELECT MAX(version) AS version FROM powerbi_mappings WHERE profile_id = ?").get(profile.id) as { version?: number } | undefined;
  const mapping: PowerBIMapping = {
    id: randomUUID(), profile_id: profile.id, profile_version: profile.version, version: Number(previous?.version || 0) + 1,
    target_dataset_id: input.target_dataset_id, target_dataset_version_id: input.target_dataset_version_id,
    source_column: sourceColumn, target_field: input.target_field, normalization: input.normalization,
    cardinality: "many_to_one", join_scope: "aggregate_group_only", created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO powerbi_mappings (id, profile_id, version, data) VALUES (?, ?, ?, ?)").run(mapping.id, mapping.profile_id, mapping.version, JSON.stringify(mapping));
  return mapping;
}
export function getMapping(id: string): PowerBIMapping | null {
  const row = getDb().prepare("SELECT data FROM powerbi_mappings WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as PowerBIMapping : null;
}

export function createCombinedModel(input: CreateCombinedModelInput): CombinedModel {
  if (!Array.isArray(input.target_rows) || input.target_rows.length > 5000) throw new Error("Target rows exceed the bounded model limit");
  const profile = getProfile(input.profile_id);
  const mapping = getMapping(input.mapping_id);
  if (!profile || !mapping || mapping.profile_id !== profile.id) throw new Error("Profile or mapping not found");
  if (mapping.target_dataset_id !== input.dataset_id || mapping.target_dataset_version_id !== input.dataset_version_id) throw new Error("Mapping target does not match the pinned dataset version");
  const { snapshot, source } = sourceAndSnapshot(input.snapshot_id);
  if (snapshot.source_id !== profile.source_id) throw new Error("Snapshot does not belong to the profile source");
  if (!source.columns.some((column) => column.name === mapping.source_column && column.role === "dimension")) throw new Error("Mapping source column is not a dimension");
  const keys = new Map<string, SnapshotRow>();
  const page = getSnapshotRows(snapshot.id, { offset: 0, limit: 100 });
  if (!page) throw new Error("Snapshot not found");
  let offset = 0;
  while (true) {
    const current = getSnapshotRows(snapshot.id, { offset, limit: 100 });
    if (!current) throw new Error("Snapshot not found");
    for (const row of current.rows) {
      const key = keyValue(row[mapping.source_column], mapping.normalization);
      if (key === null) throw new Error("Null aggregate join key is not allowed");
      const encoded = `${typeof key}:${String(key)}`;
      if (keys.has(encoded)) throw new Error("Source snapshot contains duplicate aggregate join keys");
      keys.set(encoded, row);
    }
    if (current.next_offset === null) break;
    offset = current.next_offset;
  }
  const rows: Array<Record<string, string | number | boolean | null>> = [];
  let unmatched = 0;
  const sourceColumns = source.columns.filter((column) => column.name !== mapping.source_column);
  for (const target of input.target_rows) {
    const targetValue = target[mapping.target_field];
    const key = keyValue(targetValue, mapping.normalization);
    if (key === null) { unmatched++; continue; }
    const sourceRow = keys.get(`${typeof key}:${String(key)}`);
    if (!sourceRow) { unmatched++; continue; }
    const output: Record<string, string | number | boolean | null> = { ...target };
    for (const column of sourceColumns) output[`source_${column.name}`] = sourceRow[column.name] ?? null;
    rows.push(output);
  }
  const limitations = [
    "Local operator scope only; this is not tenant authorization or a hosted Power BI Service connector.",
    "Only explicitly declared aggregate-group joins are materialized; no publication-, author-, student-, patient-, or person-level inference is performed.",
    "Unmatched groups are excluded from the combined rows and reported as evidence.",
  ];
  const inputHashes = {
    [`dataset:${input.dataset_id}:${input.dataset_version_id}`]: hash(input.target_rows),
    [`snapshot:${snapshot.id}`]: snapshot.content_sha256,
    [`profile:${profile.id}`]: hash(profile),
    [`mapping:${mapping.id}`]: hash(mapping),
  };
  const manifestSeed = { contract_version: POWERBI_CONTRACT_VERSION, dataset_id: input.dataset_id, dataset_version_id: input.dataset_version_id, snapshot_ids: [snapshot.id], profile_ids: [profile.id], mapping_ids: [mapping.id], input_hashes: inputHashes, calculation_version: POWERBI_CALCULATION_VERSION, rows };
  const manifest: CombinedModelManifest = {
    id: randomUUID(), contract_version: POWERBI_CONTRACT_VERSION, kind: "combined_portfolio",
    dataset_id: input.dataset_id, dataset_version_id: input.dataset_version_id, snapshot_ids: [snapshot.id], profile_ids: [profile.id], mapping_ids: [mapping.id], input_hashes: inputHashes,
    model_hash: hash(manifestSeed), calculation_version: POWERBI_CALCULATION_VERSION,
    output_schema: [...input.target_schema, ...sourceColumns.map((column) => ({ name: `source_${column.name}`, type: column.type }))],
    row_count: rows.length, coverage: { ...profile.coverage, combined_rows: rows.length ? "available" : "unavailable", unmatched_groups: unmatched ? "available" : "not_applicable" }, limitations, created_at: new Date().toISOString(),
  };
  const evidence: EvidenceRecord[] = [
    { id: randomUUID(), metric: "combined_group_count", value: rows.length, unit: "groups", numerator: rows.length, denominator: input.target_rows.length, evidence_type: "calculated", source_refs: [{ dataset_version_id: input.dataset_version_id }, { source_id: source.id, snapshot_id: snapshot.id }], method_version: POWERBI_CALCULATION_VERSION, interpretation_boundary: "Count of pinned target groups with one matching approved aggregate observation.", limitations },
    { id: randomUUID(), metric: "unmatched_group_count", value: unmatched, unit: "groups", numerator: unmatched, denominator: input.target_rows.length, evidence_type: "calculated", source_refs: [{ dataset_version_id: input.dataset_version_id }, { source_id: source.id, snapshot_id: snapshot.id }], method_version: POWERBI_CALCULATION_VERSION, interpretation_boundary: "Target groups without an exact contract-approved source match.", limitations },
  ];
  const db = getDb();
  runTransaction(db, () => {
    db.prepare("INSERT INTO powerbi_combined_models (id, data) VALUES (?, ?)").run(manifest.id, JSON.stringify({ manifest, evidence }));
    const insert = db.prepare("INSERT INTO powerbi_combined_model_rows (model_id, row_index, data) VALUES (?, ?, ?)");
    rows.forEach((row, index) => insert.run(manifest.id, index, JSON.stringify(row)));
  });
  return { manifest, rows, evidence };
}

export function getCombinedModel(id: string): CombinedModel | null {
  const modelRow = getDb().prepare("SELECT data FROM powerbi_combined_models WHERE id = ?").get(id) as { data: string } | undefined;
  if (!modelRow) return null;
  const stored = JSON.parse(modelRow.data) as { manifest: CombinedModelManifest; evidence: EvidenceRecord[] };
  const rows = getDb().prepare("SELECT data FROM powerbi_combined_model_rows WHERE model_id = ? ORDER BY row_index").all(id) as Array<{ data: string }>;
  return { manifest: stored.manifest, evidence: stored.evidence, rows: rows.map((row) => JSON.parse(row.data)) };
}
export function getCombinedRows(id: string, offset = 0, limit = 100): { model: CombinedModelManifest; rows: Array<Record<string, unknown>>; offset: number; limit: number; next_offset: number | null } | null {
  const model = getCombinedModel(id);
  if (!model) return null;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid combined model pagination");
  const rows = getDb().prepare("SELECT data FROM powerbi_combined_model_rows WHERE model_id = ? AND row_index >= ? ORDER BY row_index LIMIT ?").all(id, offset, limit) as Array<{ data: string }>;
  return { model: model.manifest, rows: rows.map((row) => JSON.parse(row.data)), offset, limit, next_offset: offset + rows.length < model.manifest.row_count ? offset + rows.length : null };
}

export interface RefreshRun { id: string; model_id: string | null; idempotency_key: string; operation: "build" | "refresh"; status: "completed" | "failed"; requested_at: string; completed_at: string; output_row_count?: number; error_code?: string; error_message?: string }
export function recordRefreshRun(run: Omit<RefreshRun, "id">): RefreshRun {
  const db = getDb();
  const existing = db.prepare("SELECT data FROM powerbi_refresh_runs WHERE idempotency_key = ?").get(run.idempotency_key) as { data: string } | undefined;
  if (existing) return JSON.parse(existing.data) as RefreshRun;
  const result = { ...run, id: randomUUID() };
  db.prepare("INSERT INTO powerbi_refresh_runs (id, model_id, idempotency_key, data) VALUES (?, ?, ?, ?)").run(result.id, result.model_id, result.idempotency_key, JSON.stringify(result));
  return result;
}
export function getRefreshRun(idempotencyKey: string): RefreshRun | null {
  const row = getDb().prepare("SELECT data FROM powerbi_refresh_runs WHERE idempotency_key = ?").get(idempotencyKey) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as RefreshRun : null;
}
