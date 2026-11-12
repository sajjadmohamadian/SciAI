import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ThematicEvolutionOutput,
  ThematicThemeNode,
  ThematicFlowLink,
  Dataset,
} from "../types.js";
import { validateThematicEvolutionResponse } from "../utils/responseValidation.js";
import {
  GitBranch,
  Download,
  Sparkles,
  RefreshCw,
  Search,
  Sliders,
  Info,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  HelpCircle,
  Database,
} from "lucide-react";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  datasets: Dataset[];
  activeDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  onNavigateToFrontier?: () => void;
}

const getPreferredThematicDatasetId = (datasets: Dataset[]) => {
  const thematicReadyDataset = datasets.find((d) => (d.record_count || 0) >= 2);
  return thematicReadyDataset?.id || datasets[0]?.id || "";
};

export function ThematicEvolutionStudio({
  datasets = [],
  activeDatasetId,
  onSelectDataset,
}: Props) {
  // Target Dataset State
  const [selectedDsId, setSelectedDsId] = useState<string>(
    activeDatasetId || getPreferredThematicDatasetId(datasets)
  );

  // Synchronize when parent prop or dashboard datasets change.
  useEffect(() => {
    if (activeDatasetId && activeDatasetId !== selectedDsId) {
      setSelectedDsId(activeDatasetId);
      return;
    }

    const selectedStillExists = datasets.some((d) => d.id === selectedDsId);
    if ((!selectedDsId || !selectedStillExists) && datasets.length > 0) {
      const fallbackDatasetId = getPreferredThematicDatasetId(datasets);
      setSelectedDsId(fallbackDatasetId);
      onSelectDataset?.(fallbackDatasetId);
    }
  }, [activeDatasetId, datasets, selectedDsId, onSelectDataset]);

  const handleDatasetChange = (newDsId: string) => {
    setSelectedDsId(newDsId);
    if (onSelectDataset && newDsId) {
      onSelectDataset(newDsId);
    }
  };

  const [data, setData] = useState<ThematicEvolutionOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slicing and Filtering Configuration
  const [sliceCount, setSliceCount] = useState<number>(3);
  const [customCutsStr, setCustomCutsStr] = useState<string>("");
  const [isCustomCuts, setIsCustomCuts] = useState<boolean>(false);
  const [minKeywordFreq] = useState<number>(1);
  const [inclusionThreshold, setInclusionThreshold] = useState<number>(0.12);
  const [maxThemesPerSlice, setMaxThemesPerSlice] = useState<number>(5);
  const [trajectoryFilter, setTrajectoryFilter] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Subtabs
  const [activeSubTab, setActiveSubTab] = useState<
    "sankey" | "matrix" | "strategic" | "synthesis"
  >("sankey");

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch or calculate Thematic Evolution
  const fetchEvolution = async () => {
    setLoading(true);
    setError(null);
    try {
      let customCuts: number[] | undefined = undefined;
      if (isCustomCuts && customCutsStr.trim()) {
        customCuts = customCutsStr
          .split(/[\s,]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
      }

      const res = await fetch("/api/thematic/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDsId || activeDatasetId,
          sliceCount,
          customCuts,
          minKeywordFreq,
          inclusionThreshold,
          maxThemesPerSlice,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const raw = await res.json();
      const outcome = validateThematicEvolutionResponse(raw);
      if (!outcome.success) {
        throw new Error(outcome.error || "Malformed Thematic Evolution response");
      }
      const result: ThematicEvolutionOutput = outcome.data;
      setData(result);
      if (result.nodes && result.nodes.length > 0 && !selectedNodeId) {
        setSelectedNodeId(result.nodes[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch thematic evolution:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load thematic evolution"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvolution();
  }, [
    selectedDsId,
    sliceCount,
    isCustomCuts,
    minKeywordFreq,
    inclusionThreshold,
    maxThemesPerSlice,
  ]);

  // Computed layout for Sankey diagram
  const sankeyLayout = useMemo(() => {
    if (!data || data.periods.length === 0 || data.nodes.length === 0) {
      return {
        columnWidth: 180,
        periodX: [],
        nodeLayouts: new Map(),
        linkPaths: [],
        totalWidth: 800,
        totalHeight: 520,
      };
    }

    const totalPeriods = data.periods.length;
    const paddingX = 40;
    const paddingY = 60;
    const nodeWidth = 175;
    const minHeight = 440;

    const columnGap = Math.max(
      140,
      Math.min(
        260,
        (900 - paddingX * 2 - totalPeriods * nodeWidth) /
          Math.max(1, totalPeriods - 1)
      )
    );
    const totalWidth =
      paddingX * 2 +
      totalPeriods * nodeWidth +
      (totalPeriods - 1) * columnGap;

    const periodX: number[] = [];
    for (let p = 0; p < totalPeriods; p++) {
      periodX.push(paddingX + p * (nodeWidth + columnGap));
    }

    const periodNodesMap = new Map<number, ThematicThemeNode[]>();
    for (let p = 0; p < totalPeriods; p++) {
      periodNodesMap.set(p, []);
    }
    for (const node of data.nodes) {
      const list = periodNodesMap.get(node.periodIndex) || [];
      list.push(node);
      periodNodesMap.set(node.periodIndex, list);
    }

    interface NodePos {
      node: ThematicThemeNode;
      x: number;
      y: number;
      width: number;
      height: number;
      inOffset: number;
      outOffset: number;
    }

    const nodeLayouts = new Map<string, NodePos>();
    let maxContentHeight = minHeight;

    const availableH = 380;
    for (let p = 0; p < totalPeriods; p++) {
      const pNodes = periodNodesMap.get(p) || [];
      const count = pNodes.length;
      if (count === 0) continue;

      const gap = 16;
      const totalGap = (count - 1) * gap;
      const totalWeight = pNodes.reduce(
        (sum, n) => sum + Math.max(1, n.docCount),
        0
      );

      let currentY = paddingY;
      for (const node of pNodes) {
        const weight = Math.max(1, node.docCount);
        const nodeH = Math.max(
          48,
          Math.min(
            84,
            Math.round(
              ((availableH - totalGap) * weight) / Math.max(1, totalWeight)
            )
          )
        );
        nodeLayouts.set(node.id, {
          node,
          x: periodX[p],
          y: currentY,
          width: nodeWidth,
          height: nodeH,
          inOffset: 0,
          outOffset: 0,
        });
        currentY += nodeH + gap;
      }
      if (currentY + 40 > maxContentHeight) {
        maxContentHeight = currentY + 40;
      }
    }

    const filteredLinks = data.links.filter((l) => {
      if (trajectoryFilter === "all") return true;
      return l.trajectory === trajectoryFilter;
    });

    interface LinkPath {
      link: ThematicFlowLink;
      d: string;
      sourcePos: NodePos;
      targetPos: NodePos;
      sy: number;
      ty: number;
      thickness: number;
    }

    const linkPaths: LinkPath[] = [];
    const nodeOutUsage = new Map<string, number>();
    const nodeInUsage = new Map<string, number>();

    for (const l of filteredLinks) {
      const srcPos = nodeLayouts.get(l.sourceId);
      const tgtPos = nodeLayouts.get(l.targetId);
      if (!srcPos || !tgtPos) continue;

      const baseThickness = Math.max(
        4,
        Math.min(28, Math.round(l.inclusionIndex * 30))
      );

      const curOut = nodeOutUsage.get(l.sourceId) || 4;
      const curIn = nodeInUsage.get(l.targetId) || 4;

      const sy = srcPos.y + Math.min(srcPos.height - baseThickness - 4, curOut);
      const ty = tgtPos.y + Math.min(tgtPos.height - baseThickness - 4, curIn);

      nodeOutUsage.set(l.sourceId, curOut + baseThickness + 2);
      nodeInUsage.set(l.targetId, curIn + baseThickness + 2);

      const x0 = srcPos.x + srcPos.width;
      const x1 = tgtPos.x;
      const dx = (x1 - x0) * 0.45;

      const d = `
        M ${x0} ${sy}
        C ${x0 + dx} ${sy}, ${x1 - dx} ${ty}, ${x1} ${ty}
        L ${x1} ${ty + baseThickness}
        C ${x1 - dx} ${ty + baseThickness}, ${x0 + dx} ${sy + baseThickness}, ${x0} ${sy + baseThickness}
        Z
      `;

      linkPaths.push({
        link: l,
        d,
        sourcePos: srcPos,
        targetPos: tgtPos,
        sy,
        ty,
        thickness: baseThickness,
      });
    }

    return {
      columnWidth: nodeWidth,
      periodX,
      nodeLayouts,
      linkPaths,
      totalWidth: Math.max(850, totalWidth),
      totalHeight: maxContentHeight,
    };
  }, [data, trajectoryFilter]);

  const highlightedElements = useMemo(() => {
    if (!data) return { nodes: new Set<string>(), links: new Set<string>() };

    const activeNode = hoveredNodeId || selectedNodeId;
    const activeLink = hoveredLinkId || selectedLinkId;

    if (activeLink) {
      const l = data.links.find((x) => x.id === activeLink);
      if (l) {
        return {
          nodes: new Set([l.sourceId, l.targetId]),
          links: new Set([l.id]),
        };
      }
    }

    if (!activeNode) {
      return { nodes: new Set<string>(), links: new Set<string>() };
    }

    const hlNodes = new Set<string>([activeNode]);
    const hlLinks = new Set<string>();

    const queueUp = [activeNode];
    while (queueUp.length > 0) {
      const curr = queueUp.shift()!;
      for (const l of data.links) {
        if (l.targetId === curr) {
          hlLinks.add(l.id);
          if (!hlNodes.has(l.sourceId)) {
            hlNodes.add(l.sourceId);
            queueUp.push(l.sourceId);
          }
        }
      }
    }

    const queueDown = [activeNode];
    while (queueDown.length > 0) {
      const curr = queueDown.shift()!;
      for (const l of data.links) {
        if (l.sourceId === curr) {
          hlLinks.add(l.id);
          if (!hlNodes.has(l.targetId)) {
            hlNodes.add(l.targetId);
            queueDown.push(l.targetId);
          }
        }
      }
    }

    return { nodes: hlNodes, links: hlLinks };
  }, [data, selectedNodeId, hoveredNodeId, selectedLinkId, hoveredLinkId]);

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [data, selectedNodeId]);

  const selectedLink = useMemo(() => {
    if (!data || !selectedLinkId) return null;
    return data.links.find((l) => l.id === selectedLinkId) || null;
  }, [data, selectedLinkId]);

  const nodeConnections = useMemo(() => {
    if (!data || !selectedNodeId) return { predecessors: [], successors: [] };
    const predecessors = data.links
      .filter((l) => l.targetId === selectedNodeId)
      .map((l) => ({
        link: l,
        node: data.nodes.find((n) => n.id === l.sourceId),
      }));
    const successors = data.links
      .filter((l) => l.sourceId === selectedNodeId)
      .map((l) => ({
        link: l,
        node: data.nodes.find((n) => n.id === l.targetId),
      }));
    return { predecessors, successors };
  }, [data, selectedNodeId]);

  // Color helpers for Callon Quadrants using Design System semantic & categorical hexes
  const getQuadrantColor = (code: "Q1" | "Q2" | "Q3" | "Q4") => {
    switch (code) {
      case "Q1": // Motor Themes
        return {
          badgeBg:
            "bg-status-success-bg text-status-success-text border-status-success-border",
          nodeBorder: "border-status-success-border",
          accentBg: "bg-status-success-text",
          strokeColor: "#0D9488",
          gradientFrom: "#0D9488",
          textAccent: "text-status-success-text",
        };
      case "Q2": // Niche Themes
        return {
          badgeBg: "bg-brand-50 text-brand-700 border-brand-200",
          nodeBorder: "border-brand-500",
          accentBg: "bg-brand-500",
          strokeColor: "#6366F1",
          gradientFrom: "#6366F1",
          textAccent: "text-brand-700",
        };
      case "Q3": // Emerging/Declining Themes
        return {
          badgeBg:
            "bg-status-warning-bg text-status-warning-text border-status-warning-border",
          nodeBorder: "border-status-warning-border",
          accentBg: "bg-status-warning-text",
          strokeColor: "#D97706",
          gradientFrom: "#D97706",
          textAccent: "text-status-warning-text",
        };
      case "Q4": // Basic Themes
      default:
        return {
          badgeBg:
            "bg-status-info-bg text-status-info-text border-status-info-border",
          nodeBorder: "border-status-info-border",
          accentBg: "bg-status-info-text",
          strokeColor: "#315C7C",
          gradientFrom: "#315C7C",
          textAccent: "text-status-info-text",
        };
    }
  };

  // Trajectory Badge helper
  const getTrajectoryBadge = (traj: string) => {
    switch (traj) {
      case "continuation":
        return {
          label: "Continuation",
          bg: "bg-status-success-bg text-status-success-text border-status-success-border",
        };
      case "splitting":
        return {
          label: "Splitting",
          bg: "bg-brand-50 text-brand-700 border-brand-200",
        };
      case "merging":
        return {
          label: "Merging",
          bg: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
        };
      case "emerging":
        return {
          label: "Emerging",
          bg: "bg-status-info-bg text-status-info-text border-status-info-border",
        };
      case "fading":
        return {
          label: "Fading",
          bg: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
        };
      default:
        return {
          label: traj,
          bg: "bg-surface-muted text-ink-secondary border-border-default",
        };
    }
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thematic_evolution_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!data || data.transitionMatrix.length === 0) return;
    const headers = [
      "Source Period",
      "Source Theme",
      "Target Period",
      "Target Theme",
      "Inclusion Index (Simpson)",
      "Trajectory Classification",
      "Shared Keywords Bridge",
    ];
    const rows = data.transitionMatrix.map((r) => [
      `"${r.sourcePeriod}"`,
      `"${r.sourceTheme}"`,
      `"${r.targetPeriod}"`,
      `"${r.targetTheme}"`,
      r.inclusionIndex,
      `"${r.trajectory}"`,
      `"${r.sharedKeywords.join(", ")}"`,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thematic_transitions_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="space-y-5 border-b border-border-default pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sciai-kicker whitespace-nowrap text-brand-500!">
              Scientometrics Evolution Lab
            </span>
            <span className="whitespace-nowrap rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              Cobo (2011) &amp; SciMAT / Bibliometrix
            </span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
            <GitBranch className="h-7 w-7 shrink-0 text-brand-500 sm:h-8 sm:w-8" />
            <span className="min-w-0">Thematic Evolution &amp; Slicing</span>
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Longitudinal science mapping: divide the corpus into sequential time
            slices, calculate Callon&apos;s strategic themes, and trace
            evolutionary trajectories (continuation, splitting, merging) using
            the Simpson Inclusion Index.
          </p>
        </div>

        {/* Dataset Selector & Action Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {datasets.length > 0 && (
            <div className="flex min-w-0 flex-col">
              <label
                htmlFor="thematic-dataset-select"
                className="flex items-center gap-1 text-xs font-semibold text-ink-secondary"
              >
                <Database className="h-3 w-3 shrink-0 text-brand-500" />
                Target Dataset
              </label>
              <select
                id="thematic-dataset-select"
                className="mt-1 block w-full min-w-0 max-w-full truncate rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none sm:w-80"
                value={selectedDsId}
                onChange={(e) => handleDatasetChange(e.target.value)}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.id} ({d.record_count || 0} docs)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={fetchEvolution}
              disabled={loading}
              icon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    loading ? "animate-spin text-brand-500" : ""
                  }`}
                />
              }
            >
              Recalculate
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportSVG}
              disabled={!data || data.nodes.length === 0}
              icon={<Download className="h-3.5 w-3.5 text-ink-subtle" />}
            >
              SVG Diagram
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExportCSV}
              disabled={!data || data.transitionMatrix.length === 0}
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            >
              Export Matrix
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Time Span</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-ink-primary">
              {data.summary.yearSpan}
            </div>
            <div className="tabular-metrics mt-0.5 text-[10px] text-ink-muted">
              {data.summary.totalDocuments} articles sliced
            </div>
          </Card>

          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Periods (Slices)</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-brand-600">
              {data.summary.totalPeriods} epochs
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">
              Sequential intervals
            </div>
          </Card>

          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Thematic Clusters</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-ink-primary">
              {data.summary.totalThemes} themes
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">
              Callon mapped nodes
            </div>
          </Card>

          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Continuations</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-status-success-text">
              {data.summary.continuationsCount} flows
            </div>
            <div className="mt-0.5 text-[10px] text-status-success-text">
              Direct paradigm lines
            </div>
          </Card>

          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Splits &amp; Merges</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-brand-500">
              {data.summary.splitsCount} / {data.summary.mergesCount}
            </div>
            <div className="mt-0.5 text-[10px] text-brand-600">
              Divergence &amp; synthesis
            </div>
          </Card>

          <Card padding="sm">
            <div className="sciai-kicker text-[10px]!">Avg Stability Index</div>
            <div className="tabular-metrics mt-1 text-lg font-black text-status-warning-text">
              {(data.summary.averageStability * 100).toFixed(1)}%
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">
              Longitudinal cohesion
            </div>
          </Card>
        </div>
      )}

      {/* Slicing & Parameters Toolbar */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Slicing Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
              <Sliders className="h-3.5 w-3.5 text-brand-500" />
              <span>Slicing Mode:</span>
            </div>

            <div className="flex items-center rounded-xl border border-border-default bg-surface-subtle p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsCustomCuts(false)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition-colors ${
                  !isCustomCuts
                    ? "bg-brand-500 font-bold text-white shadow-xs"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Equal Slices
              </button>
              <button
                type="button"
                onClick={() => setIsCustomCuts(true)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition-colors ${
                  isCustomCuts
                    ? "bg-brand-500 font-bold text-white shadow-xs"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Custom Cut Years
              </button>
            </div>

            {!isCustomCuts ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Periods:</span>
                <select
                  value={sliceCount}
                  onChange={(e) => setSliceCount(Number(e.target.value))}
                  className="rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1 text-xs font-bold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none"
                >
                  <option value={2}>2 Slices</option>
                  <option value={3}>3 Slices (Default)</option>
                  <option value={4}>4 Slices</option>
                  <option value={5}>5 Slices</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">
                  Cuts (e.g. 2022, 2024):
                </span>
                <input
                  type="text"
                  placeholder="2022, 2024"
                  value={customCutsStr}
                  onChange={(e) => setCustomCutsStr(e.target.value)}
                  className="w-28 rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1 font-mono text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}

            <div className="hidden h-4 w-px bg-border-default sm:block" />

            {/* Threshold Slider */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">
                Inclusion Threshold:
              </span>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.01"
                value={inclusionThreshold}
                onChange={(e) =>
                  setInclusionThreshold(parseFloat(e.target.value))
                }
                className="w-24 cursor-pointer accent-brand-500"
              />
              <span className="tabular-metrics font-mono text-xs font-bold text-brand-600">
                {inclusionThreshold.toFixed(2)}
              </span>
            </div>

            {/* Themes per Slice */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Themes / Slice:</span>
              <select
                value={maxThemesPerSlice}
                onChange={(e) => setMaxThemesPerSlice(Number(e.target.value))}
                className="rounded-lg border border-border-default bg-surface-canvas px-2 py-1 text-xs font-bold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5 (Default)</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </div>
          </div>

          {/* Right: Trajectory filter & Keyword Search */}
          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Highlight keyword..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-40 rounded-xl border border-border-default bg-surface-canvas py-1.5 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none sm:w-48"
              />
            </div>

            <select
              value={trajectoryFilter}
              onChange={(e) => setTrajectoryFilter(e.target.value)}
              className="rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-bold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All Trajectories</option>
              <option value="continuation">Continuations Only</option>
              <option value="splitting">Splits &amp; Diversifications</option>
              <option value="merging">Merges &amp; Convergences</option>
            </select>
          </div>
        </div>

        {/* Legend strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="sciai-kicker text-[10px]!">
              Callon Quadrants:
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-status-success-text">
              <span className="h-2 w-2 rounded-full bg-status-success-text" />{" "}
              Motor Themes (Q1)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
              <span className="h-2 w-2 rounded-full bg-brand-500" /> Niche Themes
              (Q2)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-status-warning-text">
              <span className="h-2 w-2 rounded-full bg-status-warning-text" />{" "}
              Emerging/Declining (Q3)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-status-info-text">
              <span className="h-2 w-2 rounded-full bg-status-info-text" /> Basic
              Themes (Q4)
            </span>
          </div>

          <div className="text-[11px] text-ink-muted">
            Click any theme node to trace its ancestral roots &amp; future
            directions.
          </div>
        </div>
      </Card>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap border-b border-border-default">
        <button
          type="button"
          onClick={() => setActiveSubTab("sankey")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeSubTab === "sankey"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          }`}
        >
          <GitBranch className="h-4 w-4" />
          <span>Sankey River Flow</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("matrix")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeSubTab === "matrix"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Transition Matrix &amp; Lineage</span>
          {data && (
            <span className="tabular-metrics rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-secondary">
              {data.links.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("strategic")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeSubTab === "strategic"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Quadrant Shifts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("synthesis")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeSubTab === "synthesis"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          }`}
        >
          <Sparkles className="h-4 w-4 text-brand-500" />
          <span>Scientific Paradigm Shift</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="sciai-card rounded-3xl p-16 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand-500" />
          <div className="mt-4 text-sm font-bold text-ink-primary">
            Partitioning corpus &amp; computing thematic flows...
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            Applying Callon co-word clustering &amp; Simpson inclusion index
            across time slices
          </div>
        </div>
      ) : error ? (
        <AlertBanner tone="danger" title="Error computing Thematic Evolution">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={fetchEvolution}
            >
              Retry Analysis
            </Button>
          </div>
        </AlertBanner>
      ) : !data || data.periods.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-default bg-surface-subtle p-12 text-center">
          <GitBranch className="mx-auto h-10 w-10 text-ink-subtle" />
          <div className="mt-3 text-sm font-bold text-ink-primary">
            No Temporal Documents Found
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            Ensure the active dataset has documents with publication years and
            keywords.
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: SANKEY FLOW DIAGRAM */}
          {activeSubTab === "sankey" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              {/* Sankey Canvas */}
              <div className="sciai-card overflow-x-auto rounded-3xl p-4 xl:col-span-3">
                <div className="min-w-[800px]">
                  {/* Period Headers */}
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 pb-3">
                    {data.periods.map((p, idx) => (
                      <div
                        key={p.index}
                        style={{ width: `${sankeyLayout.columnWidth}px` }}
                        className="rounded-xl border border-border-default bg-surface-subtle p-2.5 text-center shadow-card"
                      >
                        <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-brand-500">
                          <Calendar className="h-3 w-3" />
                          <span>Period {idx + 1}</span>
                        </div>
                        <div className="tabular-metrics mt-0.5 text-sm font-black text-ink-primary">
                          {p.label}
                        </div>
                        <div className="tabular-metrics mt-0.5 flex items-center justify-center gap-2 text-[10px] text-ink-muted">
                          <span>{p.docCount} papers</span>
                          <span>•</span>
                          <span>{p.themeCount} themes</span>
                        </div>
                        {p.stabilityWithNext !== undefined && (
                          <div className="tabular-metrics mt-1.5 border-t border-border-subtle pt-1 text-[9px] font-bold text-ink-secondary">
                            Stability → P{idx + 2}:{" "}
                            <span className="font-mono text-brand-600">
                              {(p.stabilityWithNext * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* SVG Canvas */}
                  <div className="relative mt-4">
                    <svg
                      ref={svgRef}
                      width={sankeyLayout.totalWidth}
                      height={sankeyLayout.totalHeight}
                      className="overflow-visible"
                    >
                      <defs>
                        {sankeyLayout.linkPaths.map(({ link }) => {
                          const srcNode = data.nodes.find(
                            (n) => n.id === link.sourceId
                          );
                          const tgtNode = data.nodes.find(
                            (n) => n.id === link.targetId
                          );
                          const c1 = srcNode
                            ? getQuadrantColor(srcNode.quadrantCode)
                                .gradientFrom
                            : "#315C7C";
                          const c2 = tgtNode
                            ? getQuadrantColor(tgtNode.quadrantCode)
                                .gradientFrom
                            : "#0D9488";
                          return (
                            <linearGradient
                              key={`grad_${link.id}`}
                              id={`grad_${link.id}`}
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="0%"
                            >
                              <stop
                                offset="0%"
                                stopColor={c1}
                                stopOpacity="0.45"
                              />
                              <stop
                                offset="100%"
                                stopColor={c2}
                                stopOpacity="0.45"
                              />
                            </linearGradient>
                          );
                        })}
                      </defs>

                      {/* 1. Render Flow Ribbons */}
                      <g className="flows">
                        {sankeyLayout.linkPaths.map(({ link, d }) => {
                          const isHighlighted = highlightedElements.links.has(
                            link.id
                          );
                          const hasActiveSelection =
                            selectedNodeId !== null ||
                            hoveredNodeId !== null ||
                            selectedLinkId !== null ||
                            hoveredLinkId !== null;

                          let opacity = 0.38;
                          if (hasActiveSelection) {
                            opacity = isHighlighted ? 0.85 : 0.06;
                          }

                          return (
                            <path
                              key={link.id}
                              d={d}
                              fill={`url(#grad_${link.id})`}
                              stroke={
                                isHighlighted ? "#315C7C" : "transparent"
                              }
                              strokeWidth={isHighlighted ? 1.5 : 0}
                              opacity={opacity}
                              className="cursor-pointer transition-all duration-200 hover:opacity-95"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLinkId(link.id);
                                setSelectedNodeId(null);
                              }}
                              onMouseEnter={() => setHoveredLinkId(link.id)}
                              onMouseLeave={() => setHoveredLinkId(null)}
                            >
                              <title>
                                {`${link.sourceThemeName} → ${link.targetThemeName} (Inclusion: ${link.inclusionIndex})\nShared: ${link.sharedKeywords.join(", ")}`}
                              </title>
                            </path>
                          );
                        })}
                      </g>

                      {/* 2. Render Theme Nodes */}
                      <g className="nodes">
                        {Array.from(sankeyLayout.nodeLayouts.values()).map(
                          ({ node, x, y, width, height }) => {
                            const isSelected = selectedNodeId === node.id;
                            const isHovered = hoveredNodeId === node.id;
                            const isHighlighted =
                              highlightedElements.nodes.has(node.id);
                            const hasActiveSelection =
                              selectedNodeId !== null ||
                              hoveredNodeId !== null ||
                              selectedLinkId !== null ||
                              hoveredLinkId !== null;

                            const matchesSearch =
                              searchKeyword.trim() &&
                              (node.name
                                .toLowerCase()
                                .includes(searchKeyword.toLowerCase()) ||
                                node.keywords.some((k) =>
                                  k
                                    .toLowerCase()
                                    .includes(searchKeyword.toLowerCase())
                                ));

                            const qColor = getQuadrantColor(node.quadrantCode);

                            let nodeOpacity = 1;
                            if (
                              hasActiveSelection &&
                              !isHighlighted &&
                              !matchesSearch
                            ) {
                              nodeOpacity = 0.25;
                            }

                            return (
                              <g
                                key={node.id}
                                transform={`translate(${x}, ${y})`}
                                className="cursor-pointer transition-all duration-200"
                                opacity={nodeOpacity}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNodeId(node.id);
                                  setSelectedLinkId(null);
                                }}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                              >
                                <rect
                                  width={width}
                                  height={height}
                                  rx={12}
                                  ry={12}
                                  fill="#ffffff"
                                  stroke={
                                    isSelected || isHovered || matchesSearch
                                      ? qColor.strokeColor
                                      : "#d8ddd8"
                                  }
                                  strokeWidth={
                                    isSelected || matchesSearch ? 2.5 : 1
                                  }
                                  className="shadow-card transition"
                                />

                                <rect
                                  x={0}
                                  y={0}
                                  width={5}
                                  height={height}
                                  rx={2.5}
                                  ry={2.5}
                                  fill={qColor.strokeColor}
                                />

                                <foreignObject
                                  x={8}
                                  y={4}
                                  width={width - 12}
                                  height={height - 8}
                                >
                                  <div className="pointer-events-none flex h-full select-none flex-col justify-between overflow-hidden p-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span
                                        className={`truncate text-xs font-black tracking-tight ${
                                          isSelected
                                            ? "text-brand-700"
                                            : "text-ink-primary"
                                        }`}
                                      >
                                        {node.name}
                                      </span>
                                      <span
                                        className={`shrink-0 rounded border px-1.5 py-0.2 text-[8px] font-bold ${qColor.badgeBg}`}
                                      >
                                        {node.quadrantCode}
                                      </span>
                                    </div>

                                    <div className="tabular-metrics flex items-center justify-between text-[9px] font-semibold text-ink-muted">
                                      <span className="truncate">
                                        {node.docCount} docs •{" "}
                                        {node.totalCitations} cits
                                      </span>
                                      <span className="font-mono text-[8px] text-brand-600">
                                        {node.keywords.length} kws
                                      </span>
                                    </div>

                                    <div className="truncate text-[8px] text-ink-subtle">
                                      {node.keywords.slice(0, 3).join(", ")}
                                    </div>
                                  </div>
                                </foreignObject>
                              </g>
                            );
                          }
                        )}
                      </g>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Inspector Panel (Right) */}
              <div className="space-y-4 xl:col-span-1">
                {selectedNode ? (
                  <Card padding="md" className="space-y-4 rounded-3xl">
                    {/* Node Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-border-subtle pb-3">
                      <div>
                        <div className="sciai-kicker text-[10px]! text-brand-500!">
                          Theme Inspector • {selectedNode.periodLabel}
                        </div>
                        <h2 className="mt-0.5 text-lg font-black text-ink-primary">
                          {selectedNode.name}
                        </h2>
                      </div>
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-black ${
                          getQuadrantColor(selectedNode.quadrantCode).badgeBg
                        }`}
                      >
                        {selectedNode.quadrant}
                      </span>
                    </div>

                    {/* Metric Badges */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">Articles</div>
                        <div className="tabular-metrics text-base font-black text-ink-primary">
                          {selectedNode.docCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">
                          Citations
                        </div>
                        <div className="tabular-metrics text-base font-black text-ink-primary">
                          {selectedNode.totalCitations}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">
                          Callon Centrality
                        </div>
                        <div className="tabular-metrics font-mono text-xs font-bold text-brand-600">
                          {selectedNode.rawCentrality.toFixed(1)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">
                          Callon Density
                        </div>
                        <div className="tabular-metrics font-mono text-xs font-bold text-brand-600">
                          {selectedNode.rawDensity.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Keywords in Cluster */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink-secondary">
                        <span className="tabular-metrics">
                          Thematic Vocabulary ({selectedNode.keywords.length})
                        </span>
                        <span className="text-[10px] text-ink-subtle">
                          Co-occurring
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Lineage: Ancestors */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
                        <ArrowRight className="h-3 w-3 rotate-180 text-ink-subtle" />
                        <span>Lineage Roots (Origins)</span>
                      </div>
                      {nodeConnections.predecessors.length === 0 ? (
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2 text-[11px] italic text-ink-muted">
                          Origin theme or newly emerged in this period.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {nodeConnections.predecessors.map(
                            ({ link, node }) => {
                              const badge = getTrajectoryBadge(link.trajectory);
                              return (
                                <button
                                  type="button"
                                  key={link.id}
                                  onClick={() =>
                                    node && setSelectedNodeId(node.id)
                                  }
                                  className="w-full cursor-pointer rounded-xl border border-border-default bg-surface-subtle p-2 text-left text-xs transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="truncate font-bold text-ink-primary">
                                      {node?.name || link.sourceThemeName}
                                    </span>
                                    <span className="tabular-metrics font-mono text-[10px] font-bold text-brand-600">
                                      I = {link.inclusionIndex}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-[10px]">
                                    <span
                                      className={`rounded border px-1.5 py-0.2 text-[9px] font-semibold ${badge.bg}`}
                                    >
                                      {badge.label}
                                    </span>
                                    <span className="truncate text-[9px] text-ink-subtle">
                                      {link.sharedKeywords
                                        .slice(0, 2)
                                        .join(", ")}
                                    </span>
                                  </div>
                                </button>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>

                    {/* Lineage: Descendants */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
                        <ArrowRight className="h-3 w-3 text-brand-500" />
                        <span>Evolutionary Trajectory (Destinations)</span>
                      </div>
                      {nodeConnections.successors.length === 0 ? (
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2 text-[11px] italic text-ink-muted">
                          Terminal theme (latest period) or fading.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {nodeConnections.successors.map(({ link, node }) => {
                            const badge = getTrajectoryBadge(link.trajectory);
                            return (
                              <button
                                type="button"
                                key={link.id}
                                onClick={() =>
                                  node && setSelectedNodeId(node.id)
                                }
                                className="w-full cursor-pointer rounded-xl border border-border-default bg-surface-subtle p-2 text-left text-xs transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate font-bold text-ink-primary">
                                    {node?.name || link.targetThemeName}
                                  </span>
                                  <span className="tabular-metrics font-mono text-[10px] font-bold text-brand-600">
                                    I = {link.inclusionIndex}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px]">
                                  <span
                                    className={`rounded border px-1.5 py-0.2 text-[9px] font-semibold ${badge.bg}`}
                                  >
                                    {badge.label}
                                  </span>
                                  <span className="truncate text-[9px] text-ink-subtle">
                                    {link.sharedKeywords
                                      .slice(0, 2)
                                      .join(", ")}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>
                ) : selectedLink ? (
                  <Card padding="md" className="space-y-4 rounded-3xl">
                    <div className="border-b border-border-subtle pb-3">
                      <div className="sciai-kicker text-[10px]! text-brand-500!">
                        Evolutionary Transition Flow
                      </div>
                      <h2 className="mt-1 flex items-center gap-1.5 text-base font-black text-ink-primary">
                        <span className="truncate">
                          {selectedLink.sourceThemeName}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-brand-500" />
                        <span className="truncate">
                          {selectedLink.targetThemeName}
                        </span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-2">
                        <div className="sciai-kicker text-[9px]! text-brand-700!">
                          Inclusion Index
                        </div>
                        <div className="tabular-metrics font-mono text-lg font-black text-brand-800">
                          {selectedLink.inclusionIndex}
                        </div>
                        <div className="text-[9px] text-brand-600">
                          Simpson coeff
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">
                          Jaccard Index
                        </div>
                        <div className="tabular-metrics font-mono text-lg font-black text-ink-primary">
                          {selectedLink.jaccardIndex}
                        </div>
                        <div className="text-[9px] text-ink-muted">
                          Intersection / Union
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="sciai-kicker mb-1 text-[10px]!">
                        Trajectory Classification
                      </div>
                      <div className="rounded-xl border border-border-default bg-surface-subtle p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                              getTrajectoryBadge(selectedLink.trajectory).bg
                            }`}
                          >
                            {getTrajectoryBadge(selectedLink.trajectory).label}
                          </span>
                          <span className="text-xs font-bold text-ink-secondary">
                            {selectedLink.trajectory.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-ink-muted">
                          {selectedLink.trajectory === "continuation" &&
                            "Direct paradigm continuity with strong conceptual preservation across slices."}
                          {selectedLink.trajectory === "splitting" &&
                            "Thematic divergence: the parent theme branched out into multiple specialized niches."}
                          {selectedLink.trajectory === "merging" &&
                            "Thematic convergence: multiple preceding concepts unified into a single integrated framework."}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 text-xs font-bold text-ink-secondary">
                        Shared Conceptual Bridge (
                        {selectedLink.sharedKeywords.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedLink.sharedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border-default bg-surface-subtle p-6 text-center">
                    <Info className="mx-auto h-6 w-6 text-ink-subtle" />
                    <div className="mt-2 text-xs font-bold text-ink-primary">
                      No Element Selected
                    </div>
                    <div className="mt-1 text-[11px] text-ink-muted">
                      Click any theme block or connection ribbon in the diagram
                      to inspect its metrics and evolutionary lineage.
                    </div>
                  </div>
                )}

                {/* Methodological Guidance Card */}
                <div className="space-y-2 rounded-3xl border border-border-default bg-surface-subtle p-4 text-xs text-ink-secondary">
                  <div className="flex items-center gap-1.5 font-bold text-ink-primary">
                    <HelpCircle className="h-3.5 w-3.5 text-brand-500" />
                    <span>Methodological Foundations</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Calculated using <strong>Cobo et al. (2011)</strong>:
                  </p>
                  <ul className="list-inside list-disc space-y-1 font-mono text-[10px] text-ink-muted">
                    <li>
                      {"Inclusion(T_i, T_j) = |T_i ∩ T_j| / min(|T_i|, |T_j|)"}
                    </li>
                    <li>{"Stability = Σ|T_i ∩ T_j| / |K_1 ∪ K_2|"}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSITION MATRIX TABLE */}
          {activeSubTab === "matrix" && (
            <Card padding="lg" className="space-y-4 rounded-3xl">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-ink-primary">
                    Evolutionary Transition &amp; Inclusion Matrix
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Detailed record of all longitudinal flows, Simpson
                    coefficient scores, and thematic bridge keywords.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCSV}
                  icon={<Download className="h-3.5 w-3.5 text-ink-subtle" />}
                >
                  Download CSV
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Source Period</th>
                      <th className="px-4 py-3">Origin Theme</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Target Period</th>
                      <th className="px-4 py-3">Destination Theme</th>
                      <th className="px-4 py-3">Inclusion Index</th>
                      <th className="px-4 py-3">Trajectory</th>
                      <th className="px-4 py-3">Shared Bridge Keywords</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.links.map((link) => {
                      const badge = getTrajectoryBadge(link.trajectory);
                      const srcNode = data.nodes.find(
                        (n) => n.id === link.sourceId
                      );
                      const tgtNode = data.nodes.find(
                        (n) => n.id === link.targetId
                      );
                      return (
                        <tr
                          key={link.id}
                          className="cursor-pointer transition-colors hover:bg-brand-50/40"
                          onClick={() => {
                            setSelectedLinkId(link.id);
                            setSelectedNodeId(null);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <td className="tabular-metrics px-4 py-3 font-mono text-ink-secondary">
                            {data.periods[link.sourcePeriod]?.label}
                          </td>
                          <td className="px-4 py-3 font-bold text-ink-primary">
                            <span className="inline-flex items-center gap-1.5">
                              {srcNode && (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    getQuadrantColor(srcNode.quadrantCode)
                                      .accentBg
                                  }`}
                                />
                              )}
                              {link.sourceThemeName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-brand-500">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </td>
                          <td className="tabular-metrics px-4 py-3 font-mono text-ink-secondary">
                            {data.periods[link.targetPeriod]?.label}
                          </td>
                          <td className="px-4 py-3 font-bold text-ink-primary">
                            <span className="inline-flex items-center gap-1.5">
                              {tgtNode && (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    getQuadrantColor(tgtNode.quadrantCode)
                                      .accentBg
                                  }`}
                                />
                              )}
                              {link.targetThemeName}
                            </span>
                          </td>
                          <td className="tabular-metrics px-4 py-3 font-mono font-bold text-brand-600">
                            {link.inclusionIndex}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-ink-muted">
                            {link.sharedKeywords.join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: QUADRANT STRATEGIC SHIFTS */}
          {activeSubTab === "strategic" && (
            <Card padding="lg" className="space-y-6 rounded-3xl">
              <div>
                <h2 className="text-base font-bold text-ink-primary">
                  Callon&apos;s Strategic Quadrant Migration across Time
                </h2>
                <p className="text-xs text-ink-muted">
                  Observe how concepts transition from Emerging (Q3) → Motor (Q1)
                  → Basic (Q4) as scientific maturity advances.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Motor Themes */}
                <div className="space-y-3 rounded-2xl border border-status-success-border bg-status-success-bg/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-status-success-text">
                      Motor Themes (Q1)
                    </span>
                    <span className="rounded border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[9px] font-bold text-status-success-text">
                      High C • High D
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Driving, well-structured paradigms of each period.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q1")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="cursor-pointer rounded-xl border border-border-default bg-surface-canvas p-2.5 shadow-card transition-colors hover:border-status-success-border"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-ink-primary">
                            <span>{n.name}</span>
                            <span className="tabular-metrics font-mono text-[9px] text-status-success-text">
                              {n.periodLabel}
                            </span>
                          </div>
                          <div className="tabular-metrics mt-1 truncate text-[10px] text-ink-muted">
                            {n.docCount} docs •{" "}
                            {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Niche Themes */}
                <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-700">
                      Niche Themes (Q2)
                    </span>
                    <span className="rounded border border-brand-200 bg-brand-100/70 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                      Low C • High D
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Highly developed specialized sub-domains.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q2")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="cursor-pointer rounded-xl border border-border-default bg-surface-canvas p-2.5 shadow-card transition-colors hover:border-brand-300"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-ink-primary">
                            <span>{n.name}</span>
                            <span className="tabular-metrics font-mono text-[9px] text-brand-600">
                              {n.periodLabel}
                            </span>
                          </div>
                          <div className="tabular-metrics mt-1 truncate text-[10px] text-ink-muted">
                            {n.docCount} docs •{" "}
                            {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Emerging/Declining Themes */}
                <div className="space-y-3 rounded-2xl border border-status-warning-border bg-status-warning-bg/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-status-warning-text">
                      Emerging / Declining (Q3)
                    </span>
                    <span className="rounded border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[9px] font-bold text-status-warning-text">
                      Low C • Low D
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Nascent or fading exploratory concepts.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q3")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="cursor-pointer rounded-xl border border-border-default bg-surface-canvas p-2.5 shadow-card transition-colors hover:border-status-warning-border"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-ink-primary">
                            <span>{n.name}</span>
                            <span className="tabular-metrics font-mono text-[9px] text-status-warning-text">
                              {n.periodLabel}
                            </span>
                          </div>
                          <div className="tabular-metrics mt-1 truncate text-[10px] text-ink-muted">
                            {n.docCount} docs •{" "}
                            {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Basic Themes */}
                <div className="space-y-3 rounded-2xl border border-status-info-border bg-status-info-bg/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-status-info-text">
                      Basic Themes (Q4)
                    </span>
                    <span className="rounded border border-status-info-border bg-status-info-bg px-1.5 py-0.5 text-[9px] font-bold text-status-info-text">
                      High C • Low D
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Foundational and transversal pillars of research.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q4")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="cursor-pointer rounded-xl border border-border-default bg-surface-canvas p-2.5 shadow-card transition-colors hover:border-status-info-border"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-ink-primary">
                            <span>{n.name}</span>
                            <span className="tabular-metrics font-mono text-[9px] text-status-info-text">
                              {n.periodLabel}
                            </span>
                          </div>
                          <div className="tabular-metrics mt-1 truncate text-[10px] text-ink-muted">
                            {n.docCount} docs •{" "}
                            {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 4: SCIENTIFIC PARADIGM SYNTHESIS */}
          {activeSubTab === "synthesis" && (
            <Card padding="lg" className="space-y-6 rounded-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 font-black text-brand-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-ink-primary">
                    Scientometric Narrative: Evolutionary Paradigm Synthesis
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Automated epistemic reconstruction of scientific transitions
                    across {data.summary.yearSpan}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {data.periods.map((p, idx) => {
                  const pNodes = data.nodes.filter(
                    (n) => n.periodIndex === p.index
                  );
                  return (
                    <div
                      key={p.index}
                      className="space-y-3 rounded-2xl border border-border-default bg-surface-subtle p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-black text-brand-700">
                          Epoch {idx + 1}: {p.label}
                        </span>
                        <span className="tabular-metrics text-[10px] font-bold text-ink-muted">
                          {p.docCount} works
                        </span>
                      </div>

                      <div className="text-xs font-bold text-ink-primary">
                        Key Conceptual Anchors:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pNodes.map((n) => (
                          <span
                            key={n.id}
                            className="rounded border border-border-default bg-surface-canvas px-2 py-0.5 text-[10px] font-bold text-ink-primary"
                          >
                            {n.name}
                          </span>
                        ))}
                      </div>

                      <div className="border-t border-border-subtle pt-2 text-[11px] leading-relaxed text-ink-secondary">
                        {idx === 0 &&
                          "Formative foundational stage: establishment of core diagnostic definitions and exploratory algorithmic implementations."}
                        {idx === 1 &&
                          "Expansion and divergence stage: consolidation of deep learning architectures with cross-validation across clinical trials."}
                        {idx === 2 &&
                          "Translational and integration stage: multi-modal healthcare integration, real-time decision support, and precision biomarkers."}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Longitudinal Synthesis Card */}
              <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
                <div className="sciai-kicker text-brand-700!">
                  Epistemic Continuity &amp; Divergence Analysis
                </div>
                <p className="text-xs leading-relaxed text-ink-secondary">
                  The corpus demonstrates an overall longitudinal stability
                  index of{" "}
                  <strong className="tabular-metrics text-ink-primary">
                    {(data.summary.averageStability * 100).toFixed(1)}%
                  </strong>
                  . A dominant evolutionary trajectory emerges connecting
                  foundational biomedical modeling to modern multi-modal deep
                  architectures. The presence of {data.summary.splitsCount}{" "}
                  thematic splits highlights research specialization, whereas{" "}
                  {data.summary.mergesCount} thematic merges denote conceptual
                  cross-pollination.
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}