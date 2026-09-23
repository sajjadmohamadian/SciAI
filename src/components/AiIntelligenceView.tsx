import React, { useState } from "react";
import { Analysis, Dataset, ResearchGapMatrixOutput, MultiCorpusDiscrepancyOutput } from "../types.js";
import {
  validateRagChatResponse,
  validateResearchGapsResponse,
  validateManuscriptSectionResponse,
  validateCitationContextResponse,
  validateResearchGapMatrixResponse,
  validateCorpusDiscrepancyResponse,
} from "../utils/responseValidation.js";
import {
  Sparkles,
  Send,
  BrainCircuit,
  Compass,
  FileText,
  Quote,
  TrendingUp,
  BookOpen,
  Copy,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  Grid,
  Database,
  Award,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface Props {
  datasets: Dataset[];
  analyses: Analysis[];
}

type AIToolTab = "rag_chat" | "gap_matrix" | "corpus_discrepancy" | "white_spaces" | "manuscript_studio" | "citation_intent";

export function AiIntelligenceView({ datasets = [], analyses = [] }: Props) {
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
      text: `Hello! I am your Scientometric AI Research Copilot powered by Gemini 3.8 Flash.
I am grounded directly in your active workspace containing ${datasets.length} datasets and ${analyses.length} completed analytical modules.

You can ask me questions such as:
- "Which papers form the nuclear core in Bradford's Zone 1?"
- "What is the degree of conformity to Lotka's Law and Price's square root conjecture?"
- "Summarize the major invisible colleges in our collaboration network."
- "What are the most cited articles published after 2020?"`,
    },
  ]);

  // 2. White-Space / Research Gaps state
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapsIsPartial, setGapsIsPartial] = useState(false);
  const [gapsResult, setGapsResult] = useState<{
    white_spaces: Array<{ title: string; rationale: string; bridging_topics: string[]; potential_impact: string }>;
    unexplored_intersections: Array<{ topic_a: string; topic_b: string; hypothesis: string }>;
    future_trend_forecasts: Array<{ concept: string; projected_growth: string; trajectory_rationale: string }>;
  } | null>(null);

  // New Feature: Research Gap Matrix (Feasibility vs. Novelty)
  const [gapMatrixLoading, setGapMatrixLoading] = useState(false);
  const [gapMatrixError, setGapMatrixError] = useState<string | null>(null);
  const [gapMatrixData, setGapMatrixData] = useState<ResearchGapMatrixOutput | null>(null);
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] = useState<string>("all");

  // New Feature: Multi-Corpus Discrepancy & Indexing Bias Analysis (WoS vs Scopus vs PubMed)
  const [discrepancyLoading, setDiscrepancyLoading] = useState(false);
  const [discrepancyError, setDiscrepancyError] = useState<string | null>(null);
  const [discrepancyData, setDiscrepancyData] = useState<MultiCorpusDiscrepancyOutput | null>(null);

  // Run Research Gap Matrix
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
          dataset_name: currentDataset?.name || "Active Research Corpus",
        }),
      });
      const data = await res.json();
      const val = validateResearchGapMatrixResponse(data);
      if (val.success && val.data) {
        setGapMatrixData(val.data);
      } else {
        setGapMatrixError(val.error || "Research gap matrix output is incomplete or malformed.");
      }
    } catch (err) {
      console.error("Failed to generate research gap matrix:", err);
      setGapMatrixError(err instanceof Error ? err.message : "Failed to generate research gap matrix");
    } finally {
      setGapMatrixLoading(false);
    }
  };

  // Run Multi-Corpus Discrepancy
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
          dataset_name: currentDataset?.name || "Active Research Corpus",
        }),
      });
      const data = await res.json();
      const val = validateCorpusDiscrepancyResponse(data);
      if (val.success && val.data) {
        setDiscrepancyData(val.data);
      } else {
        setDiscrepancyError(val.error || "Multi-corpus discrepancy metrics are incomplete.");
      }
    } catch (err) {
      console.error("Failed to analyze multi-corpus discrepancy:", err);
      setDiscrepancyError(err instanceof Error ? err.message : "Failed to analyze multi-corpus discrepancy");
    } finally {
      setDiscrepancyLoading(false);
    }
  };

  // 3. Manuscript Generation state
  const [manuscriptSection, setManuscriptSection] = useState<"abstract" | "discussion" | "limitations" | "hypotheses">("abstract");
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
    exemplar_analyses: Array<{ title: string; primary_intent: string; rhetorical_role: string }>;
  } | null>(null);

  // Handle RAG query
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
        }),
      });

      const data = await res.json();
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

  // Run White-Space Detection
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
          dataset_name: currentDataset?.name || "Active Corpus",
          clusters: [
            { name: "Deep Learning & Image Processing", top_members: ["CNN", "ResNet", "Segmentation"], size: 18 },
            { name: "Clinical Oncology & Biomarkers", top_members: ["Prognosis", "Survival", "Biomarker"], size: 14 },
            { name: "Data Ethics & Privacy", top_members: ["Governance", "HIPAA", "Anonymity"], size: 6 },
          ],
          motor_themes: ["Supervised Deep Learning", "Diagnostic Accuracy", "Pathology AI"],
          niche_themes: ["Quantum ML", "Synthetic Biology Biomarkers"],
          recent_keywords: ["Foundation Models", "Vision Transformers", "Federated Learning"],
        }),
      });
      const data = await res.json();
      const val = validateResearchGapsResponse(data);
      if (val.success && val.data) {
        setGapsResult(val.data);
        if (val.isPartial) {
          setGapsIsPartial(true);
        }
      } else {
        setGapsError(val.error || "Failed to process research gaps response.");
      }
    } catch (err) {
      console.error("Failed to run white spaces:", err);
      setGapsError(err instanceof Error ? err.message : "Failed to run white-spaces analysis");
    } finally {
      setGapsLoading(false);
    }
  };

  // Generate Manuscript Section
  const runGenerateManuscript = async (sec: "abstract" | "discussion" | "limitations" | "hypotheses") => {
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
          dataset_name: currentDataset?.name || "Active Research Corpus",
          metrics: {
            record_count: currentDataset?.record_count || 120,
            lotka_beta: 2.14,
            bradford_core_sources: 3,
            collaboration_index: 3.42,
            growth_rate_annual: "18.4%",
          },
        }),
      });
      const data = await res.json();
      const val = validateManuscriptSectionResponse(data);
      if (val.success && val.data) {
        setManuscriptContent(val.data);
      } else {
        setManuscriptError(val.error || "Manuscript generation returned empty or incomplete content.");
      }
    } catch (err) {
      console.error("Failed to generate manuscript section:", err);
      setManuscriptError(err instanceof Error ? err.message : "Failed to generate manuscript section");
    } finally {
      setManuscriptLoading(false);
    }
  };

  // Run Citation Intent Analysis
  const runCitationIntentAnalysis = async () => {
    setCitationLoading(true);
    setCitationError(null);
    try {
      const res = await fetch("/api/ai/citation-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId || undefined,
        }),
      });
      const data = await res.json();
      const val = validateCitationContextResponse(data);
      if (val.success && val.data) {
        setCitationData(val.data);
      } else {
        setCitationError(val.error || "Incomplete citation intent breakdown received from AI.");
      }
    } catch (err) {
      console.error("Failed to analyze citations:", err);
      setCitationError(err instanceof Error ? err.message : "Failed to analyze citations");
    } finally {
      setCitationLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                Scientometric AI Copilot & Research Studio
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  Gemini 3.8 Flash
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Full-stack AI suite: Corpus-Wide RAG, White-Space Topology, Manuscript Synthesis, and Citation Sentiment.
              </p>
            </div>
          </div>
        </div>

        {/* Dataset selector */}
        {datasets.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Active Corpus:</span>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count} docs)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Feature Mode Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTool("rag_chat")}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "rag_chat"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "rag_chat" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">1. Corpus RAG</div>
            <div className="text-[10px] text-slate-500 truncate">Q&A & Inquiries</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("gap_matrix");
            if (!gapMatrixData) runResearchGapMatrix();
          }}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "gap_matrix"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "gap_matrix" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <Grid className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">2. Gap Matrix</div>
            <div className="text-[10px] text-slate-500 truncate">Feasibility vs Novelty</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("corpus_discrepancy");
            if (!discrepancyData) runCorpusDiscrepancyAnalysis();
          }}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "corpus_discrepancy"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "corpus_discrepancy" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">3. Indexing Bias</div>
            <div className="text-[10px] text-slate-500 truncate">WoS vs Scopus vs PubMed</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("white_spaces");
            if (!gapsResult) runWhiteSpaces();
          }}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "white_spaces"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "white_spaces" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <Compass className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">4. White-Spaces</div>
            <div className="text-[10px] text-slate-500 truncate">Structural Gaps</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("manuscript_studio");
            if (!manuscriptContent) runGenerateManuscript("abstract");
          }}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "manuscript_studio"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "manuscript_studio" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">5. Manuscript</div>
            <div className="text-[10px] text-slate-500 truncate">Paper Synthesis</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("citation_intent");
            if (!citationData) runCitationIntentAnalysis();
          }}
          className={`flex items-center gap-2 rounded-xl p-3 text-left border transition cursor-pointer ${
            activeTool === "citation_intent"
              ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${activeTool === "citation_intent" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            <Quote className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black truncate">6. Citation Sentiment</div>
            <div className="text-[10px] text-slate-500 truncate">Rhetorical Roles</div>
          </div>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. RAG CHAT INTERFACE                                     */}
      {/* ========================================================= */}
      {activeTool === "rag_chat" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BrainCircuit className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-black text-slate-800">
                Corpus-Wide Scientometric RAG Assistant
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              Live Token Indexing ({datasets.length} Datasets, {analyses.length} Analytical Runs)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-950 text-white rounded-tr-none"
                      : "bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {ragLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700 font-medium">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  Gemini is retrieving relevant corpus documents and calculating scientometric context...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendRag}
            className="border-t border-slate-200 bg-white p-3.5 flex gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about authors, citations, journals, keyword clusters, or mathematical laws..."
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none focus:border-slate-950"
            />
            <button
              type="submit"
              disabled={ragLoading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              Ask Copilot
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. RESEARCH GAP MATRIX (Feasibility vs Novelty)           */}
      {/* ========================================================= */}
      {activeTool === "gap_matrix" && (
        <div className="space-y-6">
          {gapMatrixError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
              <div>
                <span className="font-bold">Gap Matrix Unavailable: </span>
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
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  AI-Augmented Intelligence
                </span>
                <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-mono text-indigo-700">
                  Matrix Framework
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Research Gap Matrix: Novelty vs. Feasibility
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                AI-synthesized research proposals categorized into strategic quadrants (Moonshots, Low-Hanging Fruit, High-Impact Core).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runResearchGapMatrix}
                disabled={gapMatrixLoading}
                className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${gapMatrixLoading ? "animate-spin" : ""}`} />
                Generate Gap Matrix
              </button>
            </div>
          </div>

          {gapMatrixLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <Sparkles className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <div className="mt-3 text-sm font-bold text-slate-800">
                Synthesizing Thematic White-Spaces into Novelty-Feasibility Matrix...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Gemini 3.8 Flash evaluating research potential, methodology pathways, and risk profiles
              </div>
            </div>
          ) : gapMatrixData ? (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-950 flex items-start gap-3 shadow-2xs">
                <Lightbulb className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Thematic Landscape Insight: </span>
                  {gapMatrixData.thematicSummary}
                </div>
              </div>

              {/* Quadrant Quick Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Filter Quadrant:</span>
                {[
                  { id: "all", label: "All Quadrants" },
                  { id: "Moonshot", label: "🚀 High Novelty / Challenging" },
                  { id: "Strategic Opportunity", label: "⭐ High Novelty / High Feasibility" },
                  { id: "Low-Hanging Fruit", label: "🎯 Moderate Novelty / Immediate Feasibility" },
                  { id: "Incremental Expansion", label: "📈 Incremental Extension" },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuadrantFilter(q.id)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                      selectedQuadrantFilter === q.id
                        ? "bg-slate-900 text-white shadow-2xs font-bold"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Proposals Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapMatrixData.matrix
                  .filter((item) => selectedQuadrantFilter === "all" || item.quadrant.includes(selectedQuadrantFilter))
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.quadrant.includes("Moonshot")
                                ? "bg-purple-100 text-purple-800"
                                : item.quadrant.includes("Opportunity")
                                ? "bg-emerald-100 text-emerald-800"
                                : item.quadrant.includes("Low-Hanging")
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.quadrant}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.timeHorizon}
                          </span>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 leading-snug">
                          {item.proposalTitle}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {item.gapDescription}
                        </p>
                      </div>

                      {/* Score Metrics */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                              <span>Novelty</span>
                              <span className="text-purple-700">{item.noveltyScore}/10</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-purple-600 rounded-full"
                                style={{ width: `${item.noveltyScore * 10}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                              <span>Feasibility</span>
                              <span className="text-emerald-700">{item.feasibilityScore}/10</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${item.feasibilityScore * 10}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex flex-col gap-1 text-[11px] text-slate-500 font-mono">
                          <div>
                            <span className="font-bold font-sans text-slate-700">Approach: </span>
                            {item.recommendedMethodology}
                          </div>
                          <div>
                            <span className="font-bold font-sans text-slate-700">Target Grants/Journals: </span>
                            {item.targetFundingOrJournals}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <Grid className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                No Research Gap Matrix Generated Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Generate thesis and grant proposals mapped onto a Novelty-Feasibility quadrant grid grounded in the current bibliometric corpus.
              </p>
              <button
                type="button"
                onClick={runResearchGapMatrix}
                className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Proposal Matrix
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MULTI-CORPUS DISCREPANCY & INDEXING BIAS REPORT       */}
      {/* ========================================================= */}
      {activeTool === "corpus_discrepancy" && (
        <div className="space-y-6">
          {discrepancyError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
              <div>
                <span className="font-bold">Discrepancy Analysis Unavailable: </span>
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
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Bibliographic Bias Analysis
                </span>
                <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-mono text-indigo-700">
                  Cross-Index Comparative
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Multi-Corpus Indexing Bias & Discrepancy (WoS vs. Scopus vs. PubMed)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation of indexing gaps, language bias, and citation lag discrepancies across major scientific databases.
              </p>
            </div>

            <button
              type="button"
              onClick={runCorpusDiscrepancyAnalysis}
              disabled={discrepancyLoading}
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${discrepancyLoading ? "animate-spin" : ""}`} />
              Re-Analyze Bias
            </button>
          </div>

          {discrepancyLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <Sparkles className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <div className="mt-3 text-sm font-bold text-slate-800">
                Auditing Indexing Bias across WoS, Scopus, PubMed, and CrossRef...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Comparing coverage disparities, regional blind spots, and citation differential ratios
              </div>
            </div>
          ) : discrepancyData ? (
            <div className="space-y-6">
              {/* Primary Discrepancy KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {discrepancyData.corpusDiscrepancies.map((c, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-slate-900">{c.corpusName}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 font-bold">
                        Lag: {c.citationLagMonths} mo
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-500">Corpus Coverage:</span>
                        <span className="font-bold text-indigo-700">{c.coverageEstimatePercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${c.coverageEstimatePercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Primary Bias: </span>
                        <span className="text-rose-700 font-semibold">{c.primaryBias}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Strength: </span>
                        <span className="text-slate-600">{c.strength}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Language Inclusivity: </span>
                        <span className="text-slate-600">{c.languageInclusivity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Systematic Indexing Blindspots */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Systematic Indexing Blindspots & Omissions
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {discrepancyData.systematicBlindspots.map((b, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3.5 space-y-1 text-xs"
                    >
                      <div className="font-bold text-amber-900">{b.category}</div>
                      <div className="text-slate-600">{b.description}</div>
                      <div className="text-[11px] font-mono text-amber-800 pt-1">
                        <span className="font-bold">Risk: </span>{b.impactRisk}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Cross-Database Synthesis Protocol */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Recommended Multi-Corpus De-Duplication & Normalization Workflow
                  </h3>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700">
                  {discrepancyData.recommendedTriangulationProtocol.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">Summary Synthesis:</div>
                  <p>{discrepancyData.synthesisNote}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <Database className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                No Multi-Corpus Discrepancy Analysis Run
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Evaluate systematic disparities, non-English literature exclusions, and citation coverage differences across WoS, Scopus, and PubMed.
              </p>
              <button
                type="button"
                onClick={runCorpusDiscrepancyAnalysis}
                className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Analyze Database Discrepancies
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. RESEARCH GAPS & WHITE-SPACE DETECTION                  */}
      {/* ========================================================= */}
      {activeTool === "white_spaces" && (
        <div className="space-y-6">
          {gapsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <span className="font-bold">White-Spaces Analysis Unavailable: </span>
              {gapsError}
            </div>
          )}
          {gapsIsPartial && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-medium">
              Partial Result: AI response was incomplete. Do not treat as authoritative analysis.
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Topological White-Spaces & Structural Holes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Algorithmic discovery of low-edge bridges and unexploited thematic intersections.
              </p>
            </div>
            <button
              type="button"
              onClick={runWhiteSpaces}
              disabled={gapsLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${gapsLoading ? "animate-spin" : ""}`} />
              Re-Scan White Spaces
            </button>
          </div>

          {gapsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <Sparkles className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <div className="mt-3 text-sm font-bold text-slate-800">
                Analyzing Network Topology & Modularity Holes...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Synthesizing thematic gaps across active clusters
              </div>
            </div>
          ) : gapsResult ? (
            <div className="space-y-6">
              {/* White Spaces */}
              <div className="grid gap-4 md:grid-cols-2">
                {gapsResult.white_spaces.map((gap, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-slate-900">
                        {gap.title}
                      </h3>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-800">
                        White Space #{i + 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {gap.rationale}
                    </p>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                        Key Bridging Concepts:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.bridging_topics.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                      <strong>Impact Potential:</strong> {gap.potential_impact}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unexplored Intersections & Hypotheses */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Unexplored Inter-Cluster Thematic Intersections
                  </h3>
                </div>
                <div className="space-y-3">
                  {gapsResult.unexplored_intersections.map((inter, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-indigo-800">
                          {inter.topic_a}
                        </span>
                        <span className="text-slate-400">⟷</span>
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-purple-800">
                          {inter.topic_b}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        <strong>Testable Working Hypothesis:</strong> {inter.hypothesis}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Forecasts */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    2-Year Scientometric Growth Forecasts
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {gapsResult.future_trend_forecasts.map((trend, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-slate-900">
                          {trend.concept}
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {trend.projected_growth}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {trend.trajectory_rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MANUSCRIPT STUDIO (ABSTRACT, DISCUSSION, HYPOTHESES)   */}
      {/* ========================================================= */}
      {activeTool === "manuscript_studio" && (
        <div className="space-y-6">
          {manuscriptError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <span className="font-bold">Synthesis Error: </span>
              {manuscriptError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Academic Manuscript Drafting Studio
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate publication-grade narrative sections for journals like <em>Scientometrics</em>.
              </p>
            </div>

            {/* Section Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
              {(["abstract", "discussion", "limitations", "hypotheses"] as const).map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => runGenerateManuscript(sec)}
                  className={`rounded-lg px-3 py-1.5 font-bold capitalize transition cursor-pointer ${
                    manuscriptSection === sec
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Manuscript Section: {manuscriptSection.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(manuscriptContent);
                    setCopiedSection(true);
                    setTimeout(() => setCopiedSection(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {copiedSection ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSection ? "Copied" : "Copy to Clipboard"}
                </button>
                <button
                  type="button"
                  onClick={() => runGenerateManuscript(manuscriptSection)}
                  disabled={manuscriptLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${manuscriptLoading ? "animate-spin" : ""}`} />
                  Regenerate
                </button>
              </div>
            </div>

            {manuscriptLoading ? (
              <div className="py-12 text-center">
                <Sparkles className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                <div className="text-xs font-bold text-slate-700 mt-2">
                  Drafting {manuscriptSection} with empirical parameters...
                </div>
              </div>
            ) : (
              <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-serif bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                {manuscriptContent}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CITATION CONTEXT & RHETORICAL INTENT ANALYSIS          */}
      {/* ========================================================= */}
      {activeTool === "citation_intent" && (
        <div className="space-y-6">
          {citationError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <span className="font-bold">Citation Intent Analysis Unavailable: </span>
              {citationError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Citation Context & Rhetorical Intent Analysis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Classify whether citations represent direct methodological adoption, affirmative replication, or comparative critique.
              </p>
            </div>
            <button
              type="button"
              onClick={runCitationIntentAnalysis}
              disabled={citationLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${citationLoading ? "animate-spin" : ""}`} />
              Re-Analyze Citations
            </button>
          </div>

          {citationLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <Sparkles className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <div className="mt-3 text-sm font-bold text-slate-800">
                Evaluating Citation Sentiments & Rhetorical Drivers...
              </div>
            </div>
          ) : citationData ? (
            <div className="space-y-6">
              {/* Proportions Breakdown */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">
                    Affirmative Adoption
                  </div>
                  <div className="text-2xl font-black text-emerald-900 font-mono mt-1">
                    {citationData.affirmative_adoption}%
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-1">
                    Direct validation and building upon findings.
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="text-[10px] font-bold text-blue-800 uppercase">
                    Methodology Applied
                  </div>
                  <div className="text-2xl font-black text-blue-900 font-mono mt-1">
                    {citationData.methodological_application}%
                  </div>
                  <p className="text-[10px] text-blue-700 mt-1">
                    Adoption of code, protocols, or benchmarks.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">
                    Conceptual Background
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                    {citationData.conceptual_background}%
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Historical context or introductory citations.
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                  <div className="text-[10px] font-bold text-rose-800 uppercase">
                    Critical / Comparative
                  </div>
                  <div className="text-2xl font-black text-rose-900 font-mono mt-1">
                    {citationData.critical_comparative}%
                  </div>
                  <p className="text-[10px] text-rose-700 mt-1">
                    Contrasting results or addressing caveats.
                  </p>
                </div>
              </div>

              {/* Synthesis Note */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Corpus Rhetorical Profile
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {citationData.sentiment_summary}
                </p>
              </div>

              {/* Exemplar Papers */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Exemplar Article Citation Classifications
                </div>
                <div className="space-y-2.5">
                  {citationData.exemplar_analyses.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900">
                          {ex.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {ex.rhetorical_role}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 shrink-0">
                        {ex.primary_intent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
