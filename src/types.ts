export interface Project {
  id: string;
  name?: string;
  description?: string;
  created_at?: string;
}

export interface Dataset {
  id: string;
  project_id?: string;
  name?: string;
  description?: string;
  source?: string;
  database_type?: string;
  record_count?: number;
  created_at?: string;
  status?: string;
  file_path?: string;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version: number;
  version_number?: number;
  record_count: number;
  document_count?: number;
  storage_path?: string;
  storage_uri?: string;
  created_at?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityProvider {
  name?: string;
  package?: string;
  version?: string;
  capability?: string;
  priority?: number;
  available?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Capability {
  name: string;
  description?: string;
  providers?: CapabilityProvider[];
}

export type AuthorCountingMode = "whole" | "fractional";

export type CitationMetricCategory =
  | "raw/observed"
  | "calculated"
  | "citation-window-adjusted"
  | "year-normalized"
  | "unavailable";

export type CitationWindowMode = "raw" | "window_adjusted";

export interface CitationWindowResult {
  status: "completed" | "unavailable";
  category: CitationMetricCategory;
  metric_name: string;
  raw_total_citations: number;
  raw_mean_citations_per_paper: number;
  raw_citations_per_paper: number; // backward compatibility alias
  window_adjusted_mean_velocity?: number | null;
  weighted_corpus_velocity?: number | null;
  observation_year?: number | null;
  publication_basis: string;
  denominator_definition: string;
  min_window_years: number;
  max_window_years: number;
  eligible_records: number;
  excluded_records: number;
  exclusion_reasons: Record<string, number>;
  limitations: string;
  method_version: string;
  unavailable_reason?: string;
  per_document_metrics?: Array<{
    id: string;
    title: string;
    year: number;
    raw_citations: number;
    window_years: number;
    annual_citation_rate: number;
  }>;
}

export interface Analysis {
  id: string;
  project_id?: string;
  dataset_id?: string;
  dataset_version_id?: string;
  analysis_type?: string;
  capability_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  parameters?: Record<string, unknown>;
  result?: {
    status?: string;
    capability?: string;
    provider?: string;
    package?: string;
    package_version?: string;
    parameters?: Record<string, unknown>;
    records?: ResultRecord[];
    count?: number;
    scalarEntries?: Array<[string, unknown]>;
    metadata?: Record<string, unknown>;
    ai_interpretation?: string;
    [key: string]: unknown;
  };
}

export type ResultRecord = Record<string, unknown>;

export interface DashboardResponse {
  project?: Project;
  datasets?: Dataset[];
  analyses?: Analysis[];
  capabilities_count?: number;
  total_documents?: number;
  [key: string]: unknown;
}

export type DatabaseSource = "WoS" | "Scopus" | "PubMed" | "OpenAlex" | "Dimensions" | "Lens" | "Generic";

export interface CanonicalDocument {
  id: string;
  UT?: string; // WoS Accession, Scopus EID, OpenAlex ID, Lens ID, etc.
  AU?: string[]; // Normalized authors
  TI?: string; // Document title
  SO?: string; // Source/Journal name
  DE?: string[]; // Author keywords
  ID?: string[]; // Index/Keywords Plus / MeSH / Concepts
  AB?: string; // Abstract
  C1?: string[]; // Affiliations/Addresses
  CR?: string[]; // Cited References
  TC?: number; // Times Cited
  PY?: number; // Publication Year
  SC?: string[]; // Subject Categories / Field of Research
  DB?: DatabaseSource; // Origin Database
  DOI?: string; // Clean normalized DOI
  ORCID?: string[]; // ORCID identifiers
  PMID?: string; // PubMed ID
  volume?: string;
  issue?: string;
  pages?: string;
  document_type?: string;
  language?: string;
  raw_sources?: DatabaseSource[]; // Track all contributing databases after merge
  merge_confidence?: number;
  merge_match_rule?: string;
  // Funding & Grants intelligence (WoS FU/FX & Scopus Funding)
  FU?: string[]; // Funding Agency and Grant Number (WoS FU or Scopus Funding details)
  FX?: string; // Funding Text / narrative acknowledgements (WoS FX or Scopus)
  funding_agencies?: string[]; // Standardized funding organizations (e.g. NSF, NIH, ERC)
  grant_numbers?: string[]; // Extracted grant / award numbers
  funding_text?: string; // Full narrative funding acknowledgement
  // Institutional affiliations intelligence (WoS C1/RP & Scopus Affiliations)
  affiliations?: string[]; // Raw affiliation strings
  institutions?: string[]; // Standardized universities, research institutes, hospitals
  reprint_address?: string; // Corresponding author address
  countries?: string[]; // Countries associated with the document
}

export interface BibliometricDocument extends CanonicalDocument {
  title: string;
  authors: string[];
  year: number;
  source: string;
  citations: number;
  keywords: string[];
  abstract?: string;
  doi?: string;
  affiliations?: string[];
  institutions?: string[];
  funding_agencies?: string[];
  grant_numbers?: string[];
  funding_text?: string;
  reprint_address?: string;
  countries?: string[];
  country?: string;
}

export interface DataHealthMetrics {
  overall_score: number; // 0 - 100 weighted index
  level_1_score: number; // Weight 3: AU, PY, SO, TC, CR
  level_2_score: number; // Weight 2: TI, DE/ID, C1/Affiliations
  level_3_score: number; // Weight 1: AB, SC, DOI, Document Type
  field_completeness: {
    authors: number;
    year: number;
    source: number;
    citations: number;
    references: number;
    title: number;
    keywords: number;
    affiliations: number;
    abstract: number;
    doi: number;
    categories: number;
  };
  total_records: number;
  database_distribution: Record<string, number>;
}

export interface MergeAuditEntry {
  canonical_id: string;
  title: string;
  matched_rule: "EXACT_DOI" | "EXACT_PMID" | "JARO_WINKLER_FUZZY" | "EXACT_ACCESSION";
  confidence: number;
  contributing_databases: DatabaseSource[];
  doi?: string;
  pmid?: string;
  records_merged_count: number;
  timestamp: string;
}

export interface BorderlineMatch {
  id: string;
  candidate_a: CanonicalDocument;
  candidate_b: CanonicalDocument;
  similarity_score: number;
  conflict_field?: string;
  reason: string;
}

export interface SmartMergeSummary {
  merged_dataset_id: string;
  total_raw_inputs: number;
  duplicates_resolved: number;
  final_unique_count: number;
  reduction_percentage: number;
  databases_included: DatabaseSource[];
  sources_breakdown: Record<string, number>;
  overlap_breakdown: {
    single_source_only: number;
    two_sources: number;
    three_or_more_sources: number;
  };
  audit_log: MergeAuditEntry[];
  borderline_queue: BorderlineMatch[];
  methodology_narrative: string;
  data_health: DataHealthMetrics;
  merged_documents?: CanonicalDocument[];
}

export interface ThematicPeriod {
  index: number;
  label: string;
  startYear: number;
  endYear: number;
  docCount: number;
  themeCount: number;
  stabilityWithNext?: number;
}

export interface ThematicThemeNode {
  id: string;
  periodIndex: number;
  periodLabel: string;
  name: string;
  keywords: string[];
  docCount: number;
  totalCitations: number;
  rawCentrality: number;
  rawDensity: number;
  quadrant: "Motor Themes" | "Niche Themes" | "Emerging/Declining Themes" | "Basic Themes";
  quadrantCode: "Q1" | "Q2" | "Q3" | "Q4";
  clusterSize: number;
}

export interface ThematicFlowLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePeriod: number;
  targetPeriod: number;
  sourceThemeName: string;
  targetThemeName: string;
  inclusionIndex: number;
  jaccardIndex: number;
  sharedKeywords: string[];
  weight: number;
  trajectory: "continuation" | "splitting" | "merging" | "emerging" | "fading";
  trajectoryLabel: string;
}

export interface ThematicEvolutionOutput {
  periods: ThematicPeriod[];
  nodes: ThematicThemeNode[];
  links: ThematicFlowLink[];
  summary: {
    totalPeriods: number;
    totalThemes: number;
    totalLinks: number;
    yearSpan: string;
    totalDocuments: number;
    averageStability: number;
    continuationsCount: number;
    splitsCount: number;
    mergesCount: number;
  };
  transitionMatrix: Array<{
    sourcePeriod: string;
    sourceTheme: string;
    targetPeriod: string;
    targetTheme: string;
    inclusionIndex: number;
    sharedKeywords: string[];
    trajectory: string;
  }>;
}

export interface SlicingOptions {
  sliceCount?: number;
  customCuts?: number[];
  minKeywordFreq?: number;
  inclusionThreshold?: number;
  maxThemesPerSlice?: number;
}

// -------------------------------------------------------------
// Statistical Text Classification & Stratified K-Fold CV [761]
// -------------------------------------------------------------
export type StatisticalClassifierType =
  | "logistic_regression"
  | "random_forest"
  | "naive_bayes"
  | "linear_svm";

export interface ClassEvaluationMetrics {
  className: string;
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface FoldEvaluationResult {
  foldIndex: number;
  trainCount: number;
  valCount: number;
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  confusionMatrix: number[][]; // actual rows x predicted cols
  classLabels: string[];
}

export interface ModelBenchmarkResult {
  modelType: StatisticalClassifierType;
  displayName: string;
  family: string;
  algorithmSummary: string;
  meanAccuracy: number;
  stdAccuracy: number;
  meanMacroF1: number;
  stdMacroF1: number;
  meanWeightedF1: number;
  meanPrecision: number;
  meanRecall: number;
  trainingTimeMs: number;
  folds: FoldEvaluationResult[];
  overallConfusionMatrix: number[][];
  classMetrics: ClassEvaluationMetrics[];
}

export interface DistinctiveFeature {
  feature: string;
  compositeScore: number; // 0 - 100
  targetClass: string;
  oddsRatio: number;
  inClassRatioPct: number;
  outClassRatioPct: number;
  logisticWeight: number;
  randomForestImportance: number;
  naiveBayesLLR: number;
  svmWeight: number;
  sampleTitles: string[];
}

export interface TextClassificationOutput {
  targetType: "temporal_period" | "research_theme" | "impact_velocity";
  targetDescription: string;
  classes: string[];
  kFolds: number;
  vocabularySize: number;
  totalDocuments: number;
  benchmarks: Record<StatisticalClassifierType, ModelBenchmarkResult>;
  bestModel: StatisticalClassifierType;
  distinctiveFeaturesByClass: Record<string, DistinctiveFeature[]>;
  allRankedFeatures: DistinctiveFeature[];
  sampleEvaluations: Array<{
    id: string;
    title: string;
    actualClass: string;
    predictedByModel: Record<StatisticalClassifierType, string>;
    confidenceByModel: Record<StatisticalClassifierType, number>;
  }>;
}

// ================= HISTORICAL & GENEALOGY (HISTCITE & RPYS) =================
export interface HistCiteNode {
  id: string;
  nodeIndex: number;
  title: string;
  firstAuthor: string;
  year: number;
  source: string;
  doi?: string;
  lcs: number; // Local Citation Score
  gcs: number; // Global Citation Score
  crCount: number; // Cited references count
  isRootAncestor?: boolean;
  isTerminalNode?: boolean;
  isMainPath?: boolean;
  clusterId?: number;
  abstractSnippet?: string;
  citedNodes: string[]; // references inside the corpus
  citingNodes: string[]; // citing documents inside the corpus
}

export interface HistCiteLink {
  source: string;
  target: string;
  isMainPath: boolean;
  weight: number;
  yearDelta: number;
}

export interface HistCiteOutput {
  dataset_id: string;
  dataset_name: string;
  total_documents: number;
  total_internal_citations: number;
  connected_nodes_count: number;
  nodes: HistCiteNode[];
  links: HistCiteLink[];
  main_path_nodes: string[];
  top_lcs_papers: Array<{
    id: string;
    title: string;
    authorYear: string;
    lcs: number;
    gcs: number;
    lcsRatio: number;
  }>;
  yearly_timeline: Array<{
    year: number;
    doc_count: number;
    internal_cites: number;
  }>;
}

export interface RPYSSpectroscopyPoint {
  year: number;
  citedReferencesCount: number; // NCR: Number of Cited References
  median5YearNCR: number;
  deviation: number; // Deviation from 5-year running median (positive peak = historical breakout)
  isPeak: boolean;
  peakSignificance: "extreme" | "strong" | "moderate" | "none";
  breakoutWorks: Array<{
    authorYear: string;
    title: string;
    source: string;
    citations: number;
    historicalRole: string;
  }>;
}

export interface RPYSOutput {
  dataset_id: string;
  dataset_name: string;
  time_span: { min_year: number; max_year: number; total_span: number };
  total_cited_references: number;
  historical_breakout_years: number[];
  spectroscopy_points: RPYSSpectroscopyPoint[];
  milestone_breakouts: Array<{
    year: number;
    deviation: number;
    ncr: number;
    significance: string;
    historicalContext: string;
    landmarkCitations: Array<{
      authorYear: string;
      title: string;
      source: string;
      citations: number;
      historicalRole: string;
    }>;
  }>;
}

// ================= GEOGRAPHIC COLLABORATION & WORLD MAP (CHOROPLETH) =================
export interface CountryScientometricProfile {
  country: string;
  isoCode: string;
  lat: number;
  lng: number;
  totalDocs: number;
  totalCitations: number;
  avgCitations: number;
  scpDocs: number; // Single Country Publications
  mcpDocs: number; // Multiple Country Publications (International)
  mcpRatio: number; // MCP / totalDocs (International Collaboration Rate)
  hIndex: number;
  topAffiliations: string[];
  partnerCountries: Array<{ country: string; sharedDocs: number }>;
}

export interface InternationalCollaborationLink {
  sourceCountry: string;
  targetCountry: string;
  sourceCoords: [number, number]; // [lng, lat]
  targetCoords: [number, number]; // [lng, lat]
  collabCount: number;
  saltonIndex: number;
  jaccardIndex: number;
}

export interface GeoCollaborationOutput {
  dataset_id: string;
  dataset_name: string;
  total_documents: number;
  total_international_collaborations: number;
  global_mcp_ratio: number;
  countries: CountryScientometricProfile[];
  collaboration_links: InternationalCollaborationLink[];
  top_collaborative_dyads: Array<{
    countryA: string;
    countryB: string;
    collabCount: number;
    saltonIndex: number;
  }>;
}

// ================= DYNAMICS & FRONTIER DETECTION =================
// 1. Kleinberg's Burst Detection (Jon Kleinberg 2002/2003)
export interface KleinbergBurstItem {
  id: string;
  word: string;
  weight: number; // Burst strength / intensity
  level: number; // Maximum burst state level achieved (1, 2, ...)
  beginYear: number;
  endYear: number;
  duration: number; // endYear - beginYear + 1
  totalOccurrences: number;
  isHotFrontier: boolean; // Burst is active in current / recent year
  yearlyFrequencies: Array<{
    year: number;
    count: number;
    totalDocsInYear: number;
    state: number; // 0 = baseline, 1+ = burst
    rate: number; // frequency ratio
  }>;
}

export interface KleinbergBurstOutput {
  dataset_id: string;
  dataset_name: string;
  total_bursts: number;
  hot_frontiers_count: number;
  time_span: { min_year: number; max_year: number };
  gamma: number; // transition penalty parameter (typically 1.0)
  s: number; // state ratio multiplier (typically 2.0)
  bursts: KleinbergBurstItem[];
  topHotFrontiers: KleinbergBurstItem[];
}

// 2. Sleeping Beauties in Science (van Raan 2004 & Ke et al. 2015 PNAS)
export interface SleepingBeautyItem {
  id: string;
  title: string;
  authors: string[];
  year: number; // Publication year (t0)
  source: string;
  totalCitations: number;
  doi?: string;
  country?: string;

