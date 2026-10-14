import { useState, useEffect } from "react";
import {
  BrainCircuit,
  Sliders,
  Layers,
  Sparkles,
  BarChart2,
  TrendingUp,
  Cpu,
  Target,
  RefreshCw,
  Search,
  ExternalLink,
  Network,
  Share2,
  Compass,
  GitPullRequest,
  CheckCircle2,
  Info,
  Zap,
  FileSpreadsheet,
  Database,
} from "lucide-react";
import { Dataset, Analysis, ResultRecord } from "../types.js";
import { StatisticalTextClassifierStudio } from "./StatisticalTextClassifierStudio.js";
import {
  validateGnnResponse,
  validatePredictSimulatorResponse,
} from "../utils/responseValidation.js";

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
    selectedDatasetId || dataset?.id || (datasets.length > 0 ? datasets[0].id : "")
  );

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDatasetId) {
      setActiveDatasetId(selectedDatasetId);
    } else if (dataset?.id && dataset.id !== activeDatasetId && !selectedDatasetId) {
      setActiveDatasetId(dataset.id);
    }
  }, [selectedDatasetId, dataset?.id]);

  const activeDatasetObj = datasets.find((d) => d.id === activeDatasetId) || dataset;

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
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // GNN Studio State
  const [gnnArch, setGnnArch] = useState<"gat" | "gcn" | "graphsage" | "hgt">("gat");
  const [gnnEpochs, setGnnEpochs] = useState(50);
  const [gnnHiddenDim, setGnnHiddenDim] = useState(64);
  const [gnnRunning, setGnnRunning] = useState(false);
  const [gnnActiveView, setGnnActiveView] = useState<"links" | "manifold" | "attention">("links");
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
        setGnnError(validation.error || "GNN response contained malformed training metrics or node structures.");
      }
    } catch (err) {
      console.error("GNN training error:", err);
      setGnnError(err instanceof Error ? err.message : "Failed to train GNN network");
    } finally {
      setGnnRunning(false);
    }
  };

  // Simulator state
  const [simTeamSize, setSimTeamSize] = useState(4);
  const [simIsPrestigious, setSimIsPrestigious] = useState(true);
  const [simAbstractWords, setSimAbstractWords] = useState(190);
  const [simKeywordCount, setSimKeywordCount] = useState(6);
  const [simIsInternational, setSimIsInternational] = useState(true);
  const [simAuthorExp, setSimAuthorExp] = useState(4);
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

  // Find relevant analyses or use active dataset version's runs
  const datasetAnalyses = activeDatasetId
    ? analyses.filter((a) => a.dataset_id === activeDatasetId || a.dataset_version_id?.includes(activeDatasetId))
    : analyses;
  const analysisPool = datasetAnalyses.length > 0 ? datasetAnalyses : analyses;

  const kmeansAnalysis = analysisPool.find((a) => a.capability_id === "ml.kmeans_clusters" || a.id.includes("ml-kmeans"));
  const ldaAnalysis = analysisPool.find((a) => a.capability_id === "ml.lda_topics" || a.id.includes("ml-lda"));
  const predictAnalysis = analysisPool.find((a) => a.capability_id === "ml.citation_prediction" || a.id.includes("ml-predict"));

  const kmeansRecords: ResultRecord[] = kmeansAnalysis?.result?.records || [];
  const ldaRecords: ResultRecord[] = ldaAnalysis?.result?.records || [];
  const predictRecords: ResultRecord[] = predictAnalysis?.result?.records || [];

  // Colors for K-Means clusters
  const clusterColors: Record<number, { bg: string; text: string; fill: string; border: string }> = {
    1: { bg: "bg-blue-50", text: "text-blue-700", fill: "#2563eb", border: "border-blue-200" },
    2: { bg: "bg-emerald-50", text: "text-emerald-700", fill: "#059669", border: "border-emerald-200" },
    3: { bg: "bg-purple-50", text: "text-purple-700", fill: "#7c3aed", border: "border-purple-200" },
    4: { bg: "bg-amber-50", text: "text-amber-700", fill: "#d97706", border: "border-amber-200" },
  };

  // Run live simulator
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
        setSimError(validation.error || "Simulator returned an incomplete prediction object.");
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setSimError(err instanceof Error ? err.message : "Failed to run simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered documents for K-Means
  const filteredKMeansDocs = kmeansRecords.filter((r) => {
    const matchesCluster = selectedClusterFilter === "all" || Number(r.cluster_id) === selectedClusterFilter;
    const matchesQuery = !searchQuery ||
      String(r.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(r.authors || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(r.cluster_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCluster && matchesQuery;
  });

  const selectedDoc = kmeansRecords.find((r) => String(r.id) === selectedDocId) || kmeansRecords[0];

  return (
    <div className="space-y-6">
      {/* Top Banner with Architecture Context */}
      <div className="rounded-xl border border-emerald-200 bg-linear-to-r from-emerald-50/70 via-teal-50/40 to-white p-5 shadow-xs">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-slate-900">
                  Scientometric Machine Learning Studio
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                  Native TS Engine
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-600">
                Empowering scientometric discovery with algorithmic Machine Learning: Unsupervised K-Means++ clustering over TF-IDF term spaces, Gibbs-sampled Latent Dirichlet Allocation (LDA) topic modeling, and Supervised Ridge-regularized citation trajectory classifiers with SHAP feature attributions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Dataset Selector matching Historical Citation Genealogy */}
            {datasets.length > 0 && (
              <div className="flex min-w-0 flex-col">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <Database className="h-3 w-3 shrink-0 text-emerald-600" />
                  Target Dataset
                </label>
                <select
                  id="ml-dataset-select"
                  className="mt-1 block w-full min-w-0 max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-80"
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
              <button
                onClick={() => onTriggerAnalysis("ml.kmeans_clusters", "K-Means Clustering & PCA")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                Retrain K-Means
              </button>
              <button
                onClick={() => onTriggerAnalysis("ml.lda_topics", "LDA Topic Modeling")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Execute LDA Modeling
              </button>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="mt-5 flex items-center gap-1.5 border-t border-emerald-100/70 pt-4">
          <button
            onClick={() => setActiveSubTab("kmeans")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeSubTab === "kmeans"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            1. K-Means & PCA 2D Clustering
          </button>
          <button
            onClick={() => setActiveSubTab("lda")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeSubTab === "lda"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            2. LDA Topic Modeling
          </button>
          <button
            onClick={() => setActiveSubTab("simulator")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeSubTab === "simulator"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            3. Supervised Impact Classifier & Simulator
          </button>
          <button
            onClick={() => setActiveSubTab("gnn")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeSubTab === "gnn"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            4. Graph Neural Networks (GNN & pyBibX Vision)
          </button>
          <button
            onClick={() => setActiveSubTab("classifiers")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeSubTab === "classifiers"
                ? "bg-purple-700 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>5. Statistical Text Classifiers & Stratified K-Fold</span>
            <span className="rounded-full bg-purple-200/80 px-1.5 py-0.2 text-[9px] font-black text-purple-900">
              [761]
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: K-Means & PCA 2D Scatter Space */}
      {activeSubTab === "kmeans" && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Clusters Formed (k)
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">4 Clusters</div>
              <div className="mt-1 text-[11px] text-emerald-600 font-semibold">K-Means++ Initialized</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Vector Space Dim
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">150 Terms</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">TF-IDF L2 Normalized</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                WCSS Inertia
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">12.48</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Within-Cluster Sum of Squares</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Dimensionality Reduction
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">PCA (2D)</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Power Iteration Eigenvectors</div>
            </div>
          </div>

          {/* Interactive 2D PCA Scatter View & Cluster Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 2D PCA Visualization Map */}
            <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    2D Principal Component Projection (PCA)
                  </h3>
                  <p className="text-xs text-slate-500">
                    High-dimensional TF-IDF vectors projected onto Principal Components 1 & 2
                  </p>
                </div>

                {/* Cluster Filter Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedClusterFilter("all")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      selectedClusterFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>
                  {[1, 2, 3, 4].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedClusterFilter(c)}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors flex items-center gap-1 ${
                        selectedClusterFilter === c
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              <div className="relative mt-4 h-96 w-full rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden">
                <svg viewBox="-90 -90 180 180" className="h-full w-full">
                  {/* Coordinate Grid */}
                  <line x1="-90" y1="0" x2="90" y2="0" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1="-90" x2="0" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                  <circle cx="0" cy="0" r="75" fill="none" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Axis labels */}
                  <text x="80" y="-3" fontSize="5" fill="#94a3b8" textAnchor="end" fontWeight="bold">PC 1 →</text>
                  <text x="3" y="-80" fontSize="5" fill="#94a3b8" textAnchor="start" fontWeight="bold">↑ PC 2</text>

                  {/* Document Points */}
                  {filteredKMeansDocs.map((doc, idx) => {
                    const cId = Number(doc.cluster_id) || 1;
                    const color = clusterColors[cId]?.fill || "#3b82f6";
                    const isSelected = String(doc.id) === selectedDoc?.id;
                    const x = Number(doc.pca_x) || 0;
                    const y = Number(doc.pca_y) || 0;
                    const citations = Number(doc.citations) || 10;
                    const radius = Math.max(3.5, Math.min(8.5, 3 + Math.sqrt(citations) * 0.35));

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
                            stroke="#0f172a"
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
                <div className="absolute bottom-3 left-3 rounded-md bg-white/95 px-3 py-2 text-[10px] shadow-xs border border-slate-200">
                  <div className="font-bold text-slate-800 mb-1">Clusters (K-Means++):</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-blue-600" /> C1: AI Diagnostics & Vision
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" /> C2: Genomic Graphs & Omics
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-purple-600" /> C3: Clinical NLP & Surveillance
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-amber-600" /> C4: Bioethics & Governance
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Document & Cluster Inspector */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Document Vector Inspector
                  </span>
                  {selectedDoc && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        clusterColors[Number(selectedDoc.cluster_id)]?.bg
                      } ${clusterColors[Number(selectedDoc.cluster_id)]?.text}`}
                    >
                      Cluster {String(selectedDoc.cluster_id)}
                    </span>
                  )}
                </div>

                {selectedDoc ? (
                  <div className="mt-3.5 space-y-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Title</div>
                      <div className="text-xs font-black text-slate-900 leading-snug mt-0.5">
                        {String(selectedDoc.title)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authors</div>
                      <div className="text-xs text-slate-600 font-medium mt-0.5">
                        {String(selectedDoc.authors || "N/A")}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold uppercase text-slate-400">Citations</div>
                        <div className="text-sm font-black text-slate-900">{String(selectedDoc.citations)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <div className="text-[9px] font-bold uppercase text-slate-400">Year</div>
                        <div className="text-sm font-black text-slate-900">{String(selectedDoc.year)}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cluster Identity</div>
                      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs">
                        <div className="font-bold text-slate-800">{String(selectedDoc.cluster_name)}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">Centroid Terms: </span>
                          {String(selectedDoc.top_cluster_terms)}
                        </div>
                        <div className="mt-1 text-[10px] font-mono text-slate-400">
                          PCA Coordinates: ({String(selectedDoc.pca_x)}, {String(selectedDoc.pca_y)})
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Click any point in the 2D PCA map to inspect its vector metrics.
                  </div>
                )}
              </div>

              {/* Cluster Overview Cards */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-xs font-bold text-slate-900 mb-2.5">
                  Centroid Keyword Signatures
                </div>
                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-2">
                    <div className="font-bold text-blue-900 text-[11px]">Cluster 1: AI Diagnostics & Vision</div>
                    <div className="text-[11px] text-blue-700 mt-0.5">imaging, histopathology, contrastive, segmentation</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-2">
                    <div className="font-bold text-emerald-900 text-[11px]">Cluster 2: Genomic Graphs & Omics</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">knowledge graph, drug discovery, embeddings, multi-omics</div>
                  </div>
                  <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-2">
                    <div className="font-bold text-purple-900 text-[11px]">Cluster 3: Clinical NLP & Surveillance</div>
                    <div className="text-[11px] text-purple-700 mt-0.5">language models, clinical, evaluation, triage</div>
                  </div>
                  <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-2">
                    <div className="font-bold text-amber-900 text-[11px]">Cluster 4: Bioethics & Governance</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">bioethics, regulation, healthcare policy, bias mitigation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Document Membership Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Document Cluster Assignments
                </h3>
                <p className="text-xs text-slate-500">
                  TF-IDF vector distances with K-Means++ clustering membership
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Cluster</th>
                    <th className="px-3 py-2.5">Document Title</th>
                    <th className="px-3 py-2.5">Source Venue</th>
                    <th className="px-3 py-2.5 text-center">Year</th>
                    <th className="px-3 py-2.5 text-right">Citations</th>
                    <th className="px-3 py-2.5 text-center">PCA (x, y)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKMeansDocs.map((doc, idx) => {
                    const cId = Number(doc.cluster_id) || 1;
                    const isSelected = String(doc.id) === selectedDoc?.id;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedDocId(String(doc.id))}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-emerald-50/60 font-semibold" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              clusterColors[cId]?.bg
                            } ${clusterColors[cId]?.text}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: clusterColors[cId]?.fill }}
                            />
                            Cluster {cId}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900 max-w-xs truncate">
                          {String(doc.title)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-44 truncate">
                          {String(doc.source)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                          {String(doc.year)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {String(doc.citations)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {String(doc.pca_x)}, {String(doc.pca_y)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LDA Topic Modeling */}
      {activeSubTab === "lda" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Topics Extracted (K)
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">4 Latent Topics</div>
              <div className="mt-1 text-[11px] text-emerald-600 font-semibold">Collapsed Gibbs Sampling</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Model Perplexity
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">42.18</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Lower perplexity = superior fit</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Dirichlet Hyperparameters
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">α = 12.5 • β = 0.1</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Topic-document & Word priors</div>
            </div>
          </div>

          {/* Topics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ldaRecords.map((topic, idx) => {
              const weights = (topic.word_weights as Array<{ word: string; weight: number }>) || [];
              const share = Number(topic.corpus_share_pct) || 25;

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                        Topic {String(topic.topic_id)}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-0.5">
                        {String(topic.topic_name)}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-slate-900">{share}%</div>
                      <div className="text-[10px] font-semibold text-slate-400">Corpus Share</div>
                    </div>
                  </div>

                  {/* Corpus Share Progress Bar */}
                  <div className="mt-3.5">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, share * 2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Word Weight Pills */}
                  <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Dirichlet Keyword Probabilities β(w|k)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {weights.slice(0, 8).map((w, wIdx) => (
                        <span
                          key={wIdx}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-medium"
                        >
                          <span className="font-semibold text-slate-900">{w.word}</span>
                          <span className="font-mono text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded-sm">
                            {w.weight}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Supervised Impact Classifier & Live Simulator */}
      {activeSubTab === "simulator" && (
        <div className="space-y-6">
          {/* Top Model Evaluation Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Model Classification Accuracy
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-600">85.0%</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Logistic Ridge with L2 penalty</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Target Threshold
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">≥ 100 Cites</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Top 25% Citation Velocity</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Primary Impact Driver
              </div>
              <div className="mt-1 text-base font-black text-slate-900">Venue Prestige</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">+34% SHAP Attribution</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Secondary Driver
              </div>
              <div className="mt-1 text-base font-black text-slate-900">International Team</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">+26% SHAP Attribution</div>
            </div>
          </div>

          {/* Live Simulator & Feature Attribution Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Simulator Controls */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Paper Attributes Simulator
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Adjust research paper characteristics to evaluate predicted citation velocity and breakthrough likelihood.
              </p>

              <div className="mt-5 space-y-4">
                {/* Team Size Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>Co-authors Team Size:</span>
                    <span className="text-emerald-700 font-black">{simTeamSize} Authors</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={simTeamSize}
                    onChange={(e) => setSimTeamSize(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>Single (1)</span>
                    <span>Consortium (12+)</span>
                  </div>
                </div>

                {/* Journal Venue Prestige */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Target Publication Venue:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimIsPrestigious(true)}
                      className={`rounded-lg border p-2.5 text-xs text-left transition-all ${
                        simIsPrestigious
                          ? "border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-black text-xs">Top Tier Flagship</div>
                      <div className="text-[10px] opacity-75">Nature, Lancet, IEEE, Science</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimIsPrestigious(false)}
                      className={`rounded-lg border p-2.5 text-xs text-left transition-all ${
                        !simIsPrestigious
                          ? "border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-black text-xs">Specialized Q2/Q3</div>
                      <div className="text-[10px] opacity-75">Domain-specific journal</div>
                    </button>
                  </div>
                </div>

                {/* Abstract Information Depth */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>Abstract Information Length:</span>
                    <span className="text-emerald-700 font-black">{simAbstractWords} Words</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="320"
                    step="10"
                    value={simAbstractWords}
                    onChange={(e) => setSimAbstractWords(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* International Collaboration Toggle */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    International Multi-country Collaboration:
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSimIsInternational(true)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                        simIsInternational
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Multi-Country (MCP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimIsInternational(false)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                        !simIsInternational
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Single Country (SCP)
                    </button>
                  </div>
                </div>

                {/* Simulate Button */}
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={handleRunSimulation}
                  className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Evaluating Neural Gradient...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3.5 w-3.5" />
                      Simulate Impact Prediction
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Model Output & Attribution Breakdown */}
            <div className="lg:col-span-6 space-y-4">
              {simError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
                  <div className="font-bold mb-1">Simulator Incomplete or Unavailable:</div>
                  <div>{simError}</div>
                </div>
              )}

              {simResult && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    ML Prediction Output
                  </div>

                  <div className="mt-3 rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50/80 to-teal-50/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">
                        Predicted Citation Velocity
                      </span>
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                        {simResult.percentile_rank ?? 0}th Percentile
                      </span>
                    </div>

                    <div className="mt-2 text-lg font-black text-slate-900">
                      {simResult.predicted_tier || "Unclassified Tier"}
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>High-Impact Probability:</span>
                        <span className="font-bold text-emerald-800">
                          {Math.round((simResult.predicted_probability ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-emerald-200/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                          style={{ width: `${Math.round((simResult.predicted_probability ?? 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SHAP Feature Attributions Bar Chart */}
                  <div className="mt-5">
                    <div className="text-xs font-bold text-slate-900 mb-3 flex items-center justify-between">
                      <span>Feature Attributions (SHAP Contribution):</span>
                      <span className="text-[10px] text-slate-400 font-normal">Sum = 100%</span>
                    </div>

                    <div className="space-y-2.5">
                      {(simResult.attributions || []).map((attr, aIdx) => (
                        <div key={aIdx} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-700 font-medium">{attr.feature}</span>
                            <span className="font-mono font-bold text-slate-900">+{attr.impactPct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-800"
                              style={{ width: `${Math.min(100, (attr.impactPct || 0) * 2.5)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GRAPH NEURAL NETWORKS (GNN) & pyBibX VISION */}
      {activeSubTab === "gnn" && (
        <div className="space-y-6">
          {/* GNN Header & Hyperparameter Toolbar */}
          <div className="rounded-3xl border border-indigo-200/90 bg-linear-to-br from-indigo-50/50 via-white to-purple-50/30 p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-indigo-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    pyBibX Scientometric Vision
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-700">
                    Deep Non-Linear Relational Learning
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 mt-1">
                  Graph Neural Networks (GNN) & Deep Representation Lab
                </h2>
                <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
                  As envisioned by pyBibX, bibliometric data is inherently graph-structured. GNN architectures execute recursive message-passing across multi-hop citation and co-authorship topologies, computing continuous 64D dense embeddings to uncover latent cross-disciplinary bridges, missing links, and deep epistemic influences that shallow heuristics (Louvain, PageRank, VOSviewer) cannot detect.
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleTrainGNN}
                disabled={gnnRunning}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${gnnRunning ? "animate-spin" : ""}`} />
                <span>{gnnRunning ? "Forward Pass Training..." : "Train GNN & Predict Links"}</span>
              </button>
            </div>

            {/* Hyperparameter Settings */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  GNN Architecture
                </label>
                <select
                  value={gnnArch}
                  onChange={(e) => setGnnArch(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="gat">GAT (Graph Attention Network - Veličković)</option>
                  <option value="gcn">GCN (Graph Convolutional - Kipf & Welling)</option>
                  <option value="graphsage">GraphSAGE (Inductive Aggregator - Hamilton)</option>
                  <option value="hgt">HGT (Heterogeneous Graph Transformer - Hu)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">Epochs (Training Cycles)</label>
                  <span className="font-mono text-xs font-black text-indigo-600">{gnnEpochs}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="10"
                  value={gnnEpochs}
                  onChange={(e) => setGnnEpochs(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Latent Embedding Dim (d)
                </label>
                <select
                  value={gnnHiddenDim}
                  onChange={(e) => setGnnHiddenDim(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value={32}>32 Dimensions (Fast)</option>
                  <option value={64}>64 Dimensions (Optimal)</option>
                  <option value={128}>128 Dimensions (High-Capacity)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Message-Passing Aggregator
                </label>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-700">
                  {gnnArch === "gat" && "Multi-Head Self-Attention (h=4)"}
                  {gnnArch === "gcn" && "Normalized Adjacency (D^-1/2 A D^-1/2)"}
                  {gnnArch === "graphsage" && "Mean Pooling with Skip-Connection"}
                  {gnnArch === "hgt" && "Type-Specific Mutual Attention"}
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {gnnError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold">GNN Execution Issue:</span>
                <span>{gnnError}</span>
              </div>
              <button
                type="button"
                onClick={handleTrainGNN}
                className="rounded-lg bg-rose-700 px-3 py-1 text-white font-semibold hover:bg-rose-800 transition cursor-pointer"
              >
                Retry GNN
              </button>
            </div>
          )}

          {/* Model Evaluation & Training Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Link Prediction ROC-AUC
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-emerald-600">
                {gnnData?.trainingMetrics?.rocAuc != null ? `${(gnnData.trainingMetrics.rocAuc * 100).toFixed(1)}%` : "—"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">True positive vs false alarm</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mean Reciprocal Rank (MRR)
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-indigo-600">
                {gnnData?.trainingMetrics?.meanReciprocalRank != null ? gnnData.trainingMetrics.meanReciprocalRank.toFixed(3) : "—"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Precision of top citations</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cross-Entropy Loss
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-slate-900">
                {gnnData?.trainingMetrics?.finalLoss != null ? gnnData.trainingMetrics.finalLoss.toFixed(4) : "—"}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5 font-bold">
                {gnnData?.trainingMetrics?.convergenceEpoch != null ? `Converged @ epoch ${gnnData.trainingMetrics.convergenceEpoch}` : "Baseline"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Latent Representations
              </div>
              <div className="mt-1 text-2xl font-mono font-black text-purple-700">
                {gnnData?.nodeEmbeddings?.length ?? 0} Nodes
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{gnnHiddenDim}D continuous manifold</div>
            </div>
          </div>

          {/* Sub-view Navigation Pills */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGnnActiveView("links")}
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  gnnActiveView === "links"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                <span>1. Inductive Link Prediction ({gnnData.predictedLinks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setGnnActiveView("manifold")}
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  gnnActiveView === "manifold"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>2. 2D Continuous Neural Manifold (t-SNE)</span>
              </button>

              <button
                type="button"
                onClick={() => setGnnActiveView("attention")}
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  gnnActiveView === "attention"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>3. Graph Attention Weights (α_ij)</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <span>Backprop: AdamW (lr=0.005)</span>
            </div>
          </div>

          {/* VIEW 1: INDUCTIVE LINK PREDICTION */}
          {gnnActiveView === "links" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs text-indigo-900 leading-relaxed flex items-start gap-2.5">
                <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong>How GNN Link Prediction Works in pyBibX:</strong> Traditional bibliometrics only detects connections that have already been explicitly established. Graph Neural Networks model high-order structural and semantic compatibility, predicting which emerging disciplines or author teams are on the verge of cross-disciplinary convergence before direct co-citations appear.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gnnData.predictedLinks.map((link: any) => (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-black uppercase">
                          {link.epistemicNovelty}
                        </span>
                        <span className="font-mono text-xs font-black text-emerald-600">
                          P = {(link.predictedProbability * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs font-black text-slate-900">
                        <span className="truncate">{link.source}</span>
                        <Share2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{link.target}</span>
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500 font-mono">
                        Topological Graph Distance: {link.topologicalDistance} hops
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                        {link.mechanism}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Latent Bridging Dimensions:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {link.sharedLatentDim.map((dim: string) => (
                          <span
                            key={dim}
                            className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-semibold"
                          >
                            {dim}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 2: 2D CONTINUOUS NEURAL MANIFOLD (t-SNE) */}
          {gnnActiveView === "manifold" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Latent Manifold: GNN Embeddings vs Louvain Communities
                    </h3>
                    <p className="text-xs text-slate-500">
                      High-dimensional {gnnHiddenDim}D node embeddings projected to 2D via t-SNE. Traditional Louvain modularity often splits continuous latent clusters.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Perplexity=30 • Iterations=1000
                  </span>
                </div>

                {/* SVG Scatter Canvas */}
                <div className="h-88 w-full rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden flex items-center justify-center p-4">
                  <svg className="h-full w-full" viewBox="-50 -40 100 80">
                    {/* Grid lines */}
                    <line x1="-50" y1="0" x2="50" y2="0" stroke="#e2e8f0" strokeDasharray="2,2" strokeWidth="0.5" />
                    <line x1="0" y1="-40" x2="0" y2="40" stroke="#e2e8f0" strokeDasharray="2,2" strokeWidth="0.5" />

                    {/* Nodes */}
                    {gnnData.nodeEmbeddings.map((node: any) => {
                      const isSelected = selectedGnnNode === node.id;
                      const colors = ["#4f46e5", "#059669", "#d97706", "#dc2626"];
                      const fill = colors[(node.communityGNN - 1) % colors.length];
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
                            stroke={isSelected ? "#0f172a" : "#ffffff"}
                            strokeWidth={isSelected ? 1 : 0.4}
                            opacity={0.9}
                          />
                          <text
                            x={node.x + 3}
                            y={node.y + 1}
                            fontSize={2.6}
                            fontWeight={isSelected ? "bold" : "normal"}
                            fill="#1e293b"
                          >
                            {node.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-400">GNN Neural Clusters:</span>
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Deep Learning Theory
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Bio-Molecular AI
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Clinical Governance
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Click a node to inspect</span>
                </div>
              </div>

              {/* Node Inspector Panel */}
              <div className="lg:col-span-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Manifold Node Inspector
                </div>
                {selectedGnnNode ? (
                  (() => {
                    const node = gnnData.nodeEmbeddings.find((n: any) => n.id === selectedGnnNode);
                    if (!node) return null;
                    return (
                      <div className="space-y-3">
                        <h4 className="text-base font-black text-slate-900">{node.name}</h4>

                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">GNN Cluster</div>
                            <div className="text-base font-black text-indigo-600">#{node.communityGNN}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Louvain Cluster</div>
                            <div className="text-base font-black text-slate-700">#{node.communityLouvain}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Citations</div>
                            <div className="text-base font-black text-slate-900">{node.citations}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Disruption Index</div>
                            <div className="text-base font-mono font-bold text-emerald-600">{node.disruptionScore}</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                          {node.communityGNN !== node.communityLouvain ? (
                            <span className="text-amber-800 font-medium">
                              <strong>Discrepancy Detected:</strong> Traditional Louvain assigned this node to cluster #{node.communityLouvain} based solely on explicit link count, whereas the GNN embedding places it in cluster #{node.communityGNN} due to deep semantic attribute alignment.
                            </span>
                          ) : (
                            <span className="text-emerald-800 font-medium">
                              Strong consensus: Both topological modularity and deep neural embedding agree on this topic's community assignment.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                    Click any point in the scatter manifold to inspect its neural representation metrics and community consensus.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: GRAPH ATTENTION WEIGHTS (alpha_ij) */}
          {gnnActiveView === "attention" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Graph Attention Weights (α_ij) vs Nominal Citation Counts
                  </h3>
                  <p className="text-xs text-slate-500">
                    GAT dynamically learns directed attention weights between citing and cited concepts, exposing true epistemic influence rather than superficial citations.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-[11px] font-bold">
                  Self-Attention Softmax Normalization
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Citing Paper / Entity</th>
                      <th className="py-3 px-4">Referenced Entity</th>
                      <th className="py-3 px-4">Attention Weight (α_ij)</th>
                      <th className="py-3 px-4">Nominal Citation Count</th>
                      <th className="py-3 px-4">Epistemic Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gnnData.attentionPairs.map((pair: any, idx: number) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{pair.source}</td>
                        <td className="py-3 px-4 text-slate-700">{pair.target}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-indigo-700 text-xs">
                              {pair.alpha.toFixed(3)}
                            </span>
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-600"
                                style={{ width: `${pair.alpha * 200}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pair.citationCount}</td>
                        <td className="py-3 px-4">
                          <span className="rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 text-[10px] font-bold">
                            {pair.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scientometric Comparative Matrix: Traditional Bibliometrics vs. GNNs */}
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50/40 p-6 space-y-4">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span>Paradigm Shift: Traditional Bibliometrics vs. Graph Neural Networks (GNNs)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <span>Traditional Bibliometrics (Louvain, PageRank, VOSviewer)</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 leading-relaxed">
                  <li><strong>Discrete adjacency only:</strong> If two nodes have no direct link or shared neighbors, similarity is zero.</li>
                  <li><strong>Disconnected text attributes:</strong> Keyword co-occurrence and network topology are analyzed in separate silos.</li>
                  <li><strong>Transductive limitation:</strong> Cannot generalize to newly published papers without recomputing the entire global matrix.</li>
                  <li><strong>Equal edge assumption:</strong> Every citation is counted identically regardless of actual methodological contribution.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-white p-4 space-y-2">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <span>Graph Neural Networks (GNNs - pyBibX Vision)</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-slate-700 leading-relaxed">
                  <li><strong>Continuous Dense Manifolds:</strong> Learns 64D/128D continuous representations capturing non-linear multi-hop semantics.</li>
                  <li><strong>End-to-End Joint Modeling:</strong> Fuses text embeddings (SciBERT) directly with graph message-passing layers.</li>
                  <li><strong>Inductive Capability:</strong> Embeds new publications in real time without retraining the whole graph (GraphSAGE).</li>
                  <li><strong>Attention-Weighted Influence:</strong> GAT dynamically calculates the true epistemic significance (α_ij) of every reference.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Statistical Text Classifiers & Stratified K-Fold CV [761] */}
      {activeSubTab === "classifiers" && (
        <StatisticalTextClassifierStudio dataset={activeDatasetObj || dataset} />
      )}
    </div>
  );
}
