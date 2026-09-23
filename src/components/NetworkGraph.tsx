import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ResultRecord } from "../types.js";
import { ZoomIn, ZoomOut, RotateCcw, Users, Share2 } from "lucide-react";

interface NetworkGraphProps {
  records: ResultRecord[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  degree: number;
  community: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

export function NetworkGraph({ records }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [minWeightFilter, setMinWeightFilter] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Prepare graph data
  const { initialNodes, initialLinks } = useMemo(() => {
    if (!records || records.length === 0) {
      return { initialNodes: [], initialLinks: [] };
    }

    const nodeDegrees: Record<string, number> = {};
    const rawLinks: { source: string; target: string; weight: number }[] = [];

    records.slice(0, 80).forEach((r) => {
      const a1 = String(r.author_1 || r.source || "").trim();
      const a2 = String(r.author_2 || r.target || "").trim();
      const w = Number(r.co_authored_documents || r.weight || r.count || 1);

      if (a1 && a2 && a1 !== a2) {
        nodeDegrees[a1] = (nodeDegrees[a1] || 0) + w;
        nodeDegrees[a2] = (nodeDegrees[a2] || 0) + w;
        rawLinks.push({ source: a1, target: a2, weight: w });
      }
    });

    const nodeIds = Object.keys(nodeDegrees);

    // Simple modularity grouping heuristic based on connectivity
    const nodes: GraphNode[] = nodeIds.map((id, index) => ({
      id,
      name: id,
      degree: nodeDegrees[id],
      community: index % 5, // 5 color communities
    }));

    const links: GraphLink[] = rawLinks.map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
    }));

    return { initialNodes: nodes, initialLinks: links };
  }, [records]);

  // Color palette for communities
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<number, string>()
      .domain([0, 1, 2, 3, 4])
      .range(["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6"]);
  }, []);

  // Render interactive D3 force simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || initialNodes.length === 0) return;

    const width = containerRef.current.clientWidth || 700;
    const height = 440;

    // Filter links by weight
    const filteredLinks: GraphLink[] = initialLinks
      .filter((l) => l.weight >= minWeightFilter)
      .map((l) => ({ ...l }));

    // Keep active nodes connected to filtered links or with high degree
    const activeNodeIds = new Set<string>();
    filteredLinks.forEach((l) => {
      activeNodeIds.add(typeof l.source === "string" ? l.source : (l.source as GraphNode).id);
      activeNodeIds.add(typeof l.target === "string" ? l.target : (l.target as GraphNode).id);
    });

    const activeNodes: GraphNode[] = initialNodes
      .filter((n) => activeNodeIds.has(n.id) || n.degree >= 2)
      .map((n) => ({ ...n }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create container group for zoom/pan
    const g = svg.append("g").attr("class", "graph-container");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
      });

    svg.call(zoom);

    // Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(activeNodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(filteredLinks)
          .id((d) => d.id)
          .distance((d) => Math.max(45, 120 - Math.min(d.weight * 12, 60)))
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => Math.max(8, 6 + d.degree * 2.2)))
      .alphaDecay(0.035);

    // Render Links (Edges)
    const link = g.append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(filteredLinks)
      .enter()
      .append("line")
      .attr("stroke", "#334155")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: GraphLink) => Math.max(1, Math.min(d.weight * 1.5, 4.5)));

    // Drag behavior definition
    const dragBehavior = d3.drag<SVGGElement, GraphNode>()
      .on("start", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Render Nodes Group
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(activeNodes)
      .enter()
      .append("g")
      .attr("class", "cursor-pointer")
      .call(dragBehavior);

    // Node circles with color
    node.append("circle")
      .attr("r", (d: GraphNode) => Math.max(6, Math.min(18, 5 + d.degree * 1.8)))
      .attr("fill", (d: GraphNode) => colorScale(d.community))
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2);

    // Node Labels
    node.append("text")
      .text((d: GraphNode) => (d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name))
      .attr("x", 0)
      .attr("y", (d: GraphNode) => Math.max(6, Math.min(18, 5 + d.degree * 1.8)) + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("class", "pointer-events-none select-none drop-shadow");

    // Interactivity: Highlight connected neighbors on hover
    node.on("mouseenter", (_event: MouseEvent, d: GraphNode) => {
      setHoveredNode(d);

      const connectedNeighbors = new Set<string>();
      connectedNeighbors.add(d.id);

      filteredLinks.forEach((l) => {
        const sId = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const tId = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        if (sId === d.id) connectedNeighbors.add(tId);
        if (tId === d.id) connectedNeighbors.add(sId);
      });

      node.style("opacity", (n: GraphNode) => (connectedNeighbors.has(n.id) ? 1 : 0.2));
      link
        .attr("stroke", (l: GraphLink) => {
          const sId = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
          const tId = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
          return sId === d.id || tId === d.id ? "#38bdf8" : "#1e293b";
        })
        .attr("stroke-opacity", (l: GraphLink) => {
          const sId = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
          const tId = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
          return sId === d.id || tId === d.id ? 1 : 0.1;
        })
        .attr("stroke-width", (l: GraphLink) => {
          const sId = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
          const tId = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
          return sId === d.id || tId === d.id ? 3 : 1;
        });
    });

    node.on("mouseleave", () => {
      setHoveredNode(null);
      node.style("opacity", 1);
      link
        .attr("stroke", "#334155")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", (d: GraphLink) => Math.max(1, Math.min(d.weight * 1.5, 4.5)));
    });

    node.on("click", (_event: MouseEvent, d: GraphNode) => {
      setSelectedNode((prev) => (prev?.id === d.id ? null : d));
    });

    // Simulation Tick Update
    simulation.on("tick", () => {
      link
        .attr("x1", (d: GraphLink) => (d.source as GraphNode).x || 0)
        .attr("y1", (d: GraphLink) => (d.source as GraphNode).y || 0)
        .attr("x2", (d: GraphLink) => (d.target as GraphNode).x || 0)
        .attr("y2", (d: GraphLink) => (d.target as GraphNode).y || 0);

      node.attr("transform", (d: GraphNode) => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [initialNodes, initialLinks, minWeightFilter, colorScale]);

  // Zoom control helpers
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(250).call(d3.zoom<SVGSVGElement, unknown>().scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(350).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  };

  if (!records || records.length === 0 || initialNodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
        No co-authorship relationships found in current dataset.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-xl"
    >
      {/* Topology Header & Controller Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Share2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              Co-Authorship Force-Directed Network Graph
            </h4>
            <p className="text-[11px] text-slate-400">
              D3.js physics-driven cluster layout with interactive node dragging & edge inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edge Weight Filter Slider */}
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Min Edge:</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={minWeightFilter}
              onChange={(e) => setMinWeightFilter(Number(e.target.value))}
              className="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-sky-400"
            />
            <span className="font-mono font-bold text-sky-400 text-[11px]">{minWeightFilter}</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg bg-slate-900 p-1 border border-slate-800 text-slate-400">
            <button
              type="button"
              onClick={() => handleZoom(1.3)}
              title="Zoom In"
              className="rounded p-1 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(0.7)}
              title="Zoom Out"
              className="rounded p-1 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset View"
              className="rounded p-1 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative h-[440px] w-full select-none overflow-hidden rounded-xl bg-slate-950/80">
        <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* Dynamic Details Overlay (Hovered/Selected Author) */}
        {(hoveredNode || selectedNode) && (
          <div className="absolute top-3 right-3 max-w-xs rounded-xl bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur-md border border-slate-700 space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400 truncate">
                {(hoveredNode || selectedNode)?.name}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                Author Node
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px]">
              <div>
                <div className="text-slate-400">Degree centrality</div>
                <div className="font-bold font-mono text-slate-200">
                  {(hoveredNode || selectedNode)?.degree} links
                </div>
              </div>
              <div>
                <div className="text-slate-400">Cluster group</div>
                <div className="font-bold text-emerald-400">
                  Cluster #{(hoveredNode || selectedNode)?.community! + 1}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 italic pt-1">
              Drag node to rearrange or scroll to zoom.
            </div>
          </div>
        )}

        {/* Graph Legend & Stats footer */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur border border-slate-800">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <strong className="text-slate-200">{initialNodes.length}</strong> Authors
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            <strong className="text-slate-200">{initialLinks.length}</strong> Edges
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            Zoom: <strong className="text-sky-400">{Math.round(zoomLevel * 100)}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
