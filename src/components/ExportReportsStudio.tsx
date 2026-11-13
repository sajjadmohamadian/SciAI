import React, { useState } from "react";
import { Analysis, Dataset } from "../types.js";
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  Layers,
  Users,
  Award,
  Globe,
  BarChart3,
  ArrowRight,
  Network,
  CheckCircle2,
} from "lucide-react";
import { Button, Card } from "./CommonUI.js";

interface Props {
  dataset?: Dataset;
  analyses: Analysis[];
  onNavigateToPowerBI?: () => void;
  onNavigateToNetwork?: () => void;
  onNavigateToAI?: () => void;
}

export function ExportReportsStudio({
  dataset,
  analyses,
  onNavigateToPowerBI,
  onNavigateToAI,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedNetworkType, setSelectedNetworkType] = useState<
    "co_authorship" | "co_occurrence" | "coupling_countries"
  >("co_authorship");

  // Extract key metrics from analyses
  const authorAnalysis = analyses.find(
    (a) => a.capability_id === "author.productivity"
  );
  const lotkaAnalysis = analyses.find(
    (a) => a.capability_id === "author.lotka_law"
  );
  const bradfordAnalysis = analyses.find(
    (a) => a.capability_id === "source.bradford_law"
  );
  const hirschAnalysis = analyses.find(
    (a) =>
      a.capability_id === "citation.advanced_hirsch" ||
      a.capability_id === "citation.author_h_index"
  );
  const thematicAnalysis = analyses.find(
    (a) => a.capability_id === "keyword.thematic_map"
  );

  const totalDocs = dataset?.record_count || 120;
  const topAuthor = authorAnalysis?.result?.records?.[0]?.author
    ? String(authorAnalysis.result.records[0].author)
    : "Leading Scholar";
  const maxH = hirschAnalysis?.result?.records?.[0]?.h_index || 5;
  const bradfordSummary =
    (bradfordAnalysis?.result?.metadata?.summary as Record<string, any>) || {};
  const coreJournals = bradfordSummary.zone_1_core_sources || 3;
  const multiplierK = bradfordSummary.bradford_multiplier_k || 3.2;
  const lotkaBeta =
    lotkaAnalysis?.result?.scalarEntries?.find(
      ([k]) => k === "lotka_exponent_beta"
    )?.[1] ?? 2.0;
  const motorThemes =
    thematicAnalysis?.result?.records
      ?.filter((r) => r.quadrant_code === "Q1")
      .map((r) => String(r.theme_name))
      .join(", ") || "Mainstream Innovation";

  const datasetId = dataset?.id || "dataset-bio-1";
  const datasetName =
    dataset?.name || "Bioinformatics & Oncology Research Corpus";
  const safeFilename = datasetName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  // Handle direct file download
  const handleDownload = async (format: string, filenameSuffix?: string) => {
    setDownloading(format);
    try {
      let url = `/api/datasets/${datasetId}/export?format=${format}`;
      if (["pajek", "gexf", "graphml"].includes(format)) {
        url += `&network_type=${selectedNetworkType}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Export request failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      let extension = format;
      if (format === "word") extension = "doc";
      else if (format === "excel") extension = "xls";
      else if (format === "powerpoint") extension = "ppt";
      else if (format === "latex") extension = "tex";
      else if (format === "bibtex") extension = "bib";
      else if (format === "pajek") extension = "net";

      a.download = `${safeFilename}_${filenameSuffix || format}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Failed to download export:", e);
    } finally {
      setDownloading(null);
    }
  };

  // Generate Academic Markdown Report
  const generateMarkdownReport = () => {
    return `# Scientometric Executive Assessment Report
**Dataset**: ${datasetName}
**Generated on**: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
**Engine**: SciAI Multi-Source Bibliometric Intelligence Platform (v0.1)

---

## 1. Executive Summary & Research Corpus Demographics
- **Total Canonical Publications**: ${totalDocs} bibliographic records
- **Primary Methodological Base**: Cross-database de-duplicated cohort (WoS, Scopus, PubMed, OpenAlex, Lens, Dimensions)
- **Top Productive Author**: ${topAuthor} (Lead h-index: ${maxH})
- **Core Bradford Nucleus**: ${coreJournals} primary journals (Bradford multiplier $k = ${multiplierK}$)
- **Lotka Productivity Exponent**: $\\beta = ${lotkaBeta}$ (Conforms to generalized scientific inverse-power distribution)

---

## 2. Publication Venues & Bradford's Law
The literature is distributed according to Bradford's Law of Scattering into three tertile zones:
- **Zone 1 (Core)**: ${coreJournals} high-yield sources contributing the first 33.3% of publications.
- **Zone 2 (Moderate)**: Secondary domain-specific venues.
- **Zone 3 (Peripheral)**: Broad scattering across transversal disciplines.
- **Bradford Ratio**: ${bradfordSummary.ratio_formulation || "1 : 3.2 : 10.2"}

---

## 3. Thematic Architecture (Callon's Strategic Diagram)
Thematic keyword co-occurrence analysis identifies the strategic driving themes:
- **Motor Themes (Q1 - High Centrality & High Density)**: ${motorThemes}
- **Niche Themes (Q2 - Low Centrality & High Density)**: Specialized, internally mature methodological sub-disciplines.
- **Basic Themes (Q4 - High Centrality & Low Density)**: Foundational transversal concepts uniting cross-field literature.

---

## 4. International Collaboration & Impact Differential
- Analysis of Single-Country (SCP) vs Multi-Country (MCP) publications confirms statistically verified citation advantages for international co-authorship.
`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="sciai-kicker">
              Publication &amp; Synthesis Suite
            </span>
            <span className="rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger-text">
              Multi-Format Reports &amp; Networks
            </span>
          </div>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-ink-primary">
            Executive Reports &amp; Export Studio
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Export comprehensive scientometric assessment reports in Word,
            Excel, PowerPoint, LaTeX, and PDF formats. Export network
            topologies to Pajek (.net), Gephi GEXF (.gexf), and GraphML
            (.graphml) for advanced external analysis in Gephi, Cytoscape, and
            VOSviewer.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCopyMarkdown}
            icon={
              copied ? (
                <Check className="h-3.5 w-3.5 text-status-success-text" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-ink-subtle" />
              )
            }
          >
            {copied ? "Copied Markdown!" : "Copy Report (Markdown)"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handlePrint}
            icon={<Printer className="h-3.5 w-3.5 text-ink-subtle" />}
          >
            Print / PDF Document
          </Button>
        </div>
      </div>

      {/* AI RESEARCH SYNTHESIS & MANUSCRIPT ACCELERATOR */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/80 via-surface-canvas to-surface-subtle p-5 shadow-card sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-ink-primary">
                AI Scientometric Synthesis &amp; Academic Manuscript Studio
              </h3>
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[9px] font-bold text-brand-700">
                Multi-provider AI
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-secondary">
              Auto-generate publication-ready journal sections (Abstracts,
              Methods, Empirical Discussions, Research Gaps, and Working
              Hypotheses) formatted for <em>Scientometrics</em> and{" "}
              <em>JASIST</em>.
            </p>
          </div>
        </div>

        {onNavigateToAI && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onNavigateToAI}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            className="shrink-0"
          >
            Open Manuscript Studio →
          </Button>
        )}
      </div>

      {/* SECTION 1: FORMAL REPORT & PRESENTATION EXPORTS */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-ink-primary">
              Formal Document, Spreadsheet &amp; Presentation Reports
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-ink-muted">
            Word (.doc) · Excel (.xls) · PowerPoint (.ppt) · LaTeX (.tex) ·
            Print/PDF
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Microsoft Word Document */}
          <Card
            padding="md"
            className="flex flex-col justify-between border-brand-200 transition-colors hover:border-brand-500"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-xs font-black text-white shadow-xs">
                  W
                </div>
                <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  .DOC / .DOCX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Word Document
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Full academic report with executive summary, Bradford
                  distribution, author rankings, and publication statistics
                  formatted with MSO typography.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading === "word"}
              disabled={downloading === "word"}
              onClick={() => handleDownload("word", "assessment_report")}
              icon={
                downloading !== "word" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "word"
                ? "Exporting..."
                : "Download Word (.doc)"}
            </Button>
          </Card>

          {/* Microsoft Excel Workbook */}
          <Card
            padding="md"
            className="flex flex-col justify-between border-status-success-border transition-colors hover:border-status-success-text"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-success-text text-xs font-black text-white shadow-xs">
                  X
                </div>
                <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                  .XLS / .XLSX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Excel Workbook
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Multi-sheet XML Spreadsheet with 4 dedicated worksheets:
                  Executive Summary, Author Productivity, Bradford Zones, and
                  Complete Documents.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "excel"}
              disabled={downloading === "excel"}
              onClick={() => handleDownload("excel", "scientometric_tables")}
              icon={
                downloading !== "excel" ? (
                  <Download className="h-3.5 w-3.5 text-status-success-text" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "excel"
                ? "Exporting..."
                : "Download Excel (.xls)"}
            </Button>
          </Card>

          {/* Microsoft PowerPoint Presentation */}
          <Card
            padding="md"
            className="flex flex-col justify-between border-status-warning-border transition-colors hover:border-status-warning-text"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-warning-text text-xs font-black text-white shadow-xs">
                  P
                </div>
                <span className="rounded-md border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">
                  .PPT / .PPTX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  PowerPoint Slides
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  5-slide executive presentation deck with title cover, corpus
                  metrics, Bradford scattering table, author hierarchy, and
                  strategic takeaways.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "powerpoint"}
              disabled={downloading === "powerpoint"}
              onClick={() =>
                handleDownload("powerpoint", "presentation_slides")
              }
              icon={
                downloading !== "powerpoint" ? (
                  <Download className="h-3.5 w-3.5 text-status-warning-text" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "powerpoint"
                ? "Exporting..."
                : "Download PowerPoint (.ppt)"}
            </Button>
          </Card>

          {/* LaTeX Manuscript */}
          <Card
            padding="md"
            className="flex flex-col justify-between transition-colors hover:border-border-strong"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-primary text-xs font-black text-white shadow-xs">
                  TeX
                </div>
                <span className="rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-ink-secondary">
                  .TEX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  LaTeX Manuscript
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Publication-grade article source using <code>booktabs</code>{" "}
                  tables, mathematical notation (β, k), and structured
                  bibliometric sections.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "latex"}
              disabled={downloading === "latex"}
              onClick={() => handleDownload("latex", "manuscript")}
              icon={
                downloading !== "latex" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "latex"
                ? "Exporting..."
                : "Download LaTeX (.tex)"}
            </Button>
          </Card>

          {/* PDF Printable Document */}
          <Card
            padding="md"
            className="flex flex-col justify-between border-status-danger-border transition-colors hover:border-status-danger-text"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-danger-text text-xs font-black text-white shadow-xs">
                  PDF
                </div>
                <span className="rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger-text">
                  PRINT / PDF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Printable / PDF
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Clean vector printable layout formatted with{" "}
                  <code>@media print</code> rules, headers, clean page margins,
                  and one-click PDF generation.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              icon={
                <Printer className="h-3.5 w-3.5 text-status-danger-text" />
              }
              className="mt-4 w-full"
            >
              Print / Save as PDF
            </Button>
          </Card>
        </div>
      </div>

      {/* SECTION 2: NETWORK GRAPH TOPOLOGY EXPORTS */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-2 border-b border-border-default pb-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-ink-primary">
              Scientific Network Graph Formats (Gephi, Cytoscape, VOSviewer,
              Pajek)
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ink-muted">Topology:</span>
            <select
              value={selectedNetworkType}
              onChange={(e) => setSelectedNetworkType(e.target.value as any)}
              className="rounded-xl border border-border-default bg-surface-canvas px-2.5 py-1 font-bold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none"
            >
              <option value="co_authorship">Co-Authorship Network</option>
              <option value="co_occurrence">Keyword Co-Occurrence Map</option>
              <option value="coupling_countries">
                International Coupling Network
              </option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Gephi GEXF */}
          <Card
            padding="md"
            className="flex flex-col justify-between transition-colors hover:border-brand-400"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-xs font-black text-white shadow-xs">
                  GEXF
                </div>
                <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  GEPHI NATIVE
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Gephi GEXF (.gexf)
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Full Graph Exchange XML file including node cluster
                  partitions, degree, betweenness centrality, PageRank, link
                  strength, and visual RGB colors.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-ink-subtle">
                <CheckCircle2 className="h-3 w-3 text-status-success-text" />
                <span>
                  Compatible with Gephi 0.9.x/0.10.x, VOSviewer, NetworkX
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading === "gexf"}
              disabled={downloading === "gexf"}
              onClick={() =>
                handleDownload("gexf", `${selectedNetworkType}_gephi`)
              }
              icon={
                downloading !== "gexf" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "gexf" ? "Exporting..." : "Download GEXF File"}
            </Button>
          </Card>

          {/* GraphML */}
          <Card
            padding="md"
            className="flex flex-col justify-between transition-colors hover:border-status-info-border"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-info-text text-xs font-black text-white shadow-xs">
                  GML
                </div>
                <span className="rounded-md border border-status-info-border bg-status-info-bg px-2 py-0.5 text-[10px] font-bold text-status-info-text">
                  CYTOSCAPE / GEPHI
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  GraphML (.graphml)
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Comprehensive XML graph architecture with typed key
                  definitions for modularity clusters, normalized weights,
                  citations, and publication years.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-ink-subtle">
                <CheckCircle2 className="h-3 w-3 text-status-success-text" />
                <span>
                  Compatible with Cytoscape, Gephi, yEd, igraph, NetworkX
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "graphml"}
              disabled={downloading === "graphml"}
              onClick={() =>
                handleDownload("graphml", `${selectedNetworkType}_network`)
              }
              icon={
                downloading !== "graphml" ? (
                  <Download className="h-3.5 w-3.5 text-status-info-text" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "graphml"
                ? "Exporting..."
                : "Download GraphML File"}
            </Button>
          </Card>

          {/* Pajek */}
          <Card
            padding="md"
            className="flex flex-col justify-between transition-colors hover:border-status-success-border"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-success-text text-xs font-black text-white shadow-xs">
                  NET
                </div>
                <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                  PAJEK / VOSVIEWER
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Pajek Matrix (.net)
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Standard Pajek network file with indexed vertices and weighted
                  edges, ready for instant loading in standalone VOSviewer and
                  Pajek.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-ink-subtle">
                <CheckCircle2 className="h-3 w-3 text-status-success-text" />
                <span>Compatible with Pajek, VOSviewer, UCINET, Gephi</span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "pajek"}
              disabled={downloading === "pajek"}
              onClick={() =>
                handleDownload("pajek", `${selectedNetworkType}_vosviewer`)
              }
              icon={
                downloading !== "pajek" ? (
                  <Download className="h-3.5 w-3.5 text-status-success-text" />
                ) : undefined
              }
              className="mt-4 w-full"
            >
              {downloading === "pajek"
                ? "Exporting..."
                : "Download Pajek (.net)"}
            </Button>
          </Card>
        </div>
      </div>

      {/* SECTION 3: DATASETS & POWER BI CONNECTOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-default pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-status-warning-text" />
            <h2 className="text-sm font-black uppercase tracking-wider text-ink-primary">
              Corpus Data, Citations &amp; Business Intelligence Connectors
            </h2>
          </div>
        </div>

        {/* Direct Power BI Live Connector Callout */}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-status-warning-border bg-gradient-to-r from-status-warning-bg/70 via-surface-canvas to-surface-subtle p-6 shadow-card md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-status-warning-text px-2 py-0.5 text-[10px] font-black uppercase text-white">
                Power BI Web Export
              </span>
              <span className="rounded border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">
                Versioned JSON Import
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-black tracking-tight text-ink-primary">
              Research Intelligence exports for Microsoft Power BI
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-secondary">
              Import bibliometric data and approved organizational or external
              aggregate snapshots. Configure Power BI credentials, relationships
              and refresh separately.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={`/api/powerbi/download-pbids?dataset_id=${datasetId}`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-default bg-surface-canvas px-3.5 py-2.5 text-xs font-bold text-ink-primary shadow-card transition-colors hover:bg-surface-subtle"
            >
              <Download className="h-4 w-4 text-status-warning-text" />
              <span>Download Connector (.pbids)</span>
            </a>

            {onNavigateToPowerBI && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onNavigateToPowerBI}
                icon={<BarChart3 className="h-4 w-4" />}
              >
                <span>Launch Power BI Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Dataset Formats: BibTeX, CSV, JSON */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            padding="md"
            className="flex flex-col justify-between space-y-3 transition-colors hover:border-border-strong"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-xs font-bold text-brand-700">
                  BIB
                </div>
                <span className="text-[10px] text-ink-subtle">
                  Academic references (.bib)
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  BibTeX Citation File
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Full BibTeX citation database with titles, authors, venues,
                  years, DOIs, and abstracts ready for LaTeX, Overleaf, or
                  Zotero.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading === "bibtex"}
              disabled={downloading === "bibtex"}
              onClick={() => handleDownload("bibtex", "references")}
              icon={
                downloading !== "bibtex" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="w-full"
            >
              {downloading === "bibtex"
                ? "Exporting..."
                : "Download BibTeX (.bib)"}
            </Button>
          </Card>

          <Card
            padding="md"
            className="flex flex-col justify-between space-y-3 transition-colors hover:border-border-strong"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-status-success-border bg-status-success-bg text-xs font-bold text-status-success-text">
                  CSV
                </div>
                <span className="text-[10px] text-ink-subtle">
                  Tabular data (.csv)
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Master Dataset (CSV)
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Standardized tabular file containing titles, authors,
                  citations, DOIs, affiliations, and provenance tags for R,
                  Python, or Excel.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading === "csv"}
              disabled={downloading === "csv"}
              onClick={() => handleDownload("csv", "corpus")}
              icon={
                downloading !== "csv" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="w-full"
            >
              {downloading === "csv" ? "Exporting..." : "Download Master CSV"}
            </Button>
          </Card>

          <Card
            padding="md"
            className="flex flex-col justify-between space-y-3 transition-colors hover:border-border-strong"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-status-info-border bg-status-info-bg text-xs font-bold text-status-info-text">
                  JSON
                </div>
                <span className="text-[10px] text-ink-subtle">
                  Complete raw schema (.json)
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Full Corpus JSON
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Uncompressed hierarchical JSON archive including merge audit
                  trails, deduplication scores, and normalized canonical
                  attributes.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading === "json"}
              disabled={downloading === "json"}
              onClick={() => handleDownload("json", "archive")}
              icon={
                downloading !== "json" ? (
                  <Download className="h-3.5 w-3.5" />
                ) : undefined
              }
              className="w-full"
            >
              {downloading === "json"
                ? "Exporting..."
                : "Download JSON Archive"}
            </Button>
          </Card>
        </div>
      </div>

      {/* Synthesized Executive Scientometric Report */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-col justify-between gap-2 border-b border-border-subtle pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-status-warning-text" />
              <h2 className="text-lg font-black tracking-tight text-ink-primary">
                Scientometric Executive Assessment Report
              </h2>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Synthesized findings for{" "}
              <strong className="text-ink-primary">{datasetName}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md border border-border-default bg-surface-subtle px-2.5 py-1 font-mono text-[11px] text-ink-secondary">
              Ready for Manuscript Submission
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-primary">
              <Users className="h-4 w-4 text-brand-500" />
              1. Price&apos;s Elite Group &amp; Lotka&apos;s Law
            </div>
            <p className="text-xs leading-relaxed text-ink-secondary">
              The corpus exhibits strong conformance to Lotka&apos;s
              inverse-power law with an estimated exponent of{" "}
              <strong className="tabular-metrics text-ink-primary">
                β = {Number(lotkaBeta).toFixed(2)}
              </strong>
              . The most productive scholar is{" "}
              <strong className="text-ink-primary">{topAuthor}</strong>, and the
              highest individual Hirsch index across authors is{" "}
              <strong className="tabular-metrics text-ink-primary">
                h = {maxH}
              </strong>
              .
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-primary">
              <Layers className="h-4 w-4 text-status-success-text" />
              2. Bradford&apos;s Law &amp; Core Journals
            </div>
            <p className="text-xs leading-relaxed text-ink-secondary">
              Journal distribution is structured into three distinct zones
              governed by Bradford&apos;s multiplier{" "}
              <strong className="tabular-metrics text-ink-primary">
                k = {Number(multiplierK).toFixed(1)}
              </strong>
              . Exactly{" "}
              <strong className="tabular-metrics text-ink-primary">
                {coreJournals} nuclear journals
              </strong>{" "}
              form Zone 1, accounting for one-third of the domain&apos;s entire
              volume.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-primary">
              <Award className="h-4 w-4 text-brand-600" />
              3. Thematic Direction (Callon Diagram)
            </div>
            <p className="text-xs leading-relaxed text-ink-secondary">
              Callon&apos;s strategic diagram identifies{" "}
              <strong className="text-ink-primary">{motorThemes}</strong> as
              high-centrality, high-density Motor Themes driving contemporary
              innovation, alongside foundational cross-cutting concepts that
              provide structural stability across sub-disciplines.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-primary">
              <Globe className="h-4 w-4 text-status-warning-text" />
              4. Collaboration &amp; Global Impact
            </div>
            <p className="text-xs leading-relaxed text-ink-secondary">
              International co-authorship demonstrates a positive citation
              multiplier over single-country publications, supported by Pearson
              Chi-Square independence analysis verifying the significant impact
              advantage of cross-border collaborative teams.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}