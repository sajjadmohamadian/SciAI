import { ResearchGapMatrixOutput, PrismaAIReport } from "../../src/types.js";

export function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty_json_response");

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    throw new Error("malformed_json_response");
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asUnavailableString(value: unknown): string {
  return isNonEmptyString(value) ? value.trim() : "unavailable";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function validateClusterLabels(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const labels = raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const obj = entry as Record<string, unknown>;
      return {
        cluster_id: typeof obj.cluster_id === "number" ? obj.cluster_id : 0,
        label: asUnavailableString(obj.label),
        tagline: asUnavailableString(obj.tagline),
        discipline: asUnavailableString(obj.discipline),
        thematic_summary: asUnavailableString(obj.thematic_summary),
      };
    });
  return labels.length > 0 ? labels : null;
}

export function validateResearchGaps(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.white_spaces) || !Array.isArray(obj.unexplored_intersections) || !Array.isArray(obj.future_trend_forecasts)) {
    return null;
  }
  return obj;
}

export function validateCitationContext(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.sentiment_summary) || !Array.isArray(obj.exemplar_analyses)) return null;
  return obj;
}

export function validateResearchGapMatrix(raw: unknown, datasetId: string, datasetName: string): ResearchGapMatrixOutput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.proposals) || obj.proposals.length === 0) return null;
  const summary = obj.matrixSummary && typeof obj.matrixSummary === "object" ? obj.matrixSummary as Record<string, unknown> : {};
  return {
    dataset_id: datasetId,
    dataset_name: datasetName,
    proposals: obj.proposals as ResearchGapMatrixOutput["proposals"],
    matrixSummary: {
      totalIdentifiedGaps: typeof summary.totalIdentifiedGaps === "number" ? summary.totalIdentifiedGaps : obj.proposals.length,
      goldStandardCount: typeof summary.goldStandardCount === "number" ? summary.goldStandardCount : 0,
      moonshotCount: typeof summary.moonshotCount === "number" ? summary.moonshotCount : 0,
      incrementalCount: typeof summary.incrementalCount === "number" ? summary.incrementalCount : 0,
      recommendedTopGrantProposal: asUnavailableString(summary.recommendedTopGrantProposal),
      recommendedTopThesisTopic: asUnavailableString(summary.recommendedTopThesisTopic),
    },
  };
}

export function validatePrismaReport(raw: unknown, fallback: PrismaAIReport): PrismaAIReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.methodologyNarrative) || !isNonEmptyString(obj.executiveSummary)) return null;
  return {
    ...fallback,
    ...(obj as Partial<PrismaAIReport>),
    datasetName: fallback.datasetName,
    generatedAt: new Date().toISOString(),
  };
}
