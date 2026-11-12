import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  History,
  GitFork,
  Activity,
  Download,
  Calendar,
  Search,
  Award,
  BookOpen,
  RefreshCw,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  Dataset,
  HistCiteOutput,
  HistCiteNode,
  RPYSOutput,
  RPYSSpectroscopyPoint,
} from "../types.js";
import {
  validateHistCiteResponse,
  validateRpysResponse,
} from "../utils/responseValidation.js";
import { Button, Card } from "./CommonUI.js";

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
}

export function HistoricalGenealogyStudio({
  datasets,
  selectedDatasetId,
  onSelectDataset,
}: Props) {
  const [activeDataset, setActiveDataset] = useState<string>(
    selectedDatasetId || (datasets[0]?.id ?? "")
  );

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDataset) {
      setActiveDataset(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  const [subTab, setSubTab] = useState<"histcite" | "rpys" | "mainpath">(
    "histcite"
  );

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
  const [selectedBreakoutYear, setSelectedBreakoutYear] = useState<
    number | null
  >(null);

  // SVG Refs
  const histSvgRef = useRef<SVGSVGElement | null>(null);
  const rpysSvgRef = useRef<SVGSVGElement | null>(null);

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

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredLinks = useMemo(() => {
    if (!histData) return [];
    return histData.links.filter(
      (l) =>
        filteredNodeIds.has(l.source) &&
        filteredNodeIds.has(l.target) &&
        (!onlyMainPath || l.isMainPath)
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

    const years: number[] = Array.from(
      new Set<number>(filteredNodes.map((n) => Number(n.year)))
    ).sort((a, b) => a - b);
    if (years.length === 0) return;

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    const xScale = d3
      .scaleLinear()
      .domain([minYear - 0.5, maxYear + 0.5])
      .range([0, innerWidth]);

    const nodesByYear = new Map<number, HistCiteNode[]>();
    years.forEach((y: number) => nodesByYear.set(y, []));
    filteredNodes.forEach((n) => nodesByYear.get(n.year)?.push(n));

    nodesByYear.forEach((list) =>
      list.sort((a, b) => b.lcs - a.lcs || b.gcs - a.gcs)
    );

    const nodePositions = new Map<string, { x: number; y: number }>();
    nodesByYear.forEach((list, year) => {
      const x = xScale(year);
      const total = list.length;
      list.forEach((n, i) => {
        const y =
          total === 1
            ? innerHeight / 2
            : ((i + 1) / (total + 1)) * innerHeight;
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
        .attr("stroke", "#d8ddd8")
        .attr("stroke-dasharray", "3,3");

      yearGrid
        .append("text")
        .attr("x", x)
        .attr("y", innerHeight + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", "#5a6570")
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
      .attr("fill", "#E11D48");

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
      .attr("fill", "#828d98");

    // Draw Links
    const linksGroup = g.append("g").attr("class", "links");

    filteredLinks.forEach((link) => {
      const src = nodePositions.get(link.source);
      const tgt = nodePositions.get(link.target);
      if (!src || !tgt) return;

      const dx = tgt.x - src.x;
      const cx1 = src.x + dx * 0.4;
      const cy1 = src.y;
      const cx2 = tgt.x - dx * 0.4;
      const cy2 = tgt.y;

      const pathData = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`;

      linksGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", link.isMainPath ? "#E11D48" : "#bcc4bc")
        .attr("stroke-width", link.isMainPath ? 2.5 : 1.2)
        .attr("stroke-opacity", link.isMainPath ? 0.9 : 0.65)
        .attr(
          "marker-end",
          link.isMainPath ? "url(#arrow-mainpath)" : "url(#arrow-normal)"
        );
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

      if (node.isMainPath) {
        nodeG
          .append("circle")
          .attr("r", radius + 4)
          .attr("fill", "none")
          .attr("stroke", "#E11D48")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "3,2")
          .attr("opacity", 0.85);
      }

      if (isSelected) {
        nodeG
          .append("circle")
          .attr("r", radius + 6)
          .attr("fill", "none")
          .attr("stroke", "#315C7C")
          .attr("stroke-width", 2.5);
      }

      let fillColor = "#64748B";
      if (node.isMainPath) fillColor = "#E11D48";
      else if (node.isRootAncestor) fillColor = "#0D9488";
      else if (node.isTerminalNode) fillColor = "#6366F1";
      else if (node.lcs > 2) fillColor = "#315C7C";

      nodeG
        .append("circle")
        .attr("r", radius)
        .attr("fill", fillColor)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("class", "transition-all duration-150 hover:scale-110");

      nodeG
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", radius > 11 ? "10px" : "8px")
        .attr("font-weight", "bold")
        .attr("fill", "#ffffff")
        .text(node.nodeIndex);

      nodeG
        .append("text")
        .attr("x", 0)
        .attr("y", -radius - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", node.isMainPath ? "700" : "500")
        .attr("fill", node.isMainPath ? "#be123c" : "#27313c")
        .text(`${node.firstAuthor} '${String(node.year).slice(-2)}`);
    });
  }, [histData, filteredNodes, filteredLinks, selectedNode]);

  // ================= D3 RPYS SPECTROSCOPY CHART =================
  useEffect(() => {
    if (
      !rpysSvgRef.current ||
      !rpysData ||
      rpysData.spectroscopy_points.length === 0
    )
      return;

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
    const yScaleNCR = d3
      .scaleLinear()
      .domain([0, yMaxNCR * 1.1])
      .range([innerHeight, 0]);
    const yScaleDev = d3
      .scaleLinear()
      .domain([yMinDev, yMaxDev * 1.15])
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d}`).ticks(12);
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr("color", "#828d98")
      .selectAll("text")
      .attr("font-size", "11px");

    const yAxisDev = d3.axisLeft(yScaleDev).ticks(6);
    g.append("g")
      .call(yAxisDev)
      .attr("color", "#828d98")
      .selectAll("text")
      .attr("font-size", "11px");

    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScaleDev(0))
      .attr("y2", yScaleDev(0))
      .attr("stroke", "#bcc4bc")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4");

    const areaDev = d3
      .area<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y0(yScaleDev(0))
      .y1((d) => yScaleDev(Math.max(0, d.deviation)))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "rgba(225, 29, 72, 0.14)")
      .attr("d", areaDev);

    const lineDev = d3
      .line<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y((d) => yScaleDev(d.deviation))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#E11D48")
      .attr("stroke-width", 2.2)
      .attr("d", lineDev);

    const lineNCR = d3
      .line<RPYSSpectroscopyPoint>()
      .x((d) => xScale(d.year))
      .y((d) => yScaleNCR(d.citedReferencesCount))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#315C7C")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.65)
      .attr("d", lineNCR);

    points.forEach((pt) => {
      const isSelected = selectedBreakoutYear === pt.year;
      const isPeak = pt.isPeak;

      if (!isPeak && !isSelected) return;

      const circleG = g
        .append("g")
        .attr(
          "transform",
          `translate(${xScale(pt.year)},${yScaleDev(pt.deviation)})`
        )
        .attr("cursor", "pointer")
        .on("click", () => setSelectedBreakoutYear(pt.year));

      let peakColor = "#E11D48";
      if (pt.peakSignificance === "extreme") peakColor = "#be123c";
      else if (pt.peakSignificance === "strong") peakColor = "#D97706";

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

  const currentBreakout = useMemo(() => {
    if (!rpysData || !selectedBreakoutYear) return null;
    return (
      rpysData.milestone_breakouts.find(
        (b) => b.year === selectedBreakoutYear
      ) ||
      rpysData.spectroscopy_points.find((p) => p.year === selectedBreakoutYear)
    );
  }, [rpysData, selectedBreakoutYear]);

  return (
    <div id="historical-genealogy-studio" className="space-y-6">
      {/* Header Banner */}
      <Card padding="lg">
        <div className="flex flex-col gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-status-warning-border bg-status-warning-bg px-2.5 py-1 text-xs font-semibold text-status-warning-text">
                <History className="h-3.5 w-3.5 shrink-0" />
                Historical Epistemology &amp; Origins
              </span>
              <span className="whitespace-nowrap rounded-md border border-border-default bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary">
                HistCite™ &amp; RPYS
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-primary">
              Historical Citation Genealogy &amp; Spectroscopy
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-muted">
              Algorithmic historiography tracking direct citation paths
              (Garfield / HistCite) and reference publication year spectroscopy
              (Marx &amp; Bornmann) to uncover foundational intellectual roots.
            </p>
          </div>

          {/* Dataset Selector */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-col">
              <label
                htmlFor="historical-dataset-select"
                className="text-xs font-medium text-ink-muted"
              >
                Target Dataset
              </label>
              <select
                id="historical-dataset-select"
                className="mt-1 block w-full min-w-0 max-w-full truncate rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-sm font-medium text-ink-primary shadow-card focus:border-brand-500 focus:outline-none sm:w-80"
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
            <Button
              type="button"
              id="refresh-historical-btn"
              variant="secondary"
              size="md"
              onClick={() => {
                if (activeDataset) {
                  fetchHistCite(activeDataset, minLcsFilter);
                  fetchRPYS(activeDataset);
                }
              }}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Recalculate
            </Button>
          </div>
        </div>

        {/* Subtab navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-border-subtle pb-2">
          <button
            type="button"
            id="tab-histcite"
            onClick={() => setSubTab("histcite")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "histcite"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <GitFork className="h-4 w-4" />
            Algorithmic Historiography (HistCite)
          </button>
          <button
            type="button"
            id="tab-rpys"
            onClick={() => setSubTab("rpys")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "rpys"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <Activity className="h-4 w-4" />
            RPYS Citation Spectroscopy (Foundations)
          </button>
          <button
            type="button"
            id="tab-mainpath"
            onClick={() => setSubTab("mainpath")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === "mainpath"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            }`}
          >
            <Zap className="h-4 w-4" />
            Main Path Analysis (Search Path Link Count)
          </button>
        </div>
      </Card>

      {/* ================= TAB 1: HISTCITE GENEALOGY ================= */}
      {subTab === "histcite" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <Card
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" />
                <input
                  id="histcite-search-input"
                  type="text"
                  placeholder="Filter by author, title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle py-1.5 pl-9 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-secondary">
                  Min LCS:
                </span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={minLcsFilter}
                  onChange={(e) => setMinLcsFilter(Number(e.target.value))}
                  className="h-1.5 w-24 accent-brand-500"
                />
                <span className="tabular-metrics rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-mono text-xs font-bold text-ink-primary">
                  {minLcsFilter}
                </span>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary">
                <input
                  type="checkbox"
                  checked={onlyMainPath}
                  onChange={(e) => setOnlyMainPath(e.target.checked)}
                  className="rounded border-border-default accent-brand-500"
                />
                <span>Highlight Main Epistemic Path Only</span>
              </label>
            </div>

            <div className="tabular-metrics flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="font-semibold text-ink-primary">
                {filteredNodes.length}
              </span>{" "}
              nodes visible /{" "}
              <span className="font-semibold text-ink-primary">
                {filteredLinks.length}
              </span>{" "}
              internal citations
            </div>
          </Card>

          {/* Visualization & Side Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* D3 Graph Canvas */}
            <Card padding="md" className="lg:col-span-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink-primary">
                    Direct Citation Historiograph
                  </h3>
                  <span className="rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">
                    Chronological Left → Right
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488]" />{" "}
                    Root Ancestor
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E11D48]" />{" "}
                    Main Path
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />{" "}
                    High LCS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#6366F1]" />{" "}
                    Terminal Frontier
                  </span>
                </div>
              </div>

              {histLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-xs text-ink-muted">
                    <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
                    Calculating genealogy network and local citation scores...
                  </div>
                </div>
              ) : histError ? (
                <div className="flex h-96 items-center justify-center text-xs text-status-danger-text">
                  <AlertCircle className="mr-2 h-4 w-4" /> {histError}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <svg ref={histSvgRef} className="h-auto w-full select-none" />
                </div>
              )}
            </Card>

            {/* Document Details & LCS Inspector */}
            <Card
              padding="md"
              className="flex flex-col justify-between lg:col-span-4"
            >
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular-metrics flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                        {selectedNode.nodeIndex}
                      </span>
                      <span className="text-xs font-bold text-ink-secondary">
                        Document Inspector
                      </span>
                    </div>
                    {selectedNode.isMainPath && (
                      <span className="rounded border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger-text">
                        ★ Main Path Anchor
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold leading-snug text-ink-primary">
                      {selectedNode.title}
                    </h4>
                    <p className="mt-1 text-xs font-medium text-ink-muted">
                      {selectedNode.firstAuthor} et al. •{" "}
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {selectedNode.year}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs italic text-ink-subtle">
                      {selectedNode.source}
                    </p>
                  </div>

                  {/* Scientometric LCS & GCS KPIs */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3 text-center">
                    <div>
                      <div className="sciai-kicker text-[10px]!">
                        LCS (Local)
                      </div>
                      <div className="tabular-metrics text-lg font-black text-status-warning-text">
                        {selectedNode.lcs}
                      </div>
                      <div className="text-[9px] text-ink-subtle">
                        in-corpus cites
                      </div>
                    </div>
                    <div>
                      <div className="sciai-kicker text-[10px]!">
                        GCS (Global)
                      </div>
                      <div className="tabular-metrics text-lg font-black text-ink-primary">
                        {selectedNode.gcs}
                      </div>
                      <div className="text-[9px] text-ink-subtle">
                        total cites
                      </div>
                    </div>
                    <div>
                      <div className="sciai-kicker text-[10px]!">LCS/GCS</div>
                      <div className="tabular-metrics text-lg font-black text-brand-600">
                        {selectedNode.gcs > 0
                          ? `${Math.round((selectedNode.lcs / selectedNode.gcs) * 100)}%`
                          : "0%"}
                      </div>
                      <div className="text-[9px] text-ink-subtle">
                        internal impact
                      </div>
                    </div>
                  </div>

                  {selectedNode.abstractSnippet && (
                    <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                      <div className="sciai-kicker text-[10px]!">
                        Abstract Summary
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                        {selectedNode.abstractSnippet}
                      </p>
                    </div>
                  )}

                  {/* Direct Epistemic Linkages */}
                  <div className="space-y-2 pt-2">
                    <div className="tabular-metrics text-xs font-semibold text-ink-secondary">
                      Direct In-Corpus References (
                      {selectedNode.citedNodes.length}):
                    </div>
                    {selectedNode.citedNodes.length === 0 ? (
                      <p className="text-[11px] italic text-ink-subtle">
                        No previous internal papers cited (Epistemic Root).
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.citedNodes.map((id) => {
                          const target = histData?.nodes.find(
                            (n) => n.id === id
                          );
                          return (
                            <button
                              type="button"
                              key={id}
                              onClick={() => target && setSelectedNode(target)}
                              className="cursor-pointer rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-secondary transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                            >
                              ← #{target?.nodeIndex} {target?.firstAuthor} (
                              {target?.year})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
                  Select a node on the historiograph to inspect its citation
                  links.
                </div>
              )}

              {/* HistCite Export Action */}
              <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                <span className="text-[11px] text-ink-muted">
                  Historiography Matrix Ready
                </span>
                <Button
                  type="button"
                  id="export-histcite-json-btn"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!histData) return;
                    const blob = new Blob([JSON.stringify(histData, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `HistCite_${histData.dataset_id}.json`;
                    a.click();
                  }}
                  icon={<Download className="h-3 w-3" />}
                >
                  Export JSON
                </Button>
              </div>
            </Card>
          </div>

          {/* Top LCS Ranking Table */}
          <Card padding="lg">
            <h3 className="flex items-center gap-2 text-base font-bold text-ink-primary">
              <Award className="h-4 w-4 text-status-warning-text" />
              Highest Local Citation Score (LCS) Literature - Core Intellectual
              Foundation
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Papers with high LCS represent internal keystones that drive
              subsequent work in this specific community, irrespective of broad
              generic citations.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-secondary">
                <thead className="border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-3 py-2.5">Node #</th>
                    <th className="px-3 py-2.5">Author &amp; Year</th>
                    <th className="px-3 py-2.5">Document Title</th>
                    <th className="px-3 py-2.5 text-center">LCS (Local)</th>
                    <th className="px-3 py-2.5 text-center">GCS (Global)</th>
                    <th className="px-3 py-2.5 text-center">LCS Ratio</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {histData?.top_lcs_papers.map((p, idx) => {
                    const node = histData.nodes.find((n) => n.id === p.id);
                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-surface-subtle/70"
                      >
                        <td className="tabular-metrics px-3 py-2 font-mono font-bold text-ink-primary">
                          #{node?.nodeIndex || idx + 1}
                        </td>
                        <td className="px-3 py-2 font-semibold text-ink-primary">
                          {p.authorYear}
                        </td>
                        <td className="max-w-md truncate px-3 py-2 font-medium text-ink-secondary">
                          {p.title}
                        </td>
                        <td className="tabular-metrics px-3 py-2 text-center font-bold text-status-warning-text">
                          {p.lcs}
                        </td>
                        <td className="tabular-metrics px-3 py-2 text-center text-ink-muted">
                          {p.gcs}
                        </td>
                        <td className="tabular-metrics px-3 py-2 text-center font-semibold text-brand-600">
                          {p.lcsRatio}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => node && setSelectedNode(node)}
                            className="cursor-pointer rounded-md border border-border-default bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink-primary"
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
          </Card>
        </div>
      )}

      {/* ================= TAB 2: RPYS CITATION SPECTROSCOPY ================= */}
      {subTab === "rpys" && (
        <div className="space-y-6">
          {/* Header Info */}
          <Card
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                  Reference Publication Year Spectroscopy (RPYS)
                </h3>
                <p className="text-xs text-ink-muted">
                  Marx &amp; Bornmann spectroscopic curve mapping historical
                  cited references across time (1950 - present) to locate
                  paradigm shifts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-status-danger-text" />
                <span className="font-semibold text-ink-secondary">
                  Deviation (Δ Median)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-brand-500" />
                <span className="text-ink-muted">Total NCR Volume</span>
              </div>
            </div>
          </Card>

          {/* D3 RPYS Chart Canvas */}
          <Card padding="md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-ink-muted">
                Spectroscopic Peaks indicate historical breakthrough years
                where foundational papers were published.
              </div>
              <span className="tabular-metrics rounded border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">
                {rpysData?.milestone_breakouts.length || 0} Historical Breakout
                Peaks Detected
              </span>
            </div>

            {rpysLoading ? (
              <div className="flex h-80 items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
              </div>
            ) : rpysError ? (
              <div className="flex h-80 items-center justify-center text-xs text-status-danger-text">
                {rpysError}
              </div>
            ) : (
              <svg ref={rpysSvgRef} className="h-auto w-full select-none" />
            )}
          </Card>

          {/* Milestone Breakouts Details */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card padding="md" className="lg:col-span-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                <Calendar className="h-4 w-4 text-status-warning-text" />
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
                          ? "border-brand-500 bg-brand-50/60 shadow-card"
                          : "border-border-default bg-surface-subtle hover:bg-surface-muted/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="tabular-metrics text-base font-black text-ink-primary">
                            {m.year}
                          </span>
                          <span
                            className={`tabular-metrics rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                              m.significance === "extreme"
                                ? "border-status-danger-border bg-status-danger-bg text-status-danger-text"
                                : "border-status-warning-border bg-status-warning-bg text-status-warning-text"
                            }`}
                          >
                            +{m.deviation} Peak Deviation
                          </span>
                        </div>
                        <span className="tabular-metrics text-[11px] font-medium text-ink-muted">
                          {m.ncr} Cited Refs
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-ink-secondary">
                        {m.historicalContext}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Breakthrough Works in Selected Year */}
            <Card padding="md" className="lg:col-span-7">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                  <BookOpen className="h-4 w-4 text-brand-500" />
                  Landmark Publications in Year {selectedBreakoutYear || "—"}
                </h4>
                <span className="tabular-metrics rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                  {currentBreakout?.landmarkCitations?.length ||
                    currentBreakout?.breakoutWorks?.length ||
                    0}{" "}
                  Landmark Papers
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {(
                  currentBreakout?.landmarkCitations ||
                  currentBreakout?.breakoutWorks ||
                  []
                ).map((work: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border-default bg-surface-subtle p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-ink-primary">
                        {work.authorYear}
                      </div>
                      <span className="rounded-full border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">
                        {work.historicalRole}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-ink-primary">
                      {work.title}
                    </div>
                    <div className="tabular-metrics mt-1 text-[11px] italic text-ink-muted">
                      {work.source} • {work.citations} historical citations
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MAIN PATH ANALYSIS ================= */}
      {subTab === "mainpath" && (
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-status-danger-border bg-status-danger-bg text-status-danger-text">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  Main Path Analysis (Hummon &amp; Doreian SPC)
                </h3>
                <p className="text-xs text-ink-muted">
                  Main Path analysis identifies the critical structural backbone
                  of scientific communication, filtering out peripheral
                  citations to reveal the undeniable chain of ideas that gave
                  rise to the current frontier.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="relative space-y-6 border-l-2 border-brand-500 pl-6">
                {histData?.nodes
                  .filter((n) => n.isMainPath)
                  .sort((a, b) => a.year - b.year)
                  .map((n, idx) => (
                    <div key={n.id} className="group relative">
                      <span className="tabular-metrics absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white shadow-xs">
                        {idx + 1}
                      </span>

                      <div className="rounded-xl border border-border-default bg-surface-subtle p-4 transition-all hover:bg-surface-canvas hover:shadow-card">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="tabular-metrics rounded bg-ink-primary px-2 py-0.5 text-xs font-black text-white">
                              {n.year}
                            </span>
                            <span className="text-xs font-bold text-ink-primary">
                              {n.firstAuthor} et al.
                            </span>
                            <span className="text-xs text-ink-muted">
                              • {n.source}
                            </span>
                          </div>
                          <span className="tabular-metrics rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            LCS: {n.lcs} / GCS: {n.gcs}
                          </span>
                        </div>

                        <div className="mt-1.5 text-sm font-bold text-ink-primary">
                          {n.title}
                        </div>
                        {n.abstractSnippet && (
                          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                            {n.abstractSnippet}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}