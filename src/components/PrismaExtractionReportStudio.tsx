import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dataset,
  BibliometricDocument,
  ExtractionOutcomeMetrics,
  PrismaAIReport,
} from "../types.js";
import {
  Sparkles,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Database,
  CheckCircle2,
  Calendar,
  Layers,
  Award,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useAiProvider } from "../context/AiProviderContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { hasRecordedExclusions, usePrismaFlow, useVersionDocuments } from "../hooks/usePrismaFlow.js";
import { PrismaFlowDiagram, PrismaManualEditor } from "./PrismaFlowDiagram.js";

interface Props {
  dataset: Dataset;
  allDatasets: Dataset[];
  onSelectDataset?: (id: string) => void;
  onRefreshData?: () => void;
}

export function PrismaExtractionReportStudio({
  dataset,
  allDatasets = [],
  onSelectDataset,
  
  onRefreshData,
}: Props) {
  const { getAiRequestOptions } = useAiProvider();
  const prisma = usePrismaFlow(dataset?.id || "");
  const { documents, loading: isLoadingDocs, error: documentsError, total: documentTotal } = useVersionDocuments(dataset?.id || "", prisma.version?.id);
  const [showFunnelEditor, setShowFunnelEditor] = useState(false);
  const [activeNarrativeTab, setActiveNarrativeTab] = useState<"methods" | "outcomes" | "checklist" | "recommendations">("methods");

  // AI Report Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<PrismaAIReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedMethods, setCopiedMethods] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportRequestId = useRef(0);

  useEffect(() => {
    reportRequestId.current++;
    setIsGenerating(false);
    setReport(null);
    setReportError(null);
  }, [dataset?.id, prisma.version?.id, prisma.flow?.computed_at]);

  useEffect(() => setShowFunnelEditor(false), [dataset?.id]);

  // Compute live data extraction outcomes & field completeness
  const extractionOutcomes: ExtractionOutcomeMetrics = useMemo(() => {
    const docCount = documents.length;
    const total = docCount;

    let withDoi = 0;
    let withAbstract = 0;
    let withKeywords = 0;
    let withAuthors = 0;
    const years: number[] = [];
    const sourceDist: Record<string, number> = {};

    for (const d of documents) {
      if (d.doi && d.doi.trim().length > 3) withDoi++;
      if (d.abstract && d.abstract.trim().length > 20) withAbstract++;
      if ((d.keywords && d.keywords.length > 0) || (d.author_keywords && d.author_keywords.length > 0)) withKeywords++;
      if (d.authors && d.authors.length > 0) withAuthors++;
      if (d.year && d.year > 1800 && d.year < 2100) years.push(d.year);
      const src = d.source_database || dataset?.source || "Unspecified source";
      sourceDist[src] = (sourceDist[src] || 0) + 1;
    }

    const doiCoveragePct = Math.min(100, total ? Math.round((withDoi / total) * 100) : 0);
    const abstractCoveragePct = Math.min(100, total ? Math.round((withAbstract / total) * 100) : 0);
    const keywordsCoveragePct = Math.min(100, total ? Math.round((withKeywords / total) * 100) : 0);
    const authorsCoveragePct = Math.min(100, total ? Math.round((withAuthors / total) * 100) : 0);

    const yearSpan = years.length ? `${Math.min(...years)} - ${Math.max(...years)}` : "Not recorded";

    // Composite Score: 35% DOI, 30% Abstract, 20% Authors, 15% Keywords
    const compositeScore = Math.round(
      doiCoveragePct * 0.35 +
        abstractCoveragePct * 0.3 +
        authorsCoveragePct * 0.2 +
        keywordsCoveragePct * 0.15
    );

    let extractionFidelityGrade: "Optimal" | "Good" | "Acceptable" | "Incomplete" = "Incomplete";
    if (compositeScore >= 90) extractionFidelityGrade = "Optimal";
    else if (compositeScore >= 75) extractionFidelityGrade = "Good";
    else if (compositeScore >= 60) extractionFidelityGrade = "Acceptable";

    return {
      totalRecordsExtracted: total,
      recordsWithDoi: withDoi,
      recordsWithAbstract: withAbstract,
      recordsWithKeywords: withKeywords,
      recordsWithAuthors: withAuthors,
      doiCoveragePct,
      abstractCoveragePct,
      keywordsCoveragePct,
      authorsCoveragePct,
      yearSpan,
      sourceDistribution: sourceDist,
      extractionFidelityGrade,
      compositeScore,
    };
  }, [documents, dataset]);

  const handleGenerateReport = async () => {
    if (!dataset?.id || !prisma.version?.id || !prisma.flow?.consistency.valid) return;
    const requestId = ++reportRequestId.current;
    setIsGenerating(true);
    setReportError(null);
    try {
      const data = await apiJson<{ report?: PrismaAIReport }>("/api/ai/prisma-report", {
        dataset_id: dataset.id,
        dataset_version_id: prisma.version.id,
        ...getAiRequestOptions(),
      });
      if (!data.report) throw new Error("No report returned by analysis engine");
      if (requestId === reportRequestId.current) setReport(data.report);
    } catch (err: unknown) {
      if (requestId === reportRequestId.current) setReportError(getApiErrorMessage(err, "Failed to generate PRISMA report."));
    } finally {
      if (requestId === reportRequestId.current) setIsGenerating(false);
    }
  };

  // Copy Methods Markdown Narrative
  const handleCopyMethods = () => {
    if (!report?.methodologyNarrative) return;
    navigator.clipboard.writeText(report.methodologyNarrative);
    setCopiedMethods(true);
    setTimeout(() => setCopiedMethods(false), 2000);
  };

  // Download Full Markdown Report
  const handleDownloadMarkdown = () => {
    if (!report) return;
    const content = `# Systematic Review Methodology & PRISMA 2020 Report
**Corpus**: ${report.datasetName}
**Generated**: ${new Date(report.generatedAt).toLocaleString()}
**Protocol**: Page MJ, et al. PRISMA 2020 statement. BMJ 2021;372:n71.

---

## 1. Executive Summary
${report.executiveSummary}

---

## 2. Data Extraction Outcomes & Integrity Assessment
${report.extractionOutcomesAssessment ? `
- **Overall Verdict**: ${report.extractionOutcomesAssessment.overallVerdict}
- **Field Completeness**: ${report.extractionOutcomesAssessment.fieldCompletenessNarrative}
- **Integrity Score**: ${report.extractionOutcomesAssessment.extractionIntegrityScore}/100

### Potential Extraction Biases
${report.extractionOutcomesAssessment.potentialExtractionBiases.map((b) => `- ${b}`).join("\n")}

### Recommended Hygiene Actions
${report.extractionOutcomesAssessment.recommendedCleaningActions.map((a) => `- ${a}`).join("\n")}
` : `
- Total Extracted: ${extractionOutcomes.totalRecordsExtracted}
- DOI Coverage: ${documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.doiCoveragePct}%`}
- Abstract Completeness: ${documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.abstractCoveragePct}%`}
- Author Coverage: ${documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.authorsCoveragePct}%`}
`}

