import React, { useState, useEffect, useRef } from "react";
import {
  Project,
  Dataset,
  DatasetVersion,
  Analysis,
  Capability,
} from "./types.js";
import {
  validateAnalysisSubmission,
  VersionFetchStatus,
} from "./utils/versionSelection.js";
import {
  validateDashboardResponse,
  validateCapabilitiesResponse,
  validateAnalysisRunResponse,
  validateVersionsList,
} from "./utils/responseValidation.js";
import { Sidebar, NavTab } from "./components/Sidebar.js";
import { Header } from "./components/Header.js";
import { MetricCard, SectionHeader, StatusBadge, EmptyState } from "./components/CommonUI.js";
import { AnalysisResultPanel } from "./components/AnalysisResultPanel.js";
import { OverviewView } from "./components/OverviewView.js";
import { VisualizerChart } from "./components/VisualizerChart.js";
import { NetworkGraph } from "./components/NetworkGraph.js";
import { RunAnalysisModal, UploadDatasetModal } from "./components/Modals.js";
import { DatasetsView } from "./components/DatasetsView.js";
import { CorpusPipelineStudio, PipelineStep } from "./components/CorpusPipelineStudio.js";
import { DataHygieneStudio } from "./components/DataHygieneStudio.js";
import { DescriptiveAnalyticsStudio } from "./components/DescriptiveAnalyticsStudio.js";
import { EntityExplorerStudio } from "./components/EntityExplorerStudio.js";
import { AnalysesListView } from "./components/AnalysesListView.js";
import { AiIntelligenceView } from "./components/AiIntelligenceView.js";
import { SmartMergeStudio } from "./components/SmartMergeStudio.js";
import { OpenAlexExplorer } from "./components/OpenAlexExplorer.js";
import { AuthorsWorkbench } from "./components/AuthorsWorkbench.js";
import { SourcesWorkbench } from "./components/SourcesWorkbench.js";
import { KeywordsWorkbench } from "./components/KeywordsWorkbench.js";
import { ThematicEvolutionStudio } from "./components/ThematicEvolutionStudio.js";
import { FrontierDetectionStudio } from "./components/FrontierDetectionStudio.js";
import { HistoricalGenealogyStudio } from "./components/HistoricalGenealogyStudio.js";
import { CollaborationWorkbench } from "./components/CollaborationWorkbench.js";
import { NetworkStudio } from "./components/NetworkStudio.js";
import { ExportReportsStudio } from "./components/ExportReportsStudio.js";
import { MachineLearningStudio } from "./components/MachineLearningStudio.js";
import { ComparativeBenchmarkingStudio } from "./components/ComparativeBenchmarkingStudio.js";
import { PowerBIConnectorStudio } from "./components/PowerBIConnectorStudio.js";
import { apiJson, getApiErrorMessage } from "./utils/apiClient.js";
import {
  getAnalysisCapabilityId,
  getAnalysisDatasetId,
  getCapabilityPresentation,
  getStudioRuns,
  indexVersionOwners,
} from "./utils/capabilityCatalog.js";
import {
  Database,
  FileText,
  Activity,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Users,
  Quote,
  Hash,
  Share2,
  GitMerge,
  BookOpen,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  // Modals state
  const [modal, setModal] = useState<"analysis" | "upload" | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedCapability, setSelectedCapability] = useState<string>("publication.year_distribution");
  const [running, setRunning] = useState(false);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [versionsStatus, setVersionsStatus] = useState<VersionFetchStatus>("idle");
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionOwners, setVersionOwners] = useState<Record<string, string>>({});
  const [focusedAnalysisId, setFocusedAnalysisId] = useState<string | null>(null);
  const [entityFocus, setEntityFocus] = useState<{ dimension: "authors" | "sources" | "institutions"; key: string } | null>(null);
  const resultSectionRef = useRef<HTMLElement | null>(null);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  // Load Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, capsRes] = await Promise.all([
        fetch("/projects/3e0b5e1f-a2bc-4937-a4f6-9f47d8960a96/dashboard"),
        fetch("/api/analysis/capabilities"),
      ]);

      const dashData = dashRes.ok ? await dashRes.json() : null;
      const capsData = capsRes.ok ? await capsRes.json() : [];

      const valDash = validateDashboardResponse(dashData);
      if (valDash.success && valDash.data) {
        setProject(valDash.data.project);
        setDatasets(valDash.data.datasets);
        setAnalyses(valDash.data.analyses);
        if (!selectedDatasetId && valDash.data.datasets.length > 0) {
          setSelectedDatasetId(valDash.data.datasets[0].id);
        }
      } else {
        setMessage(valDash.error || "Dashboard payload is malformed.");
      }

      setCapabilities(validateCapabilitiesResponse(capsData));
    } catch (err) {
      console.error("Failed to load SciAI dashboard:", err);
      setMessage("Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Resolve saved analysis versions without changing the modal's selected version.
  useEffect(() => {
    if (datasets.length === 0) return;
    const controller = new AbortController();
    Promise.all(datasets.map(async (dataset) => {
      try {
        const response = await fetch(`/datasets/${encodeURIComponent(dataset.id)}/versions`, { signal: controller.signal });
        if (!response.ok) return [];
        const list = validateVersionsList(await response.json());
        return list.filter((version) => version.dataset_id === dataset.id);
      } catch {
        return [];
      }
    })).then((lists) => {
      if (!controller.signal.aborted) {
        setVersionOwners(indexVersionOwners(lists.flat()));
      }
    });
    return () => controller.abort();
  }, [datasets]);

  // When selectedDatasetId changes, load its versions with race-condition prevention
  useEffect(() => {
    if (!selectedDatasetId) {
      setVersions([]);
      setSelectedVersionId("");
      setVersionsStatus("idle");
      setVersionError(null);
      return;
    }

    // Immediately clear dependent state when selectedDatasetId changes
    setVersions([]);
    setSelectedVersionId("");
    setVersionsStatus("loading");
    setVersionError(null);

    const controller = new AbortController();
    const currentDatasetId = selectedDatasetId;

    fetch(`/datasets/${selectedDatasetId}/versions`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load dataset versions (status ${res.status})`);
        }
        return res.json();
      })
      .then((vList: unknown) => {
        if (currentDatasetId !== selectedDatasetId) return;

        const safeList = Array.isArray(vList)
          ? (vList.filter(
              (v) => v && typeof v === "object" && typeof v.id === "string"
            ) as DatasetVersion[])
          : [];

        setVersions(safeList);
        if (safeList.length > 0) {
          setVersionsStatus("success");
          setSelectedVersionId(safeList[0].id);
        } else {
          setVersionsStatus("empty");
          setSelectedVersionId("");
        }
        setVersionError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          // Aborted request: ignore silently
          return;
        }
        if (currentDatasetId !== selectedDatasetId) return;
        console.error("Error loading versions:", err);
        setVersions([]);
        setSelectedVersionId("");
        setVersionsStatus("error");
        setVersionError(
          err instanceof Error ? err.message : "Failed to load versions for dataset"
        );
      });

    return () => {
      controller.abort();
    };
  }, [selectedDatasetId]);

  // Open Analysis Modal with defaults and immediately reset stale dependent state
  const openAnalysisModal = (capabilityId?: string, datasetId?: string) => {
    if (capabilityId) setSelectedCapability(capabilityId);
    const targetDataset =
      datasetId || selectedDatasetId || (datasets && datasets.length > 0 ? datasets[0].id : "");

    if (targetDataset !== selectedDatasetId) {
      setSelectedVersionId("");
      setVersions([]);
      setVersionsStatus(targetDataset ? "loading" : "idle");
      setVersionError(null);
      setSelectedDatasetId(targetDataset);
    }
    setModal("analysis");
  };

  const showAnalysisInStudio = (analysis: Analysis, datasetId: string, versionId: string) => {
    const details = getCapabilityPresentation(getAnalysisCapabilityId(analysis));
    setAnalyses((previous) => [analysis, ...previous.filter((item) => item.id !== analysis.id)]);
    setVersionOwners((previous) => ({ ...previous, [versionId]: datasetId }));
    setSelectedDatasetId(datasetId);
    setFocusedAnalysisId(analysis.id);
    setEntityFocus(details.dimension ? { dimension: details.dimension, key: analysis.id } : null);
    setActiveTab(details.destination);
    setModal(null);
    setMessage("");
  };

  useEffect(() => {
    if (!focusedAnalysisId || !resultSectionRef.current) return;
    const frame = requestAnimationFrame(() => {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultSectionRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedAnalysisId, activeTab]);

  // Run an analysis with authoritative validation before submission
  const runAnalysis = async () => {
    if (!selectedCapability) {
      setMessage("Please select an analytical method from the capability registry.");
      return;
    }

    const validation = validateAnalysisSubmission({
      selectedDatasetId,
      selectedVersionId,
      versions,
      status: versionsStatus,
    });

    if (!validation.valid) {
      setMessage(validation.error || "Cannot run analysis due to invalid selection.");
      return;
    }

    setRunning(true);
    setMessage("");

    try {
      const newAnalysis = await apiJson<any>("/api/analyses/run", {
        project_id: project?.id,
        dataset_version_id: selectedVersionId,
        capability_id: selectedCapability,
      });

      const valAnalysis = validateAnalysisRunResponse(newAnalysis);
      if (valAnalysis.success && valAnalysis.data) {
        showAnalysisInStudio(valAnalysis.data, selectedDatasetId, selectedVersionId);
      } else {
        setMessage(valAnalysis.error || "Analysis response structure was malformed.");
      }
    } catch (err: unknown) {
      console.error("Error running analysis:", err);
      setMessage(getApiErrorMessage(err, "Failed to execute analysis on server"));
    } finally {
      setRunning(false);
    }
  };

  // Quick execution shortcut for specific capability
  const quickRunCapability = async (
    capabilityId: string,
    customDatasetId?: string,
    parameters?: Record<string, unknown>
  ) => {
    const dsId = customDatasetId || selectedDatasetId || datasets[0]?.id;
    const targetDataset = datasets.find((d) => d.id === dsId) || datasets[0];
    if (!targetDataset) {
      setModal("upload");
      return;
    }

    try {
      const vRes = await fetch(`/datasets/${targetDataset.id}/versions`);
      if (!vRes.ok) {
        setMessage(`Cannot execute: failed to load versions for dataset "${targetDataset.name}".`);
        return;
      }
      const vData = await vRes.json();
      const safeList = validateVersionsList(vData);
      const version = safeList.find(
        (v) => !v.dataset_id || v.dataset_id === targetDataset.id
      );

      if (!version?.id) {
        setMessage(`Cannot execute: dataset "${targetDataset.name}" has no snapshot versions.`);
        return;
      }

      const newAnalysis = await apiJson<any>("/api/analyses/run", {
        project_id: project?.id,
        dataset_version_id: version.id,
        capability_id: capabilityId,
        parameters: parameters || {},
      });

      const valAnalysis = validateAnalysisRunResponse(newAnalysis);
      if (valAnalysis.success && valAnalysis.data) {
        showAnalysisInStudio(valAnalysis.data, targetDataset.id, version.id);
      } else {
        setMessage(valAnalysis.error || "Execution returned invalid analysis structure.");
      }
    } catch (err: unknown) {
      console.error("Quick run failed:", err);
      setMessage(getApiErrorMessage(err, "Failed to execute analysis on server"));
    }
  };

  // Find analysis by capability
  const findAnalysisByCapability = (capId: string) => {
    return analyses.find(
      (a) => a.capability_id === capId || a.analysis_type === capId
    );
  };

  // Total documents across datasets
  const totalDocs = (datasets || []).reduce((sum, d) => sum + (d.record_count || 0), 0);
  const resultStudio: NavTab = ["authors", "sources", "keywords"].includes(activeTab)
    ? "entities"
    : activeTab === "analyses" ? "descriptive" : activeTab;
  const studioRuns = getStudioRuns(analyses, resultStudio, selectedDataset?.id || "", versionOwners);
  const focusedStudioAnalysis = studioRuns.find((analysis) => analysis.id === focusedAnalysisId);

  // Tab switching helper for capabilities
  const renderCapabilityView = (
    capId: string,
    title: string,
    description: string
  ) => {
    const matched = findAnalysisByCapability(capId);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => quickRunCapability(capId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Re-run Analysis
          </button>
        </div>

        {matched ? (
          <AnalysisResultPanel
            analysis={matched}
            onRefresh={() => quickRunCapability(capId)}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <EmptyState
              title={`No analysis run for ${title}`}
              description="Click the button below to compute these scientometric indicators on your current dataset."
              action={`Run ${title}`}
              onAction={() => quickRunCapability(capId)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans antialiased selection:bg-slate-950 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        project={project || undefined}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Container */}
      <div className="w-full lg:pl-64">
        {/* Header */}
        <Header
          activeTab={activeTab}
          onRefresh={loadDashboard}
          onOpenUpload={() => {
            setMessage("");
            setModal("upload");
          }}
          onOpenRunAnalysis={() => openAnalysisModal()}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />

        {/* Page Content */}
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          {/* Notification Banner */}
          {message && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-2xs">
              <span>{message}</span>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          )}

          {/* VIEW: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              <OverviewView
                datasets={datasets}
                analyses={analyses}
                capabilities={capabilities}
                loading={loading}
                onQuickRun={quickRunCapability}
                onOpenRunAnalysis={() => openAnalysisModal()}
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                  if (tab === "openalex") {
                    setMessage("OpenAlex Explorer launched inside Dataset & Corpus Pipeline.");
                  } else if (tab === "merge") {
                    setMessage("Smart Merge Studio launched inside Dataset & Corpus Pipeline.");
                  } else {
                    setMessage("");
                  }
                }}
                onOpenUpload={() => setModal("upload")}
              />
            </div>
          )}

          {/* VIEW: PHASE 1 - CORPUS & DATA PIPELINE (UNIFIED) */}
          {(activeTab === "corpus-pipeline" ||
            activeTab === "data-hygiene" ||
            activeTab === "datasets" ||
            activeTab === "openalex" ||
            activeTab === "merge") && (
            <CorpusPipelineStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              onOpenUpload={() => setModal("upload")}
              onRefreshData={loadDashboard}
              onRunAnalysisForDataset={(datasetId) => openAnalysisModal(undefined, datasetId)}
              onDatasetDeleted={(deletedId) => {
                setDatasets((prev) => prev.filter((d) => d.id !== deletedId));
                setMessage("Dataset successfully deleted.");
                loadDashboard();
              }}
              initialStep={
                activeTab === "openalex"
                  ? "openalex"
                  : activeTab === "merge"
                  ? "merge"
                  : activeTab === "data-hygiene"
                  ? "hygiene"
                  : "repository"
              }
            />
          )}

          {/* VIEW: PHASE 2 - DESCRIPTIVE ANALYTICS */}
          {(activeTab === "descriptive" || activeTab === "analyses") && (
            <DescriptiveAnalyticsStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              analyses={analyses}
              onQuickRun={quickRunCapability}
            />
          )}

          {/* VIEW: PHASE 3 - ENTITY EXPLORER */}
          {(activeTab === "entities" ||
            activeTab === "authors" ||
            activeTab === "sources" ||
            activeTab === "keywords") && (
            <EntityExplorerStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              focusDimension={entityFocus?.dimension || (activeTab === "sources" ? "sources" : "authors")}
              focusKey={entityFocus?.key || activeTab}
            />
          )}

          {/* VIEW: THEMATIC EVOLUTION & SLICING (PHASE 7) */}
          {activeTab === "thematic" && (
            <ThematicEvolutionStudio
              datasets={datasets}
              activeDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              onNavigateToFrontier={() => setActiveTab("frontier")}
            />
          )}

          {/* VIEW: DYNAMICS & FRONTIER DETECTION (KLEINBERG BURST & SLEEPING BEAUTIES) */}
          {activeTab === "frontier" && (
            <FrontierDetectionStudio
              datasets={datasets}
              activeDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              onNavigateToThematic={() => setActiveTab("thematic")}
            />
          )}

          {/* VIEW: HISTCITE & RPYS (HISTORICAL GENEALOGY & SPECTROSCOPY) */}
          {activeTab === "historical" && (
            <HistoricalGenealogyStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
            />
          )}

          {/* VIEW: COLLABORATION & NETWORK STUDIO (VOSVIEWER / BIBLIOMETRIX) */}
          {activeTab === "collaboration" && (
            <NetworkStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
            />
          )}

          {/* VIEW: MACHINE LEARNING STUDIO */}
          {activeTab === "ml" && (
            <MachineLearningStudio
              dataset={selectedDataset}
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              analyses={analyses}
              onTriggerAnalysis={(capId) => quickRunCapability(capId, selectedDataset?.id)}
            />
          )}

          {/* VIEW: COMPARATIVE BENCHMARKING STUDIO (BIBLIUM) */}
          {activeTab === "benchmark" && (
            <ComparativeBenchmarkingStudio
              datasets={datasets}
            />
          )}

          {/* VIEW: POWER BI DIRECT LIVE CONNECTOR */}
          {activeTab === "powerbi" && (
            <PowerBIConnectorStudio
              datasets={datasets}
              selectedDatasetId={selectedDataset?.id}
              onSelectDataset={setSelectedDatasetId}
              analyses={analyses}
            />
          )}

          {/* VIEW: EXECUTIVE REPORTS & EXPORT STUDIO */}
          {activeTab === "reports" && (
            <ExportReportsStudio
              dataset={selectedDataset}
              analyses={analyses}
              onNavigateToPowerBI={() => setActiveTab("powerbi")}
              onNavigateToAI={() => setActiveTab("ai")}
            />
          )}

          {/* VIEW: AI INTELLIGENCE */}
          {activeTab === "ai" && (
            <AiIntelligenceView datasets={datasets} analyses={analyses} />
          )}

          {(["descriptive", "analyses", "entities", "authors", "sources", "keywords", "collaboration", "thematic", "historical", "ml"] as NavTab[]).includes(activeTab) && (
            <section ref={resultSectionRef} tabIndex={-1} aria-label="Studio analysis results" className="mt-8 scroll-mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 outline-none sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Analysis runs in this studio</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Saved runs for {selectedDataset?.name || "the selected dataset"}; results below belong to a specific dataset version.
                  </p>
                </div>
                {resultStudio === "descriptive" && (
                  <button type="button" onClick={() => setActiveTab("thematic")} className="text-xs font-semibold text-blue-700 hover:underline">
                    Explore thematic evolution
                  </button>
                )}
              </div>
              {studioRuns.length > 0 ? (
                <>
                  <label htmlFor="studio-analysis-run" className="block text-xs font-semibold text-slate-700">Open a saved run</label>
                  <select
                    id="studio-analysis-run"
                    value={focusedStudioAnalysis?.id || ""}
                    onChange={(event) => {
                      const run = studioRuns.find((analysis) => analysis.id === event.target.value);
                      if (!run) return;
                      const owner = getAnalysisDatasetId(run, versionOwners);
                      if (owner) setSelectedDatasetId(owner);
                      const details = getCapabilityPresentation(getAnalysisCapabilityId(run));
                      setEntityFocus(details.dimension ? { dimension: details.dimension, key: run.id } : null);
                      setFocusedAnalysisId(run.id);
                      resultSectionRef.current?.scrollIntoView({ block: "start" });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <option value="">Select a run...</option>
                    {studioRuns.map((analysis) => {
                      const owner = getAnalysisDatasetId(analysis, versionOwners);
                      const datasetName = owner ? datasets.find((dataset) => dataset.id === owner)?.name || owner : "Dataset unresolved";
                      return (
                        <option key={analysis.id} value={analysis.id}>
                          {getCapabilityPresentation(getAnalysisCapabilityId(analysis)).title} — {datasetName} — {analysis.dataset_version_id || "Version unknown"} — {analysis.created_at ? new Date(analysis.created_at).toLocaleString() : analysis.id}
                        </option>
                      );
                    })}
                  </select>
                </>
              ) : (
                <p className="text-sm text-slate-500">No saved runs for this studio and dataset yet. Use Analyze Dataset to start one.</p>
              )}
              {focusedStudioAnalysis && (
                <div>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Dataset: {getAnalysisDatasetId(focusedStudioAnalysis, versionOwners)
                      ? datasets.find((dataset) => dataset.id === getAnalysisDatasetId(focusedStudioAnalysis, versionOwners))?.name || getAnalysisDatasetId(focusedStudioAnalysis, versionOwners)
                      : "Unresolved — the dataset for this historical version could not be verified"}
                    {" · "}Version ID: {focusedStudioAnalysis.dataset_version_id || "Unknown"}
                  </p>
                  <div key={focusedStudioAnalysis.id}>
                    <AnalysisResultPanel analysis={focusedStudioAnalysis} onRefresh={loadDashboard} />
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* MODAL: RUN ANALYSIS */}
      {modal === "analysis" && (
        <RunAnalysisModal
          datasets={datasets}
          versions={versions}
          versionsStatus={versionsStatus}
          versionError={versionError}
          capabilities={capabilities}
          selectedDatasetId={selectedDatasetId}
          selectedVersionId={selectedVersionId}
          selectedCapability={selectedCapability}
          running={running}
          onClose={() => setModal(null)}
          onSelectDataset={(id) => {
            if (id !== selectedDatasetId) {
              setSelectedVersionId("");
              setVersions([]);
              setVersionsStatus(id ? "loading" : "idle");
              setVersionError(null);
            }
            setSelectedDatasetId(id);
          }}
          onSelectVersion={setSelectedVersionId}
          onSelectCapability={setSelectedCapability}
          onRun={runAnalysis}
        />
      )}

      {/* MODAL: UPLOAD DATASET */}
      {modal === "upload" && (
        <UploadDatasetModal
          onClose={() => setModal(null)}
          onUploadSuccess={(msg) => {
            setMessage(msg);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
