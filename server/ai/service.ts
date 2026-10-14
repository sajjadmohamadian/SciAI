import {
  BibliometricDocument,
  ResearchGapMatrixOutput,
  MultiCorpusDiscrepancyOutput,
  PrismaReportInput,
  PrismaAIReport,
} from "../../src/types.js";
import { callAiJson, callAiText, normalizeProviderPreference } from "./router.js";
import { AiCallRequest, AiProvenance } from "./types.js";
import { createUnavailableProvenance, withGroundingPolicy } from "./prompts.js";
import {
  asUnavailableString,
  validateCitationContext,
  validateClusterLabels,
  validatePrismaReport,
  validateResearchGapMatrix,
  validateResearchGaps,
} from "./schemas.js";

export interface AiRequestOptions {
  provider?: unknown;
  fallback?: unknown;
}

export interface AiServiceResult<T> {
  content: T;
  ai_provenance: AiProvenance;
  status: "available" | "unavailable";
  warnings: string[];
}

export interface ClusterLabelRequest {
  cluster_id: number;
  top_members: string[];
  sample_titles?: string[];
  sample_keywords?: string[];
  network_type: string;
}

export interface SemanticClusterResult {
  cluster_id: number;
  label: string;
  tagline: string;
  discipline: string;
  thematic_summary: string;
}

const parseOptions = (options?: AiRequestOptions): Pick<AiCallRequest, "preferredProvider" | "allowFallback"> => ({
  preferredProvider: normalizeProviderPreference(options?.provider),
  allowFallback: typeof options?.fallback === "boolean" ? options.fallback : undefined,
});

const unavailable = <T>(content: T, provenance = createUnavailableProvenance(), warnings: string[] = []): AiServiceResult<T> => ({
  content,
  ai_provenance: provenance,
  status: "unavailable",
  warnings,
});

const available = <T>(content: T, provenance: AiProvenance, warnings: string[] = []): AiServiceResult<T> => ({
  content,
  ai_provenance: provenance,
  status: "available",
  warnings,
});

const summarizeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "unavailable";
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).slice(0, 8).join(", ") : "unavailable";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "unavailable";
  return String(value);
};

const buildDeterministicScientometricInsight = (
  analysisType: string,
  records: Array<Record<string, unknown>>,
  metadata: Record<string, unknown>
): string => {
  const datasetName = summarizeValue(metadata.dataset_name || metadata.dataset || metadata.name || "Active research corpus");
  const totalDocuments = summarizeValue(metadata.total_documents || metadata.documents || metadata.records_processed || records.length);
  const yearsSpan = summarizeValue(metadata.years_span || metadata.timespan || metadata.year_range);
  const totalCitations = summarizeValue(metadata.total_citations || metadata.citations);
  const topKeywords = summarizeValue(metadata.top_keywords || metadata.keywords);

  const annualRecords = records
    .map((r) => ({
      year: Number(r.year || r.name),
      documents: Number(r.documents || r.count || 0),
    }))
    .filter((r) => r.year > 1900 && r.documents > 0)
    .sort((a, b) => a.year - b.year);

  const peak = annualRecords.reduce(
    (best, item) => (item.documents > best.documents ? item : best),
    { year: 0, documents: 0 }
  );
  const computedSpan = annualRecords.length > 0
    ? `${annualRecords[0].year}-${annualRecords[annualRecords.length - 1].year}`
    : yearsSpan;
  const peakSentence = peak.year
    ? `The strongest supplied annual point is ${peak.year} with ${peak.documents.toLocaleString()} publications.`
    : "A peak publication year is unavailable from the supplied annual records.";

  return [
    "Executive Research Summary",
    `SciAI analyzed the supplied deterministic ${analysisType} context for ${datasetName}. The available corpus context contains ${totalDocuments} indexed publications across ${computedSpan}. Total citations are ${totalCitations}. Key supplied terms include ${topKeywords}.`,
    "",
    "Scientometric Significance",
    `${peakSentence} This synthesis is grounded only in the records and metadata already computed by SciAI; unavailable metrics are not inferred or estimated.`,
    "",
    "Strategic Implications",
    "Use this brief as a deterministic overview of the current evidence scope. For richer narrative interpretation, configure or select an available AI provider; until then, SciAI preserves computed values and marks unsupported interpretation as unavailable rather than inventing findings.",
  ].join("\n");
};

