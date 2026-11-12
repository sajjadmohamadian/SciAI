import React, { useState } from "react";
import {
  Analysis,
  Dataset,
  ResearchGapMatrixOutput,
  MultiCorpusDiscrepancyOutput,
} from "../types.js";
import {
  validateRagChatResponse,
  validateResearchGapsResponse,
  validateManuscriptSectionResponse,
  validateCitationContextResponse,
  validateResearchGapMatrixResponse,
  validateCorpusDiscrepancyResponse,
} from "../utils/responseValidation.js";
import { useAiProvider } from "../context/AiProviderContext.js";
import { AiProviderSelector } from "./AiProviderSelector.js";
import {
  Sparkles,
  Send,
  BrainCircuit,
  Compass,
  FileText,
  Quote,
  TrendingUp,
  Copy,
  Check,
  RefreshCw,
  Grid,
  Database,
  Award,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  datasets: Dataset[];
  analyses: Analysis[];
}

type AIToolTab =
  | "rag_chat"
  | "gap_matrix"
  | "corpus_discrepancy"
  | "white_spaces"
  | "manuscript_studio"
  | "citation_intent";

type AiResponseProvenance = {
  provider?: string;
  model?: string;
  attemptedProviders?: Array<{ provider?: string; status?: string }>;
};