  // van Raan (2004) formulation metrics
  sleepDuration: number; // Sleep years (s) where yearly citation <= threshold
  awakeningYear: number; // Year where citation surge began (t_awake)
  sleepDepth: number; // Average yearly citations during sleep
  awakeningIntensity: number; // Citations in the peak/awakening period
  vanRaanBeautyCoefficient: number; // B_vanRaan = (c_awake * s) / (sleepDepth + 1)

  // Ke et al. (PNAS 2015) parameter-free formulation
  keBeautyCoefficient: number; // B = sum_{t=0}^{t_m} ( l_t - c_t ) / max(1, c_t)
  peakYear: number; // t_m (year of maximum citations)
  peakCitations: number; // c_max

  // Trajectory history for visualization
  citationTrajectory: Array<{
    year: number;
    age: number; // t - t0
    citations: number;
    referenceLineValue: number; // l_t from Ke et al.
    deviation: number;
    phase: "sleep" | "awakening" | "post-awakening";
  }>;

  // Prince Paper (awakening catalyst)
  princeInfo?: {
    potentialPrinceWork: string;
    awakeningContext: string;
    citationJumpFactor: number;
  };
}

export interface SleepingBeautyOutput {
  dataset_id: string;
  dataset_name: string;
  total_analyzed: number;
  total_sleeping_beauties: number;
  min_sleep_years: number;
  beauty_threshold: number;
  time_span: { min_year: number; max_year: number };
  beauties: SleepingBeautyItem[];
  legendaryBeauties: SleepingBeautyItem[]; // Top highest B coefficients
}

export interface FrontierDetectionCombinedOutput {
  burstDetection: KleinbergBurstOutput;
  sleepingBeauties: SleepingBeautyOutput;
  summary: {
    dataset_name: string;
    totalDocuments: number;
    yearSpan: string;
    activeHotFrontiersCount: number;
    topEmergingFrontier: string;
    sleepingBeautiesCount: number;
    mostIconicSleepingBeauty: string;
    highestBeautyCoefficient: number;
  };
}

// ================= ADVANCED AUTHOR IMPACT & INTERACTION (H-FAMILY & LEADERSHIP) =================
export interface AuthorAdvancedImpactProfile {
  author: string;
  totalDocuments: number;
  totalCitations: number;
  avgCitations: number;
  