export async function generateScientometricInsight(
  analysisType: string,
  records: Array<Record<string, unknown>>,
  metadata: Record<string, unknown>,
  options?: AiRequestOptions
): Promise<AiServiceResult<string>> {
  const previewRecords = records.slice(0, 20);
  const prompt = withGroundingPolicy(`Analyze these deterministic scientometric results and produce a concise scholarly synthesis.

Analysis Domain / Capability: ${analysisType}
Sample Records:
${JSON.stringify(previewRecords, null, 2)}
Metadata & Parameters:
${JSON.stringify(metadata, null, 2)}

Structure the response with: Executive Research Summary, Scientometric Significance, and Strategic Implications. Use only supplied values; unsupported metrics must be unavailable.`, "Interpret only the supplied records and metadata; do not infer missing coefficients or rates.");

  const result = await callAiText({ task: "interpretation", prompt, responseFormat: "text", temperature: 0.2, ...parseOptions(options) });
  if (result.status === "available" && result.content) return available(result.content, result.provenance, result.warnings);

  const deterministicInsight = buildDeterministicScientometricInsight(analysisType, records, metadata);
  return unavailable(deterministicInsight, result.provenance, [
    ...result.warnings,
    "AI provider output was unavailable; returned deterministic SciAI synthesis from supplied metrics.",
  ]);
}

export async function generateSemanticClusterLabels(
  clusters: ClusterLabelRequest[],
  options?: AiRequestOptions
): Promise<AiServiceResult<SemanticClusterResult[]>> {
  const deterministicLabels = clusters.map((c) => {
    const mainMember = c.top_members[0] || `Cluster ${c.cluster_id}`;
    const secondMember = c.top_members[1] || "";
    const label = secondMember ? `${mainMember} & ${secondMember}` : mainMember;
    return {
      cluster_id: c.cluster_id,
      label,
      tagline: `Cluster anchored by ${c.top_members.slice(0, 3).join(", ") || "unavailable"}`,
      discipline: "unavailable",
      thematic_summary: `This label is derived from supplied cluster members only; broader disciplinary interpretation is unavailable without a configured AI provider.`,
    };
  });

  const prompt = withGroundingPolicy(`For each supplied topological network cluster, provide a concise academic label, tagline, primary discipline, and 1-2 sentence thematic summary.

Input Clusters:
${JSON.stringify(clusters, null, 2)}

Return a strict JSON array with cluster_id, label, tagline, discipline, and thematic_summary.`, "Label from supplied members, sample titles, and keywords only.");

  const result = await callAiJson<unknown>({ task: "cluster_labeling", prompt, responseFormat: "json", temperature: 0.2, ...parseOptions(options) });
  const parsed = result.status === "available" ? validateClusterLabels(result.content) : null;
  if (parsed) return available(parsed, result.provenance, result.warnings);
  return unavailable(deterministicLabels, result.provenance, result.warnings);
}

