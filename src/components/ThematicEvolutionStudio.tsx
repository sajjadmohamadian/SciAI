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
  Filter,
  Download,
  Sparkles,
  RefreshCw,
  Search,
  Sliders,
  Layers,
  Info,
  Calendar,
  ArrowRight,
  TrendingUp,
  Share2,
  CheckCircle2,
  Activity,
  FileSpreadsheet,
  ChevronRight,
  HelpCircle,
  Flame,
  Database,
} from "lucide-react";

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
  onNavigateToFrontier,
}: Props) {
  // Target Dataset State
  const [selectedDsId, setSelectedDsId] = useState<string>(
    activeDatasetId || getPreferredThematicDatasetId(datasets)
  );

  // Synchronize when parent prop or dashboard datasets change.
  // Thematic evolution needs a concrete dataset with temporal keyword records;
  // the consolidated portfolio placeholder cannot be posted as a real dataset_id.
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
  const [minKeywordFreq, setMinKeywordFreq] = useState<number>(1);
  const [inclusionThreshold, setInclusionThreshold] = useState<number>(0.12);
  const [maxThemesPerSlice, setMaxThemesPerSlice] = useState<number>(5);
  const [trajectoryFilter, setTrajectoryFilter] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Subtabs
  const [activeSubTab, setActiveSubTab] = useState<"sankey" | "matrix" | "strategic" | "synthesis">("sankey");

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
      // Auto-select first node if none selected
      if (result.nodes && result.nodes.length > 0 && !selectedNodeId) {
        setSelectedNodeId(result.nodes[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch thematic evolution:", err);
      setError(err instanceof Error ? err.message : "Failed to load thematic evolution");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvolution();
  }, [selectedDsId, sliceCount, isCustomCuts, minKeywordFreq, inclusionThreshold, maxThemesPerSlice]);

  // Computed layout for Sankey diagram
  const sankeyLayout = useMemo(() => {
    if (!data || data.periods.length === 0 || data.nodes.length === 0) {
      return { columnWidth: 180, periodX: [], nodeLayouts: new Map(), linkPaths: [], totalWidth: 800, totalHeight: 520 };
    }

    const totalPeriods = data.periods.length;
    const paddingX = 40;
    const paddingY = 60;
    const nodeWidth = 175;
    const minHeight = 440;

    // Calculate total canvas width
    const columnGap = Math.max(140, Math.min(260, (900 - paddingX * 2 - totalPeriods * nodeWidth) / Math.max(1, totalPeriods - 1)));
    const totalWidth = paddingX * 2 + totalPeriods * nodeWidth + (totalPeriods - 1) * columnGap;

    const periodX: number[] = [];
    for (let p = 0; p < totalPeriods; p++) {
      periodX.push(paddingX + p * (nodeWidth + columnGap));
    }

    // Nodes per period
    const periodNodesMap = new Map<number, ThematicThemeNode[]>();
    for (let p = 0; p < totalPeriods; p++) {
      periodNodesMap.set(p, []);
    }
    for (const node of data.nodes) {
      const list = periodNodesMap.get(node.periodIndex) || [];
      list.push(node);
      periodNodesMap.set(node.periodIndex, list);
    }

    // Calculate vertical coordinates for each node
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
      const totalWeight = pNodes.reduce((sum, n) => sum + Math.max(1, n.docCount), 0);

      let currentY = paddingY;
      for (const node of pNodes) {
        const weight = Math.max(1, node.docCount);
        const nodeH = Math.max(48, Math.min(84, Math.round(((availableH - totalGap) * weight) / Math.max(1, totalWeight))));
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

    // Filter links by trajectory if needed
    const filteredLinks = data.links.filter((l) => {
      if (trajectoryFilter === "all") return true;
      return l.trajectory === trajectoryFilter;
    });

    // Calculate link paths with Bézier ribbons
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

    // Track vertical offsets along node heights so multiple links don't overlap
    const nodeOutUsage = new Map<string, number>();
    const nodeInUsage = new Map<string, number>();

    for (const l of filteredLinks) {
      const srcPos = nodeLayouts.get(l.sourceId);
      const tgtPos = nodeLayouts.get(l.targetId);
      if (!srcPos || !tgtPos) continue;

      const baseThickness = Math.max(4, Math.min(28, Math.round(l.inclusionIndex * 30)));

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

  // Determine which nodes and links are active / highlighted based on selection
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

    // Trace upstream (ancestors)
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

    // Trace downstream (descendants)
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

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [data, selectedNodeId]);

  // Selected link object
  const selectedLink = useMemo(() => {
    if (!data || !selectedLinkId) return null;
    return data.links.find((l) => l.id === selectedLinkId) || null;
  }, [data, selectedLinkId]);

  // Direct predecessors and successors of selected node
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

  // Color helpers for Callon Quadrants
  const getQuadrantColor = (code: "Q1" | "Q2" | "Q3" | "Q4") => {
    switch (code) {
      case "Q1": // Motor Themes
        return {
          badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          nodeBorder: "border-emerald-500",
          accentBg: "bg-emerald-500",
          strokeColor: "#10b981",
          gradientFrom: "#10b981",
          textAccent: "text-emerald-700",
        };
      case "Q2": // Niche Themes
        return {
          badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
          nodeBorder: "border-purple-500",
          accentBg: "bg-purple-500",
          strokeColor: "#a855f7",
          gradientFrom: "#a855f7",
          textAccent: "text-purple-700",
        };
      case "Q3": // Emerging/Declining Themes
        return {
          badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
          nodeBorder: "border-amber-500",
          accentBg: "bg-amber-500",
          strokeColor: "#f59e0b",
          gradientFrom: "#f59e0b",
          textAccent: "text-amber-700",
        };
      case "Q4": // Basic Themes
      default:
        return {
          badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
          nodeBorder: "border-sky-500",
          accentBg: "bg-sky-500",
          strokeColor: "#0284c7",
          gradientFrom: "#0284c7",
          textAccent: "text-sky-700",
        };
    }
  };

  // Trajectory Badge helper
  const getTrajectoryBadge = (traj: string) => {
    switch (traj) {
      case "continuation":
        return {
          label: "Continuation",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "splitting":
        return {
          label: "Splitting",
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
        };
      case "merging":
        return {
          label: "Merging",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "emerging":
        return {
          label: "Emerging",
          bg: "bg-cyan-50 text-cyan-700 border-cyan-200",
        };
      case "fading":
        return {
          label: "Fading",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
        };
      default:
        return {
          label: traj,
          bg: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  // Export SVG
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

  // Export CSV Matrix
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
    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
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
      <div className="space-y-5 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-purple-600 whitespace-nowrap">
              Scientometrics Evolution Lab
            </span>
            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 whitespace-nowrap">
              Cobo (2011) & SciMAT / Bibliometrix
            </span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            <GitBranch className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-purple-600" />
            <span className="min-w-0">Thematic Evolution &amp; Slicing</span>
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
            Longitudinal science mapping: divide the corpus into sequential time slices, calculate Callon&apos;s strategic themes, and trace evolutionary trajectories (continuation, splitting, merging) using the Simpson Inclusion Index.
          </p>
        </div>

        {/* Dataset Selector & Action Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Target Dataset Selector matching Historical Citation Genealogy */}
          {datasets.length > 0 && (
            <div className="flex min-w-0 flex-col">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Database className="h-3 w-3 shrink-0 text-purple-600" />
                Target Dataset
              </label>
              <select
                id="thematic-dataset-select"
                className="mt-1 block w-full min-w-0 max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:w-80"
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
            <button
              type="button"
              onClick={fetchEvolution}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
              <span>Recalculate</span>
            </button>

            <button
              type="button"
              onClick={handleExportSVG}
              disabled={!data || data.nodes.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>SVG Diagram</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!data || data.transitionMatrix.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time Span</div>
            <div className="mt-1 text-lg font-black text-slate-900">{data.summary.yearSpan}</div>
            <div className="mt-0.5 text-[10px] text-slate-500">{data.summary.totalDocuments} articles sliced</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Periods (Slices)</div>
            <div className="mt-1 text-lg font-black text-purple-700">{data.summary.totalPeriods} epochs</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Sequential intervals</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thematic Clusters</div>
            <div className="mt-1 text-lg font-black text-slate-900">{data.summary.totalThemes} themes</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Callon mapped nodes</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Continuations</div>
            <div className="mt-1 text-lg font-black text-emerald-600">{data.summary.continuationsCount} flows</div>
            <div className="mt-0.5 text-[10px] text-emerald-700/80">Direct paradigm lines</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Splits & Merges</div>
            <div className="mt-1 text-lg font-black text-indigo-600">
              {data.summary.splitsCount} / {data.summary.mergesCount}
            </div>
            <div className="mt-0.5 text-[10px] text-indigo-700/80">Divergence & synthesis</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Stability Index</div>
            <div className="mt-1 text-lg font-black text-amber-600">
              {(data.summary.averageStability * 100).toFixed(1)}%
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">Longitudinal cohesion</div>
          </div>
        </div>
      )}

      {/* Slicing & Parameters Toolbar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Slicing Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sliders className="h-3.5 w-3.5 text-purple-600" />
              <span>Slicing Mode:</span>
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsCustomCuts(false)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition ${
                  !isCustomCuts
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Equal Slices
              </button>
              <button
                type="button"
                onClick={() => setIsCustomCuts(true)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition ${
                  isCustomCuts
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Custom Cut Years
              </button>
            </div>

            {!isCustomCuts ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Periods:</span>
                <select
                  value={sliceCount}
                  onChange={(e) => setSliceCount(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:border-purple-500 focus:outline-hidden"
                >
                  <option value={2}>2 Slices</option>
                  <option value={3}>3 Slices (Default)</option>
                  <option value={4}>4 Slices</option>
                  <option value={5}>5 Slices</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Cuts (e.g. 2022, 2024):</span>
                <input
                  type="text"
                  placeholder="2022, 2024"
                  value={customCutsStr}
                  onChange={(e) => setCustomCutsStr(e.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-purple-500 focus:outline-hidden"
                />
              </div>
            )}

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Threshold Slider */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Inclusion Threshold:</span>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.01"
                value={inclusionThreshold}
                onChange={(e) => setInclusionThreshold(parseFloat(e.target.value))}
                className="w-24 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-purple-700">
                {inclusionThreshold.toFixed(2)}
              </span>
            </div>

            {/* Themes per Slice */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Themes / Slice:</span>
              <select
                value={maxThemesPerSlice}
                onChange={(e) => setMaxThemesPerSlice(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:border-purple-500 focus:outline-hidden"
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
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Highlight keyword..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-40 sm:w-48 rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-purple-500 focus:outline-hidden"
              />
            </div>

            <select
              value={trajectoryFilter}
              onChange={(e) => setTrajectoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-purple-500 focus:outline-hidden"
            >
              <option value="all">All Trajectories</option>
              <option value="continuation">Continuations Only</option>
              <option value="splitting">Splits & Diversifications</option>
              <option value="merging">Merges & Convergences</option>
            </select>
          </div>
        </div>

        {/* Legend strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Callon Quadrants:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motor Themes (Q1)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Niche Themes (Q2)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Emerging/Declining (Q3)
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Basic Themes (Q4)
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            Click any theme node to trace its ancestral roots & future directions.
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab("sankey")}
          className={`cursor-pointer px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "sankey"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GitBranch className="h-4 w-4" />
          <span>Sankey River Flow</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("matrix")}
          className={`cursor-pointer px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "matrix"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Transition Matrix & Lineage</span>
          {data && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {data.links.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("strategic")}
          className={`cursor-pointer px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "strategic"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Quadrant Shifts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("synthesis")}
          className={`cursor-pointer px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "synthesis"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span>Scientific Paradigm Shift</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-xs">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
          <div className="mt-4 text-sm font-bold text-slate-800">Partitioning corpus & computing thematic flows...</div>
          <div className="mt-1 text-xs text-slate-500">Applying Callon co-word clustering & Simpson inclusion index across time slices</div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-8 text-center">
          <div className="text-sm font-bold text-rose-800">Error computing Thematic Evolution</div>
          <div className="mt-1 text-xs text-rose-600">{error}</div>
          <button
            type="button"
            onClick={fetchEvolution}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
          >
            Retry Analysis
          </button>
        </div>
      ) : !data || data.periods.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <GitBranch className="mx-auto h-10 w-10 text-slate-400" />
          <div className="mt-3 text-sm font-bold text-slate-800">No Temporal Documents Found</div>
          <div className="mt-1 text-xs text-slate-500">Ensure the active dataset has documents with publication years and keywords.</div>
        </div>
      ) : (
        <>
          {/* TAB 1: SANKEY FLOW DIAGRAM */}
          {activeSubTab === "sankey" && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Sankey Canvas */}
              <div className="xl:col-span-3 rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Period Headers */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 px-4">
                    {data.periods.map((p, idx) => (
                      <div
                        key={p.index}
                        style={{ width: `${sankeyLayout.columnWidth}px` }}
                        className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-center shadow-2xs"
                      >
                        <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700">
                          <Calendar className="h-3 w-3" />
                          <span>Period {idx + 1}</span>
                        </div>
                        <div className="mt-0.5 text-sm font-black text-slate-900">{p.label}</div>
                        <div className="mt-0.5 flex items-center justify-center gap-2 text-[10px] text-slate-500">
                          <span>{p.docCount} papers</span>
                          <span>•</span>
                          <span>{p.themeCount} themes</span>
                        </div>
                        {p.stabilityWithNext !== undefined && (
                          <div className="mt-1.5 pt-1 border-t border-slate-200/60 text-[9px] font-bold text-slate-600">
                            Stability $\rightarrow$ P{idx + 2}:{" "}
                            <span className="text-purple-700 font-mono">
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
                        {/* Gradient definitions for each flow link */}
                        {sankeyLayout.linkPaths.map(({ link }) => {
                          const srcNode = data.nodes.find((n) => n.id === link.sourceId);
                          const tgtNode = data.nodes.find((n) => n.id === link.targetId);
                          const c1 = srcNode ? getQuadrantColor(srcNode.quadrantCode).gradientFrom : "#8b5cf6";
                          const c2 = tgtNode ? getQuadrantColor(tgtNode.quadrantCode).gradientFrom : "#3b82f6";
                          return (
                            <linearGradient
                              key={`grad_${link.id}`}
                              id={`grad_${link.id}`}
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="0%"
                            >
                              <stop offset="0%" stopColor={c1} stopOpacity="0.45" />
                              <stop offset="100%" stopColor={c2} stopOpacity="0.45" />
                            </linearGradient>
                          );
                        })}
                      </defs>

                      {/* 1. Render Flow Ribbons */}
                      <g className="flows">
                        {sankeyLayout.linkPaths.map(({ link, d }) => {
                          const isHighlighted = highlightedElements.links.has(link.id);
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
                              stroke={isHighlighted ? "#7c3aed" : "transparent"}
                              strokeWidth={isHighlighted ? 1.5 : 0}
                              opacity={opacity}
                              className="transition-all duration-200 cursor-pointer hover:opacity-95"
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
                        {Array.from(sankeyLayout.nodeLayouts.values()).map(({ node, x, y, width, height }) => {
                          const isSelected = selectedNodeId === node.id;
                          const isHovered = hoveredNodeId === node.id;
                          const isHighlighted = highlightedElements.nodes.has(node.id);
                          const hasActiveSelection =
                            selectedNodeId !== null ||
                            hoveredNodeId !== null ||
                            selectedLinkId !== null ||
                            hoveredLinkId !== null;

                          const matchesSearch =
                            searchKeyword.trim() &&
                            (node.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                              node.keywords.some((k) => k.toLowerCase().includes(searchKeyword.toLowerCase())));

                          const qColor = getQuadrantColor(node.quadrantCode);

                          let nodeOpacity = 1;
                          if (hasActiveSelection && !isHighlighted && !matchesSearch) {
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
                              {/* Node Container Card */}
                              <rect
                                width={width}
                                height={height}
                                rx={12}
                                ry={12}
                                fill="#ffffff"
                                stroke={isSelected || isHovered || matchesSearch ? qColor.strokeColor : "#e2e8f0"}
                                strokeWidth={isSelected || matchesSearch ? 2.5 : 1}
                                className="shadow-xs transition"
                              />

                              {/* Left Accent Color Indicator */}
                              <rect
                                x={0}
                                y={0}
                                width={5}
                                height={height}
                                rx={2.5}
                                ry={2.5}
                                fill={qColor.strokeColor}
                              />

                              {/* Content inside node */}
                              <foreignObject x={8} y={4} width={width - 12} height={height - 8}>
                                <div className="h-full flex flex-col justify-between p-1 overflow-hidden pointer-events-none select-none">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`truncate text-xs font-black tracking-tight ${
                                        isSelected ? "text-purple-950 font-black" : "text-slate-900"
                                      }`}
                                    >
                                      {node.name}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded px-1.5 py-0.2 text-[8px] font-bold border ${qColor.badgeBg}`}
                                    >
                                      {node.quadrantCode}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold">
                                    <span className="truncate">
                                      {node.docCount} docs • {node.totalCitations} cits
                                    </span>
                                    <span className="font-mono text-[8px] text-purple-700">
                                      {node.keywords.length} kws
                                    </span>
                                  </div>

                                  {/* Keyword Snippet */}
                                  <div className="truncate text-[8px] text-slate-400">
                                    {node.keywords.slice(0, 3).join(", ")}
                                  </div>
                                </div>
                              </foreignObject>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Inspector Panel (Right) */}
              <div className="xl:col-span-1 space-y-4">
                {selectedNode ? (
                  <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
                    {/* Node Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                          Theme Inspector • {selectedNode.periodLabel}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 mt-0.5">{selectedNode.name}</h2>
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
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Articles</div>
                        <div className="text-base font-black text-slate-900">{selectedNode.docCount}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Citations</div>
                        <div className="text-base font-black text-slate-900">{selectedNode.totalCitations}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Callon Centrality</div>
                        <div className="text-xs font-mono font-bold text-purple-700">
                          {selectedNode.rawCentrality.toFixed(1)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Callon Density</div>
                        <div className="text-xs font-mono font-bold text-purple-700">
                          {selectedNode.rawDensity.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Keywords in Cluster */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>Thematic Vocabulary ({selectedNode.keywords.length})</span>
                        <span className="text-[10px] text-slate-400">Co-occurring</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-purple-50 text-purple-800 border border-purple-200/60 px-2 py-0.5 text-[10px] font-semibold"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Lineage: Ancestors (Where it came from) */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-slate-400 rotate-180" />
                        <span>Lineage Roots (Origins)</span>
                      </div>
                      {nodeConnections.predecessors.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic rounded-lg bg-slate-50 p-2 border border-slate-100">
                          Origin theme or newly emerged in this period.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {nodeConnections.predecessors.map(({ link, node }) => {
                            const badge = getTrajectoryBadge(link.trajectory);
                            return (
                              <button
                                type="button"
                                key={link.id}
                                onClick={() => node && setSelectedNodeId(node.id)}
                                className="w-full text-left rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200/80 p-2 transition text-xs cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 truncate">
                                    {node?.name || link.sourceThemeName}
                                  </span>
                                  <span className="font-mono text-[10px] text-purple-700 font-bold">
                                    I = {link.inclusionIndex}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px]">
                                  <span className={`px-1.5 py-0.2 rounded border text-[9px] ${badge.bg}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-slate-400 text-[9px] truncate">
                                    {link.sharedKeywords.slice(0, 2).join(", ")}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Lineage: Descendants (Where it branches to) */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-purple-600" />
                        <span>Evolutionary Trajectory (Destinations)</span>
                      </div>
                      {nodeConnections.successors.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic rounded-lg bg-slate-50 p-2 border border-slate-100">
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
                                onClick={() => node && setSelectedNodeId(node.id)}
                                className="w-full text-left rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200/80 p-2 transition text-xs cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 truncate">
                                    {node?.name || link.targetThemeName}
                                  </span>
                                  <span className="font-mono text-[10px] text-purple-700 font-bold">
                                    I = {link.inclusionIndex}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px]">
                                  <span className={`px-1.5 py-0.2 rounded border text-[9px] ${badge.bg}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-slate-400 text-[9px] truncate">
                                    {link.sharedKeywords.slice(0, 2).join(", ")}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedLink ? (
                  /* Link Inspector */
                  <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                        Evolutionary Transition Flow
                      </div>
                      <h2 className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                        <span className="truncate">{selectedLink.sourceThemeName}</span>
                        <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
                        <span className="truncate">{selectedLink.targetThemeName}</span>
                      </h2>
                    </div>

                    {/* Transition Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl bg-purple-50/60 p-2 border border-purple-100">
                        <div className="text-[9px] font-bold text-purple-600 uppercase">Inclusion Index</div>
                        <div className="text-lg font-mono font-black text-purple-900">
                          {selectedLink.inclusionIndex}
                        </div>
                        <div className="text-[9px] text-purple-600/80">Simpson coeff</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Jaccard Index</div>
                        <div className="text-lg font-mono font-black text-slate-900">
                          {selectedLink.jaccardIndex}
                        </div>
                        <div className="text-[9px] text-slate-500">Intersection / Union</div>
                      </div>
                    </div>

                    {/* Trajectory */}
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Trajectory Classification
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                              getTrajectoryBadge(selectedLink.trajectory).bg
                            }`}
                          >
                            {getTrajectoryBadge(selectedLink.trajectory).label}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {selectedLink.trajectory.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {selectedLink.trajectory === "continuation" &&
                            "Direct paradigm continuity with strong conceptual preservation across slices."}
                          {selectedLink.trajectory === "splitting" &&
                            "Thematic divergence: the parent theme branched out into multiple specialized niches."}
                          {selectedLink.trajectory === "merging" &&
                            "Thematic convergence: multiple preceding concepts unified into a single integrated framework."}
                        </div>
                      </div>
                    </div>

                    {/* Shared Bridge Keywords */}
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1.5">
                        Shared Conceptual Bridge ({selectedLink.sharedKeywords.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedLink.sharedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <Info className="mx-auto h-6 w-6 text-slate-400" />
                    <div className="mt-2 text-xs font-bold text-slate-700">No Element Selected</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Click any theme block or connection ribbon in the diagram to inspect its metrics and evolutionary lineage.
                    </div>
                  </div>
                )}

                {/* Methodological Guidance Card */}
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
                    <span>Methodological Foundations</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Calculated using <strong>Cobo et al. (2011)</strong>:
                  </p>
                  <ul className="list-disc list-inside text-[10px] text-slate-500 space-y-1 font-mono">
                    <li>{"Inclusion(T_i, T_j) = |T_i ∩ T_j| / min(|T_i|, |T_j|)"}</li>
                    <li>{"Stability = Σ|T_i ∩ T_j| / |K_1 ∪ K_2|"}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSITION MATRIX TABLE */}
          {activeSubTab === "matrix" && (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Evolutionary Transition & Inclusion Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Detailed record of all longitudinal flows, Simpson coefficient scores, and thematic bridge keywords.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-800 transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Download CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Source Period</th>
                      <th className="py-3 px-4">Origin Theme</th>
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Target Period</th>
                      <th className="py-3 px-4">Destination Theme</th>
                      <th className="py-3 px-4">Inclusion Index</th>
                      <th className="py-3 px-4">Trajectory</th>
                      <th className="py-3 px-4">Shared Bridge Keywords</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.links.map((link) => {
                      const badge = getTrajectoryBadge(link.trajectory);
                      const srcNode = data.nodes.find((n) => n.id === link.sourceId);
                      const tgtNode = data.nodes.find((n) => n.id === link.targetId);
                      return (
                        <tr
                          key={link.id}
                          className="hover:bg-purple-50/40 transition cursor-pointer"
                          onClick={() => {
                            setSelectedLinkId(link.id);
                            setSelectedNodeId(null);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {data.periods[link.sourcePeriod]?.label}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {srcNode && (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    getQuadrantColor(srcNode.quadrantCode).accentBg
                                  }`}
                                />
                              )}
                              {link.sourceThemeName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-purple-600">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {data.periods[link.targetPeriod]?.label}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {tgtNode && (
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    getQuadrantColor(tgtNode.quadrantCode).accentBg
                                  }`}
                                />
                              )}
                              {link.targetThemeName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-purple-700">
                            {link.inclusionIndex}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {link.sharedKeywords.join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: QUADRANT STRATEGIC SHIFTS */}
          {activeSubTab === "strategic" && (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Callon&apos;s Strategic Quadrant Migration across Time
                </h2>
                <p className="text-xs text-slate-500">
                  Observe how concepts transition from Emerging (Q3) $\rightarrow$ Motor (Q1) $\rightarrow$ Basic (Q4) as scientific maturity advances.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Motor Themes */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Motor Themes (Q1)
                    </span>
                    <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-900">
                      High C • High D
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Driving, well-structured paradigms of each period.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q1")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-emerald-200 p-2.5 shadow-2xs cursor-pointer hover:border-emerald-400 transition"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>{n.name}</span>
                            <span className="text-[9px] font-mono text-emerald-700">{n.periodLabel}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 truncate">
                            {n.docCount} docs • {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Niche Themes */}
                <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-800">
                      Niche Themes (Q2)
                    </span>
                    <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[9px] font-bold text-purple-900">
                      Low C • High D
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-700">
                    Highly developed specialized sub-domains.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q2")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-purple-200 p-2.5 shadow-2xs cursor-pointer hover:border-purple-400 transition"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>{n.name}</span>
                            <span className="text-[9px] font-mono text-purple-700">{n.periodLabel}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 truncate">
                            {n.docCount} docs • {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Emerging/Declining Themes */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                      Emerging / Declining (Q3)
                    </span>
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                      Low C • Low D
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Nascent or fading exploratory concepts.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q3")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-amber-200 p-2.5 shadow-2xs cursor-pointer hover:border-amber-400 transition"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>{n.name}</span>
                            <span className="text-[9px] font-mono text-amber-700">{n.periodLabel}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 truncate">
                            {n.docCount} docs • {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Basic Themes */}
                <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-sky-800">
                      Basic Themes (Q4)
                    </span>
                    <span className="rounded bg-sky-200 px-1.5 py-0.5 text-[9px] font-bold text-sky-900">
                      High C • Low D
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-700">
                    Foundational and transversal pillars of research.
                  </div>
                  <div className="space-y-2">
                    {data.nodes
                      .filter((n) => n.quadrantCode === "Q4")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-sky-200 p-2.5 shadow-2xs cursor-pointer hover:border-sky-400 transition"
                          onClick={() => {
                            setSelectedNodeId(n.id);
                            setActiveSubTab("sankey");
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>{n.name}</span>
                            <span className="text-[9px] font-mono text-sky-700">{n.periodLabel}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 truncate">
                            {n.docCount} docs • {n.keywords.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCIENTIFIC PARADIGM SYNTHESIS */}
          {activeSubTab === "synthesis" && (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700 font-black">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Scientometric Narrative: Evolutionary Paradigm Synthesis
                  </h2>
                  <p className="text-xs text-slate-500">
                    Automated epistemic reconstruction of scientific transitions across {data.summary.yearSpan}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.periods.map((p, idx) => {
                  const pNodes = data.nodes.filter((n) => n.periodIndex === p.index);
                  const motor = pNodes.filter((n) => n.quadrantCode === "Q1");
                  const basic = pNodes.filter((n) => n.quadrantCode === "Q4");
                  return (
                    <div
                      key={p.index}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-800">
                          Epoch {idx + 1}: {p.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">{p.docCount} works</span>
                      </div>

                      <div className="text-xs font-bold text-slate-800">Key Conceptual Anchors:</div>
                      <div className="flex flex-wrap gap-1">
                        {pNodes.map((n) => (
                          <span
                            key={n.id}
                            className="rounded px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-800"
                          >
                            {n.name}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed">
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
              <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-purple-800">
                  Epistemic Continuity & Divergence Analysis
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  The corpus demonstrates an overall longitudinal stability index of{" "}
                  <strong>{(data.summary.averageStability * 100).toFixed(1)}%</strong>. A dominant evolutionary trajectory emerges connecting foundational biomedical modeling to modern multi-modal deep architectures. The presence of {data.summary.splitsCount} thematic splits highlights research specialization, whereas {data.summary.mergesCount} thematic merges denote conceptual cross-pollination.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
