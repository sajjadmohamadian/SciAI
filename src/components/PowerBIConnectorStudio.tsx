import React, { useState, useEffect, useRef } from "react";
import { Dataset, Analysis } from "../types.js";
import { PowerBIDataSources } from "./PowerBIDataSources.js";
import { PowerBICombinedEvidence } from "./PowerBICombinedEvidence.js";
import {
  BarChart3,
  Copy,
  Check,
  Download,
  RefreshCw,
  ExternalLink,
  Layers,
  Database,
  Table as TableIcon,
  CheckCircle2,
  Code2,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  Zap,
  ShieldCheck,
  TrendingUp,
  Globe,
  Users,
  Award,
  BookOpen,
  GitMerge,
  Info
} from "lucide-react";

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  analyses?: Analysis[];
}

export function PowerBIConnectorStudio({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  analyses = [],
}: Props) {
  const currentDatasetId = selectedDatasetId || (datasets[0]?.id ?? "dataset-bio-1");
  const currentDataset = datasets.find((d) => d.id === currentDatasetId) || datasets[0];

  const [activeTab, setActiveTab] = useState<"overview" | "sources" | "combined" | "tables" | "powerquery" | "dax" | "simulator" | "guide">("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<{ status: "idle" | "testing" | "success" | "error"; latency?: number; message?: string }>({
    status: "idle",
  });

  // Live Model Data fetched from backend
  const [powerBiData, setPowerBiData] = useState<any>(null);
  const currentDatasetIdRef = useRef(currentDatasetId);
  currentDatasetIdRef.current = currentDatasetId;
  const [loadingModel, setLoadingModel] = useState(false);
  const [selectedTableTab, setSelectedTableTab] = useState<"Fact_Documents" | "Dim_Authors" | "Dim_Sources" | "Dim_ThematicClusters" | "Dim_GeographicCollaborations" | "Fact_ExecutiveKPIs">("Fact_Documents");

  // Dynamic Simulator Slicers
  const [simSourceFilter, setSimSourceFilter] = useState<string>("ALL");
  const [simBradfordFilter, setSimBradfordFilter] = useState<string>("ALL");
  const [simImpactFilter, setSimImpactFilter] = useState<string>("ALL");
  const [simIntlOnly, setSimIntlOnly] = useState<boolean>(false);
  const [simSearchText, setSimSearchText] = useState<string>("");

  const originUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const selectedVersionId = powerBiData?.feedMetadata?.dataset_id === currentDatasetId
    ? powerBiData.feedMetadata.dataset_version_id
    : null;
  const versionQuery = selectedVersionId ? `&version_id=${encodeURIComponent(selectedVersionId)}` : "";
  const liveFeedUrl = `${originUrl}/api/powerbi/feed/${encodeURIComponent(currentDatasetId)}${selectedVersionId ? `?version_id=${encodeURIComponent(selectedVersionId)}` : ""}`;

  // Fetch live model
  const fetchLiveModel = async () => {
    const requestedDatasetId = currentDatasetId;
    setLoadingModel(true);
    try {
      const res = await fetch(`/api/powerbi/feed/${encodeURIComponent(requestedDatasetId)}`);
      const data = res.ok ? await res.json() : null;
      if (currentDatasetIdRef.current === requestedDatasetId) setPowerBiData(data);
    } catch (err) {
      if (currentDatasetIdRef.current === requestedDatasetId) {
        setPowerBiData(null);
        console.error("Failed to fetch Power BI feed:", err);
      }
    } finally {
      if (currentDatasetIdRef.current === requestedDatasetId) setLoadingModel(false);
    }
  };

  useEffect(() => {
    setPowerBiData(null);
    void fetchLiveModel();
  }, [currentDatasetId]);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handlePingEndpoint = async () => {
    setPingStatus({ status: "testing" });
    const start = performance.now();
    try {
      const res = await fetch(`/api/powerbi/feed/${currentDatasetId}`, { method: "GET" });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const json = await res.json();
        setPingStatus({
          status: "success",
          latency: elapsed,
          message: `HTTP 200 OK • Response time: ${elapsed}ms • ${json.Fact_Documents?.length || 0} documents available for Web Import`,
        });
      } else {
        setPingStatus({
          status: "error",
          message: `HTTP ${res.status}: Failed to reach endpoint`,
        });
      }
    } catch (err: any) {
      setPingStatus({
        status: "error",
        message: err.message || "Network connection failed",
      });
    }
  };

  const handleDownloadPbids = () => {
    window.location.href = `/api/powerbi/download-pbids?dataset_id=${encodeURIComponent(currentDatasetId)}${versionQuery}`;
  };

  // Power Query M Scripts
  const powerQueryMasterScript = `// Power Query M Script for Microsoft Power BI Desktop
// Generated for SciAI bibliometric snapshot (${currentDataset?.name || "Dataset"})
let
    // 1. Fetch version-pinned JSON feed from SciAI
    Source = Json.Document(Web.Contents("${liveFeedUrl}")),

    // 2. Extract Fact_Documents Table
    Fact_Documents_Raw = Source[Fact_Documents],
    #"Converted to Table" = Table.FromList(Fact_Documents_Raw, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {
        "DocumentID", "Title", "Authors", "FirstAuthor", "AuthorCount",
        "Year", "PublicationDate", "JournalSource", "Citations",
        "CitationImpactTier", "DOI", "Country", "IsInternationalCollaboration",
        "DatabaseSource", "BradfordZone", "PrimaryKeyword"
    }),

    // 3. Strongly Typed Schema Definition for Power BI
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded Column", {
        {"DocumentID", type text},
        {"Title", type text},
        {"Authors", type text},
        {"FirstAuthor", type text},
        {"AuthorCount", Int64.Type},
        {"Year", Int64.Type},
        {"PublicationDate", type date},
        {"JournalSource", type text},
        {"Citations", Int64.Type},
        {"CitationImpactTier", type text},
        {"DOI", type text},
        {"Country", type text},
        {"IsInternationalCollaboration", type logical},
        {"DatabaseSource", type text},
        {"BradfordZone", type text},
        {"PrimaryKeyword", type text}
    })
in
    #"Changed Type"`;

  const powerQueryAuthorsScript = `let
    Source = Json.Document(Web.Contents("${originUrl}/api/powerbi/tables/authors?dataset_id=${encodeURIComponent(currentDatasetId)}${versionQuery}")),
    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {
        "AuthorName", "TotalPublications", "TotalCitations", "AverageCitationsPerPaper", "HIndex", "LeadAffiliation"
    }),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded Column",{
        {"AuthorName", type text},
        {"TotalPublications", Int64.Type},
        {"TotalCitations", Int64.Type},
        {"AverageCitationsPerPaper", type number},
        {"HIndex", Int64.Type},
        {"LeadAffiliation", type text}
    })
in
    #"Changed Type"`;

  const powerQuerySourcesScript = `let
    Source = Json.Document(Web.Contents("${originUrl}/api/powerbi/tables/sources?dataset_id=${encodeURIComponent(currentDatasetId)}${versionQuery}")),
    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {
        "JournalSource", "TotalArticles", "TotalCitations", "AverageCitations", "BradfordZone", "CumulativeArticleSharePercent"
    }),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded Column",{
        {"JournalSource", type text},
        {"TotalArticles", Int64.Type},
        {"TotalCitations", Int64.Type},
        {"AverageCitations", type number},
        {"BradfordZone", type text},
        {"CumulativeArticleSharePercent", type number}
    })
in
    #"Changed Type"`;

  // Filtered simulator data
  const rawDocs: any[] = powerBiData?.Fact_Documents || [];
  const filteredSimDocs = rawDocs.filter((doc) => {
    if (simSourceFilter !== "ALL" && doc.DatabaseSource !== simSourceFilter) return false;
    if (simBradfordFilter !== "ALL" && !doc.BradfordZone.startsWith(simBradfordFilter)) return false;
    if (simImpactFilter !== "ALL" && !doc.CitationImpactTier.startsWith(simImpactFilter)) return false;
    if (simIntlOnly && !doc.IsInternationalCollaboration) return false;
    if (simSearchText.trim()) {
      const q = simSearchText.toLowerCase();
      const match =
        doc.Title?.toLowerCase().includes(q) ||
        doc.Authors?.toLowerCase().includes(q) ||
        doc.JournalSource?.toLowerCase().includes(q) ||
        doc.PrimaryKeyword?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const simTotalCitations = filteredSimDocs.reduce((acc, d) => acc + (d.Citations || 0), 0);
  const simAvgCitations = filteredSimDocs.length > 0 ? (simTotalCitations / filteredSimDocs.length).toFixed(1) : "0";
  const simIntlCount = filteredSimDocs.filter((d) => d.IsInternationalCollaboration).length;
  const simIntlRate = filteredSimDocs.length > 0 ? ((simIntlCount / filteredSimDocs.length) * 100).toFixed(1) : "0";
  const simZone1Count = filteredSimDocs.filter((d) => d.BradfordZone?.includes("Zone 1")).length;
  const simZone1Rate = filteredSimDocs.length > 0 ? ((simZone1Count / filteredSimDocs.length) * 100).toFixed(1) : "0";

  // Group by Year for mini chart in simulator
  const yearCounts: Record<number, number> = {};
  filteredSimDocs.forEach((d) => {
    yearCounts[d.Year] = (yearCounts[d.Year] || 0) + 1;
  });
  const sortedYears = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
  const maxYearVal = Math.max(...Object.values(yearCounts), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-500/10 via-white to-amber-50/40 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-amber-100 pb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 text-xs shadow-2xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Microsoft Power BI Web Export
              </span>
              <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
                JSON Web Import
              </span>
              <span className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-mono">
                Versioned research snapshots
              </span>
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Power BI Research Intelligence Export
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Import bibliometric snapshots and approved organizational or external reference tables into Power BI Desktop. Dataset versions and source provenance are available for reproducible reporting; refresh your Power BI import after a new snapshot is added.
            </p>
          </div>

          {/* Quick Connect & PBIDS Download Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPbids}
              className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 text-xs font-black transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Download Connector (.pbids)</span>
            </button>

            <button
              type="button"
              onClick={handlePingEndpoint}
              className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-2.5 text-xs font-bold transition shadow-2xs"
            >
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Check JSON Feed</span>
            </button>
          </div>
        </div>

        {/* Live URL & Dataset Switcher Row */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          {/* Dataset Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Active Dataset:
            </label>
            <select
              value={currentDatasetId}
              onChange={(e) => onSelectDataset && onSelectDataset(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-hidden"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count || 0} records)
                </option>
              ))}
            </select>
          </div>

          {/* Live Endpoint Copy Box */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Web Import URL for Power BI:
              </label>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Snapshot available
              </span>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 pl-3 shadow-2xs">
              <input
                type="text"
                readOnly
                value={liveFeedUrl}
                className="w-full bg-transparent font-mono text-xs text-slate-800 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleCopy(liveFeedUrl, "feedUrl")}
                className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                {copiedField === "feedUrl" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === "feedUrl" ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Ping Status Alert */}
        {pingStatus.status !== "idle" && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs flex items-center justify-between border ${
              pingStatus.status === "testing"
                ? "bg-slate-100 border-slate-200 text-slate-700"
                : pingStatus.status === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {pingStatus.status === "testing" && <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />}
              {pingStatus.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {pingStatus.status === "error" && <Info className="h-4 w-4 text-rose-600" />}
              <span>{pingStatus.message || "Checking the JSON feed..."}</span>
            </div>
            {pingStatus.latency && (
              <span className="font-mono text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                Ping: {pingStatus.latency}ms
              </span>
            )}
          </div>
        )}

        {powerBiData?.feedMetadata && (
          <p className="mt-3 text-xs text-slate-600" role="status">
            Dataset version: {powerBiData.feedMetadata.dataset_version_id || "Not available"} ·
            Source date: {powerBiData.feedMetadata.last_sync || "Not available"} ·
            {powerBiData.feedMetadata.total_records} records. Approximated metrics require expert review.
          </p>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "overview"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>1. Data Model & Star Schema</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "sources" ? "bg-slate-900 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Organizational & External Sources</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("combined")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "combined" ? "bg-indigo-700 text-white shadow-2xs" : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
          }`}
        >
          <GitMerge className="h-3.5 w-3.5" />
          <span>Combined Evidence Model</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "simulator"
              ? "bg-amber-500 text-slate-950 font-black shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>2. Snapshot Slicer Preview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tables")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "tables"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <TableIcon className="h-3.5 w-3.5" />
          <span>3. Table Feed Inspector</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("powerquery")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "powerquery"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>4. Power Query M Scripts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dax")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "dax"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>5. Executive DAX Measures</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "guide"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>6. Integration Guide</span>
        </button>
      </div>

      {activeTab === "sources" && <PowerBIDataSources />}
      {activeTab === "combined" && <PowerBICombinedEvidence datasetId={currentDatasetId} datasetVersionId={selectedVersionId} />}

      {/* TAB 1: OVERVIEW & STAR SCHEMA ARCHITECTURE */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive Value Proposition Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                <span>Interactive Preview</span>
                <Filter className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">Instant Filtering</div>
              <p className="mt-1 text-xs text-slate-500">
                Simultaneous cross-filtering across publication years, authors, databases (Scopus/WoS), and Bradford zones.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                <span>Star Schema</span>
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">Relational Modeling</div>
              <p className="mt-1 text-xs text-slate-500">
                Central Fact_Documents table cleanly mapped to dimension tables (Dim_Authors, Dim_Sources, Dim_Thematics).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                <span>KPI Metrics</span>
                <Award className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">Executive KPI Cards</div>
              <p className="mt-1 text-xs text-slate-500">
                Pre-aggregated publication, citation and author metrics are available; treat modeled collaboration as an approximation.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                <span>Import Refresh</span>
                <RefreshCw className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">Source-controlled</div>
              <p className="mt-1 text-xs text-slate-500">
                Create a new source snapshot in SciAI, then refresh your Power BI Desktop import manually.
              </p>
            </div>
          </div>

          {/* Visual Star-Schema Architecture */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Relational Star-Schema Architecture in Power BI
                </h3>
                <p className="text-xs text-slate-500">
                  Review keys and relationships manually before combining tables in Power BI. Author names are not unique identifiers.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchLiveModel}
                disabled={loadingModel}
                className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingModel ? "animate-spin" : ""}`} />
                <span>Reload snapshot preview</span>
              </button>
            </div>

            {/* Diagram */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Left Dimensions */}
                <div className="space-y-4">
                  {/* Dim_Authors */}
                  <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-indigo-700 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Dim_Authors
                      </span>
                      <span className="font-mono text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded">AuthorName (not a stable ID)</span>
                    </div>
                    <ul className="mt-2 text-[11px] text-slate-600 space-y-1 font-mono">
                      <li>• TotalPublications (Int64)</li>
                      <li>• TotalCitations (Int64)</li>
                      <li>• HIndex (Int64)</li>
                      <li>• LeadAffiliation (Text)</li>
                    </ul>
                  </div>

                  {/* Dim_Sources */}
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-emerald-700 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Dim_Sources
                      </span>
                      <span className="font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">JournalSource (review key)</span>
                    </div>
                    <ul className="mt-2 text-[11px] text-slate-600 space-y-1 font-mono">
                      <li>• TotalArticles (Int64)</li>
                      <li>• BradfordZone (Zone 1/2/3)</li>
                      <li>• CumulativeShare %</li>
                    </ul>
                  </div>
                </div>

                {/* Central FACT Table */}
                <div className="rounded-3xl border-2 border-amber-500 bg-linear-to-b from-amber-50/40 to-white p-5 shadow-sm text-center">
                  <span className="inline-block rounded-md bg-amber-500 text-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider mb-2">
                    Central Fact Table
                  </span>
                  <h4 className="text-base font-black text-slate-900">Fact_Documents</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {powerBiData?.Fact_Documents?.length || 0} Enriched Bibliographic Records
                  </p>

                  <div className="mt-4 text-left font-mono text-[11px] text-slate-700 bg-white rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-52 overflow-y-auto">
                    <div className="font-bold text-amber-700">PK: DocumentID (Text)</div>
                    <div>FK: JournalSource (Text)</div>
                    <div>FK: FirstAuthor (Text)</div>
                    <div>Title (Text)</div>
                    <div>Year (Int64)</div>
                    <div>Citations (Int64)</div>
                    <div>CitationImpactTier (Text)</div>
                    <div>BradfordZone (Text)</div>
                    <div>IsInternational (Logical)</div>
                    <div>DatabaseSource (Text)</div>
                    <div>PrimaryKeyword (Text)</div>
                  </div>
                </div>

                {/* Right Dimensions */}
                <div className="space-y-4">
                  {/* Dim_Thematics */}
                  <div className="rounded-2xl border border-purple-200 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-purple-700 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> Dim_ThematicClusters
                      </span>
                      <span className="font-mono text-[10px] bg-purple-50 px-1.5 py-0.5 rounded">Callon Matrix</span>
                    </div>
                    <ul className="mt-2 text-[11px] text-slate-600 space-y-1 font-mono">
                      <li>• Keyword (Text)</li>
                      <li>• Frequency (Int64)</li>
                      <li>• CallonQuadrant (Q1-Q4)</li>
                      <li>• CentralityScore (Double)</li>
                    </ul>
                  </div>

                  {/* Fact_ExecutiveKPIs */}
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-amber-800 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5" /> Fact_ExecutiveKPIs
                      </span>
                      <span className="font-mono text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded">1-Row Cards</span>
                    </div>
                    <ul className="mt-2 text-[11px] text-slate-700 space-y-1 font-mono">
                      <li>• TotalPublications & Citations</li>
                      <li>• BradfordCoreCount</li>
                      <li>• IntlCollabPercent</li>
                      <li>• SynchronizedTimestamp</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE INTERACTIVE POWER BI DASHBOARD & SLICER SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 flex items-start gap-3">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Power BI Behavior Simulator:</strong> The controls and slicers below reproduce the native behavior of interactive slicers in Power BI Desktop. Changing any filter immediately recalculates executive KPI cards, temporal trends, and detailed records.
            </div>
          </div>

          {/* Interactive Slicers Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900">Dynamic Power BI Slicers</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSimSourceFilter("ALL");
                  setSimBradfordFilter("ALL");
                  setSimImpactFilter("ALL");
                  setSimIntlOnly(false);
                  setSimSearchText("");
                }}
                className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Reset All Slicers
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Slicer 1: Database Source */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Database Source:
                </label>
                <select
                  value={simSourceFilter}
                  onChange={(e) => setSimSourceFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Databases</option>
                  <option value="WOS">Web of Science</option>
                  <option value="SCOPUS">Scopus</option>
                  <option value="PUBMED">PubMed</option>
                  <option value="OPENALEX">OpenAlex</option>
                  <option value="DIMENSIONS">Dimensions</option>
                  <option value="LENS">Lens.org</option>
                </select>
              </div>

              {/* Slicer 2: Bradford Zone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Bradford Zone:
                </label>
                <select
                  value={simBradfordFilter}
                  onChange={(e) => setSimBradfordFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Zones</option>
                  <option value="Zone 1">Zone 1 (Core Journals)</option>
                  <option value="Zone 2">Zone 2 (Moderate Yield)</option>
                  <option value="Zone 3">Zone 3 (Long-tail)</option>
                </select>
              </div>

              {/* Slicer 3: Impact Tier */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Citation Impact Tier:
                </label>
                <select
                  value={simImpactFilter}
                  onChange={(e) => setSimImpactFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Citation Tiers</option>
                  <option value="Top 1%">Top 1% Super Citation (500+)</option>
                  <option value="Top 10%">Top 10% High Impact (150+)</option>
                  <option value="Moderate">Moderate Impact (30-149)</option>
                  <option value="Low">Low Citation Volume (1-29)</option>
                  <option value="Uncited">Uncited (0)</option>
                </select>
              </div>

              {/* Slicer 4: Search keyword */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Keyword & Title Search:
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Title, author, journal..."
                    value={simSearchText}
                    onChange={(e) => setSimSearchText(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Slicer 5: International toggle */}
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={simIntlOnly}
                    onChange={(e) => setSimIntlOnly(e.target.checked)}
                    className="rounded text-amber-600 accent-amber-600 h-4 w-4"
                  />
                  <span>International Collab Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Dynamic Power BI Executive KPI Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Filtered Documents
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-slate-900">
                {filteredSimDocs.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Out of {rawDocs.length} total records
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Citations
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-amber-600">
                {simTotalCitations.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Aggregated citations for slice</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mean Citations
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-indigo-600">
                {simAvgCitations}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Citations per article</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Intl Collaboration (%)
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-emerald-600">
                {simIntlRate}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{simIntlCount} cross-border papers</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bradford Zone 1 Share
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-purple-600">
                {simZone1Rate}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{simZone1Count} papers in core journals</div>
            </div>
          </div>

          {/* Visual Simulation Chart: Temporal Distribution */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Publication Trends (Power BI Column Chart Visual)
                </h4>
                <p className="text-xs text-slate-500">
                  Instant reactivity reflecting slicers across publication years
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                DAX on imported data
              </span>
            </div>

            <div className="h-44 flex items-end gap-3 pt-6 pb-2 px-4 bg-slate-50/70 rounded-2xl border border-slate-100">
              {sortedYears.map((yr) => {
                const count = yearCounts[yr] || 0;
                const pct = (count / maxYearVal) * 100;
                return (
                  <div key={yr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[10px] font-mono font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition">
                      {count}
                    </div>
                    <div
                      className="w-full rounded-t-lg bg-amber-500 group-hover:bg-amber-400 transition"
                      style={{ height: `${Math.max(pct, 8)}%` }}
                    />
                    <div className="text-[11px] font-mono text-slate-500 font-bold">{yr}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filtered Fact_Documents Records Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Fact_Documents snapshot preview ({filteredSimDocs.length} rows)
                </h4>
                <p className="text-xs text-slate-500">
                  Flattened and normalized data ready for Power BI detailed report tables
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Document ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Authors</th>
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3">Journal Source</th>
                    <th className="py-2.5 px-3">Bradford Zone</th>
                    <th className="py-2.5 px-3">Citations</th>
                    <th className="py-2.5 px-3">Database</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSimDocs.slice(0, 15).map((doc, i) => (
                    <tr key={i} className="hover:bg-amber-50/30 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">{doc.DocumentID}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 max-w-xs truncate">{doc.Title}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{doc.Authors}</td>
                      <td className="py-2.5 px-3 font-mono">{doc.Year}</td>
                      <td className="py-2.5 px-3 text-slate-700 truncate max-w-[150px]">{doc.JournalSource}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            doc.BradfordZone?.includes("Zone 1")
                              ? "bg-emerald-100 text-emerald-800"
                              : doc.BradfordZone?.includes("Zone 2")
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {doc.BradfordZone?.split(" ")[0]} {doc.BradfordZone?.split(" ")[1]}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{doc.Citations}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{doc.DatabaseSource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredSimDocs.length > 15 && (
              <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
                Displaying 15 of {filteredSimDocs.length} filtered records in the selected dataset version.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TABLE INSPECTOR */}
      {activeTab === "tables" && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
            {(["Fact_Documents", "Dim_Authors", "Dim_Sources", "Dim_ThematicClusters", "Dim_GeographicCollaborations", "Fact_ExecutiveKPIs"] as const).map(
              (tableName) => (
                <button
                  key={tableName}
                  type="button"
                  onClick={() => setSelectedTableTab(tableName)}
                  className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    selectedTableTab === tableName
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tableName} ({powerBiData?.[tableName]?.length || 0})
                </button>
              )
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Snapshot Preview: {selectedTableTab}
                </h3>
                <p className="text-xs text-slate-500">
                  Clean JSON data structure ingested and expanded directly by Power Query.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `${originUrl}/api/powerbi/tables/${selectedTableTab.toLowerCase()}?dataset_id=${currentDatasetId}`,
                    "singleTableUrl"
                  )
                }
                className="cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg"
              >
                {copiedField === "singleTableUrl" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copy Direct Endpoint URL</span>
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200">
              <pre className="bg-slate-950 text-slate-200 p-4 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(powerBiData?.[selectedTableTab]?.slice(0, 10) || [], null, 2)}
              </pre>
            </div>
            <div className="text-[11px] text-slate-400 text-right">
              Showing the first 10 records in this dataset version.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: POWER QUERY M SCRIPTS */}
      {activeTab === "powerquery" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
            <strong>How to use in Power BI Desktop:</strong> Open Power BI Desktop, click <code>Transform Data</code> in the <code>Home</code> ribbon, select <code>New Source &gt; Blank Query</code> from the left pane, and click <code>Advanced Editor</code> on the Home tab. Paste the M script below and click Done!
          </div>

          {/* Master Script */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Comprehensive Power Query Script for Fact_Documents (with Automatic Type-Casting)
                </h3>
                <p className="text-xs text-slate-500">
                  Defines all column schemas with explicit types (Text, Int64, Date, Logical) for instantaneous modeling.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(powerQueryMasterScript, "pqMaster")}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3.5 py-2 text-xs font-bold hover:bg-slate-800 transition"
              >
                {copiedField === "pqMaster" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === "pqMaster" ? "Copied!" : "Copy M Script"}</span>
              </button>
            </div>

            <pre className="rounded-2xl bg-slate-950 p-4 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-88">
              {powerQueryMasterScript}
            </pre>
          </div>

          {/* Authors Script */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Author Dimension Query: Dim_Authors
                </h3>
                <p className="text-xs text-slate-500">
                  Includes individual h-index scores and productivity counts for hierarchical drill-downs.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(powerQueryAuthorsScript, "pqAuthors")}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3.5 py-2 text-xs font-bold hover:bg-slate-800 transition"
              >
                {copiedField === "pqAuthors" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === "pqAuthors" ? "Copied!" : "Copy M Script"}</span>
              </button>
            </div>

            <pre className="rounded-2xl bg-slate-950 p-4 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-60">
              {powerQueryAuthorsScript}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 5: DAX MEASURES VAULT */}
      {activeTab === "dax" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 leading-relaxed">
            <strong>Executive DAX Measures Vault:</strong> Standard DAX formulas to build executive KPI cards and dynamic aggregations directly inside Power BI without manual computations.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Measure 1 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Total Citations</span>
                <button
                  type="button"
                  onClick={() => handleCopy("Total Citations = SUM(Fact_Documents[Citations])", "dax1")}
                  className="cursor-pointer text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  {copiedField === "dax1" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "dax1" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="rounded-xl bg-slate-950 p-3 text-amber-400 font-mono text-xs overflow-x-auto">
                {`Total Citations = SUM(Fact_Documents[Citations])`}
              </pre>
              <p className="text-[11px] text-slate-500">
                Calculates total citations responsive to active report filters and dashboard slicers.
              </p>
            </div>

            {/* Measure 2 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Average Citations Per Document</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      "Average Citation Rate = DIVIDE([Total Citations], COUNTROWS(Fact_Documents), 0)",
                      "dax2"
                    )
                  }
                  className="cursor-pointer text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  {copiedField === "dax2" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "dax2" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="rounded-xl bg-slate-950 p-3 text-amber-400 font-mono text-xs overflow-x-auto">
                {`Average Citation Rate = DIVIDE([Total Citations], COUNTROWS(Fact_Documents), 0)`}
              </pre>
              <p className="text-[11px] text-slate-500">
                Weighted citation rate evaluating publication impact across selected periods or sources.
              </p>
            </div>

            {/* Measure 3 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">International Collaboration Share (%)</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `International Collab Rate % = 
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[IsInternationalCollaboration] = TRUE()),
    COUNTROWS(Fact_Documents),
    0
)`,
                      "dax3"
                    )
                  }
                  className="cursor-pointer text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  {copiedField === "dax3" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "dax3" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="rounded-xl bg-slate-950 p-3 text-amber-400 font-mono text-xs overflow-x-auto">
                {`International Collab Rate % = 
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[IsInternationalCollaboration] = TRUE()),
    COUNTROWS(Fact_Documents),
    0
)`}
              </pre>
              <p className="text-[11px] text-slate-500">
                Ratio of cross-border collaborative research, a vital metric for international university rankings.
              </p>
            </div>

            {/* Measure 4 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">High Impact Share (Top 10% Share %)</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `High Impact Share % = 
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[CitationImpactTier] IN {"Top 1% Super Citation (500+)", "Top 10% High Impact (150-499)"}),
    COUNTROWS(Fact_Documents),
    0
)`,
                      "dax4"
                    )
                  }
                  className="cursor-pointer text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  {copiedField === "dax4" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "dax4" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="rounded-xl bg-slate-950 p-3 text-amber-400 font-mono text-xs overflow-x-auto">
                {`High Impact Share % = 
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[CitationImpactTier] IN {"Top 1% Super Citation (500+)", "Top 10% High Impact (150-499)"}),
    COUNTROWS(Fact_Documents),
    0
)`}
              </pre>
              <p className="text-[11px] text-slate-500">
                Percentage of publications reaching top-tier highly cited impact brackets.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: STEP-BY-STEP POWER BI INTEGRATION GUIDE */}
      {activeTab === "guide" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Step-by-Step Power BI Desktop JSON Import Guide
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Local single-operator Web Import is available with the explicit development authentication bypass. Remote access requires an approved gateway and credential flow; never put API tokens in URLs or PBIDS files.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Method A: 1-Click PBIDS */}
            <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-50/30 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                  A
                </span>
                <h4 className="font-black text-slate-900 text-sm">
                  Instant Method: Pre-configured Connector File (.pbids)
                </h4>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
                <li>Click the orange button at the top: <strong>"Download Connector (.pbids)"</strong>.</li>
                <li>Double-click the downloaded file; <strong>Power BI Desktop</strong> launches automatically.</li>
                <li>On an explicitly configured local development server only, choose <strong>Anonymous</strong>. On a hosted server, use an approved authenticated gateway; the PBIDS file contains no credentials.</li>
                <li>In Power Query, select and expand the JSON tables; relationships and refresh settings must be configured manually.</li>
              </ol>
              <button
                type="button"
                onClick={handleDownloadPbids}
                className="cursor-pointer w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 text-xs transition shadow-2xs"
              >
                Download PBIDS File Directly
              </button>
            </div>

            {/* Method B: Get Data Web */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                  B
                </span>
                <h4 className="font-black text-slate-900 text-sm">
                  Standard Method: Get Data &gt; Web Feed
                </h4>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
                <li>In Power BI Desktop, navigate to <strong>Get Data</strong> and select <strong>Web</strong>.</li>
                <li>Paste the JSON feed URL below:
                  <div className="my-1.5 p-2 rounded bg-white border border-slate-200 font-mono text-[10px] break-all select-all">
                    {liveFeedUrl}
                  </div>
                </li>
                <li>Choose <strong>Anonymous</strong> only for a local development server with authentication bypass enabled. A protected server requires an approved gateway.</li>
                <li>In Power Query, expand the <code>Fact_Documents</code> records and click <strong>Close &amp; Apply</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