export async function detectResearchGapsAndWhiteSpaces(
  datasetName: string,
  clusters: Array<{ name: string; top_members: string[]; size: number }>,
  motorThemes: string[],
  nicheThemes: string[],
  recentKeywords: string[],
  options?: AiRequestOptions
): Promise<AiServiceResult<{
  white_spaces: Array<{ title: string; rationale: string; bridging_topics: string[]; potential_impact: string }>;
  unexplored_intersections: Array<{ topic_a: string; topic_b: string; hypothesis: string }>;
  future_trend_forecasts: Array<{ concept: string; projected_growth: string; trajectory_rationale: string }>;
}>> {
  const fallback = {
    white_spaces: [],
    unexplored_intersections: [],
    future_trend_forecasts: [],
  };
  const prompt = withGroundingPolicy(`Identify possible research gaps and hypotheses for dataset "${datasetName}" using only supplied context.

Active Clusters:
${JSON.stringify(clusters, null, 2)}
Motor Themes: ${motorThemes.join(", ") || "unavailable"}
Niche Themes: ${nicheThemes.join(", ") || "unavailable"}
Recent Keywords: ${recentKeywords.join(", ") || "unavailable"}

Return JSON with exactly these top-level keys: white_spaces, unexplored_intersections, and future_trend_forecasts. Each white_spaces item must contain title (string), rationale (string), bridging_topics (string array), and potential_impact (string). Each unexplored_intersections item must contain topic_a (string), topic_b (string), and hypothesis (string). Each future_trend_forecasts item must contain concept (string), projected_growth (string), and trajectory_rationale (string). Return only valid JSON; do not rename white_spaces to research_gaps. The white_spaces key is a compatibility field whose values should be research gaps.`, "Research gaps are hypotheses/suggestions, not measured discoveries. Avoid unsupported growth rates.");

  const result = await callAiJson<unknown>({ task: "research_gaps", prompt, responseFormat: "json", temperature: 0.3, ...parseOptions(options) });
  const parsed = result.status === "available" ? validateResearchGaps(result.content) : null;
  if (parsed) return available(parsed as typeof fallback, result.provenance, result.warnings);
  return unavailable(fallback, result.provenance, result.warnings);
}

export async function generateManuscriptSection(
  section: "abstract" | "discussion" | "limitations" | "hypotheses",
  datasetName: string,
  summaryMetrics: Record<string, unknown>,
  options?: AiRequestOptions
): Promise<AiServiceResult<string>> {
  const prompt = withGroundingPolicy(`Draft a publication-style ${section} section for a scientometric manuscript about "${datasetName}".

Empirical Corpus Metrics:
${JSON.stringify(summaryMetrics, null, 2)}

Use only supplied metrics. If a detail required for a conventional manuscript section is not present, write "unavailable" or explicitly state the limitation.`, "Do not add unsupported study details, coefficients, databases, or findings.");

  const result = await callAiText({ task: "manuscript_section", prompt, responseFormat: "text", temperature: 0.2, ...parseOptions(options) });
  if (result.status === "available" && result.content) return available(result.content, result.provenance, result.warnings);
  return unavailable("unavailable", result.provenance, result.warnings);
}

export async function analyzeCitationContexts(
  samplePapers: Array<{ title: string; abstract?: string; citations?: number }>,
  options?: AiRequestOptions
): Promise<AiServiceResult<{
  affirmative_adoption: number | "unavailable";
  methodological_application: number | "unavailable";
  conceptual_background: number | "unavailable";
  critical_comparative: number | "unavailable";
  sentiment_summary: string;
  exemplar_analyses: Array<{ title: string; primary_intent: string; rhetorical_role: string }>;
}>> {
  const fallback = {
    affirmative_adoption: "unavailable" as const,
    methodological_application: "unavailable" as const,
    conceptual_background: "unavailable" as const,
    critical_comparative: "unavailable" as const,
    sentiment_summary: "unavailable",
    exemplar_analyses: [],
  };
  const prompt = withGroundingPolicy(`Analyze citation context and rhetorical intent from these supplied representative works only.

Representative Publications:
${JSON.stringify(samplePapers.slice(0, 10), null, 2)}

Return JSON with affirmative_adoption, methodological_application, conceptual_background, critical_comparative, sentiment_summary, and exemplar_analyses. Use "unavailable" for percentages if abstracts or citation contexts are insufficient.`, "Do not estimate percentages unless supported by supplied context; missing values must be unavailable.");

  const result = await callAiJson<unknown>({ task: "citation_context", prompt, responseFormat: "json", temperature: 0.1, ...parseOptions(options) });
  const parsed = result.status === "available" ? validateCitationContext(result.content) : null;
  if (parsed) return available(parsed as typeof fallback, result.provenance, result.warnings);
  return unavailable(fallback, result.provenance, result.warnings);
}

