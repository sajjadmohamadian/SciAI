import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  Project,
  Dataset,
  DatasetVersion,
  Analysis,
  BibliometricDocument,
  SmartMergeSummary,
} from "../src/types.js";

let dbInstance: DatabaseSync | null = null;

const DEFAULT_DB_PATH = process.env.SCIAI_DB_PATH || path.join(process.cwd(), "data", "sciai.db");

/**
 * Current schema version for SciAI SQLite persistence layer.
 * Stored in _schema_meta table to track future migrations without data loss.
 */
export const SCHEMA_VERSION = "1.0.0";

/**
 * Explicit transaction executor for Node's DatabaseSync.
 * Uses BEGIN IMMEDIATE / COMMIT / ROLLBACK with complete error logging and rollback safety.
 *
 * Concurrency Note:
 * SQLite in WAL mode allows multiple concurrent readers, but only ONE writer at a time.
 * Using BEGIN IMMEDIATE acquires the write lock at the start of the transaction,
 * avoiding deadlocks or busy errors mid-transaction.
 */
export function runTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (err: unknown) {
    try {
      db.exec("ROLLBACK;");
    } catch (rbErr: unknown) {
      console.error("[SQLite Critical] ROLLBACK failed during transaction abort:", rbErr);
    }
    throw err;
  }
}

/**
 * Initializes and configures the SQLite database file and tables.
 * Schema creation is fully idempotent and creates a minimal _schema_meta version marker
 * and secondary indexes on relational keys to support high-performance lookups & cascade deletions.
 */
export function initDb(dbFilePath: string = DEFAULT_DB_PATH): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbFilePath);

  // Enable WAL mode for better concurrency and reliability
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");

  // Create tables for entity storage as JSON blobs keyed by id
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dataset_versions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS version_documents (
      version_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merge_summary (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);

  // Ensure schema version marker is saved
  db.prepare(`
    INSERT OR IGNORE INTO _schema_meta (key, value) VALUES ('schema_version', ?)
  `).run(SCHEMA_VERSION);

  // Indexes to support fast dataset, version, analysis, and project lookups & cascades:
  // 1. idx_datasets_project_id: indexes datasets by project_id
  // 2. idx_versions_dataset_id: indexes dataset_versions by dataset_id (critical for cascades & version lookups)
  // 3. idx_analyses_project_id: indexes analyses by project_id
  // 4. idx_analyses_version_id: indexes analyses by dataset_version_id (critical for cleaning analyses on dataset/version deletion)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(json_extract(data, '$.project_id'));
    CREATE INDEX IF NOT EXISTS idx_versions_dataset_id ON dataset_versions(json_extract(data, '$.dataset_id'));
    CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON analyses(json_extract(data, '$.project_id'));
    CREATE INDEX IF NOT EXISTS idx_analyses_version_id ON analyses(json_extract(data, '$.dataset_version_id'));
  `);

  dbInstance = db;
  return dbInstance;
}

/**
 * Closes the active database connection and resets the singleton instance.
 * Enables test suites to isolate temporary database files safely.
 */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      console.warn("[SQLite] Error closing database instance:", err);
    }
    dbInstance = null;
  }
}

/**
 * Returns active db instance, initializing it if needed.
 */
export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

/**
 * Checks if the database contains any persistent data (datasets, projects, or analyses).
 */
export function hasAnyData(db: DatabaseSync = getDb()): boolean {
  try {
    const dsRow = db.prepare("SELECT COUNT(*) as count FROM datasets").get() as { count: number | bigint } | undefined;
    if (dsRow && Number(dsRow.count) > 0) return true;

    const verRow = db.prepare("SELECT COUNT(*) as count FROM dataset_versions").get() as { count: number | bigint } | undefined;
    if (verRow && Number(verRow.count) > 0) return true;

    const projRow = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number | bigint } | undefined;
    if (projRow && Number(projRow.count) > 0) return true;

    const anaRow = db.prepare("SELECT COUNT(*) as count FROM analyses").get() as { count: number | bigint } | undefined;
    if (anaRow && Number(anaRow.count) > 0) return true;

    return false;
  } catch (err) {
    console.error("Error checking database content:", err);
    throw new Error(`Failed to inspect SQLite database tables: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ==================== PROJECTS ====================

export function getProjectById(id: string): Project | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM projects WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as Project;
  } catch (err) {
    console.warn(`[SQLite Error] Failed to read project '${id}':`, err);
    return null;
  }
}

