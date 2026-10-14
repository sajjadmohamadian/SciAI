import { useEffect, useState, type FormEvent } from "react";
import { Database, Copy, Upload, ShieldCheck } from "lucide-react";

type Column = { name: string; type: "string" | "number" | "boolean" | "date"; role: "dimension" | "metric" | "group_size" };
type Source = {
  id: string;
  name: string;
  kind: "internal_aggregate" | "external_reference";
  owner: string;
  description: string;
  license?: string;
  classification: string;
  columns: Column[];
  provenance: { publisher: string; dataset: string; reference: string };
};
type Snapshot = { id: string; source_id: string; version: number; row_count: number; as_of: string; imported_at: string; content_sha256: string };
type Page = { rows: Record<string, unknown>[]; snapshot: Snapshot; offset: number; limit: number; next_offset: number | null };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

const emptyColumn = (): Column => ({ name: "", type: "string", role: "dimension" });

export function PowerBIDataSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [preview, setPreview] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Source["kind"]>("external_reference");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState("");
  const [publisher, setPublisher] = useState("");
  const [reference, setReference] = useState("");
  const [columns, setColumns] = useState<Column[]>([emptyColumn()]);
  const [file, setFile] = useState<File | null>(null);
  const [asOf, setAsOf] = useState("");

  const selectedSource = sources.find((source) => source.id === sourceId);
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === snapshotId && snapshot.source_id === sourceId);
  const tableUrl = selectedSnapshot ? `${window.location.origin}/api/powerbi/v2/tables/${encodeURIComponent(selectedSnapshot.id)}?limit=100&offset=0` : "";
  const mScript = selectedSnapshot ? `// Power BI Desktop: local-only paginated JSON Web Import; use Anonymous on a private loopback installation.\nlet\n    ReadPage = (offset as number) => Json.Document(Web.Contents("${window.location.origin}", [RelativePath="api/powerbi/v2/tables/${encodeURIComponent(selectedSnapshot.id)}", Query=[limit="100", offset=Text.From(offset)]])),\n    Pages = List.Generate(() => ReadPage(0), each _ <> null, each if _[next_offset] = null then null else ReadPage(_[next_offset]), each _[rows]),\n    Rows = List.Combine(Pages),\n    Result = if List.IsEmpty(Rows) then #table({}, {}) else Table.FromRecords(Rows)\nin\n    Result` : "";

  const loadSources = async () => {
    try {
      setSources(await request<Source[]>("/api/powerbi/v2/sources"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data sources");
    }
  };

  useEffect(() => { void loadSources(); }, []);
  useEffect(() => {
    setSnapshots([]);
    setSnapshotId("");
    setPreview(null);
    if (!sourceId) return;
    const controller = new AbortController();
    void request<Snapshot[]>(`/api/powerbi/v2/sources/${encodeURIComponent(sourceId)}/snapshots`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSnapshots(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [sourceId]);
  useEffect(() => {
    setPreview(null);
    if (!selectedSnapshot) return;
    const controller = new AbortController();
    void request<Page>(`/api/powerbi/v2/tables/${encodeURIComponent(selectedSnapshot.id)}?limit=10&offset=0`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPreview(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [sourceId, snapshotId]);

  const createSource = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const source = await request<Source>("/api/powerbi/v2/sources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, owner, description, ...(license.trim() ? { license } : {}), aggregateOnly: true,
          provenance: { publisher, dataset: name, reference }, columns }),
      });
      await loadSources();
      setSourceId(source.id);
      setName("");
      setColumns([emptyColumn()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Source registration failed");
    } finally { setBusy(false); }
  };

  const uploadSnapshot = async () => {
    if (!file || !sourceId || !asOf) return;
    setError("");
    setBusy(true);
    try {
      if (file.size > 1_000_000) throw new Error("Choose a file smaller than 1 MB");
      const snapshot = await request<Snapshot>(`/api/powerbi/v2/sources/${encodeURIComponent(sourceId)}/snapshots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: file.name.toLowerCase().endsWith(".json") ? "json" : "csv", content: await file.text(), asOf }),
      });
      setSnapshots(await request<Snapshot[]>(`/api/powerbi/v2/sources/${encodeURIComponent(sourceId)}/snapshots`));
      setSnapshotId(snapshot.id);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot upload failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> Local aggregate snapshot imports only</div>
        <p className="mt-2 text-xs leading-relaxed">Use only a private, single-operator loopback installation with the development authentication bypass and no public uploads. Never expose it through a reverse proxy. Source categories and columns are operator-declared, not independently certified for privacy. Import only non-sensitive grouped observations (internal group size: at least 5); do not upload person-level data, identifiers or confidential text. Hosted organizational exports require real identity and per-source authorization.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={createSource} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-bold text-slate-900">Register a governed data source</h3>
          <p className="text-xs text-slate-500">Source definitions fix the exportable columns and their types before a snapshot can be imported.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Source name" required maxLength={100} placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <select aria-label="Source category" value={kind} onChange={(e) => setKind(e.target.value as Source["kind"])} className="rounded-lg border border-slate-300 p-2 text-xs"><option value="external_reference">External reference</option><option value="internal_aggregate">Organizational aggregate</option></select>
            <input aria-label="Source owner" required placeholder="Data owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <input aria-label="Publisher" required placeholder="Publisher / organization" value={publisher} onChange={(e) => setPublisher(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <input aria-label="Source reference" required placeholder="Source URL or citation" value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <input aria-label="License" placeholder="License or reuse terms" value={license} onChange={(e) => setLicense(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
          </div>
          <textarea aria-label="Source description" required placeholder="Scope, methodology and limitations" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs" rows={2} />
          <div className="text-xs font-bold text-slate-700">Approved columns (CSV header names)</div>
          {columns.map((column, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <input aria-label={`Column ${index + 1} name`} required placeholder="Column name" value={column.name} onChange={(e) => setColumns(columns.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="min-w-0 rounded-lg border border-slate-300 p-2 text-xs" />
              <select aria-label={`Column ${index + 1} type`} value={column.type} onChange={(e) => setColumns(columns.map((item, i) => i === index ? { ...item, type: e.target.value as Column["type"] } : item))} className="rounded-lg border border-slate-300 p-2 text-xs">{["string", "number", "boolean", "date"].map((type) => <option key={type}>{type}</option>)}</select>
              <select aria-label={`Column ${index + 1} role`} value={column.role} onChange={(e) => setColumns(columns.map((item, i) => i === index ? { ...item, role: e.target.value as Column["role"] } : item))} className="rounded-lg border border-slate-300 p-2 text-xs">{["dimension", "metric", "group_size"].map((role) => <option key={role}>{role}</option>)}</select>
              {columns.length > 1 && <button type="button" onClick={() => setColumns(columns.filter((_, i) => i !== index))} className="text-xs text-rose-700">Remove</button>}
            </div>
          ))}
          <div className="flex gap-2"><button type="button" onClick={() => setColumns([...columns, emptyColumn()])} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">Add column</button><button disabled={busy} type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Register source</button></div>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-bold text-slate-900"><Database className="h-4 w-4" /> Source catalog & snapshots</h3>
          <label className="block text-xs text-slate-700">Approved source
            <select aria-label="Approved source" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Select a source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.kind === "internal_aggregate" ? "Organizational" : "External"}</option>)}</select>
          </label>
          {!sources.length && <p className="text-xs text-slate-500">No approved sources registered yet. The bibliometric feed remains available in the other tabs.</p>}
          {selectedSource && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1"><p className="font-bold text-slate-900">{selectedSource.name} · {selectedSource.classification}</p><p>{selectedSource.description}</p><p>Owner: {selectedSource.owner} · Publisher: {selectedSource.provenance.publisher} · License: {selectedSource.license || "Not specified"}</p><p>Approved columns: {selectedSource.columns.map((column) => `${column.name} (${column.type})`).join(", ")}</p></div>}
          {selectedSource && <div className="space-y-2"><label className="block text-xs text-slate-700">Source as-of date<input aria-label="Source as-of date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" /></label><input aria-label="Snapshot file" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block max-w-full text-xs" /><button type="button" disabled={!file || !asOf || busy} onClick={uploadSnapshot} className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"><Upload className="h-4 w-4" /> Import immutable snapshot</button></div>}
          {snapshots.length > 0 && <label className="block text-xs text-slate-700">Export snapshot<select aria-label="Export snapshot" value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Select a version</option>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Version {snapshot.version} · {snapshot.row_count} rows · {snapshot.as_of}</option>)}</select></label>}
          {selectedSnapshot && <p className="text-xs text-slate-500">Snapshot {selectedSnapshot.id} · SHA-256: {selectedSnapshot.content_sha256} · Imported: {selectedSnapshot.imported_at}</p>}
        </div>
      </div>
      {selectedSnapshot && <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-bold text-slate-900">Approved table preview</h3>
        <p className="text-xs text-slate-600">{preview?.snapshot.id === selectedSnapshot.id ? `${preview.snapshot.row_count} rows; showing the first ${preview.rows.length}.` : "Loading preview…"} This table is separate from publication facts. Only join on an explicitly validated shared key.</p>
        <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(preview?.snapshot.id === selectedSnapshot.id ? preview.rows : [], null, 2)}</pre>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(tableUrl)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"><Copy className="h-3.5 w-3.5" /> Copy table URL</button><button type="button" onClick={() => navigator.clipboard.writeText(mScript)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"><Copy className="h-3.5 w-3.5" /> Copy Power Query M</button></div>
        <p className="text-xs text-amber-800">The generated query paginates this immutable snapshot on a private loopback installation. Choose Anonymous only with the explicit local bypass; remote connections and Power BI Service refresh are not supported. Never put tokens in M scripts or URLs.</p>
      </div>}
    </div>
  );
}
