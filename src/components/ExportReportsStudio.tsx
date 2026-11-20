import React, { useState, useMemo, useEffect } from "react";
import { Analysis, Dataset } from "../types.js";
import { AiIntelligenceView } from "./AiIntelligenceView.js";
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  BarChart3,
  ArrowRight,
  Network,
  CheckCircle2,
  SlidersHorizontal,
  ShieldCheck,
  Eye,
  BrainCircuit,
  ArrowUp,
  ArrowDown,
  MessageSquarePlus,
  PackageCheck,
  Database,
  Trash2,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { Button, Card } from "./CommonUI.js";

export type StudioWorkspaceMode = "packages_and_auto" | "question_driven_ai";

interface Props {
  dataset?: Dataset;
  datasets?: Dataset[];
  analyses: Analysis[];
  initialMode?: StudioWorkspaceMode;
  onSelectDataset?: (datasetId: string) => void;
  onNavigateToPowerBI?: () => void;
  onNavigateToNetwork?: () => void;
  onNavigateToAI?: () => void;
}

type ReportPackageId =
  | "executive_dora"
  | "prisma_systematic"
  | "network_thematic";

interface AutoCapturedBlock {
  id: string;
  capabilityId: string;
  title: string;
  category: string;
  timestamp: string;
  recordCount: number;
  summaryText: string;
  researcherNote: string;
  included: boolean;
}

const REPORT_PACKAGES: Array<{
  id: ReportPackageId;
  badge: string;
  title: string;
  description: string;
  sections: string[];
  chartsCount: number;
  estPages: number;
}> = [
  {
    id: "executive_dora",
    badge: "FULL DOSSIER",
    title: "Executive DORA / CoARA Assessment Package",
    description:
      "Complete 7-section scientometric evaluation with 6 embedded 300 DPI figures, Callon strategic map, Lotka/Bradford laws, and responsible citation audit.",
    sections: [
      "prisma_provenance",
      "longitudinal_dynamics",
      "lotka_authors",
      "coauthorship_network",
      "callon_thematic",
      "bradford_scattering",
      "dora_coara_audit",
    ],
    chartsCount: 6,
    estPages: 10,
  },
  {
    id: "prisma_systematic",
    badge: "SYSTEMATIC REVIEW",
    title: "PRISMA 2020 & Bibliometric Core Package",
    description:
      "Structured evidence synthesis covering PRISMA deduplication provenance, longitudinal production velocity, Lotka productivity, and Bradford core venues.",
    sections: [
      "prisma_provenance",
      "longitudinal_dynamics",
      "lotka_authors",
      "bradford_scattering",
      "dora_coara_audit",
    ],
    chartsCount: 4,
    estPages: 7,
  },
  {
    id: "network_thematic",
    badge: "STRUCTURAL MAP",
    title: "Collaboration Network & Strategic Theme Package",
    description:
      "Focused structural dossier highlighting co-authorship knowledge brokers, Louvain clusters, and Callon Motor/Niche thematic evolution.",
    sections: [
      "prisma_provenance",
      "coauthorship_network",
      "callon_thematic",
      "dora_coara_audit",
    ],
    chartsCount: 3,
    estPages: 6,
  },
];

function formatCapabilityTitle(capId: string): { title: string; category: string } {
  const map: Record<string, { title: string; category: string }> = {
    "author.productivity": {
      title: "Author Productivity & Output Ranking",
      category: "Social & Author Metrics",
    },
    "author.lotka_law": {
      title: "Lotka's Inverse-Power Law Fit (β)",
      category: "Bibliometric Laws",
    },
    "source.bradford_law": {
      title: "Bradford's Law of Journal Scattering",
      category: "Source & Venue Analysis",
    },
    "citation.advanced_hirsch": {
      title: "Advanced Hirsch Index (h, g, m-index)",
      category: "Citation Impact",
    },
    "citation.author_h_index": {
      title: "Author h-Index Distribution",
      category: "Citation Impact",
    },
    "keyword.thematic_map": {
      title: "Callon Strategic Diagram & Thematic Clusters",
      category: "Conceptual Structure",
    },
    "publication.year_distribution": {
      title: "Longitudinal Annual Production Trajectory",
      category: "Temporal Dynamics",
    },
    "network.co_authorship": {
      title: "Co-Authorship Network & Centrality",
      category: "Network Topology",
    },
  };
  if (map[capId]) return map[capId];
  const readable = capId
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" — ");
  return { title: readable, category: "Automated Analysis" };
}

