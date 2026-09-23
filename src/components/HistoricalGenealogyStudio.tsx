import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  History,
  GitFork,
  Activity,
  Layers,
  Sparkles,
  Download,
  Filter,
  Calendar,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  Info,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import { Dataset, HistCiteOutput, HistCiteNode, RPYSOutput, RPYSSpectroscopyPoint } from "../types.js";
import { validateHistCiteResponse, validateRpysResponse } from "../utils/responseValidation.js";

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
}

export function HistoricalGenealogyStudio({ datasets, selectedDatasetId, onSelectDataset }: Props) {
  const [activeDataset, setActiveDataset] = useState<string>(selectedDatasetId || (datasets[0]?.id ?? ""));

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDataset) {
      setActiveDataset(selectedDatasetId);
    }
  }, [selectedDatasetId]);
  const [subTab, setSubTab] = useState<"histcite" | "rpys" | "mainpath">("histcite");

  // HistCite State
  const [histData, setHistData] = useState<HistCiteOutput | null>(null);
  const [histLoading, setHistLoading] = useState<boolean>(true);
  const [histError, setHistError] = useState<string | null>(null);
  const [minLcsFilter, setMinLcsFilter] = useState<number>(0);
  const [onlyMainPath, setOnlyMainPath] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<HistCiteNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // RPYS State
  const [rpysData, setRpysData] = useState<RPYSOutput | null>(null);
  const [rpysLoading, setRpysLoading] = useState<boolean>(true);
  const [rpysError, setRpysError] = useState<string | null>(null);
  const [selectedBreakoutYear, setSelectedBreakoutYear] = useState<number | null>(null);
  const [showOnlyPeaks, setShowOnlyPeaks] = useState<boolean>(false);

  // SVG Refs
  const histSvgRef = useRef<SVGSVGElement | null>(null);
  const rpysSvgRef = useRef<SVGSVGElement | null>(null);

  // Synchronize when parent prop changes
  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDataset) {
      setActiveDataset(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  // Fetch HistCite
  const fetchHistCite = async (dsId: string, minLcs: number) => {
    setHistLoading(true);
    setHistError(null);
    try {
      const res = await fetch("/api/historical/histcite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: dsId, min_lcs: minLcs, limit: 70 }),
      });
      if (!res.ok) throw new Error("Failed to compute historiography");
      const raw = await res.json();
      const outcome = validateHistCiteResponse(raw);
      if (!outcome.success) {
        throw new Error(outcome.error || "Malformed HistCite response");
      }
      const json: HistCiteOutput = outcome.data;
      setHistData(json);
      if (json.nodes && json.nodes.length > 0) {
        setSelectedNode(json.nodes.find((n) => n.isMainPath) || json.nodes[0]);
      }
    } catch (err: any) {
      console.error(err);
      setHistError(err.message || "Failed to load HistCite");
    } finally {
      setHistLoading(false);
    }
  };

  // Fetch RPYS
  const fetchRPYS = async (dsId: string) => {
    setRpysLoading(true);
    setRpysError(null);
    try {
      const res = await fetch("/api/historical/rpys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: dsId }),
      });
      if (!res.ok) throw new Error("Failed to compute RPYS spectroscopy");
      const raw = await res.json();
      const outcome = validateRpysResponse(raw);
      if (!outcome.success) {
        throw new Error(outcome.error || "Malformed RPYS response");
      }
      const json: RPYSOutput = outcome.data;
      setRpysData(json);
      if (json.milestone_breakouts && json.milestone_breakouts.length > 0) {
        setSelectedBreakoutYear(json.milestone_breakouts[0].year);
      }
    } catch (err: any) {
      console.error(err);
      setRpysError(err.message || "Failed to load RPYS");
    } finally {
      setRpysLoading(false);
    }
  };

  useEffect(() => {
    if (activeDataset) {
      fetchHistCite(activeDataset, minLcsFilter);
      fetchRPYS(activeDataset);
    }
  }, [activeDataset, minLcsFilter]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!histData) return [];
    return histData.nodes.filter((n) => {
      if (onlyMainPath && !n.isMainPath) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.firstAuthor.toLowerCase().includes(q) ||
          n.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [histData, onlyMainPath, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => {
    if (!histData) return [];
    return histData.links.filter(
      (l) => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target) && (!onlyMainPath || l.isMainPath)
    );
  }, [histData, filteredNodeIds, onlyMainPath]);

  // ================= D3 HISTCITE CHRONOLOGICAL GRAPH =================
  useEffect(() => {
    if (!histSvgRef.current || !histData || filteredNodes.length === 0) return;

    const svg = d3.select(histSvgRef.current);
    svg.selectAll("*").remove();

    const width = 960;
    const height = 620;
    const margin = { top: 40, right: 60, bottom: 50, left: 70 };

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group nodes by year
    const years: number[] = Array.from(new Set<number>(filteredNodes.map((n) => Number(n.year)))).sort((a, b) => a - b);
    if (years.length === 0) return;

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // X scale: Chronological Year Progression
    const xScale = d3
      .scaleLinear()
      .domain([minYear - 0.5, maxYear + 0.5])
      .range([0, innerWidth]);

    // Calculate vertical distribution per year
    const nodesByYear = new Map<number, HistCiteNode[]>();
    years.forEach((y: number) => nodesByYear.set(y, []));
    filteredNodes.forEach((n) => nodesByYear.get(n.year)?.push(n));

    // Sort nodes in same year by LCS descending
    nodesByYear.forEach((list) => list.sort((a, b) => b.lcs - a.lcs || b.gcs - a.gcs));

    const nodePositions = new Map<string, { x: number; y: number }>();
    nodesByYear.forEach((list, year) => {
      const x = xScale(year);
      const total = list.length;
      list.forEach((n, i) => {
        const y = total === 1 ? innerHeight / 2 : ((i + 1) / (total + 1)) * innerHeight;
        nodePositions.set(n.id, { x, y });
      });
    });

    // Draw Year Vertical Gridlines & Labels
    const yearGrid = g.append("g").attr("class", "year-grid");
    years.forEach((y: number) => {
      const x = xScale(y);
      yearGrid
        .append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-dasharray", "3,3");

      yearGrid
        .append("text")
        .attr("x", x)
        .attr("y", innerHeight + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", "#64748b")
        .text(String(y));
    });

    // Draw Arrow Marker Definitions
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow-mainpath")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#dc2626");

    defs
      .append("marker")
      .attr("id", "arrow-normal")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 16)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    // Draw Links (Directed Bezier Curves from Citing -> Cited, flowing right to left)
    const linksGroup = g.append("g").attr("class", "links");

    filteredLinks.forEach((link) => {
      const src = nodePositions.get(link.source);
      const tgt = nodePositions.get(link.target);
      if (!src || !tgt) return;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const cx1 = src.x + dx * 0.4;
      const cy1 = src.y;
      const cx2 = tgt.x - dx * 0.4;
      const cy2 = tgt.y;

      const pathData = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`;

      linksGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", link.isMainPath ? "#dc2626" : "#cbd5e1")
        .attr("stroke-width", link.isMainPath ? 2.5 : 1.2)
        .attr("stroke-opacity", link.isMainPath ? 0.9 : 0.6)
        .attr("marker-end", link.isMainPath ? "url(#arrow-mainpath)" : "url(#arrow-normal)");
    });

    // Draw Nodes
    const nodesGroup = g.append("g").attr("class", "nodes");

    filteredNodes.forEach((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const isSelected = selectedNode?.id === node.id;
      const radius = Math.max(7, Math.min(18, 7 + Math.sqrt(node.lcs) * 3));

      const nodeG = nodesGroup
        .append("g")
        .attr("transform", `translate(${pos.x},${pos.y})`)
        .attr("cursor", "pointer")
        .on("click", () => setSelectedNode(node));

      // Main path pulse ring
      if (node.isMainPath) {
        nodeG
          .append("circle")
          .attr("r", radius + 4)
          .attr("fill", "none")
          .attr("stroke", "#dc2626")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "3,2")
          .attr("opacity", 0.85);
      }

      // Selection ring
      if (isSelected) {
        nodeG
          .append("circle")
          .attr("r", radius + 6)
          .attr("fill", "none")
          .attr("stroke", "#2563eb")
          .attr("stroke-width", 2.5);
      }

      // Main Node Circle
      let fillColor = "#64748b";
      if (node.isMainPath) fillColor = "#dc2626";
      else if (node.isRootAncestor) fillColor = "#059669";
      else if (node.isTerminalNode) fillColor = "#7c3aed";
      else if (node.lcs > 2) fillColor = "#2563eb";

      nodeG
        .append("circle")
        .attr("r", radius)
        .attr("fill", fillColor)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("class", "transition-all duration-150 hover:scale-110");

      // Label inside circle (nodeIndex)
      nodeG
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", radius > 11 ? "10px" : "8px")
        .attr("font-weight", "bold")
        .attr("fill", "#ffffff")
        .text(node.nodeIndex);

      // Author & Year Text Label
      nodeG
        .append("text")
        .attr("x", 0)
        .attr("y", -radius - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", node.isMainPath ? "700" : "500")
        .attr("fill", node.isMainPath ? "#991b1b" : "#334155")
        .text(`${node.firstAuthor} '${String(node.year).slice(-2)}`);
    });
  }, [histData, filteredNodes, filteredLinks, selectedNode]);

  // ================= D3 RPYS SPECTROSCOPY CHART =================
  useEffect(() => {
    if (!rpysSvgRef.current || !rpysData || rpysData.spectroscopy_points.length === 0) return;

    const svg = d3.select(rpysSvgRef.current);
    svg.selectAll("*").remove();

    const width = 960;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const points: RPYSSpectroscopyPoint[] = rpysData.spectroscopy_points;
    if (points.length === 0) return;
    const xDomain: [number, number] = [
      Math.min(...points.map((p) => p.year)),
      Math.max(...points.map((p) => p.year)),
    ];
    const yMaxNCR = Math.max(...points.map((p) => p.citedReferencesCount), 50);
    const yMinDev = Math.min(-10, ...points.map((p) => p.deviation));
    const yMaxDev = Math.max(20, ...points.map((p) => p.deviation));

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
    const yScaleNCR = d3.scaleLinear().domain([0, yMaxNCR * 1.1]).range([innerHeight, 0]);
    const yScaleDev = d3.scaleLinear().domain([yMinDev, yMaxDev * 1.15]).range([innerHeight, 0]);

    // X Axis
    const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d}`).ticks(12);
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr("color", "#94a3b8")
      .selectAll("text")
      .attr("font-size", "11px");

    // Y Axis (Deviation from median)
    const yAxisDev = d3.axisLeft(yScaleDev).ticks(6);
    g.append("g")
      .call(yAxisDev)
      .attr("color", "#94a3b8")
      .selectAll("text")
      .attr("font-size", "11px");

    // Zero Line for Deviation
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScaleDev(0))
      .attr("y2", yScaleDev(0))
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4");

    // Area generator for positive deviation peaks
    const areaDev = d3
      .area<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y0(yScaleDev(0))
      .y1((d) => yScaleDev(Math.max(0, d.deviation)))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "rgba(239, 68, 68, 0.15)")
      .attr("d", areaDev);

    // Deviation Line (Red)
    const lineDev = d3
      .line<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y((d) => yScaleDev(d.deviation))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#dc2626")
      .attr("stroke-width", 2.2)
      .attr("d", lineDev);

    // NCR Reference count line (Slate dashed)
    const lineNCR = d3
      .line<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y((d) => yScaleNCR(d.citedReferencesCount))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.6)
      .attr("d", lineNCR);

    // Interactive Peak Points
    points.forEach((pt) => {
      const isSelected = selectedBreakoutYear === pt.year;
      const isPeak = pt.isPeak;

      if (!isPeak && !isSelected) return;

      const circleG = g
        .append("g")
        .attr("transform", `translate(${xScale(pt.year)},${yScaleDev(pt.deviation)})`)
        .attr("cursor", "pointer")
        .on("click", () => setSelectedBreakoutYear(pt.year));

      let peakColor = "#dc2626";
      if (pt.peakSignificance === "extreme") peakColor = "#b91c1c";
      else if (pt.peakSignificance === "strong") peakColor = "#ea580c";

      circleG
        .append("circle")
        .attr("r", isSelected ? 8 : pt.peakSignificance === "extreme" ? 6 : 4.5)
        .attr("fill", peakColor)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);

      if (isPeak && pt.deviation > 12) {
        circleG
          .append("text")
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .attr("fill", peakColor)
          .text(pt.year);
      }
    });
  }, [rpysData, selectedBreakoutYear]);

  // Active Breakout Data
  const currentBreakout = useMemo(() => {
    if (!rpysData || !selectedBreakoutYear) return null;
    return (
      rpysData.milestone_breakouts.find((b) => b.year === selectedBreakoutYear) ||
      rpysData.spectroscopy_points.find((p) => p.year === selectedBreakoutYear)
    );
  }, [rpysData, selectedBreakoutYear]);

  return (
    <div id="historical-genealogy-studio" className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <History className="h-3.5 w-3.5" />
                Historical Epistemology & Origins
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                HistCite™ & RPYS
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Historical Citation Genealogy & Spectroscopy
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-3xl">
              Algorithmic historiography tracking direct citation paths (Garfield / HistCite) and reference publication year spectroscopy (Marx & Bornmann) to uncover foundational intellectual roots.
            </p>
          </div>

          {/* Dataset Selector */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-500">Target Dataset</label>
              <select
                id="historical-dataset-select"
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                value={activeDataset}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveDataset(val);
                  if (onSelectDataset && val) {
                    onSelectDataset(val);
                  }
                }}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.id} ({d.record_count} docs)
                  </option>
                ))}
              </select>
            </div>
            <button
              id="refresh-historical-btn"
              onClick={() => {
                if (activeDataset) {
                  fetchHistCite(activeDataset, minLcsFilter);
                  fetchRPYS(activeDataset);
                }
              }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recalculate
            </button>
          </div>
        </div>

        {/* Subtab navigation */}
        <div className="mt-6 flex items-center gap-2 border-b border-slate-100 pb-2">
          <button
            id="tab-histcite"
            onClick={() => setSubTab("histcite")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "histcite"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <GitFork className="h-4 w-4" />
            Algorithmic Historiography (HistCite)
          </button>
          <button
            id="tab-rpys"
            onClick={() => setSubTab("rpys")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "rpys"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Activity className="h-4 w-4" />
            RPYS Citation Spectroscopy (Foundations)
          </button>
          <button
            id="tab-mainpath"
            onClick={() => setSubTab("mainpath")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "mainpath"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Zap className="h-4 w-4" />
            Main Path Analysis (Search Path Link Count)
          </button>
        </div>
      </div>

      {/* ================= TAB 1: HISTCITE GENEALOGY ================= */}
      {subTab === "histcite" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search Filter */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="histcite-search-input"
                  type="text"
                  placeholder="Filter by author, title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Min LCS Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Min LCS:</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={minLcsFilter}
                  onChange={(e) => setMinLcsFilter(Number(e.target.value))}
                  className="h-1.5 w-24 accent-amber-600"
                />
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">
                  {minLcsFilter}
                </span>
              </div>

              {/* Main Path Toggle */}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMainPath}
                  onChange={(e) => setOnlyMainPath(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Highlight Main Epistemic Path Only</span>
              </label>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{filteredNodes.length}</span> nodes visible /{" "}
              <span className="font-semibold text-slate-900">{filteredLinks.length}</span> internal citations
            </div>
          </div>

          {/* Visualization & Side Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* D3 Graph Canvas */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Direct Citation Historiograph</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Chronological Left → Right
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span> Root Ancestor
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600"></span> Main Path
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span> High LCS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span> Terminal Frontier
                  </span>
                </div>
              </div>

              {histLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                    <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                    Calculating genealogy network and local citation scores...
                  </div>
                </div>
              ) : histError ? (
                <div className="flex h-96 items-center justify-center text-red-600 text-xs">
                  <AlertCircle className="mr-2 h-4 w-4" /> {histError}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <svg ref={histSvgRef} className="w-full h-auto select-none" />
                </div>
              )}
            </div>

            {/* Document Details & LCS Inspector */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {selectedNode.nodeIndex}
                      </span>
                      <span className="text-xs font-bold text-slate-700">Document Inspector</span>
                    </div>
                    {selectedNode.isMainPath && (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        ★ Main Path Anchor
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold leading-snug text-slate-900">
                      {selectedNode.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      {selectedNode.firstAuthor} et al. • <span className="text-slate-700 font-bold">{selectedNode.year}</span>
                    </p>
                    <p className="mt-0.5 text-xs italic text-slate-400">
                      {selectedNode.source}
                    </p>
                  </div>

                  {/* Scientometric LCS & GCS KPIs */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">LCS (Local)</div>
                      <div className="text-lg font-black text-amber-600">{selectedNode.lcs}</div>
                      <div className="text-[9px] text-slate-400">in-corpus cites</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">GCS (Global)</div>
                      <div className="text-lg font-black text-slate-800">{selectedNode.gcs}</div>
                      <div className="text-[9px] text-slate-400">total cites</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">LCS/GCS</div>
                      <div className="text-lg font-black text-indigo-600">
                        {selectedNode.gcs > 0 ? `${Math.round((selectedNode.lcs / selectedNode.gcs) * 100)}%` : "0%"}
                      </div>
                      <div className="text-[9px] text-slate-400">internal impact</div>
                    </div>
                  </div>

                  {selectedNode.abstractSnippet && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">Abstract Summary</div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {selectedNode.abstractSnippet}
                      </p>
                    </div>
                  )}

                  {/* Direct Epistemic Linkages */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-slate-700">
                      Direct In-Corpus References ({selectedNode.citedNodes.length}):
                    </div>
                    {selectedNode.citedNodes.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No previous internal papers cited (Epistemic Root).</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.citedNodes.map((id) => {
                          const target = histData?.nodes.find((n) => n.id === id);
                          return (
                            <button
                              key={id}
                              onClick={() => target && setSelectedNode(target)}
                              className="rounded bg-slate-100 hover:bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                            >
                              ← #{target?.nodeIndex} {target?.firstAuthor} ({target?.year})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Select a node on the historiograph to inspect its citation links.
                </div>
              )}

              {/* HistCite Export Action */}
              <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Historiography Matrix Ready</span>
                <button
                  id="export-histcite-json-btn"
                  onClick={() => {
                    if (!histData) return;
                    const blob = new Blob([JSON.stringify(histData, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `HistCite_${histData.dataset_id}.json`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Download className="h-3 w-3" /> Export JSON
                </button>
              </div>
            </div>
          </div>

          {/* Top LCS Ranking Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              Highest Local Citation Score (LCS) Literature - Core Intellectual Foundation
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Papers with high LCS represent internal keystones that drive subsequent work in this specific community, irrespective of broad generic citations.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Node #</th>
                    <th className="py-2.5 px-3">Author & Year</th>
                    <th className="py-2.5 px-3">Document Title</th>
                    <th className="py-2.5 px-3 text-center">LCS (Local)</th>
                    <th className="py-2.5 px-3 text-center">GCS (Global)</th>
                    <th className="py-2.5 px-3 text-center">LCS Ratio</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {histData?.top_lcs_papers.map((p, idx) => {
                    const node = histData.nodes.find((n) => n.id === p.id);
                    return (
                      <tr key={p.id} className="hover:bg-amber-50/50">
                        <td className="py-2 px-3 font-bold text-slate-900">#{node?.nodeIndex || idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{p.authorYear}</td>
                        <td className="py-2 px-3 max-w-md truncate font-medium text-slate-700">{p.title}</td>
                        <td className="py-2 px-3 text-center font-bold text-amber-700">{p.lcs}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{p.gcs}</td>
                        <td className="py-2 px-3 text-center font-semibold text-indigo-600">{p.lcsRatio}%</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => node && setSelectedNode(node)}
                            className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700"
                          >
                            Locate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: RPYS CITATION SPECTROSCOPY ================= */}
      {subTab === "rpys" && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Reference Publication Year Spectroscopy (RPYS)
                </h3>
                <p className="text-xs text-slate-500">
                  Marx & Bornmann spectroscopic curve mapping historical cited references across time (1950 - present) to locate paradigm shifts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-600"></span>
                <span className="font-semibold text-slate-700">Deviation (Δ Median)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400"></span>
                <span className="text-slate-500">Total NCR Volume</span>
              </div>
            </div>
          </div>

          {/* D3 RPYS Chart Canvas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-600">
                Spectroscopic Peaks indicate historical breakthrough years where foundational papers were published.
              </div>
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {rpysData?.milestone_breakouts.length || 0} Historical Breakout Peaks Detected
              </span>
            </div>

            {rpysLoading ? (
              <div className="flex h-80 items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
              </div>
            ) : rpysError ? (
              <div className="flex h-80 items-center justify-center text-red-600 text-xs">{rpysError}</div>
            ) : (
              <svg ref={rpysSvgRef} className="w-full h-auto select-none" />
            )}
          </div>

          {/* Milestone Breakouts Details */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Historical Breakout Years (Ranked by Spectroscopic Peak)
              </h4>
              <div className="mt-4 space-y-2">
                {rpysData?.milestone_breakouts.map((m) => {
                  const isSelected = selectedBreakoutYear === m.year;
                  return (
                    <div
                      key={m.year}
                      onClick={() => setSelectedBreakoutYear(m.year)}
                      className={`cursor-pointer rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "border-red-500 bg-red-50/50 shadow-xs"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900">{m.year}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            m.significance === "extreme" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                          }`}>
                            +{m.deviation} Peak Deviation
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{m.ncr} Cited Refs</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-1">{m.historicalContext}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Breakthrough Works in Selected Year */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Landmark Publications in Year {selectedBreakoutYear || "—"}
                </h4>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {currentBreakout?.landmarkCitations?.length || currentBreakout?.breakoutWorks?.length || 0} Landmark Papers
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {(currentBreakout?.landmarkCitations || currentBreakout?.breakoutWorks || []).map((work: any, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-900">{work.authorYear}</div>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {work.historicalRole}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-800">{work.title}</div>
                    <div className="mt-1 text-[11px] italic text-slate-500">{work.source} • {work.citations} historical citations</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MAIN PATH ANALYSIS ================= */}
      {subTab === "mainpath" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Main Path Analysis (Hummon & Doreian SPC)</h3>
                <p className="text-xs text-slate-500">
                  Main Path analysis identifies the critical structural backbone of scientific communication, filtering out peripheral citations to reveal the undeniable chain of ideas that gave rise to the current frontier.
                </p>
              </div>
            </div>

            {/* Main Path Flow Timeline */}
            <div className="mt-6 space-y-4">
              <div className="relative pl-6 border-l-2 border-red-500 space-y-6">
                {histData?.nodes
                  .filter((n) => n.isMainPath)
                  .sort((a, b) => a.year - b.year)
                  .map((n, idx) => (
                    <div key={n.id} className="relative group">
                      {/* Step Circle */}
                      <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold shadow-xs">
                        {idx + 1}
                      </span>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:bg-white hover:shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-black text-white">
                              {n.year}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{n.firstAuthor} et al.</span>
                            <span className="text-xs text-slate-400">• {n.source}</span>
                          </div>
                          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            LCS: {n.lcs} / GCS: {n.gcs}
                          </span>
                        </div>

                        <div className="mt-1.5 text-sm font-bold text-slate-900">{n.title}</div>
                        {n.abstractSnippet && (
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.abstractSnippet}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
