import {
  DatasetVersion,
  PrismaCount,
  PrismaFlow,
  PrismaIngestionProvenance,
  PrismaManualCounts,
} from "../src/types.js";

export const PRISMA_METHOD_VERSION = "1.0.0";

type RawReason = { reason: string; count: number };

type PrismaMetadata = {
  ingestion?: PrismaIngestionProvenance;
  prisma?: { manual?: PrismaManualCounts };
};

const unknownCount = (basis: string): PrismaCount => ({ value: null, source: "not_recorded", basis });
const measured = (value: number, basis: string): PrismaCount => ({ value, source: "measured", basis });
const userEntered = (value: number, basis: string): PrismaCount => ({ value, source: "user_entered", basis });
const derived = (value: number, basis: string): PrismaCount => ({ value, source: "derived", basis });

const asNonNegativeInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const metadataFor = (version: DatasetVersion): PrismaMetadata =>
  (version.metadata || {}) as PrismaMetadata;

const hasValue = (value: unknown): boolean => value !== undefined;

export function validatePrismaManualCounts(input: Partial<PrismaManualCounts>): string[] {
  const errors: string[] = [];
  const scalarFields: Array<keyof PrismaManualCounts> = [
    "identified_registers", "removed_automation", "removed_other",
    "excluded_screening", "not_retrieved", "included_studies",
  ];

  for (const field of scalarFields) {
    if (hasValue(input[field]) && asNonNegativeInteger(input[field]) === null) {
      errors.push(`${field} must be a non-negative integer`);
    }
  }

  if (input.exclusion_reasons !== undefined) {
    if (!Array.isArray(input.exclusion_reasons)) {
      errors.push("exclusion_reasons must be an array");
    } else {
      const seen = new Set<string>();
      input.exclusion_reasons.forEach((item, index) => {
        const reason = typeof item?.reason === "string" ? item.reason.trim() : "";
        if (!reason) errors.push(`exclusion_reasons[${index}].reason is required`);
        const key = reason.toLowerCase();
        if (key && seen.has(key)) errors.push(`exclusion_reasons contains duplicate reason: ${reason}`);
        if (key) seen.add(key);
        if (asNonNegativeInteger(item?.count) === null) {
          errors.push(`exclusion_reasons[${index}].count must be a non-negative integer`);
        }
      });
    }
  }

  return errors;
}

