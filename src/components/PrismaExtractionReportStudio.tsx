import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dataset,
  ExtractionOutcomeMetrics,
  PrismaAIReport,
} from "../types.js";
import {
  Sparkles,
  Copy,
  Check,
  Download,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Award,
  BookOpen,
} from "lucide-react";
import { useAiProvider } from "../context/AiProviderContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { hasRecordedExclusions, usePrismaFlow, useVersionDocuments } from "../hooks/usePrismaFlow.js";
import { PrismaFlowDiagram, PrismaManualEditor } from "./PrismaFlowDiagram.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  dataset: Dataset;
  allDatasets: Dataset[];
  onSelectDataset?: (id: string) => void;
  onRefreshData?: () => void;
}

export function PrismaExtractionReportStudio({
  dataset,
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

  // Grade color helper using semantic tokens
  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "Optimal":
        return "bg-status-success-bg text-status-success-text border-status-success-border";
      case "Good":
        return "bg-status-info-bg text-status-info-text border-status-info-border";
      case "Acceptable":
        return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      default:
        return "bg-status-danger-bg text-status-danger-text border-status-danger-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Action Card */}
      <Card padding="lg">
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="sciai-kicker">PRISMA 2020 Systematic Protocol</span>
              <span
                className={`tabular-metrics rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${getGradeBadge(
                  extractionOutcomes.extractionFidelityGrade
                )}`}
              >
                Extraction Quality:{" "}
                {documentTotal === null || documentTotal === 0
                  ? "Not recorded"
                  : `${extractionOutcomes.extractionFidelityGrade} (${extractionOutcomes.compositeScore}/100)`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                <Sparkles className="h-3 w-3" />
                Multi-provider AI
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-ink-primary">
              PRISMA Workflow & AI Extraction Outcomes Synthesizer
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-ink-muted">
              Reviews observed metadata completeness and the canonical PRISMA 2020 selection flow
              for this dataset version. AI output is a draft; verify unrecorded steps and all
              claims against your review protocol.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFunnelEditor(!showFunnelEditor)}
              icon={<Sliders className="h-3.5 w-3.5 text-ink-subtle" />}
            >
              <span>Adjust Funnel Counts</span>
              {showFunnelEditor ? (
                <ChevronUp className="h-3.5 w-3.5 text-ink-subtle" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              )}
            </Button>

            <Button
              type="button"
              id="generate-prisma-ai-report-btn"
              variant="primary"
              size="sm"
              loading={isGenerating}
              disabled={isGenerating || !prisma.flow?.consistency.valid || !prisma.version}
              onClick={handleGenerateReport}
              icon={!isGenerating ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
            >
              {isGenerating
                ? "Synthesizing Extraction Outcomes..."
                : "Generate AI PRISMA Report"}
            </Button>
          </div>
        </div>

        {/* Real-time Extraction Outcomes Telemetry Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="sciai-kicker">Total Extracted</div>
            <div className="tabular-metrics mt-1 text-base font-black text-ink-primary">
              {documentTotal === null
                ? "Not recorded"
                : extractionOutcomes.totalRecordsExtracted.toLocaleString()}
            </div>
            <div className="truncate text-[10px] text-ink-muted">
              {Object.keys(extractionOutcomes.sourceDistribution).join(", ") || "Raw records"}
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              <span>DOI Resolution</span>
              <span className="tabular-metrics font-mono text-ink-primary">
                {documentTotal === null || documentTotal === 0
                  ? "Not recorded"
                  : `${extractionOutcomes.doiCoveragePct}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-status-success-text"
                style={{ width: `${documentTotal ? extractionOutcomes.doiCoveragePct : 0}%` }}
              />
            </div>
            <div className="tabular-metrics mt-1 text-[10px] text-ink-muted">
              {documentTotal === null
                ? "Not recorded"
                : extractionOutcomes.recordsWithDoi.toLocaleString()}{" "}
              with valid DOI
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              <span>Abstract Capture</span>
              <span className="tabular-metrics font-mono text-ink-primary">
                {documentTotal === null || documentTotal === 0
                  ? "Not recorded"
                  : `${extractionOutcomes.abstractCoveragePct}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-status-info-text"
                style={{ width: `${documentTotal ? extractionOutcomes.abstractCoveragePct : 0}%` }}
              />
            </div>
            <div className="tabular-metrics mt-1 text-[10px] text-ink-muted">
              {documentTotal === null
                ? "Not recorded"
                : extractionOutcomes.recordsWithAbstract.toLocaleString()}{" "}
              text abstracts
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              <span>Keywords Indexed</span>
              <span className="tabular-metrics font-mono text-ink-primary">
                {documentTotal === null || documentTotal === 0
                  ? "Not recorded"
                  : `${extractionOutcomes.keywordsCoveragePct}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${documentTotal ? extractionOutcomes.keywordsCoveragePct : 0}%` }}
              />
            </div>
            <div className="tabular-metrics mt-1 text-[10px] text-ink-muted">
              {documentTotal === null
                ? "Not recorded"
                : extractionOutcomes.recordsWithKeywords.toLocaleString()}{" "}
              parsed terms
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              <span>Author Entities</span>
              <span className="tabular-metrics font-mono text-ink-primary">
                {documentTotal === null || documentTotal === 0
                  ? "Not recorded"
                  : `${extractionOutcomes.authorsCoveragePct}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${documentTotal ? extractionOutcomes.authorsCoveragePct : 0}%` }}
              />
            </div>
            <div className="tabular-metrics mt-1 text-[10px] text-ink-muted">
              {documentTotal === null
                ? "Not recorded"
                : extractionOutcomes.recordsWithAuthors.toLocaleString()}{" "}
              attributed
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
            <div className="sciai-kicker">Temporal Horizon</div>
            <div className="tabular-metrics mt-1 flex items-center gap-1 text-sm font-bold text-ink-primary">
              <Calendar className="h-3.5 w-3.5 text-ink-subtle" />
              {extractionOutcomes.yearSpan}
            </div>
            <div className="text-[10px] text-ink-muted">Publication range</div>
          </div>
        </div>

        {showFunnelEditor && (
          <div className="mt-5 rounded-xl border border-border-default bg-surface-subtle p-4">
            <h3 className="sciai-kicker mb-3">Recorded study-selection counts</h3>
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
      </Card>

      {(prisma.error || documentsError) && (
        <AlertBanner tone="danger">{prisma.error || documentsError}</AlertBanner>
      )}
      {isLoadingDocs && (
        <p className="text-xs text-ink-muted">Loading all records for extraction metrics...</p>
      )}

      {/* Error alert if AI generation fails */}
      {reportError && (
        <AlertBanner tone="danger" title="AI Synthesis Notice">
          {reportError}
        </AlertBanner>
      )}

      {/* Main Grid: Left Column Visual Flowchart & Yield KPIs, Right Column AI Report */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Visual PRISMA 2020 Flowchart & Quantitative Funnel */}
        <div className="space-y-4 lg:col-span-5">
          <Card padding="md">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <div className="sciai-kicker">Visual Flowchart</div>
                <h3 className="text-sm font-bold text-ink-primary">PRISMA 2020 Flow Diagram</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportSvg}
                icon={<Download className="h-3 w-3 text-ink-subtle" />}
              >
                Export SVG
              </Button>
            </div>

            <div className="mt-4">
              <PrismaFlowDiagram
                ref={svgRef}
                flow={prisma.flow}
                reasonsRecorded={hasRecordedExclusions(prisma.version)}
              />
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
        </div>

        {/* Right Column: AI-Powered Summary & Descriptive Report */}
        <div className="space-y-4 lg:col-span-7">
          {report ? (
            <div className="space-y-4">
              {/* Executive Summary Card */}
              <Card padding="lg">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-brand-200 bg-brand-50 text-xs font-bold text-brand-600">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-ink-primary">
                      AI Executive Extraction & Yield Summary
                    </h3>
                  </div>
                  <span className="tabular-metrics font-mono text-[10px] text-ink-subtle">
                    {new Date(report.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                  {report.executiveSummary}
                </p>

                {/* Yield Metrics Strip */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3 text-center sm:grid-cols-5">
                  <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                    <div className="sciai-kicker text-[9px]!">Identified</div>
                    <div className="tabular-metrics mt-0.5 text-xs font-black text-ink-primary">
                      {report.yieldMetrics.totalIdentified?.toLocaleString() ?? "Not recorded"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                    <div className="sciai-kicker text-[9px]!">Duplicate Attrition</div>
                    <div className="tabular-metrics mt-0.5 text-xs font-black text-ink-primary">
                      {report.yieldMetrics.duplicateAttritionRate}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                    <div className="sciai-kicker text-[9px]!">Screening Attrition</div>
                    <div className="tabular-metrics mt-0.5 text-xs font-black text-ink-primary">
                      {report.yieldMetrics.screeningAttritionRate}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                    <div className="sciai-kicker text-[9px]!">Retrieval Rate</div>
                    <div className="tabular-metrics mt-0.5 text-xs font-black text-ink-primary">
                      {report.yieldMetrics.retrievalSuccessRate}
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg border border-status-success-border bg-status-success-bg p-2 sm:col-span-1">
                    <div className="sciai-kicker text-[9px]! text-status-success-text!">
                      Net Inclusion
                    </div>
                    <div className="tabular-metrics mt-0.5 text-xs font-black text-status-success-text">
                      {report.yieldMetrics.finalInclusionYield}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Data Extraction Outcomes Quality Assessment */}
              {report.extractionOutcomesAssessment && (
                <Card padding="md">
                  <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                    <Layers className="h-4 w-4 text-status-success-text" />
                    <h3 className="text-sm font-bold text-ink-primary">
                      Data Extraction Outcomes Assessment & Field Quality
                    </h3>
                  </div>
                  <div className="mt-3 space-y-3 text-xs">
                    <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3 text-ink-secondary">
                      <span className="font-bold text-ink-primary">Integrity Verdict: </span>
                      {report.extractionOutcomesAssessment.overallVerdict}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-status-warning-border bg-status-warning-bg/50 p-3">
                        <div className="sciai-kicker mb-1 text-status-warning-text!">
                          Potential Extraction Biases
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                          {report.extractionOutcomesAssessment.potentialExtractionBiases.map(
                            (b, i) => (
                              <li key={i}>{b}</li>
                            )
                          )}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-status-success-border bg-status-success-bg/50 p-3">
                        <div className="sciai-kicker mb-1 text-status-success-text!">
                          Recommended Hygiene Actions
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                          {report.extractionOutcomesAssessment.recommendedCleaningActions.map(
                            (a, i) => (
                              <li key={i}>{a}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Multi-Tab Descriptive Report Card */}
              <Card padding="md">
                {/* Sub-tab switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("methods")}
                      className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                        activeNarrativeTab === "methods"
                          ? "bg-brand-500 text-white shadow-xs"
                          : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                      }`}
                    >
                      Methods Narrative
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("checklist")}
                      className={`tabular-metrics cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                        activeNarrativeTab === "checklist"
                          ? "bg-brand-500 text-white shadow-xs"
                          : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                      }`}
                    >
                      PRISMA Checklist ({report.prismaComplianceChecklist.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNarrativeTab("recommendations")}
                      className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                        activeNarrativeTab === "recommendations"
                          ? "bg-brand-500 text-white shadow-xs"
                          : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                      }`}
                    >
                      Strengths & Reviewer Tips
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyMethods}
                      icon={
                        copiedMethods ? (
                          <Check className="h-3 w-3 text-status-success-text" />
                        ) : (
                          <Copy className="h-3 w-3 text-ink-subtle" />
                        )
                      }
                    >
                      {copiedMethods ? "Copied!" : "Copy Methods"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadMarkdown}
                      icon={<Download className="h-3 w-3 text-ink-subtle" />}
                    >
                      Download .md
                    </Button>
                  </div>
                </div>

                {/* Tab 1: Publication-Ready Academic Methods Narrative */}
                {activeNarrativeTab === "methods" && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                      <div className="max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-primary">
                        {report.methodologyNarrative}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-subtle">
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
                        className="rounded-xl border border-border-subtle bg-surface-subtle p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-ink-primary">
                            {item.itemNumber}: {item.topic}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" />
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-ink-muted">{item.notes}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Strengths, Limitations & Recommendations */}
                {activeNarrativeTab === "recommendations" && (
                  <div className="mt-4 space-y-4 text-xs">
                    <div>
                      <h4 className="mb-1.5 flex items-center gap-1.5 font-bold text-ink-primary">
                        <Award className="h-3.5 w-3.5 text-status-success-text" />
                        Methodological Strengths
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                        {report.methodologicalStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-border-subtle pt-3">
                      <h4 className="mb-1.5 flex items-center gap-1.5 font-bold text-ink-primary">
                        <AlertCircle className="h-3.5 w-3.5 text-status-warning-text" />
                        Limitations & Biases to Disclose
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                        {report.limitationsAndBiases.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-border-subtle pt-3">
                      <h4 className="mb-1.5 flex items-center gap-1.5 font-bold text-ink-primary">
                        <BookOpen className="h-3.5 w-3.5 text-brand-500" />
                        Recommendations for Reviewer Rebuttal
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-secondary">
                        {report.recommendationsForAuthors.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            /* Pre-generation Call to Action State */
            <div className="rounded-2xl border border-dashed border-border-default bg-surface-subtle p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-ink-primary">
                Generate AI PRISMA 2020 Descriptive Report
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
                Synthesizes current data extraction outcomes (
                {documentTotal === null
                  ? "Not recorded"
                  : extractionOutcomes.totalRecordsExtracted.toLocaleString()}{" "}
                documents) into an academic manuscript methodology section, PRISMA 2020 checklist
                audit, and yield KPIs.
              </p>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={isGenerating}
                disabled={isGenerating || !prisma.flow?.consistency.valid || !prisma.version}
                onClick={handleGenerateReport}
                icon={!isGenerating ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
                className="mt-4"
              >
                {isGenerating
                  ? "Analyzing Current Extraction Outcomes..."
                  : "Synthesize PRISMA Report Now"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}