export function ExportReportsStudio({
  dataset,
  datasets,
  analyses,
  initialMode = "packages_and_auto",
  onSelectDataset,
  onNavigateToPowerBI,
}: Props) {
  const [workspaceMode, setWorkspaceMode] =
    useState<StudioWorkspaceMode>(initialMode);
  const [selectedPackage, setSelectedPackage] =
    useState<ReportPackageId>("executive_dora");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedNetworkType, setSelectedNetworkType] = useState<
    "co_authorship" | "co_occurrence" | "coupling_countries"
  >("co_authorship");

  const effectiveDatasets = useMemo(() => {
    if (datasets && datasets.length > 0) return datasets;
    return dataset ? [dataset] : [];
  }, [datasets, dataset]);

  const [localDatasetId, setLocalDatasetId] = useState<string>(
    dataset?.id || effectiveDatasets[0]?.id || "dataset-bio-1"
  );

  useEffect(() => {
    if (dataset?.id) {
      setLocalDatasetId(dataset.id);
    }
  }, [dataset?.id]);

  const activeDataset = useMemo(() => {
    return (
      effectiveDatasets.find((d) => d.id === localDatasetId) ||
      dataset ||
      effectiveDatasets[0]
    );
  }, [effectiveDatasets, localDatasetId, dataset]);

  const handleDatasetChange = (nextId: string) => {
    setLocalDatasetId(nextId);
    setDismissedIds(new Set());
    if (onSelectDataset) {
      onSelectDataset(nextId);
    }
  };

  const [dpi, setDpi] = useState<150 | 300>(300);
  const [includeAiNarrative, setIncludeAiNarrative] = useState<boolean>(true);
  const [blindReviewMode, setBlindReviewMode] = useState<boolean>(false);

  const [autoBlocks, setAutoBlocks] = useState<AutoCapturedBlock[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const datasetId = activeDataset?.id || "dataset-bio-1";
  const datasetName =
    activeDataset?.name || "Bioinformatics & Oncology Research Corpus";
  const safeFilename = datasetName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  const scopedAnalyses = useMemo(() => {
    const matching = activeDataset?.id
      ? analyses.filter((a) => !a.dataset_id || a.dataset_id === activeDataset.id)
      : analyses;
    return matching.length > 0 ? matching : analyses;
  }, [analyses, activeDataset?.id]);

  useEffect(() => {
    setAutoBlocks((prev) => {
      const existingById = new Map(prev.map((b) => [b.id, b]));
      const next: AutoCapturedBlock[] = [];

      scopedAnalyses.forEach((item, idx) => {
        const key = item.id || `${item.capability_id}-${idx}`;
        if (dismissedIds.has(key)) return;

        const existing = existingById.get(key);
        const meta = formatCapabilityTitle(item.capability_id);
        const recCount = Array.isArray(item.result?.records)
          ? item.result.records.length
          : 0;
        const summaryText =
          (item.result?.metadata?.summary &&
            typeof item.result.metadata.summary === "object" &&
            Object.entries(item.result.metadata.summary)
              .slice(0, 3)
              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
              .join(" · ")) ||
          `${recCount} analytical rows computed and verified`;

        if (existing) {
          next.push({
            ...existing,
            recordCount: recCount,
            summaryText,
          });
        } else {
          next.push({
            id: key,
            capabilityId: item.capability_id,
            title: meta.title,
            category: meta.category,
            timestamp: item.created_at
              ? new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Session Live",
            recordCount: recCount,
            summaryText,
            researcherNote: "",
            included: true,
          });
        }
      });

      const prevOrder = new Map(prev.map((b, i) => [b.id, i]));
      next.sort((a, b) => {
        const ia = prevOrder.has(a.id) ? prevOrder.get(a.id)! : 9999;
        const ib = prevOrder.has(b.id) ? prevOrder.get(b.id)! : 9999;
        return ia - ib;
      });
      return next;
    });
  }, [scopedAnalyses, dismissedIds]);

  const thematicAnalysis = scopedAnalyses.find(
    (a) => a.capability_id === "keyword.thematic_map"
  );
  const motorThemes =
    thematicAnalysis?.result?.records
      ?.filter((r) => r.quadrant_code === "Q1")
      .map((r) => String(r.theme_name))
      .join(", ") || "Mainstream Innovation";

  const activePackageObj =
    REPORT_PACKAGES.find((p) => p.id === selectedPackage) || REPORT_PACKAGES[0];
  const includedAutoCount = autoBlocks.filter((b) => b.included).length;

  const toggleAutoBlock = (id: string) => {
    setAutoBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, included: !b.included } : b))
    );
  };

  const moveAutoBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= autoBlocks.length) return;
    setAutoBlocks((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    setAutoBlocks((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(draggedIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    setDraggedIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const removeAutoBlock = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    setAutoBlocks((prev) => prev.filter((b) => b.id !== id));
    if (editingNoteId === id) {
      setEditingNoteId(null);
    }
  };

  const restoreDismissedBlocks = () => {
    setDismissedIds(new Set());
  };

  const updateResearcherNote = (id: string, note: string) => {
    setAutoBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, researcherNote: note } : b))
    );
  };

  const handleDownload = async (
    format: string,
    filenameSuffix?: string,
    modeOverride?: "package" | "auto_dossier"
  ) => {
    setDownloading(format);
    try {
      const activeSections = activePackageObj.sections.join(",");
      const params = new URLSearchParams({
        format,
        blueprint:
          modeOverride === "auto_dossier" ? "auto_dossier" : selectedPackage,
        sections: activeSections,
        charts: activeSections,
        dpi: String(dpi),
        ai_narrative: includeAiNarrative ? "1" : "0",
        blind_review: blindReviewMode ? "1" : "0",
      });

      if (["pajek", "gexf", "graphml"].includes(format)) {
        params.set("network_type", selectedNetworkType);
      }

      const url = `/api/datasets/${datasetId}/export?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Export request failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      let extension = format;
      if (format === "word") extension = "docx";
      else if (format === "excel") extension = "xlsx";
      else if (format === "powerpoint") extension = "pptx";
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

  const generateAutoMarkdown = () => {
    const included = autoBlocks.filter((b) => b.included);
    const blocksMd =
      included.length > 0
        ? included
            .map(
              (b, idx) =>
                `### ${idx + 1}. ${b.title} (${b.category})\n- **Analytical Output**: ${b.summaryText}${
                  b.researcherNote
                    ? `\n- **Researcher Commentary**: ${b.researcherNote}`
                    : ""
                }`
            )
            .join("\n\n")
        : "No individual analytical outputs selected.";

    return `# Auto-Captured Scientometric Research Dossier
**Dataset**: ${datasetName}
**Package Basis**: ${activePackageObj.title}
**Captured Analytical Outputs**: ${included.length} modules
**Generated on**: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}

