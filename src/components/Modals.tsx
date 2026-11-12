import React, { useState } from "react";
import { Dataset, DatasetVersion, Capability } from "../types.js";
import { AlertBanner, Button, Modal } from "./CommonUI.js";
import { Upload, Play } from "lucide-react";
import { apiRequest, getApiErrorMessage } from "../utils/apiClient.js";
import {
  CAPABILITY_CATEGORIES,
  getCapabilityPresentation,
} from "../utils/capabilityCatalog.js";

export function RunAnalysisModal({
  datasets = [],
  versions = [],
  capabilities = [],
  selectedDatasetId,
  selectedVersionId,
  selectedCapability,
  running,
  onClose,
  onSelectDataset,
  onSelectVersion,
  onSelectCapability,
  onRun,
  versionsStatus = "idle",
  versionError = null,
}: {
  datasets: Dataset[];
  versions: DatasetVersion[];
  capabilities: Capability[];
  selectedDatasetId: string;
  selectedVersionId: string;
  selectedCapability: string;
  running: boolean;
  onClose: () => void;
  onSelectDataset: (id: string) => void;
  onSelectVersion: (id: string) => void;
  onSelectCapability: (name: string) => void;
  onRun: () => void;
  versionsStatus?: "idle" | "loading" | "success" | "empty" | "error";
  versionError?: string | null;
}) {
  const isVersionVerified =
    selectedVersionId &&
    versions.length > 0 &&
    versions.some((v) => v.id === selectedVersionId);

  return (
    <Modal title="Run Scientometric Analysis" onClose={onClose}>
      <p className="text-xs text-ink-muted">
        Select a bibliometric dataset version and choose an analytical method
        from the SciAI capability registry.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="sciai-kicker">Target Dataset</label>
          <select
            value={selectedDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-semibold text-ink-primary focus:border-brand-500 focus:outline-none"
          >
            <option value="">Select a dataset</option>
            {(datasets || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.source || "Generic"} · {d.record_count || 0}{" "}
                records)
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="sciai-kicker">Dataset Version</label>
            {versionsStatus === "loading" && (
              <span className="animate-pulse text-[10px] font-semibold text-brand-500">
                Loading versions...
              </span>
            )}
          </div>
          <select
            value={selectedVersionId}
            onChange={(e) => onSelectVersion(e.target.value)}
            disabled={
              !selectedDatasetId ||
              versionsStatus === "loading" ||
              versionsStatus === "error" ||
              (versions?.length || 0) === 0
            }
            className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-semibold text-ink-primary focus:border-brand-500 focus:outline-none disabled:bg-surface-subtle disabled:text-ink-subtle"
          >
            {versionsStatus === "loading" ? (
              <option value="">Loading versions...</option>
            ) : versionsStatus === "error" ? (
              <option value="">Error loading versions</option>
            ) : (versions?.length || 0) === 0 ? (
              <option value="">No versions recorded for this dataset</option>
            ) : (
              <>
                <option value="">Select a version...</option>
                {(versions || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version} · {v.record_count} documents (
                    {v.status || "ready"})
                  </option>
                ))}
              </>
            )}
          </select>
          {versionError && (
            <p className="mt-1 text-[11px] font-medium text-status-danger-text">
              {versionError}
            </p>
          )}
          {versionsStatus === "empty" && selectedDatasetId && (
            <p className="mt-1 text-[11px] font-medium text-status-warning-text">
              This dataset has no versions. Ingest documents or create a
              snapshot first.
            </p>
          )}
        </div>

        <div>
          <label className="sciai-kicker">Analytical Capabilities</label>
          <div className="mt-2 max-h-72 space-y-4 overflow-y-auto rounded-xl border border-border-default bg-surface-subtle p-2">
            {CAPABILITY_CATEGORIES.map((category) => {
              const options = capabilities.filter(
                (cap) => getCapabilityPresentation(cap.name).category === category
              );
              if (options.length === 0) return null;

              return (
                <section
                  key={category}
                  aria-label={category}
                  className="space-y-1.5"
                >
                  <h3 className="px-1 pt-1 text-[11px] font-bold text-ink-secondary">
                    {category}{" "}
                    <span className="tabular-metrics font-normal">
                      ({options.length})
                    </span>
                  </h3>
                  {options.map((cap) => {
                    const details = getCapabilityPresentation(cap.name);
                    const isSelected = selectedCapability === cap.name;
                    const provider =
                      cap.providers?.find((p) => p.available) ||
                      cap.providers?.[0];

                    return (
                      <button
                        type="button"
                        key={cap.name}
                        aria-pressed={isSelected}
                        onClick={() => onSelectCapability(cap.name)}
                        className={`w-full cursor-pointer rounded-xl p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                          isSelected
                            ? "bg-brand-500 text-white shadow-xs"
                            : "border border-border-default bg-surface-canvas text-ink-primary hover:bg-surface-muted/70"
                        }`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-xs font-bold">
                            {details.title}
                          </span>
                          {provider?.name && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "border border-border-subtle bg-surface-subtle text-ink-secondary"
                              }`}
                            >
                              Registered: {provider.name}
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-1 block text-[10px] leading-relaxed ${
                            isSelected ? "text-brand-100" : "text-ink-secondary"
                          }`}
                        >
                          {cap.description || cap.name}
                        </span>
                        <span
                          className={`mt-1 block text-[10px] ${
                            isSelected ? "text-brand-200" : "text-ink-muted"
                          }`}
                        >
                          Needs: {details.requirement} · Opens in{" "}
                          {details.destinationLabel}
                        </span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={running}
          disabled={
            running ||
            !selectedCapability ||
            !selectedVersionId ||
            versionsStatus === "loading" ||
            versionsStatus === "error" ||
            !isVersionVerified
          }
          onClick={onRun}
          icon={
            !running ? <Play className="h-3.5 w-3.5 fill-current" /> : undefined
          }
        >
          {running ? "Computing..." : "Run Analysis"}
        </Button>
      </div>
    </Modal>
  );
}

export function UploadDatasetModal({
  onClose,
  onUploadSuccess,
}: {
  onClose: () => void;
  onUploadSuccess: (msg: string) => void;
}) {
  const [name] = useState("");
  const [source, setSource] = useState("auto");
  const [files, setFiles] = useState<FileList | null>(null);
  const [mergeOnUpload, setMergeOnUpload] = useState<boolean>(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    if (name) formData.append("name", name);
    if (source !== "auto") formData.append("source", source);
    formData.append("merge_on_upload", mergeOnUpload ? "true" : "false");

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const data: any = await apiRequest("/api/datasets/upload", {
        method: "POST",
        body: formData,
      });

      const count = data.datasets?.length || 1;
      const msg = data.merge_result
        ? `Successfully ingested ${count} dataset(s) with ${data.total_records_ingested} records and performed Smart Merge into ${data.merge_result.final_unique_count} unified records!`
        : `Successfully imported ${count} dataset(s) with ${data.total_records_ingested} records!`;
      onUploadSuccess(msg);
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to upload dataset"));
    } finally {
      setUploading(false);
    }
  };

  const handleLoadCohort = async () => {
    setUploading(true);
    setError("");
    try {
      const data: any = await apiRequest("/api/datasets/load-sample-cohort", {
        method: "POST",
      });

      if (data.merge_summary || data.created?.length || data.message) {
        onUploadSuccess(
          `Successfully ingested authentic 6-Database Sample Cohort (WoS, Scopus, PubMed, OpenAlex, Dimensions, Lens) and created consolidated Master Corpus!`
        );
        onClose();
      } else {
        setError("Failed to load sample cohort");
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load sample cohort"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Multi-Database Bibliometric Ingestion" onClose={onClose}>
      <p className="text-xs leading-relaxed text-ink-muted">
        Ingest native citation exports from any of the 6 canonical scientometric
        databases. The parser will automatically detect file syntax (WoS tags,
        Scopus CSV, MEDLINE NBIB, OpenAlex JSON, Dimensions, Lens.org
        CSV/TSV/JSON) and map records into the Canonical Document Schema.
      </p>

      {error && (
        <div className="mt-3">
          <AlertBanner tone="danger">{error}</AlertBanner>
        </div>
      )}

      <form onSubmit={handleUpload} className="mt-4 space-y-4">
        <div>
          <label className="sciai-kicker">Database Source Format</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-medium text-ink-primary focus:border-brand-500 focus:outline-none"
          >
            <option value="auto">
              Auto-Detect File Format &amp; Schema (Recommended)
            </option>
            <option value="WoS">
              Web of Science (WoS) - Plain Text (.txt / .ciw)
            </option>
            <option value="Scopus">Scopus - CSV / BibTeX Export</option>
            <option value="PubMed">
              PubMed - MEDLINE Tagged (.nbib / .txt)
            </option>
            <option value="OpenAlex">OpenAlex - JSON / Works Export</option>
            <option value="Dimensions">
              Dimensions.ai - CSV Publication Export
            </option>
            <option value="Lens">
              Lens.org - CSV / TSV / JSON Export
            </option>
            <option value="Generic">Generic CSV / TSV</option>
          </select>
        </div>

        <div>
          <label className="sciai-kicker">
            Select Files (Multiple files supported)
          </label>
          <input
            type="file"
            multiple
            accept=".csv,.txt,.ciw,.tsv,.nbib,.json,.bib"
            onChange={(e) => setFiles(e.target.files)}
            className="mt-1.5 block w-full rounded-xl border border-border-default bg-surface-canvas p-2 text-xs text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-subtle file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-primary hover:file:bg-surface-muted"
          />
          {files && files.length > 0 && (
            <div className="mt-2 space-y-1 rounded-xl border border-border-subtle bg-surface-subtle p-2.5 text-[11px] text-ink-secondary">
              <span className="tabular-metrics font-bold text-ink-primary">
                {files.length} file(s) selected:
              </span>
              <ul className="max-h-24 list-disc overflow-y-auto pl-4">
                {Array.from(files).map((f: File, i) => (
                  <li key={i} className="truncate">
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-default bg-surface-subtle p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={mergeOnUpload}
              onChange={(e) => setMergeOnUpload(e.target.checked)}
              className="rounded accent-brand-500"
            />
            <div>
              <div className="text-xs font-bold text-ink-primary">
                Auto-Run Smart Merge &amp; Deduplication
              </div>
              <div className="text-[10px] text-ink-muted">
                Immediately harmonizes records and creates a consolidated
                multi-database corpus
              </div>
            </div>
          </label>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="sciai-kicker text-[10px]! text-brand-700!">
              Authentic Benchmark Datasets
            </span>
            <span className="rounded-md border border-brand-200 bg-brand-100/70 px-1.5 py-0.2 text-[9px] font-bold text-brand-800">
              6 Databases
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-secondary">
            Instant 1-click cohort containing authentic overlapping
            publications across WoS, Scopus, PubMed, OpenAlex, Dimensions, and
            Lens.org.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={handleLoadCohort}
            className="mt-2.5 w-full"
          >
            Load 6-Database Authentic Sample Cohort
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={uploading}
            disabled={uploading || !files || files.length === 0}
            icon={!uploading ? <Upload className="h-3.5 w-3.5" /> : undefined}
          >
            {uploading ? "Ingesting & Harmonizing..." : "Upload & Parse"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}