import { useState, useEffect } from "react";
import {
  BrainCircuit,
  Sliders,
  Layers,
  Sparkles,
  TrendingUp,
  Cpu,
  Target,
  RefreshCw,
  Search,
  Network,
  Share2,
  Compass,
  GitPullRequest,
  CheckCircle2,
  Info,
  Zap,
  Database,
} from "lucide-react";
import { Dataset, Analysis, ResultRecord } from "../types.js";
import { StatisticalTextClassifierStudio } from "./StatisticalTextClassifierStudio.js";
import {
  validateGnnResponse,
  validatePredictSimulatorResponse,
} from "../utils/responseValidation.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

interface Props {
  dataset?: Dataset;
  datasets?: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  analyses: Analysis[];
  onTriggerAnalysis: (capabilityId: string, name: string) => Promise<void>;
}

export function MachineLearningStudio({
  dataset,
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  analyses,
  onTriggerAnalysis,
}: Props) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(
    selectedDatasetId ||
      dataset?.id ||
      (datasets.length > 0 ? datasets[0].id : "")
  );

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDatasetId) {
      setActiveDatasetId(selectedDatasetId);
    } else if (
      dataset?.id &&
      dataset.id !== activeDatasetId &&
      !selectedDatasetId
    ) {
      setActiveDatasetId(dataset.id);
    }
  }, [selectedDatasetId, dataset?.id]);

  const activeDatasetObj =
    datasets.find((d) => d.id === activeDatasetId) || dataset;

  const handleDatasetChange = (newDsId: string) => {
    setActiveDatasetId(newDsId);
    if (onSelectDataset) {
      onSelectDataset(newDsId);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<
    "kmeans" | "lda" | "simulator" | "gnn" | "classifiers"
  >("kmeans");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<
    number | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // GNN Studio State
  const [gnnArch, setGnnArch] = useState<"gat" | "gcn" | "graphsage" | "hgt">(
    "gat"
  );
  const [gnnEpochs, setGnnEpochs] = useState(50);
  const [gnnHiddenDim, setGnnHiddenDim] = useState(64);
  const [gnnRunning, setGnnRunning] = useState(false);
  const [gnnActiveView, setGnnActiveView] = useState<
    "links" | "manifold" | "attention"
  >("links");
  const [selectedGnnNode, setSelectedGnnNode] = useState<string | null>(null);
  const [gnnData, setGnnData] = useState<any>({
    architecture: "GAT",
    hyperparameters: {
      epochs: 50,
      hiddenDim: 64,
      learningRate: 0.005,
      dropout: 0.2,
      optimizer: "AdamW",
      activation: "LeakyReLU (negative slope=0.2)",
    },
    trainingMetrics: {
      finalLoss: 0.0384,
      rocAuc: 0.946,
      averagePrecision: 0.923,
      meanReciprocalRank: 0.889,
      convergenceEpoch: 38,
    },
    nodeEmbeddings: [
      { id: "n1", name: "Deep Neural Networks", type: "topic", x: -28.4, y: 19.2, communityGNN: 1, communityLouvain: 1, disruptionScore: 0.88, citations: 1420 },
      { id: "n2", name: "Convolutional Architectures", type: "topic", x: -32.1, y: 15.6, communityGNN: 1, communityLouvain: 1, disruptionScore: 0.72, citations: 980 },
      { id: "n3", name: "Graph Attention Networks (GAT)", type: "topic", x: -18.7, y: 24.5, communityGNN: 1, communityLouvain: 2, disruptionScore: 0.94, citations: 850 },
      { id: "n4", name: "Genomic Sequence Transformers", type: "topic", x: 12.3, y: 31.8, communityGNN: 2, communityLouvain: 3, disruptionScore: 0.82, citations: 620 },
      { id: "n5", name: "CRISPR-Cas9 Editing Vectors", type: "topic", x: 26.5, y: 28.1, communityGNN: 2, communityLouvain: 3, disruptionScore: 0.91, citations: 1840 },
      { id: "n6", name: "Single-Cell RNA Transcriptomics", type: "topic", x: 21.0, y: 18.4, communityGNN: 2, communityLouvain: 3, disruptionScore: 0.69, citations: 740 },
      { id: "n7", name: "Clinical Diagnostic Imaging", type: "topic", x: -14.2, y: -22.5, communityGNN: 3, communityLouvain: 1, disruptionScore: 0.45, citations: 510 },
      { id: "n8", name: "Multi-Modal Health Records", type: "topic", x: -4.8, y: -16.3, communityGNN: 3, communityLouvain: 2, disruptionScore: 0.64, citations: 430 },
      { id: "n9", name: "Quantum Molecular Simulation", type: "topic", x: 38.2, y: -12.4, communityGNN: 4, communityLouvain: 4, disruptionScore: 0.96, citations: 320 },
      { id: "n10", name: "Protein Structure Prediction (ESMFold)", type: "topic", x: 16.4, y: 8.7, communityGNN: 2, communityLouvain: 2, disruptionScore: 0.98, citations: 2100 },
      { id: "n11", name: "Ethical AI & Algorithmic Bias", type: "topic", x: -36.5, y: -8.9, communityGNN: 3, communityLouvain: 1, disruptionScore: 0.53, citations: 390 },
      { id: "n12", name: "Federated Learning Privacy", type: "topic", x: -22.8, y: -7.1, communityGNN: 3, communityLouvain: 1, disruptionScore: 0.61, citations: 460 },
      { id: "n13", name: "Synthetic Biology Bio-Design", type: "topic", x: 32.1, y: 12.0, communityGNN: 2, communityLouvain: 4, disruptionScore: 0.77, citations: 580 },
      { id: "n14", name: "Diffusion Models for Chemistry", type: "topic", x: 8.5, y: -2.3, communityGNN: 4, communityLouvain: 2, disruptionScore: 0.89, citations: 890 },
    ],
    predictedLinks: [
      {
        id: "link-pred-1",
        source: "Graph Attention Networks (GAT)",
        target: "Protein Structure Prediction (ESMFold)",
        predictedProbability: 0.934,
        topologicalDistance: 2,
        epistemicNovelty: "High Convergence",
        sharedLatentDim: ["Geometric Invariance", "Residue Contact Maps", "Self-Attention Topology"],
        mechanism: "GNN message-passing over spatial co-occurrence predicts direct algorithmic fusion between geometric deep learning and structural biology.",
      },
      {
        id: "link-pred-2",
        source: "Single-Cell RNA Transcriptomics",
        target: "Diffusion Models for Chemistry",
        predictedProbability: 0.887,
        topologicalDistance: 3,
        epistemicNovelty: "Radical Breakthrough",
        sharedLatentDim: ["Stochastic Trajectory Modeling", "Cell Fate Permutations", "Generative Perturbation"],
        mechanism: "Latent manifold vectors show dense cosine proximity despite zero direct co-citations in traditional bibliometric databases.",
      },
      {
        id: "link-pred-3",
        source: "Federated Learning Privacy",
        target: "Genomic Sequence Transformers",
        predictedProbability: 0.852,
        topologicalDistance: 3,
        epistemicNovelty: "Cross-Domain Synergy",
        sharedLatentDim: ["Decentralized Cohorts", "Differential Privacy", "Genomic Data Sovereignty"],
        mechanism: "Multi-hop graph convolution aggregates privacy-preserving ML features with decentralized international genome repositories.",
      },
      {
        id: "link-pred-4",
        source: "Quantum Molecular Simulation",
        target: "CRISPR-Cas9 Editing Vectors",
        predictedProbability: 0.796,
        topologicalDistance: 4,
        epistemicNovelty: "Emergent Paradigm",
        sharedLatentDim: ["Off-Target Quantum Energetics", "Enzymatic Binding Affinities", "Hamiltonian Ground States"],
        mechanism: "Sub-graph neighborhood convolution bridges chemical physics and off-target cleavage kinetic prediction.",
      },
      {
        id: "link-pred-5",
        source: "Multi-Modal Health Records",
        target: "Ethical AI & Algorithmic Bias",
        predictedProbability: 0.821,
        topologicalDistance: 2,
        epistemicNovelty: "Translational Governance",
        sharedLatentDim: ["Demographic Stratification", "Fairness Metrics", "Clinical Decision Auditing"],
        mechanism: "Inductive node representation predicts dense co-authorship formation between clinical informatics and ethics labs.",
      },
    ],
    attentionPairs: [
      { source: "Protein Structure Prediction (ESMFold)", target: "Deep Neural Networks", alpha: 0.384, citationCount: 240, type: "Foundational Anchor" },
      { source: "Protein Structure Prediction (ESMFold)", target: "Graph Attention Networks (GAT)", alpha: 0.412, citationCount: 45, type: "High Epistemic Impact (Hidden by Traditional Counts)" },
      { source: "Single-Cell RNA Transcriptomics", target: "CRISPR-Cas9 Editing Vectors", alpha: 0.355, citationCount: 180, type: "Methodological Synergy" },
      { source: "Diffusion Models for Chemistry", target: "Quantum Molecular Simulation", alpha: 0.298, citationCount: 12, type: "Emerging Bridge (Very High Latent Weight)" },
      { source: "Genomic Sequence Transformers", target: "Convolutional Architectures", alpha: 0.142, citationCount: 310, type: "Superficial Historical Citation (Low Epistemic Weight)" },
    ],
  });

  const [gnnError, setGnnError] = useState<string | null>(null);

  const handleTrainGNN = async () => {
    setGnnRunning(true);
    setGnnError(null);
    try {
      const res = await fetch("/api/ml/gnn-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          architecture: gnnArch,
          epochs: gnnEpochs,
          hiddenDim: gnnHiddenDim,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGnnError(data?.error || `GNN server error (${res.status})`);
        return;
      }
      const validation = validateGnnResponse(data);
      if (validation.success && validation.data) {
        setGnnData(validation.data);
      } else {
        setGnnError(
          validation.error ||
            "GNN response contained malformed training metrics or node structures."
        );
      }
    } catch (err) {
      console.error("GNN training error:", err);
      setGnnError(
        err instanceof Error ? err.message : "Failed to train GNN network"
      );
    } finally {
      setGnnRunning(false);
    }
  };

  // Simulator state
  const [simTeamSize, setSimTeamSize] = useState(4);
  const [simIsPrestigious, setSimIsPrestigious] = useState(true);
  const [simAbstractWords, setSimAbstractWords] = useState(190);
  const [simKeywordCount] = useState(6);
  const [simIsInternational, setSimIsInternational] = useState(true);
  const [simAuthorExp] = useState(4);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<{
    predicted_probability: number;
    percentile_rank: number;
    predicted_tier: string;
    is_high_impact: boolean;
    attributions: Array<{ feature: string; impactPct: number; rawScore: number }>;
  } | null>({
    predicted_probability: 0.812,
    percentile_rank: 88,
    predicted_tier: "Breakthrough Candidate (Top 10%)",
    is_high_impact: true,
    attributions: [
      { feature: "Venue Prestige & Journal Impact Tier", impactPct: 34, rawScore: 1.0 },
      { feature: "International Co-authorship Advantage", impactPct: 26, rawScore: 1.0 },
      { feature: "Lead Author Research Trajectory", impactPct: 18, rawScore: 0.8 },
      { feature: "Abstract Information Density & Depth", impactPct: 12, rawScore: 0.76 },
      { feature: "Team Size & Collaboration Breadth", impactPct: 10, rawScore: 0.4 },
    ],
  });

  const datasetAnalyses = activeDatasetId
    ? analyses.filter(
        (a) =>
          a.dataset_id === activeDatasetId ||
          a.dataset_version_id?.includes(activeDatasetId)
      )
    : analyses;
  const analysisPool = datasetAnalyses.length > 0 ? datasetAnalyses : analyses;

  const kmeansAnalysis = analysisPool.find(
    (a) =>
      a.capability_id === "ml.kmeans_clusters" || a.id.includes("ml-kmeans")
  );
  const ldaAnalysis = analysisPool.find(
    (a) => a.capability_id === "ml.lda_topics" || a.id.includes("ml-lda")
  );

  const kmeansRecords: ResultRecord[] = kmeansAnalysis?.result?.records || [];
  const ldaRecords: ResultRecord[] = ldaAnalysis?.result?.records || [];

  // Design System categorical cluster colors
  const clusterColors: Record<
    number,
    { bg: string; text: string; fill: string; border: string }
  > = {
    1: {
      bg: "bg-brand-50",
      text: "text-brand-700",
      fill: "#315C7C",
      border: "border-brand-200",
    },
    2: {
      bg: "bg-status-success-bg",
      text: "text-status-success-text",
      fill: "#0D9488",
      border: "border-status-success-border",
    },
    3: {
      bg: "bg-status-info-bg",
      text: "text-status-info-text",
      fill: "#6366F1",
      border: "border-status-info-border",
    },
    4: {
      bg: "bg-status-warning-bg",
      text: "text-status-warning-text",
      fill: "#D97706",
      border: "border-status-warning-border",
    },
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimError(null);
    try {
      const res = await fetch("/api/ml/predict-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSize: simTeamSize,
          isPrestigiousVenue: simIsPrestigious,
          abstractLength: simAbstractWords,
          keywordCount: simKeywordCount,
          isInternational: simIsInternational,
          authorExperience: simAuthorExp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSimError(data?.error || `Simulation server error (${res.status})`);
        return;
      }
      const validation = validatePredictSimulatorResponse(data);
      if (validation.success && validation.data) {
        setSimResult(validation.data);
      } else {
        setSimError(
          validation.error ||
            "Simulator returned an incomplete prediction object."
        );
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setSimError(
        err instanceof Error ? err.message : "Failed to run simulation"
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredKMeansDocs = kmeansRecords.filter((r) => {
    const matchesCluster =
      selectedClusterFilter === "all" ||
      Number(r.cluster_id) === selectedClusterFilter;
    const matchesQuery =
      !searchQuery ||
      String(r.title || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      String(r.authors || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      String(r.cluster_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesCluster && matchesQuery;
  });

  const selectedDoc =
    kmeansRecords.find((r) => String(r.id) === selectedDocId) ||
    kmeansRecords[0];

  return (
    <div className="space-y-6">
      {/* Top Banner with Architecture Context */}
      <div className="sciai-studio-shell p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-ink-primary">
                  Scientometric Machine Learning Studio
                </h2>
                <span className="whitespace-nowrap rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-status-success-text">
                  Native TS Engine
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ink-muted">
                Empowering scientometric discovery with algorithmic Machine
                Learning: Unsupervised K-Means++ clustering over TF-IDF term
                spaces, Gibbs-sampled Latent Dirichlet Allocation (LDA) topic
                modeling, and Supervised Ridge-regularized citation trajectory
                classifiers with SHAP feature attributions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {datasets.length > 0 && (
              <div className="flex min-w-0 flex-col">
                <label
                  htmlFor="ml-dataset-select"
                  className="flex items-center gap-1 text-xs font-semibold text-ink-secondary"
                >
                  <Database className="h-3 w-3 shrink-0 text-brand-500" />
                  Target Dataset
                </label>
                <select
                  id="ml-dataset-select"
                  className="mt-1 block w-full min-w-0 max-w-full truncate rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none sm:w-80"
                  value={activeDatasetId}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.id} ({d.record_count || 0} docs)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onTriggerAnalysis(
                    "ml.kmeans_clusters",
                    "K-Means Clustering & PCA"
                  )
                }
                icon={<RefreshCw className="h-3.5 w-3.5 text-ink-subtle" />}
              >
                Retrain K-Means
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  onTriggerAnalysis("ml.lda_topics", "LDA Topic Modeling")
                }
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                Execute LDA Modeling
              </Button>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => setActiveSubTab("kmeans")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeSubTab === "kmeans"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            1. K-Means &amp; PCA 2D Clustering
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("lda")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeSubTab === "lda"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            2. LDA Topic Modeling
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("simulator")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeSubTab === "simulator"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            3. Supervised Impact Classifier &amp; Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("gnn")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeSubTab === "gnn"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            4. Graph Neural Networks (GNN &amp; pyBibX Vision)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("classifiers")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeSubTab === "classifiers"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>5. Statistical Text Classifiers &amp; Stratified K-Fold</span>
            <span
              className={`tabular-metrics rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                activeSubTab === "classifiers"
                  ? "bg-white/20 text-white"
                  : "border border-brand-200 bg-brand-50 text-brand-700"
              }`}
            >
              [761]
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: K-Means & PCA 2D Scatter Space */}
      {activeSubTab === "kmeans" && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card padding="sm">
              <div className="sciai-kicker">Clusters Formed (k)</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                4 Clusters
              </div>
              <div className="mt-1 text-[11px] font-semibold text-status-success-text">
                K-Means++ Initialized
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Vector Space Dim</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                150 Terms
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                TF-IDF L2 Normalized
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">WCSS Inertia</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                12.48
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Within-Cluster Sum of Squares
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Dimensionality Reduction</div>
              <div className="mt-1 text-2xl font-black text-ink-primary">
                PCA (2D)
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Power Iteration Eigenvectors
              </div>
            </Card>
          </div>

          {/* Interactive 2D PCA Scatter View & Cluster Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* 2D PCA Visualization Map */}
            <Card padding="md" className="lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-4">
                <div>
                  <h3 className="text-sm font-black text-ink-primary">
                    2D Principal Component Projection (PCA)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    High-dimensional TF-IDF vectors projected onto Principal
                    Components 1 &amp; 2
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedClusterFilter("all")}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      selectedClusterFilter === "all"
                        ? "bg-brand-500 text-white"
                        : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
                    }`}
                  >
                    All
                  </button>
                  {[1, 2, 3, 4].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setSelectedClusterFilter(c)}
                      className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                        selectedClusterFilter === c
                          ? "bg-brand-500 text-white"
                          : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: clusterColors[c]?.fill }}
                      />
                      C{c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scatter SVG Plot */}
              <div className="relative mt-4 flex h-96 w-full items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-subtle">
                <svg viewBox="-90 -90 180 180" className="h-full w-full">
                  <line
                    x1="-90"
                    y1="0"
                    x2="90"
                    y2="0"
                    stroke="#d8ddd8"
                    strokeDasharray="3 3"
                    strokeWidth="0.8"
                  />
                  <line
                    x1="0"
                    y1="-90"
                    x2="0"
                    y2="90"
                    stroke="#d8ddd8"
                    strokeDasharray="3 3"
                    strokeWidth="0.8"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="40"
                    fill="none"
                    stroke="#e5e8e4"
                    strokeWidth="1"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="75"
                    fill="none"
                    stroke="#e5e8e4"
                    strokeWidth="1"
                  />

                  <text
                    x="80"
                    y="-3"
                    fontSize="5"
                    fill="#828d98"
                    textAnchor="end"
                    fontWeight="bold"
                  >
                    PC 1 →
                  </text>
                  <text
                    x="3"
                    y="-80"
                    fontSize="5"
                    fill="#828d98"
                    textAnchor="start"
                    fontWeight="bold"
                  >
                    ↑ PC 2
                  </text>

                  {filteredKMeansDocs.map((doc, idx) => {
                    const cId = Number(doc.cluster_id) || 1;
                    const color = clusterColors[cId]?.fill || "#315C7C";
                    const isSelected = String(doc.id) === selectedDoc?.id;
                    const x = Number(doc.pca_x) || 0;
                    const y = Number(doc.pca_y) || 0;
                    const citations = Number(doc.citations) || 10;
                    const radius = Math.max(
                      3.5,
                      Math.min(8.5, 3 + Math.sqrt(citations) * 0.35)
                    );

                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-transform hover:scale-125"
                        onClick={() => setSelectedDocId(String(doc.id))}
                      >
                        {isSelected && (
                          <circle
                            cx={x}
                            cy={-y}
                            r={radius + 3}
                            fill="none"
                            stroke="#101820"
                            strokeWidth="1.2"
                            strokeDasharray="2 1"
                          />
                        )}
                        <circle
                          cx={x}
                          cy={-y}
                          r={radius}
                          fill={color}
                          opacity={isSelected ? 1.0 : 0.85}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Legend Overlay */}
                <div className="absolute bottom-3 left-3 rounded-lg border border-border-default bg-surface-canvas/95 px-3 py-2 text-[10px] shadow-card">
                  <div className="mb-1 font-bold text-ink-primary">
                    Clusters (K-Means++):
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="h-2 w-2 rounded-full bg-[#315C7C]" /> C1:
                      AI Diagnostics &amp; Vision
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="h-2 w-2 rounded-full bg-[#0D9488]" /> C2:
                      Genomic Graphs &amp; Omics
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="h-2 w-2 rounded-full bg-[#6366F1]" /> C3:
                      Clinical NLP &amp; Surveillance
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="h-2 w-2 rounded-full bg-[#D97706]" /> C4:
                      Bioethics &amp; Governance
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Selected Document & Cluster Inspector */}
            <div className="space-y-4 lg:col-span-4">
              <Card padding="md">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <span className="sciai-kicker">Document Vector Inspector</span>
                  {selectedDoc && (
                    <span
                      className={`tabular-metrics rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        clusterColors[Number(selectedDoc.cluster_id)]?.bg
                      } ${clusterColors[Number(selectedDoc.cluster_id)]?.text} ${
                        clusterColors[Number(selectedDoc.cluster_id)]?.border
                      }`}
                    >
                      Cluster {String(selectedDoc.cluster_id)}
                    </span>
                  )}
                </div>

                {selectedDoc ? (
                  <div className="mt-3.5 space-y-3">
                    <div>
                      <div className="sciai-kicker text-[10px]!">Title</div>
                      <div className="mt-0.5 text-xs font-black leading-snug text-ink-primary">
                        {String(selectedDoc.title)}
                      </div>
                    </div>

                    <div>
                      <div className="sciai-kicker text-[10px]!">Authors</div>
                      <div className="mt-0.5 text-xs font-medium text-ink-secondary">
                        {String(selectedDoc.authors || "N/A")}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">
                          Citations
                        </div>
                        <div className="tabular-metrics text-sm font-black text-ink-primary">
                          {String(selectedDoc.citations)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                        <div className="sciai-kicker text-[9px]!">Year</div>
                        <div className="tabular-metrics text-sm font-black text-ink-primary">
                          {String(selectedDoc.year)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="sciai-kicker text-[10px]!">
                        Cluster Identity
                      </div>
                      <div className="mt-1 rounded-xl border border-border-default bg-surface-subtle p-2.5 text-xs">
                        <div className="font-bold text-ink-primary">
                          {String(selectedDoc.cluster_name)}
                        </div>
                        <div className="mt-1 text-[11px] text-ink-muted">
                          <span className="font-semibold text-ink-secondary">
                            Centroid Terms:{" "}
                          </span>
                          {String(selectedDoc.top_cluster_terms)}
                        </div>
                        <div className="tabular-metrics mt-1 font-mono text-[10px] text-ink-subtle">
                          PCA Coordinates: ({String(selectedDoc.pca_x)},{" "}
                          {String(selectedDoc.pca_y)})
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-ink-subtle">
                    Click any point in the 2D PCA map to inspect its vector
                    metrics.
                  </div>
                )}
              </Card>

              {/* Cluster Overview Cards */}
              <Card padding="sm">
                <div className="mb-2.5 text-xs font-bold text-ink-primary">
                  Centroid Keyword Signatures
                </div>
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-2.5">
                    <div className="text-[11px] font-bold text-brand-800">
                      Cluster 1: AI Diagnostics &amp; Vision
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-700">
                      imaging, histopathology, contrastive, segmentation
                    </div>
                  </div>
                  <div className="rounded-xl border border-status-success-border bg-status-success-bg/70 p-2.5">
                    <div className="text-[11px] font-bold text-status-success-text">
                      Cluster 2: Genomic Graphs &amp; Omics
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-secondary">
                      knowledge graph, drug discovery, embeddings, multi-omics
                    </div>
                  </div>
                  <div className="rounded-xl border border-status-info-border bg-status-info-bg/70 p-2.5">
                    <div className="text-[11px] font-bold text-status-info-text">
                      Cluster 3: Clinical NLP &amp; Surveillance
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-secondary">
                      language models, clinical, evaluation, triage
                    </div>
                  </div>
                  <div className="rounded-xl border border-status-warning-border bg-status-warning-bg/70 p-2.5">
                    <div className="text-[11px] font-bold text-status-warning-text">
                      Cluster 4: Bioethics &amp; Governance
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-secondary">
                      bioethics, regulation, healthcare policy, bias mitigation
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Search & Document Membership Table */}
          <Card padding="md">
            <div className="flex flex-col justify-between gap-3 border-b border-border-subtle pb-3.5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-black text-ink-primary">
                  Document Cluster Assignments
                </h3>
                <p className="text-xs text-ink-muted">
                  TF-IDF vector distances with K-Means++ clustering membership
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Filter documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle py-1.5 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-secondary">
                <thead className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-3 py-2.5">Cluster</th>
                    <th className="px-3 py-2.5">Document Title</th>
                    <th className="px-3 py-2.5">Source Venue</th>
                    <th className="px-3 py-2.5 text-center">Year</th>
                    <th className="px-3 py-2.5 text-right">Citations</th>
                    <th className="px-3 py-2.5 text-center">PCA (x, y)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredKMeansDocs.map((doc, idx) => {
                    const cId = Number(doc.cluster_id) || 1;
                    const isSelected = String(doc.id) === selectedDoc?.id;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedDocId(String(doc.id))}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand-50/70 font-semibold"
                            : "hover:bg-surface-subtle/70"
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`tabular-metrics inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              clusterColors[cId]?.bg
                            } ${clusterColors[cId]?.text} ${
                              clusterColors[cId]?.border
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: clusterColors[cId]?.fill,
                              }}
                            />
                            Cluster {cId}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-3 py-2.5 font-medium text-ink-primary">
                          {String(doc.title)}
                        </td>
                        <td className="max-w-44 truncate px-3 py-2.5 text-ink-muted">
                          {String(doc.source)}
                        </td>
                        <td className="tabular-metrics px-3 py-2.5 text-center font-mono text-ink-muted">
                          {String(doc.year)}
                        </td>
                        <td className="tabular-metrics px-3 py-2.5 text-right font-bold text-ink-primary">
                          {String(doc.citations)}
                        </td>
                        <td className="tabular-metrics px-3 py-2.5 text-center font-mono text-[11px] text-ink-subtle">
                          {String(doc.pca_x)}, {String(doc.pca_y)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: LDA Topic Modeling */}
      {activeSubTab === "lda" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card padding="sm">
              <div className="sciai-kicker">Topics Extracted (K)</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                4 Latent Topics
              </div>
              <div className="mt-1 text-[11px] font-semibold text-status-success-text">
                Collapsed Gibbs Sampling
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Model Perplexity</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                42.18
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Lower perplexity = superior fit
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Dirichlet Hyperparameters</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                α = 12.5 • β = 0.1
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Topic-document &amp; Word priors
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {ldaRecords.map((topic, idx) => {
              const weights =
                (topic.word_weights as Array<{
                  word: string;
                  weight: number;
                }>) || [];
              const share = Number(topic.corpus_share_pct) || 25;

              return (
                <Card
                  key={idx}
                  padding="md"
                  className="transition-colors hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
                    <div>
                      <span className="sciai-kicker text-[10px]! text-brand-500!">
                        Topic {String(topic.topic_id)}
                      </span>
                      <h4 className="mt-0.5 text-sm font-black text-ink-primary">
                        {String(topic.topic_name)}
                      </h4>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="tabular-metrics text-base font-black text-ink-primary">
                        {share}%
                      </div>
                      <div className="text-[10px] font-semibold text-ink-subtle">
                        Corpus Share
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, share * 2)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="sciai-kicker mb-2 text-[10px]!">
                      Dirichlet Keyword Probabilities β(w|k)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {weights.slice(0, 8).map((w, wIdx) => (
                        <span
                          key={wIdx}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary"
                        >
                          <span className="font-semibold text-ink-primary">
                            {w.word}
                          </span>
                          <span className="tabular-metrics rounded-sm border border-brand-200 bg-brand-50 px-1 font-mono text-[10px] font-bold text-brand-700">
                            {w.weight}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Supervised Impact Classifier & Live Simulator */}
      {activeSubTab === "simulator" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card padding="sm">
              <div className="sciai-kicker">Model Classification Accuracy</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-status-success-text">
                85.0%
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Logistic Ridge with L2 penalty
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Target Threshold</div>
              <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                ≥ 100 Cites
              </div>
              <div className="mt-1 text-[11px] font-medium text-ink-muted">
                Top 25% Citation Velocity
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Primary Impact Driver</div>
              <div className="mt-1 text-base font-black text-ink-primary">
                Venue Prestige
              </div>
              <div className="tabular-metrics mt-1 text-[11px] font-medium text-ink-muted">
                +34% SHAP Attribution
              </div>
            </Card>
            <Card padding="sm">
              <div className="sciai-kicker">Secondary Driver</div>
              <div className="mt-1 text-base font-black text-ink-primary">
                International Team
              </div>
              <div className="tabular-metrics mt-1 text-[11px] font-medium text-ink-muted">
                +26% SHAP Attribution
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Interactive Simulator Controls */}
            <Card padding="md" className="lg:col-span-6">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <Sliders className="h-4 w-4 text-brand-500" />
                <h3 className="text-sm font-black text-ink-primary">
                  Paper Attributes Simulator
                </h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Adjust research paper characteristics to evaluate predicted
                citation velocity and breakthrough likelihood.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-ink-primary">
                    <span>Co-authors Team Size:</span>
                    <span className="tabular-metrics font-black text-brand-600">
                      {simTeamSize} Authors
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={simTeamSize}
                    onChange={(e) => setSimTeamSize(Number(e.target.value))}
                    className="mt-2 w-full cursor-pointer accent-brand-500"
                  />
                  <div className="flex justify-between text-[10px] font-medium text-ink-subtle">
                    <span>Single (1)</span>
                    <span>Consortium (12+)</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-primary">
                    Target Publication Venue:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimIsPrestigious(true)}
                      className={`cursor-pointer rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        simIsPrestigious
                          ? "border-brand-500 bg-brand-50 font-bold text-brand-800"
                          : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                      }`}
                    >
                      <div className="text-xs font-black">
                        Top Tier Flagship
                      </div>
                      <div className="text-[10px] opacity-80">
                        Nature, Lancet, IEEE, Science
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimIsPrestigious(false)}
                      className={`cursor-pointer rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        !simIsPrestigious
                          ? "border-brand-500 bg-brand-50 font-bold text-brand-800"
                          : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                      }`}
                    >
                      <div className="text-xs font-black">
                        Specialized Q2/Q3
                      </div>
                      <div className="text-[10px] opacity-80">
                        Domain-specific journal
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-ink-primary">
                    <span>Abstract Information Length:</span>
                    <span className="tabular-metrics font-black text-brand-600">
                      {simAbstractWords} Words
                    </span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="320"
                    step="10"
                    value={simAbstractWords}
                    onChange={(e) =>
                      setSimAbstractWords(Number(e.target.value))
                    }
                    className="mt-2 w-full cursor-pointer accent-brand-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-primary">
                    International Multi-country Collaboration:
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSimIsInternational(true)}
                      className={`flex-1 cursor-pointer rounded-xl border py-2 text-xs font-bold transition-colors ${
                        simIsInternational
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-border-default bg-surface-canvas text-ink-secondary"
                      }`}
                    >
                      Multi-Country (MCP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimIsInternational(false)}
                      className={`flex-1 cursor-pointer rounded-xl border py-2 text-xs font-bold transition-colors ${
                        !simIsInternational
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-border-default bg-surface-canvas text-ink-secondary"
                      }`}
                    >
                      Single Country (SCP)
                    </button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={isSimulating}
                  disabled={isSimulating}
                  onClick={handleRunSimulation}
                  icon={
                    !isSimulating ? <TrendingUp className="h-3.5 w-3.5" /> : undefined
                  }
                  className="mt-3 w-full"
                >
                  {isSimulating
                    ? "Evaluating Neural Gradient..."
                    : "Simulate Impact Prediction"}
                </Button>
              </div>
            </Card>

            {/* Model Output & Attribution Breakdown */}
            <div className="space-y-4 lg:col-span-6">
              {simError && (
                <AlertBanner
                  tone="danger"
                  title="Simulator Incomplete or Unavailable:"
                >
                  {simError}
                </AlertBanner>
              )}

              {simResult && (
                <Card padding="md">
                  <div className="sciai-kicker">ML Prediction Output</div>

                  <div className="mt-3 rounded-xl border border-status-success-border bg-gradient-to-br from-status-success-bg/80 to-surface-canvas p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-status-success-text">
                        Predicted Citation Velocity
                      </span>
                      <span className="tabular-metrics rounded-full bg-status-success-text px-2.5 py-0.5 text-[11px] font-black text-white">
                        {simResult.percentile_rank ?? 0}th Percentile
                      </span>
                    </div>

                    <div className="mt-2 text-lg font-black text-ink-primary">
                      {simResult.predicted_tier || "Unclassified Tier"}
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink-secondary">
                        <span>High-Impact Probability:</span>
                        <span className="tabular-metrics font-bold text-status-success-text">
                          {Math.round(
                            (simResult.predicted_probability ?? 0) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-status-success-border/50">
                        <div
                          className="h-full rounded-full bg-status-success-text transition-all duration-500"
                          style={{
                            width: `${Math.round((simResult.predicted_probability ?? 0) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SHAP Feature Attributions Bar Chart */}
                  <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between text-xs font-bold text-ink-primary">
                      <span>Feature Attributions (SHAP Contribution):</span>
                      <span className="text-[10px] font-normal text-ink-subtle">
                        Sum = 100%
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(simResult.attributions || []).map((attr, aIdx) => (
                        <div key={aIdx} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-ink-secondary">
                              {attr.feature}
                            </span>
                            <span className="tabular-metrics font-mono font-bold text-ink-primary">
                              +{attr.impactPct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{
                                width: `${Math.min(100, (attr.impactPct || 0) * 2.5)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GRAPH NEURAL NETWORKS (GNN) & pyBibX VISION */}
      {activeSubTab === "gnn" && (
        <div className="space-y-6">
          {/* GNN Header & Hyperparameter Toolbar */}
          <div className="sciai-studio-shell p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    pyBibX Scientometric Vision
                  </span>
                  <span className="font-mono text-xs font-bold text-brand-600">
                    Deep Non-Linear Relational Learning
                  </span>
                </div>
                <h2 className="mt-1.5 text-xl font-black tracking-tight text-ink-primary">
                  Graph Neural Networks (GNN) &amp; Deep Representation Lab
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
                  As envisioned by pyBibX, bibliometric data is inherently
                  graph-structured. GNN architectures execute recursive
                  message-passing across multi-hop citation and co-authorship
                  topologies, computing continuous 64D dense embeddings to
                  uncover latent cross-disciplinary bridges, missing links, and
                  deep epistemic influences that shallow heuristics (Louvain,
                  PageRank, VOSviewer) cannot detect.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                loading={gnnRunning}
                disabled={gnnRunning}
                onClick={handleTrainGNN}
                icon={
                  !gnnRunning ? <RefreshCw className="h-4 w-4" /> : undefined
                }
                className="shrink-0"
              >
                {gnnRunning
                  ? "Forward Pass Training..."
                  : "Train GNN & Predict Links"}
              </Button>
            </div>

            {/* Hyperparameter Settings */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  GNN Architecture
                </label>
                <select
                  value={gnnArch}
                  onChange={(e) => setGnnArch(e.target.value as any)}
                  className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-bold text-ink-primary focus:border-brand-500 focus:outline-none"
                >
                  <option value="gat">
                    GAT (Graph Attention Network - Veličković)
                  </option>
                  <option value="gcn">
                    GCN (Graph Convolutional - Kipf &amp; Welling)
                  </option>
                  <option value="graphsage">
                    GraphSAGE (Inductive Aggregator - Hamilton)
                  </option>
                  <option value="hgt">
                    HGT (Heterogeneous Graph Transformer - Hu)
                  </option>
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[11px] font-bold text-ink-secondary">
                    Epochs (Training Cycles)
                  </label>
                  <span className="tabular-metrics font-mono text-xs font-black text-brand-600">
                    {gnnEpochs}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="10"
                  value={gnnEpochs}
                  onChange={(e) => setGnnEpochs(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-brand-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Latent Embedding Dim (d)
                </label>
                <select
                  value={gnnHiddenDim}
                  onChange={(e) => setGnnHiddenDim(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-bold text-ink-primary focus:border-brand-500 focus:outline-none"
                >
                  <option value={32}>32 Dimensions (Fast)</option>
                  <option value={64}>64 Dimensions (Optimal)</option>
                  <option value={128}>128 Dimensions (High-Capacity)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-ink-secondary">
                  Message-Passing Aggregator
                </label>
                <div className="rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 font-mono text-xs text-ink-secondary">
                  {gnnArch === "gat" && "Multi-Head Self-Attention (h=4)"}
                  {gnnArch === "gcn" && "Normalized Adjacency (D^-1/2 A D^-1/2)"}
                  {gnnArch === "graphsage" &&
                    "Mean Pooling with Skip-Connection"}
                  {gnnArch === "hgt" && "Type-Specific Mutual Attention"}
                </div>
              </div>
            </div>
          </div>

          {gnnError && (
            <AlertBanner tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">GNN Execution Issue: </span>
                  <span>{gnnError}</span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleTrainGNN}
                >
                  Retry GNN
                </Button>
              </div>
            </AlertBanner>
          )}

          {/* Model Evaluation & Training Metrics Strip */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Link Prediction ROC-AUC
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-status-success-text">
                {gnnData?.trainingMetrics?.rocAuc != null
                  ? `${(gnnData.trainingMetrics.rocAuc * 100).toFixed(1)}%`
                  : "—"}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-muted">
                True positive vs false alarm
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Mean Reciprocal Rank (MRR)
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-brand-500">
                {gnnData?.trainingMetrics?.meanReciprocalRank != null
                  ? gnnData.trainingMetrics.meanReciprocalRank.toFixed(3)
                  : "—"}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-muted">
                Precision of top citations
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Cross-Entropy Loss
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-ink-primary">
                {gnnData?.trainingMetrics?.finalLoss != null
                  ? gnnData.trainingMetrics.finalLoss.toFixed(4)
                  : "—"}
              </div>
              <div className="tabular-metrics mt-0.5 text-[10px] font-bold text-status-success-text">
                {gnnData?.trainingMetrics?.convergenceEpoch != null
                  ? `Converged @ epoch ${gnnData.trainingMetrics.convergenceEpoch}`
                  : "Baseline"}
              </div>
            </Card>

            <Card padding="sm">
              <div className="sciai-kicker text-[10px]!">
                Latent Representations
              </div>
              <div className="tabular-metrics mt-1 font-mono text-2xl font-black text-brand-600">
                {gnnData?.nodeEmbeddings?.length ?? 0} Nodes
              </div>
              <div className="tabular-metrics mt-0.5 text-[10px] text-ink-muted">
                {gnnHiddenDim}D continuous manifold
              </div>
            </Card>
          </div>

          {/* Sub-view Navigation Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setGnnActiveView("links")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  gnnActiveView === "links"
                    ? "bg-brand-500 text-white shadow-xs"
                    : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                <span>
                  1. Inductive Link Prediction ({gnnData.predictedLinks.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGnnActiveView("manifold")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  gnnActiveView === "manifold"
                    ? "bg-brand-500 text-white shadow-xs"
                    : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>2. 2D Continuous Neural Manifold (t-SNE)</span>
              </button>

              <button
                type="button"
                onClick={() => setGnnActiveView("attention")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  gnnActiveView === "attention"
                    ? "bg-brand-500 text-white shadow-xs"
                    : "bg-surface-subtle text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>3. Graph Attention Weights (α_ij)</span>
              </button>
            </div>

            <div className="hidden items-center gap-1 font-mono text-[11px] text-ink-subtle sm:flex">
              <span>Backprop: AdamW (lr=0.005)</span>
            </div>
          </div>

          {/* VIEW 1: INDUCTIVE LINK PREDICTION */}
          {gnnActiveView === "links" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-xs leading-relaxed text-ink-secondary">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div>
                  <strong className="text-ink-primary">
                    How GNN Link Prediction Works in pyBibX:
                  </strong>{" "}
                  Traditional bibliometrics only detects connections that have
                  already been explicitly established. Graph Neural Networks
                  model high-order structural and semantic compatibility,
                  predicting which emerging disciplines or author teams are on
                  the verge of cross-disciplinary convergence before direct
                  co-citations appear.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gnnData.predictedLinks.map((link: any) => (
                  <Card
                    key={link.id}
                    padding="md"
                    className="flex flex-col justify-between space-y-3 transition-colors hover:border-brand-300"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-black uppercase text-brand-700">
                          {link.epistemicNovelty}
                        </span>
                        <span className="tabular-metrics font-mono text-xs font-black text-status-success-text">
                          P = {(link.predictedProbability * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs font-black text-ink-primary">
                        <span className="truncate">{link.source}</span>
                        <Share2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                        <span className="truncate">{link.target}</span>
                      </div>

                      <div className="tabular-metrics mt-1 font-mono text-[11px] text-ink-muted">
                        Topological Graph Distance: {link.topologicalDistance}{" "}
                        hops
                      </div>

                      <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
                        {link.mechanism}
                      </p>
                    </div>

                    <div className="border-t border-border-subtle pt-3">
                      <div className="sciai-kicker mb-1 text-[10px]!">
                        Latent Bridging Dimensions:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {link.sharedLatentDim.map((dim: string) => (
                          <span
                            key={dim}
                            className="rounded border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary"
                          >
                            {dim}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 2: 2D CONTINUOUS NEURAL MANIFOLD (t-SNE) */}
          {gnnActiveView === "manifold" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card
                padding="lg"
                className="space-y-4 rounded-3xl lg:col-span-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-ink-primary">
                      Latent Manifold: GNN Embeddings vs Louvain Communities
                    </h3>
                    <p className="text-xs text-ink-muted">
                      High-dimensional {gnnHiddenDim}D node embeddings projected
                      to 2D via t-SNE. Traditional Louvain modularity often
                      splits continuous latent clusters.
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-ink-subtle">
                    Perplexity=30 • Iterations=1000
                  </span>
                </div>

                {/* SVG Scatter Canvas */}
                <div className="relative flex h-88 w-full items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle p-4">
                  <svg className="h-full w-full" viewBox="-50 -40 100 80">
                    <line
                      x1="-50"
                      y1="0"
                      x2="50"
                      y2="0"
                      stroke="#d8ddd8"
                      strokeDasharray="2,2"
                      strokeWidth="0.5"
                    />
                    <line
                      x1="0"
                      y1="-40"
                      x2="0"
                      y2="40"
                      stroke="#d8ddd8"
                      strokeDasharray="2,2"
                      strokeWidth="0.5"
                    />

                    {gnnData.nodeEmbeddings.map((node: any) => {
                      const isSelected = selectedGnnNode === node.id;
                      const colors = [
                        "#315C7C",
                        "#0D9488",
                        "#D97706",
                        "#E11D48",
                      ];
                      const fill =
                        colors[(node.communityGNN - 1) % colors.length];
                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer transition-transform"
                          onClick={() => setSelectedGnnNode(node.id)}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isSelected ? 4 : 2.5}
                            fill={fill}
                            stroke={isSelected ? "#101820" : "#ffffff"}
                            strokeWidth={isSelected ? 1 : 0.4}
                            opacity={0.9}
                          />
                          <text
                            x={node.x + 3}
                            y={node.y + 1}
                            fontSize={2.6}
                            fontWeight={isSelected ? "bold" : "normal"}
                            fill="#101820"
                          >
                            {node.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-ink-subtle">
                      GNN Neural Clusters:
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#315C7C]" />{" "}
                      Deep Learning Theory
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-status-success-text">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488]" />{" "}
                      Bio-Molecular AI
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-status-warning-text">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />{" "}
                      Clinical Governance
                    </span>
                  </div>
                  <span className="text-[10px] text-ink-subtle">
                    Click a node to inspect
                  </span>
                </div>
              </Card>

              {/* Node Inspector Panel */}
              <Card
                padding="lg"
                className="space-y-4 rounded-3xl lg:col-span-1"
              >
                <div className="sciai-kicker text-[10px]! text-brand-500!">
                  Manifold Node Inspector
                </div>
                {selectedGnnNode ? (
                  (() => {
                    const node = gnnData.nodeEmbeddings.find(
                      (n: any) => n.id === selectedGnnNode
                    );
                    if (!node) return null;
                    return (
                      <div className="space-y-3">
                        <h4 className="text-base font-black text-ink-primary">
                          {node.name}
                        </h4>

                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                            <div className="sciai-kicker text-[9px]!">
                              GNN Cluster
                            </div>
                            <div className="tabular-metrics text-base font-black text-brand-600">
                              #{node.communityGNN}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                            <div className="sciai-kicker text-[9px]!">
                              Louvain Cluster
                            </div>
                            <div className="tabular-metrics text-base font-black text-ink-secondary">
                              #{node.communityLouvain}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                            <div className="sciai-kicker text-[9px]!">
                              Citations
                            </div>
                            <div className="tabular-metrics text-base font-black text-ink-primary">
                              {node.citations}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2">
                            <div className="sciai-kicker text-[9px]!">
                              Disruption Index
                            </div>
                            <div className="tabular-metrics font-mono text-base font-bold text-status-success-text">
                              {node.disruptionScore}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-border-subtle pt-2 text-xs leading-relaxed text-ink-secondary">
                          {node.communityGNN !== node.communityLouvain ? (
                            <span className="font-medium text-status-warning-text">
                              <strong>Discrepancy Detected:</strong> Traditional
                              Louvain assigned this node to cluster #
                              {node.communityLouvain} based solely on explicit
                              link count, whereas the GNN embedding places it in
                              cluster #{node.communityGNN} due to deep semantic
                              attribute alignment.
                            </span>
                          ) : (
                            <span className="font-medium text-status-success-text">
                              Strong consensus: Both topological modularity and
                              deep neural embedding agree on this topic's
                              community assignment.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-default bg-surface-subtle p-6 text-center text-xs text-ink-muted">
                    Click any point in the scatter manifold to inspect its
                    neural representation metrics and community consensus.
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* VIEW 3: GRAPH ATTENTION WEIGHTS (alpha_ij) */}
          {gnnActiveView === "attention" && (
            <Card padding="lg" className="space-y-4 rounded-3xl">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-black text-ink-primary">
                    Graph Attention Weights (α_ij) vs Nominal Citation Counts
                  </h3>
                  <p className="text-xs text-ink-muted">
                    GAT dynamically learns directed attention weights between
                    citing and cited concepts, exposing true epistemic influence
                    rather than superficial citations.
                  </p>
                </div>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">
                  Self-Attention Softmax Normalization
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Citing Paper / Entity</th>
                      <th className="px-4 py-3">Referenced Entity</th>
                      <th className="px-4 py-3">Attention Weight (α_ij)</th>
                      <th className="px-4 py-3">Nominal Citation Count</th>
                      <th className="px-4 py-3">Epistemic Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {gnnData.attentionPairs.map((pair: any, idx: number) => (
                      <tr
                        key={idx}
                        className="transition-colors hover:bg-brand-50/40"
                      >
                        <td className="px-4 py-3 font-bold text-ink-primary">
                          {pair.source}
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">
                          {pair.target}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="tabular-metrics font-mono text-xs font-black text-brand-600">
                              {pair.alpha.toFixed(3)}
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${pair.alpha * 200}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="tabular-metrics px-4 py-3 font-mono text-ink-muted">
                          {pair.citationCount}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-primary">
                            {pair.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Scientometric Comparative Matrix */}
          <div className="space-y-4 rounded-3xl border border-brand-200 bg-brand-50/50 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-primary">
              <CheckCircle2 className="h-4 w-4 text-brand-500" />
              <span>
                Paradigm Shift: Traditional Bibliometrics vs. Graph Neural
                Networks (GNNs)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
              <Card padding="sm" className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-status-danger-text">
                  <span>
                    Traditional Bibliometrics (Louvain, PageRank, VOSviewer)
                  </span>
                </div>
                <ul className="list-inside list-disc space-y-1.5 leading-relaxed text-ink-muted">
                  <li>
                    <strong className="text-ink-primary">
                      Discrete adjacency only:
                    </strong>{" "}
                    If two nodes have no direct link or shared neighbors,
                    similarity is zero.
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      Disconnected text attributes:
                    </strong>{" "}
                    Keyword co-occurrence and network topology are analyzed in
                    separate silos.
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      Transductive limitation:
                    </strong>{" "}
                    Cannot generalize to newly published papers without
                    recomputing the entire global matrix.
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      Equal edge assumption:
                    </strong>{" "}
                    Every citation is counted identically regardless of actual
                    methodological contribution.
                  </li>
                </ul>
              </Card>

              <Card padding="sm" className="space-y-2 border-brand-200">
                <div className="flex items-center gap-1.5 font-bold text-brand-700">
                  <span>Graph Neural Networks (GNNs - pyBibX Vision)</span>
                </div>
                <ul className="list-inside list-disc space-y-1.5 leading-relaxed text-ink-secondary">
                  <li>
                    <strong className="text-ink-primary">
                      Continuous Dense Manifolds:
                    </strong>{" "}
                    Learns 64D/128D continuous representations capturing
                    non-linear multi-hop semantics.
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      End-to-End Joint Modeling:
                    </strong>{" "}
                    Fuses text embeddings (SciBERT) directly with graph
                    message-passing layers.
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      Inductive Capability:
                    </strong>{" "}
                    Embeds new publications in real time without retraining the
                    whole graph (GraphSAGE).
                  </li>
                  <li>
                    <strong className="text-ink-primary">
                      Attention-Weighted Influence:
                    </strong>{" "}
                    GAT dynamically calculates the true epistemic significance
                    (α_ij) of every reference.
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Statistical Text Classifiers & Stratified K-Fold CV [761] */}
      {activeSubTab === "classifiers" && (
        <StatisticalTextClassifierStudio
          dataset={activeDatasetObj || dataset}
        />
      )}
    </div>
  );
}