export async function executeScientometricRAG(
  query: string,
  history: Array<{ role: "user" | "ai"; text: string }>,
  corpusDocuments: BibliometricDocument[],
  analysesSummary: Array<Record<string, unknown>>,
  options?: AiRequestOptions
): Promise<AiServiceResult<string>> {
  const queryTokens = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scoredDocs = corpusDocuments.map((doc) => {
    let score = 0;
    const title = (doc.title || "").toLowerCase();
    const abstract = (doc.abstract || "").toLowerCase();
    const keywords = (doc.keywords || []).map((k) => k.toLowerCase()).join(" ");
    for (const t of queryTokens) {
      if (title.includes(t)) score += 5;
      if (keywords.includes(t)) score += 4;
      if (abstract.includes(t)) score += 2;
    }
    score += Math.min(doc.citations || 0, 10);
    return { doc, score };
  }).sort((a, b) => b.score - a.score);

  const topContextDocs = scoredDocs.slice(0, 15).map((s) => ({
    title: s.doc.title,
    authors: (s.doc.authors || []).slice(0, 4).join(", "),
    year: s.doc.year,
    journal: s.doc.source,
    citations: s.doc.citations,
    doi: s.doc.doi,
    keywords: (s.doc.keywords || []).slice(0, 5),
    abstract: s.doc.abstract ? `${s.doc.abstract.slice(0, 300)}...` : "unavailable",
  }));

  const prompt = withGroundingPolicy(`Answer the researcher's inquiry using only the supplied corpus context and analytical summaries.

Researcher Query: "${query}"

Recent Conversation:
${history.slice(-4).map((h) => `${h.role.toUpperCase()}: ${h.text}`).join("\n")}

Corpus Grounding:
${JSON.stringify(topContextDocs, null, 2)}

Completed Analytical Modules:
${JSON.stringify(analysesSummary.slice(0, 8), null, 2)}

Respond in English only. Cite only supplied records or metrics.`, "RAG answers must be grounded in supplied records/analysis summaries only.");

  const result = await callAiText({ task: "rag_chat", prompt, responseFormat: "text", temperature: 0.2, ...parseOptions(options) });
  if (result.status === "available" && result.content) return available(result.content, result.provenance, result.warnings);
  return unavailable("unavailable", result.provenance, result.warnings);
}

export async function generateResearchGapMatrix(
  datasetId: string,
  datasetName: string,
  corpusDocs: BibliometricDocument[],
  thematicClusters?: string[],
  options?: AiRequestOptions
): Promise<AiServiceResult<ResearchGapMatrixOutput>> {
  const fallback: ResearchGapMatrixOutput = {
    dataset_id: datasetId,
    dataset_name: datasetName,
    proposals: [],
    matrixSummary: {
      totalIdentifiedGaps: 0,
      goldStandardCount: 0,
      moonshotCount: 0,
      incrementalCount: 0,
      recommendedTopGrantProposal: "unavailable",
      recommendedTopThesisTopic: "unavailable",
    },
  };
  const sampleKeywords = Array.from(new Set(corpusDocs.flatMap((d) => d.keywords || []))).slice(0, 30);
  const sampleTitles = corpusDocs.slice(0, 10).map((d) => d.title);
  const prompt = withGroundingPolicy(`Synthesize an AI-assisted research opportunity matrix from the supplied corpus vocabulary. Treat proposals as suggestions, not computed discoveries.

Research Corpus: "${datasetName}" (${corpusDocs.length} publications)
Key Core Keywords: ${sampleKeywords.join(", ") || "unavailable"}
Thematic Clusters: ${(thematicClusters || []).join(", ") || "unavailable"}
Sample Research Corpus Titles:
${sampleTitles.join("\n") || "unavailable"}

Return JSON with exactly two top-level keys: proposals and matrixSummary. Each proposals item must include id, title, subField, gapDescription, methodologicalApproach, noveltyScore (number 0-100), feasibilityScore (number 0-100), competitivenessDegree, quadrant, targetDegreeLevel, estimatedCompletionHorizon, keyFoundationalReferences (string array), suggestedPrimaryKeywords (string array), and expectedDeliverables (string array). Use one of these exact quadrant values: "High Novelty / High Feasibility (Gold Standard Grant)", "High Novelty / Low Feasibility (High-Risk Moonshot Thesis)", "Low Novelty / High Feasibility (Low-Hanging Fruit / Incremental)", or "Low Novelty / Low Feasibility (Deprioritized)". matrixSummary must include totalIdentifiedGaps, goldStandardCount, moonshotCount, incrementalCount, recommendedTopGrantProposal, and recommendedTopThesisTopic. Return only valid JSON; do not omit required fields.`, "Scores are heuristic suggestions only; do not invent references or factual evidence outside supplied context.");

  const result = await callAiJson<unknown>({ task: "research_gap_matrix", prompt, responseFormat: "json", temperature: 0.3, ...parseOptions(options) });
  const parsed = result.status === "available" ? validateResearchGapMatrix(result.content, datasetId, datasetName) : null;
  if (parsed) return available(parsed, result.provenance, result.warnings);
  return unavailable(fallback, result.provenance, result.warnings);
}

