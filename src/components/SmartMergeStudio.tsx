import React, { useState, useEffect } from "react";
import { Dataset, SmartMergeSummary, DatabaseSource, DataHealthMetrics } from "../types.js";
import {
  Layers,
  GitMerge,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  Upload,
  Sparkles,
  AlertTriangle,
  Database,
  ArrowRight,
  TrendingDown,
  Activity,
  Sliders,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";

interface Props {
  datasets: Dataset[];
  onRefreshData: () => void;
  onOpenUpload: () => void;
}

export function SmartMergeStudio({ datasets = [], onRefreshData, onOpenUpload }: Props) {
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>(
    (datasets || []).map((d) => d.id)
  );
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.92);
  const [allowYearTolerance, setAllowYearTolerance] = useState<boolean>(true);
  const [customName, setCustomName] = useState<string>("");
  const [merging, setMerging] = useState<boolean>(false);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  const [summary, setSummary] = useState<SmartMergeSummary | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "audit" | "borderline" | "health" | "methodology">("overview");
  const [copiedMethodology, setCopiedMethodology] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Update selected datasets when datasets prop updates
  useEffect(() => {
    if (selectedDatasetIds.length === 0 && (datasets?.length || 0) > 0) {
      setSelectedDatasetIds((datasets || []).map((d) => d.id));
    }
  }, [datasets]);

  // Load latest merge if exists
  useEffect(() => {
    fetch("/api/datasets/merge/latest")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.final_unique_count) {
          setSummary(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleSelectAll = () => {
    if (selectedDatasetIds.length === datasets.length) {
      setSelectedDatasetIds([]);
    } else {
      setSelectedDatasetIds(datasets.map((d) => d.id));
    }
  };

  const handleToggleDataset = (id: string) => {
    setSelectedDatasetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteMerge = async () => {
    if (selectedDatasetIds.length === 0) {
      setErrorMsg("Please select at least one dataset to merge and harmonize.");
      return;
    }
    setErrorMsg("");
    setMerging(true);

    try {
      const data: any = await apiJson("/api/datasets/smart-merge", {
        dataset_ids: selectedDatasetIds,
        target_name: customName.trim() || undefined,
        similarity_threshold: similarityThreshold,
        allow_year_tolerance: allowYearTolerance,
      });

      if (data.summary) {
        setSummary(data.summary);
        onRefreshData();
      } else {
        setErrorMsg("Failed to execute smart merge.");
      }
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, "Network error connecting to backend merge pipeline."));
    } finally {
      setMerging(false);
    }
  };

  const handleLoadSampleCohort = async () => {
    setLoadingSample(true);
    setErrorMsg("");
    try {
      const data: any = await apiRequest("/api/datasets/load-sample-cohort", {
        method: "POST",
      });
      if (data.merge_summary) {
        setSummary(data.merge_summary);
        onRefreshData();
      } else {
        setErrorMsg("Failed to load sample cohort.");
      }
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, "Error communicating with server."));
    } finally {
      setLoadingSample(false);
    }
  };

  const handleCopyMethodology = () => {
    if (!summary?.methodology_narrative) return;
    navigator.clipboard.writeText(summary.methodology_narrative);
    setCopiedMethodology(true);
    setTimeout(() => setCopiedMethodology(false), 2500);
  };

  const supportedDatabases: Array<{ name: DatabaseSource; ext: string; color: string }> = [
    { name: "WoS", ext: ".txt / .ciw (Tagged)", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { name: "Scopus", ext: ".csv / .bib", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { name: "PubMed", ext: ".nbib / .txt (MEDLINE)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { name: "OpenAlex", ext: ".json / .csv", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { name: "Dimensions", ext: ".csv", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { name: "Lens", ext: ".csv", color: "bg-pink-50 text-pink-700 border-pink-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <Sparkles className="h-3 w-3" /> Phase 1 & 2 Engine
            </span>
            <span className="text-[10px] font-semibold text-slate-400">BiblioFusion Protocol</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Multi-Database Fusion & Smart Merge
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-3xl leading-relaxed">
            Ingest, normalize, and deduplicate scientific literature across 6 canonical citation databases: Web of Science, Scopus, PubMed, OpenAlex, Dimensions, and Lens.org. Features protective DOI conflict shielding, block-based Jaro-Winkler fuzzy matching, audit logs, and automated academic methodology narrative generation.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleCohort}
            disabled={loadingSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Database className="h-3.5 w-3.5 text-indigo-600" />
            {loadingSample ? "Ingesting 6 DBs..." : "Load 6-Database Sample Cohort"}
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Sources
          </button>
        </div>
      </div>

      {/* 6 Supported Databases Chips */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            6 Canonical Database Ingestion Parsers
          </span>
          <span className="text-[10px] text-slate-400">Auto-detected schema & field mapping</span>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {supportedDatabases.map((db) => (
            <div
              key={db.name}
              className={`rounded-xl border p-2.5 flex flex-col justify-between ${db.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">{db.name}</span>
                <CheckCircle2 className="h-3.5 w-3.5 opacity-70" />
              </div>
              <span className="mt-1 text-[10px] font-medium opacity-85 truncate">
                {db.ext}
              </span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Top Configuration & Control Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Select Datasets to Merge */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Select Source Corpora</h2>
              <p className="text-[10px] text-slate-400">Choose datasets to combine and deduplicate</p>
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              {selectedDatasetIds.length === datasets.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
            {datasets.map((d) => {
              const isChecked = selectedDatasetIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                    isChecked
                      ? "border-slate-950 bg-slate-50/70"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleDataset(d.id)}
                    className="mt-0.5 rounded text-slate-950 focus:ring-slate-950"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {d.name || "Untitled Dataset"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">{d.source || "Generic"}</span>
                      <span>•</span>
                      <span>{d.record_count || 0} records</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Merge Parameters */}
          <div className="mt-5 border-t border-slate-100 pt-4 space-y-3.5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Title Match Threshold</span>
                <span className="font-mono text-slate-900">{(similarityThreshold * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.80"
                max="0.99"
                step="0.01"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="mt-1.5 w-full accent-slate-950"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Jaro-Winkler string similarity cutoff for titles (Standard: 92%)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 bg-slate-50/50">
              <div>
                <div className="text-xs font-bold text-slate-800">±1 Year Tolerance</div>
                <div className="text-[10px] text-slate-500">Matches online-first preprints vs published issue</div>
              </div>
              <input
                type="checkbox"
                checked={allowYearTolerance}
                onChange={(e) => setAllowYearTolerance(e.target.checked)}
                className="rounded text-slate-950 focus:ring-slate-950"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>
                <strong>DOI Shield Active:</strong> Two documents possessing differing valid DOIs will never be merged.
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custom Output Corpus Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Master Consolidated Scientific Corpus"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-950"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={merging || selectedDatasetIds.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <GitMerge className="h-4 w-4" />
              {merging ? "Deduplicating & Harmonizing..." : "Execute Smart Merge"}
            </button>
          </div>
        </div>

        {/* Right 2 Columns: Merge Intelligence Dashboard */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-2">
          {summary ? (
            <div className="space-y-6">
              {/* Summary Metrics Bar */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Deduplication & Consolidation Analytics
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Raw Records</span>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {summary.total_raw_inputs}
                    </div>
                    <span className="text-[10px] text-slate-500">across {summary.databases_included?.length || 0} DBs</span>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-amber-700">Duplicates Found</span>
                    <div className="mt-1 text-xl font-black text-amber-800">
                      {summary.duplicates_resolved}
                    </div>
                    <span className="text-[10px] text-amber-600 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {summary.reduction_percentage}% reduction
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Clean Unique Corpus</span>
                    <div className="mt-1 text-xl font-black text-emerald-800">
                      {summary.final_unique_count}
                    </div>
                    <span className="text-[10px] text-emerald-600">consolidated canonical</span>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-indigo-700">Data Health Index</span>
                    <div className="mt-1 text-xl font-black text-indigo-800">
                      {summary.data_health.overall_score}%
                    </div>
                    <span className="text-[10px] text-indigo-600">3-Tier Weighted Score</span>
                  </div>
                </div>
              </div>

              {/* Subtabs for Deep Dive */}
              <div className="border-b border-slate-200">
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("overview")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer ${
                      activeSubTab === "overview"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Overlap & Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("audit")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === "audit"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>Audit Log</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px]">
                      {summary.audit_log?.length || 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("borderline")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === "borderline"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>Borderline Review</span>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px]">
                      {summary.borderline_queue?.length || 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("health")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer ${
                      activeSubTab === "health"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Data Health Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("methodology")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer text-indigo-600 ${
                      activeSubTab === "methodology"
                        ? "border-indigo-600 text-indigo-700 font-black"
                        : "border-transparent text-indigo-600 hover:text-indigo-800"
                    }`}
                  >
                    Methodology Narrative
                  </button>
                </div>
              </div>

              {/* Subtab Content: Overview */}
              {activeSubTab === "overview" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Database Contribution Breakdown</h3>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(summary.sources_breakdown).map(([db, rawCount]) => {
                        const count = Number(rawCount) || 0;
                        const pct = summary.total_raw_inputs > 0 ? Math.round((count / summary.total_raw_inputs) * 100) : 0;
                        return (
                          <div key={db} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">{db}</span>
                              <span className="text-[11px] font-mono text-slate-500">{count} papers ({pct}%)</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-slate-800 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-white">
                    <h3 className="text-xs font-bold text-slate-800">Cross-Database Indexing Overlap</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Quantifies the extent to which scientific publications are co-indexed across multiple systems.
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="text-xs font-bold text-slate-800">
                          {summary.overlap_breakdown.single_source_only}
                        </div>
                        <div className="text-[10px] text-slate-500">Single DB Only</div>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="text-xs font-bold text-slate-800">
                          {summary.overlap_breakdown.two_sources}
                        </div>
                        <div className="text-[10px] text-slate-500">Dual-Indexed (2 DBs)</div>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="text-xs font-bold text-slate-800">
                          {summary.overlap_breakdown.three_or_more_sources}
                        </div>
                        <div className="text-[10px] text-slate-500">Co-Indexed in 3+ DBs</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Content: Audit Log */}
              {activeSubTab === "audit" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Audit trail records all consolidated entries and match rationale</span>
                    <span>Total mergers: {summary.audit_log?.length || 0}</span>
                  </div>

                  {(summary.audit_log?.length || 0) === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No duplicates found among selected corpora.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {(summary.audit_log || []).map((entry, idx) => (
                        <div key={`${entry.canonical_id}-${idx}`} className="p-3 hover:bg-slate-50 transition text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900 leading-snug">
                              {entry.title}
                            </span>
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                entry.matched_rule === "EXACT_DOI"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : entry.matched_rule === "EXACT_PMID"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {entry.matched_rule} · {(entry.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>Merged sources:</span>
                            <div className="flex gap-1">
                              {(entry.contributing_databases || []).map((db) => (
                                <span key={db} className="rounded bg-slate-200 px-1 py-0.2 font-semibold text-slate-700">
                                  {db}
                                </span>
                              ))}
                            </div>
                            {entry.doi && <span className="truncate">DOI: {entry.doi}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab Content: Borderline Queue */}
              {activeSubTab === "borderline" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Borderline pairs with similarity between 78% and 91% that require researcher review:
                  </p>

                  {(summary.borderline_queue?.length || 0) === 0 ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6 text-center text-xs text-emerald-800 font-semibold">
                      ✓ No ambiguous borderline conflicts detected. All candidate pairs resolved with high confidence.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {(summary.borderline_queue || []).map((b) => (
                        <div key={b.id} className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-amber-800">
                              Candidate Match ({(b.similarity_score * 100).toFixed(1)}% Title Similarity)
                            </span>
                            <span className="text-[10px] text-slate-500">{b.reason}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Candidate A ({b.candidate_a.DB})</span>
                              <div className="font-bold text-slate-800 truncate">{b.candidate_a.TI}</div>
                              <div className="text-slate-500 text-[10px]">
                                {b.candidate_a.AU?.[0]} ({b.candidate_a.PY}) · {b.candidate_a.SO}
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Candidate B ({b.candidate_b.DB})</span>
                              <div className="font-bold text-slate-800 truncate">{b.candidate_b.TI}</div>
                              <div className="text-slate-500 text-[10px]">
                                {b.candidate_b.AU?.[0]} ({b.candidate_b.PY}) · {b.candidate_b.SO}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab Content: Data Health */}
              {activeSubTab === "health" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3 text-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Level 1 (Weight 3)</span>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {summary.data_health.level_1_score}%
                      </div>
                      <span className="text-[9px] text-slate-500">Author, Year, Source, Citations, References</span>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 text-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Level 2 (Weight 2)</span>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {summary.data_health.level_2_score}%
                      </div>
                      <span className="text-[9px] text-slate-500">Title, Keywords, Affiliations</span>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 text-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Level 3 (Weight 1)</span>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {summary.data_health.level_3_score}%
                      </div>
                      <span className="text-[9px] text-slate-500">Abstract, DOI, Categories</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2">Field-Level Completeness (%)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(summary.data_health.field_completeness).map(([field, rawPct]) => {
                        const pct = Number(rawPct) || 0;
                        return (
                          <div key={field} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                            <div className="flex justify-between text-[11px]">
                              <span className="capitalize font-medium text-slate-700">{field}</span>
                              <span className="font-bold text-slate-900">{pct}%</span>
                            </div>
                            <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct > 85 ? "bg-emerald-600" : pct > 50 ? "bg-amber-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Content: Methodology Narrative */}
              {activeSubTab === "methodology" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Academic Methodology Paragraph (Ready for Manuscript)
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Pre-formatted academic methodology section detailing cross-database search, normalization, and deduplication protocols.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyMethodology}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                    >
                      {copiedMethodology ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedMethodology ? "Copied to Clipboard!" : "Copy Narrative"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-serif leading-relaxed text-slate-800 select-text">
                    "{summary.methodology_narrative}"
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Compliant with PRISMA, standard scientometric reporting guidelines, and peer-reviewed bibliographic synthesis methodologies.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <GitMerge className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Ready to Harmonize Corpora</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select your source datasets and click <strong>"Execute Smart Merge"</strong>, or click <strong>"Load 6-Database Sample Cohort"</strong> to inspect multi-source deduplication instantly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
