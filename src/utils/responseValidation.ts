import {
  Project,
  Dataset,
  DatasetVersion,
  Capability,
  Analysis,
  ResultRecord,
  HistCiteOutput,
  RPYSOutput,
  ThematicEvolutionOutput,
  ResearchGapMatrixOutput,
  MultiCorpusDiscrepancyOutput,
} from "../types.js";

export type ValidationOutcome<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data: null; error: string; raw?: unknown };

export interface AIResponseOutcome<T> {
  success: boolean;
  isComplete: boolean;
  data: T | null;
  error?: string;
  isPartial?: boolean;
}

// -------------------------------------------------------------
// 1. Dashboard & Project Validation
// -------------------------------------------------------------
export interface ValidatedDashboardData {
  project: Project | null;
  datasets: Dataset[];
  analyses: Analysis[];
}

export function validateDashboardResponse(raw: unknown): ValidationOutcome<ValidatedDashboardData> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed dashboard response payload: expected an object." };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  let project: Project | null = null;
  if (obj.project && typeof obj.project === "object" && !Array.isArray(obj.project)) {
    const p = obj.project as Record<string, unknown>;
    if (typeof p.id === "string" && p.id.trim()) {
      project = {
        id: p.id,
        name: typeof p.name === "string" ? p.name : "SciAI Workspace Project",
        description: typeof p.description === "string" ? p.description : undefined,
        created_at: typeof p.created_at === "string" ? p.created_at : undefined,
      };
    }
  }

  if (!project) {
    return { success: false, data: null, error: "Dashboard response missing valid project entity." };
  }

  const datasets: Dataset[] = [];
  if (Array.isArray(obj.datasets)) {
    for (const d of obj.datasets) {
      if (d && typeof d === "object" && typeof d.id === "string" && d.id.trim()) {
        datasets.push({
          id: d.id,
          name: typeof d.name === "string" ? d.name : `Dataset ${d.id}`,
          description: typeof d.description === "string" ? d.description : undefined,
          source: typeof d.source === "string" ? d.source : undefined,
          database_type: typeof d.database_type === "string" ? d.database_type : undefined,
          record_count: typeof d.record_count === "number" && !isNaN(d.record_count) ? d.record_count : 0,
          created_at: typeof d.created_at === "string" ? d.created_at : undefined,
          status: typeof d.status === "string" ? d.status : "ready",
        });
      }
    }
  }

  const analyses: Analysis[] = [];
  if (Array.isArray(obj.analyses)) {
    for (const a of obj.analyses) {
      const validated = validateSingleAnalysis(a);
      if (validated) {
        analyses.push(validated);
      }
    }
  }

  return {
    success: true,
    data: {
      project,
      datasets,
      analyses,
    },
  };
}

export function validateCapabilitiesResponse(raw: unknown): Capability[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Capability =>
      Boolean(c) && typeof c === "object" && typeof (c as Record<string, unknown>).name === "string"
  );
}

// -------------------------------------------------------------
// 2. Analysis Execution & Record Validation
// -------------------------------------------------------------
export function validateSingleAnalysis(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;

  if (typeof a.id !== "string" || !a.id.trim()) return null;

  const resultObj = a.result && typeof a.result === "object" && !Array.isArray(a.result)
    ? (a.result as Record<string, unknown>)
    : {};

  const cleanRecords: ResultRecord[] = [];
  if (Array.isArray(resultObj.records)) {
    for (const r of resultObj.records) {
      if (r && typeof r === "object" && !Array.isArray(r)) {
        cleanRecords.push(r as ResultRecord);
      }
    }
  }

  const scalarEntries: Array<[string, unknown]> = [];
  if (Array.isArray(resultObj.scalarEntries)) {
    for (const item of resultObj.scalarEntries) {
      if (Array.isArray(item) && item.length >= 2 && typeof item[0] === "string") {
        scalarEntries.push([item[0], item[1]]);
      }
    }
  }

  const metadata = resultObj.metadata && typeof resultObj.metadata === "object" && !Array.isArray(resultObj.metadata)
    ? (resultObj.metadata as Record<string, unknown>)
    : {};

  return {
    id: a.id,
    project_id: typeof a.project_id === "string" ? a.project_id : undefined,
    dataset_id: typeof a.dataset_id === "string" ? a.dataset_id : undefined,
    dataset_version_id: typeof a.dataset_version_id === "string" ? a.dataset_version_id : undefined,
    capability_id: typeof a.capability_id === "string" ? a.capability_id : undefined,
    analysis_type: typeof a.analysis_type === "string" ? a.analysis_type : undefined,
    name: typeof a.name === "string" ? a.name : undefined,
    status: typeof a.status === "string" ? a.status : "completed",
    created_at: typeof a.created_at === "string" ? a.created_at : undefined,
    result: {
      records: cleanRecords,
      scalarEntries,
      metadata,
      ai_interpretation: typeof resultObj.ai_interpretation === "string" ? resultObj.ai_interpretation : undefined,
    },
  };
}