export async function generateMultiCorpusDiscrepancyAnalysis(
  datasetId: string,
  datasetName: string,
  corpusDocs: BibliometricDocument[]
): Promise<AiServiceResult<MultiCorpusDiscrepancyOutput>> {
  const total = corpusDocs.length;
  const counts = { WoS: 0, Scopus: 0, PubMed: 0 };
  corpusDocs.forEach((d) => {
    const src = String(d.DB || d.source || "WoS").toLowerCase();
    if (src.includes("scopus")) counts.Scopus += 1;
    else if (src.includes("pubmed") || src.includes("medline")) counts.PubMed += 1;
    else counts.WoS += 1;
  });

  return available({
    dataset_id: datasetId,
    dataset_name: datasetName,
    totalUniqueUnionDocs: total,
    databasesCompared: ["WoS", "Scopus", "PubMed"],
    databaseMetrics: [
      { database: "WoS", docCount: counts.WoS, exclusiveDocCount: counts.WoS, exclusiveRatio: total ? Number(((counts.WoS / total) * 100).toFixed(1)) : 0, coverageRatio: total ? Number(((counts.WoS / total) * 100).toFixed(1)) : 0, avgCitationsRecorded: 0, openAccessCoveragePct: 0, authorDisambiguationQuality: "Low (Raw Text)", fundingInformationCoveragePct: 0, abstractCompletenessPct: 0 },
      { database: "Scopus", docCount: counts.Scopus, exclusiveDocCount: counts.Scopus, exclusiveRatio: total ? Number(((counts.Scopus / total) * 100).toFixed(1)) : 0, coverageRatio: total ? Number(((counts.Scopus / total) * 100).toFixed(1)) : 0, avgCitationsRecorded: 0, openAccessCoveragePct: 0, authorDisambiguationQuality: "Low (Raw Text)", fundingInformationCoveragePct: 0, abstractCompletenessPct: 0 },
      { database: "PubMed", docCount: counts.PubMed, exclusiveDocCount: counts.PubMed, exclusiveRatio: total ? Number(((counts.PubMed / total) * 100).toFixed(1)) : 0, coverageRatio: total ? Number(((counts.PubMed / total) * 100).toFixed(1)) : 0, avgCitationsRecorded: 0, openAccessCoveragePct: 0, authorDisambiguationQuality: "Low (Raw Text)", fundingInformationCoveragePct: 0, abstractCompletenessPct: 0 },
    ],
    vennIntersections: { wosOnly: counts.WoS, scopusOnly: counts.Scopus, pubmedOnly: counts.PubMed, wosScopusOverlap: 0, wosPubmedOverlap: 0, scopusPubmedOverlap: 0, tripleUnionOverlap: 0 },
    fieldBiases: [],
    synthesizedReport: {
      citationInflationLeader: "unavailable",
      clinicalDepthLeader: "unavailable",
      eliteSelectivityLeader: "unavailable",
      recommendedIndexingStrategy: "Computed source counts are available from imported bibliographic records; cross-database overlap quality is unavailable without canonical source identifiers.",
      systematicReviewWarning: "unavailable",
    },
  }, createUnavailableProvenance([], ["This endpoint uses deterministic imported-source counts only; unsupported cross-database coverage metrics are unavailable."]));
}

