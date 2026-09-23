import React, { useState } from "react";
import { Analysis } from "../types.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { EmptyState } from "./CommonUI.js";
import { Hash, Compass, Play, Search, Zap, Layers, GitBranch } from "lucide-react";

interface Props {
  analyses: Analysis[];
  onRunAnalysis: (capabilityId: string) => void;
  onNavigateToThematicEvolution?: () => void;
}

export function KeywordsWorkbench({ analyses, onRunAnalysis, onNavigateToThematicEvolution }: Props) {
  const [subTab, setSubTab] = useState<"thematic" | "frequency">("thematic");
  const [searchQuery, setSearchQuery] = useState("");

  const thematicAnalysis = analyses.find((a) => a.capability_id === "keyword.thematic_map");
  const freqAnalysis = analyses.find((a) => a.capability_id === "keyword.frequency");

  const thematicRecords = thematicAnalysis?.result?.records || [];
  const freqRecords = freqAnalysis?.result?.records || [];

  const filteredKws = freqRecords.filter((r) =>
    String(r.keyword || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const motorCount = thematicRecords.filter((r) => r.quadrant_code === "Q1").length;
  const nicheCount = thematicRecords.filter((r) => r.quadrant_code === "Q2").length;
  const emergingCount = thematicRecords.filter((r) => r.quadrant_code === "Q3").length;
  const basicCount = thematicRecords.filter((r) => r.quadrant_code === "Q4").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Thematic Intelligence Workbench
            </span>
            <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
              Callon's Strategic Diagram & Co-Word
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Keywords & Thematic Landscapes
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Explore conceptual clusters, Callon's strategic 4-quadrant thematic diagram (Motor, Niche, Emerging, Basic), and keyword distributions.
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubTab("thematic")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "thematic"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Strategic Thematic Map (Callon)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("frequency")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "frequency"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Keyword Frequencies & Cloud
          </button>
          {onNavigateToThematicEvolution && (
            <button
              type="button"
              onClick={onNavigateToThematicEvolution}
              className="cursor-pointer rounded-lg px-3 py-1.5 transition text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold flex items-center gap-1.5 border border-purple-200"
            >
              <GitBranch className="h-3.5 w-3.5 text-purple-600" />
              <span>Thematic Evolution (Sankey)</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Q1 Motor Themes</span>
            <Zap className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {motorCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">High Centrality • High Density</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Q2 Niche Themes</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {nicheCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Specialized isolated clusters</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Q3 Emerging / Fading</span>
            <Compass className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {emergingCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Peripheral frontier topics</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Q4 Basic Themes</span>
            <Hash className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {basicCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Cross-cutting domain foundations</div>
        </div>
      </div>

      {/* Subtab 1: Thematic Map */}
      {subTab === "thematic" && (
        <div className="space-y-6">
          {thematicAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="keyword.thematic_map"
                records={thematicRecords}
              />
            </div>
          ) : (
            <EmptyState
              title="No Thematic Map Analysis"
              description="Construct Callon's strategic diagram to position themes by internal density and external centrality."
              action="Run Callon's Thematic Map"
              onAction={() => onRunAnalysis("keyword.thematic_map")}
            />
          )}
        </div>
      )}

      {/* Subtab 2: Keyword Frequencies */}
      {subTab === "frequency" && (
        <div className="space-y-6">
          {freqAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="keyword.frequency"
                records={freqRecords}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Keyword Frequency Inventory</h3>
                    <p className="text-[11px] text-slate-500">All tokenized author and index keywords</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter keyword..."
                      className="rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Keyword Concept</th>
                        <th className="px-4 py-3 text-right">Occurrence Frequency</th>
                        <th className="px-4 py-3 text-right">Relative Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredKws.map((k, idx) => {
                        const maxF = Math.max(1, ...freqRecords.map((x) => Number(x.frequency || x.count || 1)));
                        const freq = Number(k.frequency || k.count || 1);
                        const pct = Math.round((freq / maxF) * 100);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 font-mono">
                            <td className="px-4 py-3 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="px-4 py-3 font-sans font-bold text-slate-900">{k.keyword}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{freq}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full bg-slate-900 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Keyword Frequency Data"
              description="Tokenize and calculate keyword frequency counts across the dataset."
              action="Run Keyword Analysis"
              onAction={() => onRunAnalysis("keyword.frequency")}
            />
          )}
        </div>
      )}
    </div>
  );
}
