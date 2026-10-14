import { createHash, randomUUID } from "node:crypto";
import { getDb, runTransaction } from "../db.js";

/** This service stores only bounded, already-aggregated tables; it never runs source SQL or fetches URLs. */
export const SNAPSHOT_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxRows: 5_000, maxColumns: 24, maxCellLength: 256, minInternalGroupSize: 5, maxPageSize: 100 });

export type SourceKind = "internal_aggregate" | "external_reference";
export type ColumnType = "string" | "number" | "boolean" | "date";
export type ColumnRole = "dimension" | "metric" | "group_size";
export interface ApprovedColumn { name: string; type: ColumnType; role: ColumnRole }
export interface SourceProvenance { publisher: string; dataset: string; reference: string }
export interface CreateSourceInput {
  name: string;
  owner: string;
  description: string;
  license?: string;
  kind: SourceKind;
  provenance: SourceProvenance;
  columns: ApprovedColumn[];
  /** Explicit publisher assertion. Internal rows are additionally checked for minimum group size. */
  aggregateOnly: true;
}
export interface SnapshotSource {
  id: string;
  name: string;
  owner: string;
  description: string;
  license?: string;
  kind: SourceKind;
  classification: "non_sensitive_aggregate";
  provenance: SourceProvenance;
  columns: ApprovedColumn[];
  created_at: string;
}
export type SnapshotCell = string | number | boolean | null;
export type SnapshotRow = Record<string, SnapshotCell>;
export interface CreateSnapshotInput { sourceId: string; format: "csv" | "json"; content: string; asOf: string }
export interface SnapshotMetadata {
  id: string;
  source_id: string;
  version: number;
  previous_snapshot_id: string | null;
  imported_at: string;
  as_of: string;
  classification: "non_sensitive_aggregate";
  format: "csv" | "json";
  row_count: number;
  content_sha256: string;
  columns: ApprovedColumn[];
  provenance: SourceProvenance;
}
export interface SnapshotPage {
  snapshot: SnapshotMetadata;
  rows: SnapshotRow[];
  offset: number;
  limit: number;
  next_offset: number | null;
}

const dimensionNames = new Set([
  "year", "quarter", "month", "period", "department", "division", "unit", "region", "country",
  "category", "topic", "program", "service", "sector", "organization", "organisation", "institution",
  "discipline", "source", "type", "status", "publication_year", "fiscal_year",
]);
const metricName = /^(?:count|total|rate|percent|percentage|average|median|sum|[a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:count|total|rate|percent|percentage|average|median|sum))$/;
// Reject identifiers and sensitive categories, including snake/camel/case variants, before role approval.
const sensitiveName = /(?:person|personal|employee|staff|worker|patient|student|user|account|author|first.?name|last.?name|full.?name|email|e.?mail|phone|mobile|address|street|zip|postal|birth|dob|ssn|social.?security|passport|national.?id|identifier|(^|_)id($|_)|ip.?address|gender|sex|race|ethnic|religion|salary|wage|health|medical|diagnos|disabil|secret|token)/i;
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phone = /(?:\+?\d[\s().-]*){10,}/;
const formula = /^[\s﻿]*[=+@\-\t\r]/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function safeText(value: unknown, label: string, max: number = SNAPSHOT_LIMITS.maxCellLength): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || email.test(value) || phone.test(value) || formula.test(value)) {
    throw new Error(`${label} must be non-sensitive plain text (1-${max} characters)`);
  }
  return value.trim();
}
function validateColumns(input: unknown): ApprovedColumn[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > SNAPSHOT_LIMITS.maxColumns) throw new Error("Invalid approved column count");
  const seen = new Set<string>();
  const columns = input.map((item, index) => {
    const column = object(item, `Column ${index}`);
    const { name, type, role } = column;
    if (typeof name !== "string" || !/^[a-z][a-z0-9_]{0,47}$/.test(name) || sensitiveName.test(name) || seen.has(name)) {
      throw new Error(`Column ${index} has a duplicate, sensitive, or invalid name`);
    }
    seen.add(name);
    if (role === "dimension" && (!dimensionNames.has(name) || !["string", "number", "boolean", "date"].includes(String(type)))) {
      throw new Error(`Dimension ${name} is not server-approved`);
    }
    if (role === "metric" && (type !== "number" || !metricName.test(name))) throw new Error(`Metric ${name} is not server-approved`);
    if (role === "group_size" && (name !== "group_size" || type !== "number")) throw new Error("Invalid group_size column");
    if (role !== "dimension" && role !== "metric" && role !== "group_size") throw new Error("Invalid column role");
    if (name === "group_size" && role !== "group_size") throw new Error("group_size must have its designated role");
    return { name, type, role } as ApprovedColumn;
  });
  if (!columns.some((c) => c.role === "dimension") || !columns.some((c) => c.role === "metric")) throw new Error("At least one dimension and one metric are required");
  return columns;
}
function isoDate(input: unknown, label: string): string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
      Number.isNaN(Date.parse(`${input}T00:00:00Z`)) ||
      new Date(`${input}T00:00:00Z`).toISOString().slice(0, 10) !== input) {
    throw new Error(`${label} must be an ISO calendar date (YYYY-MM-DD)`);
  }
  return input;
}
function validateProvenance(input: unknown): SourceProvenance {
  const value = object(input, "Provenance");
  return {
    publisher: safeText(value.publisher, "Provenance publisher", 120),
    dataset: safeText(value.dataset, "Provenance dataset", 120),
    reference: safeText(value.reference, "Provenance reference", 256),
  };
}

