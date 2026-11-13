import React, { useEffect, useState } from 'react';
import { Analysis, Dataset } from '../types';
import { AnalysisResultPanel } from './AnalysisResultPanel';
import {
  Play,
  Database,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Layers,
  BookOpen,
  FileText,
  Users,
  Compass,
  Tag,
  Calendar,
  TrendingUp,
} from 'lucide-react';

interface AnalysesListViewProps {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  onQuickRun: (capId: string, dsId: string) => Promise<Analysis | null>;
  scope?: "corpus" | "entity";
}

// Scientometric models available in the corpus and entity studios.
export const SCIENTOMETRIC_MODELS = [
  // Hirsch-family indices and citation metrics
  {
    id: 'citation.advanced_hirsch',
    name: 'Advanced Hirsch Family Metrics (h, g, m, e)',
    desc: 'Comprehensive Hirsch evaluation: h-index, Egghe g-index, Hirsch m-quotient, and Zhang e-index across scholars.',
    icon: TrendingUp,
    category: 'Hirsch Family & Citations',
    tag: 'Hirsch Family',
  },
  {
    id: 'citation.author_h_index',
    name: 'Author Core H-Index Matrix',
    desc: 'Individual researcher Hirsch ranking, citation thresholds, and productivity-impact balance.',
    icon: Users,
    category: 'Hirsch Family & Citations',
    tag: 'H-Index Core',
  },
  {
    id: 'citation.distribution',
    name: 'Citation Frequency Distribution & Skewness',
    desc: 'Highly cited paper brackets (≥100, ≥50, ≥10), uncited ratios, and citation curve skewness.',
    icon: BarChart3,
    category: 'Hirsch Family & Citations',
    tag: 'Citation Skew',
  },
  {
    id: 'citation.total',
    name: 'Total Corpus Citation Velocity (Raw Citations)',
    desc: 'Cumulative observed citation sum, peak paper impact, and direct citation totals (raw/observed).',
    icon: TrendingUp,
    category: 'Hirsch Family & Citations',
    tag: 'Raw Citations',
  },
  {
    id: 'citation.average',
    name: 'Citations per Paper (Raw CPP)',
    desc: 'Arithmetic mean citations per document (CPP) across analyzed corpus (calculated).',
    icon: BarChart3,
    category: 'Hirsch Family & Citations',
    tag: 'Raw CPP',
  },
  {
    id: 'citation.window_adjusted',
    name: 'Citation Window & Annual Velocity',
    desc: 'Longitudinal exposure-adjusted velocity (citations per year of opportunity) accounting for publication dates.',
    icon: TrendingUp,
    category: 'Hirsch Family & Citations',
    tag: 'Window Adjusted',
  },
  {
    id: 'citation.field_normalized',
    name: 'Disciplinary Field-Normalized Impact (MNCS)',
    desc: 'Audited reference population status and baseline requirements for expected citation normalization.',
    icon: Compass,
    category: 'Hirsch Family & Citations',
    tag: 'Audited Status',
  },
  {
    id: 'reference.rpys',
    name: 'RPYS Historical Spectroscopy (metaknowledge)',
    desc: 'Reference Publication Year Spectroscopy detecting seminal historical breakthroughs and citation peaks.',
    icon: Calendar,
    category: 'Historical Foundations',
    tag: 'RPYS Peaks',
  },

  // Foundational scientometric laws
  {
    id: 'author.lotka_law',
    name: "Lotka's Law of Scientific Productivity",
    desc: 'Inverse-square productivity law testing with Kolmogorov-Smirnov (K-S) goodness-of-fit.',
    icon: Users,
    category: 'Scientometric Laws',
    tag: 'Lotka Law',
  },
  {
    id: 'source.bradford_law',
    name: "Bradford's Law of Scattering (Core Zones)",
    desc: 'Tri-zonal core nucleus formulation (1 : k : k²) identifying primary journals vs peripheral scattering.',
    icon: BookOpen,
    category: 'Scientometric Laws',
    tag: 'Bradford Law',
  },
  {
    id: 'author.productivity',
    name: "Price's Elite Group Identification",
    desc: "Identifies the root-square (√N) core elite researchers responsible for half of total scholarly output under Price's Law.",
    icon: Users,
    category: 'Scientometric Laws',
    tag: 'Price Law',
  },

  // Knowledge maps, themes, and collaboration networks
  {
    id: 'keyword.thematic_map',
    name: "Callon's Strategic Thematic Map",
    desc: 'Strategic diagram plotting Callon Centrality vs Callon Density into Motor, Niche, Emerging, and Basic themes.',
    icon: Compass,
    category: 'Knowledge Structures',
    tag: 'Callon Map',
  },
  {
    id: 'author.co_authorship',
    name: 'Co-Authorship Collaboration Network',
    desc: 'Topological collaboration network graph with node degrees, shared publications, and collaboration links.',
    icon: Layers,
    category: 'Knowledge Structures',
    tag: 'Collaboration Net',
  },
  {
    id: 'group.analysis',
    name: 'Geographic & Institutional Affiliations (C1)',
    desc: 'Institutional clusters and country scientific output based on WoS/Scopus C1 affiliation tags.',
    icon: BarChart3,
    category: 'Knowledge Structures',
    tag: 'C1 Affiliations',
  },
  {
    id: 'keyword.frequency',
    name: 'Keyword Co-Occurrence & Vocabulary Growth',
    desc: 'Author keywords and indexed descriptors frequency distribution and terminological co-occurrence.',
    icon: Tag,
    category: 'Knowledge Structures',
    tag: 'Vocabulary',
  },
  {
    id: 'publication.year_distribution',
    name: 'Annual Publication Growth & Momentum',
    desc: 'Chronological publication momentum, peak volume years, compound annual growth rate (CAGR).',
    icon: Calendar,
    category: 'Longitudinal Growth',
    tag: 'Growth Velocity',
  },
  {
    id: 'document.count',
    name: 'Corpus Profile & Document Count',
    desc: 'Total records, coverage timespan, and annual corpus statistics for the selected dataset.',
    icon: Database,
    category: 'Longitudinal Growth',
    tag: 'Corpus Profile',
  },
  {
    id: 'funding.agency_distribution',
    name: 'Funding Agency Distribution',
    desc: 'Research sponsors and funding agency distribution from available funding metadata.',
    icon: Layers,
    category: 'Knowledge Structures',
    tag: 'Funding',
  },
  {
    id: 'funding.grant_analytics',
    name: 'Grant Coverage & Impact Analytics',
    desc: 'Grant identifiers, funded-paper coverage, and citation impact of funded research.',
    icon: TrendingUp,
    category: 'Knowledge Structures',
    tag: 'Grant Analytics',
  },
  {
    id: 'keyword.thematic_evolution',
    name: 'Longitudinal Thematic Evolution',
    desc: 'Track keyword themes across time slices with trajectories, inclusion indices, and flows.',
    icon: TrendingUp,
    category: 'Longitudinal Growth',
    tag: 'Theme Evolution',
  },
  {
    id: 'ml.kmeans_clusters',
    name: 'K-Means Document Clusters',
    desc: 'TF-IDF document clustering with exploratory groups and PCA coordinates.',
    icon: Layers,
    category: 'Machine Learning',
    tag: 'Machine Learning',
  },
  {
    id: 'ml.lda_topics',
    name: 'LDA Topic Modeling',
    desc: 'Discover latent topics, representative terms, and document-topic assignments.',
    icon: Compass,
    category: 'Machine Learning',
    tag: 'Machine Learning',
  },
  {
    id: 'ml.citation_prediction',
    name: 'Citation Impact Prediction',
    desc: 'Estimate citation-impact classes and expose the features contributing to predictions.',
    icon: TrendingUp,
    category: 'Machine Learning',
    tag: 'Machine Learning',
  },
  {
    id: 'ml.text_classification',
    name: 'Statistical Text Classification',
    desc: 'Classify document text into viable target groups with cross-validation diagnostics.',
    icon: FileText,
    category: 'Machine Learning',
    tag: 'Machine Learning',
  },
  {
    id: 'source.productivity',
    name: 'Source Productivity & Bradford Core',
    desc: 'Rank journals and venues by output and citation impact for entity-level source analysis.',
    icon: BookOpen,
    category: 'Scientometric Laws',
    tag: 'Sources',
  },
  {
    id: 'institution.productivity',
    name: 'Institution Productivity',
    desc: 'Rank institutional affiliations by publication output and research impact.',
    icon: Users,
    category: 'Knowledge Structures',
    tag: 'Institutions',
  },
  {
    id: 'group.comparative_significance',
    name: 'Comparative Group Significance',
    desc: 'Compare defined geographic or institutional groups with statistical significance testing.',
    icon: BarChart3,
    category: 'Knowledge Structures',
    tag: 'Group Comparison',
  },
];

