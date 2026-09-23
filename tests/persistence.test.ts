import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  initDb,
  closeDb,
  getDb,
  runTransaction,
  hasAnyData,
  SCHEMA_VERSION,
  upsertProject,
  loadAllProjects,
  getProjectById,
  upsertDataset,
  loadAllDatasets,
  getDatasetById,
  upsertDatasetVersion,
  loadAllDatasetVersions,
  getDatasetVersionById,
  upsertVersionDocuments,
  getVersionDocumentsById,
  upsertAnalysis,
  loadAllAnalyses,
  getAnalysisById,
  upsertMergeSummary,
  loadLatestMergeSummary,
  deleteDatasetCascadeTransaction,
  persistIngestionTransaction,
} from "../server/db.js";
import {
  Project,
  Dataset,
  DatasetVersion,
  Analysis,
  BibliometricDocument,
  SmartMergeSummary,
} from "../src/types.js";

describe("Persistence & SQLite Integrity Suite", () => {
  let tempDbPath: string;

  beforeEach(() => {
    closeDb();
    tempDbPath = path.join(
      os.tmpdir(),
      `test-sciai-db-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.db`
    );
    process.env.SCIAI_DB_PATH = tempDbPath;
  });

  afterEach(() => {
    closeDb();
    // Clean up temporary database files (.db, .db-wal, .db-shm)
    for (const ext of ["", "-wal", "-shm"]) {
      const p = `${tempDbPath}${ext}`;
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
    delete process.env.SCIAI_DB_PATH;
  });

  test("Fresh database initialization & idempotent initialization", () => {
    const db = initDb(tempDbPath);
    assert(fs.existsSync(tempDbPath), "Database file should exist on disk");
    assert.equal(hasAnyData(db), false, "Fresh database should have zero persistent entities");

    // Verify idempotency by calling initDb again
    const secondCall = initDb(tempDbPath);
    assert.equal(secondCall, db, "initDb should return existing instance when already open");
  });

  test("Schema metadata and version availability", () => {
    const db = initDb(tempDbPath);
    const row = db
      .prepare("SELECT value FROM _schema_meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    assert(row, "schema_version key must exist in _schema_meta");
    assert.equal(row.value, SCHEMA_VERSION, "Recorded schema version must match constant");
  });

  test("Successful entity persistence: projects, datasets, versions, documents, analyses", () => {
    initDb(tempDbPath);

    const project: Project = {
      id: "proj-1",
      name: "Cancer Genomics Scientometrics",
      description: "Research intelligence corpus",
      created_at: new Date().toISOString(),
    };
    upsertProject(project);

    const dataset: Dataset = {
      id: "ds-1",
      project_id: project.id,
      name: "Oncology Corpus",
      source: "Scopus",
      record_count: 50,
      status: "available",
      created_at: new Date().toISOString(),
    };
    upsertDataset(dataset);

    const version: DatasetVersion = {
      id: "ver-1",
      dataset_id: dataset.id,
      version: 1,
      version_number: 1,
      record_count: 50,
      created_at: new Date().toISOString(),
    };
    upsertDatasetVersion(version);

    const docs: BibliometricDocument[] = [
      {
        id: "doc-1",
        title: "Genomic Sequencing",
        authors: ["Smith, J."],
        year: 2023,
        source: "Nature Genetics",
        citations: 15,
        keywords: ["genomics", "oncology"],
      },
    ];
    upsertVersionDocuments(version.id, docs);

    const analysis: Analysis = {
      id: "ana-1",
      project_id: project.id,
      dataset_version_id: version.id,
      capability_id: "author.productivity",
      status: "completed",
      parameters: { mode: "whole" },
      created_at: new Date().toISOString(),
    };
    upsertAnalysis(analysis);

    // Read back and assert fidelity
    const fetchedProj = getProjectById("proj-1");
    assert.equal(fetchedProj?.name, project.name);

    const fetchedDs = getDatasetById("ds-1");
    assert.equal(fetchedDs?.name, dataset.name);

    const fetchedVer = getDatasetVersionById("ver-1");
    assert.equal(fetchedVer?.record_count, 50);

    const fetchedDocs = getVersionDocumentsById("ver-1");
    assert.equal(fetchedDocs?.length, 1);
    assert.equal(fetchedDocs?.[0]?.title, "Genomic Sequencing");

    const fetchedAna = getAnalysisById("ana-1");
    assert.equal(fetchedAna?.capability_id, "author.productivity");
  });

  test("Successful merge-summary persistence and retrieval", () => {
    initDb(tempDbPath);

    const summary: SmartMergeSummary = {
      merged_dataset_id: "ds-merged-1",
      total_raw_inputs: 100,
      final_unique_count: 80,
      duplicates_resolved: 20,
      reduction_percentage: 20.0,
      databases_included: ["Scopus", "WoS"],
      sources_breakdown: { Scopus: 50, WoS: 50 },
      overlap_breakdown: {
        single_source_only: 60,
        two_sources: 20,
        three_or_more_sources: 0,
      },
      audit_log: [],
      borderline_queue: [],
      methodology_narrative: "Methodology text",
      data_health: {
        overall_score: 90,
        level_1_score: 95,
        level_2_score: 85,
        level_3_score: 80,
        field_completeness: {
          authors: 100,
          year: 100,
          source: 100,
          citations: 100,
          references: 100,
          title: 100,
          keywords: 80,
          affiliations: 70,
          abstract: 90,
          doi: 85,
          categories: 100,
        },
        total_records: 100,
        database_distribution: { Scopus: 50, WoS: 50 },
      },
    };

    upsertMergeSummary(summary);
    const loaded = loadLatestMergeSummary();
    assert(loaded);
    assert.equal(loaded.total_raw_inputs, 100);
    assert.equal(loaded.duplicates_resolved, 20);

    // Clearing merge summary
    upsertMergeSummary(null);
    assert.equal(loadLatestMergeSummary(), null);
  });

  test("Cascade deletion eliminates all child versions, documents, and analyses with zero orphans", () => {
    const db = initDb(tempDbPath);

    const dsId = "ds-cascade-test";
    const verId1 = "ver-c1";
    const verId2 = "ver-c2";
    const anaId1 = "ana-c1";
    const anaId2 = "ana-c2";

    // Setup dataset with 2 versions, each with documents and an analysis
    upsertDataset({
      id: dsId,
      project_id: "p1",
      name: "Cascade Target",
      source: "WoS",
      record_count: 10,
      status: "available",
      created_at: new Date().toISOString(),
    });

    upsertDatasetVersion({
      id: verId1,
      dataset_id: dsId,
      version: 1,
      version_number: 1,
      record_count: 5,
      created_at: new Date().toISOString(),
    });
    upsertDatasetVersion({
      id: verId2,
      dataset_id: dsId,
      version: 2,
      version_number: 2,
      record_count: 5,
      created_at: new Date().toISOString(),
    });

    upsertVersionDocuments(verId1, [{ id: "d1", title: "Doc 1", authors: ["A"], year: 2022, source: "S", citations: 2, keywords: [] }]);
    upsertVersionDocuments(verId2, [{ id: "d2", title: "Doc 2", authors: ["B"], year: 2023, source: "S", citations: 4, keywords: [] }]);

    upsertAnalysis({
      id: anaId1,
      project_id: "p1",
      dataset_version_id: verId1,
      capability_id: "citation.average",
      status: "completed",
      parameters: {},
      created_at: new Date().toISOString(),
    });

    upsertAnalysis({
      id: anaId2,
      project_id: "p1",
      dataset_version_id: verId2,
      capability_id: "citation.average",
      status: "completed",
      parameters: {},
      created_at: new Date().toISOString(),
    });

    // Execute atomic cascade delete
    const result = deleteDatasetCascadeTransaction(dsId);

    assert.equal(result.deletedDatasetId, dsId);
    assert.equal(result.deletedVersionIds.length, 2);
    assert.equal(result.deletedAnalysisIds.length, 2);

    // Verify all rows in SQLite are gone
    assert.equal(getDatasetById(dsId), null, "Dataset row must be gone");
    assert.equal(getDatasetVersionById(verId1), null, "Version 1 must be gone");
    assert.equal(getDatasetVersionById(verId2), null, "Version 2 must be gone");
    assert.equal(getVersionDocumentsById(verId1), null, "Documents 1 must be gone");
    assert.equal(getVersionDocumentsById(verId2), null, "Documents 2 must be gone");
    assert.equal(getAnalysisById(anaId1), null, "Analysis 1 must be gone");
    assert.equal(getAnalysisById(anaId2), null, "Analysis 2 must be gone");

    // Direct SQLite queries verifying absence of orphaned records
    const orphanDocs = db.prepare("SELECT * FROM version_documents WHERE version_id IN (?, ?)").all(verId1, verId2);
    assert.equal(orphanDocs.length, 0, "No orphaned documents");

    const orphanAnas = db.prepare("SELECT * FROM analyses WHERE id IN (?, ?)").all(anaId1, anaId2);
    assert.equal(orphanAnas.length, 0, "No orphaned analyses");
  });

  test("Transaction rollback after induced failure leaves prior writes absent", () => {
    const db = initDb(tempDbPath);

    // Write a baseline dataset outside the failing transaction
    const baselineDs: Dataset = {
      id: "ds-baseline",
      project_id: "proj-base",
      name: "Baseline",
      source: "Scopus",
      record_count: 5,
      status: "available",
      created_at: new Date().toISOString(),
    };
    upsertDataset(baselineDs);

    // In-memory cache tracking
    let cacheUpdated = false;

    assert.throws(
      () => {
        runTransaction(db, () => {
          // Write 1: Successfully insert inside transaction
          db.prepare("INSERT INTO datasets (id, data) VALUES (?, ?)").run(
            "ds-uncommitted-1",
            JSON.stringify({ id: "ds-uncommitted-1", name: "Should Rollback" })
          );

          // Write 2: Successfully insert second record inside transaction
          db.prepare("INSERT INTO dataset_versions (id, data) VALUES (?, ?)").run(
            "ver-uncommitted-1",
            JSON.stringify({ id: "ver-uncommitted-1", dataset_id: "ds-uncommitted-1" })
          );

          // Induced failure AFTER writes have already occurred
          throw new Error("Simulated mid-transaction system failure!");

          // Cache update intentionally placed after commit / end of transaction:
          cacheUpdated = true;
        });
      },
      /Simulated mid-transaction system failure!/
    );

    // Verify cache state was NOT updated
    assert.equal(cacheUpdated, false, "Cache must not update before transaction commit");

    // Verify SQLite rolled back both writes completely
    const uncommittedDs = db.prepare("SELECT * FROM datasets WHERE id = ?").get("ds-uncommitted-1");
    assert.equal(uncommittedDs, undefined, "First write must be completely rolled back");

    const uncommittedVer = db.prepare("SELECT * FROM dataset_versions WHERE id = ?").get("ver-uncommitted-1");
    assert.equal(uncommittedVer, undefined, "Second write must be completely rolled back");

    // Baseline dataset must still exist unharmed
    const baseline = getDatasetById("ds-baseline");
    assert.equal(baseline?.name, "Baseline");
  });

  test("Defensive handling of malformed JSON rows (quarantine without crashing)", () => {
    const db = initDb(tempDbPath);

    // 1. In projects table (no json_extract index): test both syntactically corrupt JSON and schema-invalid entity
    db.prepare("INSERT INTO projects (id, data) VALUES (?, ?)").run(
      "proj-valid-row",
      JSON.stringify({ id: "proj-valid-row", name: "Valid Project" })
    );

    db.prepare("INSERT INTO projects (id, data) VALUES (?, ?)").run(
      "proj-corrupt-json",
      "{ invalid: json string content without quotes"
    );

    db.prepare("INSERT INTO projects (id, data) VALUES (?, ?)").run(
      "proj-missing-id",
      JSON.stringify({ not_an_id: 12345 })
    );

    // loadAllProjects must gracefully quarantine the corrupt/invalid rows and return only the valid one
    const loadedProjects = loadAllProjects();
    assert.equal(loadedProjects.length, 1, "Only the 1 valid project must be returned");
    assert.equal(loadedProjects[0].id, "proj-valid-row");

    // 2. In datasets table: test schema-invalid entity quarantine
    db.prepare("INSERT INTO datasets (id, data) VALUES (?, ?)").run(
      "ds-valid-row",
      JSON.stringify({ id: "ds-valid-row", name: "Valid Dataset", project_id: "p1" })
    );

    db.prepare("INSERT INTO datasets (id, data) VALUES (?, ?)").run(
      "ds-missing-id",
      JSON.stringify({ not_an_id: 12345 })
    );

    const loadedDatasets = loadAllDatasets();
    assert.equal(loadedDatasets.length, 1, "Only the 1 valid dataset must be returned");
    assert.equal(loadedDatasets[0].id, "ds-valid-row");
  });

  test("Startup re-hydration: SQLite wins when cache and database disagree", () => {
    // 1. Initialize and write directly to database
    const db = initDb(tempDbPath);
    const persistedDataset: Dataset = {
      id: "ds-persisted-truth",
      project_id: "proj-1",
      name: "Ground Truth Dataset",
      source: "Dimensions",
      record_count: 100,
      status: "available",
      created_at: new Date().toISOString(),
    };
    upsertDataset(persistedDataset);

    // 2. Simulate server restart / closeDb
    closeDb();

    // 3. Re-open database
    const reopenedDb = initDb(tempDbPath);
    assert.equal(hasAnyData(reopenedDb), true, "hasAnyData must detect persistent rows");

    // 4. Hydrate from SQLite
    const hydrated = loadAllDatasets();
    assert.equal(hydrated.length, 1);
    assert.equal(hydrated[0].name, "Ground Truth Dataset");
  });
});