export function validateAnalysisRunResponse(raw: unknown): ValidationOutcome<Analysis> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed analysis execution response payload: expected an object." };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  const validated = validateSingleAnalysis(raw);
  if (!validated) {
    return { success: false, data: null, error: "Analysis execution response is missing mandatory 'id' or has corrupt structure." };
  }

  return { success: true, data: validated };
}

// -------------------------------------------------------------
// 3. Dataset Versions, Health, & Documents
// -------------------------------------------------------------
export function validateVersionsList(raw: unknown): DatasetVersion[] {
  if (!Array.isArray(raw)) return [];
  const list: DatasetVersion[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.dataset_id === "string" &&
      typeof item.version === "number" &&
      !isNaN(item.version)
    ) {
      list.push({
        id: item.id,
        dataset_id: item.dataset_id,
        version: item.version,
        version_number: typeof item.version_number === "number" ? item.version_number : item.version,
        record_count: typeof item.record_count === "number" && !isNaN(item.record_count) ? item.record_count : 0,
        status: typeof item.status === "string" ? item.status : "ready",
        created_at: typeof item.created_at === "string" ? item.created_at : undefined,
        metadata: item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {},
      });
    }
  }
  return list;
}

export interface ValidatedDatasetHealth {
  level_1_score: number;
  level_2_score: number;
  level_3_score: number;
  field_completeness: Record<string, number>;
}

export function validateDatasetHealth(raw: unknown): ValidatedDatasetHealth | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const l1 = typeof obj.level_1_score === "number" && !isNaN(obj.level_1_score) ? obj.level_1_score : null;
  const l2 = typeof obj.level_2_score === "number" && !isNaN(obj.level_2_score) ? obj.level_2_score : null;
  const l3 = typeof obj.level_3_score === "number" && !isNaN(obj.level_3_score) ? obj.level_3_score : null;

  if (l1 === null && l2 === null && l3 === null) return null;

  const completeness: Record<string, number> = {};
  if (obj.field_completeness && typeof obj.field_completeness === "object" && !Array.isArray(obj.field_completeness)) {
    for (const [k, v] of Object.entries(obj.field_completeness)) {
      if (typeof v === "number" && !isNaN(v)) {
        completeness[k] = v;
      }
    }
  }

  return {
    level_1_score: l1 ?? 0,
    level_2_score: l2 ?? 0,
    level_3_score: l3 ?? 0,
    field_completeness: completeness,
  };
}

export function validateDocumentsList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object");
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.documents)) {
      return obj.documents.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object");
    }
    if (Array.isArray(obj.records)) {
      return obj.records.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object");
    }
  }
  return [];
}

// -------------------------------------------------------------
// 4. Machine Learning & GNN Validation
// -------------------------------------------------------------
export interface ValidatedGnnData {
  architecture: string;
  hyperparameters: {
    epochs: number;
    hiddenDim: number;
    learningRate: number;
    dropout: number;
    optimizer: string;
    activation: string;
  };
  trainingMetrics: {
    finalLoss: number;
    rocAuc: number;
    averagePrecision: number;
    meanReciprocalRank: number;
    convergenceEpoch: number;
  };
  nodeEmbeddings: Array<{
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    communityGNN: number;
    communityLouvain: number;
    disruptionScore: number;
    citations: number;
  }>;
  predictedLinks: Array<{
    id: string;
    source: string;
    target: string;
    predictedProbability: number;
    topologicalDistance: number;
    epistemicNovelty: string;
    sharedLatentDim: string[];
    mechanism: string;
  }>;
  attentionPairs: Array<{
    source: string;
    target: string;
    alpha: number;
    citationCount: number;
    type: string;
  }>;
}

