import React, { useState, useEffect } from "react";
import { Dataset, SmartMergeSummary, DatabaseSource } from "../types.js";
import {
  GitMerge,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  datasets: Dataset[];
  onRefreshData: () => void;
}

export function SmartMergeStudio({ datasets = [], onRefreshData }: Props) {
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>(
    (datasets || []).map((d) => d.id)
  );
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.92);
  const [allowYearTolerance, setAllowYearTolerance] = useState<boolean>(true);
  const [customName, setCustomName] = useState<string>("");
  const [merging, setMerging] = useState<boolean>(false);
  const [summary, setSummary] = useState<SmartMergeSummary | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "audit" | "borderline" | "health" | "methodology"
  >("overview");
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

  const handleCopyMethodology = () => {
    if (!summary?.methodology_narrative) return;
    navigator.clipboard.writeText(summary.methodology_narrative);
    setCopiedMethodology(true);
    setTimeout(() => setCopiedMethodology(false), 2500);
  };

  const supportedDatabases: Array<{ name: DatabaseSource; ext: string; color: string }> = [
    {
      name: "WoS",
      ext: ".txt / .ciw (Tagged)",
      color: "bg-brand-50 text-brand-700 border-brand-200",
    },
    {
      name: "Scopus",
      ext: ".csv / .bib",
      color: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
    },
    {
      name: "PubMed",
      ext: ".nbib / .txt (MEDLINE)",
      color: "bg-status-success-bg text-status-success-text border-status-success-border",
    },
    {
      name: "OpenAlex",
      ext: ".json / .csv",
      color: "bg-status-info-bg text-status-info-text border-status-info-border",
    },
    {
      name: "Dimensions",
      ext: ".csv",
      color: "bg-surface-subtle text-ink-secondary border-border-default",
    },
    {
      name: "Lens",
      ext: ".csv",
      color: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
              <Sparkles className="h-3 w-3" /> Phase 1 & 2 Engine
            </span>
            <span className="sciai-kicker">BiblioFusion Protocol</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary">
            Multi-Database Fusion & Smart Merge
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Ingest, normalize, and deduplicate scientific literature across 6 canonical citation
            databases: Web of Science, Scopus, PubMed, OpenAlex, Dimensions, and Lens.org. Features
            protective DOI conflict shielding, block-based Jaro-Winkler fuzzy matching, audit logs,
            and automated academic methodology narrative generation.
          </p>
        </div>
      </div>

      {/* 6 Supported Databases Chips */}
      <Card padding="sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <span className="sciai-kicker">6 Canonical Database Ingestion Parsers</span>
          <span className="text-[10px] text-ink-subtle">Auto-detected schema & field mapping</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {supportedDatabases.map((db) => (
            <div
              key={db.name}
              className={`flex flex-col justify-between rounded-xl border p-2.5 ${db.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">{db.name}</span>
                <CheckCircle2 className="h-3.5 w-3.5 opacity-75" />
              </div>
              <span className="mt-1 truncate font-mono text-[10px] font-medium opacity-85">
                {db.ext}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {errorMsg && <AlertBanner tone="danger">{errorMsg}</AlertBanner>}

      {/* Top Configuration & Control Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Select Datasets to Merge */}
        <Card padding="md" className="lg:col-span-1">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Select Source Corpora</h2>
              <p className="text-[11px] text-ink-muted">Choose datasets to combine and deduplicate</p>
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="cursor-pointer text-[11px] font-bold text-brand-500 transition-colors hover:text-brand-700"
            >
              {selectedDatasetIds.length === datasets.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {datasets.map((d) => {
              const isChecked = selectedDatasetIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    isChecked
                      ? "border-brand-500 bg-brand-50/40"
                      : "border-border-default bg-surface-canvas hover:border-border-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleDataset(d.id)}
                    className="mt-0.5 rounded accent-brand-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-ink-primary">
                      {d.name || "Untitled Dataset"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-muted">
                      <span className="font-semibold text-ink-secondary">
                        {d.source || "Generic"}
                      </span>
                      <span>·</span>
                      <span className="tabular-metrics">{d.record_count || 0} records</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Merge Parameters */}
          <div className="mt-5 space-y-3.5 border-t border-border-subtle pt-4">
            <div>
              <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <span>Title Match Threshold</span>
                <span className="tabular-metrics font-mono text-ink-primary">
                  {(similarityThreshold * 100).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min="0.80"
                max="0.99"
                step="0.01"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="mt-1.5 w-full accent-brand-500"
              />
              <span className="mt-0.5 block text-[10px] text-ink-subtle">
                Jaro-Winkler string similarity cutoff for titles (Standard: 92%)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-subtle p-2.5">
              <div>
                <div className="text-xs font-bold text-ink-primary">±1 Year Tolerance</div>
                <div className="text-[10px] text-ink-muted">
                  Matches online-first preprints vs published issue
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowYearTolerance}
                onChange={(e) => setAllowYearTolerance(e.target.checked)}
                className="rounded accent-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-status-success-border bg-status-success-bg p-2.5 text-[11px] text-status-success-text">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                <strong>DOI Shield Active:</strong> Two documents possessing differing valid DOIs
                will never be merged.
              </span>
            </div>

            <div>
              <label className="sciai-kicker">Custom Output Corpus Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Master Consolidated Scientific Corpus"
                className="mt-1 w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
              />
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              loading={merging}
              disabled={merging || selectedDatasetIds.length === 0}
              onClick={handleExecuteMerge}
              icon={<GitMerge className="h-4 w-4" />}
              className="w-full"
            >
              {merging ? "Deduplicating & Harmonizing..." : "Execute Smart Merge"}
            </Button>
          </div>
        </Card>

        {/* Right 2 Columns: Merge Intelligence Dashboard */}
        <Card padding="lg" className="lg:col-span-2">
          {summary ? (
            <div className="space-y-6">
              {/* Summary Metrics Bar */}
              <div>
                <div className="sciai-kicker">Deduplication & Consolidation Analytics</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5">
                    <span className="sciai-kicker">Raw Records</span>
                    <div className="tabular-metrics mt-1 text-xl font-black text-ink-primary">
                      {summary.total_raw_inputs}
                    </div>
                    <span className="tabular-metrics text-[10px] text-ink-muted">
                      across {summary.databases_included?.length || 0} DBs
                    </span>
                  </div>

                  <div className="rounded-xl border border-status-warning-border bg-status-warning-bg/60 p-3.5">
                    <span className="sciai-kicker text-status-warning-text!">Duplicates Found</span>
                    <div className="tabular-metrics mt-1 text-xl font-black text-status-warning-text">
                      {summary.duplicates_resolved}
                    </div>
                    <span className="tabular-metrics flex items-center gap-1 text-[10px] text-status-warning-text">
                      <TrendingDown className="h-3 w-3" />
                      {summary.reduction_percentage}% reduction
                    </span>
                  </div>

                  <div className="rounded-xl border border-status-success-border bg-status-success-bg/60 p-3.5">
                    <span className="sciai-kicker text-status-success-text!">
                      Clean Unique Corpus
                    </span>
                    <div className="tabular-metrics mt-1 text-xl font-black text-status-success-text">
                      {summary.final_unique_count}
                    </div>
                    <span className="text-[10px] text-status-success-text">
                      consolidated canonical
                    </span>
                  </div>

                  <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                    <span className="sciai-kicker text-brand-700!">Data Health Index</span>
                    <div className="tabular-metrics mt-1 text-xl font-black text-brand-700">
                      {summary.data_health.overall_score}%
                    </div>
                    <span className="text-[10px] text-brand-600">3-Tier Weighted Score</span>
                  </div>
                </div>
              </div>

              {/* Subtabs for Deep Dive */}
              <div className="border-b border-border-default">
                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("overview")}
                    className={`cursor-pointer border-b-2 px-1 pb-2.5 transition-colors ${
                      activeSubTab === "overview"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Overlap & Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("audit")}
                    className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-1 pb-2.5 transition-colors ${
                      activeSubTab === "audit"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    <span>Audit Log</span>
                    <span className="tabular-metrics rounded-full border border-border-default bg-surface-subtle px-1.5 py-0.2 text-[10px] text-ink-secondary">
                      {summary.audit_log?.length || 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("borderline")}
                    className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-1 pb-2.5 transition-colors ${
                      activeSubTab === "borderline"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    <span>Borderline Review</span>
                    <span className="tabular-metrics rounded-full border border-status-warning-border bg-status-warning-bg px-1.5 py-0.2 text-[10px] text-status-warning-text">
                      {summary.borderline_queue?.length || 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("health")}
                    className={`cursor-pointer border-b-2 px-1 pb-2.5 transition-colors ${
                      activeSubTab === "health"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Data Health Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("methodology")}
                    className={`cursor-pointer border-b-2 px-1 pb-2.5 transition-colors ${
                      activeSubTab === "methodology"
                        ? "border-brand-500 font-black text-brand-700"
                        : "border-transparent text-brand-500 hover:text-brand-700"
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
                    <h3 className="text-xs font-bold text-ink-primary">
                      Database Contribution Breakdown
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {Object.entries(summary.sources_breakdown).map(([db, rawCount]) => {
                        const count = Number(rawCount) || 0;
                        const pct =
                          summary.total_raw_inputs > 0
                            ? Math.round((count / summary.total_raw_inputs) * 100)
                            : 0;
                        return (
                          <div
                            key={db}
                            className="rounded-xl border border-border-subtle bg-surface-subtle p-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-ink-primary">{db}</span>
                              <span className="tabular-metrics font-mono text-[11px] text-ink-muted">
                                {count} papers ({pct}%)
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-default bg-surface-canvas p-4">
                    <h3 className="text-xs font-bold text-ink-primary">
                      Cross-Database Indexing Overlap
                    </h3>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Quantifies the extent to which scientific publications are co-indexed across
                      multiple systems.
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2.5">
                        <div className="tabular-metrics text-sm font-black text-ink-primary">
                          {summary.overlap_breakdown.single_source_only}
                        </div>
                        <div className="text-[10px] text-ink-muted">Single DB Only</div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2.5">
                        <div className="tabular-metrics text-sm font-black text-ink-primary">
                          {summary.overlap_breakdown.two_sources}
                        </div>
                        <div className="text-[10px] text-ink-muted">Dual-Indexed (2 DBs)</div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2.5">
                        <div className="tabular-metrics text-sm font-black text-ink-primary">
                          {summary.overlap_breakdown.three_or_more_sources}
                        </div>
                        <div className="text-[10px] text-ink-muted">Co-Indexed in 3+ DBs</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Content: Audit Log */}
              {activeSubTab === "audit" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>Audit trail records all consolidated entries and match rationale</span>
                    <span className="tabular-metrics font-semibold">
                      Total mergers: {summary.audit_log?.length || 0}
                    </span>
                  </div>

                  {(summary.audit_log?.length || 0) === 0 ? (
                    <div className="py-8 text-center text-xs text-ink-subtle">
                      No duplicates found among selected corpora.
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-default">
                      {(summary.audit_log || []).map((entry, idx) => (
                        <div
                          key={`${entry.canonical_id}-${idx}`}
                          className="p-3 text-xs transition-colors hover:bg-surface-subtle/60"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold leading-snug text-ink-primary">
                              {entry.title}
                            </span>
                            <span
                              className={`tabular-metrics shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                                entry.matched_rule === "EXACT_DOI"
                                  ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                  : entry.matched_rule === "EXACT_PMID"
                                    ? "border-status-info-border bg-status-info-bg text-status-info-text"
                                    : "border-status-warning-border bg-status-warning-bg text-status-warning-text"
                              }`}
                            >
                              {entry.matched_rule} · {(entry.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
                            <span>Merged sources:</span>
                            <div className="flex gap-1">
                              {(entry.contributing_databases || []).map((db) => (
                                <span
                                  key={db}
                                  className="rounded border border-border-default bg-surface-subtle px-1.5 py-0.2 font-semibold text-ink-secondary"
                                >
                                  {db}
                                </span>
                              ))}
                            </div>
                            {entry.doi && (
                              <span className="truncate font-mono text-brand-500">
                                DOI: {entry.doi}
                              </span>
                            )}
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
                  <p className="text-xs text-ink-muted">
                    Borderline pairs with similarity between 78% and 91% that require researcher
                    review:
                  </p>

                  {(summary.borderline_queue?.length || 0) === 0 ? (
                    <AlertBanner tone="success">
                      ✓ No ambiguous borderline conflicts detected. All candidate pairs resolved
                      with high confidence.
                    </AlertBanner>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {(summary.borderline_queue || []).map((b) => (
                        <div
                          key={b.id}
                          className="space-y-2 rounded-xl border border-status-warning-border bg-status-warning-bg/50 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="tabular-metrics text-[10px] font-bold uppercase text-status-warning-text">
                              Candidate Match ({(b.similarity_score * 100).toFixed(1)}% Title
                              Similarity)
                            </span>
                            <span className="text-[10px] text-ink-muted">{b.reason}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                            <div className="rounded-lg border border-border-default bg-surface-canvas p-2.5">
                              <span className="sciai-kicker text-[9px]!">
                                Candidate A ({b.candidate_a.DB})
                              </span>
                              <div className="mt-0.5 truncate font-bold text-ink-primary">
                                {b.candidate_a.TI}
                              </div>
                              <div className="text-[10px] text-ink-muted">
                                {b.candidate_a.AU?.[0]} ({b.candidate_a.PY}) · {b.candidate_a.SO}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border-default bg-surface-canvas p-2.5">
                              <span className="sciai-kicker text-[9px]!">
                                Candidate B ({b.candidate_b.DB})
                              </span>
                              <div className="mt-0.5 truncate font-bold text-ink-primary">
                                {b.candidate_b.TI}
                              </div>
                              <div className="text-[10px] text-ink-muted">
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                      <span className="sciai-kicker">Level 1 (Weight 3)</span>
                      <div className="tabular-metrics mt-0.5 text-lg font-black text-ink-primary">
                        {summary.data_health.level_1_score}%
                      </div>
                      <span className="text-[10px] text-ink-muted">
                        Author, Year, Source, Citations, References
                      </span>
                    </div>

                    <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                      <span className="sciai-kicker">Level 2 (Weight 2)</span>
                      <div className="tabular-metrics mt-0.5 text-lg font-black text-ink-primary">
                        {summary.data_health.level_2_score}%
                      </div>
                      <span className="text-[10px] text-ink-muted">
                        Title, Keywords, Affiliations
                      </span>
                    </div>

                    <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                      <span className="sciai-kicker">Level 3 (Weight 1)</span>
                      <div className="tabular-metrics mt-0.5 text-lg font-black text-ink-primary">
                        {summary.data_health.level_3_score}%
                      </div>
                      <span className="text-[10px] text-ink-muted">
                        Abstract, DOI, Categories
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-bold text-ink-primary">
                      Field-Level Completeness (%)
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {Object.entries(summary.data_health.field_completeness).map(
                        ([field, rawPct]) => {
                          const pct = Number(rawPct) || 0;
                          return (
                            <div
                              key={field}
                              className="rounded-xl border border-border-subtle bg-surface-subtle p-2.5 text-xs"
                            >
                              <div className="flex justify-between text-[11px]">
                                <span className="font-medium capitalize text-ink-secondary">
                                  {field}
                                </span>
                                <span className="tabular-metrics font-bold text-ink-primary">
                                  {pct}%
                                </span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    pct > 85
                                      ? "bg-status-success-text"
                                      : pct > 50
                                        ? "bg-status-warning-text"
                                        : "bg-status-danger-text"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Content: Methodology Narrative */}
              {activeSubTab === "methodology" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-ink-primary">
                        Academic Methodology Paragraph (Ready for Manuscript)
                      </h3>
                      <p className="text-[11px] text-ink-muted">
                        Pre-formatted academic methodology section detailing cross-database search,
                        normalization, and deduplication protocols.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleCopyMethodology}
                      icon={
                        copiedMethodology ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      {copiedMethodology ? "Copied to Clipboard!" : "Copy Narrative"}
                    </Button>
                  </div>

                  <div className="select-text rounded-xl border border-border-default bg-surface-subtle p-4 font-serif text-xs leading-relaxed text-ink-primary">
                    "{summary.methodology_narrative}"
                  </div>

                  <div className="text-[11px] text-ink-subtle">
                    Compliant with PRISMA, standard scientometric reporting guidelines, and
                    peer-reviewed bibliographic synthesis methodologies.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-500">
                <GitMerge className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-ink-primary">Ready to Harmonize Corpora</h3>
              <p className="mx-auto max-w-sm text-xs text-ink-muted">
                Select your source datasets and click <strong>"Execute Smart Merge"</strong> to
                inspect multi-source deduplication.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}