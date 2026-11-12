import React, { useState, useEffect, useMemo } from "react";
import {
  Dataset,
  KleinbergBurstItem,
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
  Info,
  FileSpreadsheet,
  Award,
  Zap,
  Copy,
  Check,
  Database,
} from "lucide-react";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  datasets: Dataset[];
  activeDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
}

export function FrontierDetectionStudio({
  datasets = [],
  activeDatasetId,
  onSelectDataset,
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
  const [data, setData] = useState<FrontierDetectionCombinedOutput | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<
    "bursts" | "sleeping_beauties" | "synthesis"
  >("bursts");

  // Kleinberg Parameters
  const [gamma, setGamma] = useState<number>(1.0);
  const [sParam, setSParam] = useState<number>(2.0);
  const [minFreq] = useState<number>(2);
  const [burstFilter, setBurstFilter] = useState<"all" | "hot" | "multi_year">(
    "all"
  );
  const [searchBurst, setSearchBurst] = useState<string>("");
  const [selectedBurst, setSelectedBurst] = useState<KleinbergBurstItem | null>(
    null
  );

  // Sleeping Beauties Parameters
  const [minSleepYears, setMinSleepYears] = useState<number>(3);
  const [beautyThreshold, setBeautyThreshold] = useState<number>(1.5);
  const [searchBeauty, setSearchBeauty] = useState<string>("");
  const [selectedBeauty, setSelectedBeauty] =
    useState<SleepingBeautyItem | null>(null);

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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load frontier detection analysis"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDsId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Bursts
  const filteredBursts = useMemo(() => {
    if (!data) return [];
    return data.burstDetection.bursts.filter((b) => {
      const matchesSearch = b.word
        .toLowerCase()
        .includes(searchBurst.toLowerCase().trim());
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

  const timeSpan = useMemo(() => {
    if (!data)
      return {
        min: 2018,
        max: 2024,
        years: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
      };
    const min = data.burstDetection.time_span.min_year;
    const max = data.burstDetection.time_span.max_year;
    const years: number[] = [];
    for (let y = min; y <= max; y++) {
      years.push(y);
    }
    return { min, max, years };
  }, [data]);

  const handleExportBurstsCSV = () => {
    if (!data || data.burstDetection.bursts.length === 0) return;
    const headers = [
      "Keyword / Term",
      "Burst Weight",
      "Level",
      "Begin Year",
      "End Year",
      "Duration (Years)",
      "Total Occurrences",
      "Is Hot Frontier",
    ];
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
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kleinberg_bursts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
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
      <div className="space-y-5 border-b border-border-default pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sciai-kicker whitespace-nowrap text-status-warning-text!">
              Scientometrics Lab • Module 2
            </span>
            <span className="whitespace-nowrap rounded-md border border-status-warning-border bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">
              Dynamics &amp; Frontier Detection
            </span>
            <span className="whitespace-nowrap rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger-text">
              Kleinberg (2003) &amp; van Raan (2004) / Ke et al. (2015)
            </span>
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
            <Flame className="h-7 w-7 shrink-0 text-status-danger-text sm:h-8 sm:w-8" />
            <span className="min-w-0">
              Topic Dynamics &amp; Emerging Frontier Detection
            </span>
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Uncover sudden keyword surges (Kleinberg&apos;s Burst Detection) to
            pinpoint active research frontiers and identify Sleeping Beauties in
            science using the parameter-free beauty coefficient (Ke et al.,
            PNAS) and van Raan&apos;s formulation.
          </p>
        </div>

        {/* Dataset Selector & Action Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {datasets.length > 0 && (
            <div className="flex min-w-0 flex-col">
              <label
                htmlFor="frontier-dataset-select"
                className="flex items-center gap-1 text-xs font-semibold text-ink-secondary"
              >
                <Database className="h-3 w-3 shrink-0 text-brand-500" />
                Target Dataset
              </label>
              <select
                id="frontier-dataset-select"
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
              onClick={fetchData}
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

            {activeTab === "bursts" ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleExportBurstsCSV}
                disabled={!data || data.burstDetection.bursts.length === 0}
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              >
                Export Bursts CSV
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleExportSleepingBeautiesCSV}
                disabled={
                  !data || data.sleepingBeauties.beauties.length === 0
                }
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              >
                Export Sleeping Beauties CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Card 1: Top Hot Frontier */}
          <div className="rounded-2xl border border-status-danger-border bg-gradient-to-br from-status-danger-bg/60 to-surface-canvas p-4 shadow-card">
            <div className="flex items-center justify-between text-status-danger-text">
              <span className="sciai-kicker text-status-danger-text!">
                Top Emerging Frontier
              </span>
              <Flame className="h-4 w-4" />
            </div>
            <div className="mt-2 truncate text-xl font-black text-ink-primary">
              {data.summary.topEmergingFrontier}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-status-danger-text">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-status-danger-text" />
              <span>Active Hot Research Front</span>
            </div>
          </div>

          {/* Card 2: Total Kleinberg Bursts */}
          <Card padding="sm">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="sciai-kicker">Kleinberg Bursts</span>
              <TrendingUp className="h-4 w-4 text-status-danger-text" />
            </div>
            <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
              {data.burstDetection.total_bursts}
            </div>
            <div className="tabular-metrics mt-1 text-[11px] font-medium text-ink-muted">
              {data.burstDetection.hot_frontiers_count} Active Hot Frontiers
            </div>
          </Card>

          {/* Card 3: Sleeping Beauties Detected */}
          <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 to-surface-canvas p-4 shadow-card">
            <div className="flex items-center justify-between text-brand-500">
              <span className="sciai-kicker text-brand-700!">
                Sleeping Beauties
              </span>
              <Moon className="h-4 w-4" />
            </div>
            <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
              {data.sleepingBeauties.total_sleeping_beauties}
            </div>
            <div className="tabular-metrics mt-1 text-[11px] font-medium text-brand-700">
              Min. Sleep: {data.sleepingBeauties.min_sleep_years} yrs with sharp
              awakening
            </div>
          </div>

          {/* Card 4: Highest Beauty Coefficient */}
          <div className="rounded-2xl border border-status-warning-border bg-gradient-to-br from-status-warning-bg/60 to-surface-canvas p-4 shadow-card">
            <div className="flex items-center justify-between text-status-warning-text">
              <span className="sciai-kicker text-status-warning-text!">
                Max Beauty Coeff (B)
              </span>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
              {data.summary.highestBeautyCoefficient.toFixed(1)}
            </div>
            <div
              className="mt-1 truncate text-[11px] font-medium text-status-warning-text"
              title={data.summary.mostIconicSleepingBeauty}
            >
              {data.summary.mostIconicSleepingBeauty}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-default bg-surface-subtle p-1 shadow-card">
        <button
          type="button"
          onClick={() => setActiveTab("bursts")}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === "bursts"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>1. Kleinberg&apos;s Burst Detection</span>
          {data && (
            <span
              className={`tabular-metrics rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "bursts"
                  ? "bg-white/20 text-white"
                  : "bg-surface-muted text-ink-secondary"
              }`}
            >
              {data.burstDetection.total_bursts}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sleeping_beauties")}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === "sleeping_beauties"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
          }`}
        >
          <Moon className="h-4 w-4" />
          <span>2. Sleeping Beauties in Science</span>
          {data && (
            <span
              className={`tabular-metrics rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "sleeping_beauties"
                  ? "bg-white/20 text-white"
                  : "bg-surface-muted text-ink-secondary"
              }`}
            >
              {data.sleepingBeauties.total_sleeping_beauties}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("synthesis")}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === "synthesis"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>3. Strategic Frontier Synthesis</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <Card padding="lg" className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-500" />
          <p className="mt-4 text-sm font-bold text-ink-primary">
            Executing Kleinberg burst modeling &amp; computing beauty
            coefficients...
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Hidden Markov Model (HMM) and Viterbi decoding streaming occurrence
            intervals
          </p>
        </Card>
      )}

      {error && (
        <AlertBanner tone="danger">Computation error: {error}</AlertBanner>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 1: KLEINBERG'S BURST DETECTION                                 */}
      {/* ===================================================================== */}
      {data && activeTab === "bursts" && (
        <div className="space-y-6">
          {/* Methodological Context Box */}
          <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/70 via-surface-canvas to-surface-subtle p-4 text-xs leading-relaxed text-ink-secondary shadow-card">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-primary">
              <Info className="h-4 w-4 text-brand-500" />
              Methodological Foundations: Jon Kleinberg&apos;s Burst Detection
              (2002/2003)
            </div>
            This algorithm applies a 2-state or infinite-state Hidden Markov
            Model with Poisson or binomial emission probabilities, solving for
            the optimal state sequence via Viterbi decoding. It detects terms
            whose publication frequencies surge significantly above baseline
            expectations. Bursts active in the terminal observation years are
            categorized as{" "}
            <strong className="text-ink-primary">Hot Research Frontiers</strong>
            .
          </div>

          {/* Controls Bar */}
          <Card
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                <input
                  type="text"
                  value={searchBurst}
                  onChange={(e) => setSearchBurst(e.target.value)}
                  placeholder="Search keyword or term..."
                  className="w-full rounded-xl border border-border-default bg-surface-canvas py-1.5 pl-9 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Filter */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border-default bg-surface-subtle p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBurstFilter("all")}
                  className={`cursor-pointer rounded-lg px-3 py-1 transition-colors ${
                    burstFilter === "all"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  All Bursts ({data.burstDetection.bursts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBurstFilter("hot")}
                  className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 transition-colors ${
                    burstFilter === "hot"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <Flame
                    className={`h-3 w-3 ${
                      burstFilter === "hot"
                        ? "text-white"
                        : "text-status-danger-text"
                    }`}
                  />
                  Hot Frontiers ({data.burstDetection.hot_frontiers_count})
                </button>
                <button
                  type="button"
                  onClick={() => setBurstFilter("multi_year")}
                  className={`cursor-pointer rounded-lg px-3 py-1 transition-colors ${
                    burstFilter === "multi_year"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Multi-Year Bursts
                </button>
              </div>
            </div>

            {/* Sliders for Parameters */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-secondary">
              <div className="flex items-center gap-2">
                <span>Transition Cost (γ):</span>
                <span className="tabular-metrics rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono font-bold text-ink-primary">
                  {gamma}
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={gamma}
                  onChange={(e) => setGamma(parseFloat(e.target.value))}
                  onMouseUp={fetchData}
                  className="w-20 cursor-pointer accent-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Burst Scale (s):</span>
                <span className="tabular-metrics rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono font-bold text-ink-primary">
                  {sParam}
                </span>
                <input
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.5"
                  value={sParam}
                  onChange={(e) => setSParam(parseFloat(e.target.value))}
                  onMouseUp={fetchData}
                  className="w-20 cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </Card>

          {/* Burst Timeline Gantt Chart */}
          <Card padding="md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-ink-primary">
                  <Flame className="h-4 w-4 text-status-danger-text" />
                  Kleinberg Burst Timeline Visualization
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Horizontal interval representation of keyword surges (bars
                  indicate high publication intensity burst states)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="inline-block h-2 w-5 rounded-xs bg-surface-muted" />
                  Baseline Period
                </span>
                <span className="flex items-center gap-1.5 text-status-danger-text">
                  <span className="inline-block h-2 w-5 rounded-xs bg-status-danger-text shadow-xs" />
                  Active Burst Period
                </span>
                <span className="flex items-center gap-1.5 text-status-success-text">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-status-success-text" />
                  Current Hot Frontier
                </span>
              </div>
            </div>

            {/* Timeline View */}
            <div className="overflow-x-auto">
              <div className="min-w-[650px] space-y-2">
                {/* Year Header Axis */}
                <div className="grid grid-cols-12 gap-2 border-b border-border-subtle pb-2 text-[11px] font-black text-ink-subtle">
                  <div className="col-span-4 text-ink-secondary">
                    Keyword / Scholarly Term
                  </div>
                  <div className="col-span-1 text-center">Burst Weight</div>
                  <div className="col-span-7 flex justify-between px-2">
                    {timeSpan.years.map((y) => (
                      <span
                        key={y}
                        className="tabular-metrics w-8 text-center font-bold"
                      >
                        {y}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                {filteredBursts.slice(0, 15).map((burst) => {
                  const isSelected = selectedBurst?.id === burst.id;
                  const totalYears = timeSpan.max - timeSpan.min + 1;
                  const leftPercent = Math.max(
                    0,
                    ((burst.beginYear - timeSpan.min) / totalYears) * 100
                  );
                  const widthPercent = Math.min(
                    100 - leftPercent,
                    (burst.duration / totalYears) * 100
                  );

                  return (
                    <div
                      key={burst.id}
                      onClick={() => setSelectedBurst(burst)}
                      className={`grid cursor-pointer grid-cols-12 items-center gap-2 rounded-xl border p-2 transition-colors ${
                        isSelected
                          ? "border-brand-300 bg-brand-50/70"
                          : "border-transparent hover:bg-surface-subtle"
                      }`}
                    >
                      {/* Keyword Title & Badges */}
                      <div className="col-span-4 flex items-center gap-2 truncate">
                        <span
                          className="truncate text-xs font-bold text-ink-primary"
                          title={burst.word}
                        >
                          {burst.word}
                        </span>
                        {burst.isHotFrontier && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-status-danger-border bg-status-danger-bg px-1.5 py-0.2 text-[9px] font-black text-status-danger-text">
                            <Flame className="h-2.5 w-2.5" />
                            HOT
                          </span>
                        )}
                        <span className="tabular-metrics shrink-0 text-[10px] font-medium text-ink-subtle">
                          ({burst.beginYear} - {burst.endYear})
                        </span>
                      </div>

                      {/* Weight */}
                      <div className="col-span-1 text-center">
                        <span className="tabular-metrics inline-block rounded-md border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-black text-ink-primary">
                          {burst.weight.toFixed(1)}
                        </span>
                      </div>

                      {/* Timeline Bar Track */}
                      <div className="relative col-span-7 flex h-5 items-center overflow-hidden rounded-lg bg-surface-subtle px-1">
                        {timeSpan.years.map((y, idx) => (
                          <div
                            key={y}
                            className="absolute bottom-0 top-0 border-r border-border-subtle"
                            style={{ left: `${(idx / totalYears) * 100}%` }}
                          />
                        ))}

                        <div
                          className={`tabular-metrics absolute bottom-0.5 top-0.5 flex items-center justify-center rounded-md text-[9px] font-bold text-white shadow-xs transition-all ${
                            burst.isHotFrontier
                              ? "animate-pulse bg-status-danger-text"
                              : "bg-brand-500"
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
          </Card>

          {/* Selected Burst Detail Drawer / Panel */}
          {selectedBurst && (
            <Card padding="md" className="border-brand-200">
              <div className="flex flex-col justify-between gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="sciai-kicker text-[10px]! text-brand-500!">
                      Kleinberg Burst Details
                    </span>
                    {selectedBurst.isHotFrontier && (
                      <span className="rounded-md bg-status-danger-text px-2 py-0.5 text-[9px] font-bold text-white">
                        Top Active Research Front
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 flex items-center gap-2 text-xl font-black text-ink-primary">
                    “{selectedBurst.word}”
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-secondary">
                  <div>
                    <span className="block text-[10px] text-ink-subtle">
                      Burst Weight:
                    </span>
                    <span className="tabular-metrics text-sm font-black text-status-danger-text">
                      {selectedBurst.weight}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ink-subtle">
                      Burst Interval:
                    </span>
                    <span className="tabular-metrics text-sm font-black text-ink-primary">
                      {selectedBurst.beginYear} - {selectedBurst.endYear}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ink-subtle">
                      Duration:
                    </span>
                    <span className="tabular-metrics text-sm font-black text-ink-primary">
                      {selectedBurst.duration} yrs
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ink-subtle">
                      Total Corpus Mentions:
                    </span>
                    <span className="tabular-metrics text-sm font-black text-ink-primary">
                      {selectedBurst.totalOccurrences}
                    </span>
                  </div>
                </div>
              </div>

              {/* Annual Frequency Bars */}
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-bold text-ink-primary">
                  Annual Frequencies &amp; Markov State Transitions (States 0 →
                  1 → 2):
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {selectedBurst.yearlyFrequencies.map((yf) => (
                    <div
                      key={yf.year}
                      className={`rounded-xl border p-2.5 text-center transition-colors ${
                        yf.state >= 1
                          ? "border-status-danger-border bg-status-danger-bg/60"
                          : "border-border-default bg-surface-subtle"
                      }`}
                    >
                      <div className="tabular-metrics text-[10px] font-bold text-ink-muted">
                        {yf.year}
                      </div>
                      <div className="tabular-metrics mt-0.5 text-base font-black text-ink-primary">
                        {yf.count} docs
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span
                          className={`rounded-md px-1.5 py-0.2 text-[9px] font-black ${
                            yf.state >= 1
                              ? "bg-status-danger-text text-white"
                              : "bg-surface-muted text-ink-secondary"
                          }`}
                        >
                          {yf.state >= 1 ? `Burst L${yf.state}` : "Normal"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Full Burst Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink-primary">
                <Flame className="h-4 w-4 text-status-danger-text" />
                Burst Frontiers Leaderboard
              </h3>
              <span className="tabular-metrics text-[11px] font-semibold text-ink-muted">
                Showing {filteredBursts.length} identified bursts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Keyword / Concept</th>
                    <th className="px-4 py-3 text-center">Burst Weight</th>
                    <th className="px-4 py-3 text-center">Begin</th>
                    <th className="px-4 py-3 text-center">End</th>
                    <th className="px-4 py-3 text-center">Duration</th>
                    <th className="px-4 py-3 text-center">Frontier Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredBursts.map((b, index) => (
                    <tr
                      key={b.id}
                      className="cursor-pointer transition-colors hover:bg-surface-subtle/70"
                      onClick={() => setSelectedBurst(b)}
                    >
                      <td className="tabular-metrics px-4 py-3 font-bold text-ink-subtle">
                        {index + 1}
                      </td>
                      <td className="flex items-center gap-2 px-4 py-3 font-black text-ink-primary">
                        {b.word}
                        {b.isHotFrontier && (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-status-danger-text" />
                        )}
                      </td>
                      <td className="tabular-metrics px-4 py-3 text-center">
                        <span className="rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 font-mono font-black text-status-danger-text">
                          {b.weight.toFixed(2)}
                        </span>
                      </td>
                      <td className="tabular-metrics px-4 py-3 text-center font-semibold text-ink-secondary">
                        {b.beginYear}
                      </td>
                      <td className="tabular-metrics px-4 py-3 text-center font-semibold text-ink-secondary">
                        {b.endYear}
                      </td>
                      <td className="tabular-metrics px-4 py-3 text-center font-semibold text-ink-secondary">
                        {b.duration}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {b.isHotFrontier ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[10px] font-bold text-status-danger-text">
                            <Flame className="h-3 w-3" />
                            Hot Research Front
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                            Historical / Settled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(b.word, b.id);
                          }}
                          className="cursor-pointer rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary"
                          title="Copy keyword"
                        >
                          {copiedId === b.id ? (
                            <Check className="h-3.5 w-3.5 text-status-success-text" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: SLEEPING BEAUTIES IN SCIENCE                                */}
      {/* ===================================================================== */}
      {data && activeTab === "sleeping_beauties" && (
        <div className="space-y-6">
          {/* Methodological Context Box */}
          <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/70 via-surface-canvas to-surface-subtle p-4 text-xs leading-relaxed text-ink-secondary shadow-card">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-primary">
              <Info className="h-4 w-4 text-brand-500" />
              Quantifying Delayed Recognition &amp; Sleeping Beauties in Science
              (van Raan, 2004 &amp; Ke et al., PNAS 2015)
            </div>
            Sleeping Beauties (SBs) are seminal publications that experience
            years of citation latency with negligible attention (Sleep Duration),
            followed by a sudden awakening or citation surge catalyzed by an
            influential application paper (“Prince”), becoming central pillars
            of the scientific domain.
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-brand-200 bg-surface-canvas p-2.5 font-mono text-[11px] md:grid-cols-2">
              <div>
                <strong className="text-ink-primary">
                  van Raan Formulation (2004):
                </strong>
                <div className="mt-0.5 font-bold text-brand-600">
                  B_vanRaan = (c_awake × s) / (sleep_depth + 1)
                </div>
              </div>
              <div>
                <strong className="text-ink-primary">
                  Ke et al. Parameter-Free Formulation (PNAS 2015):
                </strong>
                <div className="mt-0.5 font-bold text-brand-700">
                  B = ∑ ( l_t - c_t ) / max(1, c_t)
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <Card
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-72">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                <input
                  type="text"
                  value={searchBeauty}
                  onChange={(e) => setSearchBeauty(e.target.value)}
                  placeholder="Search article title, author, journal..."
                  className="w-full rounded-xl border border-border-default bg-surface-canvas py-1.5 pl-9 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-secondary">
              <div className="flex items-center gap-2">
                <span>Min Sleep Duration (yrs):</span>
                <span className="tabular-metrics rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono font-bold text-ink-primary">
                  {minSleepYears}
                </span>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={minSleepYears}
                  onChange={(e) =>
                    setMinSleepYears(parseInt(e.target.value, 10))
                  }
                  onMouseUp={fetchData}
                  className="w-20 cursor-pointer accent-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Beauty Threshold (B):</span>
                <span className="tabular-metrics rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono font-bold text-ink-primary">
                  {beautyThreshold}
                </span>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.5"
                  value={beautyThreshold}
                  onChange={(e) =>
                    setBeautyThreshold(parseFloat(e.target.value))
                  }
                  onMouseUp={fetchData}
                  className="w-20 cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </Card>

          {/* Interactive Trajectory Visualization for Selected Sleeping Beauty */}
          {selectedBeauty && (
            <Card padding="md" className="space-y-4 border-brand-200">
              <div className="flex flex-col justify-between gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-start">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                      <Sparkles className="h-3 w-3" />
                      Selected Sleeping Beauty in Science
                    </span>
                    <span className="tabular-metrics text-[11px] font-medium text-ink-muted">
                      Published: {selectedBeauty.year} • Journal:{" "}
                      {selectedBeauty.source}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-black leading-snug text-ink-primary sm:text-lg">
                    {selectedBeauty.title}
                  </h3>
                  <div className="mt-1 text-xs font-medium text-ink-muted">
                    Authors: {selectedBeauty.authors.join(", ")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-brand-700">
                      Ke Beauty Coeff (B)
                    </span>
                    <span className="tabular-metrics text-xl font-black text-brand-900">
                      {selectedBeauty.keBeautyCoefficient.toFixed(1)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-status-info-border bg-status-info-bg p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-status-info-text">
                      van Raan Coeff (B)
                    </span>
                    <span className="tabular-metrics text-xl font-black text-ink-primary">
                      {selectedBeauty.vanRaanBeautyCoefficient.toFixed(1)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-status-warning-text">
                      Sleep Duration
                    </span>
                    <span className="tabular-metrics text-xl font-black text-ink-primary">
                      {selectedBeauty.sleepDuration} yrs
                    </span>
                  </div>
                  <div className="rounded-xl border border-status-success-border bg-status-success-bg p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-status-success-text">
                      Awakening Year
                    </span>
                    <span className="tabular-metrics text-xl font-black text-ink-primary">
                      {selectedBeauty.awakeningYear}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trajectory SVG Graph */}
              <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-ink-primary">
                    <TrendingUp className="h-4 w-4 text-brand-500" />
                    Ke et al. Reference Line vs. Historical Citation Trajectory
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span className="inline-block h-0.5 w-4 border-b-2 border-dashed border-ink-subtle" />
                      Direct Reference Line (l_t)
                    </span>
                    <span className="flex items-center gap-1.5 text-brand-600">
                      <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                      Annual Citations (c_t)
                    </span>
                    <span className="flex items-center gap-1.5 text-status-warning-text">
                      <span className="inline-block h-2 w-2 rounded-full bg-status-warning-text" />
                      Sleep Phase
                    </span>
                  </div>
                </div>

                {/* Trajectory Visualizer */}
                <div className="relative mt-2 h-48 w-full">
                  <svg
                    className="h-full w-full overflow-visible"
                    viewBox="0 0 600 160"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0"
                      y1="130"
                      x2="600"
                      y2="130"
                      stroke="#d8ddd8"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="70"
                      x2="600"
                      y2="70"
                      stroke="#e5e8e4"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                    <line
                      x1="0"
                      y1="10"
                      x2="600"
                      y2="10"
                      stroke="#e5e8e4"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />

                    {(() => {
                      const points = selectedBeauty.citationTrajectory;
                      if (points.length < 2) return null;
                      const maxVal = Math.max(
                        ...points.map((p) =>
                          Math.max(p.citations, p.referenceLineValue)
                        ),
                        10
                      );
                      const stepX = 600 / Math.max(1, points.length - 1);

                      const curvePoints = points.map((p, i) => {
                        const x = i * stepX;
                        const y = 130 - (p.citations / maxVal) * 115;
                        return `${x},${y}`;
                      });

                      const peakIdx = points.findIndex(
                        (p) => p.citations === selectedBeauty.peakCitations
                      );
                      const peakX =
                        (peakIdx >= 0 ? peakIdx : points.length - 1) * stepX;
                      const peakY =
                        130 - (selectedBeauty.peakCitations / maxVal) * 115;
                      const startY =
                        130 - (points[0].citations / maxVal) * 115;

                      return (
                        <g>
                          <line
                            x1="0"
                            y1={startY}
                            x2={peakX}
                            y2={peakY}
                            stroke="#828d98"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                          />

                          <polyline
                            fill="none"
                            stroke="#315C7C"
                            strokeWidth="3"
                            points={curvePoints.join(" ")}
                          />

                          {points.map((p, i) => {
                            const cx = i * stepX;
                            const cy = 130 - (p.citations / maxVal) * 115;
                            const isAwakening =
                              p.year === selectedBeauty.awakeningYear;
                            return (
                              <g key={p.year}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={isAwakening ? 6 : 4}
                                  fill={
                                    p.phase === "sleep" ? "#D97706" : "#315C7C"
                                  }
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                {isAwakening && (
                                  <text
                                    x={cx}
                                    y={cy - 12}
                                    textAnchor="middle"
                                    fill="#315C7C"
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
                <div className="tabular-metrics mt-2 flex justify-between px-1 text-[10px] font-bold text-ink-subtle">
                  {selectedBeauty.citationTrajectory.map((p) => (
                    <div key={p.year} className="text-center">
                      <span>{p.year}</span>
                      <span className="mt-0.5 block text-[9px] font-medium text-ink-secondary">
                        {p.citations} cites
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prince Catalyst Work Info Card */}
              {selectedBeauty.princeInfo && (
                <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                  <Award className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                  <div>
                    <div className="text-xs font-bold text-ink-primary">
                      Awakening Catalyst Paper (“Prince” Work):
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-brand-700">
                      {selectedBeauty.princeInfo.potentialPrinceWork}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-muted">
                      {selectedBeauty.princeInfo.awakeningContext}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Sleeping Beauties Leaderboard Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink-primary">
                <Moon className="h-4 w-4 text-brand-500" />
                Sleeping Beauties Leaderboard Ranked by Beauty Coefficient (B)
              </h3>
              <span className="tabular-metrics text-[11px] font-semibold text-ink-muted">
                {filteredBeauties.length} identified sleeping beauties
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Article Title &amp; Authors</th>
                    <th className="px-4 py-3 text-center">Publication Year</th>
                    <th className="px-4 py-3 text-center">Sleep Duration</th>
                    <th className="px-4 py-3 text-center">Awakening Year</th>
                    <th className="px-4 py-3 text-center">Ke Coeff (B)</th>
                    <th className="px-4 py-3 text-center">
                      van Raan Coeff (B)
                    </th>
                    <th className="px-4 py-3 text-center">Total Citations</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredBeauties.map((sb, index) => {
                    const isSelected = selectedBeauty?.id === sb.id;
                    return (
                      <tr
                        key={sb.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand-50/70"
                            : "hover:bg-surface-subtle/70"
                        }`}
                        onClick={() => setSelectedBeauty(sb)}
                      >
                        <td className="tabular-metrics px-4 py-3 font-bold text-ink-subtle">
                          {index + 1}
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <div
                            className="truncate font-bold text-ink-primary"
                            title={sb.title}
                          >
                            {sb.title}
                          </div>
                          <div className="truncate text-[11px] text-ink-muted">
                            {sb.authors[0]} et al. • {sb.source}
                          </div>
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center font-semibold text-ink-secondary">
                          {sb.year}
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center">
                          <span className="inline-block rounded-md border border-status-warning-border bg-status-warning-bg px-2 py-0.5 font-bold text-status-warning-text">
                            {sb.sleepDuration} yrs
                          </span>
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center font-bold text-brand-600">
                          {sb.awakeningYear}
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center">
                          <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono font-black text-brand-700">
                            {sb.keBeautyCoefficient.toFixed(1)}
                          </span>
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center">
                          <span className="font-mono font-bold text-status-info-text">
                            {sb.vanRaanBeautyCoefficient.toFixed(1)}
                          </span>
                        </td>
                        <td className="tabular-metrics px-4 py-3 text-center font-bold text-ink-primary">
                          {sb.totalCitations}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(sb.title, sb.id);
                            }}
                            className="cursor-pointer rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary"
                            title="Copy paper title"
                          >
                            {copiedId === sb.id ? (
                              <Check className="h-3.5 w-3.5 text-status-success-text" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
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

      {/* ===================================================================== */}
      {/* SUBTAB 3: STRATEGIC FRONTIER SYNTHESIS                                */}
      {/* ===================================================================== */}
      {data && activeTab === "synthesis" && (
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-ink-primary">
                  Strategic Frontier Synthesis &amp; Foresight
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Synthesizing Kleinberg bursts with delayed recognition
                  awakenings to forecast scholarly evolution waves
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                <span className="sciai-kicker mb-1 block text-[10px]! text-status-danger-text!">
                  Leading Emerging Frontier
                </span>
                <div className="text-sm font-bold text-ink-primary">
                  {data.summary.topEmergingFrontier}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Exhibiting the highest Kleinberg burst weight with
                  accelerated publication frequency in recent periods, serving as
                  an active epicenter of research attention.
                </p>
              </div>

              <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                <span className="sciai-kicker mb-1 block text-[10px]! text-brand-600!">
                  Most Iconic Sleeping Beauty
                </span>
                <div
                  className="truncate text-sm font-bold text-ink-primary"
                  title={data.summary.mostIconicSleepingBeauty}
                >
                  {data.summary.mostIconicSleepingBeauty}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Achieving a Ke beauty coefficient of{" "}
                  <span className="tabular-metrics font-semibold text-ink-primary">
                    {data.summary.highestBeautyCoefficient.toFixed(1)}
                  </span>
                  , transitioning from a protracted dormant phase to widespread
                  scientific citation.
                </p>
              </div>

              <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                <span className="sciai-kicker mb-1 block text-[10px]! text-status-success-text!">
                  Observed Temporal Horizon
                </span>
                <div className="tabular-metrics text-sm font-bold text-ink-primary">
                  Timespan: {data.summary.yearSpan}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Corpus evaluation across{" "}
                  <span className="tabular-metrics font-semibold text-ink-primary">
                    {data.summary.totalDocuments}
                  </span>{" "}
                  scholarly records indicating structured thematic drift toward
                  emerging burst concepts.
                </p>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-6 space-y-2 rounded-xl border border-status-warning-border bg-status-warning-bg/60 p-4 text-xs leading-relaxed text-ink-secondary">
              <div className="flex items-center gap-1.5 text-sm font-bold text-status-warning-text">
                <Sparkles className="h-4 w-4" />
                Scientometric Policy Guidance &amp; Strategic Recommendations:
              </div>
              <ul className="list-inside list-disc space-y-1 font-medium text-ink-secondary">
                <li>
                  Allocate targeted funding and grant calls to active Kleinberg
                  burst domains serving as prime candidates for breakthrough
                  research frontiers.
                </li>
                <li>
                  Monitor dormant publications (“Sleep Phase”) that begin
                  garnering cross-disciplinary citations as early precursors to
                  paradigm shifts.
                </li>
                <li>
                  Synthesize keyword burst dynamics with thematic evolution
                  Sankey diagrams to verify longitudinal stability across
                  foundational research clusters.
                </li>
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}