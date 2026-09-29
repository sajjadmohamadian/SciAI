import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dataset, BibliometricDocument, DataHealthMetrics, PrismaAIReport, PrismaFlow, DatasetVersion } from "../types.js";
import {
  ShieldCheck,
  Filter,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  RefreshCw,
  GitMerge,
  Search,
  Check,
  X,
  Sparkles,
  BarChart3,
  Sliders,
  HelpCircle,
  Eye,
  Copy,
  BookOpen,
  CheckSquare,
  ListChecks,
  ArrowDownRight,
  Award,
  ExternalLink,
} from "lucide-react";
import { useAiProvider } from "../context/AiProviderContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { hasRecordedExclusions, usePrismaFlow, useVersionDocuments } from "../hooks/usePrismaFlow.js";
import { PrismaFlowDiagram, PrismaManualEditor } from "./PrismaFlowDiagram.js";

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
      <div className="border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Phase 1
            </span>
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700">
              Data & Hygiene
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Dataset Management & Data Hygiene
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Audit metadata completeness, deduplicate bibliographic records, and document recorded PRISMA 2020 study-selection counts.
          </p>
        </div>
      </div>

      {(prisma.error || documentsError) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{prisma.error || documentsError}</p>}
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("health")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === "health"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Metadata Health & Completeness
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("dedup")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === "dedup"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Deduplication & Bibliographic Record Merging
            {displayedDedup && displayedDedup.duplicates_resolved > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px]">
                {displayedDedup?.duplicates_resolved}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("prisma")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === "prisma"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            PRISMA 2020 Flow Diagram
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("records")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === "records"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Browse Canonical Bibliographic Records ({documentTotal === null ? "Not recorded" : documentTotal.toLocaleString()})
          </button>
        </div>

        {isLoadingDocs && (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Reading bibliographic records...
          </span>
        )}
      </div>

      {/* SUB-TAB 1: METADATA HEALTH */}
      {activeSubTab === "health" && documentTotal === null && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">{isLoadingDocs ? "Loading all records for the metadata audit..." : "Metadata health is not available until the dataset version loads."}</p>
      )}
      {activeSubTab === "health" && documentTotal !== null && (
        <div className="space-y-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Overall Health Index
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {healthMetrics.overall_score}%
                </span>
                <span
                  className={`text-xs font-bold ${
                    healthMetrics.overall_score >= 80
                      ? "text-emerald-600"
                      : healthMetrics.overall_score >= 60
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {healthMetrics.overall_score >= 80
                    ? "Production Grade"
                    : healthMetrics.overall_score >= 60
                    ? "Acceptable"
                    : "Sparse Fields"}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${healthMetrics.overall_score}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Core Scientometrics (L1)
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {healthMetrics.level_1_score}%
                </span>
                <span className="text-xs text-slate-500">Weight 50%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                AU, PY, SO, Citations, References
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Semantics & Affiliations (L2)
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {healthMetrics.level_2_score}%
                </span>
                <span className="text-xs text-slate-500">Weight 35%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Titles, Keywords, Institutions
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Auxiliary & Identifiers (L3)
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {healthMetrics.level_3_score}%
                </span>
                <span className="text-xs text-slate-500">Weight 15%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Abstracts, DOIs, Subject Categories
              </div>
            </div>
          </div>

          {/* Completeness Matrix */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900">
              Bibliographic Field Completeness Audit
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Audits the presence of essential metadata elements required for rigorous bibliometric and network modeling.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: "Authors (AU)", val: healthMetrics.field_completeness.authors, req: "Mandatory for Co-authorship & Lotka" },
                { name: "Publication Year (PY)", val: healthMetrics.field_completeness.year, req: "Mandatory for Growth & Longitudinal" },
                { name: "Source / Journal (SO)", val: healthMetrics.field_completeness.source, req: "Mandatory for Bradford & Sources" },
                { name: "Times Cited (TC)", val: healthMetrics.field_completeness.citations, req: "Mandatory for H-Index & Impact" },
                { name: "Cited References (CR)", val: healthMetrics.field_completeness.references, req: "Mandatory for RPYS & Co-citation" },
                { name: "Title (TI)", val: healthMetrics.field_completeness.title, req: "Mandatory for Identification" },
                { name: "Keywords (DE / ID)", val: healthMetrics.field_completeness.keywords, req: "Mandatory for Co-word & Thematic" },
                { name: "Affiliations & Country (C1)", val: healthMetrics.field_completeness.affiliations, req: "Mandatory for Geo & Institution" },
                { name: "Digital Object Identifier (DOI)", val: healthMetrics.field_completeness.doi, req: "Recommended for Deduplication" },
              ].map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        item.val >= 90
                          ? "text-emerald-600"
                          : item.val >= 60
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {item.val}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.val >= 90
                          ? "bg-emerald-500"
                          : item.val >= 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${item.val}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-500 truncate">
                    {item.req}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DEDUPLICATION & MERGING */}
      {activeSubTab === "dedup" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Cross-Database Deduplication Engine
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Resolves exact DOI or normalized-title matches and creates a new dataset version; borderline similarities are not removed automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={runDeduplicationAudit}
                disabled={isDeduplicating || !prisma.version || isLoadingDocs}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDeduplicating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isDeduplicating ? "Creating Dataset Version..." : "Deduplicate and Create Version"}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase text-slate-400">{dedupSummary ? "Records in Source Version" : "Recorded Raw Inputs"}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{displayedDedup ? displayedDedup.total_raw_inputs.toLocaleString() : "Not recorded"}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase text-slate-400">{dedupSummary ? "Duplicates Resolved This Run" : "Duplicates Removed in Lineage"}</div>
                <div className="mt-1 text-2xl font-black text-rose-600">{displayedDedup ? displayedDedup.duplicates_resolved.toLocaleString() : "Not recorded"}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase text-slate-400">Unique Canonical Records</div>
                <div className="mt-1 text-2xl font-black text-emerald-600">
                  {displayedDedup ? displayedDedup.final_unique_count.toLocaleString() : "Not recorded"}
                </div>
              </div>
            </div>

            {displayedDedup && (
              <div className="mt-5 text-xs text-slate-700">
                <p>{dedupSummary ? "Server deduplication saved a successor version." : "Persisted deduplication provenance for this version."} {displayedDedup.duplicates_resolved} {dedupSummary ? "duplicates resolved in this run" : "duplicates removed in the version lineage"}; {displayedDedup.final_unique_count} canonical records retained.</p>
                {displayedDedup.audit_log.length > 0 && <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {displayedDedup.audit_log.slice(0, 10).map((entry, index) => <div key={`${entry.document_id}-${index}`} className="p-3">
                    Removed record {entry.document_id} | retained {entry.retained_id} | {entry.rule.replaceAll("_", " ")}
                  </div>)}
                  {displayedDedup.audit_log.length > 10 && <p className="p-3 text-slate-500">Showing 10 of {displayedDedup.audit_log.length} audit entries.</p>}
                </div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRISMA 2020 FLOW DIAGRAM */}
      {activeSubTab === "prisma" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  PRISMA 2020 Systematic Review Flow Diagram
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Standardized flow chart for systematic literature reviews and bibliometric synthesis according to Page et al. (BMJ 2021).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleGeneratePrismaAi}
                  disabled={isGeneratingPrismaAi || !prisma.version || !prisma.flow?.consistency.valid}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:from-indigo-100 hover:to-violet-100 transition cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPrismaAi ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  )}
                  {prismaAiReport ? "Regenerate AI Report" : "Generate AI PRISMA Report"}
                </button>

                <button
                  type="button"
                  onClick={exportPrismaSvg}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export PRISMA (SVG)
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <PrismaFlowDiagram ref={prismaSvgRef} flow={prisma.flow} reasonsRecorded={hasRecordedExclusions(prisma.version)} />
            </div>
            <div className="mt-4">
              <button type="button" onClick={() => setShowPrismaEditor(!showPrismaEditor)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                {showPrismaEditor ? "Hide selection count editor" : "Record study-selection counts"}
              </button>
              {showPrismaEditor && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><PrismaManualEditor flow={prisma.flow} draft={prisma.draft} saving={prisma.saving} error={prisma.error} reasonsRecorded={hasRecordedExclusions(prisma.version)} onFieldChange={prisma.updateField} onReasonsChange={prisma.updateReasons} onSave={prisma.save} /></div>}
            </div>
            {prisma.flow && !prisma.flow.consistency.valid && <p role="alert" className="mt-3 text-xs text-rose-700">{prisma.flow.consistency.errors.join("; ")}</p>}
            {prisma.flow?.consistency.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}
          </div>

          {/* AI PRISMA 2020 METHODOLOGY NARRATIVE & SYNTHESIS REPORT */}
          {isGeneratingPrismaAi && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 p-6 shadow-2xs text-center space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 animate-pulse mx-auto">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Synthesizing PRISMA 2020 Methodology Narrative via Multi-provider AI...
                </h3>
                <p className="text-xs text-slate-500 max-w-xl mx-auto">
                  Reviewing recorded selection counts and drafting a Methods narrative. Check missing counts and verify the draft against your review protocol before use.
                </p>
              </div>
              <div className="flex justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            </div>
          )}

          {prismaAiError && !isGeneratingPrismaAi && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">PRISMA AI Synthesis Error</h4>
                  <p className="text-xs text-rose-700 mt-1">{prismaAiError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGeneratePrismaAi}
                className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
              >
                Retry Synthesis
              </button>
            </div>
          )}

          {!prismaAiReport && !isGeneratingPrismaAi && !prismaAiError && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50/60 p-6 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-100/70 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                  <Sparkles className="h-3 w-3" />
                  AI Scientometric Copilot
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Generate PRISMA 2020 Methodology Narrative & Synthesis Report
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Draft a PRISMA 2020 Methods narrative from persisted counts for this dataset version. Unrecorded steps remain unrecorded; review the generated text and checklist against your protocol before publication.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGeneratePrismaAi}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition cursor-pointer shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Generate AI PRISMA Report
              </button>
            </div>
          )}

          {prismaAiReport && !isGeneratingPrismaAi && (
            <div className="space-y-6">
              {/* Report Header Card */}
              <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Canonical Version Report
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                        <Award className="h-3 w-3" />
                        BMJ / Page et al. Protocol
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Synthesized {new Date(prismaAiReport.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                      PRISMA 2020 Systematic Review Methodology & Synthesis Report
                    </h2>
                    <p className="text-xs text-slate-500">
                      Corpus: <span className="font-semibold text-slate-700">{prismaAiReport.datasetName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopyMethodology}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                    >
                      {copiedMethodology ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-500" />
                          <span>Copy Methods Text</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadMethodologyMarkdown}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-500" />
                      Download Report (.md)
                    </button>

                    <button
                      type="button"
                      onClick={handleGeneratePrismaAi}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 active:scale-95 transition cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* 1. Quantitative Selection Funnel & Yield KPIs */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Selection Funnel Yield Ratios & Attrition Dynamics
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total Identified</div>
                      <div className="text-xl font-black text-slate-900 mt-1">
                        {(prismaAiReport.yieldMetrics.totalIdentified?.toLocaleString() ?? "Not recorded")}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Recorded identification total</div>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-rose-700">Duplicate Attrition</div>
                      <div className="text-xl font-black text-rose-900 mt-1">
                        {prismaAiReport.yieldMetrics.duplicateAttritionRate}
                      </div>
                      <div className="text-[10px] text-rose-600 mt-0.5">Persisted deduplication lineage</div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-amber-700">Screening Attrition</div>
                      <div className="text-xl font-black text-amber-900 mt-1">
                        {prismaAiReport.yieldMetrics.screeningAttritionRate}
                      </div>
                      <div className="text-[10px] text-amber-600 mt-0.5">Title/Abstract filter</div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-blue-700">Retrieval Success</div>
                      <div className="text-xl font-black text-blue-900 mt-1">
                        {prismaAiReport.yieldMetrics.retrievalSuccessRate}
                      </div>
                      <div className="text-[10px] text-blue-600 mt-0.5">Full-text secured</div>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-purple-700">Eligibility Retention</div>
                      <div className="text-xl font-black text-purple-900 mt-1">
                        {prismaAiReport.yieldMetrics.eligibilityRetentionRate}
                      </div>
                      <div className="text-[10px] text-purple-600 mt-0.5">Criteria pass rate</div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                      <div className="text-[10px] font-bold uppercase text-emerald-800">Final Inclusion Yield</div>
                      <div className="text-xl font-black text-emerald-900 mt-1">
                        {prismaAiReport.yieldMetrics.finalInclusionYield}
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Net synthesis yield</div>
                    </div>
                  </div>
                </div>

                {/* 2. Executive Synthesis Paragraph */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1.5">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    Executive Methodological Synthesis
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {prismaAiReport.executiveSummary}
                  </p>
                </div>

                {/* 2b. Extraction Outcomes Assessment */}
                {prismaAiReport.extractionOutcomesAssessment && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <Layers className="h-4 w-4 text-emerald-600" />
                        Extraction Outcomes & Field Integrity Assessment
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Score: {prismaAiReport.extractionOutcomesAssessment.extractionIntegrityScore}/100
                      </span>
                    </div>

                    <div className="text-xs text-slate-700">
                      <span className="font-bold text-slate-900">Verdict: </span>
                      {prismaAiReport.extractionOutcomesAssessment.overallVerdict}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {prismaAiReport.extractionOutcomesAssessment.fieldCompletenessNarrative}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="rounded-lg bg-white/80 p-2.5 border border-emerald-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                          Potential Biases & Coverage Limits
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                          {prismaAiReport.extractionOutcomesAssessment.potentialExtractionBiases.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg bg-white/80 p-2.5 border border-emerald-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                          Recommended Hygiene Actions
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                          {prismaAiReport.extractionOutcomesAssessment.recommendedCleaningActions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Publication-Ready Academic Methods Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      Draft Methods Section
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review the draft against your actual search, screening, and eligibility decisions before manuscript use.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyMethodology}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                  >
                    {copiedMethodology ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedMethodology ? "Copied!" : "Copy Section"}
                  </button>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-5 text-xs text-slate-700 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                  {prismaAiReport.methodologyNarrative}
                </div>

                <div className="text-[11px] text-slate-400 italic">
                  * Citation guideline: Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. doi:10.1136/bmj.n71
                </div>
              </div>

              {/* 4. Categorized Exclusions & Bias Assessment */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-rose-600" />
                    Eligibility Exclusions & Scientometric Impact Analysis
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Categorization of studies excluded at full-text assessment and rationale for maintaining topical coherence.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {prismaAiReport.exclusionReasonsSynthesis.map((ex, idx) => (
                    <div key={idx} className="rounded-xl border border-rose-100 bg-rose-50/30 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{ex.reason}</span>
                        <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[11px] font-mono font-bold">
                          n = {ex.count}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {ex.impactAssessment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. PRISMA 2020 Compliance Checklist Audit */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-emerald-600" />
                      PRISMA 2020 Checklist Review
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generated checklist notes are prompts for review, not proof of compliance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChecklistDetails(!showChecklistDetails)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {showChecklistDetails ? "Collapse Checklist" : "Expand Checklist"}
                  </button>
                </div>

                {showChecklistDetails && (
                  <div className="divide-y divide-slate-100">
                    {prismaAiReport.prismaComplianceChecklist.map((item, idx) => (
                      <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {item.itemNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{item.topic}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 ml-1 sm:ml-0">{item.notes}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shrink-0 self-start sm:self-center">
                          <Check className="h-3 w-3 text-emerald-600" />
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. Methodological Strengths, Recognized Biases & Reviewer Guidance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Protocol Strengths
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {prismaAiReport.methodologicalStrengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Limitations & Biases
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {prismaAiReport.limitationsAndBiases.map((lim, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold shrink-0">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-indigo-600" />
                    Author & Reviewer Advice
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {prismaAiReport.recommendationsForAuthors.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-500 font-bold shrink-0">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: BROWSE RECORDS */}
      {activeSubTab === "records" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search canonical records by title, author, or journal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs text-slate-800 bg-transparent focus:outline-hidden"
              />
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Showing {filteredDocs.length} of {documentTotal === null ? "Not recorded" : documentTotal.toLocaleString()} articles
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {filteredDocs.map((doc: any, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50 transition space-y-1">
                <div className="text-xs font-bold text-slate-900">
                  {doc.title || doc.TI || "Untitled Publication"}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>Authors: {Array.isArray(doc.authors) ? doc.authors.slice(0, 4).join(", ") : doc.AU ? doc.AU.slice(0, 4).join(", ") : "Unknown"}</span>
                  <span>Year: {doc.year || doc.PY || "N/A"}</span>
                  <span>Journal: {doc.source || doc.SO || "N/A"}</span>
                  <span className="font-semibold text-blue-600">Citations: {doc.citations ?? doc.TC ?? "Not recorded"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