export function validateGnnResponse(raw: unknown): ValidationOutcome<ValidatedGnnData> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed GNN response payload: expected an object." };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  // Validate trainingMetrics
  const metrics = obj.trainingMetrics;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return { success: false, data: null, error: "GNN response missing required 'trainingMetrics' object." };
  }
  const m = metrics as Record<string, unknown>;
  const rocAuc = typeof m.rocAuc === "number" && !isNaN(m.rocAuc) ? m.rocAuc : null;
  const finalLoss = typeof m.finalLoss === "number" && !isNaN(m.finalLoss) ? m.finalLoss : null;
  const meanReciprocalRank = typeof m.meanReciprocalRank === "number" && !isNaN(m.meanReciprocalRank) ? m.meanReciprocalRank : null;

  if (rocAuc === null || finalLoss === null || meanReciprocalRank === null) {
    return { success: false, data: null, error: "GNN training metrics contain invalid or null numeric values." };
  }

  // Validate nodeEmbeddings
  if (!Array.isArray(obj.nodeEmbeddings)) {
    return { success: false, data: null, error: "GNN response missing 'nodeEmbeddings' array." };
  }
  const cleanNodes = [];
  for (const n of obj.nodeEmbeddings) {
    if (n && typeof n === "object" && typeof n.id === "string" && typeof n.name === "string") {
      cleanNodes.push({
        id: n.id,
        name: n.name,
        type: typeof n.type === "string" ? n.type : "topic",
        x: typeof n.x === "number" && !isNaN(n.x) ? n.x : 0,
        y: typeof n.y === "number" && !isNaN(n.y) ? n.y : 0,
        communityGNN: typeof n.communityGNN === "number" ? n.communityGNN : 1,
        communityLouvain: typeof n.communityLouvain === "number" ? n.communityLouvain : 1,
        disruptionScore: typeof n.disruptionScore === "number" ? n.disruptionScore : 0.5,
        citations: typeof n.citations === "number" ? n.citations : 0,
      });
    }
  }

  if (cleanNodes.length === 0) {
    return { success: false, data: null, error: "GNN response contains an empty or invalid 'nodeEmbeddings' set." };
  }

  // Validate predictedLinks
  const cleanLinks = [];
  if (Array.isArray(obj.predictedLinks)) {
    for (const l of obj.predictedLinks) {
      if (l && typeof l === "object" && typeof l.source === "string" && typeof l.target === "string") {
        cleanLinks.push({
          id: typeof l.id === "string" ? l.id : `link-${cleanLinks.length}`,
          source: l.source,
          target: l.target,
          predictedProbability: typeof l.predictedProbability === "number" ? l.predictedProbability : 0,
          topologicalDistance: typeof l.topologicalDistance === "number" ? l.topologicalDistance : 1,
          epistemicNovelty: typeof l.epistemicNovelty === "string" ? l.epistemicNovelty : "Emergent",
          sharedLatentDim: Array.isArray(l.sharedLatentDim) ? l.sharedLatentDim.map(String) : [],
          mechanism: typeof l.mechanism === "string" ? l.mechanism : "",
        });
      }
    }
  }

  // Validate attentionPairs
  const cleanAttention = [];
  if (Array.isArray(obj.attentionPairs)) {
    for (const a of obj.attentionPairs) {
      if (a && typeof a === "object" && typeof a.source === "string" && typeof a.target === "string") {
        cleanAttention.push({
          source: a.source,
          target: a.target,
          alpha: typeof a.alpha === "number" ? a.alpha : 0,
          citationCount: typeof a.citationCount === "number" ? a.citationCount : 0,
          type: typeof a.type === "string" ? a.type : "Interaction",
        });
      }
    }
  }

  const h = (obj.hyperparameters && typeof obj.hyperparameters === "object" && !Array.isArray(obj.hyperparameters))
    ? (obj.hyperparameters as Record<string, unknown>)
    : {};

  return {
    success: true,
    data: {
      architecture: typeof obj.architecture === "string" ? obj.architecture : "GNN-Architect",
      hyperparameters: {
        epochs: typeof h.epochs === "number" ? h.epochs : 50,
        hiddenDim: typeof h.hiddenDim === "number" ? h.hiddenDim : 64,
        learningRate: typeof h.learningRate === "number" ? h.learningRate : 0.005,
        dropout: typeof h.dropout === "number" ? h.dropout : 0.2,
        optimizer: typeof h.optimizer === "string" ? h.optimizer : "AdamW",
        activation: typeof h.activation === "string" ? h.activation : "LeakyReLU",
      },
      trainingMetrics: {
        finalLoss,
        rocAuc,
        averagePrecision: typeof m.averagePrecision === "number" ? m.averagePrecision : rocAuc,
        meanReciprocalRank,
        convergenceEpoch: typeof m.convergenceEpoch === "number" ? m.convergenceEpoch : 30,
      },
      nodeEmbeddings: cleanNodes,
      predictedLinks: cleanLinks,
      attentionPairs: cleanAttention,
    },
  };
}