export const ENTITY_ANALYSIS_IDS = new Set([
  'citation.advanced_hirsch', 'citation.author_h_index', 'author.productivity',
  'source.productivity', 'institution.productivity', 'keyword.frequency',
  'group.analysis', 'group.comparative_significance',
]);

export const AnalysesListView: React.FC<AnalysesListViewProps> = ({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onQuickRun,
  scope = "corpus",
}) => {
  const [activeRunningCap, setActiveRunningCap] = useState<string | null>(null);
  const [focusedAnalysis, setFocusedAnalysis] = useState<Analysis | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  useEffect(() => {
    setFocusedAnalysis(null);
  }, [currentDataset?.id]);

  const categories = ['All', ...new Set(SCIENTOMETRIC_MODELS
    .filter((model) => scope === "entity" ? ENTITY_ANALYSIS_IDS.has(model.id) : !ENTITY_ANALYSIS_IDS.has(model.id))
    .map((model) => model.category))];

  const filteredModels = SCIENTOMETRIC_MODELS.filter((model) =>
    (selectedCategory === 'All' || model.category === selectedCategory) &&
    (scope === "entity" ? ENTITY_ANALYSIS_IDS.has(model.id) : !ENTITY_ANALYSIS_IDS.has(model.id))
  );

  const handleExecuteModel = async (capId: string) => {
    if (!currentDataset?.id || runningAll || activeRunningCap) return;
    setActiveRunningCap(capId);
    try {
      const result = await onQuickRun(capId, currentDataset.id);
      if (result) setFocusedAnalysis(result);
    } catch (err) {
      console.error('Error executing scientometric model:', err);
    } finally {
      setActiveRunningCap(null);
    }
  };

  const handleExecuteAll = async () => {
    if (!currentDataset?.id || runningAll || activeRunningCap) return;
    setRunningAll(true);
    try {
      for (const model of filteredModels) {
        const result = await onQuickRun(model.id, currentDataset.id);
        if (result) setFocusedAnalysis(result);
      }
    } catch (err) {
      console.error('Error running scientometric models:', err);
    } finally {
      setRunningAll(false);
    }
  };

  const scopeLabel = scope === "entity" ? "Entity-level analyses" : "Corpus-level analyses";

  return (
    <div className="space-y-8">
      {/* Analysis section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span>{scope === "entity" ? "Entity Analysis" : "Corpus Analysis"}</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              {scopeLabel}
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Run an analysis for the selected dataset version. Results are shown for this execution only.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="datasetFilter" className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Database className="h-3.5 w-3.5" />
              Target Dataset:
            </label>
            <select
              id="datasetFilter"
              value={currentDataset?.id || ''}
              onChange={(e) => onSelectDataset?.(e.target.value)}
              disabled={!datasets.length || runningAll || !!activeRunningCap}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-slate-400 focus:outline-hidden"
            >
              {!datasets.length && <option value="">Select a dataset</option>}
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count || 0} docs)
                </option>
              ))}
            </select>
          </div>

          {/* Run all currently visible methods */}
          <button
            type="button"
            onClick={handleExecuteAll}
            disabled={runningAll || !!activeRunningCap || !currentDataset?.id || filteredModels.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 fill-current ${runningAll ? 'animate-spin' : ''}`} />
            <span>{runningAll ? 'Running Analyses...' : 'Run All Visible'}</span>
          </button>
        </div>
      </div>

      {/* Analysis categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Analysis method cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
            Available Analysis Methods ({filteredModels.length})
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Category: {selectedCategory}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredModels.map((model) => {
            const Icon = model.icon;
            const isCurrentlyRunning = activeRunningCap === model.id;

            return (
              <div
                key={model.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition-shadow hover:border-slate-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {model.category}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {model.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {model.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {model.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Play className="h-3.5 w-3.5" />
                    <span>Not run yet</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExecuteModel(model.id)}
                    disabled={runningAll || !!activeRunningCap || !currentDataset?.id}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Play className={`h-3 w-3 fill-current ${isCurrentlyRunning ? 'animate-spin' : ''}`} />
                    <span>{isCurrentlyRunning ? 'Running...' : 'Run analysis'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show the current execution result inline */}
      {focusedAnalysis && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Detailed Scientometric Results: {focusedAnalysis.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setFocusedAnalysis(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 bg-white cursor-pointer"
            >
              Close Results
            </button>
          </div>

          <AnalysisResultPanel
            analysis={focusedAnalysis}
            onRefresh={() => handleExecuteModel(focusedAnalysis.capability_id || focusedAnalysis.analysis_type)}
          />
        </div>
      )}
    </div>
  );
};