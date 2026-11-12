import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dataset, DataHealthMetrics, PrismaAIReport, PrismaFlow, DatasetVersion } from "../types.js";
import {
  ShieldCheck,
  Filter,
  Layers,
  CheckCircle2,
  FileText,
  Download,
  RefreshCw,
  GitMerge,
  Search,
  Check,
  Sparkles,
  Eye,
  Copy,
  BookOpen,
  ListChecks,
  Award,
  AlertTriangle,
} from "lucide-react";
import { useAiProvider } from "../context/AiProviderContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { hasRecordedExclusions, usePrismaFlow, useVersionDocuments } from "../hooks/usePrismaFlow.js";
import { PrismaFlowDiagram, PrismaManualEditor } from "./PrismaFlowDiagram.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface PrismaDedupSummary {
  total_raw_inputs: number;
  duplicates_resolved: number;
  final_unique_count: number;
  audit_log: Array<{ document_id: string; retained_id: string; rule: "exact_doi" | "exact_title" }>;
}

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onRefreshData: () => void;
  initialSubTab?: "health" | "dedup" | "prisma" | "records";
}

export function DataHygieneStudio({
  datasets = [],
  selectedDatasetId,
  onRefreshData,
  initialSubTab,
}: Props) {
  const { getAiRequestOptions } = useAiProvider();
  const activeDatasetId = selectedDatasetId || datasets[0]?.id || "";
  const [activeSubTab, setActiveSubTab] = useState<
    "health" | "dedup" | "prisma" | "records"
  >(initialSubTab || "health");

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const prisma = usePrismaFlow(activeDatasetId);
  const { documents, total: documentTotal, loading: isLoadingDocs, error: documentsError } = useVersionDocuments(activeDatasetId, prisma.version?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupSummary, setDedupSummary] = useState<PrismaDedupSummary | null>(null);
  const prismaSvgRef = useRef<SVGSVGElement | null>(null);
  const [showPrismaEditor, setShowPrismaEditor] = useState(false);

  // PRISMA 2020 AI Narrative & Methodology Report State
  const [isGeneratingPrismaAi, setIsGeneratingPrismaAi] = useState(false);
  const [prismaAiReport, setPrismaAiReport] = useState<PrismaAIReport | null>(null);
  const [prismaAiError, setPrismaAiError] = useState<string | null>(null);
  const [copiedMethodology, setCopiedMethodology] = useState(false);
  const [showChecklistDetails, setShowChecklistDetails] = useState(true);
  const reportRequestId = useRef(0);
  const currentDatasetId = useRef(activeDatasetId);
  currentDatasetId.current = activeDatasetId;

  const currentDataset = datasets.find((d) => d.id === activeDatasetId) || datasets[0];
  const ingestion = prisma.version?.metadata?.ingestion as Record<string, unknown> | undefined;
  const recordedNumber = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const persistedDedupSummary: PrismaDedupSummary | null = ingestion?.operation === "exact_doi_title_deduplication" &&
    recordedNumber(ingestion.raw_input_count) && recordedNumber(ingestion.duplicates_removed) && recordedNumber(ingestion.final_unique_count)
    ? {
        total_raw_inputs: ingestion.raw_input_count as number,
        duplicates_resolved: ingestion.duplicates_removed as number,
        final_unique_count: ingestion.final_unique_count as number,
        audit_log: Array.isArray(ingestion.dedup_audit) ? ingestion.dedup_audit as PrismaDedupSummary["audit_log"] : [],
      }
    : null;
  const displayedDedup = dedupSummary || persistedDedupSummary;

  useEffect(() => {
    setDedupSummary(null);
    setIsDeduplicating(false);
    setSearchQuery("");
  }, [activeDatasetId]);

  useEffect(() => {
    reportRequestId.current++;
    setIsGeneratingPrismaAi(false);
    setPrismaAiReport(null);
    setPrismaAiError(null);
  }, [activeDatasetId, prisma.version?.id, prisma.flow?.computed_at]);

  // Compute Data Health Metrics
  const healthMetrics = useMemo<DataHealthMetrics>(() => {
    const total = documents.length;
    if (total === 0) {
      return {
        overall_score: 0,
        level_1_score: 0,
        level_2_score: 0,
        level_3_score: 0,
        field_completeness: {
          authors: 0,
          year: 0,
          source: 0,
          citations: 0,
          references: 0,
          title: 0,
          keywords: 0,
          affiliations: 0,
          abstract: 0,
          doi: 0,
          categories: 0,
        },
        total_records: 0,
        database_distribution: {},
      };
    }

    let withAuthors = 0;
    let withYear = 0;
    let withSource = 0;
    let withCitations = 0;
    let withReferences = 0;
    let withTitle = 0;
    let withKeywords = 0;
    let withAffiliations = 0;
    let withAbstract = 0;
    let withDoi = 0;
    let withCategories = 0;
    const dbDist: Record<string, number> = {};

    documents.forEach((doc: any) => {
      if ((doc.authors && doc.authors.length > 0) || (doc.AU && doc.AU.length > 0)) withAuthors++;
      if (doc.year || doc.PY) withYear++;
      if (doc.source || doc.SO) withSource++;
      if (doc.citations !== undefined || doc.TC !== undefined) withCitations++;
      if ((doc.references && doc.references.length > 0) || (doc.CR && doc.CR.length > 0)) withReferences++;
      if (doc.title || doc.TI) withTitle++;
      if ((doc.keywords && doc.keywords.length > 0) || (doc.DE && doc.DE.length > 0)) withKeywords++;
      if ((doc.affiliations && doc.affiliations.length > 0) || (doc.C1 && doc.C1.length > 0)) withAffiliations++;
      if (doc.abstract || doc.AB) withAbstract++;
      if (doc.doi || doc.DOI) withDoi++;
      if (doc.categories || doc.SC) withCategories++;

      const sourceDb = doc.DB || doc.database || currentDataset?.source || "Primary Source";
      dbDist[sourceDb] = (dbDist[sourceDb] || 0) + 1;
    });

    const fAuthors = Math.round((withAuthors / total) * 100);
    const fYear = Math.round((withYear / total) * 100);
    const fSource = Math.round((withSource / total) * 100);
    const fCitations = Math.round((withCitations / total) * 100);
    const fReferences = Math.round((withReferences / total) * 100);
    const fTitle = Math.round((withTitle / total) * 100);
    const fKeywords = Math.round((withKeywords / total) * 100);
    const fAffiliations = Math.round((withAffiliations / total) * 100);
    const fAbstract = Math.round((withAbstract / total) * 100);
    const fDoi = Math.round((withDoi / total) * 100);
    const fCategories = Math.round((withCategories / total) * 100);

    // Level 1: Core Scientometrics (AU, PY, SO, TC, CR)
    const l1 = Math.round((fAuthors + fYear + fSource + fCitations + fReferences) / 5);
    // Level 2: Topical & Semantic (TI, DE/ID, C1)
    const l2 = Math.round((fTitle + fKeywords + fAffiliations) / 3);
    // Level 3: Auxiliary (AB, DOI, Categories)
    const l3 = Math.round((fAbstract + fDoi + fCategories) / 3);

    const overall = Math.round(l1 * 0.5 + l2 * 0.35 + l3 * 0.15);

    return {
      overall_score: overall,
      level_1_score: l1,
      level_2_score: l2,
      level_3_score: l3,
      field_completeness: {
        authors: fAuthors,
        year: fYear,
        source: fSource,
        citations: fCitations,
        references: fReferences,
        title: fTitle,
        keywords: fKeywords,
        affiliations: fAffiliations,
        abstract: fAbstract,
        doi: fDoi,
        categories: fCategories,
      },
      total_records: total,
      database_distribution: dbDist,
    };
  }, [documents, currentDataset]);

  // Server owns the flow, yield, and extraction evidence; the browser supplies identity only.
  const handleGeneratePrismaAi = async () => {
    if (!activeDatasetId || !prisma.version?.id || !prisma.flow?.consistency.valid) return;
    const requestId = ++reportRequestId.current;
    setIsGeneratingPrismaAi(true);
    setPrismaAiError(null);
    try {
      const data = await apiJson<{ report?: PrismaAIReport }>("/api/ai/prisma-report", {
        dataset_id: activeDatasetId,
        dataset_version_id: prisma.version.id,
        ...getAiRequestOptions(),
      });
      if (!data.report) throw new Error("No PRISMA report returned by the analysis engine");
      if (requestId === reportRequestId.current) setPrismaAiReport(data.report);
    } catch (err) {
      if (requestId === reportRequestId.current) setPrismaAiError(getApiErrorMessage(err, "Failed to generate PRISMA report."));
    } finally {
      if (requestId === reportRequestId.current) setIsGeneratingPrismaAi(false);
    }
  };

  const handleCopyMethodology = () => {
    if (!prismaAiReport) return;
    navigator.clipboard.writeText(prismaAiReport.methodologyNarrative);
    setCopiedMethodology(true);
    setTimeout(() => setCopiedMethodology(false), 2500);
  };

  const handleDownloadMethodologyMarkdown = () => {
    if (!prismaAiReport) return;
    const content = `# PRISMA 2020 Systematic Review Methodology & Synthesis Report
**Corpus**: ${prismaAiReport.datasetName}
**Generated**: ${new Date(prismaAiReport.generatedAt).toLocaleString()}
**Protocol Guideline**: Page et al., BMJ 2021;372:n71 (PRISMA 2020)

---

## Executive Summary
${prismaAiReport.executiveSummary}

---

## Yield & Selection Funnel Metrics
- Gross Identified: ${(prismaAiReport.yieldMetrics.totalIdentified?.toLocaleString() ?? "Not recorded")}
- Duplicate Attrition Rate: ${prismaAiReport.yieldMetrics.duplicateAttritionRate}
- Screening Attrition Rate: ${prismaAiReport.yieldMetrics.screeningAttritionRate}
- Full-Text Retrieval Success Rate: ${prismaAiReport.yieldMetrics.retrievalSuccessRate}
- Eligibility Retention Rate: ${prismaAiReport.yieldMetrics.eligibilityRetentionRate}
- Final Synthesis Yield: ${prismaAiReport.yieldMetrics.finalInclusionYield}

---

${prismaAiReport.methodologyNarrative}

---

## PRISMA 2020 Compliance Checklist
${prismaAiReport.prismaComplianceChecklist.map((c) => `- **${c.itemNumber} (${c.topic})**: [${c.status}] ${c.notes}`).join("\n")}

---

## Methodological Strengths
${prismaAiReport.methodologicalStrengths.map((s) => `- ${s}`).join("\n")}

## Limitations & Potential Biases
${prismaAiReport.limitationsAndBiases.map((b) => `- ${b}`).join("\n")}

## Recommendations for Authors & Peer Reviewers
${prismaAiReport.recommendationsForAuthors.map((r) => `- ${r}`).join("\n")}
`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PRISMA_2020_Methodology_Report_${(currentDataset?.name || "corpus").replace(/\s+/g, "_")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Deduplication persists a successor version. Switch the shared flow to that version.
  const runDeduplicationAudit = async () => {
    if (!activeDatasetId || !prisma.version?.id || isDeduplicating) return;
    setIsDeduplicating(true);
    prisma.setError(null);
    try {
      const result = await apiJson<{ version: DatasetVersion; flow: PrismaFlow; summary: PrismaDedupSummary }>(`/api/datasets/${encodeURIComponent(activeDatasetId)}/dedup`, {
        version_id: prisma.version.id,
      });
      if (activeDatasetId !== currentDatasetId.current) return;
      prisma.adoptVersion(result.flow, result.version);
      setDedupSummary(result.summary);
      onRefreshData();
    } catch (err) {
      if (activeDatasetId === currentDatasetId.current) prisma.setError(getApiErrorMessage(err, "Unable to deduplicate this dataset version."));
    } finally {
      if (activeDatasetId === currentDatasetId.current) setIsDeduplicating(false);
    }
  };

  // Filtered documents for inspect tab
  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documents.slice(0, 100);
    const q = searchQuery.toLowerCase();
    return documents
      .filter((d: any) => {
        const title = (d.title || d.TI || "").toLowerCase();
        const authors = (Array.isArray(d.authors) ? d.authors.join(" ") : d.AU ? d.AU.join(" ") : "").toLowerCase();
        const source = (d.source || d.SO || "").toLowerCase();
        return title.includes(q) || authors.includes(q) || source.includes(q);
      })
      .slice(0, 100);
  }, [documents, searchQuery]);

  // Export PRISMA SVG
  const exportPrismaSvg = () => {
    if (!prismaSvgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(prismaSvgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PRISMA-2020-Flowchart-${currentDataset?.name || "Dataset"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-border-default pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sciai-kicker">Phase 1</span>
          <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-[10px] font-bold text-status-success-text">
            Data & Hygiene
          </span>
        </div>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
          Dataset Management & Data Hygiene
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
          Audit metadata completeness, deduplicate bibliographic records, and document recorded
          PRISMA 2020 study-selection counts.
        </p>
      </div>

      {(prisma.error || documentsError) && (
        <AlertBanner tone="danger">{prisma.error || documentsError}</AlertBanner>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab("health")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "health"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Metadata Health & Completeness
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("dedup")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "dedup"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Deduplication & Bibliographic Record Merging
            {displayedDedup && displayedDedup.duplicates_resolved > 0 && (
              <span
                className={`tabular-metrics ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeSubTab === "dedup"
                    ? "bg-white/20 text-white"
                    : "border border-status-danger-border bg-status-danger-bg text-status-danger-text"
                }`}
              >
                {displayedDedup.duplicates_resolved}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("prisma")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "prisma"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            PRISMA 2020 Flow Diagram
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("records")}
            className={`tabular-metrics inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "records"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Browse Canonical Bibliographic Records (
            {documentTotal === null ? "Not recorded" : documentTotal.toLocaleString()})
          </button>
        </div>

        {isLoadingDocs && (
          <span className="inline-flex animate-pulse items-center gap-1.5 text-xs font-semibold text-brand-500">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Reading bibliographic records...
          </span>
        )}
      </div>

      {/* SUB-TAB 1: METADATA HEALTH */}
      {activeSubTab === "health" && documentTotal === null && (
        <Card padding="md">
          <p className="text-xs text-ink-muted">
            {isLoadingDocs
              ? "Loading all records for the metadata audit..."
              : "Metadata health is not available until the dataset version loads."}
          </p>
        </Card>
      )}
      {activeSubTab === "health" && documentTotal !== null && (
        <div className="space-y-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card padding="md">
              <div className="sciai-kicker">Overall Health Index</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tabular-metrics text-3xl font-black text-ink-primary">
                  {healthMetrics.overall_score}%
                </span>
                <span
                  className={`text-xs font-bold ${
                    healthMetrics.overall_score >= 80
                      ? "text-status-success-text"
                      : healthMetrics.overall_score >= 60
                        ? "text-status-warning-text"
                        : "text-status-danger-text"
                  }`}
                >
                  {healthMetrics.overall_score >= 80
                    ? "Production Grade"
                    : healthMetrics.overall_score >= 60
                      ? "Acceptable"
                      : "Sparse Fields"}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-status-success-text transition-all duration-500"
                  style={{ width: `${healthMetrics.overall_score}%` }}
                />
              </div>
            </Card>

            <Card padding="md">
              <div className="sciai-kicker">Core Scientometrics (L1)</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tabular-metrics text-3xl font-black text-ink-primary">
                  {healthMetrics.level_1_score}%
                </span>
                <span className="text-xs text-ink-muted">Weight 50%</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                AU, PY, SO, Citations, References
              </div>
            </Card>

            <Card padding="md">
              <div className="sciai-kicker">Semantics & Affiliations (L2)</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tabular-metrics text-3xl font-black text-ink-primary">
                  {healthMetrics.level_2_score}%
                </span>
                <span className="text-xs text-ink-muted">Weight 35%</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">Titles, Keywords, Institutions</div>
            </Card>

            <Card padding="md">
              <div className="sciai-kicker">Auxiliary & Identifiers (L3)</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tabular-metrics text-3xl font-black text-ink-primary">
                  {healthMetrics.level_3_score}%
                </span>
                <span className="text-xs text-ink-muted">Weight 15%</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                Abstracts, DOIs, Subject Categories
              </div>
            </Card>
          </div>

          {/* Completeness Matrix */}
          <Card padding="lg">
            <h2 className="text-base font-bold text-ink-primary">
              Bibliographic Field Completeness Audit
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Audits the presence of essential metadata elements required for rigorous bibliometric
              and network modeling.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: "Authors (AU)",
                  val: healthMetrics.field_completeness.authors,
                  req: "Mandatory for Co-authorship & Lotka",
                },
                {
                  name: "Publication Year (PY)",
                  val: healthMetrics.field_completeness.year,
                  req: "Mandatory for Growth & Longitudinal",
                },
                {
                  name: "Source / Journal (SO)",
                  val: healthMetrics.field_completeness.source,
                  req: "Mandatory for Bradford & Sources",
                },
                {
                  name: "Times Cited (TC)",
                  val: healthMetrics.field_completeness.citations,
                  req: "Mandatory for H-Index & Impact",
                },
                {
                  name: "Cited References (CR)",
                  val: healthMetrics.field_completeness.references,
                  req: "Mandatory for RPYS & Co-citation",
                },
                {
                  name: "Title (TI)",
                  val: healthMetrics.field_completeness.title,
                  req: "Mandatory for Identification",
                },
                {
                  name: "Keywords (DE / ID)",
                  val: healthMetrics.field_completeness.keywords,
                  req: "Mandatory for Co-word & Thematic",
                },
                {
                  name: "Affiliations & Country (C1)",
                  val: healthMetrics.field_completeness.affiliations,
                  req: "Mandatory for Geo & Institution",
                },
                {
                  name: "Digital Object Identifier (DOI)",
                  val: healthMetrics.field_completeness.doi,
                  req: "Recommended for Deduplication",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-primary">{item.name}</span>
                    <span
                      className={`tabular-metrics font-mono text-xs font-bold ${
                        item.val >= 90
                          ? "text-status-success-text"
                          : item.val >= 60
                            ? "text-status-warning-text"
                            : "text-status-danger-text"
                      }`}
                    >
                      {item.val}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.val >= 90
                          ? "bg-status-success-text"
                          : item.val >= 60
                            ? "bg-status-warning-text"
                            : "bg-status-danger-text"
                      }`}
                      style={{ width: `${item.val}%` }}
                    />
                  </div>
                  <div className="mt-1.5 truncate text-[10px] text-ink-muted">{item.req}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* SUB-TAB 2: DEDUPLICATION & MERGING */}
      {activeSubTab === "dedup" && (
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-ink-primary">
                  Cross-Database Deduplication Engine
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Resolves exact DOI or normalized-title matches and creates a new dataset version;
                  borderline similarities are not removed automatically.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                loading={isDeduplicating}
                disabled={isDeduplicating || !prisma.version || isLoadingDocs}
                onClick={runDeduplicationAudit}
                icon={!isDeduplicating ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
              >
                {isDeduplicating ? "Creating Dataset Version..." : "Deduplicate and Create Version"}
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-subtle pt-5 sm:grid-cols-3">
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                <div className="sciai-kicker">
                  {dedupSummary ? "Records in Source Version" : "Recorded Raw Inputs"}
                </div>
                <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                  {displayedDedup ? displayedDedup.total_raw_inputs.toLocaleString() : "Not recorded"}
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                <div className="sciai-kicker">
                  {dedupSummary ? "Duplicates Resolved This Run" : "Duplicates Removed in Lineage"}
                </div>
                <div className="tabular-metrics mt-1 text-2xl font-black text-status-danger-text">
                  {displayedDedup
                    ? displayedDedup.duplicates_resolved.toLocaleString()
                    : "Not recorded"}
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                <div className="sciai-kicker">Unique Canonical Records</div>
                <div className="tabular-metrics mt-1 text-2xl font-black text-status-success-text">
                  {displayedDedup
                    ? displayedDedup.final_unique_count.toLocaleString()
                    : "Not recorded"}
                </div>
              </div>
            </div>

            {displayedDedup && (
              <div className="mt-5 text-xs text-ink-secondary">
                <p>
                  {dedupSummary
                    ? "Server deduplication saved a successor version."
                    : "Persisted deduplication provenance for this version."}{" "}
                  {displayedDedup.duplicates_resolved}{" "}
                  {dedupSummary
                    ? "duplicates resolved in this run"
                    : "duplicates removed in the version lineage"}
                  ; {displayedDedup.final_unique_count} canonical records retained.
                </p>
                {displayedDedup.audit_log.length > 0 && (
                  <div className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-default">
                    {displayedDedup.audit_log.slice(0, 10).map((entry, index) => (
                      <div key={`${entry.document_id}-${index}`} className="p-3 font-mono text-[11px]">
                        Removed record {entry.document_id} | retained {entry.retained_id} |{" "}
                        {entry.rule.replaceAll("_", " ")}
                      </div>
                    ))}
                    {displayedDedup.audit_log.length > 10 && (
                      <p className="p-3 text-ink-muted">
                        Showing 10 of {displayedDedup.audit_log.length} audit entries.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUB-TAB 3: PRISMA 2020 FLOW DIAGRAM */}
      {activeSubTab === "prisma" && (
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-ink-primary">
                  PRISMA 2020 Systematic Review Flow Diagram
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Standardized flow chart for systematic literature reviews and bibliometric
                  synthesis according to Page et al. (BMJ 2021).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={isGeneratingPrismaAi}
                  disabled={
                    isGeneratingPrismaAi || !prisma.version || !prisma.flow?.consistency.valid
                  }
                  onClick={handleGeneratePrismaAi}
                  icon={!isGeneratingPrismaAi ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
                >
                  {prismaAiReport ? "Regenerate AI Report" : "Generate AI PRISMA Report"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={exportPrismaSvg}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Export PRISMA (SVG)
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-subtle p-4">
              <PrismaFlowDiagram
                ref={prismaSvgRef}
                flow={prisma.flow}
                reasonsRecorded={hasRecordedExclusions(prisma.version)}
              />
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowPrismaEditor(!showPrismaEditor)}
              >
                {showPrismaEditor ? "Hide selection count editor" : "Record study-selection counts"}
              </Button>
              {showPrismaEditor && (
                <div className="mt-3 rounded-xl border border-border-default bg-surface-subtle p-4">
                  <PrismaManualEditor
                    flow={prisma.flow}
                    draft={prisma.draft}
                    saving={prisma.saving}
                    error={prisma.error}
                    reasonsRecorded={hasRecordedExclusions(prisma.version)}
                    onFieldChange={prisma.updateField}
                    onReasonsChange={prisma.updateReasons}
                    onSave={prisma.save}
                  />
                </div>
              )}
            </div>

            {prisma.flow && !prisma.flow.consistency.valid && (
              <div className="mt-3">
                <AlertBanner tone="danger">{prisma.flow.consistency.errors.join("; ")}</AlertBanner>
              </div>
            )}
            {prisma.flow?.consistency.warnings.map((warning) => (
              <p key={warning} className="mt-1.5 text-xs font-medium text-status-warning-text">
                {warning}
              </p>
            ))}
          </Card>

          {/* AI PRISMA 2020 METHODOLOGY NARRATIVE & SYNTHESIS REPORT */}
          {isGeneratingPrismaAi && (
            <div className="space-y-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface-canvas to-surface-subtle p-6 text-center shadow-card">
              <div className="mx-auto inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border border-brand-200 bg-brand-100 text-brand-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-primary">
                  Synthesizing PRISMA 2020 Methodology Narrative via Multi-provider AI...
                </h3>
                <p className="mx-auto max-w-xl text-xs text-ink-muted">
                  Reviewing recorded selection counts and drafting a Methods narrative. Check
                  missing counts and verify the draft against your review protocol before use.
                </p>
              </div>
              <div className="flex justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-brand-500" />
              </div>
            </div>
          )}

          {prismaAiError && !isGeneratingPrismaAi && (
            <AlertBanner tone="danger" title="PRISMA AI Synthesis Error">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{prismaAiError}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleGeneratePrismaAi}
                >
                  Retry Synthesis
                </Button>
              </div>
            </AlertBanner>
          )}

          {!prismaAiReport && !isGeneratingPrismaAi && !prismaAiError && (
            <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/70 via-surface-canvas to-surface-subtle p-6 shadow-card md:flex-row">
              <div className="max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-100/70 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                  <Sparkles className="h-3 w-3" />
                  AI Scientometric Copilot
                </div>
                <h3 className="text-base font-bold text-ink-primary">
                  Generate PRISMA 2020 Methodology Narrative & Synthesis Report
                </h3>
                <p className="text-xs leading-relaxed text-ink-muted">
                  Draft a PRISMA 2020 Methods narrative from persisted counts for this dataset
                  version. Unrecorded steps remain unrecorded; review the generated text and
                  checklist against your protocol before publication.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleGeneratePrismaAi}
                icon={<Sparkles className="h-4 w-4" />}
                className="shrink-0"
              >
                Generate AI PRISMA Report
              </Button>
            </div>
          )}

          {prismaAiReport && !isGeneratingPrismaAi && (
            <div className="space-y-6">
              {/* Report Header Card */}
              <Card padding="lg" className="space-y-6 border-brand-200">
                <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-[11px] font-bold text-status-success-text">
                        <CheckCircle2 className="h-3 w-3" />
                        Canonical Version Report
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                        <Award className="h-3 w-3" />
                        BMJ / Page et al. Protocol
                      </span>
                      <span className="tabular-metrics text-[11px] text-ink-subtle">
                        Synthesized {new Date(prismaAiReport.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-ink-primary">
                      PRISMA 2020 Systematic Review Methodology & Synthesis Report
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Corpus:{" "}
                      <span className="font-semibold text-ink-secondary">
                        {prismaAiReport.datasetName}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyMethodology}
                      icon={
                        copiedMethodology ? (
                          <Check className="h-3.5 w-3.5 text-status-success-text" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      {copiedMethodology ? "Copied to Clipboard!" : "Copy Methods Text"}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadMethodologyMarkdown}
                      icon={<Download className="h-3.5 w-3.5" />}
                    >
                      Download Report (.md)
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleGeneratePrismaAi}
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* 1. Quantitative Selection Funnel & Yield KPIs */}
                <div>
                  <div className="sciai-kicker mb-3">
                    Selection Funnel Yield Ratios & Attrition Dynamics
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5">
                      <div className="sciai-kicker">Total Identified</div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-ink-primary">
                        {prismaAiReport.yieldMetrics.totalIdentified?.toLocaleString() ??
                          "Not recorded"}
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-muted">
                        Recorded identification total
                      </div>
                    </div>

                    <div className="rounded-xl border border-status-danger-border bg-status-danger-bg/50 p-3.5">
                      <div className="sciai-kicker text-status-danger-text!">
                        Duplicate Attrition
                      </div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-status-danger-text">
                        {prismaAiReport.yieldMetrics.duplicateAttritionRate}
                      </div>
                      <div className="mt-0.5 text-[10px] text-status-danger-text">
                        Persisted deduplication lineage
                      </div>
                    </div>

                    <div className="rounded-xl border border-status-warning-border bg-status-warning-bg/50 p-3.5">
                      <div className="sciai-kicker text-status-warning-text!">
                        Screening Attrition
                      </div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-status-warning-text">
                        {prismaAiReport.yieldMetrics.screeningAttritionRate}
                      </div>
                      <div className="mt-0.5 text-[10px] text-status-warning-text">
                        Title/Abstract filter
                      </div>
                    </div>

                    <div className="rounded-xl border border-status-info-border bg-status-info-bg/50 p-3.5">
                      <div className="sciai-kicker text-status-info-text!">Retrieval Success</div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-status-info-text">
                        {prismaAiReport.yieldMetrics.retrievalSuccessRate}
                      </div>
                      <div className="mt-0.5 text-[10px] text-status-info-text">
                        Full-text secured
                      </div>
                    </div>

                    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
                      <div className="sciai-kicker text-brand-700!">Eligibility Retention</div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-brand-700">
                        {prismaAiReport.yieldMetrics.eligibilityRetentionRate}
                      </div>
                      <div className="mt-0.5 text-[10px] text-brand-600">Criteria pass rate</div>
                    </div>

                    <div className="rounded-xl border border-status-success-border bg-status-success-bg/70 p-3.5">
                      <div className="sciai-kicker text-status-success-text!">
                        Final Inclusion Yield
                      </div>
                      <div className="tabular-metrics mt-1 text-xl font-black text-status-success-text">
                        {prismaAiReport.yieldMetrics.finalInclusionYield}
                      </div>
                      <div className="mt-0.5 text-[10px] text-status-success-text">
                        Net synthesis yield
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Executive Synthesis Paragraph */}
                <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-ink-primary">
                    <BookOpen className="h-4 w-4 text-brand-500" />
                    Executive Methodological Synthesis
                  </div>
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {prismaAiReport.executiveSummary}
                  </p>
                </div>

                {/* 2b. Extraction Outcomes Assessment */}
                {prismaAiReport.extractionOutcomesAssessment && (
                  <div className="space-y-3 rounded-xl border border-status-success-border bg-status-success-bg/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-status-success-text">
                        <Layers className="h-4 w-4" />
                        Extraction Outcomes & Field Integrity Assessment
                      </div>
                      <span className="tabular-metrics rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-[11px] font-bold text-status-success-text">
                        Score: {prismaAiReport.extractionOutcomesAssessment.extractionIntegrityScore}
                        /100
                      </span>
                    </div>

                    <div className="text-xs text-ink-secondary">
                      <span className="font-bold text-ink-primary">Verdict: </span>
                      {prismaAiReport.extractionOutcomesAssessment.overallVerdict}
                    </div>

                    <p className="text-[11px] leading-relaxed text-ink-muted">
                      {prismaAiReport.extractionOutcomesAssessment.fieldCompletenessNarrative}
                    </p>

                    <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border-default bg-surface-canvas p-2.5">
                        <div className="sciai-kicker mb-1 text-status-warning-text!">
                          Potential Biases & Coverage Limits
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                          {prismaAiReport.extractionOutcomesAssessment.potentialExtractionBiases.map(
                            (b, i) => (
                              <li key={i}>{b}</li>
                            )
                          )}
                        </ul>
                      </div>

                      <div className="rounded-lg border border-border-default bg-surface-canvas p-2.5">
                        <div className="sciai-kicker mb-1 text-status-success-text!">
                          Recommended Hygiene Actions
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                          {prismaAiReport.extractionOutcomesAssessment.recommendedCleaningActions.map(
                            (a, i) => (
                              <li key={i}>{a}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* 3. Publication-Ready Academic Methods Section */}
              <Card padding="lg" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-ink-primary">
                      <FileText className="h-4 w-4 text-brand-500" />
                      Draft Methods Section
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Review the draft against your actual search, screening, and eligibility
                      decisions before manuscript use.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleCopyMethodology}
                    icon={
                      copiedMethodology ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {copiedMethodology ? "Copied!" : "Copy Section"}
                  </Button>
                </div>

                <div className="whitespace-pre-line rounded-xl border border-border-subtle bg-surface-subtle p-5 font-sans text-xs leading-relaxed text-ink-primary">
                  {prismaAiReport.methodologyNarrative}
                </div>

                <div className="text-[11px] italic text-ink-subtle">
                  * Citation guideline: Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020
                  statement: an updated guideline for reporting systematic reviews. BMJ
                  2021;372:n71. doi:10.1136/bmj.n71
                </div>
              </Card>

              {/* 4. Categorized Exclusions & Bias Assessment */}
              <Card padding="lg" className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink-primary">
                    <Filter className="h-4 w-4 text-status-danger-text" />
                    Eligibility Exclusions & Scientometric Impact Analysis
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Categorization of studies excluded at full-text assessment and rationale for
                    maintaining topical coherence.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {prismaAiReport.exclusionReasonsSynthesis.map((ex, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 rounded-xl border border-status-danger-border bg-status-danger-bg/40 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink-primary">{ex.reason}</span>
                        <span className="tabular-metrics rounded-full border border-status-danger-border bg-status-danger-bg px-2 py-0.5 font-mono text-[11px] font-bold text-status-danger-text">
                          n = {ex.count}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-ink-secondary">
                        {ex.impactAssessment}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 5. PRISMA 2020 Compliance Checklist Audit */}
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-ink-primary">
                      <ListChecks className="h-4 w-4 text-status-success-text" />
                      PRISMA 2020 Checklist Review
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Generated checklist notes are prompts for review, not proof of compliance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChecklistDetails(!showChecklistDetails)}
                    className="cursor-pointer text-xs font-bold text-brand-500 transition-colors hover:text-brand-700"
                  >
                    {showChecklistDetails ? "Collapse Checklist" : "Expand Checklist"}
                  </button>
                </div>

                {showChecklistDetails && (
                  <div className="divide-y divide-border-subtle">
                    {prismaAiReport.prismaComplianceChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                              {item.itemNumber}
                            </span>
                            <span className="text-xs font-bold text-ink-primary">{item.topic}</span>
                          </div>
                          <p className="ml-1 text-[11px] text-ink-muted sm:ml-0">{item.notes}</p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-[11px] font-bold text-status-success-text sm:self-center">
                          <Check className="h-3 w-3" />
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* 6. Methodological Strengths, Recognized Biases & Reviewer Guidance */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card padding="md" className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-status-success-text">
                    <ShieldCheck className="h-4 w-4" />
                    Protocol Strengths
                  </div>
                  <ul className="space-y-2 text-xs text-ink-secondary">
                    {prismaAiReport.methodologicalStrengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="shrink-0 font-bold text-status-success-text">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card padding="md" className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-status-warning-text">
                    <AlertTriangle className="h-4 w-4" />
                    Limitations & Biases
                  </div>
                  <ul className="space-y-2 text-xs text-ink-secondary">
                    {prismaAiReport.limitationsAndBiases.map((lim, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="shrink-0 font-bold text-status-warning-text">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card padding="md" className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
                    <Award className="h-4 w-4" />
                    Author & Reviewer Advice
                  </div>
                  <ul className="space-y-2 text-xs text-ink-secondary">
                    {prismaAiReport.recommendationsForAuthors.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="shrink-0 font-bold text-brand-500">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: BROWSE RECORDS */}
      {activeSubTab === "records" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-canvas p-3 shadow-card">
            <div className="flex max-w-md flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-ink-subtle" />
              <input
                type="text"
                placeholder="Search canonical records by title, author, or journal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-ink-primary placeholder:text-ink-subtle focus:outline-none"
              />
            </div>
            <div className="tabular-metrics text-xs font-semibold text-ink-muted">
              Showing {filteredDocs.length} of{" "}
              {documentTotal === null ? "Not recorded" : documentTotal.toLocaleString()} articles
            </div>
          </div>

          <Card padding="none" className="divide-y divide-border-subtle overflow-hidden">
            {filteredDocs.map((doc: any, idx) => (
              <div key={idx} className="space-y-1 p-4 transition-colors hover:bg-surface-subtle/60">
                <div className="text-xs font-bold text-ink-primary">
                  {doc.title || doc.TI || "Untitled Publication"}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <span>
                    Authors:{" "}
                    {Array.isArray(doc.authors)
                      ? doc.authors.slice(0, 4).join(", ")
                      : doc.AU
                        ? doc.AU.slice(0, 4).join(", ")
                        : "Unknown"}
                  </span>
                  <span className="tabular-metrics">Year: {doc.year || doc.PY || "N/A"}</span>
                  <span>Journal: {doc.source || doc.SO || "N/A"}</span>
                  <span className="tabular-metrics font-semibold text-brand-500">
                    Citations: {doc.citations ?? doc.TC ?? "Not recorded"}
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}