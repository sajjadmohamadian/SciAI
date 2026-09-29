import assert from "node:assert/strict";
import test from "node:test";
import { applyPrismaManualCounts, buildPrismaFlow, validatePrismaManualCounts } from "../server/prisma_flow.js";
import type { DatasetVersion, PrismaIngestionProvenance, PrismaManualCounts } from "../src/types.js";

const version = (ingestion?: PrismaIngestionProvenance, manual?: Partial<PrismaManualCounts>): DatasetVersion => ({
  id: "v1", dataset_id: "ds1", version: 1, record_count: 8,
  metadata: { ...(ingestion && { ingestion }), ...(manual && { prisma: { manual } }) },
});
const lineage: PrismaIngestionProvenance = {
  operation: "server_deduplication", raw_input_count: 10,
  source_counts: { one: 6, two: 4 }, duplicates_removed: 2,
  final_unique_count: 8,
};

test("legacy versions retain unknowns instead of inventing zeroes from stored records", () => {
  const flow = buildPrismaFlow(version(), 8);
  for (const field of ["identified_databases", "identified_registers", "removed_duplicates",
    "removed_automation", "removed_other", "screened", "sought_retrieval",
    "assessed_eligibility", "included_studies"] as const) {
    assert.deepEqual([flow[field].value, flow[field].source], [null, "not_recorded"], field);
  }
  assert.equal(flow.consistency.valid, true);
});

test("ingestion lineage does not silently supply absent manual pre-screening zeros", () => {
  const flow = buildPrismaFlow(version(lineage), 8);
  assert.equal(flow.identified_databases.value, 10);
  assert.equal(flow.removed_duplicates.value, 2);
  assert.equal(flow.identified_registers.value, null);
  assert.equal(flow.removed_automation.value, null);
  assert.equal(flow.screened.value, null);
  assert.equal(flow.consistency.valid, true);
  assert.match(flow.consistency.warnings.join(" "), /stored records/);
});

test("verified stored screening set is measured, not mistaken for identification", () => {
  const flow = buildPrismaFlow(version(lineage, { removed_automation: 0, removed_other: 0 }), 8);
  assert.deepEqual([flow.screened.value, flow.screened.source], [8, "measured"]);
  assert.equal(flow.identified_registers.value, null);
  assert.match(flow.screened.basis!, /register route not recorded/);
});

test("stored records do not establish screening without verified lineage", () => {
  const manual = { removed_automation: 0, removed_other: 0 };
  const noOperation = buildPrismaFlow(version({ ...lineage, operation: undefined }, manual), 8);
  assert.equal(noOperation.screened.value, null);
  const missingFinal = buildPrismaFlow(version({ ...lineage, final_unique_count: undefined }, manual), 8);
  assert.equal(missingFinal.screened.value, null);
  const wrongStored = buildPrismaFlow(version(lineage, manual), 7);
  assert.equal(wrongStored.screened.value, null);
  assert.equal(wrongStored.consistency.valid, false);
});

test("an explicitly recorded zero register count enables full arithmetic", () => {
  const flow = buildPrismaFlow(version(lineage, {
    identified_registers: 0, removed_automation: 0, removed_other: 0,
  }), 8);
  assert.equal(flow.screened.value, 8);
  assert.equal(flow.screened.source, "derived");
  assert.equal(flow.identified_registers.source, "user_entered");
});

test("register inputs are conserved with database identification and recorded removals", () => {
  const manual: Partial<PrismaManualCounts> = {
    identified_registers: 3, removed_automation: 1, removed_other: 1,
    excluded_screening: 2, not_retrieved: 1,
    exclusion_reasons: [{ reason: "Wrong design", count: 2 }, { reason: "Wrong population", count: 1 }],
    included_studies: 3,
  };
  const flow = buildPrismaFlow(version(lineage, manual), 8);
  assert.equal(flow.screened.value, 9); // 10 + 3 - 2 - 1 - 1
  assert.equal(flow.screened.source, "derived");
  assert.equal(flow.sought_retrieval.value, 7);
  assert.equal(flow.assessed_eligibility.value, 6);
  assert.equal(flow.included_studies.value, 3);
  assert.equal(flow.included_studies.source, "user_entered");
  assert.equal(flow.consistency.valid, true);
  assert.match(flow.consistency.warnings.join(" "), /distinct from 9 screened/);
});

