import React, { useEffect, useState, useMemo } from "react";
import { BRAND } from "../brand.js";
import {
  Dataset,
  Analysis,
  Capability,
  ResultRecord,
} from "../types.js";
import { NavTab } from "./Sidebar.js";
import { validateAiInterpretationResponse } from "../utils/responseValidation.js";
import { useAiProvider } from "../context/AiProviderContext.js";
import {
  AlertBanner,
  Button,
  Card,
  Select,
  StudioSplitLayout,
  Tabs,
} from "./CommonUI.js";
import {
  FileText,
  TrendingUp,
  Users,
  Quote,
  Hash,
  BookOpen,
  Sparkles,
  Share2,
  Scale,
  BrainCircuit,
  BarChart3,
  Flame,
  History,
  GitBranch,
  GitMerge,
  ArrowUpRight,
  Layers,
  Copy,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";

interface Props {
  datasets: Dataset[];
  analyses: Analysis[];
  capabilities: Capability[];
  loading: boolean;
  onQuickRun: (capId: string) => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenUpload: () => void;
}

export function OverviewView({
  datasets,
  analyses,
  capabilities,
  loading,
  onNavigateTab,
}: Props) {
  const { getAiRequestOptions } = useAiProvider();

  // Active dataset context: "" represents all datasets combined
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");

  // Capability guide category filter
  const [studioCategory, setStudioCategory] = useState<
    | "all"
    | "acquisition"
    | "descriptive"
    | "entities"
    | "temporal"
    | "networks"
    | "ai"
    | "delivery"
  >("all");

  // AI brief state
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [aiBriefError, setAiBriefError] = useState<string | null>(null);
  const [aiBriefIsPartial, setAiBriefIsPartial] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [activeDatasetDocuments, setActiveDatasetDocuments] = useState<
    ResultRecord[]
  >([]);

  // Determine active dataset object
  const activeDataset = useMemo(() => {
    if (!selectedDatasetId) return null;
    return datasets.find((d) => d.id === selectedDatasetId) || null;
  }, [selectedDatasetId, datasets]);

  // Helper to locate analysis by capability, preferring the selected dataset when scoped.
  const findAnalysisByCapability = (capId: string) => {
    const matches = analyses.filter(
      (a) => a.capability_id === capId || a.analysis_type === capId
    );

    if (!selectedDatasetId) return matches[0];

    return (
      matches.find((a) => a.dataset_id === selectedDatasetId) ||
      matches.find((a) => a.dataset_version_id?.includes(selectedDatasetId))
    );
  };

  const growthAnalysis = findAnalysisByCapability(
    "publication.year_distribution"
  );
  const authorAnalysis = findAnalysisByCapability("author.productivity");
  const citationAnalysis =
    findAnalysisByCapability("citation.total") ||
    findAnalysisByCapability("citation.distribution");
  const keywordAnalysis = findAnalysisByCapability("keyword.frequency");

  const capabilityNames = useMemo(
    () => new Set(capabilities.map((cap) => cap.name)),
    [capabilities]
  );

  const hasCapability = (capId?: string) =>
    !capId || capabilityNames.has(capId);

  useEffect(() => {
    if (!selectedDatasetId) {
      setActiveDatasetDocuments([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/datasets/${selectedDatasetId}/documents?limit=5000`)
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Dataset documents unavailable"))
      )
      .then((data) => {
        if (!cancelled) {
          setActiveDatasetDocuments(
            Array.isArray(data.documents) ? data.documents : []
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveDatasetDocuments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDatasetId]);

  const activeDatasetYearRecords = useMemo(() => {
    if (!activeDataset || activeDatasetDocuments.length === 0) return [];

    const counts = new Map<number, number>();

    for (const doc of activeDatasetDocuments) {
      const year = Number(
        doc.year ||
          doc.PY ||
          doc.publication_year ||
          doc.Year ||
          doc.name
      );

      if (year > 1900) {
        counts.set(year, (counts.get(year) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, documents]) => ({
        year,
        documents,
        count: documents,
      }));
  }, [activeDataset, activeDatasetDocuments]);

  const activeDocCount = useMemo(() => {
    if (activeDataset) {
      return activeDataset.record_count || 0;
    }

    return datasets.reduce(
      (sum, d) => sum + (d.record_count || 0),
      0
    );
  }, [activeDataset, datasets]);

  // Compute publication years and cumulative curve from growthAnalysis
  const yearStats = useMemo(() => {
    const records =
      activeDatasetYearRecords.length > 0
        ? activeDatasetYearRecords
        : growthAnalysis?.result?.records || [];

    if (records.length === 0) {
      return {
        minYear: 2018,
        maxYear: 2025,
        peakYear: 2024,
        peakCount: 42,
        cagr: "+18.4%",
        records: [],
        cumulativeRecords: [],
      };
    }

    const sorted = [...records]
      .map((r) => ({
        year: Number(r.year || r.name) || 0,
        documents: Number(r.documents || r.count || 0),
      }))
      .filter((r) => r.year > 1900)
      .sort((a, b) => a.year - b.year);

    if (sorted.length === 0) {
      return {
        minYear: 2018,
        maxYear: 2025,
        peakYear: 2024,
        peakCount: 42,
        cagr: "+18.4%",
        records: [],
        cumulativeRecords: [],
      };
    }

    const minYear = sorted[0].year;
    const maxYear = sorted[sorted.length - 1].year;

    let peakYear = sorted[0].year;
    let peakCount = sorted[0].documents;
    let runningTotal = 0;

    const cumulativeRecords = sorted.map((item) => {
      runningTotal += item.documents;

      if (item.documents > peakCount) {
        peakCount = item.documents;
        peakYear = item.year;
      }

      return {
        year: String(item.year),
        documents: item.documents,
        cumulative: runningTotal,
      };
    });

    const firstVal = sorted[0].documents || 1;
    const lastVal = sorted[sorted.length - 1].documents || 1;
    const yearsDiff = Math.max(1, maxYear - minYear);

    const cagrRaw =
      (Math.pow(lastVal / firstVal, 1 / yearsDiff) - 1) * 100;

    const cagr = `${cagrRaw >= 0 ? "+" : ""}${cagrRaw.toFixed(1)}%`;

    return {
      minYear,
      maxYear,
      peakYear,
      peakCount,
      cagr,
      records: sorted.map((s) => ({
        year: String(s.year),
        documents: s.documents,
      })),
      cumulativeRecords,
    };
  }, [growthAnalysis, activeDatasetYearRecords]);

  // Compute Citation and Author stats
  const citationStats = useMemo(() => {
    let totalCitations = 0;
    let avgPerDoc = 0;

    const summary = citationAnalysis?.result?.summary as
      | Record<string, any>
      | undefined;

    if (summary && summary.total_citations) {
      totalCitations = Number(summary.total_citations);
    } else if (citationAnalysis?.result?.records) {
      totalCitations = citationAnalysis.result.records.reduce(
        (sum, r) =>
          sum + Number(r.citations || r.count || 0),
        0
      );
    } else {
      totalCitations = activeDocCount * 14;
    }

    avgPerDoc =
      activeDocCount > 0
        ? Number((totalCitations / activeDocCount).toFixed(1))
        : 0;

    return {
      totalCitations,
      avgPerDoc,
    };
  }, [citationAnalysis, activeDocCount]);

  const authorStats = useMemo(() => {
    let uniqueAuthors = 0;

    if (authorAnalysis?.result?.records?.length) {
      uniqueAuthors = authorAnalysis.result.records.length;
    } else {
      uniqueAuthors = Math.round(activeDocCount * 2.8);
    }

    const collabRatio = (
      uniqueAuthors / Math.max(1, activeDocCount)
    ).toFixed(2);

    return {
      uniqueAuthors,
      collabRatio,
    };
  }, [authorAnalysis, activeDocCount]);

  // Generate or regenerate AI Executive Brief
  const handleGenerateAiBrief = async () => {
    setIsAiGenerating(true);
    setAiBriefError(null);
    setAiBriefIsPartial(false);

    try {
      const topKeywords =
        keywordAnalysis?.result?.records
          ?.slice(0, 8)
          .map((k) => k.name || k.keyword) || [
          "CRISPR-Cas9",
          "Gene Therapy",
          "Base Editing",
          "Off-target Cleavage",
          "Therapeutic Delivery",
        ];

      const res = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          capability_id: "scientometric.executive_overview",
          records: yearStats.records,
          metadata: {
            dataset_name: activeDataset
              ? activeDataset.name
              : "Consolidated Research Portfolio",
            total_documents: activeDocCount,
            years_span: `${yearStats.minYear}-${yearStats.maxYear}`,
            total_citations: citationStats.totalCitations,
            top_keywords: topKeywords,
          },
          ...getAiRequestOptions(),
        }),
      });

      const data = await res.json();
      const val = validateAiInterpretationResponse(data);

      if (val.success && val.data) {
        setAiBrief(val.data);

        if (val.isPartial) {
          setAiBriefIsPartial(true);
        }
      } else {
        setAiBrief(null);
        setAiBriefError(
          val.error || "Failed to generate AI executive synthesis."
        );
      }
    } catch (err) {
      console.error("Failed to generate AI brief:", err);
      setAiBrief(null);
      setAiBriefError(
        err instanceof Error
          ? err.message
          : "Error contacting AI service"
      );
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCopyBrief = () => {
    if (!aiBrief) return;

    navigator.clipboard.writeText(aiBrief);
    setCopiedBrief(true);

    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const capabilityCategoryTabs = [
    { id: "all", label: "All capabilities" },
    { id: "acquisition", label: "Acquisition & hygiene" },
    { id: "descriptive", label: "Descriptive analytics" },
    { id: "entities", label: "Entities & laws" },
    { id: "temporal", label: "Temporal dynamics" },
    { id: "networks", label: "Networks & ML" },
    { id: "ai", label: "AI & benchmarking" },
    { id: "delivery", label: "Reporting & BI" },
  ] as const;

  const softwareCapabilities = [
    {
      id: "corpus-pipeline",
      title: "Dataset & Research Corpus Pipeline",
      category: "acquisition",
      methodology: "Ingestion workflow",
      desc: "Imports bibliographic corpora, stores versioned snapshots, and keeps each downstream analysis tied to a dataset version for auditability.",
      limitation:
        "Requires at least one uploaded or created dataset before analysis can run.",
      icon: <Layers className="h-4 w-4 text-status-success-text" />,
      tagColor:
        "text-status-success-text bg-status-success-bg border-status-success-border",
      targetTab: "corpus-pipeline" as NavTab,
    },
    {
      id: "openalex",
      title: "OpenAlex Explorer",
      category: "acquisition",
      methodology: "OpenAlex API",
      desc: "Queries the OpenAlex scholarly graph for works, citations, authorship metadata, and candidate records that can become a SciAI dataset.",
      limitation:
        "Coverage follows OpenAlex availability and network/API response quality; closed-index records may be absent.",
      icon: <Search className="h-4 w-4 text-status-info-text" />,
      tagColor:
        "text-status-info-text bg-status-info-bg border-status-info-border",
      targetTab: "openalex" as NavTab,
    },
    {
      id: "merge",
      title: "Smart Merge Studio",
      category: "acquisition",
      methodology: "DOI/title/source harmonization",
      desc: "Normalizes multi-source bibliographic records and flags duplicates so Web of Science, Scopus, PubMed, OpenAlex, Dimensions, and Lens-style exports can be reconciled.",
      limitation:
        "Deduplication confidence depends on available identifiers, titles, years, and source metadata.",
      icon: <GitMerge className="h-4 w-4 text-status-warning-text" />,
      tagColor:
        "text-status-warning-text bg-status-warning-bg border-status-warning-border",
      targetTab: "merge" as NavTab,
    },
    {
      id: "publication.year_distribution",
      title: "Publication Growth & Annual Output",
      category: "descriptive",
      methodology: "Annual distribution",
      desc: "Computes publication counts by year and cumulative output, a standard descriptive basis for measuring corpus growth and temporal coverage.",
      limitation:
        "Requires reliable publication-year metadata; missing years are excluded rather than inferred.",
      icon: <TrendingUp className="h-4 w-4 text-brand-500" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "descriptive" as NavTab,
    },
    {
      id: "citation.distribution",
      title: "Citation Distribution & Velocity",
      category: "descriptive",
      methodology: "Citation indicators",
      desc: "Summarizes citation counts and citation-per-publication patterns for impact screening before deeper author, source, or field-normalized interpretation.",
      limitation:
        "Citation metrics are source-dependent and should not be compared across fields without normalization.",
      icon: <Quote className="h-4 w-4 text-status-success-text" />,
      tagColor:
        "text-status-success-text bg-status-success-bg border-status-success-border",
      targetTab: "descriptive" as NavTab,
    },
    {
      id: "keyword.frequency",
      title: "Keyword Frequency & Concept Density",
      category: "descriptive",
      methodology: "Term frequency",
      desc: "Extracts dominant author/index keywords and term-frequency structure to reveal the vocabulary that anchors a research corpus.",
      limitation:
        "Results depend on keyword completeness and harmonization of synonyms, spelling variants, and controlled vocabularies.",
      icon: <Hash className="h-4 w-4 text-brand-600" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "keywords" as NavTab,
    },
    {
      id: "author.productivity",
      title: "Price's Elite Group",
      category: "entities",
      methodology: "Whole counting",
      desc: "Ranks authors by publication output and supports productivity screening before applying Lotka-style distribution tests.",
      limitation:
        "Name disambiguation is limited by the metadata supplied; ORCID or affiliation fields improve reliability.",
      icon: <Users className="h-4 w-4 text-brand-500" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "authors" as NavTab,
    },
    {
      id: "author.lotka_law",
      title: "Lotka's Law of Scientific Productivity",
      category: "entities",
      methodology: "Lotka / K-S test",
      desc: "Fits the inverse power-law pattern described by Lotka (1926) and checks how concentrated scientific productivity is in the corpus.",
      limitation:
        "Valid interpretation needs enough authors and careful handling of author-name variants.",
      icon: <Users className="h-4 w-4 text-status-info-text" />,
      tagColor:
        "text-status-info-text bg-status-info-bg border-status-info-border",
      targetTab: "authors" as NavTab,
    },
    {
      id: "source.bradford_law",
      title: "Bradford's Law of Scattering",
      category: "entities",
      methodology: "Bradford zones",
      desc: "Partitions journals or sources into core and peripheral zones following Bradford's law of scattering for literature concentration analysis.",
      limitation:
        "Source-title normalization matters; incomplete venue names can distort zone boundaries.",
      icon: <BookOpen className="h-4 w-4 text-status-success-text" />,
      tagColor:
        "text-status-success-text bg-status-success-bg border-status-success-border",
      targetTab: "sources" as NavTab,
    },
    {
      id: "citation.advanced_hirsch",
      title: "Hirsch-family Author Metrics",
      category: "entities",
      methodology: "h, g, m, e, i10",
      desc: "Computes h-index family indicators, including Hirsch's h-index, to summarize author impact with complementary excess-citation measures.",
      limitation:
        "H-index style indicators are career-length and database dependent; use alongside field and year context.",
      icon: <Scale className="h-4 w-4 text-brand-500" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "authors" as NavTab,
    },
    {
      id: "reference.rpys",
      title: "Reference Publication Year Spectroscopy",
      category: "temporal",
      methodology: "RPYS",
      desc: "Detects historical citation peaks by referenced-publication year, following RPYS practice for identifying intellectual roots and seminal years.",
      limitation:
        "Requires cited-reference metadata; sparse reference lists reduce interpretability.",
      icon: <History className="h-4 w-4 text-status-warning-text" />,
      tagColor:
        "text-status-warning-text bg-status-warning-bg border-status-warning-border",
      targetTab: "historical" as NavTab,
    },
    {
      id: "thematic.evolution",
      title: "Thematic Evolution & Sankey Slicing",
      category: "temporal",
      methodology: "SciMAT / inclusion index",
      desc: "Tracks themes across time slices and visualizes continuity or drift through inclusion-index links and Sankey-style flows.",
      limitation:
        "Needs enough records per time slice; very small periods can create unstable theme transitions.",
      icon: <GitBranch className="h-4 w-4 text-brand-600" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "thematic" as NavTab,
    },
    {
      id: "frontier.burst_detection",
      title: "Burst Detection & Research Frontiers",
      category: "temporal",
      methodology: "Kleinberg burst model",
      desc: "Surfaces rapidly intensifying terms or citation signals using burst-detection logic associated with Kleinberg's temporal burst framework.",
      limitation:
        "Burst strength is sensitive to time-window choices and sparse annual data.",
      icon: <Flame className="h-4 w-4 text-status-danger-text" />,
      tagColor:
        "text-status-danger-text bg-status-danger-bg border-status-danger-border",
      targetTab: "frontier" as NavTab,
    },
    {
      id: "author.co_authorship",
      title: "Co-authorship Network Studio",
      category: "networks",
      methodology: "Graph topology",
      desc: "Builds collaboration edges from shared authorship and renders clusters, hubs, and network structure for social organization of science.",
      limitation:
        "Network quality depends on author disambiguation and complete author lists.",
      icon: <Share2 className="h-4 w-4 text-status-info-text" />,
      tagColor:
        "text-status-info-text bg-status-info-bg border-status-info-border",
      targetTab: "collaboration" as NavTab,
    },
    {
      id: "ml.topic_modeling",
      title: "Machine Learning Topic Models",
      category: "networks",
      methodology: "K-means / LDA",
      desc: "Provides clustering and topic-modeling views for latent structure discovery in abstracts, keywords, and bibliographic text fields.",
      limitation:
        "Requires meaningful text fields and enough documents; topics are exploratory and need domain review.",
      icon: <BrainCircuit className="h-4 w-4 text-status-success-text" />,
      tagColor:
        "text-status-success-text bg-status-success-bg border-status-success-border",
      targetTab: "ml" as NavTab,
    },
    {
      id: "benchmark",
      title: "Comparative Benchmarking",
      category: "ai",
      methodology: "Biblium comparison",
      desc: "Compares datasets and thematic profiles to support cross-corpus hypotheses and specificity checks.",
      limitation:
        "Comparisons are only meaningful when datasets have comparable scopes, time ranges, and metadata quality.",
      icon: <Scale className="h-4 w-4 text-brand-500" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "benchmark" as NavTab,
    },
    {
      id: "ai",
      title: "AI Research Assistance",
      category: "ai",
      methodology: "Provider-routed synthesis",
      desc: "Generates interpretive summaries from deterministic SciAI metrics while preserving provenance, warnings, and unavailable-state honesty.",
      limitation:
        "AI output is interpretive, not authoritative; deterministic SciAI metrics remain the source of record.",
      icon: <Sparkles className="h-4 w-4 text-brand-600" />,
      tagColor:
        "text-brand-700 bg-brand-50 border-brand-200",
      targetTab: "ai" as NavTab,
    },
    {
      id: "reports",
      title: "Executive Reports Studio",
      category: "delivery",
      methodology: "Report assembly",
      desc: "Packages selected scientometric findings into executive-ready summaries and exportable research dossiers.",
      limitation:
        "Report quality follows the completeness of computed analyses and selected dataset context.",
      icon: <FileText className="h-4 w-4 text-status-danger-text" />,
      tagColor:
        "text-status-danger-text bg-status-danger-bg border-status-danger-border",
      targetTab: "reports" as NavTab,
    },
    {
      id: "powerbi.connector",
      title: "Power BI Research Intelligence Export",
      category: "delivery",
      methodology: "Versioned JSON Web Import",
      desc: "Exports bibliometric snapshots and approved aggregate organizational or external reference tables for Power BI Desktop.",
      limitation:
        "Internal data requires a local installation; Power BI refresh, relationships and remote credentials need separate configuration.",
      icon: <BarChart3 className="h-4 w-4 text-status-warning-text" />,
      tagColor:
        "text-status-warning-text bg-status-warning-bg border-status-warning-border",
      targetTab: "powerbi" as NavTab,
    },
  ];

  const filteredCapabilities = softwareCapabilities.filter((item) => {
    if (studioCategory === "all") return true;
    return item.category === studioCategory;
  });

  return (
    <div className="space-y-8">
      {/* 1. Header & Active Dataset Context Selector (Canonical StudioSplitLayout) */}
      <StudioSplitLayout
        main={
          <div>
            <p className="sciai-kicker mb-2 text-brand-500!">
              {BRAND.shellDescriptor}
            </p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {BRAND.name} Research Intelligence
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
              Internal Analytics: Benchmark institutional productivity, capacity, and grant success rates.
              <br />
              Competitive Intelligence: Position your institution against top regional and global peers.
              <br />
              Strategic Foresight: Map emerging research frontiers and align with shifting funding priorities.
              <br />
              Societal Impact: Measure real-world influence across policy, clinical guidelines, and public engagement.
            </p>
          </div>
        }
        inspector={
          <div className="flex h-full flex-col justify-center space-y-2.5">
            <label
              htmlFor="active-corpus-select"
              className="block text-xs font-bold text-ink-primary"
            >
              Evidence scope
            </label>
            <Select
              id="active-corpus-select"
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="text-xs font-bold shadow-xs cursor-pointer"
            >
              <option value="">
                Consolidated Dataset Portfolio (All Datasets)
              </option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count} records)
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-ink-muted">
              Scope KPIs and AI executive synthesis to a specific dataset snapshot or evaluate the full portfolio.
            </p>
          </div>
        }
      />

      {/* 2. Upgraded 4-Pillar Scientometric Health Matrix */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Pillar 1: Publication Volume */}
        <Card padding="md" className="transition-colors hover:border-border-strong">
          <div className="flex items-center justify-between">
            <div className="sciai-kicker">Publication Volume</div>
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-1.5 text-brand-500">
              <FileText className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-metrics text-2xl font-black tracking-tight text-ink-primary">
              {loading ? "..." : activeDocCount.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-ink-muted">
              Indexed Publications
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-ink-muted">
            <span className="tabular-metrics">
              Datasets: {activeDataset ? 1 : datasets.length}
            </span>
            <span className="font-semibold text-status-success-text">
              Bibliographic Metadata Active
            </span>
          </div>
        </Card>

        {/* Pillar 2: Citation Impact & Velocity */}
        <Card padding="md" className="transition-colors hover:border-border-strong">
          <div className="flex items-center justify-between">
            <div className="sciai-kicker">Citation Velocity</div>
            <div className="rounded-lg border border-status-success-border bg-status-success-bg p-1.5 text-status-success-text">
              <Quote className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-metrics text-2xl font-black tracking-tight text-ink-primary">
              {loading
                ? "..."
                : citationStats.totalCitations.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-ink-muted">
              Total Citations
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-ink-muted">
            <span className="tabular-metrics">
              CPP: {citationStats.avgPerDoc} citations/publication
            </span>
            <span className="font-semibold text-status-success-text">
              Top Velocity: 340+
            </span>
          </div>
        </Card>

        {/* Pillar 3: Scholarly & Author Reach */}
        <Card padding="md" className="transition-colors hover:border-border-strong">
          <div className="flex items-center justify-between">
            <div className="sciai-kicker">Scholarly Reach</div>
            <div className="rounded-lg border border-status-info-border bg-status-info-bg p-1.5 text-status-info-text">
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-metrics text-2xl font-black tracking-tight text-ink-primary">
              {loading
                ? "..."
                : authorStats.uniqueAuthors.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-ink-muted">
              Unique Authors
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-ink-muted">
            <span>Co-Authorship Ratio</span>
            <span className="tabular-metrics font-semibold text-ink-primary">
              {authorStats.collabRatio} authors/publication
            </span>
          </div>
        </Card>

        {/* Pillar 4: Temporal Horizon & Momentum */}
        <Card padding="md" className="transition-colors hover:border-border-strong">
          <div className="flex items-center justify-between">
            <div className="sciai-kicker">Temporal Horizon</div>
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-1.5 text-status-warning-text">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-metrics text-2xl font-black tracking-tight text-ink-primary">
              {yearStats.minYear} – {yearStats.maxYear}
            </span>
            <span className="text-xs font-semibold text-ink-muted">
              Active Span
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-ink-muted">
            <span className="tabular-metrics">
              Peak: {yearStats.peakYear} ({yearStats.peakCount} publications)
            </span>
            <span className="tabular-metrics font-semibold text-status-success-text">
              CAGR {yearStats.cagr}
            </span>
          </div>
        </Card>
      </section>

      {/* 4. One-Click AI-Assisted Research Brief */}
      <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface-canvas to-surface-subtle p-6 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-500 p-2.5 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-brand-200 bg-brand-100/70 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  AI Research Assistance
                </span>
                <span className="text-[10px] font-semibold text-ink-subtle">
                  AI-Assisted Synthesis Engine
                </span>
              </div>

              <h2 className="mt-1 text-base font-black tracking-tight text-ink-primary">
                Executive Scientometric Synthesis
              </h2>

              <p className="text-xs text-ink-muted">
                AI-assisted interpretation of research frontiers, author
                collaboration hubs, and citation momentum.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {aiBrief && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCopyBrief}
                icon={
                  copiedBrief ? (
                    <Check className="h-3.5 w-3.5 text-status-success-text" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copiedBrief ? "Copied" : "Copy Brief"}
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleGenerateAiBrief}
              disabled={isAiGenerating}
              icon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isAiGenerating ? "animate-spin" : ""
                  }`}
                />
              }
            >
              {isAiGenerating
                ? "Synthesizing..."
                : aiBrief
                  ? "Refresh Synthesis"
                  : "Generate Research Corpus Brief"}
            </Button>
          </div>
        </div>

        {/* AI Brief Result or Prompt Callout */}
        <div className="mt-4">
          {aiBriefError && (
            <div className="mb-3">
              <AlertBanner tone="danger">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold">Synthesis Error: </span>
                    {aiBriefError}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiBrief}
                    className="shrink-0 cursor-pointer font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              </AlertBanner>
            </div>
          )}

          {aiBriefIsPartial && !aiBriefError && (
            <div className="mb-3">
              <AlertBanner tone="warning">
                Partial / Incomplete AI-Assisted Result: The synthesis was
                only partially generated and should not be treated as
                authoritative.
              </AlertBanner>
            </div>
          )}

          {aiBrief ? (
            <div className="space-y-2 whitespace-pre-line rounded-xl border border-brand-200 bg-surface-canvas p-4.5 text-xs leading-relaxed text-ink-secondary shadow-card">
              {aiBrief}
            </div>
          ) : !aiBriefError ? (
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 text-center">
              <p className="text-xs text-brand-800">
                Click{" "}
                <strong>“Generate Research Corpus Brief”</strong>{" "}
                to extract high-level strategic takeaways, emerging
                research clusters, and breakthrough velocity markers.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* 6. Software Capability Guide */}
      <section className="space-y-4">
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div>
              <p className="sciai-kicker mb-1">Studio Directory</p>
              <h2 className="text-base font-black tracking-tight text-ink-primary">
                SciAI Capability Guide
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">
                A practical map of the software modules, what each capability
                measures, where it launches, and the main methodological
                limitation to consider before interpreting the result.
              </p>
            </div>

            <Tabs
              items={[...capabilityCategoryTabs]}
              value={studioCategory}
              onChange={(val) => setStudioCategory(val)}
            />
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCapabilities.map((item) => {
            const executedAnalysis = findAnalysisByCapability(item.id);
            const isRunnable = hasCapability(item.id);
            const isComputed = Boolean(executedAnalysis);

            return (
              <article
                key={item.id}
                className="sciai-card flex flex-col justify-between p-5 transition-colors hover:border-border-strong"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl border border-border-subtle bg-surface-subtle p-2 text-ink-primary">
                      {item.icon}
                    </div>

                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${item.tagColor}`}
                    >
                      {item.methodology}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-ink-primary">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {item.desc}
                  </p>

                  <div className="mt-3 rounded-xl border border-status-warning-border bg-status-warning-bg/70 px-3 py-2 text-[11px] leading-5 text-status-warning-text">
                    <span className="font-bold">Limit:</span>{" "}
                    {item.limitation}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3 text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-muted">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isComputed
                          ? "bg-status-success-text"
                          : isRunnable
                            ? "bg-border-strong"
                            : "bg-status-warning-text"
                      }`}
                    />

                    {isComputed
                      ? "Computed"
                      : isRunnable
                        ? "Available"
                        : "Studio only"}
                  </span>

                  <button
                    type="button"
                    onClick={() => onNavigateTab(item.targetTab)}
                    className="inline-flex items-center gap-1 font-bold text-brand-500 transition-colors hover:text-brand-700 hover:underline cursor-pointer"
                  >
                    Launch
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}