export interface ValidatedSimResult {
  predicted_probability: number;
  percentile_rank: number;
  predicted_tier: string;
  is_high_impact: boolean;
  attributions: Array<{ feature: string; impactPct: number; rawScore: number }>;
}

export function validatePredictSimulatorResponse(raw: unknown): ValidationOutcome<ValidatedSimResult> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed simulator response: expected object." };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  const prob = typeof obj.predicted_probability === "number" && !isNaN(obj.predicted_probability)
    ? obj.predicted_probability
    : null;
  const rank = typeof obj.percentile_rank === "number" && !isNaN(obj.percentile_rank)
    ? obj.percentile_rank
    : null;
  const tier = typeof obj.predicted_tier === "string" && obj.predicted_tier.trim()
    ? obj.predicted_tier
    : null;

  if (prob === null || rank === null || tier === null) {
    return { success: false, data: null, error: "Simulator response is missing mandatory probability, rank, or tier values." };
  }

  const attributions: Array<{ feature: string; impactPct: number; rawScore: number }> = [];
  if (Array.isArray(obj.attributions)) {
    for (const item of obj.attributions) {
      if (item && typeof item === "object" && typeof item.feature === "string") {
        attributions.push({
          feature: item.feature,
          impactPct: typeof item.impactPct === "number" && !isNaN(item.impactPct) ? item.impactPct : 0,
          rawScore: typeof item.rawScore === "number" && !isNaN(item.rawScore) ? item.rawScore : 0,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      predicted_probability: prob,
      percentile_rank: rank,
      predicted_tier: tier,
      is_high_impact: Boolean(obj.is_high_impact),
      attributions,
    },
  };
}

// -------------------------------------------------------------
// 5. Historical & Thematic Validation
// -------------------------------------------------------------
export function validateHistCiteResponse(raw: unknown): ValidationOutcome<HistCiteOutput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed HistCite response payload." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.nodes)) {
    return { success: false, data: null, error: "HistCite response missing mandatory 'nodes' array." };
  }

  const cleanNodes = [];
  for (const n of obj.nodes) {
    if (n && typeof n === "object" && typeof n.id === "string") {
      cleanNodes.push({
        id: n.id,
        nodeIndex: typeof n.nodeIndex === "number" ? n.nodeIndex : 0,
        title: typeof n.title === "string" ? n.title : "Untitled Document",
        firstAuthor: typeof n.firstAuthor === "string" ? n.firstAuthor : "Unknown Author",
        year: typeof n.year === "number" ? n.year : 2020,
        source: typeof n.source === "string" ? n.source : "Corpus Publication",
        doi: typeof n.doi === "string" ? n.doi : undefined,
        lcs: typeof n.lcs === "number" ? n.lcs : 0,
        gcs: typeof n.gcs === "number" ? n.gcs : 0,
        crCount: typeof n.crCount === "number" ? n.crCount : 0,
        isRootAncestor: Boolean(n.isRootAncestor),
        isTerminalNode: Boolean(n.isTerminalNode),
        isMainPath: Boolean(n.isMainPath),
        clusterId: typeof n.clusterId === "number" ? n.clusterId : 1,
        abstractSnippet: typeof n.abstractSnippet === "string" ? n.abstractSnippet : undefined,
        citedNodes: Array.isArray(n.citedNodes) ? n.citedNodes.map(String) : [],
        citingNodes: Array.isArray(n.citingNodes) ? n.citingNodes.map(String) : [],
      });
    }
  }

  const cleanLinks = [];
  if (Array.isArray(obj.links)) {
    for (const l of obj.links) {
      if (l && typeof l === "object" && typeof l.source === "string" && typeof l.target === "string") {
        cleanLinks.push({
          source: l.source,
          target: l.target,
          isMainPath: Boolean(l.isMainPath),
          weight: typeof l.weight === "number" ? l.weight : 1,
          yearDelta: typeof l.yearDelta === "number" ? l.yearDelta : 0,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      dataset_id: typeof obj.dataset_id === "string" ? obj.dataset_id : "",
      dataset_name: typeof obj.dataset_name === "string" ? obj.dataset_name : "Bibliographic Corpus",
      total_documents: typeof obj.total_documents === "number" ? obj.total_documents : cleanNodes.length,
      total_internal_citations: typeof obj.total_internal_citations === "number" ? obj.total_internal_citations : cleanLinks.length,
      connected_nodes_count: typeof obj.connected_nodes_count === "number" ? obj.connected_nodes_count : cleanNodes.length,
      nodes: cleanNodes,
      links: cleanLinks,
      main_path_nodes: Array.isArray(obj.main_path_nodes) ? obj.main_path_nodes.map(String) : [],
      top_lcs_papers: Array.isArray(obj.top_lcs_papers) ? (obj.top_lcs_papers as any) : [],
      yearly_timeline: Array.isArray(obj.yearly_timeline) ? (obj.yearly_timeline as any) : [],
    },
  };
}

export function validateRPYSResponse(raw: unknown): ValidationOutcome<RPYSOutput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed RPYS response payload." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.spectroscopy_points)) {
    return { success: false, data: null, error: "RPYS response missing mandatory 'spectroscopy_points' array." };
  }

  const cleanPoints = [];
  for (const p of obj.spectroscopy_points) {
    if (p && typeof p === "object" && typeof p.year === "number") {
      cleanPoints.push({
        year: p.year,
        citedReferencesCount: typeof p.citedReferencesCount === "number" ? p.citedReferencesCount : 0,
        median5YearNCR: typeof p.median5YearNCR === "number" ? p.median5YearNCR : 0,
        deviation: typeof p.deviation === "number" ? p.deviation : 0,
        isPeak: Boolean(p.isPeak),
        peakSignificance: (p.peakSignificance as any) || "none",
        breakoutWorks: Array.isArray(p.breakoutWorks) ? (p.breakoutWorks as any) : [],
      });
    }
  }

  return {
    success: true,
    data: {
      dataset_id: typeof obj.dataset_id === "string" ? obj.dataset_id : "",
      dataset_name: typeof obj.dataset_name === "string" ? obj.dataset_name : "Corpus RPYS",
      time_span: (obj.time_span as any) || { min_year: 2000, max_year: 2024, total_span: 24 },
      total_cited_references: typeof obj.total_cited_references === "number" ? obj.total_cited_references : 0,
      historical_breakout_years: Array.isArray(obj.historical_breakout_years) ? (obj.historical_breakout_years as number[]) : [],
      spectroscopy_points: cleanPoints,
      milestone_breakouts: Array.isArray(obj.milestone_breakouts) ? (obj.milestone_breakouts as any) : [],
    },
  };
}

export const validateRpysResponse = validateRPYSResponse;

export function validateThematicEvolutionResponse(raw: unknown): ValidationOutcome<ThematicEvolutionOutput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, data: null, error: "Malformed Thematic Evolution payload." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.periods) || !Array.isArray(obj.nodes) || !Array.isArray(obj.links)) {
    return { success: false, data: null, error: "Thematic Evolution missing required periods, nodes, or links structures." };
  }

  const cleanPeriods = [];
  for (const p of obj.periods) {
    if (p && typeof p === "object" && typeof p.periodIndex === "number") {
      cleanPeriods.push({
        periodIndex: p.periodIndex,
        label: typeof p.label === "string" ? p.label : `Period ${p.periodIndex + 1}`,
        startYear: typeof p.startYear === "number" ? p.startYear : 2000,
        endYear: typeof p.endYear === "number" ? p.endYear : 2024,
        documentCount: typeof p.documentCount === "number" ? p.documentCount : 0,
        themeCount: typeof p.themeCount === "number" ? p.themeCount : 0,
      });
    }
  }

  const cleanNodes = [];
  for (const n of obj.nodes) {
    if (n && typeof n === "object" && typeof n.id === "string" && typeof n.periodIndex === "number") {
      cleanNodes.push({
        id: n.id,
        name: typeof n.name === "string" ? n.name : "Theme",
        periodIndex: n.periodIndex,
        periodLabel: typeof n.periodLabel === "string" ? n.periodLabel : `Period ${n.periodIndex + 1}`,
        documentCount: typeof n.documentCount === "number" ? n.documentCount : 0,
        topKeywords: Array.isArray(n.topKeywords) ? n.topKeywords.map(String) : [],
        centrality: typeof n.centrality === "number" ? n.centrality : 0,
        density: typeof n.density === "number" ? n.density : 0,
        totalCitations: typeof n.totalCitations === "number" ? n.totalCitations : 0,
        rawCentrality: typeof n.rawCentrality === "number" ? n.rawCentrality : 0,
        rawDensity: typeof n.rawDensity === "number" ? n.rawDensity : 0,
        quadrant: (n.quadrant as any) || "Motor Themes",
        quadrantCode: (n.quadrantCode as any) || "Q1",
        clusterSize: typeof n.clusterSize === "number" ? n.clusterSize : 1,
      });
    }
  }

  return {
    success: true,
    data: {
      periods: cleanPeriods,
      nodes: cleanNodes,
      links: obj.links as any,
      summary: (obj.summary as any) || {
        totalPeriods: cleanPeriods.length,
        totalThemes: cleanNodes.length,
        totalLinks: Array.isArray(obj.links) ? obj.links.length : 0,
        yearSpan: "Multi-year",
        totalDocuments: 0,
        averageStability: 0,
        continuationsCount: 0,
        splitsCount: 0,
        mergesCount: 0,
      },
      transitionMatrix: Array.isArray(obj.transitionMatrix) ? (obj.transitionMatrix as any) : [],
    },
  };
}