  // Advanced h-family metrics
  hIndex: number;
  gIndex: number; // Egghe (2006)
  hgIndex: number; // Alonso et al. (2009): geometric mean sqrt(h * g)
  contemporaryHIndex: number; // Sidiropoulos et al. (2007): time-decayed citation weight
  individualHIndex: number; // Batista et al. (2006): h_I = h^2 / total_coauthors
  mQuotient: number; // Hirsch (2005): h / academic_age
  eIndex: number; // Zhang (2009): excess citation energy sqrt(sum(c_i - h^2))
  i10Index: number; // Papers with >= 10 citations

  // Leadership & Role Allocation
  firstAuthorDocs: number; // Count of papers as first author
  firstAuthorShare: number; // Ratio: firstAuthorDocs / totalDocuments
  correspondingAuthorDocs: number; // Count of papers as corresponding/senior author
  correspondingAuthorShare: number; // Ratio: correspondingAuthorDocs / totalDocuments
  middleAuthorDocs: number; // Contributing/middle author papers
  leadershipRatio: number; // (firstAuthorDocs + correspondingAuthorDocs) / totalDocuments
  firstAuthorHIndex: number; // h-index calculated strictly on first-author papers
  leadCitationsRatio: number; // Citations accumulated while in lead roles / total citations