export function upsertProject(project: Project): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO projects (id, data) VALUES (?, ?)");
  stmt.run(project.id, JSON.stringify(project));
}

export function deleteProjectRow(id: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  stmt.run(id);
}

/**
 * Defensively loads all projects. Malformed rows are quarantined and skipped with clear warnings.
 */
export function loadAllProjects(): Project[] {
  const db = getDb();
  let rows: Array<{ id: string; data: string }>;
  try {
    const stmt = db.prepare("SELECT id, data FROM projects");
    rows = stmt.all() as Array<{ id: string; data: string }>;
  } catch (queryErr) {
    console.error("[SQLite Error] Failed to read projects table:", queryErr);
    throw new Error(`Failed to read 'projects' table: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`);
  }

  const validProjects: Project[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.data) as Project;
      if (!parsed || typeof parsed !== "object" || !parsed.id) {
        console.warn(`[SQLite Quarantine] Invalid project entity schema in row '${r.id}', skipping.`);
        continue;
      }
      validProjects.push(parsed);
    } catch (parseErr) {
      console.warn(`[SQLite Quarantine] Malformed JSON in 'projects' table for id '${r.id}'. Skipping record without fabricating data.`, parseErr);
    }
  }
  return validProjects;
}

// ==================== DATASETS ====================

export function getDatasetById(id: string): Dataset | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM datasets WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as Dataset;
  } catch (err) {
    console.warn(`[SQLite Error] Failed to read dataset '${id}':`, err);
    return null;
  }
}

export function upsertDataset(dataset: Dataset): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO datasets (id, data) VALUES (?, ?)");
  stmt.run(dataset.id, JSON.stringify(dataset));
}

export function deleteDatasetRow(id: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM datasets WHERE id = ?");
  stmt.run(id);
}

/**
 * Defensively loads all datasets. Malformed rows are quarantined and skipped with clear warnings.
 */
export function loadAllDatasets(): Dataset[] {
  const db = getDb();
  let rows: Array<{ id: string; data: string }>;
  try {
    const stmt = db.prepare("SELECT id, data FROM datasets");
    rows = stmt.all() as Array<{ id: string; data: string }>;
  } catch (queryErr) {
    console.error("[SQLite Error] Failed to read datasets table:", queryErr);
    throw new Error(`Failed to read 'datasets' table: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`);
  }

  const validDatasets: Dataset[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.data) as Dataset;
      if (!parsed || typeof parsed !== "object" || !parsed.id) {
        console.warn(`[SQLite Quarantine] Invalid dataset entity schema in row '${r.id}', skipping.`);
        continue;
      }
      validDatasets.push(parsed);
    } catch (parseErr) {
      console.warn(`[SQLite Quarantine] Malformed JSON in 'datasets' table for id '${r.id}'. Skipping record without fabricating data.`, parseErr);
    }
  }
  return validDatasets;
}

// ==================== DATASET VERSIONS ====================

export function getDatasetVersionById(id: string): DatasetVersion | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM dataset_versions WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as DatasetVersion;
  } catch (err) {
    console.warn(`[SQLite Error] Failed to read dataset version '${id}':`, err);
    return null;
  }
}

export function upsertDatasetVersion(version: DatasetVersion): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO dataset_versions (id, data) VALUES (?, ?)");
  stmt.run(version.id, JSON.stringify(version));
}

export function deleteDatasetVersionRow(id: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM dataset_versions WHERE id = ?");
  stmt.run(id);
}

/**
 * Defensively loads all dataset versions.
 */