// -------------------------------------------------------------
// 6. AI Responses Validation (Ensuring incomplete answers are flagged)
// -------------------------------------------------------------
export function validateAiInterpretationResponse(raw: unknown): AIResponseOutcome<string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "AI interpretation response is invalid or missing." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  const interpretation = typeof obj.interpretation === "string" ? obj.interpretation.trim() : "";
  if (!interpretation) {
    return { success: false, isComplete: false, data: null, error: "AI interpretation was returned empty or incomplete." };
  }

  const isPartial = Boolean(obj.isPartial || interpretation.length < 40);
  return {
    success: true,
    isComplete: !isPartial,
    isPartial,
    data: interpretation,
  };
}

export function validateRagChatResponse(raw: unknown): AIResponseOutcome<string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Failed to receive valid synthesis from AI assistant." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  if (!answer) {
    return { success: false, isComplete: false, data: null, error: "AI generated an empty response." };
  }

  const isPartial = Boolean(
    obj.isPartial ||
    obj.partial ||
    answer.includes("[truncated]") ||
    answer.includes("[partial]") ||
    answer.length < 20
  );

  return {
    success: true,
    isComplete: !isPartial,
    isPartial,
    data: answer,
  };
}

export function validateResearchGapsResponse(raw: unknown): AIResponseOutcome<any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Invalid research gaps response." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.gaps) || obj.gaps.length === 0) {
    return {
      success: true,
      isComplete: false,
      isPartial: true,
      data: obj,
      error: "AI returned no identified gaps for this corpus.",
    };
  }

  return { success: true, isComplete: true, data: obj };
}

