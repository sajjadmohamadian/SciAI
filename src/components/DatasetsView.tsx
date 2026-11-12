import React, { useState, useEffect, useMemo } from "react";
import { Dataset, DatasetVersion, DataHealthMetrics, CanonicalDocument } from "../types.js";
import {
  AlertBanner,
  Button,
  Card,
  EmptyState,
  StatusBadge,
} from "./CommonUI.js";
import {
  Database,
  Plus,
  Activity,
  Copy,
  Check,
  Search,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { apiRequest, getApiErrorMessage } from "../utils/apiClient.js";

interface Props {
  datasets: Dataset[];
  onOpenUpload: () => void;
  onOpenDescriptive: (datasetId: string) => void;
  onDatasetDeleted?: (deletedDatasetIds: string[]) => void;
}

export function DatasetsView({
  datasets = [],
  onOpenUpload,
  onDatasetDeleted,
}: Props) {
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(
    datasets && datasets.length > 0 ? datasets[0] : null
  );
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"snapshots" | "health" | "methodology" | "records">(
    "snapshots"
  );

  // Health & Methodology state
  const [healthData, setHealthData] = useState<DataHealthMetrics | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [methodology, setMethodology] = useState<string>("");
  const [copiedMethodology, setCopiedMethodology] = useState(false);
  const [documents, setDocuments] = useState<CanonicalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [datasetSearch, setDatasetSearch] = useState("");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);

  // Filter datasets by name or source in real-time
  const filteredDatasets = useMemo(() => {
    if (!datasetSearch.trim()) return datasets;
    const q = datasetSearch.toLowerCase().trim();
    return datasets.filter((d) => {
      const name = (d.name || "").toLowerCase();
      const source = (d.source || "").toLowerCase();
      return name.includes(q) || source.includes(q);
    });
  }, [datasets, datasetSearch]);

  // Deletion modal state
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null);
  const [bulkDatasetsToDelete, setBulkDatasetsToDelete] = useState<Dataset[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const visibleIds = filteredDatasets.map((dataset) => dataset.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedDatasetIds.includes(id));

  useEffect(() => {
    const availableIds = new Set(datasets.map((dataset) => dataset.id));
    setSelectedDatasetIds((current) => current.filter((id) => availableIds.has(id)));
    setSelectedDataset((current) => {
      if (current && availableIds.has(current.id)) {
        return datasets.find((dataset) => dataset.id === current.id) || current;
      }
      return datasets[0] || null;
    });
  }, [datasets]);

  const toggleDatasetForDeletion = (id: string) => {
    setSelectedDatasetIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  };

  const toggleMatchingDatasets = () => {
    setSelectedDatasetIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    );
  };

  useEffect(() => {
    if (!selectedDataset) {
      setVersions([]);
      setLoadingVersions(false);
      setVersionError(null);
      setHealthData(null);
      setMethodology("");
      setDocuments([]);
      return;
    }

    setVersions([]);
    setLoadingVersions(true);
    setVersionError(null);
    setHealthData(null);
    setMethodology("");
    setDocuments([]);

    const controller = new AbortController();
    const currentDatasetId = selectedDataset.id;

    fetch(`/datasets/${selectedDataset.id}/versions`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load versions (status ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (currentDatasetId !== selectedDataset.id) return;
        setVersions(Array.isArray(data) ? data : []);
        setVersionError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (currentDatasetId !== selectedDataset.id) return;
        console.error("Fetch versions error:", err);
        setVersions([]);
        setVersionError(err instanceof Error ? err.message : "Failed to load versions");
      })
      .finally(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setLoadingVersions(false);
        }
      });

    setLoadingHealth(true);
    fetch(`/datasets/${selectedDataset.id}/health`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (currentDatasetId === selectedDataset.id) {
          setHealthData(data.health || null);
        }
      })
      .catch(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setHealthData(null);
        }
      })
      .finally(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setLoadingHealth(false);
        }
      });

    fetch(`/datasets/${selectedDataset.id}/methodology`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (currentDatasetId === selectedDataset.id) {
          setMethodology(data.methodology_narrative || "");
        }
      })
      .catch(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setMethodology("");
        }
      });

    setLoadingDocs(true);
    fetch(`/datasets/${selectedDataset.id}/documents?limit=50`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (currentDatasetId === selectedDataset.id) {
          setDocuments(data.documents || []);
        }
      })
      .catch(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setDocuments([]);
        }
      })
      .finally(() => {
        if (currentDatasetId === selectedDataset.id && !controller.signal.aborted) {
          setLoadingDocs(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedDataset]);

  const filteredDocs = (documents || []).filter((doc) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    const title = (doc.TI || doc.title || "").toLowerCase();
    const author = (
      Array.isArray(doc.AU)
        ? doc.AU.join(" ")
        : Array.isArray(doc.authors)
          ? doc.authors.join(" ")
          : ""
    ).toLowerCase();
    const doi = (doc.DOI || doc.doi || "").toLowerCase();
    return title.includes(term) || author.includes(term) || doi.includes(term);
  });

  const handleCopyMethodology = () => {
    if (!methodology) return;
    navigator.clipboard.writeText(methodology);
    setCopiedMethodology(true);
    setTimeout(() => setCopiedMethodology(false), 2000);
  };

  const handleConfirmDelete = async () => {
    const targets = bulkDatasetsToDelete || (datasetToDelete ? [datasetToDelete] : []);
    if (targets.length === 0 || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const deletedIds = targets.map((dataset) => dataset.id);
      if (bulkDatasetsToDelete) {
        await apiRequest("/api/datasets/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset_ids: deletedIds }),
        });
      } else {
        await apiRequest(`/api/datasets/${encodeURIComponent(deletedIds[0])}`, {
          method: "DELETE",
        });
      }

      setDatasetToDelete(null);
      setBulkDatasetsToDelete(null);
      setSelectedDatasetIds((current) => current.filter((id) => !deletedIds.includes(id)));
      if (selectedDataset && deletedIds.includes(selectedDataset.id)) {
        setSelectedDataset(datasets.find((dataset) => !deletedIds.includes(dataset.id)) || null);
      }
      onDatasetDeleted?.(deletedIds);
    } catch (err: unknown) {
      setDeleteError(getApiErrorMessage(err, "Error deleting datasets"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-primary">
            Dataset Repository
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Manage imported bibliographic datasets, inspect 3-tier data health, generate methodology
            narratives, and open the appropriate analysis studio.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onOpenUpload}
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          Upload Dataset
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Datasets list */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="sciai-kicker tabular-metrics">
              Imported Datasets ({filteredDatasets.length}
              {datasetSearch.trim() ? ` of ${datasets.length}` : ""})
            </div>
          </div>

          {/* Real-time Dataset Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              id="dataset-search-input"
              type="text"
              value={datasetSearch}
              onChange={(e) => setDatasetSearch(e.target.value)}
              placeholder="Search datasets by name or source..."
              className="w-full rounded-xl border border-border-default bg-surface-canvas py-2 pl-9 pr-8 text-xs text-ink-primary placeholder:text-ink-subtle shadow-card transition-colors focus:border-brand-500 focus:outline-none"
            />
            {datasetSearch && (
              <button
                type="button"
                id="clear-dataset-search-btn"
                onClick={() => setDatasetSearch("")}
                title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Bulk Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleMatchingDatasets}
              disabled={filteredDatasets.length === 0 || isDeleting}
              className="text-[11px] font-bold text-brand-500 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {allVisibleSelected ? "Deselect matching" : "Select all matching"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setBulkDatasetsToDelete(
                  datasets.filter((dataset) => selectedDatasetIds.includes(dataset.id))
                );
              }}
              disabled={selectedDatasetIds.length === 0 || isDeleting}
              className="inline-flex items-center gap-1 rounded-lg border border-status-danger-border bg-status-danger-bg px-2.5 py-1.5 text-[11px] font-bold text-status-danger-text transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected ({selectedDatasetIds.length})
            </button>
          </div>

          {filteredDatasets.length === 0 ? (
            <div
              id="dataset-search-empty-state"
              className="rounded-2xl border border-dashed border-border-default bg-surface-subtle p-6 text-center"
            >
              <Database className="mx-auto h-8 w-8 text-ink-subtle" />
              <p className="mt-2 text-xs font-semibold text-ink-primary">No matching datasets</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                No datasets match “{datasetSearch}”. Try searching another title or source.
              </p>
              <Button
                type="button"
                id="reset-dataset-search-btn"
                variant="secondary"
                size="sm"
                onClick={() => setDatasetSearch("")}
                className="mt-3"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div id="dataset-filtered-list" className="space-y-3">
              {filteredDatasets.map((d) => {
                const isSelected = selectedDataset?.id === d.id;
                return (
                  <div
                    key={d.id}
                    id={`dataset-item-${d.id}`}
                    onClick={() => setSelectedDataset(d)}
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition-colors ${
                      isSelected
                        ? "border-brand-500 bg-surface-canvas shadow-card ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold leading-snug text-ink-primary">
                        {d.name || "Untitled Dataset"}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={d.status || "available"} />
                        <label
                          onClick={(event) => event.stopPropagation()}
                          className="cursor-pointer rounded p-1"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDatasetIds.includes(d.id)}
                            onChange={() => toggleDatasetForDeletion(d.id)}
                            aria-label={`Select ${d.name || "Untitled Dataset"} for deletion`}
                            disabled={isDeleting}
                            className="h-4 w-4 cursor-pointer accent-brand-500"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-ink-subtle" />
                          {d.source || "Generic"}
                        </span>
                        <span>·</span>
                        <span className="tabular-metrics">{d.record_count || 0} records</span>
                      </div>

                      {/* Inline Delete Button */}
                      <button
                        type="button"
                        id={`delete-dataset-btn-${d.id}`}
                        title="Delete dataset"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setDatasetToDelete(d);
                        }}
                        className="rounded-lg p-1.5 text-ink-subtle opacity-0 transition-all hover:bg-status-danger-bg hover:text-status-danger-text group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Dataset detail and inspector */}
        <Card padding="lg" className="lg:col-span-2">
          {selectedDataset ? (
            <div>
              <div className="border-b border-border-subtle pb-4">
                <div className="sciai-kicker">Dataset Inspector</div>
                <h2 className="mt-1 text-xl font-black tracking-tight text-ink-primary">
                  {selectedDataset.name}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Source:{" "}
                  <span className="font-semibold text-ink-secondary">{selectedDataset.source}</span>{" "}
                  · Created:{" "}
                  {selectedDataset.created_at
                    ? new Date(selectedDataset.created_at).toLocaleDateString()
                    : "Recent"}{" "}
                  · Total Indexed:{" "}
                  <span className="tabular-metrics font-semibold text-ink-secondary">
                    {selectedDataset.record_count}
                  </span>{" "}
                  publications
                </p>
              </div>

              {/* Subtabs for Inspector */}
              <div className="mt-4 border-b border-border-default">
                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("snapshots")}
                    className={`border-b-2 px-1 pb-2.5 transition-colors cursor-pointer ${
                      activeTab === "snapshots"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Version History
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("health")}
                    className={`flex items-center gap-1.5 border-b-2 px-1 pb-2.5 transition-colors cursor-pointer ${
                      activeTab === "health"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>3-Tier Data Health</span>
                    {healthData && (
                      <span className="tabular-metrics rounded-full border border-status-success-border bg-status-success-bg px-1.5 py-0.2 text-[10px] text-status-success-text">
                        {healthData.overall_score}%
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("methodology")}
                    className={`border-b-2 px-1 pb-2.5 transition-colors cursor-pointer ${
                      activeTab === "methodology"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Methodology Narrative
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("records")}
                    className={`tabular-metrics border-b-2 px-1 pb-2.5 transition-colors cursor-pointer ${
                      activeTab === "records"
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Records ({documents.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: SNAPSHOTS */}
              {activeTab === "snapshots" && (
                <div className="mt-4">
                  {loadingVersions ? (
                    <div className="py-8 text-center text-xs text-ink-muted">
                      Loading versions...
                    </div>
                  ) : versionError ? (
                    <AlertBanner tone="danger" title="Failed to load snapshot versions">
                      {versionError}
                    </AlertBanner>
                  ) : versions.length === 0 ? (
                    <EmptyState
                      title="No versions found"
                      description="No snapshot versions recorded for this dataset."
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="divide-y divide-border-subtle rounded-xl border border-border-default">
                        {versions.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-4 transition-colors hover:bg-surface-subtle/60"
                          >
                            <div className="flex items-center gap-3">
                              <div className="tabular-metrics flex h-9 w-9 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold text-brand-600">
                                v{v.version}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-ink-primary">
                                  Version {v.version} Snapshot
                                </div>
                                <div className="font-mono text-[11px] text-ink-muted">
                                  ID: {v.id} · {v.record_count} documents parsed
                                  {v.metadata?.detected_format &&
                                    ` · Format: ${v.metadata.detected_format}`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <StatusBadge status={v.status || "ready"} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-border-default bg-surface-subtle p-4">
                        <div className="text-xs font-bold text-ink-primary">
                          Ready for Scientometric Intelligence
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                          This dataset is indexed and ready for publication year distributions,
                          author productivity curves (Lotka), citation dispersion, Bradford journal
                          zones, and co-authorship collaboration mapping.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DATA HEALTH */}
              {activeTab === "health" && (
                <div className="mt-4 space-y-4">
                  {loadingHealth ? (
                    <div className="py-8 text-center text-xs text-ink-muted">
                      Computing 3-tier health scores...
                    </div>
                  ) : healthData ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                          <span className="sciai-kicker">Level 1 (Core · W:3)</span>
                          <div className="tabular-metrics mt-1 text-xl font-black text-ink-primary">
                            {healthData.level_1_score}%
                          </div>
                          <span className="text-[10px] text-ink-muted">
                            Author, Year, Source, Citations
                          </span>
                        </div>
                        <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                          <span className="sciai-kicker">Level 2 (Descriptive · W:2)</span>
                          <div className="tabular-metrics mt-1 text-xl font-black text-ink-primary">
                            {healthData.level_2_score}%
                          </div>
                          <span className="text-[10px] text-ink-muted">
                            Title, Keywords, Affiliations
                          </span>
                        </div>
                        <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 text-center">
                          <span className="sciai-kicker">Level 3 (Supplemental · W:1)</span>
                          <div className="tabular-metrics mt-1 text-xl font-black text-ink-primary">
                            {healthData.level_3_score}%
                          </div>
                          <span className="text-[10px] text-ink-muted">
                            Abstract, DOI, Categories
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-xs font-bold text-ink-primary">
                          Field-Level Completeness
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {Object.entries(healthData.field_completeness).map(([field, rawPct]) => {
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
                                      pct > 80
                                        ? "bg-status-success-text"
                                        : pct > 40
                                          ? "bg-status-warning-text"
                                          : "bg-status-danger-text"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="Health score unavailable"
                      description="Could not compute health score for this dataset."
                    />
                  )}
                </div>
              )}

              {/* TAB 3: METHODOLOGY NARRATIVE */}
              {activeTab === "methodology" && (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-ink-primary">
                        Academic Methodology Paragraph
                      </h3>
                      <p className="text-[11px] text-ink-muted">
                        Synthesized academic methodology text describing database indexing and
                        deduplication procedures.
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
                      {copiedMethodology ? "Copied!" : "Copy Narrative"}
                    </Button>
                  </div>

                  <div className="select-text rounded-xl border border-border-default bg-surface-subtle p-4 font-serif text-xs leading-relaxed text-ink-primary">
                    "{methodology || "No methodology generated yet."}"
                  </div>
                </div>
              )}

              {/* TAB 4: RECORDS BROWSER */}
              {activeTab === "records" && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search title, author, or DOI..."
                      className="w-full rounded-xl border border-border-default bg-surface-canvas py-1.5 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  {loadingDocs ? (
                    <div className="py-8 text-center text-xs text-ink-muted">
                      Loading documents...
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <EmptyState
                      title="No records found"
                      description="No matching documents in this dataset."
                    />
                  ) : (
                    <div className="max-h-96 divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-default">
                      {filteredDocs.map((doc, i) => {
                        const title = doc.TI || doc.title || "Untitled Paper";
                        const authors = Array.isArray(doc.AU) ? doc.AU : doc.authors || [];
                        const year = doc.PY || doc.year || "N/A";
                        const source = doc.SO || doc.source || "N/A";
                        const citations = doc.TC !== undefined ? doc.TC : doc.citations || 0;
                        const doi = doc.DOI || doc.doi;
                        const db = doc.DB || "Generic";

                        return (
                          <div
                            key={doc.id || doc.UT || i}
                            className="p-3.5 text-xs transition-colors hover:bg-surface-subtle/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="font-bold leading-snug text-ink-primary">
                                {title}
                              </span>
                              <span className="shrink-0 rounded-md border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[9px] font-bold text-ink-secondary">
                                {db}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                              <span className="font-medium text-ink-secondary">
                                {authors.slice(0, 3).join("; ")}
                              </span>
                              <span>·</span>
                              <span className="tabular-metrics">{year}</span>
                              <span>·</span>
                              <span className="italic">{source}</span>
                              <span>·</span>
                              <span className="tabular-metrics font-semibold text-ink-primary">
                                {citations} citations
                              </span>
                            </div>
                            {doi && (
                              <div className="mt-1 truncate font-mono text-[10px] text-brand-500">
                                DOI: {doi}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No dataset selected"
              description="Choose a dataset from the left panel to inspect its versions."
            />
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {(datasetToDelete || bulkDatasetsToDelete) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dataset-delete-title"
            className="w-full max-w-md rounded-2xl border border-border-default bg-surface-canvas p-6 shadow-elevated"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-status-danger-border bg-status-danger-bg text-status-danger-text">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3
                  id="dataset-delete-title"
                  className="text-base font-bold text-ink-primary"
                >
                  {bulkDatasetsToDelete
                    ? `Delete ${bulkDatasetsToDelete.length} Datasets`
                    : "Delete Dataset"}
                </h3>
                {bulkDatasetsToDelete ? (
                  <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                    <p>
                      These datasets, their versions, and indexed documents will be permanently
                      deleted:
                    </p>
                    <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-ink-primary">
                      {bulkDatasetsToDelete.map((dataset) => (
                        <li key={dataset.id}>
                          {dataset.name || "Untitled Dataset"} ({dataset.record_count || 0} records)
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Are you sure you want to permanently delete{" "}
                    <strong className="text-ink-primary">"{datasetToDelete?.name}"</strong>? This
                    will delete all associated versions and indexed documents (
                    {datasetToDelete?.record_count || 0} records).
                  </p>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="mt-4">
                <AlertBanner tone="danger">{deleteError}</AlertBanner>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => {
                  if (!isDeleting) {
                    setDatasetToDelete(null);
                    setBulkDatasetsToDelete(null);
                    setDeleteError(null);
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={isDeleting}
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                {isDeleting
                  ? "Deleting..."
                  : bulkDatasetsToDelete
                    ? `Delete ${bulkDatasetsToDelete.length} Datasets`
                    : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}