export function loadAllDatasetVersions(): DatasetVersion[] {
  const db = getDb();
  let rows: Array<{ id: string; data: string }>;
  try {
    const stmt = db.prepare("SELECT id, data FROM dataset_versions");
    rows = stmt.all() as Array<{ id: string; data: string }>;
  } catch (queryErr) {
    console.error("[SQLite Error] Failed to read dataset_versions table:", queryErr);
    throw new Error(`Failed to read 'dataset_versions' table: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`);
  }

  const validVersions: DatasetVersion[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.data) as DatasetVersion;
      if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.dataset_id) {
        console.warn(`[SQLite Quarantine] Invalid version entity schema in row '${r.id}', skipping.`);
        continue;
      }
      validVersions.push(parsed);
    } catch (parseErr) {
      console.warn(`[SQLite Quarantine] Malformed JSON in 'dataset_versions' table for id '${r.id}'. Skipping record without fabricating data.`, parseErr);
    }
  }
  return validVersions;
}

// ==================== VERSION DOCUMENTS ====================

export function getVersionDocumentsById(versionId: string): BibliometricDocument[] | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM version_documents WHERE version_id = ?").get(versionId) as { data: string } | undefined;
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    return Array.isArray(parsed) ? (parsed as BibliometricDocument[]) : null;
  } catch (err) {
    console.warn(`[SQLite Error] Failed to read version documents for '${versionId}':`, err);
    return null;
  }
}

export function upsertVersionDocuments(versionId: string, docs: BibliometricDocument[]): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO version_documents (version_id, data) VALUES (?, ?)");
  stmt.run(versionId, JSON.stringify(docs));
}

export function deleteVersionDocumentsRow(versionId: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM version_documents WHERE version_id = ?");
  stmt.run(versionId);
}

/**
 * Defensively loads all version documents.
 */
export function loadAllVersionDocuments(): Map<string, BibliometricDocument[]> {
  const db = getDb();
  let rows: Array<{ version_id: string; data: string }>;
  try {
    const stmt = db.prepare("SELECT version_id, data FROM version_documents");
    rows = stmt.all() as Array<{ version_id: string; data: string }>;
  } catch (queryErr) {
    console.error("[SQLite Error] Failed to read version_documents table:", queryErr);
    throw new Error(`Failed to read 'version_documents' table: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`);
  }

  const map = new Map<string, BibliometricDocument[]>();
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.data);
      if (!Array.isArray(parsed)) {
        console.warn(`[SQLite Quarantine] version_documents for version_id '${r.version_id}' is not an array, skipping.`);
        continue;
      }
      map.set(r.version_id, parsed as BibliometricDocument[]);
    } catch (parseErr) {
      console.warn(`[SQLite Quarantine] Malformed JSON in 'version_documents' table for version_id '${r.version_id}'. Skipping record without fabricating data.`, parseErr);
    }
  }
  return map;
}

// ==================== ANALYSES ====================

export function getAnalysisById(id: string): Analysis | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM analyses WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as Analysis;
  } catch (err) {
    console.warn(`[SQLite Error] Failed to read analysis '${id}':`, err);
    return null;
  }
}

export function upsertAnalysis(analysis: Analysis): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO analyses (id, data) VALUES (?, ?)");
  stmt.run(analysis.id, JSON.stringify(analysis));
}

export function deleteAnalysisRow(id: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM analyses WHERE id = ?");
  stmt.run(id);
}

/**
 * Defensively loads all analyses.
 */
export function loadAllAnalyses(): Analysis[] {
  const db = getDb();
  let rows: Array<{ id: string; data: string }>;
  try {
    const stmt = db.prepare("SELECT id, data FROM analyses");
    rows = stmt.all() as Array<{ id: string; data: string }>;
  } catch (queryErr) {
    console.error("[SQLite Error] Failed to read analyses table:", queryErr);
    throw new Error(`Failed to read 'analyses' table: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`);
  }

  const validAnalyses: Analysis[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.data) as Analysis;
      if (!parsed || typeof parsed !== "object" || !parsed.id) {
        console.warn(`[SQLite Quarantine] Invalid analysis entity schema in row '${r.id}', skipping.`);
        continue;
      }
      validAnalyses.push(parsed);
    } catch (parseErr) {
      console.warn(`[SQLite Quarantine] Malformed JSON in 'analyses' table for id '${r.id}'. Skipping record without fabricating data.`, parseErr);
    }
  }
  return validAnalyses;
}

