import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dataset,
  KleinbergBurstOutput,
  KleinbergBurstItem,
  SleepingBeautyOutput,
  SleepingBeautyItem,
  FrontierDetectionCombinedOutput,
} from "../types.js";
import {
  Flame,
  Moon,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Search,
  Sliders,
  Filter,
  Download,
  Info,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowRight,
  Share2,
  Activity,
  FileSpreadsheet,
  Award,
  Zap,
  Clock,
  BookOpen,
  Copy,
  Check,
  Database,
} from "lucide-react";

interface Props {
  datasets: Dataset[];
  activeDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
}

export function FrontierDetectionStudio({
  datasets = [],
  activeDatasetId,
  onSelectDataset,
  onNavigateToThematic,
}: Props) {
  // Target Dataset State
  const [selectedDsId, setSelectedDsId] = useState<string>(
    activeDatasetId || (datasets[0]?.id ?? "")
  );

  // Synchronize when parent prop changes
  useEffect(() => {
    if (activeDatasetId && activeDatasetId !== selectedDsId) {
      setSelectedDsId(activeDatasetId);
    }
  }, [activeDatasetId]);

  const handleDatasetChange = (newDsId: string) => {
    setSelectedDsId(newDsId);
    if (onSelectDataset && newDsId) {
      onSelectDataset(newDsId);
    }
  };

  // Main Data States
  const [data, setData] = useState<FrontierDetectionCombinedOutput | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<"bursts" | "sleeping_beauties" | "synthesis">("bursts");

  // Kleinberg Parameters
  const [gamma, setGamma] = useState<number>(1.0);
  const [sParam, setSParam] = useState<number>(2.0);
  const [minFreq, setMinFreq] = useState<number>(2);
  const [burstFilter, setBurstFilter] = useState<"all" | "hot" | "multi_year">("all");
  const [searchBurst, setSearchBurst] = useState<string>("");
  const [selectedBurst, setSelectedBurst] = useState<KleinbergBurstItem | null>(null);

  // Sleeping Beauties Parameters
  const [minSleepYears, setMinSleepYears] = useState<number>(3);
  const [beautyThreshold, setBeautyThreshold] = useState<number>(1.5);
  const [searchBeauty, setSearchBeauty] = useState<string>("");
  const [selectedBeauty, setSelectedBeauty] = useState<SleepingBeautyItem | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Frontier Detection Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/frontier/combined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDsId || activeDatasetId,
          gamma,
          s: sParam,
          minFrequency: minFreq,
          minSleepYears,
          beautyThreshold,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const result: FrontierDetectionCombinedOutput = await res.json();
      setData(result);

      if (result.burstDetection.bursts.length > 0 && !selectedBurst) {
        setSelectedBurst(result.burstDetection.bursts[0]);
      }
      if (result.sleepingBeauties.beauties.length > 0 && !selectedBeauty) {
        setSelectedBeauty(result.sleepingBeauties.beauties[0]);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch frontier detection data:", err);
      setError(err instanceof Error ? err.message : "Failed to load frontier detection analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDsId]);

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Bursts
  const filteredBursts = useMemo(() => {
    if (!data) return [];
    return data.burstDetection.bursts.filter((b) => {
      const matchesSearch = b.word.toLowerCase().includes(searchBurst.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (burstFilter === "hot") return b.isHotFrontier;
      if (burstFilter === "multi_year") return b.duration > 1;
      return true;
    });
  }, [data, searchBurst, burstFilter]);

  // Filtered Sleeping Beauties
  const filteredBeauties = useMemo(() => {
    if (!data) return [];
    return data.sleepingBeauties.beauties.filter((sb) => {
      const term = searchBeauty.toLowerCase().trim();
      if (!term) return true;
      return (
        sb.title.toLowerCase().includes(term) ||
        sb.authors.some((a) => a.toLowerCase().includes(term)) ||
        sb.source.toLowerCase().includes(term)
      );
    });
  }, [data, searchBeauty]);

  // Year timeline for Kleinberg timeline chart
  const timeSpan = useMemo(() => {
    if (!data) return { min: 2018, max: 2024, years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] };
    const min = data.burstDetection.time_span.min_year;
    const max = data.burstDetection.time_span.max_year;
    const years: number[] = [];
    for (let y = min; y <= max; y++) {
      years.push(y);
    }
    return { min, max, years };
  }, [data]);

  // Export CSV for Bursts
  const handleExportBurstsCSV = () => {
    if (!data || data.burstDetection.bursts.length === 0) return;
    const headers = ["Keyword / Term", "Burst Weight", "Level", "Begin Year", "End Year", "Duration (Years)", "Total Occurrences", "Is Hot Frontier"];
    const rows = data.burstDetection.bursts.map((b) => [
      `"${b.word.replace(/"/g, '""')}"`,
      b.weight,
      b.level,
      b.beginYear,
      b.endYear,
      b.duration,
      b.totalOccurrences,
      b.isHotFrontier ? "YES" : "NO",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kleinberg_bursts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV for Sleeping Beauties
  const handleExportSleepingBeautiesCSV = () => {
    if (!data || data.sleepingBeauties.beauties.length === 0) return;
    const headers = [
      "Title",
      "Authors",
      "Publication Year",
      "Source",
      "Total Citations",
      "Sleep Duration (Years)",
      "Awakening Year",
      "Sleep Depth",
      "Awakening Intensity",
      "Ke et al. Beauty Coefficient (B)",
      "van Raan Beauty Coefficient (B)",
      "Peak Year",
      "Peak Citations",
      "Prince Catalyst Work",
    ];
    const rows = data.sleepingBeauties.beauties.map((b) => [
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.authors.join("; ").replace(/"/g, '""')}"`,
      b.year,
      `"${b.source.replace(/"/g, '""')}"`,
      b.totalCitations,
      b.sleepDuration,
      b.awakeningYear,
      b.sleepDepth,
      b.awakeningIntensity,
      b.keBeautyCoefficient,
      b.vanRaanBeautyCoefficient,
      b.peakYear,
      b.peakCitations,
      `"${(b.princeInfo?.potentialPrinceWork || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sleeping_beauties_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="space-y-5 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600 whitespace-nowrap">
              Scientometrics Lab • Module 2
            </span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 whitespace-nowrap">
              Dynamics & Frontier Detection
            </span>
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 whitespace-nowrap">
              Kleinberg (2003) & van Raan (2004) / Ke et al. (2015)
            </span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            <Flame className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-rose-600" />
            <span className="min-w-0">Topic Dynamics &amp; Emerging Frontier Detection</span>
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
            Uncover sudden keyword surges (Kleinberg&apos;s Burst Detection) to pinpoint active research frontiers and identify Sleeping Beauties in science using the parameter-free beauty coefficient (Ke et al., PNAS) and van Raan&apos;s formulation.
          </p>
        </div>

        {/* Dataset Selector & Action Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Target Dataset Selector matching HistoricalGenealogyStudio */}
          {datasets.length > 0 && (
            <div className="flex min-w-0 flex-col">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Database className="h-3 w-3 shrink-0 text-rose-600" />
                Target Dataset
              </label>
              <select
                id="frontier-dataset-select"
                className="mt-1 block w-full min-w-0 max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 sm:w-80"
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
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-rose-600" : ""}`} />
              <span>Recalculate</span>
            </button>

            {activeTab === "bursts" ? (
              <button
                type="button"
                onClick={handleExportBurstsCSV}
                disabled={!data || data.burstDetection.bursts.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Bursts CSV</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportSleepingBeautiesCSV}
                disabled={!data || data.sleepingBeauties.beauties.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Sleeping Beauties CSV</span>
              </button>
            )}

            
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Top Hot Frontier */}
          <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/50 to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[11px] font-bold uppercase tracking-wider">Top Emerging Frontier</span>
              <Flame className="h-4 w-4" />
            </div>
            <div className="mt-2 text-xl font-black text-slate-900 truncate">
              {data.summary.topEmergingFrontier}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>Active Hot Research Front</span>
            </div>
          </div>

          {/* Card 2: Total Kleinberg Bursts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Kleinberg Bursts</span>
              <TrendingUp className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {data.burstDetection.total_bursts}
            </div>
            <div className="mt-1 text-[11px] font-medium text-slate-500">
              {data.burstDetection.hot_frontiers_count} Active Hot Frontiers
            </div>
          </div>

          {/* Card 3: Sleeping Beauties Detected */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sleeping Beauties</span>
              <Moon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {data.sleepingBeauties.total_sleeping_beauties}
            </div>
            <div className="mt-1 text-[11px] font-medium text-indigo-700">
              Min. Sleep: {data.sleepingBeauties.min_sleep_years} yrs with sharp awakening
            </div>
          </div>

          {/* Card 4: Highest Beauty Coefficient */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[11px] font-bold uppercase tracking-wider">Max Beauty Coeff (B)</span>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {data.summary.highestBeautyCoefficient.toFixed(1)}
            </div>
            <div className="mt-1 text-[11px] font-medium text-amber-800 truncate" title={data.summary.mostIconicSleepingBeauty}>
              {data.summary.mostIconicSleepingBeauty}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("bursts")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "bursts"
              ? "bg-rose-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>1. Kleinberg&apos;s Burst Detection</span>
          {data && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === "bursts" ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-700"}`}>
              {data.burstDetection.total_bursts}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sleeping_beauties")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "sleeping_beauties"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Moon className="h-4 w-4" />
          <span>2. Sleeping Beauties in Science</span>
          {data && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === "sleeping_beauties" ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-700"}`}>
              {data.sleepingBeauties.total_sleeping_beauties}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("synthesis")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "synthesis"
              ? "bg-slate-950 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Zap className="h-4 w-4 text-amber-400" />
          <span>3. Strategic Frontier Synthesis</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-slate-200 bg-white">
          <RefreshCw className="h-8 w-8 animate-spin text-rose-600" />
          <p className="mt-4 text-sm font-bold text-slate-700">Executing Kleinberg burst modeling & computing beauty coefficients...</p>
          <p className="text-xs text-slate-400 mt-1">Hidden Markov Model (HMM) and Viterbi decoding streaming occurrence intervals</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          Computation error: {error}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: KLEINBERG'S BURST DETECTION                                    */}
      {/* ========================================================================= */}
      {data && activeTab === "bursts" && (
        <div className="space-y-6">
          {/* Methodological Context Box */}
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50/60 via-white to-amber-50/40 p-4 text-xs text-slate-600 leading-relaxed shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-rose-900 mb-1 text-sm">
              <Info className="h-4 w-4 text-rose-600" />
              Methodological Foundations: Jon Kleinberg&apos;s Burst Detection (2002/2003)
            </div>
            This algorithm applies a 2-state or infinite-state Hidden Markov Model with Poisson or binomial emission probabilities, solving for the optimal state sequence via Viterbi decoding. It detects terms whose publication frequencies surge significantly above baseline expectations. Bursts active in the terminal observation years are categorized as <strong>Hot Research Frontiers</strong>.
          </div>

          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchBurst}
                  onChange={(e) => setSearchBurst(e.target.value)}
                  placeholder="Search keyword or term..."
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBurstFilter("all")}
                  className={`px-3 py-1 rounded-lg transition ${
                    burstFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Bursts ({data.burstDetection.bursts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBurstFilter("hot")}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                    burstFilter === "hot" ? "bg-white text-rose-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Flame className="h-3 w-3 text-rose-500" />
                  Hot Frontiers ({data.burstDetection.hot_frontiers_count})
                </button>
                <button
                  type="button"
                  onClick={() => setBurstFilter("multi_year")}
                  className={`px-3 py-1 rounded-lg transition ${
                    burstFilter === "multi_year" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Multi-Year Bursts
                </button>
              </div>
            </div>

            {/* Sliders for Parameters */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span>Transition Cost (γ):</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{gamma}</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={gamma}
                  onChange={(e) => setGamma(parseFloat(e.target.value))}
                  onMouseUp={fetchData}
                  className="w-20 accent-rose-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Burst Scale (s):</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{sParam}</span>
                <input
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.5"
                  value={sParam}
                  onChange={(e) => setSParam(parseFloat(e.target.value))}
                  onMouseUp={fetchData}
                  className="w-20 accent-rose-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Burst Timeline Gantt Chart (CiteSpace / Sci2 style) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-600" />
                  Kleinberg Burst Timeline Visualization
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Horizontal interval representation of keyword surges (red bars indicate high publication intensity burst states)
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-5 rounded-xs bg-slate-200 inline-block"></span>
                  Baseline Period
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="h-2 w-5 rounded-xs bg-rose-600 inline-block shadow-xs"></span>
                  Active Burst Period
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                  Current Hot Frontier
                </span>
              </div>
            </div>

            {/* Timeline View */}
            <div className="overflow-x-auto">
              <div className="min-w-[650px] space-y-2">
                {/* Year Header Axis */}
                <div className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-2 text-[11px] font-black text-slate-400">
                  <div className="col-span-4 text-slate-700">Keyword / Scholarly Term</div>
                  <div className="col-span-1 text-center">Burst Weight</div>
                  <div className="col-span-7 flex justify-between px-2">
                    {timeSpan.years.map((y) => (
                      <span key={y} className="text-center w-8 font-bold">{y}</span>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                {filteredBursts.slice(0, 15).map((burst) => {
                  const isSelected = selectedBurst?.id === burst.id;
                  const totalYears = timeSpan.max - timeSpan.min + 1;
                  const leftPercent = Math.max(0, ((burst.beginYear - timeSpan.min) / totalYears) * 100);
                  const widthPercent = Math.min(100 - leftPercent, (burst.duration / totalYears) * 100);

                  return (
                    <div
                      key={burst.id}
                      onClick={() => setSelectedBurst(burst)}
                      className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition cursor-pointer ${
                        isSelected
                          ? "bg-rose-50/80 border border-rose-200"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      {/* Keyword Title & Badges */}
                      <div className="col-span-4 flex items-center gap-2 truncate">
                        <span className="font-bold text-xs text-slate-900 truncate" title={burst.word}>
                          {burst.word}
                        </span>
                        {burst.isHotFrontier && (
                          <span className="rounded-md bg-rose-100 text-rose-700 px-1.5 py-0.2 text-[9px] font-black shrink-0 flex items-center gap-0.5">
                            <Flame className="h-2.5 w-2.5 text-rose-600" />
                            HOT
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          ({burst.beginYear} - {burst.endYear})
                        </span>
                      </div>

                      {/* Weight */}
                      <div className="col-span-1 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-black">
                          {burst.weight.toFixed(1)}
                        </span>
                      </div>

                      {/* Timeline Bar Track */}
                      <div className="col-span-7 relative h-5 bg-slate-100 rounded-lg overflow-hidden flex items-center px-1">
                        {/* Year grid dividers */}
                        {timeSpan.years.map((y, idx) => (
                          <div
                            key={y}
                            className="absolute top-0 bottom-0 border-r border-slate-200/50"
                            style={{ left: `${(idx / totalYears) * 100}%` }}
                          />
                        ))}

                        {/* Burst Block */}
                        <div
                          className={`absolute top-0.5 bottom-0.5 rounded-md shadow-xs transition-all flex items-center justify-center text-[9px] font-bold text-white ${
                            burst.isHotFrontier
                              ? "bg-gradient-to-r from-rose-500 via-rose-600 to-red-600 animate-pulse"
                              : "bg-rose-600"
                          }`}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${Math.max(4, widthPercent)}%`,
                          }}
                        >
                          {widthPercent > 12 && `${burst.weight.toFixed(1)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Burst Detail Drawer / Panel */}
          {selectedBurst && (
            <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Kleinberg Burst Details</span>
                    {selectedBurst.isHotFrontier && (
                      <span className="rounded-md bg-rose-600 text-white px-2 py-0.5 text-[9px] font-bold">
                        Top Active Research Front
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
                    &ldquo;{selectedBurst.word}&rdquo;
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Burst Weight:</span>
                    <span className="text-sm font-black text-rose-600">{selectedBurst.weight}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Burst Interval:</span>
                    <span className="text-sm font-black text-slate-800">{selectedBurst.beginYear} - {selectedBurst.endYear}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Duration:</span>
                    <span className="text-sm font-black text-slate-800">{selectedBurst.duration} yrs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Corpus Mentions:</span>
                    <span className="text-sm font-black text-slate-800">{selectedBurst.totalOccurrences}</span>
                  </div>
                </div>
              </div>

              {/* Annual Frequency Bars */}
              <div className="mt-4">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Annual Frequencies & Markov State Transitions (States 0 → 1 → 2):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {selectedBurst.yearlyFrequencies.map((yf) => (
                    <div
                      key={yf.year}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        yf.state >= 1
                          ? "bg-rose-50 border-rose-300 ring-1 ring-rose-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-500">{yf.year}</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">{yf.count} docs</div>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                            yf.state >= 1 ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {yf.state >= 1 ? `Burst L${yf.state}` : "Normal"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Full Burst Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Flame className="h-4 w-4 text-rose-600" />
                Burst Frontiers Leaderboard
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                Showing {filteredBursts.length} identified bursts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Keyword / Concept</th>
                    <th className="py-3 px-4 text-center">Burst Weight</th>
                    <th className="py-3 px-4 text-center">Begin</th>
                    <th className="py-3 px-4 text-center">End</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-center">Frontier Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBursts.map((b, index) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedBurst(b)}
                    >
                      <td className="py-3 px-4 font-bold text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                        {b.word}
                        {b.isHotFrontier && (
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          {b.weight.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{b.beginYear}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{b.endYear}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{b.duration}</td>
                      <td className="py-3 px-4 text-center">
                        {b.isHotFrontier ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            <Flame className="h-3 w-3 text-rose-600" />
                            Hot Research Front
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            Historical / Settled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(b.word, b.id);
                          }}
                          className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition"
                          title="Copy keyword"
                        >
                          {copiedId === b.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: SLEEPING BEAUTIES IN SCIENCE                                   */}
      {/* ========================================================================= */}
      {data && activeTab === "sleeping_beauties" && (
        <div className="space-y-6">
          {/* Methodological Context Box */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/40 p-4 text-xs text-slate-600 leading-relaxed shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1 text-sm">
              <Info className="h-4 w-4 text-indigo-600" />
              Quantifying Delayed Recognition &amp; Sleeping Beauties in Science (van Raan, 2004 &amp; Ke et al., PNAS 2015)
            </div>
            Sleeping Beauties (SBs) are seminal publications that experience years of citation latency with negligible attention (Sleep Duration), followed by a sudden awakening or citation surge catalyzed by an influential application paper (&ldquo;Prince&rdquo;), becoming central pillars of the scientific domain.
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-white/80 p-2.5 rounded-xl border border-indigo-100">
              <div>
                <strong>van Raan Formulation (2004):</strong>
                <div className="text-indigo-700 font-bold mt-0.5">B_vanRaan = (c_awake × s) / (sleep_depth + 1)</div>
              </div>
              <div>
                <strong>Ke et al. Parameter-Free Formulation (PNAS 2015):</strong>
                <div className="text-purple-700 font-bold mt-0.5">B = ∑ ( l_t - c_t ) / max(1, c_t)</div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchBeauty}
                  onChange={(e) => setSearchBeauty(e.target.value)}
                  placeholder="Search article title, author, journal..."
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span>Min Sleep Duration (yrs):</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{minSleepYears}</span>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={minSleepYears}
                  onChange={(e) => setMinSleepYears(parseInt(e.target.value, 10))}
                  onMouseUp={fetchData}
                  className="w-20 accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Beauty Threshold (B):</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{beautyThreshold}</span>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.5"
                  value={beautyThreshold}
                  onChange={(e) => setBeautyThreshold(parseFloat(e.target.value))}
                  onMouseUp={fetchData}
                  className="w-20 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Interactive Trajectory Visualization for Selected Sleeping Beauty */}
          {selectedBeauty && (
            <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-600" />
                      Selected Sleeping Beauty in Science
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Published: {selectedBeauty.year} • Journal: {selectedBeauty.source}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-snug">
                    {selectedBeauty.title}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 font-medium">
                    Authors: {selectedBeauty.authors.join(", ")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-center bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-700 block">Ke Beauty Coeff (B)</span>
                    <span className="text-xl font-black text-indigo-950">{selectedBeauty.keBeautyCoefficient.toFixed(1)}</span>
                  </div>
                  <div className="text-center bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-purple-700 block">van Raan Coeff (B)</span>
                    <span className="text-xl font-black text-purple-950">{selectedBeauty.vanRaanBeautyCoefficient.toFixed(1)}</span>
                  </div>
                  <div className="text-center bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 block">Sleep Duration</span>
                    <span className="text-xl font-black text-amber-950">{selectedBeauty.sleepDuration} yrs</span>
                  </div>
                  <div className="text-center bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 block">Awakening Year</span>
                    <span className="text-xl font-black text-emerald-950">{selectedBeauty.awakeningYear}</span>
                  </div>
                </div>
              </div>

              {/* Trajectory SVG Graph */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    Ke et al. Reference Line vs. Historical Citation Trajectory
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="h-0.5 w-4 border-b-2 border-dashed border-slate-400 inline-block"></span>
                      Direct Reference Line (l_t)
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-700">
                      <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block"></span>
                      Annual Citations (c_t)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block"></span>
                      Sleep Phase
                    </span>
                  </div>
                </div>

                {/* Trajectory Visualizer */}
                <div className="relative h-48 w-full mt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
                    {/* Background Grids */}
                    <line x1="0" y1="130" x2="600" y2="130" stroke="#e2e8f0" strokeWidth="1" />
                    <line x1="0" y1="70" x2="600" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="10" x2="600" y2="10" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />

                    {/* Area under line / Beauty integral representation */}
                    {(() => {
                      const points = selectedBeauty.citationTrajectory;
                      if (points.length < 2) return null;
                      const maxVal = Math.max(...points.map((p) => Math.max(p.citations, p.referenceLineValue)), 10);
                      const stepX = 600 / Math.max(1, points.length - 1);

                      // Build SVG path for citation curve
                      const curvePoints = points.map((p, i) => {
                        const x = i * stepX;
                        const y = 130 - (p.citations / maxVal) * 115;
                        return `${x},${y}`;
                      });

                      // Reference line connecting first to peak
                      const peakIdx = points.findIndex((p) => p.citations === selectedBeauty.peakCitations);
                      const peakX = (peakIdx >= 0 ? peakIdx : points.length - 1) * stepX;
                      const peakY = 130 - (selectedBeauty.peakCitations / maxVal) * 115;
                      const startY = 130 - (points[0].citations / maxVal) * 115;

                      return (
                        <g>
                          {/* Reference straight line */}
                          <line
                            x1="0"
                            y1={startY}
                            x2={peakX}
                            y2={peakY}
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                          />

                          {/* Actual Citation Curve */}
                          <polyline
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="3"
                            points={curvePoints.join(" ")}
                          />

                          {/* Data points */}
                          {points.map((p, i) => {
                            const cx = i * stepX;
                            const cy = 130 - (p.citations / maxVal) * 115;
                            const isAwakening = p.year === selectedBeauty.awakeningYear;
                            return (
                              <g key={p.year}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={isAwakening ? 6 : 4}
                                  fill={p.phase === "sleep" ? "#f59e0b" : "#4f46e5"}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                {isAwakening && (
                                  <text
                                    x={cx}
                                    y={cy - 12}
                                    textAnchor="middle"
                                    fill="#4f46e5"
                                    fontSize="10"
                                    fontWeight="bold"
                                  >
                                    Awakened ★
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                {/* Trajectory Year Labels */}
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                  {selectedBeauty.citationTrajectory.map((p) => (
                    <div key={p.year} className="text-center">
                      <span>{p.year}</span>
                      <span className="block text-[9px] font-medium text-slate-600 mt-0.5">
                        {p.citations} cites
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prince Catalyst Work Info Card */}
              {selectedBeauty.princeInfo && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 flex items-start gap-3">
                  <Award className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-indigo-900">
                      Awakening Catalyst Paper (&ldquo;Prince&rdquo; Work):
                    </div>
                    <div className="text-xs font-medium text-indigo-800 mt-0.5">
                      {selectedBeauty.princeInfo.potentialPrinceWork}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {selectedBeauty.princeInfo.awakeningContext}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sleeping Beauties Leaderboard Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-600" />
                Sleeping Beauties Leaderboard Ranked by Beauty Coefficient (B)
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                {filteredBeauties.length} identified sleeping beauties
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Article Title &amp; Authors</th>
                    <th className="py-3 px-4 text-center">Publication Year</th>
                    <th className="py-3 px-4 text-center">Sleep Duration</th>
                    <th className="py-3 px-4 text-center">Awakening Year</th>
                    <th className="py-3 px-4 text-center">Ke Coeff (B)</th>
                    <th className="py-3 px-4 text-center">van Raan Coeff (B)</th>
                    <th className="py-3 px-4 text-center">Total Citations</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBeauties.map((sb, index) => {
                    const isSelected = selectedBeauty?.id === sb.id;
                    return (
                      <tr
                        key={sb.id}
                        className={`transition cursor-pointer ${
                          isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedBeauty(sb)}
                      >
                        <td className="py-3 px-4 font-bold text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="font-bold text-slate-900 truncate" title={sb.title}>
                            {sb.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {sb.authors[0]} et al. • {sb.source}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{sb.year}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                            {sb.sleepDuration} yrs
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-700">{sb.awakeningYear}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            {sb.keBeautyCoefficient.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-purple-700">
                            {sb.vanRaanBeautyCoefficient.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{sb.totalCitations}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(sb.title, sb.id);
                            }}
                            className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition"
                            title="Copy paper title"
                          >
                            {copiedId === sb.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
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

      {/* ========================================================================= */}
      {/* SUBTAB 3: STRATEGIC FRONTIER SYNTHESIS                                   */}
      {/* ========================================================================= */}
      {data && activeTab === "synthesis" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-950 flex items-center justify-center text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Strategic Frontier Synthesis &amp; Foresight
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synthesizing Kleinberg bursts with delayed recognition awakenings to forecast scholarly evolution waves
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Insight 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
                  Leading Emerging Frontier
                </span>
                <div className="text-sm font-bold text-slate-900">
                  {data.summary.topEmergingFrontier}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Exhibiting the highest Kleinberg burst weight with accelerated publication frequency in recent periods, serving as an active epicenter of research attention.
                </p>
              </div>

              {/* Insight 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                  Most Iconic Sleeping Beauty
                </span>
                <div className="text-sm font-bold text-slate-900 truncate" title={data.summary.mostIconicSleepingBeauty}>
                  {data.summary.mostIconicSleepingBeauty}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Achieving a Ke beauty coefficient of {data.summary.highestBeautyCoefficient.toFixed(1)}, transitioning from a protracted dormant phase to widespread scientific citation.
                </p>
              </div>

              {/* Insight 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                  Observed Temporal Horizon
                </span>
                <div className="text-sm font-bold text-slate-900">
                  Timespan: {data.summary.yearSpan}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Corpus evaluation across {data.summary.totalDocuments} scholarly records indicating structured thematic drift toward emerging burst concepts.
                </p>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs text-slate-700 leading-relaxed space-y-2">
              <div className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Scientometric Policy Guidance &amp; Strategic Recommendations:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                <li>Allocate targeted funding and grant calls to active Kleinberg burst domains serving as prime candidates for breakthrough research frontiers.</li>
                <li>Monitor dormant publications (&ldquo;Sleep Phase&rdquo;) that begin garnering cross-disciplinary citations as early precursors to paradigm shifts.</li>
                <li>Synthesize keyword burst dynamics with thematic evolution Sankey diagrams to verify longitudinal stability across foundational research clusters.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