---

## 3. Draft Methods Section
${report.methodologyNarrative}

---

## 4. Quantitative Yield & Attrition Metrics
- Total Identified: ${(report.yieldMetrics.totalIdentified?.toLocaleString() ?? "Not recorded")}
- Duplicate Attrition Rate: ${report.yieldMetrics.duplicateAttritionRate}
- Screening Attrition Rate: ${report.yieldMetrics.screeningAttritionRate}
- Retrieval Success Rate: ${report.yieldMetrics.retrievalSuccessRate}
- Eligibility Retention Rate: ${report.yieldMetrics.eligibilityRetentionRate}
- Final Net Inclusion Yield: ${report.yieldMetrics.finalInclusionYield}

---

## 5. PRISMA 2020 Checklist Audit
${report.prismaComplianceChecklist
  .map((c) => `- **${c.itemNumber} (${c.topic})**: [${c.status}] ${c.notes}`)
  .join("\n")}

---

## 6. Methodological Strengths
${report.methodologicalStrengths.map((s) => `- ${s}`).join("\n")}

---

## 7. Limitations & Potential Biases
${report.limitationsAndBiases.map((l) => `- ${l}`).join("\n")}

---

## 8. Recommendations for Authors
${report.recommendationsForAuthors.map((r) => `- ${r}`).join("\n")}
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PRISMA-2020-Report-${dataset.name.replace(/\s+/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export PRISMA Flowchart as SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PRISMA-2020-Flowchart-${dataset.name.replace(/\s+/g, "_")}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Grade color helper
  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "Optimal":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Good":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "Acceptable":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Action Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                PRISMA 2020 Systematic Protocol
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold ${getGradeBadge(
                  extractionOutcomes.extractionFidelityGrade
                )}`}
              >
                Extraction Quality: {documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.extractionFidelityGrade} (${extractionOutcomes.compositeScore}/100)`}
              </span>
              <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Multi-provider AI
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              PRISMA Workflow & AI Extraction Outcomes Synthesizer
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Reviews observed metadata completeness and the canonical PRISMA 2020 selection flow for this dataset version. AI output is a draft; verify unrecorded steps and all claims against your review protocol.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFunnelEditor(!showFunnelEditor)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-400" />
              Adjust Funnel Counts
              {showFunnelEditor ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              id="generate-prisma-ai-report-btn"
              onClick={handleGenerateReport}
              disabled={isGenerating || !prisma.flow?.consistency.valid || !prisma.version}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-60 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Synthesizing Extraction Outcomes...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  Generate AI PRISMA Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Extraction Outcomes Telemetry Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Extracted
            </div>
            <div className="mt-1 text-base font-black text-slate-900">
              {documentTotal === null ? "Not recorded" : extractionOutcomes.totalRecordsExtracted.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {Object.keys(extractionOutcomes.sourceDistribution).join(", ") || "Raw records"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>DOI Resolution</span>
              <span className="text-slate-900 font-mono">{documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.doiCoveragePct}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${documentTotal ? extractionOutcomes.doiCoveragePct : 0}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {documentTotal === null ? "Not recorded" : extractionOutcomes.recordsWithDoi.toLocaleString()} with valid DOI
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Abstract Capture</span>
              <span className="text-slate-900 font-mono">{documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.abstractCoveragePct}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${documentTotal ? extractionOutcomes.abstractCoveragePct : 0}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {documentTotal === null ? "Not recorded" : extractionOutcomes.recordsWithAbstract.toLocaleString()} text abstracts
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Keywords Indexed</span>
              <span className="text-slate-900 font-mono">{documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.keywordsCoveragePct}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${documentTotal ? extractionOutcomes.keywordsCoveragePct : 0}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {documentTotal === null ? "Not recorded" : extractionOutcomes.recordsWithKeywords.toLocaleString()} parsed terms
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Author Entities</span>
              <span className="text-slate-900 font-mono">{documentTotal === null || documentTotal === 0 ? "Not recorded" : `${extractionOutcomes.authorsCoveragePct}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-violet-600 rounded-full"
                style={{ width: `${documentTotal ? extractionOutcomes.authorsCoveragePct : 0}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {documentTotal === null ? "Not recorded" : extractionOutcomes.recordsWithAuthors.toLocaleString()} attributed
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Temporal Horizon
            </div>
            <div className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {extractionOutcomes.yearSpan}
            </div>
            <div className="text-[10px] text-slate-500">
              Publication range
            </div>
          </div>
        </div>

        {showFunnelEditor && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Recorded study-selection counts</h3>
            <PrismaManualEditor flow={prisma.flow} draft={prisma.draft} saving={prisma.saving} error={prisma.error} reasonsRecorded={hasRecordedExclusions(prisma.version)} onFieldChange={prisma.updateField} onReasonsChange={prisma.updateReasons} onSave={prisma.save} />
          </div>
        )}
      </div>

      {(prisma.error || documentsError) && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{prisma.error || documentsError}</p>}
      {isLoadingDocs && <p className="text-xs text-slate-500">Loading all records for extraction metrics...</p>}

      {/* Error alert if AI generation fails */}
      {reportError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">
            <span className="font-bold">AI Synthesis Notice:</span> {reportError}
          </div>
        </div>
      )}

      {/* Main Grid: Left Column Visual Flowchart & Yield KPIs, Right Column AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual PRISMA 2020 Flowchart & Quantitative Funnel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Visual Flowchart
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  PRISMA 2020 Flow Diagram
                </h3>
              </div>
              <button
                type="button"
                onClick={handleExportSvg}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Download className="h-3 w-3 text-slate-400" />
                Export SVG
              </button>
            </div>

            <div className="mt-4">
              <PrismaFlowDiagram ref={svgRef} flow={prisma.flow} reasonsRecorded={hasRecordedExclusions(prisma.version)} />
            </div>
            {prisma.flow && !prisma.flow.consistency.valid && <p role="alert" className="mt-3 text-xs text-rose-700">{prisma.flow.consistency.errors.join("; ")}</p>}
            {prisma.flow?.consistency.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}
          </div>
         
        </div>

        {/* Right Column: AI-Powered Summary & Descriptive Report */}
        <div className="lg:col-span-7 space-y-4">
          {report ? (
            <div className="space-y-4">
              {/* Executive Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">
                      AI Executive Extraction & Yield Summary
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(report.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-700 leading-relaxed font-normal">
                  {report.executiveSummary}
                </p>

                {/* Yield Metrics Strip */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Identified</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">
                      {(report.yieldMetrics.totalIdentified?.toLocaleString() ?? "Not recorded")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Duplicate Attrition</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">
                      {report.yieldMetrics.duplicateAttritionRate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Screening Attrition</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">
                      {report.yieldMetrics.screeningAttritionRate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Retrieval Rate</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">
                      {report.yieldMetrics.retrievalSuccessRate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 col-span-2 sm:col-span-1">
                    <div className="text-[9px] uppercase font-bold text-emerald-700">Net Inclusion</div>
                    <div className="text-xs font-black text-emerald-800 mt-0.5">
                      {report.yieldMetrics.finalInclusionYield}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Extraction Outcomes Quality Assessment */}
              {report.extractionOutcomesAssessment && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Data Extraction Outcomes Assessment & Field Quality
                    </h3>
                  </div>
                  <div className="mt-3 space-y-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                      <span className="font-bold text-slate-900">Integrity Verdict: </span>
                      {report.extractionOutcomesAssessment.overallVerdict}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                          Potential Extraction Biases
                        </div>
                        <ul className="space-y-1 text-[11px] text-amber-900 list-disc list-inside">
                          {report.extractionOutcomesAssessment.potentialExtractionBiases.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                          Recommended Hygiene Actions
                        </div>
                        <ul className="space-y-1 text-[11px] text-emerald-900 list-disc list-inside">
                          {report.extractionOutcomesAssessment.recommendedCleaningActions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Tab Descriptive Report Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                {/* Sub-tab switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("methods")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeNarrativeTab === "methods"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Methods Narrative
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("checklist")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeNarrativeTab === "checklist"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      PRISMA Checklist ({report.prismaComplianceChecklist.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("recommendations")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeNarrativeTab === "recommendations"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Strengths & Reviewer Tips
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMethods}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {copiedMethods ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-400" />
                          Copy Methods
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <Download className="h-3 w-3 text-slate-400" />
                      Download .md
                    </button>
                  </div>
                </div>

                {/* Tab 1: Publication-Ready Academic Methods Narrative */}
                {activeNarrativeTab === "methods" && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-100">
                      <div className="prose prose-slate prose-xs max-w-none text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                        {report.methodologyNarrative}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>PRISMA 2020 reference: Page MJ et al., BMJ 2021;372:n71</span>
                      <span className="font-mono">Verify before submission</span>
                    </div>
                  </div>
                )}

                {/* Tab 2: PRISMA 2020 Compliance Checklist */}
                {activeNarrativeTab === "checklist" && (
                  <div className="mt-4 space-y-2">
                    {report.prismaComplianceChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {item.itemNumber}: {item.topic}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 text-[11px]">{item.notes}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Strengths, Limitations & Recommendations */}
                {activeNarrativeTab === "recommendations" && (
                  <div className="mt-4 space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-emerald-600" />
                        Methodological Strengths
                      </h4>
                      <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                        {report.methodologicalStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        Limitations & Biases to Disclose
                      </h4>
                      <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                        {report.limitationsAndBiases.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                        Recommendations for Reviewer Rebuttal
                      </h4>
                      <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                        {report.recommendationsForAuthors.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Pre-generation Call to Action State */
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-2xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Generate AI PRISMA 2020 Descriptive Report
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Synthesizes current data extraction outcomes ({documentTotal === null ? "Not recorded" : extractionOutcomes.totalRecordsExtracted.toLocaleString()} documents) into an academic manuscript methodology section, PRISMA 2020 checklist audit, and yield KPIs.
              </p>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGenerating || !prisma.flow?.consistency.valid || !prisma.version}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Analyzing Current Extraction Outcomes...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    Synthesize PRISMA Report Now
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