  // Network & Temporal
  careerSpanYears: number;
  firstPubYear: number;
  latestPubYear: number;
  topCoauthors: Array<{ name: string; jointCount: number }>;
  primaryAffiliation?: string;
  isHighImpactLeader: boolean; // Top-tier leadership score with high hg-index
}

export interface AuthorAdvancedImpactOutput {
  dataset_id: string;
  dataset_name: string;
  total_authors: number;
  current_year: number;
  authors: AuthorAdvancedImpactProfile[];
  summary: {
    max_h_index: number;
    max_g_index: number;
    max_hg_index: number;
    max_contemporary_h: number;
    top_lead_author: string;
    high_impact_leaders_count: number;
    average_authors_per_paper: number;
  };
}

// ================= CROSS-BORDER GEOPOLITICAL FLOW & SCIENTIFIC DIPLOMACY =================
export interface CrossBorderCitationFlow {
  sourceCountry: string; // Citing country (origin of influence/demand)
  targetCountry: string; // Cited country (destination / intellectual source)
  flowWeight: number; // Aggregated citation volume or collaborative tie
  normalizedFlow: number; // Share of total international flow (0 - 100%)
  diplomacyType: "bilateral_dense" | "north_south" | "south_north" | "regional_cluster";
}

export interface GeopoliticalRegionalProfile {
  region: "North America" | "Western Europe" | "East Asia & Pacific" | "Middle East & North Africa" | "Latin America" | "South Asia" | "Sub-Saharan Africa" | "Eastern Europe & Central Asia";
  hemisphere: "Global North" | "Global South";
  countries: string[];
  totalPublications: number;
  totalCitations: number;
  outwardCitationFlow: number; // References to other regions
  inwardCitationFlow: number; // Citations received from other regions
  netInfluenceScore: number; // (Inward - Outward) / (Inward + Outward + 1)
  regionalCentrality: number; // PageRank / eigenvector score in geopolitical flow
}

export interface CrossBorderGeoFlowOutput {
  dataset_id: string;
  dataset_name: string;
  total_international_flows: number;
  flows: CrossBorderCitationFlow[];
  regionalProfiles: GeopoliticalRegionalProfile[];
  northSouthBalance: {
    globalNorthDocShare: number; // % of publications from Global North
    globalSouthDocShare: number; // % of publications from Global South
    northSouthCollabDocs: number; // Collaborative bridging papers
    northSouthCollabRatio: number; // Ratio of cross-hemisphere collaborations
    flowNorthToSouthRatio: number; // Citations flowing North -> South
    flowSouthToNorthRatio: number; // Citations flowing South -> North
    equityIndex: number; // Gini-like equity score (0 = extreme disparity, 100 = balanced)
    verdict: string;
  };
  sankeyData: {
    nodes: Array<{ id: string; name: string; hemisphere?: "Global North" | "Global South"; category: string }>;
    links: Array<{ source: string; target: string; value: number }>;
  };
}

// ================= AI-AUGMENTED RESEARCH GAP MATRIX (FEASIBILITY VS NOVELTY) =================
export interface ResearchGapProposalItem {
  id: string;
  title: string;
  subField: string;
  gapDescription: string;
  methodologicalApproach: string;
  
