import { useEffect, useMemo, useState } from "react";
import { GitMerge, RefreshCw, ShieldCheck } from "lucide-react";

type Column = { name: string; type: "string" | "number" | "boolean" | "date"; role: "dimension" | "metric" | "group_size" };
type Source = { id: string; name: string; kind: string; columns: Column[]; classification: string; provenance: { publisher: string; dataset: string; reference: string } };
type Snapshot = { id: string; version: number; source_id: string; row_count: number; as_of: string; content_sha256: string };
type Profile = { id: string; source_id: string; version: number; kind: string; grain: { dimensions: string[]; metrics: string[] }; allowed_join_keys: Array<{ source_column: string; target: string; normalization: string }>; scope: string };
type Mapping = { id: string; profile_id: string; target_dataset_version_id: string; source_column: string; target_field: string; normalization: string };
type Model = { manifest: { id: string; model_hash: string; row_count: number; dataset_version_id: string; snapshot_ids: string[]; limitations: string[]; coverage: Record<string, string> }; evidence: Array<{ metric: string; value: string | number | null; interpretation_boundary: string; limitations: string[] }>; rows: Record<string, unknown>[] };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

interface Props { datasetId: string; datasetVersionId: string | null; }

export function PowerBICombinedEvidence({ datasetId, datasetVersionId }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [targetField, setTargetField] = useState("publication_year");
  const [sourceColumn, setSourceColumn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const source = sources.find((item) => item.id === sourceId);
  const dimensions = useMemo(() => source?.columns.filter((column) => column.role === "dimension") || [], [source]);
  const metrics = useMemo(() => source?.columns.filter((column) => column.role === "metric") || [], [source]);

  const loadSources = async () => {
    try { setSources(await request<Source[]>("/api/powerbi/v2/sources")); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load sources"); }
  };
  useEffect(() => { void loadSources(); }, []);
  useEffect(() => {
    setSnapshots([]); setProfiles([]); setProfile(null); setMapping(null); setModel(null);
    if (!sourceId) return;
    const controller = new AbortController();
    void Promise.all([
      request<Snapshot[]>(`/api/powerbi/v2/sources/${encodeURIComponent(sourceId)}/snapshots`, { signal: controller.signal }),
      request<Profile[]>(`/api/powerbi/v3/profiles?source_id=${encodeURIComponent(sourceId)}`, { signal: controller.signal }),
    ]).then(([nextSnapshots, nextProfiles]) => {
      if (controller.signal.aborted) return;
      setSnapshots(nextSnapshots); setProfiles(nextProfiles);
      setSnapshotId(nextSnapshots[0]?.id || ""); setProfile(nextProfiles[0] || null);
      setSourceColumn(nextProfiles[0]?.allowed_join_keys[0]?.source_column || dimensions[0]?.name || "");
    }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load source contracts"); });
    return () => controller.abort();
  }, [sourceId]);

  const createProfile = async () => {
    if (!source || !dimensions[0] || !metrics[0]) return;
    setBusy(true); setError("");
    try {
      const created = await request<Profile>("/api/powerbi/v3/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_id: source.id, kind: "combined_portfolio", dimensions: dimensions.map((item) => item.name), metrics: metrics.map((item) => item.name), allowed_join_keys: [{ source_column: sourceColumn || dimensions[0].name, target: targetField, normalization: targetField === "publication_year" ? "exact" : "trim_lower" }] }) });
      setProfile(created); setProfiles((items) => [created, ...items]);
    } catch (err) { setError(err instanceof Error ? err.message : "Profile creation failed"); }
    finally { setBusy(false); }
  };
  const createMapping = async () => {
    if (!profile || !datasetVersionId || !sourceColumn) return;
    setBusy(true); setError("");
    try {
      const created = await request<Mapping>("/api/powerbi/v3/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile_id: profile.id, target_dataset_id: datasetId, target_dataset_version_id: datasetVersionId, source_column: sourceColumn, target_field: targetField, normalization: targetField === "publication_year" ? "exact" : "trim_lower" }) });
      setMapping(created);
    } catch (err) { setError(err instanceof Error ? err.message : "Mapping creation failed"); }
    finally { setBusy(false); }
  };
  const buildModel = async () => {
    if (!mapping || !profile || !snapshotId || !datasetVersionId) return;
    setBusy(true); setError("");
    try {
      setModel(await request<Model>("/api/powerbi/v3/combined-models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_id: datasetId, dataset_version_id: datasetVersionId, snapshot_id: snapshotId, profile_id: profile.id, mapping_id: mapping.id }) }));
    } catch (err) { setError(err instanceof Error ? err.message : "Combined model build failed"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-950">
      <div className="flex items-center gap-2 font-bold"><GitMerge className="h-4 w-4" /> Pinned combined evidence model</div>
      <p className="mt-2 text-xs leading-relaxed">This workflow joins one immutable, non-sensitive aggregate snapshot to a pinned bibliometric dataset version using an explicit group key. It never infers person-level relationships, selects an unrelated latest version, or claims hosted tenant authorization.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold text-slate-900">1. Select aggregate snapshot</h3>
        <select aria-label="Combined source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs"><option value="">Select source</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Combined snapshot" value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs"><option value="">Select immutable version</option>{snapshots.map((item) => <option key={item.id} value={item.id}>v{item.version} · {item.row_count} rows · {item.as_of}</option>)}</select>
        {source && <p className="text-[11px] text-slate-500">{source.classification} · {source.provenance.publisher} · {source.provenance.reference}</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold text-slate-900">2. Declare contract</h3>
        <select aria-label="Source dimension" value={sourceColumn} onChange={(event) => setSourceColumn(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs"><option value="">Select source dimension</option>{dimensions.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.type})</option>)}</select>
        <select aria-label="Target group" value={targetField} onChange={(event) => setTargetField(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-xs"><option value="publication_year">Publication year</option><option value="country">Country</option><option value="journal_source">Journal source</option><option value="keyword">Primary keyword</option></select>
        <button type="button" disabled={busy || !source || !dimensions.length || !metrics.length} onClick={createProfile} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Create versioned profile</button>
        {profiles.length > 0 && <select aria-label="Profile version" value={profile?.id || ""} onChange={(event) => setProfile(profiles.find((item) => item.id === event.target.value) || null)} className="w-full rounded-lg border border-slate-300 p-2 text-xs">{profiles.map((item) => <option key={item.id} value={item.id}>Profile v{item.version} · {item.kind}</option>)}</select>}
        <button type="button" disabled={busy || !profile || !datasetVersionId} onClick={createMapping} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">Validate and pin mapping</button>
        {mapping && <p className="text-[11px] text-emerald-700">Mapping {mapping.id.slice(0, 8)}… pinned to dataset version {mapping.target_dataset_version_id}.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold text-slate-900">3. Build evidence package</h3>
        <p className="text-xs text-slate-500">Dataset version: <code>{datasetVersionId || "Select a version in the research feed"}</code></p>
        <button type="button" disabled={busy || !mapping || !snapshotId || !datasetVersionId} onClick={buildModel} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Build pinned model</button>
        {model && <div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-900">{model.manifest.row_count} matched groups</p><p className="mt-1 break-all font-mono text-[10px] text-slate-500">Hash: {model.manifest.model_hash}</p><p className="mt-1 text-amber-800">Manual immutable refresh only; no source was fetched.</p></div>}
      </section>
    </div>
    {model && <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Evidence metrics</h3><div className="mt-3 space-y-2">{model.evidence.map((item) => <div key={item.id || item.metric} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-bold">{item.metric}</span><span className="font-mono">{String(item.value ?? "unavailable")}</span></div><p className="mt-1 text-slate-500">{item.interpretation_boundary}</p></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Combined aggregate preview</h3><pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(model.rows.slice(0, 10), null, 2)}</pre><ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-amber-800">{model.manifest.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section></div>}
  </div>;
}