/** Create a source and fix its approved columns, classification, and provenance permanently. */
export function createSource(input: CreateSourceInput): SnapshotSource {
  const value = object(input, "Source");
  if (value.kind !== "internal_aggregate" && value.kind !== "external_reference") throw new Error("Unsupported source kind");
  if (value.aggregateOnly !== true) throw new Error("Aggregate-only attestation is required");
  const columns = validateColumns(value.columns);
  if (value.kind === "internal_aggregate" && columns.filter((c) => c.role === "group_size").length !== 1) {
    throw new Error("Internal aggregates require one group_size column");
  }
  const source: SnapshotSource = {
    id: randomUUID(), name: safeText(value.name, "Source name", 120),
    owner: safeText(value.owner, "Source owner", 120),
    description: safeText(value.description, "Source description", 500),
    ...(value.license === undefined ? {} : { license: safeText(value.license, "Source license", 120) }),
    kind: value.kind,
    classification: "non_sensitive_aggregate", provenance: validateProvenance(value.provenance),
    columns, created_at: new Date().toISOString(),
  };
  getDb().prepare("INSERT INTO powerbi_sources (id, kind, data) VALUES (?, ?, ?)").run(source.id, source.kind, JSON.stringify(source));
  return source;
}

/** Sources are ordered by creation time, then ID for deterministic ties. */
export function listSources(): SnapshotSource[] {
  return (getDb().prepare("SELECT data FROM powerbi_sources ORDER BY json_extract(data, '$.created_at'), id").all() as Array<{ data: string }>)
    .map((row) => JSON.parse(row.data) as SnapshotSource);
}

function parseCsv(content: string): Array<Record<string, unknown>> {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const text = content.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else if (char === '"' || (closed && char !== ',' && char !== '\r' && char !== '\n')) throw new Error("Malformed CSV quoting");
    else if (char === ',') { fields.push(field); field = ""; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      fields.push(field); records.push(fields);
      if (records.length > SNAPSHOT_LIMITS.maxRows + 1) throw new Error("Too many snapshot rows");
      fields = []; field = ""; closed = false;
    } else field += char;
    if (field.length > SNAPSHOT_LIMITS.maxCellLength) throw new Error("CSV cell too long");
  }
  if (quoted) throw new Error("Unterminated CSV field");
  if (field !== "" || fields.length || closed) { fields.push(field); records.push(fields); }
  const [headers, ...values] = records;
  if (!headers || !values.length || headers.some((h) => !h || h.trim() !== h) || new Set(headers).size !== headers.length) throw new Error("CSV requires unique headers and rows");
  return values.map((record) => {
    if (record.length !== headers.length) throw new Error("CSV row width differs from header");
    return Object.fromEntries(headers.map((header, i) => [header, record[i]]));
  });
}

function parseRows(input: CreateSnapshotInput, columns: ApprovedColumn[], kind: SourceKind): SnapshotRow[] {
  if (input.format !== "csv" && input.format !== "json") throw new Error("Only CSV and JSON are supported");
  if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > SNAPSHOT_LIMITS.maxBytes || !input.content.trim()) {
    throw new Error("Snapshot content must be nonempty and at most 1 MiB");
  }
  const raw: unknown = input.format === "csv" ? parseCsv(input.content) : JSON.parse(input.content);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > SNAPSHOT_LIMITS.maxRows) throw new Error("Invalid snapshot row count");
  const names = columns.map((c) => c.name);
  return raw.map((item, index) => {
    const record = object(item, `Row ${index}`);
    const keys = Object.keys(record);
    if (keys.length !== names.length || keys.some((key) => !names.includes(key))) throw new Error(`Row ${index} must match the approved columns exactly`);
    const row: SnapshotRow = {};
    for (const column of columns) {
      const cell = record[column.name];
      const label = `Row ${index}, ${column.name}`;
      if (cell === null || (input.format === "csv" && cell === "" && column.role === "metric")) {
        if (column.role !== "metric") throw new Error(`${label} cannot be null`);
        row[column.name] = null;
      } else if (column.type === "number") {
        const number = input.format === "csv" && typeof cell === "string" && cell.trim() !== "" ? Number(cell) : cell;
        if (typeof number !== "number" || !Number.isFinite(number) || (column.role === "group_size" && (!Number.isSafeInteger(number) || number < (kind === "internal_aggregate" ? SNAPSHOT_LIMITS.minInternalGroupSize : 1)))) {
          throw new Error(`${label} must be a finite number and group sizes must meet the privacy minimum`);
        }
        row[column.name] = number;
      } else if (column.type === "boolean") {
        if (cell !== true && cell !== false && !(input.format === "csv" && (cell === "true" || cell === "false"))) throw new Error(`${label} must be a boolean`);
        row[column.name] = cell === true || cell === "true";
      } else if (column.type === "date") {
        row[column.name] = isoDate(cell, label);
      } else {
        row[column.name] = safeText(cell, label);
      }
    }
    return row;
  });
}