  // Quadrant Metrics (0 to 100)
  noveltyScore: number; // Radical departure from existing cluster vocabulary (0-100)
  feasibilityScore: number; // Availability of foundational cited references & methods (0-100)
  competitivenessDegree: "Very Low (Blue Ocean)" | "Moderate (Emerging)" | "High (Contested Front)" | "Hyper-Competitive (Crowded)";
  quadrant: "High Novelty / High Feasibility (Gold Standard Grant)" 
    | "High Novelty / Low Feasibility (High-Risk Moonshot Thesis)" 
    | "Low Novelty / High Feasibility (Low-Hanging Fruit / Incremental)" 
    | "Low Novelty / Low Feasibility (Deprioritized)";
  
  targetDegreeLevel: "Ph.D. Dissertation" | "M.Sc. Thesis" | "Major Grant Proposal (NIH/ERC/NSF)" | "Postdoctoral Fellowship";
  estimatedCompletionHorizon: "1-2 Years" | "2-3 Years" | "3-5 Years";
  keyFoundationalReferences: string[];
  suggestedPrimaryKeywords: string[];
  expectedDeliverables: string[];
}

export interface ResearchGapMatrixOutput {
  dataset_id: string;
  dataset_name: string;
  proposals: ResearchGapProposalItem[];
  matrixSummary: {
    totalIdentifiedGaps: number;
    goldStandardCount: number;
    moonshotCount: number;
    incrementalCount: number;
    recommendedTopGrantProposal: string;
    recommendedTopThesisTopic: string;
  };
}

// ================= MULTI-CORPUS DISCREPANCY & INDEXING BIAS =================
export interface DatabaseIndexingMetric {
  database: DatabaseSource;
  docCount: number;
  exclusiveDocCount: number; // Present only in this database
  exclusiveRatio: number;
  coverageRatio: number; // docCount / totalUnionDocs
  avgCitationsRecorded: number;
  openAccessCoveragePct: number;
  authorDisambiguationQuality: "High (ORCID/AuthorID)" | "Medium" | "Low (Raw Text)";
  fundingInformationCoveragePct: number;
  abstractCompletenessPct: number;
}

export interface SubjectCategoryDiscrepancy {
  categoryName: string;
  wosSharePct: number;
  scopusSharePct: number;
  pubmedSharePct: number;
  discrepancyBiasVerdict: string; // e.g., "Scopus over-represents applied engineering; PubMed specializes in clinical/biomedical"
}

export interface MultiCorpusDiscrepancyOutput {
  dataset_id: string;
  dataset_name: string;
  totalUniqueUnionDocs: number;
  databasesCompared: DatabaseSource[];
  databaseMetrics: DatabaseIndexingMetric[];
  vennIntersections: {
    wosOnly: number;
    scopusOnly: number;
    pubmedOnly: number;
    wosScopusOverlap: number;
    wosPubmedOverlap: number;
    scopusPubmedOverlap: number;
    tripleUnionOverlap: number;
  };
  fieldBiases: SubjectCategoryDiscrepancy[];
  synthesizedReport: {
    citationInflationLeader: string; // Typically Scopus due to wider venue coverage
    clinicalDepthLeader: string; // PubMed with MeSH indexing
    eliteSelectivityLeader: string; // Web of Science Core Collection (JCR thresholds)
    recommendedIndexingStrategy: string;
    systematicReviewWarning: string;
  };
}

// ================= PRISMA 2020 AI SYNTHESIS & REPORT =================
export interface ExtractionOutcomeMetrics {
  totalRecordsExtracted: number;
  recordsWithDoi: number;
  recordsWithAbstract: number;
  recordsWithKeywords: number;
  recordsWithAuthors: number;
  doiCoveragePct: number;
  abstractCoveragePct: number;
  keywordsCoveragePct: number;
  authorsCoveragePct: number;
  yearSpan: string;
  sourceDistribution: Record<string, number>;
  extractionFidelityGrade: "Optimal" | "Good" | "Acceptable" | "Incomplete";
  compositeScore: number;
}

export interface PrismaReportInput {
  datasetName: string;
  identifiedDatabases: number;
  removedDuplicates: number;
  screened: number;
  excludedScreening: number;
  soughtRetrieval: number;
  notRetrieved: number;
  assessedEligibility: number;
  excludedEligibilityReasons: Array<{ reason: string; count: number }>;
  includedStudies: number;
  databases?: string[];
  extractionOutcomes?: ExtractionOutcomeMetrics;
}

export interface PrismaAIReport {
  datasetName: string;
  generatedAt: string;
  executiveSummary: string;
  methodologyNarrative: string;
  extractionOutcomesAssessment?: {
    overallVerdict: string;
    fieldCompletenessNarrative: string;
    extractionIntegrityScore: number;
    potentialExtractionBiases: string[];
    recommendedCleaningActions: string[];
  };
  yieldMetrics: {
    totalIdentified: number;
    duplicateAttritionRate: string;
    screeningAttritionRate: string;
    retrievalSuccessRate: string;
    eligibilityRetentionRate: string;
    finalInclusionYield: string;
  };
  exclusionReasonsSynthesis: Array<{
    reason: string;
    count: number;
    impactAssessment: string;
  }>;
  prismaComplianceChecklist: Array<{
    itemNumber: string;
    topic: string;
    status: "Compliant" | "Action Recommended";
    notes: string;
  }>;
  methodologicalStrengths: string[];
  limitationsAndBiases: string[];
  recommendationsForAuthors: string[];
}