export async function generatePrismaSynthesisReport(
  input: PrismaReportInput,
  options?: AiRequestOptions
): Promise<AiServiceResult<PrismaAIReport>> {
  const flow = input.flow;
  const value = (value: number | null): number | null => value !== null && Number.isFinite(value) ? value : null;
  const databaseIdentified = value(flow ? flow.identified_databases.value : input.identifiedDatabases);
  const registerIdentified = flow ? value(flow.identified_registers.value) : null;
  const identified = flow
    ? databaseIdentified !== null && registerIdentified !== null && Number.isSafeInteger(databaseIdentified + registerIdentified)
      ? databaseIdentified + registerIdentified : null
    : databaseIdentified;
  const duplicates = value(flow ? flow.removed_duplicates.value : input.removedDuplicates);
  const screened = value(flow ? flow.screened.value : input.screened);
  const excluded = value(flow ? flow.excluded_screening.value : input.excludedScreening);
  const sought = value(flow ? flow.sought_retrieval.value : input.soughtRetrieval);
  const notRetrieved = value(flow ? flow.not_retrieved.value : input.notRetrieved);
  const percent = (numerator: number | null, denominator: number | null): string =>
    numerator === null || denominator === null || denominator === 0
      ? "Not recorded" : `${((numerator / denominator) * 100).toFixed(1)}%`;
  const yieldMetrics: PrismaAIReport["yieldMetrics"] = {
    totalIdentified: identified,
    duplicateAttritionRate: percent(duplicates, identified),
    screeningAttritionRate: percent(excluded, screened),
    retrievalSuccessRate: percent(sought !== null && notRetrieved !== null ? sought - notRetrieved : null, sought),
    // Studies and reports/records are different units; no linkage is recorded here.
    eligibilityRetentionRate: "Not recorded",
    finalInclusionYield: "Not recorded",
  };
  const missing = flow?.consistency.warnings || [];
  const fallback: PrismaAIReport = {
    datasetName: input.datasetName || "Bibliometric Dataset",
    generatedAt: new Date().toISOString(),
    executiveSummary: "This version-scoped PRISMA workflow is incomplete. Unrecorded selection decisions are not estimates or zero counts.",
    methodologyNarrative: `The PRISMA flow for this dataset version uses persisted ingestion and deduplication provenance plus explicitly entered review decisions. ${missing.join(" ")}`,
    yieldMetrics,
    exclusionReasonsSynthesis: input.excludedEligibilityReasons.map((r) => ({ reason: r.reason, count: r.count, impactAssessment: "Not assessed" })),
    prismaComplianceChecklist: [],
    methodologicalStrengths: [],
    limitationsAndBiases: missing,
    recommendationsForAuthors: [],
  };

  const prompt = withGroundingPolicy(`Synthesize a cautious PRISMA 2020 methodology narrative from this version-scoped workflow.\n\n${JSON.stringify(input, null, 2)}\n\nReturn JSON matching PrismaAIReport. Preserve null as "Not recorded"; never infer missing counts, decisions, or studies from records/reports. Do not claim PRISMA verification or compliance merely because counts exist. Explain provenance and incomplete steps.`, "PRISMA report must use persisted counts only; missing values remain not recorded.");
  const result = await callAiJson<unknown>({ task: "prisma_report", prompt, responseFormat: "json", temperature: 0.2, ...parseOptions(options) });
  const parsed = result.status === "available" ? validatePrismaReport(result.content, fallback) : null;
  if (parsed) return available({ ...parsed, yieldMetrics, limitationsAndBiases: [...missing, ...(parsed.limitationsAndBiases || [])] }, result.provenance, [...missing, ...result.warnings]);
  return unavailable(fallback, result.provenance, [...missing, ...result.warnings]);
}