test("eligibility reasons never infer studies, even with explicit empty reasons", () => {
  for (const reasons of [[], [{ reason: "Not eligible", count: 2 }]]) {
    const flow = buildPrismaFlow(version(lineage, {
      identified_registers: 0, removed_automation: 0, removed_other: 0,
      excluded_screening: 2, not_retrieved: 1, exclusion_reasons: reasons,
    }), 8);
    assert.equal(flow.assessed_eligibility.value, 5);
    assert.equal(flow.included_studies.value, null);
    assert.equal(flow.consistency.valid, true);
  }
});

test("manual contradictions are reported even when no arithmetic value can be derived", () => {
  const flow = buildPrismaFlow(version(lineage, {
    identified_registers: 0, removed_automation: 9, removed_other: 0,
    excluded_screening: 20, not_retrieved: 0,
    exclusion_reasons: [{ reason: "Wrong design", count: 10 }], included_studies: 20,
  }), 8);
  assert.equal(flow.consistency.valid, false);
  assert.match(flow.consistency.errors.join("; "), /Pre-screening removals cannot exceed/);
  assert.equal(flow.screened.value, null);
});

test("screening, retrieval, eligibility and inclusion bounds are checked", () => {
  const base = { identified_registers: 0, removed_automation: 0, removed_other: 0 };
  const screening = buildPrismaFlow(version(lineage, { ...base, excluded_screening: 9 }), 8);
  assert.match(screening.consistency.errors.join(" "), /Screening exclusions cannot exceed/);
  const retrieval = buildPrismaFlow(version(lineage, { ...base, excluded_screening: 2, not_retrieved: 7 }), 8);
  assert.match(retrieval.consistency.errors.join(" "), /not retrieved cannot exceed/);
  const eligibility = buildPrismaFlow(version(lineage, {
    ...base, excluded_screening: 2, not_retrieved: 1,
    exclusion_reasons: [{ reason: "Invalid", count: 6 }], included_studies: 1,
  }), 8);
  assert.match(eligibility.consistency.errors.join(" "), /Eligibility exclusion reasons cannot exceed/);
  const inclusion = buildPrismaFlow(version(lineage, {
    ...base, excluded_screening: 2, not_retrieved: 1,
    exclusion_reasons: [{ reason: "Invalid", count: 2 }], included_studies: 4,
  }), 8);
  assert.match(inclusion.consistency.errors.join(" "), /Eligibility exclusions plus included studies cannot exceed/);
});

test("contradictory ingestion counts and mismatched stored corpus are invalid", () => {
  const flow = buildPrismaFlow(version({ ...lineage, source_counts: { one: 9 }, final_unique_count: 7 }), 8);
  assert.equal(flow.consistency.valid, false);
  assert.match(flow.consistency.errors.join("; "), /Per-source ingestion counts must equal/);
  assert.match(flow.consistency.errors.join("; "), /final unique count/);
  assert.match(flow.consistency.errors.join("; "), /stored document count/);
  assert.equal(flow.screened.value, null);
});

test("invalid persisted manual fields are rejected in the built flow", () => {
  const corrupt = version(lineage, { identified_registers: -1, included_studies: 1.5,
    exclusion_reasons: [{ reason: "duplicate", count: 1 }, { reason: "DUPLICATE", count: -1 }],
  });
  const flow = buildPrismaFlow(corrupt, 8);
  assert.equal(flow.consistency.valid, false);
  assert.match(flow.consistency.errors.join(" "), /identified_registers must be/);
  assert.match(flow.consistency.errors.join(" "), /included_studies must be/);
  assert.match(flow.consistency.errors.join(" "), /duplicate reason/);
  assert.equal(flow.included_studies.value, null);
});

test("manual validation and immutable update retain existing fields", () => {
  assert.ok(validatePrismaManualCounts({ removed_automation: -1 }).length);
  assert.ok(validatePrismaManualCounts({ exclusion_reasons: [{ reason: "", count: 1 }] }).length);
  const original = version(lineage, { identified_registers: 0, removed_other: 0 });
  assert.throws(() => applyPrismaManualCounts(original, { removed_automation: -1 }), /non-negative integer/);
  const next = applyPrismaManualCounts(original, { removed_automation: 0 }, "2026-09-28T00:00:00Z");
  const stored = (next.metadata?.prisma as { manual: PrismaManualCounts }).manual;
  assert.equal(stored.identified_registers, 0);
  assert.equal(stored.removed_automation, 0);
  assert.equal(stored.updated_at, "2026-09-28T00:00:00Z");
  assert.equal(((original.metadata?.prisma as { manual: PrismaManualCounts }).manual).removed_automation, undefined);
});