// ==================== MERGE SUMMARY ====================

export function upsertMergeSummary(summary: SmartMergeSummary | null): void {
  const db = getDb();
  if (!summary) {
    db.prepare("DELETE FROM merge_summary WHERE id = ?").run("latest");
    return;
  }
  const stmt = db.prepare("INSERT OR REPLACE INTO merge_summary (id, data) VALUES (?, ?)");
  stmt.run("latest", JSON.stringify(summary));
}

export function loadLatestMergeSummary(): SmartMergeSummary | null {
  const db = getDb();
  try {
    const stmt = db.prepare("SELECT data FROM merge_summary WHERE id = ?");
    const row = stmt.get("latest") as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as SmartMergeSummary;
  } catch (err) {
    console.warn("[SQLite Quarantine] Malformed JSON or read error in 'merge_summary' table. Returning null.", err);
    return null;
  }
}

// ==================== COMPOUND ATOMIC TRANSACTION OPERATIONS ====================

export interface IngestionBatchItem {
  dataset: Dataset;
  version: DatasetVersion;
  documents: BibliometricDocument[];
}

/**
 * Persists an ingestion batch (one or more datasets, versions, and documents) atomically.
 * Optionally includes an initial/derived analysis and/or merge summary + merged dataset within the SAME transaction.
 */
export function persistIngestionTransaction(params: {
  items: IngestionBatchItem[];
  additionalAnalyses?: Analysis[];
  mergeSummary?: SmartMergeSummary | null;
  mergedDatasetItem?: IngestionBatchItem | null;
}): void {
  const db = getDb();
  runTransaction(db, () => {
    const insertDsStmt = db.prepare("INSERT OR REPLACE INTO datasets (id, data) VALUES (?, ?)");
    const insertVerStmt = db.prepare("INSERT OR REPLACE INTO dataset_versions (id, data) VALUES (?, ?)");
    const insertDocStmt = db.prepare("INSERT OR REPLACE INTO version_documents (version_id, data) VALUES (?, ?)");
    const insertAnaStmt = db.prepare("INSERT OR REPLACE INTO analyses (id, data) VALUES (?, ?)");

    for (const item of params.items) {
      insertDsStmt.run(item.dataset.id, JSON.stringify(item.dataset));
      insertVerStmt.run(item.version.id, JSON.stringify(item.version));
      insertDocStmt.run(item.version.id, JSON.stringify(item.documents));
    }

    if (params.mergedDatasetItem) {
      insertDsStmt.run(params.mergedDatasetItem.dataset.id, JSON.stringify(params.mergedDatasetItem.dataset));
      insertVerStmt.run(params.mergedDatasetItem.version.id, JSON.stringify(params.mergedDatasetItem.version));
      insertDocStmt.run(params.mergedDatasetItem.version.id, JSON.stringify(params.mergedDatasetItem.documents));
    }

    if (params.mergeSummary) {
      const summaryStmt = db.prepare("INSERT OR REPLACE INTO merge_summary (id, data) VALUES (?, ?)");
      summaryStmt.run("latest", JSON.stringify(params.mergeSummary));
    }

    if (params.additionalAnalyses && params.additionalAnalyses.length > 0) {
      for (const a of params.additionalAnalyses) {
        insertAnaStmt.run(a.id, JSON.stringify(a));
      }
    }
  });
}

/**
 * Persists a Smart Merge operation atomically:
 * Merged dataset, merged version, merged documents, and the merge summary blob.
 */