export function buildPrismaFlow(
  version: DatasetVersion,
  documentCount: number,
  now = new Date().toISOString(),
): PrismaFlow {
  const metadata = metadataFor(version);
  const ingestion = metadata.ingestion || {};
  const manual: Partial<PrismaManualCounts> = metadata.prisma?.manual || {};
  const warnings: string[] = [];
  const errors = validatePrismaManualCounts(manual);

  // Never substitute a stored corpus size for the number originally identified.
  // Per-source totals and the raw total describe the same database inputs, not
  // separate pools to be added together.
  let sourceTotal: number | null = null;
  if (ingestion.source_counts !== undefined) {
    const sourceCounts = ingestion.source_counts;
    if (!sourceCounts || typeof sourceCounts !== "object" || Array.isArray(sourceCounts)) {
      errors.push("Ingestion source counts must be a source-to-count map");
    } else if (Object.keys(sourceCounts).length > 0) {
      const counts = Object.values(sourceCounts);
      if (counts.some((count) => asNonNegativeInteger(count) === null)) {
        errors.push("Ingestion source counts must be non-negative integers");
      } else {
        const sum = counts.reduce((total, count) => total + count, 0);
        if (Number.isSafeInteger(sum)) sourceTotal = sum;
        else errors.push("Ingestion source count total exceeds the safe integer range");
      }
    }
  }
  const rawInput = asNonNegativeInteger(ingestion.raw_input_count);
  if (hasValue(ingestion.raw_input_count) && rawInput === null) errors.push("Ingestion raw input count is invalid");
  if (sourceTotal !== null && rawInput !== null && sourceTotal !== rawInput) {
    errors.push("Per-source ingestion counts must equal the raw database input count");
  }
  const databaseTotal = sourceTotal ?? rawInput;
  const identified = databaseTotal === null
    ? unknownCount("No persisted raw-input or per-source database count")
    : measured(databaseTotal, sourceTotal !== null ? "Persisted per-source database counts" : "Persisted raw database input count");

  const duplicateValue = asNonNegativeInteger(ingestion.duplicates_removed);
  if (hasValue(ingestion.duplicates_removed) && duplicateValue === null) errors.push("Duplicate removal count is invalid");
  const duplicates = duplicateValue === null
    ? unknownCount("No persisted deduplication count")
    : measured(duplicateValue, "Persisted deduplication lineage");
  const finalUnique = asNonNegativeInteger(ingestion.final_unique_count);
  if (hasValue(ingestion.final_unique_count) && finalUnique === null) errors.push("Final unique count is invalid");
  if (databaseTotal !== null && duplicateValue !== null) {
    if (duplicateValue > databaseTotal) errors.push("Removed duplicates cannot exceed identified database records");
    if (finalUnique !== null && databaseTotal - duplicateValue !== finalUnique) {
      errors.push("Raw database inputs minus duplicates must equal the final unique count");
    }
  }
  if (finalUnique !== null && asNonNegativeInteger(documentCount) !== null && finalUnique !== documentCount) {
    errors.push("Persisted final unique count must equal the selected version's stored document count");
  }
  if (ingestion.removed_document_ids !== undefined && !Array.isArray(ingestion.removed_document_ids)) {
    errors.push("Removed document IDs must be an array");
  }

  const manualCount = (field: keyof PrismaManualCounts, description: string): PrismaCount => {
    const value = asNonNegativeInteger(manual[field]);
    return value === null ? unknownCount(description) : userEntered(value, "Review workflow input");
  };
  const registers = manualCount("identified_registers", "No register-search count recorded");
  const automation = manualCount("removed_automation", "No automation removal count recorded");
  const other = manualCount("removed_other", "No other pre-screening removal count recorded");

  // A missing register count is unknown, never zero. A recorded register
  // count belongs to the identification total, independently of databases.
  const identifiedTotal = identified.value !== null && registers.value !== null
    ? identified.value + registers.value : null;
  if (identifiedTotal !== null && !Number.isSafeInteger(identifiedTotal)) {
    errors.push("Database and register identification total exceeds the safe integer range");
  }
  const knownRemovals = [duplicates.value, automation.value, other.value]
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(knownRemovals)) errors.push("Pre-screening removal total exceeds the safe integer range");
  const allRemovalsKnown = [duplicates, automation, other].every((count) => count.value !== null);
  const preRemovalTotal = allRemovalsKnown ? knownRemovals : null;
  if (identifiedTotal !== null && knownRemovals > identifiedTotal) {
    errors.push("Pre-screening removals cannot exceed identified database and register records");
  }
  const arithmeticScreened = identifiedTotal !== null && preRemovalTotal !== null
    && Number.isSafeInteger(preRemovalTotal) && preRemovalTotal <= identifiedTotal && Number.isSafeInteger(identifiedTotal)
    ? identifiedTotal - preRemovalTotal : null;
  // The stored count is evidence of screened records only when the version's
  // lineage proves these are the post-deduplication records and explicitly
  // records that no further pre-screening removals occurred. It is never a
  // fallback for missing or contradictory identification/removal counts.
  const storedIsScreeningSet = identified.value !== null && duplicates.value !== null
    && finalUnique !== null && finalUnique === documentCount
    && identified.value - duplicates.value === finalUnique
    && typeof ingestion.operation === "string" && ingestion.operation.length > 0
    && automation.value === 0 && other.value === 0 && registers.value === null;
  const screened = arithmeticScreened !== null
    ? derived(arithmeticScreened, "Database and register records minus recorded pre-screening removals")
    : storedIsScreeningSet
      ? measured(documentCount, "Stored post-deduplication database screening set; register route not recorded")
      : unknownCount("Requires complete identification/removal counts or verified screening-set lineage");

  const excludedScreening = manualCount("excluded_screening", "No title/abstract screening exclusions recorded");
  if (screened.value !== null && excludedScreening.value !== null && excludedScreening.value > screened.value) {
    errors.push("Screening exclusions cannot exceed screened records");
  }
  const soughtValue = screened.value !== null && excludedScreening.value !== null
    && excludedScreening.value <= screened.value ? screened.value - excludedScreening.value : null;
  const sought = soughtValue === null
    ? unknownCount("Requires screened records and screening exclusions")
    : derived(soughtValue, "Screened records minus screening exclusions");

  const notRetrieved = manualCount("not_retrieved", "No full-text retrieval failures recorded");
  if (sought.value !== null && notRetrieved.value !== null && notRetrieved.value > sought.value) {
    errors.push("Reports not retrieved cannot exceed reports sought");
  }
  const assessedValue = sought.value !== null && notRetrieved.value !== null
    && notRetrieved.value <= sought.value ? sought.value - notRetrieved.value : null;
  const assessed = assessedValue === null
    ? unknownCount("Requires reports sought and reports not retrieved")
    : derived(assessedValue, "Reports sought minus reports not retrieved");

  const rawReasons: RawReason[] = Array.isArray(manual.exclusion_reasons) ? manual.exclusion_reasons : [];
  const excludedEligibility = rawReasons.filter((item) => typeof item?.reason === "string"
    && asNonNegativeInteger(item.count) !== null).map((item) => ({
    reason: item.reason.trim(),
    count: userEntered(item.count, "Review workflow input"),
  }));
  const reasonsValid = manual.exclusion_reasons !== undefined
    && errors.every((error) => !error.startsWith("exclusion_reasons"));
  const reasonTotal = excludedEligibility.reduce((sum, item) => sum + item.count.value!, 0);
  if (!Number.isSafeInteger(reasonTotal)) errors.push("Eligibility exclusion total exceeds the safe integer range");
  if (assessed.value !== null && reasonsValid && reasonTotal > assessed.value) {
    errors.push("Eligibility exclusion reasons cannot exceed reports assessed");
  }
  // Eligibility operates on reports, whereas inclusion counts studies. Multiple
  // reports may describe one study, so subtraction cannot establish inclusion.
  // Even an explicitly empty exclusion list provides no study count.
  const included = manualCount("included_studies", "No included-study count recorded; report-to-study mapping is unknown");
  if (assessed.value !== null && included.value !== null && included.value > assessed.value) {
    errors.push("Included studies cannot exceed reports assessed for eligibility");
  }
  if (assessed.value !== null && reasonsValid && included.value !== null
    && reasonTotal + included.value > assessed.value) {
    errors.push("Eligibility exclusions plus included studies cannot exceed reports assessed");
  }
  if (asNonNegativeInteger(documentCount) === null) errors.push("Document count is invalid");

  if (identified.value === null) warnings.push("Initial database identification count is not recorded; no PRISMA estimate was generated.");
  if (duplicateValue === null) warnings.push("Duplicate removal count is not recorded; run and approve deduplication or provide a merge lineage.");
  if (registers.value === null) warnings.push("Register-search identification count is not recorded; totals exclude an unknown register route.");
  if (automation.value === null || other.value === null) warnings.push("Pre-screening removal counts are incomplete; screened records cannot be inferred without them.");
  if (manual.excluded_screening === undefined) warnings.push("Title/abstract screening decisions are not recorded.");
  if (manual.included_studies === undefined) warnings.push("Included-study count is not recorded; reports cannot be assumed to equal studies.");
  if (identified.value !== null && identified.value !== documentCount) {
    warnings.push(`The selected version contains ${documentCount} stored records; database identification provenance reports ${identified.value}. Stored records are not a screening count.`);
  }
  if (screened.value !== null && screened.value !== documentCount) {
    warnings.push(`The selected version contains ${documentCount} stored records, distinct from ${screened.value} screened records.`);
  }

  return {
    dataset_id: version.dataset_id,
    dataset_version_id: version.id,
    method_version: PRISMA_METHOD_VERSION,
    computed_at: now,
    identified_databases: identified,
    identified_registers: registers,
    removed_duplicates: duplicates,
    removed_automation: automation,
    removed_other: other,
    screened,
    excluded_screening: excludedScreening,
    sought_retrieval: sought,
    not_retrieved: notRetrieved,
    assessed_eligibility: assessed,
    excluded_eligibility: excludedEligibility,
    included_studies: included,
    consistency: { valid: errors.length === 0, errors, warnings },
  };
}

export function applyPrismaManualCounts(
  version: DatasetVersion,
  input: Partial<PrismaManualCounts>,
  now = new Date().toISOString(),
): DatasetVersion {
  const errors = validatePrismaManualCounts(input);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const metadata = metadataFor(version);
  const nextMetadata = {
    ...metadata,
    prisma: {
      ...(metadata.prisma || {}),
      manual: {
        ...(metadata.prisma?.manual || {}),
        ...input,
        updated_at: now,
      },
    },
  };
  return { ...version, metadata: nextMetadata };
}
