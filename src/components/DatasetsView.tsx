import React, { useState, useEffect, useMemo } from "react";
import { Dataset, DatasetVersion, DataHealthMetrics, CanonicalDocument } from "../types.js";
import { SectionHeader, StatusBadge, EmptyState } from "./CommonUI.js";
import {
  Database,
  Plus,
  Layers,
  Calendar,
  FileText,
  ArrowRight,
  Play,
  Activity,
  Copy,
  Check,
  Search,
  X,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
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
  onOpenDescriptive,
  onDatasetDeleted,
}: Props) {
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(
    datasets && datasets.length > 0 ? datasets[0] : null
  );
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"snapshots" | "health" | "methodology" | "records">("snapshots");
  
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
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedDatasetIds.includes(id));

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
    setSelectedDatasetIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleMatchingDatasets = () => {
    setSelectedDatasetIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
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

    // Immediately clear dependent state when selected dataset changes
    setVersions([]);
    setLoadingVersions(true);
    setVersionError(null);
    setHealthData(null);
    setMethodology("");
    setDocuments([]);

    const controller = new AbortController();
    const currentDatasetId = selectedDataset.id;

    // Fetch versions with signal and request identity check
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

    // Fetch health
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

    // Fetch methodology
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

    // Fetch documents
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
    const author = (Array.isArray(doc.AU) ? doc.AU.join(" ") : Array.isArray(doc.authors) ? doc.authors.join(" ") : "").toLowerCase();
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
        await apiRequest(`/api/datasets/${encodeURIComponent(deletedIds[0])}`, { method: "DELETE" });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Dataset Repository
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage imported bibliographic datasets, inspect 3-tier data health, generate methodology narratives, and open the appropriate analysis studio.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload Dataset
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Datasets list */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Imported Datasets ({filteredDatasets.length}{datasetSearch.trim() ? ` of ${datasets.length}` : ""})
            </div>
          </div>

          {/* Real-time Dataset Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="dataset-search-input"
              type="text"
              value={datasetSearch}
              onChange={(e) => setDatasetSearch(e.target.value)}
              placeholder="Search datasets by name or source..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-950/5 transition"
            />
            {datasetSearch && (
              <button
                type="button"
                id="clear-dataset-search-btn"
                onClick={() => setDatasetSearch("")}
                title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleMatchingDatasets}
              disabled={filteredDatasets.length === 0 || isDeleting}
              className="text-[11px] font-bold text-slate-700 hover:text-slate-950 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {allVisibleSelected ? "Deselect matching" : "Select all matching"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setBulkDatasetsToDelete(datasets.filter((dataset) => selectedDatasetIds.includes(dataset.id)));
              }}
              disabled={selectedDatasetIds.length === 0 || isDeleting}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected ({selectedDatasetIds.length})
            </button>
          </div>

          {filteredDatasets.length === 0 ? (
            <div
              id="dataset-search-empty-state"
              className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center"
            >
              <Database className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-700">No matching datasets</p>
              <p className="mt-1 text-[11px] text-slate-400">
                No datasets match &ldquo;{datasetSearch}&rdquo;. Try searching another title or source.
              </p>
              <button
                type="button"
                id="reset-dataset-search-btn"
                onClick={() => setDatasetSearch("")}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                Clear Search
              </button>
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
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? "border-slate-950 bg-white shadow-sm ring-1 ring-slate-950"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {d.name || "Untitled Dataset"}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={d.status || "available"} />
                        <label onClick={(event) => event.stopPropagation()} className="cursor-pointer rounded p-1">
                          <input
                            type="checkbox"
                            checked={selectedDatasetIds.includes(d.id)}
                            onChange={() => toggleDatasetForDeletion(d.id)}
                            aria-label={`Select ${d.name || "Untitled Dataset"} for deletion`}
                            disabled={isDeleting}
                            className="h-4 w-4 cursor-pointer accent-rose-600"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-slate-400" />
                          {d.source || "Generic"}
                        </span>
                        <span>•</span>
                        <span>{d.record_count || 0} records</span>
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2 shadow-xs">
          {selectedDataset ? (
            <div>
              <div className="border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Dataset Inspector
                  </div>
                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    {selectedDataset.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Source: <span className="font-semibold text-slate-700">{selectedDataset.source}</span> · 
                    Created: {selectedDataset.created_at ? new Date(selectedDataset.created_at).toLocaleDateString() : "Recent"} · 
                    Total Indexed: {selectedDataset.record_count} publications
                  </p>
                </div>
              </div>

              {/* Subtabs for Inspector */}
              <div className="mt-4 border-b border-slate-200">
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("snapshots")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer ${
                      activeTab === "snapshots"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Version History
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("health")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "health"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>3-Tier Data Health</span>
                    {healthData && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px]">
                        {healthData.overall_score}%
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("methodology")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer ${
                      activeTab === "methodology"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Methodology Narrative
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("records")}
                    className={`pb-2.5 px-1 border-b-2 transition cursor-pointer ${
                      activeTab === "records"
                        ? "border-slate-950 text-slate-950"
                        : "border-transparent text-slate-500 hover:text-slate-800"
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
                    <div className="py-8 text-center text-xs text-slate-400">
                      Loading versions...
                    </div>
                  ) : versionError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
                      <div className="text-xs font-bold text-rose-800">
                        Failed to load snapshot versions
                      </div>
                      <p className="mt-1 text-xs text-rose-600">
                        {versionError}
                      </p>
                    </div>
                  ) : versions.length === 0 ? (
                    <EmptyState
                      title="No versions found"
                      description="No snapshot versions recorded for this dataset."
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {versions.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-4 hover:bg-slate-50/60 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
                                v{v.version}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">
                                  Version {v.version} Snapshot
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  ID: {v.id} · {v.record_count} documents parsed
                                  {v.metadata?.detected_format && ` · Format: ${v.metadata.detected_format}`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <StatusBadge status={v.status || "ready"} />
                              <button
                                type="button"
                                onClick={() => onOpenDescriptive(selectedDataset.id)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                Open Corpus Analytics
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-xs font-bold text-slate-800">
                          Ready for Scientometric Intelligence
                        </div>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                          This dataset is indexed and ready for publication year distributions, author productivity curves (Lotka), citation dispersion, Bradford journal zones, and co-authorship collaboration mapping.
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
                    <div className="py-8 text-center text-xs text-slate-400">Computing 3-tier health scores...</div>
                  ) : healthData ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Level 1 (Core · W:3)</span>
                          <div className="text-xl font-black text-slate-900 mt-1">{healthData.level_1_score}%</div>
                          <span className="text-[9px] text-slate-500">Author, Year, Source, Citations</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Level 2 (Descriptive · W:2)</span>
                          <div className="text-xl font-black text-slate-900 mt-1">{healthData.level_2_score}%</div>
                          <span className="text-[9px] text-slate-500">Title, Keywords, Affiliations</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Level 3 (Supplemental · W:1)</span>
                          <div className="text-xl font-black text-slate-900 mt-1">{healthData.level_3_score}%</div>
                          <span className="text-[9px] text-slate-500">Abstract, DOI, Categories</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-800 mb-2">Field-Level Completeness</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(healthData.field_completeness).map(([field, rawPct]) => {
                            const pct = Number(rawPct) || 0;
                            return (
                              <div key={field} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                                <div className="flex justify-between text-[11px]">
                                  <span className="capitalize font-medium text-slate-700">{field}</span>
                                  <span className="font-bold text-slate-900">{pct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct > 80 ? "bg-emerald-600" : pct > 40 ? "bg-amber-500" : "bg-rose-500"
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
                    <EmptyState title="Health score unavailable" description="Could not compute health score for this dataset." />
                  )}
                </div>
              )}

              {/* TAB 3: METHODOLOGY NARRATIVE */}
              {activeTab === "methodology" && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Academic Methodology Paragraph
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Synthesized academic methodology text describing database indexing and deduplication procedures.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyMethodology}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                    >
                      {copiedMethodology ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedMethodology ? "Copied!" : "Copy Narrative"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-serif leading-relaxed text-slate-800 select-text">
                    "{methodology || "No methodology generated yet."}"
                  </div>
                </div>
              )}

              {/* TAB 4: RECORDS BROWSER */}
              {activeTab === "records" && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search title, author, or DOI..."
                      className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-950"
                    />
                  </div>

                  {loadingDocs ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading documents...</div>
                  ) : filteredDocs.length === 0 ? (
                    <EmptyState title="No records found" description="No matching documents in this dataset." />
                  ) : (
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {filteredDocs.map((doc, i) => {
                        const title = doc.TI || doc.title || "Untitled Paper";
                        const authors = Array.isArray(doc.AU) ? doc.AU : doc.authors || [];
                        const year = doc.PY || doc.year || "N/A";
                        const source = doc.SO || doc.source || "N/A";
                        const citations = doc.TC !== undefined ? doc.TC : doc.citations || 0;
                        const doi = doc.DOI || doc.doi;
                        const db = doc.DB || "Generic";

                        return (
                          <div key={doc.id || doc.UT || i} className="p-3.5 hover:bg-slate-50 transition text-xs">
                            <div className="flex items-start justify-between gap-3">
                              <span className="font-bold text-slate-900 leading-snug">{title}</span>
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                                {db}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-700">{authors.slice(0, 3).join("; ")}</span>
                              <span>•</span>
                              <span>{year}</span>
                              <span>•</span>
                              <span className="italic">{source}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-800">{citations} citations</span>
                            </div>
                            {doi && (
                              <div className="mt-1 font-mono text-[10px] text-indigo-600 truncate">
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
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {(datasetToDelete || bulkDatasetsToDelete) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div role="alertdialog" aria-modal="true" aria-labelledby="dataset-delete-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 id="dataset-delete-title" className="text-base font-bold text-slate-900">
                  {bulkDatasetsToDelete ? `Delete ${bulkDatasetsToDelete.length} Datasets` : "Delete Dataset"}
                </h3>
                {bulkDatasetsToDelete ? (
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                    <p>These datasets, their versions, and indexed documents will be permanently deleted:</p>
                    <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-slate-800">
                      {bulkDatasetsToDelete.map((dataset) => (
                        <li key={dataset.id}>{dataset.name || "Untitled Dataset"} ({dataset.record_count || 0} records)</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to permanently delete{" "}
                    <strong className="text-slate-800">"{datasetToDelete?.name}"</strong>
                    ? This will delete all associated versions and indexed documents ({datasetToDelete?.record_count || 0} records).
                  </p>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  if (!isDeleting) {
                    setDatasetToDelete(null);
                    setBulkDatasetsToDelete(null);
                    setDeleteError(null);
                  }
                }}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{bulkDatasetsToDelete ? `Delete ${bulkDatasetsToDelete.length} Datasets` : "Confirm Delete"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

