import React, { useState } from 'react';
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
  Users,
  Compass,
  Tag,
  Calendar,
  TrendingUp,
} from 'lucide-react';

interface AnalysesListViewProps {
  analyses: Analysis[];
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  onSelectAnalysis?: (analysis: Analysis) => void;
  onQuickRun?: (capId: string, dsId?: string) => Promise<void>;
}

// کاتالوگ جامع تمام شاخص‌ها، مدل‌ها و قوانین علم‌سنجی
const SCIENTOMETRIC_MODELS = [
  // ۱. شاخص‌های خانواده هرش و ارزیابی استنادی
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

  // ۲. قوانین کلاسیک و بنیادین علم‌سنجی
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
    name: "Author Productivity & Price's Elite Group",
    desc: "Publication rankings, multi-authored papers distribution, and Price's Law root-square elite contributors.",
    icon: Users,
    category: 'Scientometric Laws',
    tag: 'Price Law',
  },

  // ۳. نقشه‌های دانش، مضامین و شبکه‌های هم‌نویسندگی
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
];

export const AnalysesListView: React.FC<AnalysesListViewProps> = ({
  analyses,
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onSelectAnalysis,
  onQuickRun,
}) => {
  const [activeRunningCap, setActiveRunningCap] = useState<string | null>(null);
  const [focusedAnalysis, setFocusedAnalysis] = useState<Analysis | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  const categories = ['All', 'Hirsch Family & Citations', 'Scientometric Laws', 'Knowledge Structures', 'Historical Foundations'];

  const filteredModels = selectedCategory === 'All'
    ? SCIENTOMETRIC_MODELS
    : SCIENTOMETRIC_MODELS.filter((m) => m.category === selectedCategory);

  const handleExecuteModel = async (capId: string) => {
    setActiveRunningCap(capId);
    try {
      if (onQuickRun) {
        await onQuickRun(capId, currentDataset?.id);
      } else if (currentDataset?.id) {
        const vRes = await fetch(`/datasets/${currentDataset.id}/versions`);
        if (!vRes.ok) throw new Error("Failed to load versions for dataset");
        const vList = await vRes.json();
        const validVer = Array.isArray(vList)
          ? vList.find((v) => !v.dataset_id || v.dataset_id === currentDataset.id)
          : null;
        if (!validVer?.id) {
          throw new Error("No valid snapshot versions available for this dataset");
        }
        const res = await fetch('/api/analyses/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataset_version_id: validVer.id,
            capability_id: capId,
          }),
        });
        const data = await res.json();
        if (data && data.id) {
          setFocusedAnalysis(data);
        }
      }
    } catch (err) {
      console.error('Error executing scientometric model:', err);
    } finally {
      setActiveRunningCap(null);
    }
  };

  const handleExecuteAll = async () => {
    setRunningAll(true);
    for (const model of filteredModels) {
      try {
        if (onQuickRun) {
          await onQuickRun(model.id, currentDataset?.id);
        }
      } catch (err) {
        console.error(`Error running ${model.name}:`, err);
      }
    }
    setRunningAll(false);
  };

  const findExistingAnalysis = (capId: string) => {
    return analyses.find(
      (a) => a.capability_id === capId || a.analysis_type === capId
    );
  };

  return (
    <div className="space-y-8">
      {/* هدر هاب */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span>Scientometric Analyses Hub</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Direct Cockpit
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Execute foundational scientometric laws, distributions, Hirsch metrics, and networks directly on your corpus.
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
              value={selectedDatasetId || ''}
              onChange={(e) => onSelectDataset?.(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-slate-400 focus:outline-hidden"
            >
              <option value="">All Datasets (Consolidated)</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count || 0} docs)
                </option>
              ))}
            </select>
          </div>

          {/* دکمه اجرای همزمان همه مدل‌ها با یک کلیک */}
          <button
            type="button"
            onClick={handleExecuteAll}
            disabled={runningAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 fill-current ${runningAll ? 'animate-spin' : ''}`} />
            <span>{runningAll ? 'Executing Models...' : 'Execute All Models (1-Click)'}</span>
          </button>
        </div>
      </div>

      {/* تب‌های فیلتر دسته‌بندی موضوعی */}
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

      {/* گرید کارت‌های تحلیل‌های علم‌سنجی */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
            Foundational Scientometric Models & Indicators ({filteredModels.length})
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Category: {selectedCategory}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredModels.map((model) => {
            const Icon = model.icon;
            const existing = findExistingAnalysis(model.id);
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
                  {existing ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Ready</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Not Computed</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {existing && (
                      <button
                        type="button"
                        onClick={() => {
                          setFocusedAnalysis(existing);
                          onSelectAnalysis?.(existing);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                      >
                        View Results
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExecuteModel(model.id)}
                      disabled={isCurrentlyRunning}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Play className={`h-3 w-3 fill-current ${isCurrentlyRunning ? 'animate-spin' : ''}`} />
                      <span>{isCurrentlyRunning ? 'Running...' : existing ? 'Re-run' : 'Compute'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* نمایش نتایج در همان صفحه (زیر کارت‌ها) بدون پریدن به صفحه دیگر */}
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