export function validateManuscriptSectionResponse(raw: unknown): AIResponseOutcome<string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Malformed manuscript generation response." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!content) {
    return { success: false, isComplete: false, data: null, error: "Generated manuscript section is empty." };
  }

  return { success: true, isComplete: true, data: content };
}

export function validateCitationContextResponse(raw: unknown): AIResponseOutcome<any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Invalid citation intent response." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  if (typeof obj.sentiment_summary !== "string" || !Array.isArray(obj.exemplar_analyses)) {
    return {
      success: false,
      isComplete: false,
      data: null,
      error: "Incomplete citation intent breakdown received from AI.",
    };
  }

  return { success: true, isComplete: true, data: obj };
}

export function validateResearchGapMatrixResponse(raw: unknown): AIResponseOutcome<ResearchGapMatrixOutput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Invalid research gap matrix response." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.proposals) || obj.proposals.length === 0) {
    return {
      success: false,
      isComplete: false,
      data: null,
      error: "Research gap matrix returned zero proposals.",
    };
  }

  return { success: true, isComplete: true, data: obj as unknown as ResearchGapMatrixOutput };
}

export function validateCorpusDiscrepancyResponse(raw: unknown): AIResponseOutcome<MultiCorpusDiscrepancyOutput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, isComplete: false, data: null, error: "Invalid multi-corpus discrepancy response." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.error && typeof obj.error === "string") {
    return { success: false, isComplete: false, data: null, error: obj.error };
  }

  if (!Array.isArray(obj.databaseMetrics) || !obj.vennIntersections) {
    return {
      success: false,
      isComplete: false,
      data: null,
      error: "Multi-corpus discrepancy metrics are incomplete.",
    };
  }

  return { success: true, isComplete: true, data: obj as unknown as MultiCorpusDiscrepancyOutput };
}

