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

  const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  return {
    white_spaces: obj.white_spaces
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          title: asUnavailableString(item.title || item.name),
          rationale: asUnavailableString(item.rationale || item.gapDescription || item.gap_description),
          bridging_topics: stringArray(item.bridging_topics || item.bridgingTopics || item.topics),
          potential_impact: asUnavailableString(item.potential_impact || item.potentialImpact || item.impact),
        };
      }),
    unexplored_intersections: obj.unexplored_intersections
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          topic_a: asUnavailableString(item.topic_a || item.topicA),
          topic_b: asUnavailableString(item.topic_b || item.topicB),
          hypothesis: asUnavailableString(item.hypothesis),
        };
      }),
    future_trend_forecasts: obj.future_trend_forecasts
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          concept: asUnavailableString(item.concept),
          projected_growth: asUnavailableString(item.projected_growth || item.projectedGrowth),
          trajectory_rationale: asUnavailableString(item.trajectory_rationale || item.trajectoryRationale || item.rationale),
        };
      }),
  };
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
  const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  const proposals = obj.proposals
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const item = entry as Record<string, unknown>;
      const noveltyScore = typeof item.noveltyScore === "number" ? item.noveltyScore : typeof item.novelty_score === "number" ? item.novelty_score : 0;
      const feasibilityScore = typeof item.feasibilityScore === "number" ? item.feasibilityScore : typeof item.feasibility_score === "number" ? item.feasibility_score : 0;
      return {
        id: asUnavailableString(item.id) === "unavailable" ? `ai-gap-${index + 1}` : asUnavailableString(item.id),
        title: asUnavailableString(item.title),
        subField: asUnavailableString(item.subField || item.sub_field),
        gapDescription: asUnavailableString(item.gapDescription || item.gap_description || item.rationale),
        methodologicalApproach: asUnavailableString(item.methodologicalApproach || item.methodological_approach || item.method),
        noveltyScore,
        feasibilityScore,
        competitivenessDegree: asUnavailableString(item.competitivenessDegree || item.competitiveness_degree) as ResearchGapMatrixOutput["proposals"][number]["competitivenessDegree"],
        quadrant: asUnavailableString(item.quadrant) as ResearchGapMatrixOutput["proposals"][number]["quadrant"],
        targetDegreeLevel: asUnavailableString(item.targetDegreeLevel || item.target_degree_level) as ResearchGapMatrixOutput["proposals"][number]["targetDegreeLevel"],
        estimatedCompletionHorizon: asUnavailableString(item.estimatedCompletionHorizon || item.estimated_completion_horizon) as ResearchGapMatrixOutput["proposals"][number]["estimatedCompletionHorizon"],
        keyFoundationalReferences: stringArray(item.keyFoundationalReferences || item.key_foundational_references),
        suggestedPrimaryKeywords: stringArray(item.suggestedPrimaryKeywords || item.suggested_primary_keywords),
        expectedDeliverables: stringArray(item.expectedDeliverables || item.expected_deliverables),
      };
    });
  if (proposals.length === 0) return null;
  return {
    dataset_id: datasetId,
    dataset_name: datasetName,
    proposals,
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