export function persistMergeTransaction(params: {
  summary: SmartMergeSummary;
  mergedDataset: Dataset;
  mergedVersion: DatasetVersion;
  mergedDocs: BibliometricDocument[];
}): void {
  const db = getDb();
  runTransaction(db, () => {
    db.prepare("INSERT OR REPLACE INTO datasets (id, data) VALUES (?, ?)").run(
      params.mergedDataset.id,
      JSON.stringify(params.mergedDataset)
    );
    db.prepare("INSERT OR REPLACE INTO dataset_versions (id, data) VALUES (?, ?)").run(
      params.mergedVersion.id,
      JSON.stringify(params.mergedVersion)
    );
    db.prepare("INSERT OR REPLACE INTO version_documents (version_id, data) VALUES (?, ?)").run(
      params.mergedVersion.id,
      JSON.stringify(params.mergedDocs)
    );
    db.prepare("INSERT OR REPLACE INTO merge_summary (id, data) VALUES (?, ?)").run(
      "latest",
      JSON.stringify(params.summary)
    );
  });
}

/**
 * Persists an analysis creation or update atomically.
 */
export function persistAnalysisTransaction(analysis: Analysis): void {
  const db = getDb();
  runTransaction(db, () => {
    db.prepare("INSERT OR REPLACE INTO analyses (id, data) VALUES (?, ?)").run(
      analysis.id,
      JSON.stringify(analysis)
    );
  });
}

/**
 * Performs a complete cascade deletion of a dataset and all dependent versions,
 * version documents, and associated analyses within ONE atomic transaction.
 *
 * Prevents orphaned records completely in SQLite:
 * 1. Finds all dataset versions for this dataset.
 * 2. Deletes version_documents for each version.
 * 3. Deletes analyses referencing any of those version IDs.
 * 4. Deletes dataset_versions rows for this dataset.
 * 5. Deletes the datasets row.
 *
 * Returns deleted version IDs and analysis IDs for memory cache synchronization.
 */
type DatasetDeletionResult = {
  deletedDatasetId: string;
  deletedVersionIds: string[];
  deletedAnalysisIds: string[];
};

function deleteDatasetCascade(db: DatabaseSync, datasetId: string): DatasetDeletionResult {
  const versionRows = db
    .prepare("SELECT id FROM dataset_versions WHERE json_extract(data, '$.dataset_id') = ?")
    .all(datasetId) as Array<{ id: string }>;
  const versionIds = versionRows.map((r) => r.id);
  const deletedAnalysisIds: string[] = [];

  for (const vId of versionIds) {
    const anaRows = db
      .prepare("SELECT id FROM analyses WHERE json_extract(data, '$.dataset_version_id') = ?")
      .all(vId) as Array<{ id: string }>;
    deletedAnalysisIds.push(...anaRows.map((row) => row.id));
    db.prepare("DELETE FROM version_documents WHERE version_id = ?").run(vId);
  }

  for (const aId of deletedAnalysisIds) {
    db.prepare("DELETE FROM analyses WHERE id = ?").run(aId);
  }
  db.prepare("DELETE FROM dataset_versions WHERE json_extract(data, '$.dataset_id') = ?").run(datasetId);
  db.prepare("DELETE FROM datasets WHERE id = ?").run(datasetId);

  return { deletedDatasetId: datasetId, deletedVersionIds: versionIds, deletedAnalysisIds };
}

export function deleteDatasetsCascadeTransaction(datasetIds: string[]): DatasetDeletionResult[] {
  const db = getDb();
  return runTransaction(db, () => {
    if (datasetIds.length === 0 || new Set(datasetIds).size !== datasetIds.length ||
        datasetIds.some((id) => !id || !db.prepare("SELECT 1 FROM datasets WHERE id = ?").get(id))) {
      throw new Error("All dataset IDs must be distinct and exist before deletion");
    }
    return datasetIds.map((id) => deleteDatasetCascade(db, id));
  });
}

export function deleteDatasetCascadeTransaction(datasetId: string): DatasetDeletionResult {
  return deleteDatasetsCascadeTransaction([datasetId])[0];
}

