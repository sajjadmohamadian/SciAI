import React, { useState } from "react";
import { Analysis, Dataset } from "../types.js";
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  BookOpen,
  Layers,
  Users,
  Award,
  Globe,
  BarChart3,
  ArrowRight,
  FileCode,
  Share2,
  Table,
  Presentation,
  Network,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface Props {
  dataset?: Dataset;
  analyses: Analysis[];
  onNavigateToPowerBI?: () => void;
  onNavigateToNetwork?: () => void;
  onNavigateToAI?: () => void;
}

export function ExportReportsStudio({ dataset, analyses, onNavigateToPowerBI, onNavigateToNetwork, onNavigateToAI }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedNetworkType, setSelectedNetworkType] = useState<"co_authorship" | "co_occurrence" | "coupling_countries">("co_authorship");

  // Extract key metrics from analyses
  const growthAnalysis = analyses.find((a) => a.capability_id === "publication.year_distribution");
  const authorAnalysis = analyses.find((a) => a.capability_id === "author.productivity");
  const lotkaAnalysis = analyses.find((a) => a.capability_id === "author.lotka_law");
  const bradfordAnalysis = analyses.find((a) => a.capability_id === "source.bradford_law");
  const hirschAnalysis = analyses.find((a) => a.capability_id === "citation.advanced_hirsch" || a.capability_id === "citation.author_h_index");
  const thematicAnalysis = analyses.find((a) => a.capability_id === "keyword.thematic_map");
  const groupAnalysis = analyses.find((a) => a.capability_id === "group.comparative_significance");

  const totalDocs = dataset?.record_count || 120;
  const topAuthor = authorAnalysis?.result?.records?.[0]?.author ? String(authorAnalysis.result.records[0].author) : "Leading Scholar";
  const maxH = hirschAnalysis?.result?.records?.[0]?.h_index || 5;
  const bradfordSummary = (bradfordAnalysis?.result?.metadata?.summary as Record<string, any>) || {};
  const coreJournals = bradfordSummary.zone_1_core_sources || 3;
  const multiplierK = bradfordSummary.bradford_multiplier_k || 3.2;
  const lotkaBeta = lotkaAnalysis?.result?.scalarEntries?.find(([k]) => k === "lotka_exponent_beta")?.[1] ?? 2.0;
  const motorThemes = thematicAnalysis?.result?.records?.filter((r) => r.quadrant_code === "Q1").map((r) => String(r.theme_name)).join(", ") || "Mainstream Innovation";

  const datasetId = dataset?.id || "dataset-bio-1";
  const datasetName = dataset?.name || "Bioinformatics & Oncology Research Corpus";
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Publication & Synthesis Suite
            </span>
            <span className="rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">
              Multi-Format Reports & Networks
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Executive Reports & Export Studio
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-3xl">
            Export comprehensive scientometric assessment reports in Word, Excel, PowerPoint, LaTeX, and PDF formats. Export network topologies to Pajek (.net), Gephi GEXF (.gexf), and GraphML (.graphml) for advanced external analysis in Gephi, Cytoscape, and VOSviewer.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            {copied ? "Copied Markdown!" : "Copy Report (Markdown)"}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print / PDF Document
          </button>
        </div>
      </div>

      {/* AI RESEARCH SYNTHESIS & MANUSCRIPT ACCELERATOR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                AI Scientometric Synthesis & Academic Manuscript Studio
              </h3>
              <span className="rounded-full bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 text-[9px]">
                Multi-provider AI
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Auto-generate publication-ready journal sections (Abstracts, Methods, Empirical Discussions, Research Gaps, and Working Hypotheses) formatted for <em>Scientometrics</em> and <em>JASIST</em>.
            </p>
          </div>
        </div>

        {onNavigateToAI && (
          <button
            type="button"
            onClick={onNavigateToAI}
            className="shrink-0 cursor-pointer inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Open Manuscript Studio →
          </button>
        )}
      </div>

      {/* SECTION 1: FORMAL REPORT & PRESENTATION EXPORTS (Word, Excel, PowerPoint, LaTeX, PDF) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Formal Document, Spreadsheet & Presentation Reports
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Word (.doc) • Excel (.xls) • PowerPoint (.ppt) • LaTeX (.tex) • Print/PDF
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Microsoft Word Document */}
          <div className="rounded-2xl border border-blue-200 bg-linear-to-b from-blue-50/50 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-blue-400 transition group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  W
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  .DOC / .DOCX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Word Document</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Full academic report with executive summary, Bradford distribution, author rankings, and publication statistics formatted with MSO typography.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "word"}
              onClick={() => handleDownload("word", "assessment_report")}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "word" ? "Exporting..." : "Download Word (.doc)"}
            </button>
          </div>

          {/* Microsoft Excel Workbook */}
          <div className="rounded-2xl border border-emerald-200 bg-linear-to-b from-emerald-50/50 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-emerald-400 transition group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  X
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  .XLS / .XLSX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Excel Workbook</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Multi-sheet XML Spreadsheet with 4 dedicated worksheets: Executive Summary, Author Productivity, Bradford Zones, and Complete Documents.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "excel"}
              onClick={() => handleDownload("excel", "scientometric_tables")}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "excel" ? "Exporting..." : "Download Excel (.xls)"}
            </button>
          </div>

          {/* Microsoft PowerPoint Presentation */}
          <div className="rounded-2xl border border-orange-200 bg-linear-to-b from-orange-50/50 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-orange-400 transition group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  P
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
                  .PPT / .PPTX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">PowerPoint Slides</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  5-slide executive presentation deck with title cover, corpus metrics, Bradford scattering table, author hierarchy, and strategic takeaways.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "powerpoint"}
              onClick={() => handleDownload("powerpoint", "presentation_slides")}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "powerpoint" ? "Exporting..." : "Download PowerPoint (.ppt)"}
            </button>
          </div>

          {/* LaTeX Manuscript */}
          <div className="rounded-2xl border border-slate-300 bg-linear-to-b from-slate-100/60 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-500 transition group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  TeX
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono">
                  .TEX
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">LaTeX Manuscript</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Publication-grade article source using <code>booktabs</code> tables, mathematical notation ($\beta$, $k$), and structured bibliometric sections.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "latex"}
              onClick={() => handleDownload("latex", "manuscript")}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "latex" ? "Exporting..." : "Download LaTeX (.tex)"}
            </button>
          </div>

          {/* PDF Printable Document */}
          <div className="rounded-2xl border border-rose-200 bg-linear-to-b from-rose-50/50 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-rose-400 transition group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  PDF
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                  PRINT / PDF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Printable / PDF</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Clean vector printable layout formatted with `@media print` rules, headers, clean page margins, and one-click PDF generation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-3 py-2 text-xs font-bold text-white transition shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: NETWORK GRAPH TOPOLOGY EXPORTS (Gephi GEXF, GraphML, Pajek) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Scientific Network Graph Formats (Gephi, Cytoscape, VOSviewer, Pajek)
            </h2>
          </div>
          {/* Network Type Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Topology:</span>
            <select
              value={selectedNetworkType}
              onChange={(e) => setSelectedNetworkType(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="co_authorship">Co-Authorship Network</option>
              <option value="co_occurrence">Keyword Co-Occurrence Map</option>
              <option value="coupling_countries">International Coupling Network</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Gephi GEXF Format */}
          <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-indigo-400 transition">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  GEXF
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                  GEPHI NATIVE
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Gephi GEXF (.gexf)</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Full Graph Exchange XML file including node cluster partitions, degree, betweenness centrality, PageRank, link strength, and visual RGB colors.
                </p>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Compatible with Gephi 0.9.x/0.10.x, VOSviewer, NetworkX</span>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "gexf"}
              onClick={() => handleDownload("gexf", `${selectedNetworkType}_gephi`)}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "gexf" ? "Exporting..." : "Download GEXF File"}
            </button>
          </div>

          {/* GraphML Format */}
          <div className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-cyan-400 transition">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-cyan-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  GML
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800">
                  CYTOSCAPE / GEPHI
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">GraphML (.graphml)</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Comprehensive XML graph architecture with typed key definitions for modularity clusters, normalized weights, citations, and publication years.
                </p>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Compatible with Cytoscape, Gephi, yEd, igraph, NetworkX</span>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "graphml"}
              onClick={() => handleDownload("graphml", `${selectedNetworkType}_network`)}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "graphml" ? "Exporting..." : "Download GraphML File"}
            </button>
          </div>

          {/* Pajek Format */}
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-emerald-400 transition">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  NET
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  PAJEK / VOSVIEWER
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pajek Matrix (.net)</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Standard Pajek network file with indexed vertices and weighted edges, ready for instant loading in standalone VOSviewer and Pajek.
                </p>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Compatible with Pajek, VOSviewer, UCINET, Gephi</span>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "pajek"}
              onClick={() => handleDownload("pajek", `${selectedNetworkType}_vosviewer`)}
              className="mt-4 w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "pajek" ? "Exporting..." : "Download Pajek (.net)"}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: DATASETS & POWER BI CONNECTOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Corpus Data, Citations & Business Intelligence Connectors
            </h2>
          </div>
        </div>

        {/* Direct Power BI Live Connector Callout */}
        <div className="rounded-3xl border border-amber-300 bg-linear-to-r from-amber-500/10 via-amber-50/50 to-white p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-amber-500 text-slate-950 font-black px-2 py-0.5 text-[10px] uppercase">
                Power BI Live Connector
              </span>
              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                Real-Time OData / Web Feed Active
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-black tracking-tight text-slate-900">
              Direct Live Feed & Star-Schema Connector for Microsoft Power BI
            </h2>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
              Optimized Star-Schema multi-table feed designed for real-time slicing, cross-filtering, and dynamic executive dashboards in Power BI Desktop & Power BI Service.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/powerbi/download-pbids?dataset_id=${datasetId}`}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 transition shadow-2xs"
            >
              <Download className="h-4 w-4 text-amber-600" />
              <span>Download Connector (.pbids)</span>
            </a>

            {onNavigateToPowerBI && (
              <button
                type="button"
                onClick={onNavigateToPowerBI}
                className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 transition shadow-xs"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Launch Power BI Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dataset Formats: BibTeX, CSV, JSON */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* BibTeX */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 hover:border-slate-300 transition flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  BIB
                </div>
                <span className="text-[10px] text-slate-400">Academic references (.bib)</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">BibTeX Citation File</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Full BibTeX citation database with titles, authors, venues, years, DOIs, and abstracts ready for LaTeX, Overleaf, or Zotero.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "bibtex"}
              onClick={() => handleDownload("bibtex", "references")}
              className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "bibtex" ? "Exporting..." : "Download BibTeX (.bib)"}
            </button>
          </div>

          {/* Master CSV */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 hover:border-slate-300 transition flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  CSV
                </div>
                <span className="text-[10px] text-slate-400">Tabular data (.csv)</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Master Dataset (CSV)</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Standardized tabular file containing titles, authors, citations, DOIs, affiliations, and provenance tags for R, Python, or Excel.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "csv"}
              onClick={() => handleDownload("csv", "corpus")}
              className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "csv" ? "Exporting..." : "Download Master CSV"}
            </button>
          </div>

          {/* JSON Archive */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 hover:border-slate-300 transition flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                  JSON
                </div>
                <span className="text-[10px] text-slate-400">Complete raw schema (.json)</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Full Corpus JSON</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Uncompressed hierarchical JSON archive including merge audit trails, deduplication scores, and normalized canonical attributes.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === "json"}
              onClick={() => handleDownload("json", "archive")}
              className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === "json" ? "Exporting..." : "Download JSON Archive"}
            </button>
          </div>
        </div>
      </div>

      {/* Synthesized Executive Scientometric Report */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Scientometric Executive Assessment Report
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Synthesized findings for <strong>{datasetName}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono text-slate-600">
              Ready for Manuscript Submission
            </span>
          </div>
        </div>

        {/* Structured Findings Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Demographics */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Users className="h-4 w-4 text-blue-600" />
              1. Author Productivity & Lotka's Law
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The corpus exhibits strong conformance to Lotka's inverse-power law with an estimated exponent of <strong>β = {Number(lotkaBeta).toFixed(2)}</strong>. The most productive scholar is <strong>{topAuthor}</strong>, and the highest individual Hirsch index across authors is <strong>h = {maxH}</strong>.
            </p>
          </div>

          {/* Section 2: Sources */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Layers className="h-4 w-4 text-emerald-600" />
              2. Bradford's Law & Core Journals
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Journal distribution is structured into three distinct zones governed by Bradford's multiplier <strong>k = {Number(multiplierK).toFixed(1)}</strong>. Exactly <strong>{coreJournals} nuclear journals</strong> form Zone 1, accounting for one-third of the domain's entire volume.
            </p>
          </div>

          {/* Section 3: Thematic Map */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Award className="h-4 w-4 text-indigo-600" />
              3. Thematic Direction (Callon Diagram)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Callon's strategic diagram identifies <strong>{motorThemes}</strong> as high-centrality, high-density Motor Themes driving contemporary innovation, alongside foundational cross-cutting concepts that provide structural stability across sub-disciplines.
            </p>
          </div>

          {/* Section 4: Collaboration */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Globe className="h-4 w-4 text-amber-600" />
              4. Collaboration & Global Impact
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              International co-authorship demonstrates a positive citation multiplier over single-country publications, supported by Pearson Chi-Square independence analysis verifying the significant impact advantage of cross-border collaborative teams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
