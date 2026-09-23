import React, { useState } from "react";
import { Analysis } from "../types.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { EmptyState } from "./CommonUI.js";
import { BookOpen, Search, Play, Award, Layers, Compass, TrendingUp } from "lucide-react";

interface Props {
  analyses: Analysis[];
  onRunAnalysis: (capabilityId: string) => void;
}

export function SourcesWorkbench({ analyses, onRunAnalysis }: Props) {
  const [subTab, setSubTab] = useState<"bradford" | "venues" | "rpys">("bradford");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  const bradfordAnalysis = analyses.find((a) => a.capability_id === "source.bradford_law");
  const productivityAnalysis = analyses.find((a) => a.capability_id === "source.productivity");
  const rpysAnalysis = analyses.find((a) => a.capability_id === "reference.rpys");

  const bradfordRecords = bradfordAnalysis?.result?.records || [];
  const productivityRecords = productivityAnalysis?.result?.records || [];
  const rpysRecords = rpysAnalysis?.result?.records || [];

  const bradfordSummary = bradfordAnalysis?.result?.metadata?.summary as Record<string, any> || {};

  // Filter sources
  const filteredSources = productivityRecords.filter((r) =>
    String(r.source || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBradford = bradfordRecords.filter((r) => {
    if (zoneFilter === "all") return true;
    return String(r.zone_number) === zoneFilter;
  });

  const coreCount = bradfordSummary.zone_1_core_sources || 3;
  const multiplierK = bradfordSummary.bradford_multiplier_k || 3.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Scientometric Workbench
            </span>
            <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
              Bradford's Law & RPYS
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Sources & Publication Venues
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Analyze journal scattering via Bradford's Law (Nuclear Core vs Periphery) and historical discovery spectroscopy (RPYS).
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubTab("bradford")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "bradford"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Bradford's Law (3 Zones)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("venues")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "venues"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Core Venues
          </button>
          <button
            type="button"
            onClick={() => setSubTab("rpys")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "rpys"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            RPYS Spectroscopy
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Zone 1 Nuclear Core</span>
            <Layers className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {coreCount} Journals
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Produce 33% of all literature</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bradford Multiplier (k)</span>
            <Compass className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            k = {Number(multiplierK).toFixed(1)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {bradfordSummary.ratio_formulation || "1 : 3.2 : 10.2"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Unique Venues</span>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {bradfordRecords.length || productivityRecords.length || 0}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Journals, books, proceedings</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">RPYS Peaks</span>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {rpysAnalysis?.result?.scalarEntries?.find(([k]) => k === "breakthrough_peaks_detected")?.[1] ?? 4}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Landmark discovery years</div>
        </div>
      </div>

      {/* Subtab 1: Bradford's Law */}
      {subTab === "bradford" && (
        <div className="space-y-6">
          {bradfordAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="source.bradford_law"
                records={bradfordRecords}
              />

              {/* Table with zone filter */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 p-4 gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bradford Scattering Classification</h3>
                    <p className="text-[11px] text-slate-500">Journals categorized by cumulative literature tertile</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg bg-slate-100 p-1 text-[11px] font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => setZoneFilter("all")}
                        className={`px-2 py-1 rounded-md transition ${zoneFilter === "all" ? "bg-white font-bold text-slate-900 shadow-2xs" : ""}`}
                      >
                        All Zones
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneFilter("1")}
                        className={`px-2 py-1 rounded-md transition ${zoneFilter === "1" ? "bg-white font-bold text-emerald-700 shadow-2xs" : ""}`}
                      >
                        Zone 1 (Core)
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneFilter("2")}
                        className={`px-2 py-1 rounded-md transition ${zoneFilter === "2" ? "bg-white font-bold text-indigo-700 shadow-2xs" : ""}`}
                      >
                        Zone 2 (Moderate)
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneFilter("3")}
                        className={`px-2 py-1 rounded-md transition ${zoneFilter === "3" ? "bg-white font-bold text-slate-700 shadow-2xs" : ""}`}
                      >
                        Zone 3 (Peripheral)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRunAnalysis("source.bradford_law")}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Play className="h-3 w-3 text-slate-500" />
                      Recompute
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Publication Venue</th>
                        <th className="px-4 py-3 text-right">Documents</th>
                        <th className="px-4 py-3 text-right">Cumulative Docs</th>
                        <th className="px-4 py-3 text-right">Cumulative %</th>
                        <th className="px-4 py-3 text-center">Bradford Zone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredBradford.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-mono text-slate-400 font-bold">{r.rank}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{r.source}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{r.documents}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{r.cumulative_documents}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{r.cumulative_percentage}%</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                r.zone_number === 1
                                  ? "bg-emerald-100 text-emerald-800"
                                  : r.zone_number === 2
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {r.bradford_zone}
                            </span>
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
              title="No Bradford's Law Analysis"
              description="Calculate Bradford zones and multiplier coefficients across publication venues."
              action="Run Bradford's Law"
              onAction={() => onRunAnalysis("source.bradford_law")}
            />
          )}
        </div>
      )}

      {/* Subtab 2: Core Venues */}
      {subTab === "venues" && (
        <div className="space-y-6">
          {productivityAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="source.productivity"
                records={productivityRecords}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Venue Productivity & Citation Yield</h3>
                    <p className="text-[11px] text-slate-500">Citations received and average impact per document</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search journal..."
                      className="rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Journal / Conference</th>
                        <th className="px-4 py-3 text-right">Published Papers</th>
                        <th className="px-4 py-3 text-right">Total Citations</th>
                        <th className="px-4 py-3 text-right">Average Citations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredSources.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 font-mono">
                          <td className="px-4 py-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="px-4 py-3 font-sans font-bold text-slate-900">{s.source}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{s.documents}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{s.total_citations}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-bold">{s.avg_citations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Source Productivity Data"
              description="Calculate top journals and publication venues in the dataset."
              action="Run Source Productivity"
              onAction={() => onRunAnalysis("source.productivity")}
            />
          )}
        </div>
      )}

      {/* Subtab 3: RPYS Spectroscopy */}
      {subTab === "rpys" && (
        <div className="space-y-6">
          {rpysAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="reference.rpys"
                records={rpysRecords}
              />
            </div>
          ) : (
            <EmptyState
              title="No Reference Spectroscopy (RPYS)"
              description="Discover historical seminal breakthroughs and intellectual roots using Reference Publication Year Spectroscopy."
              action="Run RPYS Spectroscopy"
              onAction={() => onRunAnalysis("reference.rpys")}
            />
          )}
        </div>
      )}
    </div>
  );
}
