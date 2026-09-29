import React, { useState, useEffect } from "react";
import {
  Project,
  Dataset,
  Analysis,
  Capability,
} from "./types.js";
import {
  validateDashboardResponse,
  validateCapabilitiesResponse,
  validateAnalysisRunResponse,
  validateVersionsList,
} from "./utils/responseValidation.js";
import { Sidebar, NavTab } from "./components/Sidebar.js";
import { Header } from "./components/Header.js";
import { OverviewView } from "./components/OverviewView.js";
import { UploadDatasetModal } from "./components/Modals.js";
import { CorpusPipelineStudio } from "./components/CorpusPipelineStudio.js";
import { DescriptiveAnalyticsStudio } from "./components/DescriptiveAnalyticsStudio.js";
import { EntityExplorerStudio } from "./components/EntityExplorerStudio.js";
import { AiIntelligenceView } from "./components/AiIntelligenceView.js";
import { ThematicEvolutionStudio } from "./components/ThematicEvolutionStudio.js";
import { FrontierDetectionStudio } from "./components/FrontierDetectionStudio.js";
import { HistoricalGenealogyStudio } from "./components/HistoricalGenealogyStudio.js";
import { NetworkStudio } from "./components/NetworkStudio.js";
import { ExportReportsStudio } from "./components/ExportReportsStudio.js";
import { MachineLearningStudio } from "./components/MachineLearningStudio.js";
import { ComparativeBenchmarkingStudio } from "./components/ComparativeBenchmarkingStudio.js";
import { PowerBIConnectorStudio } from "./components/PowerBIConnectorStudio.js";
import { apiJson, getApiErrorMessage } from "./utils/apiClient.js";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  // Modals state
  const [modal, setModal] = useState<"upload" | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");

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
        setSelectedDatasetId((current) =>
          valDash.data.datasets.some((dataset) => dataset.id === current)
            ? current
            : valDash.data.datasets[0]?.id || ""
        );
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

  // Quick execution shortcut for specific capability
  const quickRunCapability = async (
    capabilityId: string,
    customDatasetId?: string,
    parameters?: Record<string, unknown>
  ): Promise<Analysis | null> => {
    const dsId = customDatasetId || selectedDatasetId || datasets[0]?.id;
    const targetDataset = datasets.find((d) => d.id === dsId);
    if (!targetDataset) {
      if (!datasets.length) setModal("upload");
      else setMessage("Cannot execute: the selected dataset is unavailable.");
      return null;
    }

    try {
      const vRes = await fetch(`/datasets/${targetDataset.id}/versions`);
      if (!vRes.ok) {
        setMessage(`Cannot execute: failed to load versions for dataset "${targetDataset.name}".`);
        return null;
      }
      const vData = await vRes.json();
      const safeList = validateVersionsList(vData);
      const version = safeList.find((v) => v.dataset_id === targetDataset.id);

      if (!version?.id) {
        setMessage(`Cannot execute: dataset "${targetDataset.name}" has no snapshot versions.`);
        return null;
      }

      const newAnalysis = await apiJson<any>("/api/analyses/run", {
        project_id: project?.id,
        dataset_version_id: version.id,
        capability_id: capabilityId,
        parameters: parameters || {},
      });

      const valAnalysis = validateAnalysisRunResponse(newAnalysis);
      if (valAnalysis.success && valAnalysis.data) {
        const analysis = valAnalysis.data;
        setAnalyses((previous) => [analysis, ...previous.filter((item) => item.id !== analysis.id)]);
        setMessage("");
        return analysis;
      }
      setMessage(valAnalysis.error || "Execution returned invalid analysis structure.");
      return null;
    } catch (err: unknown) {
      console.error("Quick run failed:", err);
      setMessage(getApiErrorMessage(err, "Failed to execute analysis on server"));
      return null;
    }
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
              onOpenDescriptive={(datasetId) => {
                setSelectedDatasetId(datasetId);
                setActiveTab("descriptive");
              }}
              onRefreshData={loadDashboard}
              onDatasetDeleted={(deletedIds) => {
                setDatasets((current) => current.filter((dataset) => !deletedIds.includes(dataset.id)));
                setSelectedDatasetId((current) => deletedIds.includes(current)
                  ? datasets.find((dataset) => !deletedIds.includes(dataset.id))?.id || ""
                  : current);
                setMessage(`${deletedIds.length} dataset${deletedIds.length === 1 ? "" : "s"} successfully deleted.`);
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
              focusDimension={activeTab === "sources" ? "sources" : "authors"}
              focusKey={activeTab}
              onQuickRun={quickRunCapability}
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
              onTriggerAnalysis={async (capId) => {
                await quickRunCapability(capId, selectedDataset?.id);
              }}
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

        </main>
      </div>

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
