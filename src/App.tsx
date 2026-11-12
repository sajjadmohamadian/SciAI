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
import { StudioExportBoundary } from "./components/StudioExportBoundary.js";
import { useAuth } from "./context/AuthContext.js";
import { LoginView } from "./components/LoginView.js";
import { AdminUsersView } from "./components/AdminUsersView.js";
import { AiProviderProvider } from "./context/AiProviderContext.js";
import { AlertBanner, Button, Input } from "./components/CommonUI.js";
import { KeyRound } from "lucide-react";

export default function App() {
  const { user, authEnabled, loading } = useAuth();
  if (loading)
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-surface-canvas text-sm font-medium text-ink-muted"
      >
        Loading secure session…
      </div>
    );
  if (authEnabled && !user) return <LoginView />;
  if (authEnabled && user?.must_change_password) return <PasswordChangeGate />;
  return (
    <AiProviderProvider>
      <WorkspaceApp />
    </AiProviderProvider>
  );
}

function PasswordChangeGate() {
  const { changePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-dark px-4 py-8">
      <form
        className="w-full max-w-md rounded-3xl border border-border-default bg-surface-canvas p-8 shadow-elevated"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await changePassword(current, next);
            setCurrent("");
            setNext("");
          } catch (err) {
            setError(getApiErrorMessage(err, "Password change failed."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-ink-primary text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink-primary">
              Change your temporary password
            </h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Choose a new password before entering the workspace.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <AlertBanner tone="danger">{error}</AlertBanner>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Current password"
            required
            autoComplete="current-password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            label="New password (12+ characters)"
            required
            minLength={12}
            autoComplete="new-password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>

        <div className="mt-6 space-y-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={busy}
            className="w-full"
          >
            {busy ? "Updating…" : "Update password"}
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="w-full cursor-pointer py-1 text-center text-xs font-semibold text-ink-muted transition-colors hover:text-brand-500 hover:underline disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      </form>
    </main>
  );
}

function WorkspaceApp() {
  const { user, authEnabled, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  const [modal, setModal] = useState<"upload" | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");

  const selectedDataset =
    datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

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
        setMessage(
          `Cannot execute: failed to load versions for dataset "${targetDataset.name}".`
        );
        return null;
      }
      const vData = await vRes.json();
      const safeList = validateVersionsList(vData);
      const version = safeList.find((v) => v.dataset_id === targetDataset.id);

      if (!version?.id) {
        setMessage(
          `Cannot execute: dataset "${targetDataset.name}" has no snapshot versions.`
        );
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
        setAnalyses((previous) => [
          analysis,
          ...previous.filter((item) => item.id !== analysis.id),
        ]);
        setMessage("");
        return analysis;
      }
      setMessage(
        valAnalysis.error || "Execution returned invalid analysis structure."
      );
      return null;
    } catch (err: unknown) {
      console.error("Quick run failed:", err);
      setMessage(
        getApiErrorMessage(err, "Failed to execute analysis on server")
      );
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-subtle/50 font-sans text-ink-primary antialiased selection:bg-brand-500 selection:text-white">
      <Sidebar
        isAdmin={authEnabled && user?.role === "admin"}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        project={project || undefined}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="w-full lg:pl-64">
        <Header
          activeTab={activeTab}
          onRefresh={loadDashboard}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          onLogout={authEnabled ? () => void logout() : undefined}
          userRole={user?.role}
        />

        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          {message && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-border-default bg-surface-canvas px-4 py-3 text-xs font-semibold text-ink-secondary shadow-card">
              <span>{message}</span>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="cursor-pointer text-ink-subtle transition-colors hover:text-ink-primary"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          )}

          <StudioExportBoundary key={activeTab} studio={activeTab}>
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
                      setMessage(
                        "OpenAlex Explorer launched inside Dataset & Corpus Pipeline."
                      );
                    } else if (tab === "merge") {
                      setMessage(
                        "Smart Merge Studio launched inside Dataset & Corpus Pipeline."
                      );
                    } else {
                      setMessage("");
                    }
                  }}
                  onOpenUpload={() => setModal("upload")}
                />
              </div>
            )}

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
                  setDatasets((current) =>
                    current.filter(
                      (dataset) => !deletedIds.includes(dataset.id)
                    )
                  );
                  setSelectedDatasetId((current) =>
                    deletedIds.includes(current)
                      ? datasets.find(
                          (dataset) => !deletedIds.includes(dataset.id)
                        )?.id || ""
                      : current
                  );
                  setMessage(
                    `${deletedIds.length} dataset${deletedIds.length === 1 ? "" : "s"} successfully deleted.`
                  );
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

            {(activeTab === "descriptive" || activeTab === "analyses") && (
              <DescriptiveAnalyticsStudio
                datasets={datasets}
                selectedDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
                onQuickRun={quickRunCapability}
              />
            )}

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

            {activeTab === "thematic" && (
              <ThematicEvolutionStudio
                datasets={datasets}
                activeDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
                onNavigateToFrontier={() => setActiveTab("frontier")}
              />
            )}

            {activeTab === "frontier" && (
              <FrontierDetectionStudio
                datasets={datasets}
                activeDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
              />
            )}

            {activeTab === "historical" && (
              <HistoricalGenealogyStudio
                datasets={datasets}
                selectedDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
              />
            )}

            {activeTab === "collaboration" && (
              <NetworkStudio
                datasets={datasets}
                selectedDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
              />
            )}

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

            {activeTab === "benchmark" && (
              <ComparativeBenchmarkingStudio datasets={datasets} />
            )}

            {activeTab === "powerbi" && (
              <PowerBIConnectorStudio
                datasets={datasets}
                selectedDatasetId={selectedDataset?.id}
                onSelectDataset={setSelectedDatasetId}
                analyses={analyses}
              />
            )}

            {activeTab === "reports" && (
              <ExportReportsStudio
                dataset={selectedDataset}
                analyses={analyses}
                onNavigateToPowerBI={() => setActiveTab("powerbi")}
                onNavigateToAI={() => setActiveTab("ai")}
              />
            )}

            {activeTab === "ai" && (
              <AiIntelligenceView datasets={datasets} analyses={analyses} />
            )}
          </StudioExportBoundary>
          {activeTab === "admin" && authEnabled && user?.role === "admin" && (
            <AdminUsersView />
          )}
        </main>
      </div>

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