import React, { useState } from "react";
import { Dataset, DatasetVersion, Capability } from "../types.js";
import { Modal } from "./CommonUI.js";
import { Upload, Play, Database, FileSpreadsheet, CheckCircle } from "lucide-react";

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
      <p className="text-xs text-slate-500">
        Select a bibliometric dataset version and choose an analytical method from the SciAI capability registry.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Target Dataset
          </label>
          <select
            value={selectedDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-950"
          >
            <option value="">Select a dataset</option>
            {(datasets || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.source || "Generic"} · {d.record_count || 0} records)
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Dataset Version
            </label>
            {versionsStatus === "loading" && (
              <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
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
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none disabled:bg-slate-50 disabled:text-slate-400"
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
                    Version {v.version} · {v.record_count} documents ({v.status || "ready"})
                  </option>
                ))}
              </>
            )}
          </select>
          {versionError && (
            <p className="mt-1 text-[11px] text-rose-600 font-medium">
              {versionError}
            </p>
          )}
          {versionsStatus === "empty" && selectedDatasetId && (
            <p className="mt-1 text-[11px] text-amber-600 font-medium">
              This dataset has no versions. Ingest documents or create a snapshot first.
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Analytical Capabilities
          </label>
          <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
            {(capabilities || []).map((cap) => {
              const isSelected = selectedCapability === cap.name;
              const provider = cap.providers?.[0];
              const label = cap.name
                .replace(/[._]/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());

              return (
                <button
                  type="button"
                  key={cap.name}
                  onClick={() => onSelectCapability(cap.name)}
                  className={`w-full text-left rounded-lg p-2.5 transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-xs"
                      : "bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold truncate">{label}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {cap.description || cap.name}
                    </div>
                  </div>
                  {provider && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isSelected
                          ? "bg-white/15 text-slate-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {provider.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={
            running ||
            !selectedCapability ||
            !selectedVersionId ||
            versionsStatus === "loading" ||
            versionsStatus === "error" ||
            !isVersionVerified
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {running ? "Computing..." : "Run Analysis"}
        </button>
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
  const [name, setName] = useState("");
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
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        body: formData,
      });
      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        if (resText.trim().startsWith("<") || res.headers.get("content-type")?.includes("text/html")) {
          throw new Error("Server received the request but returned an HTML page. The server may still be initializing or restarting. Please retry in a few seconds.");
        }
        throw new Error(
          res.status === 413
            ? "File size exceeds server limit (100MB). Please upload a smaller export file."
            : `Server returned error (${res.status}): ${resText.slice(0, 150) || res.statusText}`
        );
      }

      if (res.ok && data) {
        const count = data.datasets?.length || 1;
        const msg = data.merge_result
          ? `Successfully ingested ${count} dataset(s) with ${data.total_records_ingested} records and performed Smart Merge into ${data.merge_result.final_unique_count} unified records!`
          : `Successfully imported ${count} dataset(s) with ${data.total_records_ingested} records!`;
        onUploadSuccess(msg);
        onClose();
      } else {
        setError(data?.error || "Failed to upload dataset");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to communicate with server");
    } finally {
      setUploading(false);
    }
  };

  const handleLoadCohort = async () => {
    setUploading(true);
    setError("");
    try {
      const res = await fetch("/api/datasets/load-sample-cohort", {
        method: "POST",
      });
      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        if (resText.trim().startsWith("<") || res.headers.get("content-type")?.includes("text/html")) {
          throw new Error("Server received the request but returned an HTML page. Please retry in a few seconds.");
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 150) || res.statusText}`);
      }

      if (res.ok && data) {
        onUploadSuccess(`Successfully ingested authentic 6-Database Sample Cohort (WoS, Scopus, PubMed, OpenAlex, Dimensions, Lens) and created consolidated Master Corpus!`);
        onClose();
      } else {
        setError(data?.error || "Failed to load sample cohort");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load sample cohort");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Multi-Database Bibliometric Ingestion" onClose={onClose}>
      <p className="text-xs text-slate-500 leading-relaxed">
        Ingest native citation exports from any of the 6 canonical scientometric databases. The parser will automatically detect file syntax (WoS tags, Scopus CSV, MEDLINE NBIB, OpenAlex JSON, Dimensions, Lens.org CSV/TSV/JSON) and map records into the Canonical Document Schema.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="mt-4 space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Database Source Format
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-950"
          >
            <option value="auto">⚡ Auto-Detect File Format & Schema (Recommended)</option>
            <option value="WoS">Web of Science (WoS) - Plain Text (.txt / .ciw)</option>
            <option value="Scopus">Scopus - CSV / BibTeX Export</option>
            <option value="PubMed">PubMed - MEDLINE Tagged (.nbib / .txt)</option>
            <option value="OpenAlex">OpenAlex - JSON / Works Export</option>
            <option value="Dimensions">Dimensions.ai - CSV Publication Export</option>
            <option value="Lens">Lens.org - CSV / TSV / JSON Export</option>
            <option value="Generic">Generic CSV / TSV</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Select Files (Multiple files supported)
          </label>
          <input
            type="file"
            multiple
            accept=".csv,.txt,.ciw,.tsv,.nbib,.json,.bib"
            onChange={(e) => setFiles(e.target.files)}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          {files && files.length > 0 && (
            <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">{files.length} file(s) selected:</span>
              <ul className="list-disc pl-4 max-h-24 overflow-y-auto">
                {Array.from(files).map((f: File, i) => (
                  <li key={i} className="truncate">
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeOnUpload}
              onChange={(e) => setMergeOnUpload(e.target.checked)}
              className="rounded text-slate-950 focus:ring-slate-950"
            />
            <div>
              <div className="text-xs font-bold text-slate-900">
                Auto-Run Smart Merge & Deduplication
              </div>
              <div className="text-[10px] text-slate-500">
                Immediately harmonizes records and creates a consolidated multi-database corpus
              </div>
            </div>
          </label>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
              Authentic Benchmark Datasets
            </span>
            <span className="rounded-md bg-indigo-200/60 px-1.5 py-0.2 text-[9px] font-bold text-indigo-800">
              6 Databases
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-950/80">
            Instant 1-click cohort containing authentic overlapping publications across WoS, Scopus, PubMed, OpenAlex, Dimensions, and Lens.org.
          </p>
          <button
            type="button"
            onClick={handleLoadCohort}
            disabled={uploading}
            className="mt-2.5 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
          >
            Load 6-Database Authentic Sample Cohort
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || !files || files.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Ingesting & Harmonizing..." : "Upload & Parse"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