// -------------------------------------------------------------
// 7. Chart Data & Visualizer Validation
// -------------------------------------------------------------
export interface ChartValidationResult {
  hasValidData: boolean;
  validRecordCount: number;
  reason?: string;
}

export function validateChartRecords(capabilityId: string, records: ResultRecord[] | null | undefined): ChartValidationResult {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return { hasValidData: false, validRecordCount: 0, reason: "No records found for visual analysis." };
  }

  // Capability-specific sanity checking for renderable points
  if (capabilityId === "publication.year_distribution") {
    const valid = records.filter((r) => (r.year || r.name) && (Number(r.documents || r.count || 0) > 0 || r.year));
    return {
      hasValidData: valid.length > 0,
      validRecordCount: valid.length,
      reason: valid.length === 0 ? "No valid publication timeline or annual counts detected in records." : undefined,
    };
  }

  if (capabilityId === "author.productivity_lotka") {
    const valid = records.filter((r) => r.author || r.name || r.documents);
    return {
      hasValidData: valid.length > 0,
      validRecordCount: valid.length,
      reason: valid.length === 0 ? "No author productivity or Lotka distribution records available." : undefined,
    };
  }

  if (capabilityId === "source.bradford_zones") {
    const valid = records.filter((r) => r.source || r.journal || r.name);
    return {
      hasValidData: valid.length > 0,
      validRecordCount: valid.length,
      reason: valid.length === 0 ? "No journal sources identified for Bradford zones." : undefined,
    };
  }

  if (capabilityId === "citation.citation_distribution") {
    const valid = records.filter((r) => r.citations !== undefined || r.count !== undefined || r.documents !== undefined);
    return {
      hasValidData: valid.length > 0,
      validRecordCount: valid.length,
      reason: valid.length === 0 ? "No citation distribution points available." : undefined,
    };
  }

  // Generic check: ensure at least one record has a usable key
  const valid = records.filter((r) => r && typeof r === "object" && Object.keys(r).length > 0);
  return {
    hasValidData: valid.length > 0,
    validRecordCount: valid.length,
    reason: valid.length === 0 ? "Records array contains empty or invalid objects." : undefined,
  };
}