export function AiIntelligenceView({ datasets = [], analyses = [] }: Props) {
  const { getAiRequestOptions } = useAiProvider();
  const [lastAiProvenance, setLastAiProvenance] =
    useState<AiResponseProvenance | null>(null);
  const [lastAiWarnings, setLastAiWarnings] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<AIToolTab>("rag_chat");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    datasets.length > 0 ? datasets[0].id : ""
  );

  // 1. RAG Chat state
  const [prompt, setPrompt] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [conversation, setConversation] = useState<
    Array<{ role: "user" | "ai"; text: string; timestamp?: string }>
  >([
    {
      role: "ai",
      text: `Hello! I am your Scientometric AI Research Assistant powered by SciAI's multi-provider AI router.
I am grounded directly in your active workspace containing ${datasets.length} datasets and ${analyses.length} completed analysis runs.

You can ask me questions such as:
- "Which publications form the nuclear core in Bradford's Zone 1?"
- "What is the degree of conformity to Lotka's Law and Price's square root conjecture?"
- "Summarize the major invisible colleges in our collaboration network."
- "What are the most cited articles published after 2020?"`,
    },
  ]);

  // 2. Research Gaps state
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapsIsPartial, setGapsIsPartial] = useState(false);
  const [gapsResult, setGapsResult] = useState<{
    white_spaces: Array<{
      title: string;
      rationale: string;
      bridging_topics: string[];
      potential_impact: string;
    }>;
    unexplored_intersections: Array<{
      topic_a: string;
      topic_b: string;
      hypothesis: string;
    }>;
    future_trend_forecasts: Array<{
      concept: string;
      projected_growth: string;
      trajectory_rationale: string;
    }>;
  } | null>(null);

  // Research Gap Matrix (Feasibility vs. Novelty)
  const [gapMatrixLoading, setGapMatrixLoading] = useState(false);
  const [gapMatrixError, setGapMatrixError] = useState<string | null>(null);
  const [gapMatrixData, setGapMatrixData] =
    useState<ResearchGapMatrixOutput | null>(null);
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] =
    useState<string>("all");

  // Multi-Source Discrepancy & Indexing Coverage Analysis
  const [discrepancyLoading, setDiscrepancyLoading] = useState(false);
  const [discrepancyError, setDiscrepancyError] = useState<string | null>(null);
  const [discrepancyData, setDiscrepancyData] =
    useState<MultiCorpusDiscrepancyOutput | null>(null);

  const runResearchGapMatrix = async () => {
    setGapMatrixLoading(true);
    setGapMatrixError(null);
    try {
      const currentDataset = datasets.find((d) => d.id === selectedDatasetId);
      const res = await fetch("/api/ai/research-gap-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          dataset_name: currentDataset?.name || "Active Dataset",
          ...getAiRequestOptions(),
        }),
      });
      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateResearchGapMatrixResponse(data);
      if (val.success && val.isComplete && val.data) {
        setGapMatrixData(val.data);
      } else {
        setGapMatrixData(null);
        setGapMatrixError(
          val.error || "Research gap matrix output is incomplete or malformed."
        );
      }
    } catch (err) {
      console.error("Failed to generate research gap matrix:", err);
      setGapMatrixError(
        err instanceof Error
          ? err.message
          : "Failed to generate research gap matrix"
      );
    } finally {
      setGapMatrixLoading(false);
    }
  };

  const runCorpusDiscrepancyAnalysis = async () => {
    setDiscrepancyLoading(true);
    setDiscrepancyError(null);
    try {
      const currentDataset = datasets.find((d) => d.id === selectedDatasetId);
      const res = await fetch("/api/ai/corpus-discrepancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          dataset_name: currentDataset?.name || "Active Dataset",
        }),
      });
      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateCorpusDiscrepancyResponse(data);
      if (val.success && val.isComplete && val.data) {
        setDiscrepancyData(val.data);
      } else {
        setDiscrepancyData(null);
        setDiscrepancyError(
          val.error || "Multi-corpus discrepancy metrics are incomplete."
        );
      }
    } catch (err) {
      console.error("Failed to analyze multi-corpus discrepancy:", err);
      setDiscrepancyError(
        err instanceof Error
          ? err.message
          : "Failed to analyze multi-corpus discrepancy"
      );
    } finally {
      setDiscrepancyLoading(false);
    }
  };

  // 3. Manuscript Generation state
  const [manuscriptSection, setManuscriptSection] = useState<
    "abstract" | "discussion" | "limitations" | "hypotheses"
  >("abstract");
  const [manuscriptLoading, setManuscriptLoading] = useState(false);
  const [manuscriptError, setManuscriptError] = useState<string | null>(null);
  const [manuscriptContent, setManuscriptContent] = useState<string>("");
  const [copiedSection, setCopiedSection] = useState(false);

  // 4. Citation Intent Analysis state
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState<string | null>(null);
  const [citationData, setCitationData] = useState<{
    affirmative_adoption: number;
    methodological_application: number;
    conceptual_background: number;
    critical_comparative: number;
    sentiment_summary: string;
    exemplar_analyses: Array<{
      title: string;
      primary_intent: string;
      rhetorical_role: string;
    }>;
  } | null>(null);

  const handleSendRag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || ragLoading) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setConversation((prev) => [...prev, { role: "user", text: userMessage }]);
    setRagLoading(true);

    try {
      const res = await fetch("/api/ai/rag-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          history: conversation.map((c) => ({ role: c.role, text: c.text })),
          dataset_id: selectedDatasetId || undefined,
          ...getAiRequestOptions(),
        }),
      });

      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateRagChatResponse(data);
      if (val.success && val.data) {
        setConversation((prev) => [
          ...prev,
          {
            role: "ai",
            text: val.data,
          },
        ]);
      } else {
        setConversation((prev) => [
          ...prev,
          {
            role: "ai",
            text: `[Error: Incomplete AI Synthesis] ${val.error || "The AI response was empty or malformed. Not an authoritative response."}`,
          },
        ]);
      }
    } catch (err) {
      setConversation((prev) => [
        ...prev,
        {
          role: "ai",
          text: `[Error: Processing Failed] ${err instanceof Error ? err.message : "Encountered an issue processing query against workspace documents."}`,
        },
      ]);
    } finally {
      setRagLoading(false);
    }
  };

  const runWhiteSpaces = async () => {
    setGapsLoading(true);
    setGapsError(null);
    setGapsIsPartial(false);
    try {
      const currentDataset = datasets.find((d) => d.id === selectedDatasetId);
      const res = await fetch("/api/ai/research-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          dataset_name: currentDataset?.name || "Active Dataset",
          clusters: [
            {
              name: "Deep Learning & Image Processing",
              top_members: ["CNN", "ResNet", "Segmentation"],
              size: 18,
            },
            {
              name: "Clinical Oncology & Biomarkers",
              top_members: ["Prognosis", "Survival", "Biomarker"],
              size: 14,
            },
            {
              name: "Data Ethics & Privacy",
              top_members: ["Governance", "HIPAA", "Anonymity"],
              size: 6,
            },
          ],
          motor_themes: [
            "Supervised Deep Learning",
            "Diagnostic Accuracy",
            "Pathology AI",
          ],
          niche_themes: ["Quantum ML", "Synthetic Biology Biomarkers"],
          recent_keywords: [
            "Foundation Models",
            "Vision Transformers",
            "Federated Learning",
          ],
          ...getAiRequestOptions(),
        }),
      });
      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateResearchGapsResponse(data);
      if (val.success && val.data) {
        setGapsResult(val.data);
        if (val.isPartial) {
          setGapsIsPartial(true);
        }
      } else {
        setGapsError(
          val.error || "Failed to process research gaps response."
        );
      }
    } catch (err) {
      console.error("Failed to run white spaces:", err);
      setGapsError(
        err instanceof Error
          ? err.message
          : "Failed to run white-spaces analysis"
      );
    } finally {
      setGapsLoading(false);
    }
  };

  const runGenerateManuscript = async (
    sec: "abstract" | "discussion" | "limitations" | "hypotheses"
  ) => {
    setManuscriptLoading(true);
    setManuscriptError(null);
    setManuscriptSection(sec);
    try {
      const currentDataset = datasets.find((d) => d.id === selectedDatasetId);
      const res = await fetch("/api/ai/manuscript-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: sec,
          dataset_name: currentDataset?.name || "Active Dataset",
          metrics: {
            record_count: currentDataset?.record_count || 120,
            lotka_beta: 2.14,
            bradford_core_sources: 3,
            collaboration_index: 3.42,
            growth_rate_annual: "18.4%",
          },
          ...getAiRequestOptions(),
        }),
      });
      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateManuscriptSectionResponse(data);
      if (val.success && val.data) {
        setManuscriptContent(val.data);
      } else {
        setManuscriptError(
          val.error ||
            "Manuscript generation returned empty or incomplete content."
        );
      }
    } catch (err) {
      console.error("Failed to generate manuscript section:", err);
      setManuscriptError(
        err instanceof Error
          ? err.message
          : "Failed to generate manuscript section"
      );
    } finally {
      setManuscriptLoading(false);
    }
  };

  const runCitationIntentAnalysis = async () => {
    setCitationLoading(true);
    setCitationError(null);
    try {
      const res = await fetch("/api/ai/citation-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId || undefined,
          ...getAiRequestOptions(),
        }),
      });
      const data = await res.json();
      setLastAiProvenance(data.ai_provenance || null);
      setLastAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      const val = validateCitationContextResponse(data);
      if (val.success && val.data) {
        setCitationData(val.data);
      } else {
        setCitationError(
          val.error || "Incomplete citation intent breakdown received from AI."
        );
      }
    } catch (err) {
      console.error("Failed to analyze citations:", err);
      setCitationError(
        err instanceof Error ? err.message : "Failed to analyze citations"
      );
    } finally {
      setCitationLoading(false);
    }
  };

  const toolItems = [
    {
      id: "rag_chat" as AIToolTab,
      title: "1. Research Corpus RAG",
      subtitle: "Q&A & Inquiries",
      icon: BrainCircuit,
      onActivate: () => setActiveTool("rag_chat"),
    },
    {
      id: "gap_matrix" as AIToolTab,
      title: "2. Gap Matrix",
      subtitle: "Feasibility vs Novelty",
      icon: Grid,
      onActivate: () => {
        setActiveTool("gap_matrix");
        if (!gapMatrixData) runResearchGapMatrix();
      },
    },
    {
      id: "corpus_discrepancy" as AIToolTab,
      title: "3. Indexing Coverage",
      subtitle: "WoS vs Scopus vs PubMed",
      icon: Database,
      onActivate: () => {
        setActiveTool("corpus_discrepancy");
        if (!discrepancyData) runCorpusDiscrepancyAnalysis();
      },
    },
    {
      id: "white_spaces" as AIToolTab,
      title: "4. Research Gaps",
      subtitle: "Structural Gaps",
      icon: Compass,
      onActivate: () => {
        setActiveTool("white_spaces");
        if (!gapsResult) runWhiteSpaces();
      },
    },
    {
      id: "manuscript_studio" as AIToolTab,
      title: "5. Manuscript",
      subtitle: "Manuscript Synthesis",
      icon: FileText,
      onActivate: () => {
        setActiveTool("manuscript_studio");
        if (!manuscriptContent) runGenerateManuscript("abstract");
      },
    },
    {
      id: "citation_intent" as AIToolTab,
      title: "6. Citation Context",
      subtitle: "Rhetorical Roles",
      icon: Quote,
      onActivate: () => {
        setActiveTool("citation_intent");
        if (!citationData) runCitationIntentAnalysis();
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-ink-primary">
              Scientometric AI Copilot &amp; Research Studio
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                Multi-provider AI
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Full-stack AI assistance: research corpus RAG, research gap
              mapping, manuscript synthesis, and citation context analysis.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AiProviderSelector />

          {datasets.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 shadow-card">
              <span className="sciai-kicker text-[10px]!">Active Dataset:</span>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="cursor-pointer bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.record_count} records)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {lastAiProvenance && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-[11px] shadow-card">
          <span className="sciai-kicker text-[10px]!">Last AI response</span>
          <span className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 font-semibold text-ink-secondary">
            {lastAiProvenance.provider || "unavailable"}
            {lastAiProvenance.model && lastAiProvenance.model !== "unavailable"
              ? ` · ${lastAiProvenance.model}`
              : ""}
          </span>
          {lastAiProvenance.attemptedProviders &&
            lastAiProvenance.attemptedProviders.length > 1 && (
              <span className="font-medium text-status-warning-text">
                Fallback path attempted
              </span>
            )}
          {lastAiWarnings.map((warning) => (
            <span
              key={warning}
              className="font-medium text-status-warning-text"
            >
              {warning}
            </span>
          ))}
        </div>
      )}

      {/* Feature Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {toolItems.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={tool.onActivate}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                isActive
                  ? "border-brand-500 bg-brand-50/70 text-ink-primary shadow-card"
                  : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
              }`}
            >
              <div
                className={`shrink-0 rounded-lg p-1.5 ${
                  isActive
                    ? "bg-brand-500 text-white"
                    : "border border-border-subtle bg-surface-subtle text-ink-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-ink-primary">
                  {tool.title}
                </div>
                <div className="truncate text-[10px] text-ink-muted">
                  {tool.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 1. RAG CHAT INTERFACE */}
      {activeTool === "rag_chat" && (
        <Card
          padding="none"
          className="flex h-[600px] flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <BrainCircuit className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-black text-ink-primary">
                Corpus-Grounded Scientometric RAG Assistant
              </span>
            </div>
            <span className="tabular-metrics text-[10px] font-semibold text-ink-subtle">
              Live Token Indexing ({datasets.length} datasets, {analyses.length}{" "}
              analysis runs)
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-2xl whitespace-pre-wrap rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-tr-none bg-brand-500 text-white"
                      : "rounded-tl-none border border-border-default bg-surface-subtle text-ink-primary"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {ragLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs font-medium text-brand-700">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-brand-500" />
                  AI provider router is retrieving relevant research corpus
                  publications and calculating scientometric context...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendRag}
            className="flex gap-2 border-t border-border-default bg-surface-canvas p-3.5"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about authors, citations, journals, keyword clusters, or mathematical laws..."
              className="flex-1 rounded-xl border border-border-default bg-surface-canvas px-4 py-2.5 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={ragLoading}
              disabled={ragLoading || !prompt.trim()}
              icon={!ragLoading ? <Send className="h-3.5 w-3.5" /> : undefined}
            >
              Ask Copilot
            </Button>
          </form>
        </Card>
      )}

      {/* 2. RESEARCH GAP MATRIX */}
      {activeTool === "gap_matrix" && (
        <div className="space-y-6">
          {gapMatrixError && (
            <AlertBanner tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">
                    Research Gap Matrix Unavailable:{" "}
                  </span>
                  {gapMatrixError}
                </div>
                <button
                  type="button"
                  onClick={runResearchGapMatrix}
                  className="cursor-pointer font-bold underline"
                >
                  Retry
                </button>
              </div>
            </AlertBanner>
          )}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="sciai-kicker text-[11px]! text-brand-500!">
                  Research Assistance &amp; Augmented Analysis
                </span>
                <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
                  Matrix Framework
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black text-ink-primary">
                Research Gap Matrix: Novelty vs. Feasibility
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                AI-synthesized research proposals categorized into strategic
                quadrants (Moonshots, Low-Hanging Fruit, High-Impact Core).
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              loading={gapMatrixLoading}
              disabled={gapMatrixLoading}
              onClick={runResearchGapMatrix}
              icon={
                !gapMatrixLoading ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : undefined
              }
            >
              Generate Gap Matrix
            </Button>
          </div>

          {gapMatrixLoading ? (
            <Card padding="lg" className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <div className="mt-3 text-sm font-bold text-ink-primary">
                Synthesizing Research Gaps into Novelty-Feasibility Matrix...
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                Multi-provider AI evaluating research potential, methodology
                pathways, and risk profiles
              </div>
            </Card>
          ) : gapMatrixData ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-4 text-xs text-ink-secondary shadow-card">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <div>
                  <strong className="text-ink-primary">
                    Recommended Grant Proposal:{" "}
                  </strong>
                  {gapMatrixData.matrixSummary.recommendedTopGrantProposal}
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="sciai-kicker mr-1 text-[11px]!">
                  Filter Quadrant:
                </span>
                {[
                  { id: "all", label: "All Quadrants" },
                  {
                    id: "High Novelty / Low Feasibility",
                    label: "High-Risk Moonshot",
                  },
                  {
                    id: "High Novelty / High Feasibility",
                    label: "Gold Standard Grant",
                  },
                  {
                    id: "Low Novelty / High Feasibility",
                    label: "Low-Hanging Fruit",
                  },
                  {
                    id: "Low Novelty / Low Feasibility",
                    label: "Deprioritized",
                  },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuadrantFilter(q.id)}
                    className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedQuadrantFilter === q.id
                        ? "bg-brand-500 font-bold text-white shadow-xs"
                        : "border border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {gapMatrixData.proposals
                  .filter(
                    (item) =>
                      selectedQuadrantFilter === "all" ||
                      item.quadrant.includes(selectedQuadrantFilter)
                  )
                  .map((item, idx) => (
                    <Card
                      key={idx}
                      padding="md"
                      className="flex flex-col justify-between space-y-4 transition-colors hover:border-border-strong"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.quadrant === "High Novelty / Low Feasibility"
                                ? "border-brand-200 bg-brand-50 text-brand-700"
                                : item.quadrant ===
                                    "High Novelty / High Feasibility"
                                  ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                  : item.quadrant ===
                                      "Low Novelty / High Feasibility"
                                    ? "border-status-info-border bg-status-info-bg text-status-info-text"
                                    : "border-status-warning-border bg-status-warning-bg text-status-warning-text"
                            }`}
                          >
                            {item.quadrant}
                          </span>
                          <span className="font-mono text-[10px] text-ink-subtle">
                            {item.estimatedCompletionHorizon}
                          </span>
                        </div>

                        <h3 className="text-sm font-black leading-snug text-ink-primary">
                          {item.title}
                        </h3>

                        <p className="text-xs leading-relaxed text-ink-secondary">
                          {item.gapDescription}
                        </p>
                      </div>

                      <div className="space-y-2 border-t border-border-subtle pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="tabular-metrics mb-1 flex justify-between text-[10px] font-bold text-ink-muted">
                              <span>Novelty</span>
                              <span className="text-brand-600">
                                {item.noveltyScore}/100
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${item.noveltyScore}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="tabular-metrics mb-1 flex justify-between text-[10px] font-bold text-ink-muted">
                              <span>Feasibility</span>
                              <span className="text-status-success-text">
                                {item.feasibilityScore}/100
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className="h-full rounded-full bg-status-success-text"
                                style={{ width: `${item.feasibilityScore}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 pt-2 font-mono text-[11px] text-ink-muted">
                          <div>
                            <span className="font-sans font-bold text-ink-primary">
                              Approach:{" "}
                            </span>
                            {item.methodologicalApproach}
                          </div>
                          <div>
                            <span className="font-sans font-bold text-ink-primary">
                              Target Degree:{" "}
                            </span>
                            {item.targetDegreeLevel}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          ) : (
            <Card padding="lg" className="py-12 text-center">
              <Grid className="mx-auto h-10 w-10 text-ink-subtle" />
              <h3 className="mt-3 text-sm font-bold text-ink-primary">
                No Research Gap Matrix Generated Yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
                Generate thesis and grant proposals mapped onto a
                Novelty-Feasibility quadrant grid grounded in the current
                bibliometric corpus.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={runResearchGapMatrix}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                className="mt-4"
              >
                Generate Proposal Matrix
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* 3. MULTI-CORPUS DISCREPANCY */}
      {activeTool === "corpus_discrepancy" && (
        <div className="space-y-6">
          {discrepancyError && (
            <AlertBanner tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">
                    Discrepancy Analysis Unavailable:{" "}
                  </span>
                  {discrepancyError}
                </div>
                <button
                  type="button"
                  onClick={runCorpusDiscrepancyAnalysis}
                  className="cursor-pointer font-bold underline"
                >
                  Retry
                </button>
              </div>
            </AlertBanner>
          )}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="sciai-kicker text-[11px]! text-brand-500!">
                  Bibliographic Bias Analysis
                </span>
                <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
                  Cross-Index Comparative
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black text-ink-primary">
                Multi-Source Indexing Coverage &amp; Discrepancy Analysis (WoS
                vs. Scopus vs. PubMed)
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Evaluation of indexing coverage gaps, language coverage
                patterns, and citation lag discrepancies across major
                bibliographic databases.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              loading={discrepancyLoading}
              disabled={discrepancyLoading}
              onClick={runCorpusDiscrepancyAnalysis}
              icon={
                !discrepancyLoading ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : undefined
              }
            >
              Re-Analyze Coverage
            </Button>
          </div>

          {discrepancyLoading ? (
            <Card padding="lg" className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <div className="mt-3 text-sm font-bold text-ink-primary">
                Auditing indexing coverage across WoS, Scopus, PubMed, and
                CrossRef...
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                Comparing coverage disparities, regional blind spots, and
                citation differential ratios
              </div>
            </Card>
          ) : discrepancyData ? (
            <div className="space-y-6">
              <AlertBanner tone="info">
                <strong>Unique records across databases:</strong>{" "}
                <span className="tabular-metrics font-mono font-bold">
                  {discrepancyData.totalUniqueUnionDocs.toLocaleString()}
                </span>
              </AlertBanner>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {discrepancyData.databaseMetrics.map((metric) => (
                  <Card key={metric.database} padding="md" className="space-y-3">
                    <h3 className="text-base font-black text-ink-primary">
                      {metric.database}
                    </h3>
                    <div className="tabular-metrics space-y-1 text-xs text-ink-secondary">
                      <p>
                        Indexed records: {metric.docCount.toLocaleString()}
                      </p>
                      <p>
                        Exclusive records:{" "}
                        {metric.exclusiveDocCount.toLocaleString()} (
                        {metric.exclusiveRatio}%)
                      </p>
                      <p>Coverage of union: {metric.coverageRatio}%</p>
                      <p>
                        Average recorded citations:{" "}
                        {metric.avgCitationsRecorded}
                      </p>
                      <p>
                        Open access coverage: {metric.openAccessCoveragePct}%
                      </p>
                      <p>
                        Author disambiguation:{" "}
                        {metric.authorDisambiguationQuality}
                      </p>
                      <p>
                        Funding information:{" "}
                        {metric.fundingInformationCoveragePct}%
                      </p>
                      <p>
                        Abstract completeness:{" "}
                        {metric.abstractCompletenessPct}%
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <Card padding="lg" className="space-y-3">
                <h3 className="text-sm font-black text-ink-primary">
                  Database Intersections
                </h3>
                <div className="tabular-metrics grid gap-2 text-xs text-ink-secondary sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(discrepancyData.vennIntersections).map(
                    ([intersection, count]) => (
                      <p key={intersection}>
                        {intersection.replace(/([A-Z])/g, " $1")}:{" "}
                        <strong className="text-ink-primary">
                          {count.toLocaleString()}
                        </strong>
                      </p>
                    )
                  )}
                </div>
              </Card>

              <Card padding="lg" className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-status-warning-text" />
                  <h3 className="text-sm font-black text-ink-primary">
                    Subject Coverage Biases
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {discrepancyData.fieldBiases.map((bias) => (
                    <div
                      key={bias.categoryName}
                      className="space-y-1 rounded-xl border border-status-warning-border bg-status-warning-bg/50 p-3.5 text-xs"
                    >
                      <div className="font-bold text-status-warning-text">
                        {bias.categoryName}
                      </div>
                      <p className="tabular-metrics font-medium text-ink-primary">
                        WoS: {bias.wosSharePct}% · Scopus:{" "}
                        {bias.scopusSharePct}% · PubMed: {bias.pubmedSharePct}%
                      </p>
                      <p className="text-ink-secondary">
                        {bias.discrepancyBiasVerdict}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="lg" className="space-y-3 text-xs text-ink-secondary">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-brand-500" />
                  <h3 className="text-sm font-black text-ink-primary">
                    Cross-Database Synthesis
                  </h3>
                </div>
                <p>
                  <strong className="text-ink-primary">
                    Citation coverage:
                  </strong>{" "}
                  {discrepancyData.synthesizedReport.citationInflationLeader}
                </p>
                <p>
                  <strong className="text-ink-primary">Clinical depth:</strong>{" "}
                  {discrepancyData.synthesizedReport.clinicalDepthLeader}
                </p>
                <p>
                  <strong className="text-ink-primary">
                    Selective indexing:
                  </strong>{" "}
                  {discrepancyData.synthesizedReport.eliteSelectivityLeader}
                </p>
                <p>
                  <strong className="text-ink-primary">
                    Recommended strategy:
                  </strong>{" "}
                  {
                    discrepancyData.synthesizedReport
                      .recommendedIndexingStrategy
                  }
                </p>
                <p className="font-medium text-status-warning-text">
                  <strong>Systematic review caution:</strong>{" "}
                  {discrepancyData.synthesizedReport.systematicReviewWarning}
                </p>
              </Card>
            </div>
          ) : (
            <Card padding="lg" className="py-12 text-center">
              <Database className="mx-auto h-10 w-10 text-ink-subtle" />
              <h3 className="mt-3 text-sm font-bold text-ink-primary">
                No Multi-Source Discrepancy Analysis Run
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
                Evaluate systematic disparities, non-English literature
                exclusions, and citation coverage differences across WoS,
                Scopus, and PubMed.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={runCorpusDiscrepancyAnalysis}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                className="mt-4"
              >
                Analyze Source Discrepancies
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* 4. RESEARCH GAPS & WHITE-SPACE DETECTION */}
      {activeTool === "white_spaces" && (
        <div className="space-y-6">
          {gapsError && (
            <AlertBanner tone="danger">
              <span className="font-bold">
                Research Gap Analysis Unavailable:{" "}
              </span>
              {gapsError}
            </AlertBanner>
          )}
          {gapsIsPartial && (
            <AlertBanner tone="warning">
              Partial Result: AI response was incomplete. Do not treat it as
              authoritative analysis.
            </AlertBanner>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink-primary">
                Research Gaps &amp; Structural Holes
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                AI-assisted identification of low-edge bridges and underexplored
                thematic intersections.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={gapsLoading}
              disabled={gapsLoading}
              onClick={runWhiteSpaces}
              icon={
                !gapsLoading ? <RefreshCw className="h-3.5 w-3.5" /> : undefined
              }
            >
              Re-Scan Research Gaps
            </Button>
          </div>

          {gapsLoading ? (
            <Card padding="lg" className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <div className="mt-3 text-sm font-bold text-ink-primary">
                Analyzing Network Topology &amp; Modularity Holes...
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                Synthesizing thematic gaps across active clusters
              </div>
            </Card>
          ) : gapsResult ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {gapsResult.white_spaces.map((gap, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/60 via-surface-canvas to-surface-subtle p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-ink-primary">
                        {gap.title}
                      </h3>
                      <span className="tabular-metrics rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[9px] font-bold text-brand-700">
                        Research Gap #{i + 1}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-secondary">
                      {gap.rationale}
                    </p>
                    <div>
                      <div className="sciai-kicker mb-1.5 text-[10px]!">
                        Key Bridging Concepts:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.bridging_topics.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-brand-200 bg-surface-canvas px-2 py-0.5 text-[11px] font-bold text-brand-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-status-success-border bg-status-success-bg p-2.5 text-xs text-status-success-text">
                      <strong>Impact Potential:</strong> {gap.potential_impact}
                    </div>
                  </div>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-black text-ink-primary">
                    Unexplored Inter-Cluster Thematic Intersections
                  </h3>
                </div>
                <div className="space-y-3">
                  {gapsResult.unexplored_intersections.map((inter, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-primary">
                        <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700">
                          {inter.topic_a}
                        </span>
                        <span className="text-ink-subtle">⟷</span>
                        <span className="rounded-md border border-status-info-border bg-status-info-bg px-2 py-0.5 text-status-info-text">
                          {inter.topic_b}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-ink-secondary">
                        <strong className="text-ink-primary">
                          Testable Working Hypothesis:
                        </strong>{" "}
                        {inter.hypothesis}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="lg" className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-status-success-text" />
                  <h3 className="text-sm font-black text-ink-primary">
                    2-Year Scientometric Growth Forecasts
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {gapsResult.future_trend_forecasts.map((trend, i) => (
                    <div
                      key={i}
                      className="space-y-1.5 rounded-xl border border-border-default bg-surface-subtle p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-black text-ink-primary">
                          {trend.concept}
                        </div>
                        <span className="tabular-metrics rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                          {trend.projected_growth}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-ink-muted">
                        {trend.trajectory_rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {/* 5. MANUSCRIPT STUDIO */}
      {activeTool === "manuscript_studio" && (
        <div className="space-y-6">
          {manuscriptError && (
            <AlertBanner tone="danger">
              <span className="font-bold">Synthesis Error: </span>
              {manuscriptError}
            </AlertBanner>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-ink-primary">
                Academic Manuscript Drafting Studio
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Generate publication-grade narrative sections for journals like{" "}
                <em>Scientometrics</em>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border-default bg-surface-subtle p-1 text-xs">
              {(
                ["abstract", "discussion", "limitations", "hypotheses"] as const
              ).map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => runGenerateManuscript(sec)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 font-bold capitalize transition-colors ${
                    manuscriptSection === sec
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-500" />
                <span className="sciai-kicker text-ink-primary!">
                  Manuscript Section: {manuscriptSection.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(manuscriptContent);
                    setCopiedSection(true);
                    setTimeout(() => setCopiedSection(false), 2000);
                  }}
                  icon={
                    copiedSection ? (
                      <Check className="h-3.5 w-3.5 text-status-success-text" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {copiedSection ? "Copied" : "Copy to Clipboard"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={manuscriptLoading}
                  disabled={manuscriptLoading}
                  onClick={() => runGenerateManuscript(manuscriptSection)}
                  icon={
                    !manuscriptLoading ? (
                      <RefreshCw className="h-3.5 w-3.5" />
                    ) : undefined
                  }
                >
                  Regenerate
                </Button>
              </div>
            </div>

            {manuscriptLoading ? (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto h-6 w-6 animate-spin text-brand-500" />
                <div className="mt-2 text-xs font-bold text-ink-secondary">
                  Drafting {manuscriptSection} with empirical parameters...
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap rounded-xl border border-border-subtle bg-surface-subtle p-5 font-serif text-xs leading-relaxed text-ink-primary">
                {manuscriptContent}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 6. CITATION CONTEXT & RHETORICAL INTENT ANALYSIS */}
      {activeTool === "citation_intent" && (
        <div className="space-y-6">
          {citationError && (
            <AlertBanner tone="danger">
              <span className="font-bold">
                Citation Context Analysis Unavailable:{" "}
              </span>
              {citationError}
            </AlertBanner>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink-primary">
                Citation Context Analysis &amp; Rhetorical Intent
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Classify whether citations represent direct methodological
                adoption, affirmative replication, or comparative critique.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={citationLoading}
              disabled={citationLoading}
              onClick={runCitationIntentAnalysis}
              icon={
                !citationLoading ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : undefined
              }
            >
              Re-Analyze Citations
            </Button>
          </div>

          {citationLoading ? (
            <Card padding="lg" className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <div className="mt-3 text-sm font-bold text-ink-primary">
                Evaluating citation contexts and rhetorical drivers...
              </div>
            </Card>
          ) : citationData ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-status-success-border bg-status-success-bg/60 p-4">
                  <div className="sciai-kicker text-[10px]! text-status-success-text!">
                    Affirmative Adoption
                  </div>
                  <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                    {citationData.affirmative_adoption}%
                  </div>
                  <p className="mt-1 text-[10px] text-status-success-text">
                    Direct validation and building upon findings.
                  </p>
                </div>

                <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
                  <div className="sciai-kicker text-[10px]! text-brand-700!">
                    Methodology Applied
                  </div>
                  <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                    {citationData.methodological_application}%
                  </div>
                  <p className="mt-1 text-[10px] text-brand-600">
                    Adoption of code, protocols, or benchmarks.
                  </p>
                </div>

                <Card padding="sm">
                  <div className="sciai-kicker text-[10px]!">
                    Conceptual Background
                  </div>
                  <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                    {citationData.conceptual_background}%
                  </div>
                  <p className="mt-1 text-[10px] text-ink-muted">
                    Historical context or introductory citations.
                  </p>
                </Card>

                <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg/60 p-4">
                  <div className="sciai-kicker text-[10px]! text-status-danger-text!">
                    Critical / Comparative
                  </div>
                  <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                    {citationData.critical_comparative}%
                  </div>
                  <p className="mt-1 text-[10px] text-status-danger-text">
                    Contrasting results or addressing caveats.
                  </p>
                </div>
              </div>

              <Card padding="md" className="space-y-2">
                <div className="sciai-kicker text-ink-primary!">
                  Research Corpus Rhetorical Profile
                </div>
                <p className="text-xs leading-relaxed text-ink-secondary">
                  {citationData.sentiment_summary}
                </p>
              </Card>

              <Card padding="lg" className="space-y-3">
                <div className="sciai-kicker text-ink-primary!">
                  Exemplar Article Citation Classifications
                </div>
                <div className="space-y-2.5">
                  {citationData.exemplar_analyses.map((ex, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-4 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-primary">
                          {ex.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-muted">
                          {ex.rhetorical_role}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-border-default bg-surface-canvas px-2.5 py-0.5 text-[10px] font-bold text-ink-primary">
                        {ex.primary_intent}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}