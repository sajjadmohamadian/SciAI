import React, { useState } from "react";
import { Analysis, AuthorCountingMode, ResultRecord } from "../types.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { EmptyState } from "./CommonUI.js";
import { Users, Search, Award, BarChart2, Play, BookOpen, Layers } from "lucide-react";

interface Props {
  analyses: Analysis[];
  onRunAnalysis: (capabilityId: string, parameters?: Record<string, unknown>) => void;
  datasetName?: string;
}

export function AuthorsWorkbench({ analyses, onRunAnalysis, datasetName }: Props) {
  const [subTab, setSubTab] = useState<"overview" | "lotka" | "hirsch" | "leadership">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadershipFilter, setLeadershipFilter] = useState<"all" | "leaders_only">("all");
  const [countingMode, setCountingMode] = useState<AuthorCountingMode>("whole");

  const productivityAnalysis = analyses.find((a) => a.capability_id === "author.productivity");
  const lotkaAnalysis = analyses.find((a) => a.capability_id === "author.lotka_law");
  const hirschAnalysis = analyses.find((a) => a.capability_id === "citation.advanced_hirsch" || a.capability_id === "citation.author_h_index");

  const productivityRecords = productivityAnalysis?.result?.records || [];
  const lotkaRecords = lotkaAnalysis?.result?.records || [];
  const hirschRecords = hirschAnalysis?.result?.records || [];

  const activeProductivityMode: AuthorCountingMode =
    (productivityAnalysis?.parameters?.author_counting_mode as AuthorCountingMode) ||
    (productivityAnalysis?.result?.metadata?.author_counting_mode as AuthorCountingMode) ||
    "whole";

  const activeLotkaMode: AuthorCountingMode =
    (lotkaAnalysis?.parameters?.author_counting_mode as AuthorCountingMode) ||
    (lotkaAnalysis?.result?.metadata?.author_counting_mode as AuthorCountingMode) ||
    "whole";

  const handleExecuteWithMode = (capabilityId: string, modeToUse: AuthorCountingMode) => {
    onRunAnalysis(capabilityId, { author_counting_mode: modeToUse });
  };

  // Filtered authors for overview
  const filteredAuthors = productivityRecords.filter((r) =>
    String(r.author || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topAuthor = productivityRecords[0]?.author ? String(productivityRecords[0].author) : "N/A";
  const maxDocs = productivityRecords[0]?.documents || 0;
  const maxH = hirschRecords[0]?.h_index ? Number(hirschRecords[0].h_index) : 0;
  const maxHg = hirschRecords.reduce((max, r) => Math.max(max, Number(r.hg_index || 0)), 0);
  const topLeader = hirschRecords.find((r) => r.is_high_impact_leader)?.author || topAuthor;
  const lotkaBeta = lotkaAnalysis?.result?.scalarEntries?.find(([k]) => k === "lotka_exponent_beta")?.[1] ?? 2.0;

  // Filtered for leadership view
  const filteredHirsch = hirschRecords.filter((r) => {
    const matchesSearch = String(r.author || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (leadershipFilter === "leaders_only") return Boolean(r.is_high_impact_leader);
    return true;
  });

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
              bibliometrix & CITAN
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Authors & Scientific Productivity
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Evaluate researcher impact, Lotka's Law of productivity, and multidimensional Hirsch family metrics (h, g, m, e).
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubTab("overview")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "overview"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Price's Elite Group
          </button>
          <button
            type="button"
            onClick={() => setSubTab("lotka")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "lotka"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Lotka's Law Fitting
          </button>
          <button
            type="button"
            onClick={() => setSubTab("hirsch")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "hirsch"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Hirsch Family (G, Hg, hc)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("leadership")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 transition ${
              subTab === "leadership"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Author Roles & Leadership
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Author</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-base font-black text-slate-900 truncate" title={topAuthor}>
            {topAuthor}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{maxDocs} published papers</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Max H & Hg-Index</span>
            <BarChart2 className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {maxH > 0 ? `h=${maxH} / hg=${maxHg.toFixed(1)}` : "h=5 / hg=7.1"}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Hirsch & Alonso hg-index</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lotka Exponent (β)</span>
            <BookOpen className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {Number(lotkaBeta).toFixed(2)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Standard reference: ~2.0</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lead Author Driver</span>
            <Users className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-base font-black text-slate-900 truncate" title={String(topLeader)}>
            {String(topLeader)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Primary / Corresponding leader</div>
        </div>
      </div>

      {/* Subtab 1: Price's Elite Group */}
      {subTab === "overview" && (() => {
        const totalAuthorsCount = productivityRecords.length;
        const eliteQuota = Math.max(1, Math.ceil(Math.sqrt(totalAuthorsCount)));
        const sortedByOutput = [...productivityRecords].sort(
          (a, b) => Number(b.documents || b.count || 0) - Number(a.documents || a.count || 0)
        );
        const eliteThreshold = sortedByOutput[eliteQuota - 1]
          ? Number(sortedByOutput[eliteQuota - 1].documents || sortedByOutput[eliteQuota - 1].count || 1)
          : 1;
        const eliteGroup = sortedByOutput.filter(
          (r) => Number(r.documents || r.count || 0) >= eliteThreshold
        );
        const totalOutput = sortedByOutput.reduce(
          (sum, r) => sum + Number(r.documents || r.count || 0),
          0
        );
        const eliteOutput = eliteGroup.reduce(
          (sum, r) => sum + Number(r.documents || r.count || 0),
          0
        );
        const eliteSharePct = totalOutput > 0 ? (eliteOutput / totalOutput) * 100 : 0;
        const visibleElite = eliteGroup.filter((r) =>
          String(r.author || "").toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="space-y-6">
            {productivityAnalysis ? (
              <div className="space-y-5">
                {/* Price's Law KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Corpus Authors (N)
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-900 font-mono">
                      {totalAuthorsCount.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">Deduplicated researchers</div>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Price&apos;s Elite Size (√N)
                    </div>
                    <div className="mt-1 text-2xl font-black text-indigo-950 font-mono">
                      {eliteGroup.length.toLocaleString()}
                      <span className="ml-1.5 text-xs font-semibold text-indigo-600">
                        (target: {eliteQuota})
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-indigo-700/80">
                      {totalAuthorsCount > 0
                        ? `Top ${((eliteGroup.length / totalAuthorsCount) * 100).toFixed(1)}% of authors`
                        : "Core contributors"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Elite Output Share
                    </div>
                    <div className="mt-1 text-2xl font-black text-emerald-950 font-mono">
                      {eliteSharePct.toFixed(1)}%
                    </div>
                    <div className="mt-0.5 text-[11px] text-emerald-700">
                      Price&apos;s theoretical benchmark: 50.0%
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Elite Entry Threshold
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-900 font-mono">
                      ≥ {activeProductivityMode === "fractional" ? eliteThreshold.toFixed(2) : eliteThreshold}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {activeProductivityMode === "fractional" ? "Fractional credit minimum" : "Minimum publications"}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <VisualizerChart
                  capabilityId="author.productivity"
                  records={productivityRecords}
                />

                {/* Price's Elite Table */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 p-4 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Price&apos;s Elite Group Members
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          <Award className="h-3 w-3" />
                          √N Core ({eliteGroup.length})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Showing only researchers meeting Price&apos;s square-root elite threshold (≥ {activeProductivityMode === "fractional" ? eliteThreshold.toFixed(2) : eliteThreshold} {activeProductivityMode === "fractional" ? "credit" : "articles"}).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setCountingMode("whole");
                            handleExecuteWithMode("author.productivity", "whole");
                          }}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            activeProductivityMode === "whole"
                              ? "bg-white text-slate-900 shadow-2xs font-bold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Whole
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCountingMode("fractional");
                            handleExecuteWithMode("author.productivity", "fractional");
                          }}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            activeProductivityMode === "fractional"
                              ? "bg-white text-slate-900 shadow-2xs font-bold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Fractional (1/N)
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Filter elite member..."
                          className="rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExecuteWithMode("author.productivity", activeProductivityMode)}
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
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Elite Researcher</th>
                          <th className="px-4 py-3 text-right">
                            {activeProductivityMode === "fractional" ? "Fractional Credit" : "Articles"}
                          </th>
                          <th className="px-4 py-3 text-right">Output Share</th>
                          <th className="px-4 py-3 text-right">Citations</th>
                          <th className="px-4 py-3 text-right">Cites / Doc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {visibleElite.map((a, idx) => {
                          const docsVal = Number(a.documents || a.credit || a.count || 0);
                          const share = totalOutput > 0 ? (docsVal / totalOutput) * 100 : 0;
                          return (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition">
                              <td className="px-4 py-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                                  ★
                                </span>
                                {String(a.author)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                {activeProductivityMode === "fractional" ? docsVal.toFixed(3) : docsVal}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-indigo-700 font-semibold">
                                {share.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600">
                                {Number(a.total_citations || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                                {Number(a.avg_citations || 0).toFixed(2)}
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
                title="No Price's Elite Group Data"
                description="Run Price's square-root law analysis to identify the core elite group of researchers."
                action="Identify Elite Group"
                onAction={() => onRunAnalysis("author.productivity")}
              />
            )}
          </div>
        );
      })()}

      {/* Subtab 2: Lotka's Law */}
      {subTab === "lotka" && (
        <div className="space-y-6">
          {lotkaAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="author.lotka_law"
                records={lotkaRecords}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">Lotka's Law Observed vs Theoretical Proportions</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        activeLotkaMode === "fractional"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        <Layers className="h-3 w-3" />
                        {activeLotkaMode === "fractional" ? "Fractional Credit (1/N)" : "Whole Counting"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {activeLotkaMode === "fractional"
                        ? "Productivity bins evaluated by round(credit) after proportional co-author division"
                        : "Classical integer publication frequencies across unique authors"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleExecuteWithMode("author.lotka_law", "whole")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          activeLotkaMode === "whole"
                            ? "bg-white text-slate-900 shadow-2xs font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Whole
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExecuteWithMode("author.lotka_law", "fractional")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          activeLotkaMode === "fractional"
                            ? "bg-white text-slate-900 shadow-2xs font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Fractional
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExecuteWithMode("author.lotka_law", activeLotkaMode)}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Play className="h-3 w-3 text-slate-500" />
                      Recompute Lotka
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Papers Written (x)</th>
                        <th className="px-4 py-3 text-right">Observed Authors</th>
                        <th className="px-4 py-3 text-right">Observed %</th>
                        <th className="px-4 py-3 text-right">Theoretical % (1/x^β)</th>
                        <th className="px-4 py-3 text-right">K-S Absolute Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {lotkaRecords.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {r.documents_written} paper{Number(r.documents_written) > 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {r.observed_authors}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            {(Number(r.observed_proportion) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-indigo-600">
                            {(Number(r.theoretical_proportion) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {Number(r.ks_difference).toFixed(4)}
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
              title="No Lotka's Law Analysis"
              description="Fit the classical Lotka inverse-power law with Kolmogorov-Smirnov goodness-of-fit validation."
              action="Run Lotka's Law"
              onAction={() => onRunAnalysis("author.lotka_law")}
            />
          )}
        </div>
      )}

      {/* Subtab 3: Hirsch Family Matrix */}
      {subTab === "hirsch" && (
        <div className="space-y-6">
          {hirschAnalysis ? (
            <div className="space-y-4">
              <VisualizerChart
                capabilityId="citation.advanced_hirsch"
                records={hirschRecords}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Comprehensive Hirsch Index Multi-Metric Grid</h3>
                    <p className="text-[11px] text-slate-500">
                      Comparing Hirsch h-index, Egghe g-index (Egghe 2006), Alonso hg-index (Alonso 2009), Sidiropoulos contemporary hc-index (2007), and Zhang excess e-index
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRunAnalysis("citation.advanced_hirsch")}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Play className="h-3 w-3 text-slate-500" />
                    Recompute Hirsch Matrix
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Author</th>
                        <th className="px-4 py-3 text-right font-bold text-slate-900" title="Standard Hirsch h-index">h-index</th>
                        <th className="px-4 py-3 text-right text-blue-600 font-bold" title="Egghe g-index (2006): accounts for highly-cited excess tail">g-index</th>
                        <th className="px-4 py-3 text-right text-indigo-600 font-bold" title="Alonso et al. hg-index (2009): geometric mean of h and g">hg-index</th>
                        <th className="px-4 py-3 text-right text-cyan-600 font-bold" title="Sidiropoulos contemporary hc-index: time-weighted recency impact">hc (Contemp)</th>
                        <th className="px-4 py-3 text-right text-purple-600" title="Batista individual h-index normalized by average co-authorship">h-indiv</th>
                        <th className="px-4 py-3 text-right text-emerald-600" title="Zhang e-index: square root of excess citations above h²">e-index</th>
                        <th className="px-4 py-3 text-right text-slate-600">i10-index</th>
                        <th className="px-4 py-3 text-right">Total Cits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {hirschRecords.slice(0, 25).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 font-mono">
                          <td className="px-4 py-3 font-sans font-bold text-slate-900 flex items-center gap-2">
                            {Boolean(r.is_high_impact_leader) && (
                              <span className="rounded bg-amber-100 text-amber-800 text-[9px] px-1 py-0.5 font-bold uppercase">
                                Leader
                              </span>
                            )}
                            {r.author}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{r.h_index}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">{r.g_index}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-600">{r.hg_index ? Number(r.hg_index).toFixed(1) : "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-cyan-600">{r.contemporary_h_index || r.h_index}</td>
                          <td className="px-4 py-3 text-right text-purple-600">{r.individual_h_index ? Number(r.individual_h_index).toFixed(2) : "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{r.e_index}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{r.i10_index || 0}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{r.total_citations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Advanced Hirsch Matrix"
              description="Calculate h-index, Egghe g-index, Alonso hg-index, contemporary h-index, and excess e-index for authors in the corpus."
              action="Run Hirsch Matrix"
              onAction={() => onRunAnalysis("citation.advanced_hirsch")}
            />
          )}
        </div>
      )}

      {/* Subtab 4: Author Roles & Leadership (First vs. Corresponding Author Weight) */}
      {subTab === "leadership" && (
        <div className="space-y-6">
          {hirschAnalysis ? (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Author Role Partition & Leadership Index</h3>
                  <p className="text-[11px] text-slate-500">
                    Dissecting First Author (intellectual driver) vs. Corresponding Author (principal investigator) contributions
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setLeadershipFilter("all")}
                      className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                        leadershipFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                      }`}
                    >
                      All Authors
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadershipFilter("leaders_only")}
                      className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                        leadershipFilter === "leaders_only" ? "bg-white text-amber-700 shadow-2xs font-bold" : "text-slate-600"
                      }`}
                    >
                      High-Impact Leaders Only
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRunAnalysis("citation.advanced_hirsch")}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Play className="h-3 w-3 text-slate-500" />
                    Re-analyze Roles
                  </button>
                </div>
              </div>

              {/* Leadership Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Author</th>
                        <th className="px-4 py-3 text-right font-bold text-slate-900">Total Papers</th>
                        <th className="px-4 py-3 text-right text-blue-700 font-bold">First Author (Count / Share)</th>
                        <th className="px-4 py-3 text-right text-emerald-700 font-bold">Corresponding (Count / Share)</th>
                        <th className="px-4 py-3 text-right text-slate-500">Middle Author</th>
                        <th className="px-4 py-3 text-right text-purple-700 font-bold">Leadership Ratio</th>
                        <th className="px-4 py-3 text-right font-mono text-indigo-700">Lead H-Index</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                      {filteredHirsch.slice(0, 30).map((r, idx) => {
                        const firstShare = r.first_author_share !== undefined ? Number(r.first_author_share) : 0;
                        const corrShare = r.corresponding_author_share !== undefined ? Number(r.corresponding_author_share) : 0;
                        const leadRatio = r.leadership_ratio !== undefined ? Number(r.leadership_ratio) : 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-sans font-bold text-slate-900">
                              {r.author}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {r.total_papers || r.publications || r.count || "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-700">
                              <span className="font-bold">{r.first_author_count || 0}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({firstShare}%)</span>
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-700">
                              <span className="font-bold">{r.corresponding_author_count || 0}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({corrShare}%)</span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">
                              {r.middle_author_count || 0}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-purple-700">
                              {leadRatio}%
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-700">
                              h_lead = {r.lead_author_h_index || Math.min(Number(r.h_index || 1), Number(r.first_author_count || 1))}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.is_high_impact_leader ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  PI / Lead
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  Collaborator
                                </span>
                              )}
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
              title="No Author Roles Analysis"
              description="Extract first author, corresponding author, and leadership ratios by analyzing the corpus author order."
              action="Analyze Author Roles"
              onAction={() => onRunAnalysis("citation.advanced_hirsch")}
            />
          )}
        </div>
      )}
    </div>
  );
}
