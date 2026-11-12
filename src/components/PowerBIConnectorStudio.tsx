import React, { useState, useEffect, useRef } from "react";
import { Dataset, Analysis } from "../types.js";
import { PowerBIDataSources } from "./PowerBIDataSources.js";
import { PowerBICombinedEvidence } from "./PowerBICombinedEvidence.js";
import { ContextualExportToolbar } from "./ContextualExportToolbar.js";
import {
  BarChart3,
  Copy,
  Check,
  Download,
  RefreshCw,
  Layers,
  Database,
  Table as TableIcon,
  Code2,
  Sparkles,
  Search,
  Filter,
  Zap,
  BookOpen,
  GitMerge,
  Info,
  Users,
  Award,
} from "lucide-react";
import { AlertBanner, Button, Card } from "./CommonUI.js";

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
}: Props) {
  const currentDatasetId =
    selectedDatasetId || (datasets[0]?.id ?? "dataset-bio-1");
  const currentDataset =
    datasets.find((d) => d.id === currentDatasetId) || datasets[0];

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "sources"
    | "combined"
    | "tables"
    | "powerquery"
    | "dax"
    | "simulator"
    | "guide"
  >("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<{
    status: "idle" | "testing" | "success" | "error";
    latency?: number;
    message?: string;
  }>({
    status: "idle",
  });

  // Live Model Data fetched from backend
  const [powerBiData, setPowerBiData] = useState<any>(null);
  const currentDatasetIdRef = useRef(currentDatasetId);
  currentDatasetIdRef.current = currentDatasetId;
  const [loadingModel, setLoadingModel] = useState(false);
  const [selectedTableTab, setSelectedTableTab] = useState<
    | "Fact_Documents"
    | "Dim_Authors"
    | "Dim_Sources"
    | "Dim_ThematicClusters"
    | "Dim_GeographicCollaborations"
    | "Fact_ExecutiveKPIs"
  >("Fact_Documents");

  // Dynamic Simulator Slicers
  const [simSourceFilter, setSimSourceFilter] = useState<string>("ALL");
  const [simBradfordFilter, setSimBradfordFilter] = useState<string>("ALL");
  const [simImpactFilter, setSimImpactFilter] = useState<string>("ALL");
  const [simIntlOnly, setSimIntlOnly] = useState<boolean>(false);
  const [simSearchText, setSimSearchText] = useState<string>("");

  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  const selectedVersionId =
    powerBiData?.feedMetadata?.dataset_id === currentDatasetId
      ? powerBiData.feedMetadata.dataset_version_id
      : null;
  const versionQuery = selectedVersionId
    ? `&version_id=${encodeURIComponent(selectedVersionId)}`
    : "";
  const liveFeedUrl = `${originUrl}/api/powerbi/feed/${encodeURIComponent(currentDatasetId)}${selectedVersionId ? `?version_id=${encodeURIComponent(selectedVersionId)}` : ""}`;

  const fetchLiveModel = async () => {
    const requestedDatasetId = currentDatasetId;
    setLoadingModel(true);
    try {
      const res = await fetch(
        `/api/powerbi/feed/${encodeURIComponent(requestedDatasetId)}`
      );
      const data = res.ok ? await res.json() : null;
      if (currentDatasetIdRef.current === requestedDatasetId)
        setPowerBiData(data);
    } catch (err) {
      if (currentDatasetIdRef.current === requestedDatasetId) {
        setPowerBiData(null);
        console.error("Failed to fetch Power BI feed:", err);
      }
    } finally {
      if (currentDatasetIdRef.current === requestedDatasetId)
        setLoadingModel(false);
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
      const res = await fetch(`/api/powerbi/feed/${currentDatasetId}`, {
        method: "GET",
      });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const json = await res.json();
        setPingStatus({
          status: "success",
          latency: elapsed,
          message: `HTTP 200 OK · Response time: ${elapsed}ms · ${json.Fact_Documents?.length || 0} documents available for Web Import`,
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

  // Filtered simulator data
  const rawDocs: any[] = powerBiData?.Fact_Documents || [];
  const filteredSimDocs = rawDocs.filter((doc) => {
    if (simSourceFilter !== "ALL" && doc.DatabaseSource !== simSourceFilter)
      return false;
    if (
      simBradfordFilter !== "ALL" &&
      !doc.BradfordZone.startsWith(simBradfordFilter)
    )
      return false;
    if (
      simImpactFilter !== "ALL" &&
      !doc.CitationImpactTier.startsWith(simImpactFilter)
    )
      return false;
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

  const simTotalCitations = filteredSimDocs.reduce(
    (acc, d) => acc + (d.Citations || 0),
    0
  );
  const simAvgCitations =
    filteredSimDocs.length > 0
      ? (simTotalCitations / filteredSimDocs.length).toFixed(1)
      : "0";
  const simIntlCount = filteredSimDocs.filter(
    (d) => d.IsInternationalCollaboration
  ).length;
  const simIntlRate =
    filteredSimDocs.length > 0
      ? ((simIntlCount / filteredSimDocs.length) * 100).toFixed(1)
      : "0";
  const simZone1Count = filteredSimDocs.filter((d) =>
    d.BradfordZone?.includes("Zone 1")
  ).length;
  const simZone1Rate =
    filteredSimDocs.length > 0
      ? ((simZone1Count / filteredSimDocs.length) * 100).toFixed(1)
      : "0";

  const yearCounts: Record<number, number> = {};
  filteredSimDocs.forEach((d) => {
    yearCounts[d.Year] = (yearCounts[d.Year] || 0) + 1;
  });
  const sortedYears = Object.keys(yearCounts)
    .map(Number)
    .sort((a, b) => a - b);
  const maxYearVal = Math.max(...Object.values(yearCounts), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="sciai-studio-shell p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-status-warning-text px-2.5 py-0.5 text-xs font-black text-white shadow-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Microsoft Power BI Web Export
              </span>
              <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[11px] font-bold text-status-success-text">
                JSON Web Import
              </span>
              <span className="rounded-md border border-border-default bg-surface-canvas px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
                Versioned research snapshots
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
              Power BI Research Intelligence Export
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ink-muted sm:text-sm">
              Import bibliometric snapshots and approved organizational or
              external reference tables into Power BI Desktop. Dataset versions
              and source provenance are available for reproducible reporting;
              refresh your Power BI import after a new snapshot is added.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleDownloadPbids}
              icon={<Download className="h-4 w-4" />}
            >
              Download Connector (.pbids)
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handlePingEndpoint}
              icon={<Zap className="h-4 w-4 text-status-warning-text" />}
            >
              Check JSON Feed
            </Button>
          </div>
        </div>

        {/* Live URL & Dataset Switcher Row */}
        <div className="mt-5 grid grid-cols-1 items-center gap-4 lg:grid-cols-3">
          <div>
            <label className="sciai-kicker mb-1 block">Active Dataset:</label>
            <select
              value={currentDatasetId}
              onChange={(e) =>
                onSelectDataset && onSelectDataset(e.target.value)
              }
              className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-bold text-ink-primary focus:border-brand-500 focus:outline-none"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count || 0} records)
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="sciai-kicker">
                Web Import URL for Power BI:
              </label>
              <span className="flex items-center gap-1 text-[10px] font-bold text-status-success-text">
                <span className="h-2 w-2 rounded-full bg-status-success-text" />
                Snapshot available
              </span>
            </div>
            <div className="flex items-center rounded-xl border border-border-default bg-surface-canvas p-1 pl-3 shadow-card">
              <input
                type="text"
                readOnly
                value={liveFeedUrl}
                className="w-full select-all bg-transparent font-mono text-xs text-ink-primary focus:outline-none"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleCopy(liveFeedUrl, "feedUrl")}
                icon={
                  copiedField === "feedUrl" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
                className="shrink-0"
              >
                {copiedField === "feedUrl" ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        </div>

        {/* Ping Status Alert */}
        {pingStatus.status !== "idle" && (
          <div className="mt-4">
            <AlertBanner
              tone={
                pingStatus.status === "testing"
                  ? "info"
                  : pingStatus.status === "success"
                    ? "success"
                    : "danger"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {pingStatus.status === "testing" && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  <span>
                    {pingStatus.message || "Checking the JSON feed..."}
                  </span>
                </div>
                {pingStatus.latency && (
                  <span className="tabular-metrics rounded border border-status-success-border bg-surface-canvas px-2 py-0.5 font-mono text-[11px] font-bold text-status-success-text">
                    Ping: {pingStatus.latency}ms
                  </span>
                )}
              </div>
            </AlertBanner>
          </div>
        )}

        {powerBiData?.feedMetadata && (
          <p className="mt-3 text-xs text-ink-muted" role="status">
            Dataset version:{" "}
            {powerBiData.feedMetadata.dataset_version_id || "Not available"} ·
            Source date: {powerBiData.feedMetadata.last_sync || "Not available"}{" "}
            ·{" "}
            <span className="tabular-metrics font-semibold text-ink-primary">
              {powerBiData.feedMetadata.total_records}
            </span>{" "}
            records. Approximated metrics require expert review.
          </p>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border-default pb-2">
        {[
          { id: "overview", label: "1. Data Model & Star Schema", icon: Layers },
          {
            id: "sources",
            label: "Organizational & External Sources",
            icon: Database,
          },
          { id: "combined", label: "Combined Evidence Model", icon: GitMerge },
          { id: "simulator", label: "2. Snapshot Slicer Preview", icon: BarChart3 },
          { id: "tables", label: "3. Table Feed Inspector", icon: TableIcon },
          { id: "powerquery", label: "4. Power Query M Scripts", icon: Code2 },
          { id: "dax", label: "5. Executive DAX Measures", icon: Sparkles },
          { id: "guide", label: "6. Integration Guide", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                isActive
                  ? "bg-brand-500 text-white shadow-xs"
                  : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "sources" && <PowerBIDataSources />}
      {activeTab === "combined" && (
        <PowerBICombinedEvidence
          datasetId={currentDatasetId}
          datasetVersionId={selectedVersionId}
        />
      )}

      {/* TAB 1: OVERVIEW & STAR SCHEMA ARCHITECTURE */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="sm">
              <div className="flex items-center justify-between">
                <span className="sciai-kicker text-[11px]!">
                  Interactive Preview
                </span>
                <Filter className="h-4 w-4 text-status-warning-text" />
              </div>
              <div className="mt-2 text-lg font-black text-ink-primary">
                Instant Filtering
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Simultaneous cross-filtering across publication years, authors,
                databases (Scopus/WoS), and Bradford zones.
              </p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center justify-between">
                <span className="sciai-kicker text-[11px]!">Star Schema</span>
                <Layers className="h-4 w-4 text-brand-500" />
              </div>
              <div className="mt-2 text-lg font-black text-ink-primary">
                Relational Modeling
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Central Fact_Documents table cleanly mapped to dimension tables
                (Dim_Authors, Dim_Sources, Dim_Thematics).
              </p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center justify-between">
                <span className="sciai-kicker text-[11px]!">KPI Metrics</span>
                <Award className="h-4 w-4 text-status-success-text" />
              </div>
              <div className="mt-2 text-lg font-black text-ink-primary">
                Executive KPI Cards
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Pre-aggregated publication, citation and author metrics are
                available; treat modeled collaboration as an approximation.
              </p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center justify-between">
                <span className="sciai-kicker text-[11px]!">
                  Import Refresh
                </span>
                <RefreshCw className="h-4 w-4 text-status-info-text" />
              </div>
              <div className="mt-2 text-lg font-black text-ink-primary">
                Source-controlled
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Create a new source snapshot in SciAI, then refresh your Power
                BI Desktop import manually.
              </p>
            </Card>
          </div>

          <Card padding="lg" className="space-y-6 rounded-3xl">
            <div className="flex flex-col justify-between gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-black text-ink-primary">
                  Relational Star-Schema Architecture in Power BI
                </h3>
                <p className="text-xs text-ink-muted">
                  Review keys and relationships manually before combining tables
                  in Power BI. Author names are not unique identifiers.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={loadingModel}
                disabled={loadingModel}
                onClick={fetchLiveModel}
                icon={
                  !loadingModel ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : undefined
                }
              >
                Reload snapshot preview
              </Button>
            </div>

            <div className="rounded-2xl border border-border-default bg-surface-subtle p-6">
              <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-3">
                {/* Left Dimensions */}
                <div className="space-y-4">
                  <Card padding="sm" className="border-brand-200">
                    <div className="flex items-center justify-between text-xs font-bold text-brand-700">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Dim_Authors
                      </span>
                      <span className="rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px]">
                        AuthorName (not a stable ID)
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-secondary">
                      <li>• TotalPublications (Int64)</li>
                      <li>• TotalCitations (Int64)</li>
                      <li>• HIndex (Int64)</li>
                      <li>• LeadAffiliation (Text)</li>
                    </ul>
                  </Card>

                  <Card padding="sm" className="border-status-success-border">
                    <div className="flex items-center justify-between text-xs font-bold text-status-success-text">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Dim_Sources
                      </span>
                      <span className="rounded border border-status-success-border bg-status-success-bg px-1.5 py-0.5 font-mono text-[10px]">
                        JournalSource (review key)
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-secondary">
                      <li>• TotalArticles (Int64)</li>
                      <li>• BradfordZone (Zone 1/2/3)</li>
                      <li>• CumulativeShare %</li>
                    </ul>
                  </Card>
                </div>

                {/* Central FACT Table */}
                <div className="rounded-3xl border-2 border-brand-500 bg-gradient-to-b from-brand-50/60 to-surface-canvas p-5 text-center shadow-card">
                  <span className="mb-2 inline-block rounded-md bg-brand-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Central Fact Table
                  </span>
                  <h4 className="text-base font-black text-ink-primary">
                    Fact_Documents
                  </h4>
                  <p className="tabular-metrics mt-1 text-[11px] text-ink-muted">
                    {powerBiData?.Fact_Documents?.length || 0} Enriched
                    Bibliographic Records
                  </p>

                  <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-border-default bg-surface-canvas p-3 text-left font-mono text-[11px] text-ink-secondary">
                    <div className="font-bold text-brand-600">
                      PK: DocumentID (Text)
                    </div>
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
                  <Card padding="sm" className="border-status-info-border">
                    <div className="flex items-center justify-between text-xs font-bold text-status-info-text">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />{" "}
                        Dim_ThematicClusters
                      </span>
                      <span className="rounded border border-status-info-border bg-status-info-bg px-1.5 py-0.5 font-mono text-[10px]">
                        Callon Matrix
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-secondary">
                      <li>• Keyword (Text)</li>
                      <li>• Frequency (Int64)</li>
                      <li>• CallonQuadrant (Q1-Q4)</li>
                      <li>• CentralityScore (Double)</li>
                    </ul>
                  </Card>

                  <Card padding="sm" className="border-status-warning-border">
                    <div className="flex items-center justify-between text-xs font-bold text-status-warning-text">
                      <span className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5" /> Fact_ExecutiveKPIs
                      </span>
                      <span className="rounded border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 font-mono text-[10px]">
                        1-Row Cards
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-secondary">
                      <li>• TotalPublications &amp; Citations</li>
                      <li>• BradfordCoreCount</li>
                      <li>• IntlCollabPercent</li>
                      <li>• SynchronizedTimestamp</li>
                    </ul>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: LIVE INTERACTIVE POWER BI DASHBOARD & SLICER SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <AlertBanner tone="warning">
            <strong>Power BI Behavior Simulator:</strong> The controls and
            slicers below reproduce the native behavior of interactive slicers
            in Power BI Desktop. Changing any filter immediately recalculates
            executive KPI cards, temporal trends, and detailed records.
          </AlertBanner>

          {/* Interactive Slicers Bar */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-brand-500" />
                <h3 className="text-sm font-black text-ink-primary">
                  Dynamic Power BI Slicers
                </h3>
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
                className="cursor-pointer text-xs font-bold text-brand-500 hover:text-brand-700"
              >
                Reset All Slicers
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Database Source:
                </label>
                <select
                  value={simSourceFilter}
                  onChange={(e) => setSimSourceFilter(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-ink-primary"
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

              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Bradford Zone:
                </label>
                <select
                  value={simBradfordFilter}
                  onChange={(e) => setSimBradfordFilter(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-ink-primary"
                >
                  <option value="ALL">All Zones</option>
                  <option value="Zone 1">Zone 1 (Core Journals)</option>
                  <option value="Zone 2">Zone 2 (Moderate Yield)</option>
                  <option value="Zone 3">Zone 3 (Long-tail)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Citation Impact Tier:
                </label>
                <select
                  value={simImpactFilter}
                  onChange={(e) => setSimImpactFilter(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-ink-primary"
                >
                  <option value="ALL">All Citation Tiers</option>
                  <option value="Top 1%">Top 1% Super Citation (500+)</option>
                  <option value="Top 10%">Top 10% High Impact (150+)</option>
                  <option value="Moderate">Moderate Impact (30-149)</option>
                  <option value="Low">Low Citation Volume (1-29)</option>
                  <option value="Uncited">Uncited (0)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Keyword &amp; Title Search:
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                  <input
                    type="text"
                    placeholder="Title, author, journal..."
                    value={simSearchText}
                    onChange={(e) => setSimSearchText(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-subtle py-1.5 pl-8 pr-2.5 text-xs font-medium text-ink-primary placeholder:text-ink-subtle"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border-default bg-surface-subtle px-3 py-2 text-xs font-bold text-ink-primary hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    checked={simIntlOnly}
                    onChange={(e) => setSimIntlOnly(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand-500"
                  />
                  <span>International Collab Only</span>
                </label>
              </div>
            </div>
          </Card>

          {/* Dynamic Power BI Executive KPI Cards Strip */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Filtered Documents
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                {filteredSimDocs.length}
              </div>
              <div className="tabular-metrics mt-0.5 text-[10px] text-ink-muted">
                Out of {rawDocs.length} total records
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">Total Citations</div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-status-warning-text">
                {simTotalCitations.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-muted">
                Aggregated citations for slice
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">Mean Citations</div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-brand-500">
                {simAvgCitations}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-muted">
                Citations per article
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Intl Collaboration (%)
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-status-success-text">
                {simIntlRate}%
              </div>
              <div className="tabular-metrics mt-0.5 text-[10px] text-ink-muted">
                {simIntlCount} cross-border papers
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Bradford Zone 1 Share
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-brand-600">
                {simZone1Rate}%
              </div>
              <div className="tabular-metrics mt-0.5 text-[10px] text-ink-muted">
                {simZone1Count} papers in core journals
              </div>
            </Card>
          </div>

          {/* Visual Simulation Chart: Temporal Distribution */}
          <Card padding="lg" className="space-y-4 rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-ink-primary">
                  Publication Trends (Power BI Column Chart Visual)
                </h4>
                <p className="text-xs text-ink-muted">
                  Instant reactivity reflecting slicers across publication
                  years
                </p>
              </div>
              <span className="font-mono text-[11px] text-ink-subtle">
                DAX on imported data
              </span>
            </div>

            <div className="flex h-44 items-end gap-3 rounded-2xl border border-border-subtle bg-surface-subtle px-4 pb-2 pt-6">
              {sortedYears.map((yr) => {
                const count = yearCounts[yr] || 0;
                const pct = (count / maxYearVal) * 100;
                return (
                  <div
                    key={yr}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <div className="tabular-metrics font-mono text-[10px] font-bold text-ink-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {count}
                    </div>
                    <div
                      className="w-full rounded-t-lg bg-brand-500 transition-colors group-hover:bg-brand-600"
                      style={{ height: `${Math.max(pct, 8)}%` }}
                    />
                    <div className="tabular-metrics font-mono text-[11px] font-bold text-ink-muted">
                      {yr}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Filtered Fact_Documents Records Table */}
          <Card padding="lg" className="space-y-4 rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="tabular-metrics text-sm font-black text-ink-primary">
                  Fact_Documents snapshot preview ({filteredSimDocs.length} rows)
                </h4>
                <p className="text-xs text-ink-muted">
                  Flattened and normalized data ready for Power BI detailed
                  report tables
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-3 py-2.5">Document ID</th>
                    <th className="px-3 py-2.5">Title</th>
                    <th className="px-3 py-2.5">Authors</th>
                    <th className="px-3 py-2.5">Year</th>
                    <th className="px-3 py-2.5">Journal Source</th>
                    <th className="px-3 py-2.5">Bradford Zone</th>
                    <th className="px-3 py-2.5">Citations</th>
                    <th className="px-3 py-2.5">Database</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredSimDocs.slice(0, 15).map((doc, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-surface-subtle/70"
                    >
                      <td className="px-3 py-2.5 font-mono text-[10px] text-ink-subtle">
                        {doc.DocumentID}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2.5 font-bold text-ink-primary">
                        {doc.Title}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2.5 text-ink-muted">
                        {doc.Authors}
                      </td>
                      <td className="tabular-metrics px-3 py-2.5 font-mono">
                        {doc.Year}
                      </td>
                      <td className="max-w-[150px] truncate px-3 py-2.5 text-ink-secondary">
                        {doc.JournalSource}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            doc.BradfordZone?.includes("Zone 1")
                              ? "border-status-success-border bg-status-success-bg text-status-success-text"
                              : doc.BradfordZone?.includes("Zone 2")
                                ? "border-brand-200 bg-brand-50 text-brand-700"
                                : "border-border-default bg-surface-subtle text-ink-muted"
                          }`}
                        >
                          {doc.BradfordZone?.split(" ")[0]}{" "}
                          {doc.BradfordZone?.split(" ")[1]}
                        </span>
                      </td>
                      <td className="tabular-metrics px-3 py-2.5 font-mono font-bold text-status-warning-text">
                        {doc.Citations}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-ink-muted">
                        {doc.DatabaseSource}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredSimDocs.length > 15 && (
              <div className="tabular-metrics border-t border-border-subtle pt-2 text-center text-xs text-ink-subtle">
                Displaying 15 of {filteredSimDocs.length} filtered records in
                the selected dataset version.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: TABLE INSPECTOR */}
      {activeTab === "tables" && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border-default pb-2">
            {(
              [
                "Fact_Documents",
                "Dim_Authors",
                "Dim_Sources",
                "Dim_ThematicClusters",
                "Dim_GeographicCollaborations",
                "Fact_ExecutiveKPIs",
              ] as const
            ).map((tableName) => (
              <button
                key={tableName}
                type="button"
                onClick={() => setSelectedTableTab(tableName)}
                className={`tabular-metrics shrink-0 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  selectedTableTab === tableName
                    ? "bg-brand-500 text-white shadow-xs"
                    : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
                }`}
              >
                {tableName} ({powerBiData?.[tableName]?.length || 0})
              </button>
            ))}
          </div>

          <Card padding="lg" className="space-y-4 rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-ink-primary">
                  Snapshot Preview: {selectedTableTab}
                </h3>
                <p className="text-xs text-ink-muted">
                  Clean JSON data structure ingested and expanded directly by
                  Power Query.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  handleCopy(
                    `${originUrl}/api/powerbi/tables/${selectedTableTab.toLowerCase()}?dataset_id=${currentDatasetId}`,
                    "singleTableUrl"
                  )
                }
                icon={
                  copiedField === "singleTableUrl" ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                Copy Direct Endpoint URL
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-border-default">
              <pre className="bg-surface-dark p-4 font-mono text-[11px] leading-relaxed text-slate-200">
                {JSON.stringify(
                  powerBiData?.[selectedTableTab]?.slice(0, 10) || [],
                  null,
                  2
                )}
              </pre>
            </div>
            <div className="text-right text-[11px] text-ink-subtle">
              Showing the first 10 records in this dataset version.
            </div>
            {!loadingModel &&
              selectedVersionId &&
              Array.isArray(powerBiData?.[selectedTableTab]) && (
                <ContextualExportToolbar
                  payload={{
                    title: selectedTableTab,
                    rows: powerBiData[selectedTableTab],
                    provenance: { ...powerBiData.feedMetadata },
                    metadata: {
                      export_scope: "complete selected Power BI table",
                    },
                  }}
                />
              )}
          </Card>
        </div>
      )}

      {/* TAB 4: POWER QUERY M SCRIPTS */}
      {activeTab === "powerquery" && (
        <div className="space-y-6">
          <AlertBanner tone="info">
            <strong>How to use in Power BI Desktop:</strong> Open Power BI
            Desktop, click <code>Transform Data</code> in the <code>Home</code>{" "}
            ribbon, select <code>New Source &gt; Blank Query</code> from the
            left pane, and click <code>Advanced Editor</code> on the Home tab.
            Paste the M script below and click Done!
          </AlertBanner>

          <Card padding="lg" className="space-y-4 rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-ink-primary">
                  Comprehensive Power Query Script for Fact_Documents (with
                  Automatic Type-Casting)
                </h3>
                <p className="text-xs text-ink-muted">
                  Defines all column schemas with explicit types (Text, Int64,
                  Date, Logical) for instantaneous modeling.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleCopy(powerQueryMasterScript, "pqMaster")}
                icon={
                  copiedField === "pqMaster" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copiedField === "pqMaster" ? "Copied!" : "Copy M Script"}
              </Button>
            </div>

            <pre className="max-h-88 overflow-x-auto rounded-2xl bg-surface-dark p-4 font-mono text-xs leading-relaxed text-emerald-400">
              {powerQueryMasterScript}
            </pre>
          </Card>

          <Card padding="lg" className="space-y-4 rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-ink-primary">
                  Author Dimension Query: Dim_Authors
                </h3>
                <p className="text-xs text-ink-muted">
                  Includes individual h-index scores and productivity counts for
                  hierarchical drill-downs.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  handleCopy(powerQueryAuthorsScript, "pqAuthors")
                }
                icon={
                  copiedField === "pqAuthors" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copiedField === "pqAuthors" ? "Copied!" : "Copy M Script"}
              </Button>
            </div>

            <pre className="max-h-60 overflow-x-auto rounded-2xl bg-surface-dark p-4 font-mono text-xs leading-relaxed text-emerald-400">
              {powerQueryAuthorsScript}
            </pre>
          </Card>
        </div>
      )}

      {/* TAB 5: DAX MEASURES VAULT */}
      {activeTab === "dax" && (
        <div className="space-y-6">
          <AlertBanner tone="warning">
            <strong>Executive DAX Measures Vault:</strong> Standard DAX
            formulas to build executive KPI cards and dynamic aggregations
            directly inside Power BI without manual computations.
          </AlertBanner>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">
                  Total Citations
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      "Total Citations = SUM(Fact_Documents[Citations])",
                      "dax1"
                    )
                  }
                  className="flex cursor-pointer items-center gap-1 text-xs font-bold text-brand-500 hover:text-brand-700"
                >
                  {copiedField === "dax1" ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedField === "dax1" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-surface-dark p-3 font-mono text-xs text-amber-400">
                {`Total Citations = SUM(Fact_Documents[Citations])`}
              </pre>
              <p className="text-[11px] text-ink-muted">
                Calculates total citations responsive to active report filters
                and dashboard slicers.
              </p>
            </Card>

            <Card padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">
                  Average Citations Per Document
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      "Average Citation Rate = DIVIDE([Total Citations], COUNTROWS(Fact_Documents), 0)",
                      "dax2"
                    )
                  }
                  className="flex cursor-pointer items-center gap-1 text-xs font-bold text-brand-500 hover:text-brand-700"
                >
                  {copiedField === "dax2" ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedField === "dax2" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-surface-dark p-3 font-mono text-xs text-amber-400">
                {`Average Citation Rate = DIVIDE([Total Citations], COUNTROWS(Fact_Documents), 0)`}
              </pre>
              <p className="text-[11px] text-ink-muted">
                Weighted citation rate evaluating publication impact across
                selected periods or sources.
              </p>
            </Card>

            <Card padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">
                  International Collaboration Share (%)
                </span>
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
                  className="flex cursor-pointer items-center gap-1 text-xs font-bold text-brand-500 hover:text-brand-700"
                >
                  {copiedField === "dax3" ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedField === "dax3" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-surface-dark p-3 font-mono text-xs text-amber-400">
                {`International Collab Rate % =
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[IsInternationalCollaboration] = TRUE()),
    COUNTROWS(Fact_Documents),
    0
)`}
              </pre>
              <p className="text-[11px] text-ink-muted">
                Ratio of cross-border collaborative research, a vital metric for
                international university rankings.
              </p>
            </Card>

            <Card padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">
                  High Impact Share (Top 10% Share %)
                </span>
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
                  className="flex cursor-pointer items-center gap-1 text-xs font-bold text-brand-500 hover:text-brand-700"
                >
                  {copiedField === "dax4" ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedField === "dax4" ? "Copied" : "Copy Formula"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-surface-dark p-3 font-mono text-xs text-amber-400">
                {`High Impact Share % =
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Documents), Fact_Documents[CitationImpactTier] IN {"Top 1% Super Citation (500+)", "Top 10% High Impact (150-499)"}),
    COUNTROWS(Fact_Documents),
    0
)`}
              </pre>
              <p className="text-[11px] text-ink-muted">
                Percentage of publications reaching top-tier highly cited
                impact brackets.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 6: STEP-BY-STEP POWER BI INTEGRATION GUIDE */}
      {activeTab === "guide" && (
        <Card padding="lg" className="space-y-6 rounded-3xl">
          <div>
            <h3 className="text-base font-black text-ink-primary">
              Step-by-Step Power BI Desktop JSON Import Guide
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Local single-operator Web Import is available with the explicit
              development authentication bypass. Remote access requires an
              approved gateway and credential flow; never put API tokens in URLs
              or PBIDS files.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border-2 border-brand-500/40 bg-brand-50/40 p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">
                  A
                </span>
                <h4 className="text-sm font-black text-ink-primary">
                  Instant Method: Pre-configured Connector File (.pbids)
                </h4>
              </div>
              <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-ink-secondary">
                <li>
                  Click the primary button at the top:{" "}
                  <strong>"Download Connector (.pbids)"</strong>.
                </li>
                <li>
                  Double-click the downloaded file;{" "}
                  <strong>Power BI Desktop</strong> launches automatically.
                </li>
                <li>
                  On an explicitly configured local development server only,
                  choose <strong>Anonymous</strong>. On a hosted server, use an
                  approved authenticated gateway; the PBIDS file contains no
                  credentials.
                </li>
                <li>
                  In Power Query, select and expand the JSON tables;
                  relationships and refresh settings must be configured
                  manually.
                </li>
              </ol>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleDownloadPbids}
                className="w-full"
              >
                Download PBIDS File Directly
              </Button>
            </div>

            <div className="space-y-4 rounded-2xl border border-border-default bg-surface-subtle p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-primary text-xs font-black text-white">
                  B
                </span>
                <h4 className="text-sm font-black text-ink-primary">
                  Standard Method: Get Data &gt; Web Feed
                </h4>
              </div>
              <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-ink-secondary">
                <li>
                  In Power BI Desktop, navigate to <strong>Get Data</strong> and
                  select <strong>Web</strong>.
                </li>
                <li>
                  Paste the JSON feed URL below:
                  <div className="my-1.5 select-all break-all rounded-lg border border-border-default bg-surface-canvas p-2 font-mono text-[10px] text-ink-primary">
                    {liveFeedUrl}
                  </div>
                </li>
                <li>
                  Choose <strong>Anonymous</strong> only for a local development
                  server with authentication bypass enabled. A protected server
                  requires an approved gateway.
                </li>
                <li>
                  In Power Query, expand the <code>Fact_Documents</code> records
                  and click <strong>Close &amp; Apply</strong>.
                </li>
              </ol>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}