/** Atomically append a numbered snapshot; re-importing identical data still creates a new refresh version. */
export function createSnapshot(input: CreateSnapshotInput): SnapshotMetadata {
  const value = object(input, "Snapshot");
  if (typeof value.sourceId !== "string" || !value.sourceId) throw new Error("sourceId is required");
  const asOf = isoDate(value.asOf, "asOf");
  const db = getDb();
  const sourceRow = db.prepare("SELECT data FROM powerbi_sources WHERE id = ?").get(value.sourceId) as { data: string } | undefined;
  if (!sourceRow) throw new Error("Source not found");
  const source = JSON.parse(sourceRow.data) as SnapshotSource;
  const rows = parseRows(input, source.columns, source.kind);
  const content_sha256 = createHash("sha256").update(JSON.stringify({ columns: source.columns, rows })).digest("hex");
  return runTransaction(db, () => {
    const previous = db.prepare("SELECT id, version FROM powerbi_snapshots WHERE source_id = ? ORDER BY version DESC LIMIT 1")
      .get(source.id) as { id: string; version: number } | undefined;
    const snapshot: SnapshotMetadata = {
      id: randomUUID(), source_id: source.id, version: (previous?.version ?? 0) + 1,
      previous_snapshot_id: previous?.id ?? null, imported_at: new Date().toISOString(), as_of: asOf,
      classification: source.classification, format: input.format, row_count: rows.length,
      content_sha256, columns: source.columns, provenance: source.provenance,
    };
    db.prepare("INSERT INTO powerbi_snapshots (id, source_id, version, data) VALUES (?, ?, ?, ?)")
      .run(snapshot.id, snapshot.source_id, snapshot.version, JSON.stringify(snapshot));
    const insertRow = db.prepare("INSERT INTO powerbi_snapshot_rows (snapshot_id, row_index, data) VALUES (?, ?, ?)");
    rows.forEach((row, index) => insertRow.run(snapshot.id, index, JSON.stringify(row)));
    return snapshot;
  });
}

/** List all snapshots or only snapshots of one source, newest version first. */
export function listSnapshots(sourceId?: string): SnapshotMetadata[] {
  if (sourceId !== undefined && (typeof sourceId !== "string" || !sourceId)) throw new Error("Invalid sourceId");
  const query = sourceId === undefined
    ? "SELECT data FROM powerbi_snapshots ORDER BY json_extract(data, '$.imported_at') DESC, id DESC"
    : "SELECT data FROM powerbi_snapshots WHERE source_id = ? ORDER BY version DESC";
  const rows = (sourceId === undefined ? getDb().prepare(query).all() : getDb().prepare(query).all(sourceId)) as Array<{ data: string }>;
  return rows.map((row) => JSON.parse(row.data) as SnapshotMetadata);
}

/** Return snapshot metadata without materializing its rows. */
export function getSnapshot(snapshotId: string): SnapshotMetadata | null {
  if (typeof snapshotId !== "string" || !snapshotId) throw new Error("Invalid snapshotId");
  const row = getDb().prepare("SELECT data FROM powerbi_snapshots WHERE id = ?").get(snapshotId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as SnapshotMetadata : null;
}

/** Zero-based stable row-index pagination; missing snapshots return null. */
export function getSnapshotRows(snapshotId: string, options: { offset?: number; limit?: number } = {}): SnapshotPage | null {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? SNAPSHOT_LIMITS.maxPageSize;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > SNAPSHOT_LIMITS.maxPageSize) {
    throw new Error("Invalid snapshot pagination");
  }
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot) return null;
  const rows = getDb().prepare("SELECT data FROM powerbi_snapshot_rows WHERE snapshot_id = ? AND row_index >= ? ORDER BY row_index LIMIT ?")
    .all(snapshotId, offset, limit) as Array<{ data: string }>;
  return { snapshot, rows: rows.map((row) => JSON.parse(row.data) as SnapshotRow), offset, limit,
    next_offset: offset + rows.length < snapshot.row_count ? offset + rows.length : null };
}