---

## Chronological Session Analysis Log (Auto-Captured)
${blocksMd}
`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateAutoMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* 1. Canonical Editorial Studio Header with Corpus / Dataset Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 lg:flex-row lg:items-end">
        <div>
          <span className="sciai-kicker">
            AI Synthesis &amp; Publication Suite
          </span>
          <h1 className="mt-1 text-xl font-black tracking-tight text-ink-primary">
            AI &amp; Executive Reports Studio
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Download ready-made scientometric report packages, organize or
            prune your automatically captured session analysis dossier, or
            generate question-driven AI reports.
          </p>
        </div>

        {/* Top-Right Corpus / Dataset Selector */}
        <div className="w-full shrink-0 rounded-2xl border border-border-default bg-surface-subtle p-3.5 lg:w-80">
          <div className="flex items-center justify-between">
            <label
              htmlFor="report-corpus-selector"
              className="sciai-kicker flex items-center gap-1.5 text-ink-primary"
            >
              <Database className="h-3.5 w-3.5 text-brand-500" />
              <span>Corpus / Dataset Scope</span>
            </label>
            {activeDataset?.record_count !== undefined && (
              <span className="font-mono text-[10px] font-bold text-brand-500 tabular-metrics">
                {activeDataset.record_count} Docs
              </span>
            )}
          </div>
          <select
            id="report-corpus-selector"
            value={datasetId}
            onChange={(e) => handleDatasetChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-semibold text-ink-primary focus:border-brand-500 focus:outline-none"
          >
            {effectiveDatasets.length === 0 ? (
              <option value={datasetId}>{datasetName}</option>
            ) : (
              effectiveDatasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.record_count ?? 0} docs)
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 2: QUESTION-DRIVEN AI REPORTING                                 */}
      {/* ==================================================================== */}
      {workspaceMode === "question_driven_ai" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-info-border bg-status-info-bg px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <span>
                Ask any research question or generate journal manuscript
                sections grounded in <strong>{datasetName}</strong>.
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setWorkspaceMode("packages_and_auto")}
              icon={<FileText className="h-3.5 w-3.5 text-brand-500" />}
            >
              Back to Packages &amp; Auto-Report
            </Button>
          </div>

          <AiIntelligenceView
            datasets={effectiveDatasets}
            analyses={scopedAnalyses}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: TWO-COLUMN ANALYSIS STUDIO (Design System §3.2)              */}
      {/* ==================================================================== */}
      {workspaceMode === "packages_and_auto" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1px_360px]">
          <div className="min-w-0 space-y-8">
            {/* 1. READY-MADE REPORT PACKAGES */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-2">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-brand-500" />
                  <h2 className="text-base font-bold tracking-tight text-ink-primary">
                    1. Ready-Made Report Packages
                  </h2>
                </div>
                <span className="text-xs text-ink-muted">
                  Pre-structured scientific dossiers ready for immediate export
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {REPORT_PACKAGES.map((pkg) => {
                  const isSelected = selectedPackage === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? "border-brand-500 bg-surface-canvas ring-1 ring-brand-500"
                          : "border-border-default bg-surface-canvas hover:border-border-strong"
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                              isSelected
                                ? "bg-brand-500 text-white"
                                : "border border-border-default bg-surface-subtle text-ink-secondary"
                            }`}
                          >
                            {pkg.badge}
                          </span>
                          <span className="font-mono text-[11px] text-ink-muted tabular-metrics">
                            {pkg.chartsCount} Figs &middot; ~{pkg.estPages}p
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-ink-primary">
                          {pkg.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-ink-muted">
                          {pkg.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border-default pt-3">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-500">
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Active Package</span>
                            </>
                          ) : (
                            <span>Select Package</span>
                          )}
                        </span>

                        <Button
                          type="button"
                          variant={isSelected ? "primary" : "secondary"}
                          size="sm"
                          loading={downloading === `pkg_${pkg.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPackage(pkg.id);
                            handleDownload("word", `${pkg.id}_report`);
                          }}
                          icon={<Download className="h-3.5 w-3.5" />}
                        >
                          Word (.docx)
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. AUTO-CAPTURED SESSION ANALYSIS DOSSIER */}
            <Card padding="none" className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-surface-subtle px-5 py-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    <h2 className="text-base font-bold tracking-tight text-ink-primary">
                      2. Auto-Captured Session Analysis Dossier
                    </h2>
                    <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-[10px] font-bold text-status-success-text tabular-metrics">
                      {includedAutoCount} / {autoBlocks.length} Outputs Included
                    </span>
                    {dismissedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={restoreDismissedBlocks}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-canvas px-2 py-0.5 text-[10px] font-semibold text-brand-500 hover:bg-surface-subtle"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>Restore Removed ({dismissedIds.size})</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Drag or use arrows to reorder analyses, add notes, remove
                    unwanted items, and export your custom dossier.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyMarkdown}
                    icon={
                      copied ? (
                        <Check className="h-3.5 w-3.5 text-status-success-text" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-ink-muted" />
                      )
                    }
                  >
                    {copied ? "Copied" : "Copy Dossier"}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={downloading === "word"}
                    onClick={() =>
                      handleDownload(
                        "word",
                        "auto_research_dossier",
                        "auto_dossier"
                      )
                    }
                    icon={<Download className="h-3.5 w-3.5" />}
                  >
                    Download Auto-Report (.docx)
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-border-default">
                {autoBlocks.length === 0 ? (
                  <div className="space-y-2 p-8 text-center text-xs text-ink-muted">
                    <p>
                      No analyses in the dossier. Run any capability in
                      Descriptive, Thematic, Network, or ML studios to capture
                      it automatically.
                    </p>
                    {dismissedIds.size > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={restoreDismissedBlocks}
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                      >
                        Restore {dismissedIds.size} Removed Analyses
                      </Button>
                    )}
                  </div>
                ) : (
                  autoBlocks.map((block, idx) => (
                    <div
                      key={block.id}
                      draggable={editingNoteId !== block.id}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(idx));
                        handleDragStart(idx);
                      }}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDragEnd();
                      }}
                      onDragEnd={handleDragEnd}
                      className={`select-none p-4 transition-all ${
                        draggedIndex === idx
                          ? "border-y-2 border-brand-500 bg-status-info-bg/70 opacity-90 shadow-sm"
                          : block.included
                          ? "bg-surface-canvas hover:bg-surface-subtle/50"
                          : "bg-surface-subtle opacity-60"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="flex items-start gap-2.5">
                          <span
                            title="Drag & drop to reorder analysis"
                            className="mt-1 cursor-grab text-ink-muted hover:text-ink-primary active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <input
                            type="checkbox"
                            checked={block.included}
                            onChange={() => toggleAutoBlock(block.id)}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-border-default text-brand-500 focus:ring-brand-500"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-brand-500">
                                #{String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="text-sm font-bold text-ink-primary">
                                {block.title}
                              </span>
                              <span className="rounded border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">
                                {block.category}
                              </span>
                              <span className="font-mono text-[10px] text-ink-muted">
                                {block.timestamp}
                              </span>
                            </div>

                            <p className="text-xs leading-relaxed text-ink-secondary">
                              {block.summaryText}
                            </p>

                            {block.researcherNote &&
                              editingNoteId !== block.id && (
                                <div className="mt-1.5 rounded-lg border border-status-info-border bg-status-info-bg px-3 py-1.5 text-xs text-ink-primary">
                                  <strong>Note:</strong> {block.researcherNote}
                                </div>
                              )}

                            {editingNoteId === block.id && (
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="text"
                                  value={block.researcherNote}
                                  onChange={(e) =>
                                    updateResearcherNote(
                                      block.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Add researcher interpretation or manuscript note for this output..."
                                  className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
                                />
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setEditingNoteId(null)}
                                >
                                  Save Note
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reorder, Note & Delete Controls */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingNoteId(
                                editingNoteId === block.id ? null : block.id
                              )
                            }
                            title="Add / Edit Researcher Note"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-default bg-surface-canvas px-2 py-1 text-[11px] font-semibold text-ink-secondary hover:bg-surface-subtle"
                          >
                            <MessageSquarePlus className="h-3 w-3 text-brand-500" />
                            <span>Note</span>
                          </button>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveAutoBlock(idx, -1)}
                            title="Move Up"
                            className="cursor-pointer rounded-lg border border-border-default bg-surface-canvas p-1 text-ink-secondary hover:bg-surface-subtle disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === autoBlocks.length - 1}
                            onClick={() => moveAutoBlock(idx, 1)}
                            title="Move Down"
                            className="cursor-pointer rounded-lg border border-border-default bg-surface-canvas p-1 text-ink-secondary hover:bg-surface-subtle disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeAutoBlock(block.id)}
                            title="Delete analysis from dossier"
                            className="cursor-pointer rounded-lg border border-status-danger-border bg-status-danger-bg p-1 text-status-danger-text hover:opacity-80"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* 3. PUBLICATION, SPREADSHEET & NETWORK EXPORTS */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-500" />
                  <h2 className="text-base font-bold tracking-tight text-ink-primary">
                    3. Publication, Spreadsheet &amp; Network Exports
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-ink-muted">
                    Network Topology:
                  </span>
                  <select
                    value={selectedNetworkType}
                    onChange={(e) =>
                      setSelectedNetworkType(e.target.value as any)
                    }
                    className="rounded-xl border border-border-default bg-surface-canvas px-2.5 py-1 font-semibold text-ink-primary focus:border-brand-500 focus:outline-none"
                  >
                    <option value="co_authorship">Co-Authorship Network</option>
                    <option value="co_occurrence">
                      Keyword Co-Occurrence Map
                    </option>
                    <option value="coupling_countries">
                      International Coupling
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={downloading === "word"}
                  onClick={() => handleDownload("word", "executive_report")}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Word (.docx)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "excel"}
                  onClick={() => handleDownload("excel", "tables")}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Excel (.xlsx)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "powerpoint"}
                  onClick={() => handleDownload("powerpoint", "slides")}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Slides (.pptx)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "latex"}
                  onClick={() => handleDownload("latex", "manuscript")}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  LaTeX (.tex)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handlePrint}
                  icon={<Printer className="h-3.5 w-3.5" />}
                >
                  Print / PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "bibtex"}
                  onClick={() => handleDownload("bibtex", "references")}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  BibTeX (.bib)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "gexf"}
                  onClick={() =>
                    handleDownload("gexf", `${selectedNetworkType}_gephi`)
                  }
                  icon={<Network className="h-3.5 w-3.5" />}
                >
                  Gephi (.gexf)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={downloading === "pajek"}
                  onClick={() =>
                    handleDownload("pajek", `${selectedNetworkType}_vosviewer`)
                  }
                  icon={<Network className="h-3.5 w-3.5" />}
                >
                  VOSviewer (.net)
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden bg-border-default xl:block" />

          {/* RIGHT 360px GOVERNANCE, OPTICS & PROVENANCE INSPECTOR */}
          <aside className="space-y-5">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <span className="sciai-kicker flex items-center gap-1.5 text-ink-primary">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-brand-500" />
                  Export Governance &amp; Optics
                </span>
                <span className="font-mono text-[10px] font-bold text-status-success-text">
                  v3.0 Engine
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="font-semibold text-ink-secondary">
                    AI Executive Synthesis Box
                  </span>
                  <input
                    type="checkbox"
                    checked={includeAiNarrative}
                    onChange={(e) => setIncludeAiNarrative(e.target.checked)}
                    className="rounded border-border-default text-brand-500 focus:ring-brand-500"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-secondary">
                    <span>Blind Peer-Review Mode</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-status-success-text" />
                  </span>
                  <input
                    type="checkbox"
                    checked={blindReviewMode}
                    onChange={(e) => setBlindReviewMode(e.target.checked)}
                    className="rounded border-border-default text-brand-500 focus:ring-brand-500"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-secondary">
                    Vector/Raster Chart DPI
                  </span>
                  <div className="flex overflow-hidden rounded-lg border border-border-default bg-surface-canvas">
                    {([150, 300] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setDpi(res)}
                        className={`cursor-pointer px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                          dpi === res
                            ? "bg-brand-500 text-white"
                            : "text-ink-secondary hover:bg-surface-subtle"
                        }`}
                      >
                        {res} DPI
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border-default pt-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setWorkspaceMode("question_driven_ai")}
                  icon={<BrainCircuit className="h-3.5 w-3.5" />}
                  className="w-full"
                >
                  Ask AI to Draft Custom Report
                </Button>
              </div>
            </Card>

            <Card padding="md" className="space-y-3 bg-surface-subtle">
              <div className="flex items-center justify-between">
                <span className="sciai-kicker flex items-center gap-1.5 text-ink-primary">
                  <Eye className="h-3.5 w-3.5 text-brand-500" />
                  Corpus Provenance
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  Star-Schema
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Dataset ID</span>
                  <span className="font-mono text-[11px] font-semibold text-ink-primary">
                    {datasetId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Motor Themes (Q1)</span>
                  <span className="max-w-[170px] truncate font-semibold text-ink-primary">
                    {motorThemes}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Power BI Connector</span>
                  <a
                    href={`/api/powerbi/download-pbids?dataset_id=${datasetId}`}
                    className="font-mono text-[11px] font-bold text-brand-500 underline"
                  >
                    Download .pbids
                  </a>
                </div>
              </div>

              {onNavigateToPowerBI && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToPowerBI}
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  className="w-full"
                >
                  <span>Open Power BI Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}