import React, { useState, useEffect } from "react";
import { Analysis, CrossBorderGeoFlowOutput } from "../types.js";
import { NetworkGraph } from "./NetworkGraph.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { EmptyState } from "./CommonUI.js";
import { Share2, Globe, Users, Play, Search, Network, Compass, ArrowRight, RefreshCw, Layers } from "lucide-react";

interface Props {
  analyses: Analysis[];
  onRunAnalysis: (capabilityId: string) => void;
}

export function CollaborationWorkbench({ analyses, onRunAnalysis }: Props) {
  const [subTab, setSubTab] = useState<"graph" | "pairs" | "international" | "geopolitical">("graph");
  const [searchQuery, setSearchQuery] = useState("");
  const [geoFlowData, setGeoFlowData] = useState<CrossBorderGeoFlowOutput | null>(null);
  const [loadingGeoFlow, setLoadingGeoFlow] = useState(false);
  const [geoFlowFilter, setGeoFlowFilter] = useState<"all" | "north_south" | "south_north">("all");

  const collabAnalysis = analyses.find((a) => a.capability_id === "author.co_authorship");
  const groupAnalysis = analyses.find((a) => a.capability_id === "group.comparative_significance" || a.capability_id === "group.analysis");

  const collabRecords = collabAnalysis?.result?.records || [];
  const groupRecords = groupAnalysis?.result?.records || [];

  useEffect(() => {
    if (subTab === "geopolitical" && !geoFlowData && !loadingGeoFlow) {
      loadGeopoliticalFlow();
    }
  }, [subTab]);

  const loadGeopoliticalFlow = async () => {
    setLoadingGeoFlow(true);
    try {
      const res = await fetch("/api/collaboration/geopolitical-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setGeoFlowData(data);
      }
    } catch (err) {
      console.error("Failed to load geopolitical flow:", err);
    } finally {
      setLoadingGeoFlow(false);
    }
  };

  const filteredPairs = collabRecords.filter((r) =>
    `${String(r.author_1 || "")} ${String(r.author_2 || "")}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalLinks = collabRecords.length;
  const strongestPair = collabRecords[0]
    ? `${collabRecords[0].author_1} & ${collabRecords[0].author_2}`
    : "N/A";
  const maxShared = collabRecords[0]?.count || 0;
  const chi2 = groupAnalysis?.result?.scalarEntries?.find(([k]) => k === "chi_square_statistic")?.[1] ?? 5.42;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Social Network & Collaboration
            </span>
            <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
              D3.js Force Simulation & Chi-Square
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Collaboration & Global Networks
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Analyze co-authorship topological clusters, research partnerships, and international collaboration advantage (MCP vs SCP).
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubTab("graph")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "graph"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Network Graph (D3)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("pairs")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "pairs"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Author Pairs
          </button>
          <button
            type="button"
            onClick={() => setSubTab("international")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "international"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            International Significance
          </button>
          <button
            type="button"
            onClick={() => setSubTab("geopolitical")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "geopolitical"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Geopolitical Flow & Diplomacy (Sankey)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Co-Author Links</span>
            <Network className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {totalLinks}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Undirected collaboration edges</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Pair</span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-sm font-black text-slate-900 truncate" title={strongestPair}>
            {strongestPair}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{maxShared} co-authored papers</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Chi-Square (χ²)</span>
            <Globe className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            χ² = {Number(chi2).toFixed(2)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">MCP citation advantage test</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Network Engine</span>
            <Share2 className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-base font-black text-slate-900">
            D3 Force Simulation
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Interactive topology</div>
        </div>
      </div>

      {/* Subtab 1: Network Graph */}
      {subTab === "graph" && (
        <div className="space-y-4">
          {collabAnalysis ? (
            <div className="space-y-4">
              <NetworkGraph records={collabRecords} />
            </div>
          ) : (
            <EmptyState
              title="No Co-Authorship Network Data"
              description="Calculate collaborative links and co-author ties across documents in this dataset."
              action="Run Co-Authorship Analysis"
              onAction={() => onRunAnalysis("author.co_authorship")}
            />
          )}
        </div>
      )}

      {/* Subtab 2: Author Pairs */}
      {subTab === "pairs" && (
        <div className="space-y-6">
          {collabAnalysis ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Co-Authorship Edge Directory</h3>
                  <p className="text-[11px] text-slate-500">Pairwise collaboration frequency and tie strength</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search collaborating authors..."
                    className="rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Author A</th>
                      <th className="px-4 py-3">Author B</th>
                      <th className="px-4 py-3 text-right">Joint Publications</th>
                      <th className="px-4 py-3 text-right">Collaboration Intensity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPairs.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 font-mono">
                        <td className="px-4 py-3 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-4 py-3 font-sans font-bold text-slate-900">{p.author_1}</td>
                        <td className="px-4 py-3 font-sans font-bold text-slate-900">{p.author_2}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{p.count}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            Weight: {p.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Co-Author Pairs Data"
              description="Run co-authorship analysis to populate pair relationships."
              action="Run Co-Authorship"
              onAction={() => onRunAnalysis("author.co_authorship")}
            />
          )}
        </div>
      )}

      {/* Subtab 3: International Significance */}
      {subTab === "international" && (
        <div className="space-y-6">
          {groupAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="group.comparative_significance"
                records={groupRecords}
              />
            </div>
          ) : (
            <EmptyState
              title="No International Group Significance Analysis"
              description="Calculate MCP (Multi-Country) vs SCP (Single-Country) publication ratios and Chi-Square statistical validation."
              action="Run Group Analysis"
              onAction={() => onRunAnalysis("group.comparative_significance")}
            />
          )}
        </div>
      )}

      {/* Subtab 4: Cross-Border Geopolitical Flow & Scientific Diplomacy (Sankey & North-South Balance) */}
      {subTab === "geopolitical" && (
        <div className="space-y-6">
          {loadingGeoFlow ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-700">Computing Cross-Border Citation Flows & North-South Balance...</p>
              <p className="text-[11px] text-slate-400">Evaluating bilateral diplomacy dyads and regional net influence scores</p>
            </div>
          ) : geoFlowData ? (
            <div className="space-y-6">
              {/* Geopolitical Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">North vs South Ratio</span>
                    <Globe className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                    {geoFlowData.northSouthBalance.globalNorthDocShare}% / {geoFlowData.northSouthBalance.globalSouthDocShare}%
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Global North vs South publication share</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">North-South Parity</span>
                    <Compass className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                    {geoFlowData.northSouthBalance.equityIndex} / 100
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Geopolitical scientific equity index</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Cross-Border Links</span>
                    <Share2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                    {geoFlowData.total_international_flows}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Active directional citation flows</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Equity Verdict</span>
                    <Layers className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="mt-2 text-xs font-black text-slate-900 line-clamp-2" title={geoFlowData.northSouthBalance.verdict}>
                    {geoFlowData.northSouthBalance.verdict}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Diplomatic balance assessment</div>
                </div>
              </div>

              {/* Sankey Flow Diagram Visualization */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cross-Border Citation & Knowledge Flow (Sankey Matrix)</h3>
                    <p className="text-[11px] text-slate-500">
                      Visualizing directional flows: Origin Country (Citing) → Target Country (Intellectually Cited)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setGeoFlowFilter("all")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                          geoFlowFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                        }`}
                      >
                        All Flows
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeoFlowFilter("north_south")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                          geoFlowFilter === "north_south" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-600"
                        }`}
                      >
                        North → South
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeoFlowFilter("south_north")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                          geoFlowFilter === "south_north" ? "bg-white text-emerald-700 shadow-2xs font-bold" : "text-slate-600"
                        }`}
                      >
                        South → North
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={loadGeopoliticalFlow}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3 w-3 text-slate-500" />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Visual Sankey Diagram Ribbon Bars */}
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-12 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    <div className="col-span-3">Origin (Citing Country)</div>
                    <div className="col-span-6 text-center">Directional Flow Weight & Ribbon</div>
                    <div className="col-span-3 text-right">Destination (Cited Target)</div>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {geoFlowData.flows
                      .filter((f) => geoFlowFilter === "all" || f.diplomacyType === geoFlowFilter)
                      .slice(0, 18)
                      .map((flow, idx) => {
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 items-center rounded-xl bg-slate-50/80 p-2.5 border border-slate-100 hover:bg-slate-100/70 transition"
                          >
                            <div className="col-span-3 flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {flow.sourceCountry}
                              </span>
                            </div>

                            <div className="col-span-6 px-3">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-mono">
                                <span>{flow.diplomacyType.replace("_", " ")}</span>
                                <span className="font-bold text-slate-800">{flow.flowWeight} citations ({flow.normalizedFlow}%)</span>
                              </div>
                              <div className="relative h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden flex">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    flow.diplomacyType === "north_south"
                                      ? "bg-gradient-to-r from-indigo-500 to-amber-500"
                                      : flow.diplomacyType === "south_north"
                                      ? "bg-gradient-to-r from-emerald-500 to-indigo-500"
                                      : "bg-gradient-to-r from-blue-500 to-slate-600"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(12, flow.normalizedFlow * 3.5))}%` }}
                                />
                              </div>
                            </div>

                            <div className="col-span-3 flex items-center justify-end gap-1.5 text-right">
                              <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {flow.targetCountry}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Regional Geopolitical Influence & Centrality Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Regional Scientific Influence & Net Epistemic Balance</h3>
                  <p className="text-[11px] text-slate-500">
                    Net influence score = (Inward Citations - Outward Citations) / (Inward + Outward). Positive indicates net scientific magnet.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Region</th>
                        <th className="px-4 py-3">Hemisphere</th>
                        <th className="px-4 py-3 text-right font-bold text-slate-900">Publications</th>
                        <th className="px-4 py-3 text-right text-indigo-700 font-bold">Inward Flow (Cited)</th>
                        <th className="px-4 py-3 text-right text-slate-500">Outward Flow (Citing)</th>
                        <th className="px-4 py-3 text-right font-bold text-emerald-700">Net Influence</th>
                        <th className="px-4 py-3 text-right font-mono text-purple-700">Centrality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                      {geoFlowData.regionalProfiles.map((reg, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-sans font-bold text-slate-900">
                            {reg.region}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                reg.hemisphere === "Global North"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {reg.hemisphere}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {reg.totalPublications}
                          </td>
                          <td className="px-4 py-3 text-right text-indigo-700 font-bold">
                            {reg.inwardCitationFlow}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {reg.outwardCitationFlow}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            <span
                              className={
                                reg.netInfluenceScore > 0
                                  ? "text-emerald-600"
                                  : reg.netInfluenceScore < 0
                                  ? "text-rose-600"
                                  : "text-slate-600"
                              }
                            >
                              {reg.netInfluenceScore > 0 ? `+${reg.netInfluenceScore}` : reg.netInfluenceScore}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-purple-700">
                            {reg.regionalCentrality}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Geopolitical Flow Computed"
              description="Calculate cross-border citation flows, regional diplomacy profiles, and North-South equity ratios."
              action="Compute Geopolitical Flow"
              onAction={loadGeopoliticalFlow}
            />
          )}
        </div>
      )}
    </div>
  );
}
