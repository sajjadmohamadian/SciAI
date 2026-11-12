import React, { useState, useEffect, useMemo } from "react";
import { Dataset, BibliometricDocument, Analysis } from "../types.js";
import {
  BarChart3,
  TrendingUp,
  BookOpen,
  Users,
  Award,
  Database,
  Building2,
  Landmark,
  Coins,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SCIENTOMETRIC_MODELS, ENTITY_ANALYSIS_IDS } from "./AnalysesListView.js";
import { AnalysisResultPanel } from "./AnalysisResultPanel.js";
import { AlertBanner, Card } from "./CommonUI.js";

const LOCAL_ANALYSES = [
  {
    id: "overview",
    name: "Global Collection Metrics",
    category: "Corpus Overview & Growth",
    desc: "Corpus coverage, citation averages, authors, and sources.",
    icon: BarChart3,
  },
  {
    id: "trends",
    name: "Annual Trends",
    category: "Corpus Overview & Growth",
    desc: "Publication trajectory and mean citations by year.",
    icon: TrendingUp,
  },
  {
    id: "citations",
    name: "Citation Distribution",
    category: "Citation Impact",
    desc: "Citation brackets and exposure-adjusted velocity.",
    icon: Award,
  },
  {
    id: "grants",
    name: "Research Grants & Funding",
    category: "Funding & Affiliations",
    desc: "Funding coverage, sponsors, and grant awards.",
    icon: Landmark,
  },
  {
    id: "affiliations",
    name: "Affiliations & Institutions",
    category: "Funding & Affiliations",
    desc: "Institutional productivity and collaboration.",
    icon: Building2,
  },
  {
    id: "lotka",
    name: "Lotka's Law",
    category: "Scientometric Laws",
    desc: "Observed author productivity against Lotka's theoretical curve.",
    icon: Users,
  },
  {
    id: "bradford",
    name: "Bradford's Law",
    category: "Scientometric Laws",
    desc: "Journal scattering and the three Bradford zones.",
    icon: BookOpen,
  },
] as const;

type LocalAnalysisId = (typeof LOCAL_ANALYSES)[number]["id"];

const CORPUS_MODELS = SCIENTOMETRIC_MODELS.filter(
  (model) => !ENTITY_ANALYSIS_IDS.has(model.id)
);

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  onQuickRun: (capId: string, dsId: string) => Promise<Analysis | null>;
}

export function DescriptiveAnalyticsStudio({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  onQuickRun,
}: Props) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(
    selectedDatasetId || datasets[0]?.id || ""
  );

  const [activeSubTab, setActiveSubTab] =
    useState<LocalAnalysisId | null>("overview");

  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const [completedLocal, setCompletedLocal] =
    useState<LocalAnalysisId | null>("overview");

  const [focusedAnalysis, setFocusedAnalysis] =
    useState<Analysis | null>(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [, setIsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    setDocuments([]);
    setFocusedAnalysis(null);
    setRunError("");

    if (activeSubTab) {
      setCompletedLocal(activeSubTab);
    } else {
      setActiveSubTab("overview");
      setCompletedLocal("overview");
    }

    onSelectDataset?.(id);
  };

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDatasetId) {
      selectDataset(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  const currentDataset =
    datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  useEffect(() => {
    if (!currentDataset?.id) {
      setDocuments([]);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setDocumentsError("");
    setDocuments([]);

    fetch(`/api/datasets/${currentDataset.id}/documents?limit=5000`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      })
      .then((data) => {
        const docs = Array.isArray(data)
          ? data
          : data.documents || data.records || [];

        setDocuments(docs);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setDocumentsError("Unable to load documents for this dataset.");
        console.warn("Error fetching documents:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentDataset?.id]);

  const selectedModel = CORPUS_MODELS.find(
    (item) => item.id === activeModelId
  );

  const selectAnalysis = async (id: string, local: boolean) => {
    if (running) return;

    setRunError("");
    setFocusedAnalysis(null);

    if (local) {
      const localId = id as LocalAnalysisId;

      setActiveSubTab(localId);
      setActiveModelId(null);
      setCompletedLocal(null);

      if (documentsError) {
        setRunError(documentsError);
        return;
      }

      setCompletedLocal(localId);
      return;
    }

    if (!currentDataset?.id) {
      setRunError("Please select a dataset first.");
      return;
    }

    setActiveSubTab(null);
    setActiveModelId(id);
    setCompletedLocal(null);
    setRunning(true);

    try {
      const result = await onQuickRun(id, currentDataset.id);

      if (result) {
        setFocusedAnalysis(result);
      } else {
        setRunError(
          "The analysis could not be completed. Check the message above for details."
        );
      }
    } catch (error) {
      console.error("Corpus analysis failed:", error);
      setRunError("The analysis could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  const refreshAnalysis = async () => {
    if (!activeModelId || !currentDataset?.id || running) {
      return;
    }

    setRunning(true);
    setRunError("");

    try {
      const result = await onQuickRun(activeModelId, currentDataset.id);

      if (result) {
        setFocusedAnalysis(result);
      } else {
        setRunError(
          "The analysis could not be completed. Check the message above for details."
        );
      }
    } catch (error) {
      console.error("Corpus analysis refresh failed:", error);
      setRunError("The analysis could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  // Global Collection Statistics
  const macroStats = useMemo(() => {
    if (documents.length === 0) {
      return {
        timespan: "N/A",
        totalDocs: 0,
        totalCitations: 0,
        avgCitationsPerDoc: 0,
        annualGrowthRate: 0,
        authorsCount: 0,
        singleAuthorDocs: 0,
        sourcesCount: 0,
        collaborationIndex: 0,
      };
    }

    const years = documents
      .map((d: any) => Number(d.year || d.PY))
      .filter((y) => y > 1900 && y < 2050);

    const minYear = years.length ? Math.min(...years) : 2020;
    const maxYear = years.length ? Math.max(...years) : 2024;
    const timespan = `${minYear} - ${maxYear}`;

    let totalCitations = 0;
    const allAuthors = new Set<string>();
    const allSources = new Set<string>();
    let singleAuthorCount = 0;

    documents.forEach((d: any) => {
      totalCitations += Number(d.citations ?? d.TC ?? 0);

      const authorsList: string[] = Array.isArray(d.authors)
        ? d.authors
        : Array.isArray(d.AU)
          ? d.AU
          : typeof d.author === "string"
            ? d.author.split(";")
            : [];

      if (authorsList.length === 1) {
        singleAuthorCount++;
      }

      authorsList.forEach((a) => {
        const trimmed = a.trim();
        if (trimmed) {
          allAuthors.add(trimmed);
        }
      });

      const src = (d.source || d.SO || "").trim();
      if (src) {
        allSources.add(src);
      }
    });

    const totalDocs = documents.length;
    const avgCitationsPerDoc = Number(
      (totalCitations / (totalDocs || 1)).toFixed(2)
    );
    const span = Math.max(1, maxYear - minYear);
    const annualGrowthRate = Number(
      ((Math.pow(totalDocs, 1 / span) - 1) * 100).toFixed(2)
    );
    const multiAuthorDocs = Math.max(1, totalDocs - singleAuthorCount);
    const collaborationIndex = Number(
      ((allAuthors.size - singleAuthorCount) / multiAuthorDocs).toFixed(2)
    );

    return {
      timespan,
      totalDocs,
      totalCitations,
      avgCitationsPerDoc,
      annualGrowthRate,
      authorsCount: allAuthors.size,
      singleAuthorDocs: singleAuthorCount,
      sourcesCount: allSources.size,
      collaborationIndex,
    };
  }, [documents]);

  // Longitudinal Trends Data
  const longitudinalData = useMemo(() => {
    const yearMap: Record<number, { count: number; citations: number }> = {};

    documents.forEach((d: any) => {
      const yr = Number(d.year || d.PY);

      if (yr >= 1990 && yr <= 2030) {
        if (!yearMap[yr]) {
          yearMap[yr] = { count: 0, citations: 0 };
        }

        yearMap[yr].count++;
        yearMap[yr].citations += Number(d.citations ?? d.TC ?? 0);
      }
    });

    return Object.entries(yearMap)
      .map(([yr, data]) => ({
        year: yr,
        articles: data.count,
        meanCitations: Number((data.citations / (data.count || 1)).toFixed(2)),
      }))
      .sort((a, b) => Number(a.year) - Number(b.year));
  }, [documents]);

  // Citation Distribution Buckets
  const citationBuckets = useMemo(() => {
    const buckets = [
      { range: "0 Citations", min: 0, max: 0, count: 0 },
      { range: "1-5 Citations", min: 1, max: 5, count: 0 },
      { range: "6-20 Citations", min: 6, max: 20, count: 0 },
      { range: "21-50 Citations", min: 21, max: 50, count: 0 },
      { range: "51-100 Citations", min: 51, max: 100, count: 0 },
      { range: "100+ Citations", min: 101, max: Infinity, count: 0 },
    ];

    documents.forEach((d: any) => {
      const c = Number(d.citations ?? d.TC ?? 0);
      const b = buckets.find((bucket) => c >= bucket.min && c <= bucket.max);
      if (b) {
        b.count++;
      }
    });

    return buckets.map((b) => ({
      range: b.range,
      count: b.count,
      percentage: Number(
        ((b.count / (documents.length || 1)) * 100).toFixed(1)
      ),
    }));
  }, [documents]);

  // Citation Window & Opportunity Metrics
  const windowMetrics = useMemo(() => {
    if (!documents.length) return null;

    let eligible = 0;
    let excluded = 0;
    let totalRate = 0;
    let totalCits = 0;
    let totalExposure = 0;

    const currentYear = new Date().getFullYear();

    const years = documents
      .map((d: any) => Number(d.year || d.PY))
      .filter((y) => !isNaN(y) && y > 1800 && y <= currentYear + 1);

    const obsYear = years.length
      ? Math.min(currentYear, Math.max(...years))
      : currentYear;

    documents.forEach((d: any) => {
      const yr = Number(d.year || d.PY);
      const cits = Number(d.citations ?? d.TC ?? 0);

      if (isNaN(yr) || yr < 1800 || yr > obsYear) {
        excluded++;
      } else {
        eligible++;
        const delta = Math.max(1.0, obsYear - yr + 1.0);
        totalRate += cits / delta;
        totalCits += cits;
        totalExposure += delta;
      }
    });

    return {
      obsYear,
      eligible,
      excluded,
      windowAdjustedMeanVelocity:
        eligible > 0 ? Number((totalRate / eligible).toFixed(2)) : 0,
      weightedCorpusVelocity:
        totalExposure > 0 ? Number((totalCits / totalExposure).toFixed(2)) : 0,
    };
  }, [documents]);

  // Research Grants & Funding Stats
  const grantFundingStats = useMemo(() => {
    if (documents.length === 0) {
      return {
        fundedDocs: 0,
        unfundedDocs: 0,
        fundingCoverageRate: 0,
        totalFundingAgencies: 0,
        totalGrantNumbers: 0,
        fundedCitations: 0,
        unfundedCitations: 0,
        avgCitationsFunded: 0,
        avgCitationsUnfunded: 0,
        topAgencies: [],
        topGrants: [],
        fundingByYear: [],
      };
    }

    let fundedDocs = 0;
    let fundedCitations = 0;
    let unfundedCitations = 0;

    const agencyMap: Record<string, { count: number; citations: number }> = {};
    const grantMap: Record<string, { count: number; agencies: Set<string> }> = {};
    const yearFundingMap: Record<
      number,
      { year: number; funded: number; nonFunded: number }
    > = {};

    documents.forEach((d: any) => {
      const yr = Number(d.year || d.PY) || 2023;
      const cits = Number(d.citations ?? d.TC ?? 0);

      const agencies: string[] = Array.isArray(d.funding_agencies)
        ? d.funding_agencies
        : [];
      const grants: string[] = Array.isArray(d.grant_numbers)
        ? d.grant_numbers
        : [];
      const fu = d.FU
        ? Array.isArray(d.FU)
          ? d.FU
          : String(d.FU).split(";")
        : [];
      const fx = d.FX;

      const hasFunding =
        agencies.length > 0 ||
        grants.length > 0 ||
        fu.length > 0 ||
        Boolean(fx);

      if (!yearFundingMap[yr]) {
        yearFundingMap[yr] = { year: yr, funded: 0, nonFunded: 0 };
      }

      if (hasFunding) {
        fundedDocs++;
        fundedCitations += cits;
        yearFundingMap[yr].funded++;

        const allAgencies = Array.from(
          new Set([
            ...agencies,
            ...fu.map((s: string) => s.split("[")[0].trim()),
          ])
        ).filter((s) => s && s.length > 2);

        allAgencies.forEach((ag) => {
          if (!agencyMap[ag]) {
            agencyMap[ag] = { count: 0, citations: 0 };
          }
          agencyMap[ag].count++;
          agencyMap[ag].citations += cits;
        });

        grants.forEach((gr) => {
          const gStr = String(gr).trim();
          if (!grantMap[gStr]) {
            grantMap[gStr] = { count: 0, agencies: new Set() };
          }
          grantMap[gStr].count++;
          allAgencies.forEach((a) => grantMap[gStr].agencies.add(a));
        });
      } else {
        unfundedCitations += cits;
        yearFundingMap[yr].nonFunded++;
      }
    });

    const unfundedDocs = documents.length - fundedDocs;
    const coverageRate = Number(
      ((fundedDocs / documents.length) * 100).toFixed(1)
    );
    const avgFunded =
      fundedDocs > 0 ? Number((fundedCitations / fundedDocs).toFixed(1)) : 0;
    const avgUnfunded =
      unfundedDocs > 0
        ? Number((unfundedCitations / (unfundedDocs || 1)).toFixed(1))
        : 0;

    const topAgencies = Object.entries(agencyMap)
      .map(([agency, val]) => ({
        agency,
        documents: val.count,
        totalCitations: val.citations,
        avgCitations: Number((val.citations / (val.count || 1)).toFixed(1)),
      }))
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 15);

    const topGrants = Object.entries(grantMap)
      .map(([grant, val]) => ({
        grant,
        documents: val.count,
        agencies:
          Array.from(val.agencies).slice(0, 2).join(", ") || "Grant Award",
      }))
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 15);

    const fundingByYear = Object.values(yearFundingMap).sort(
      (a, b) => a.year - b.year
    );

    return {
      fundedDocs,
      unfundedDocs,
      fundingCoverageRate: coverageRate,
      totalFundingAgencies: Object.keys(agencyMap).length,
      totalGrantNumbers: Object.keys(grantMap).length,
      fundedCitations,
      unfundedCitations,
      avgCitationsFunded: avgFunded,
      avgCitationsUnfunded: avgUnfunded,
      topAgencies,
      topGrants,
      fundingByYear,
    };
  }, [documents]);

  // Organizational Affiliations & Institutional Productivity
  const institutionalStats = useMemo(() => {
    const instMap: Record<
      string,
      { count: number; citations: number; countries: Set<string> }
    > = {};

    let multiInstitutionDocs = 0;

    const extractInsts = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw.flatMap((i) => extractInsts(i));
      }

      return String(raw)
        .split(";")
        .map((item) => {
          const cleaned = item.replace(/\[.*?\]/g, "").trim();
          const parts = cleaned.split(",");
          let primary = parts[0]?.trim() || "";

          if (
            /^(dept|department|fac|faculty|inst|institute|centre|center|school) of\s+/i.test(
              primary
            )
          ) {
            if (parts[1] && parts[1].trim().length > 3) {
              primary = parts[1].trim();
            }
          }

          return primary
            .replace(
              /^(dept|department|fac|faculty|inst|institute|centre|center) of\s+/i,
              ""
            )
            .slice(0, 60)
            .trim();
        })
        .filter((s) => s && s.length > 2 && !/^\d+$/.test(s));
    };

    documents.forEach((d: any) => {
      const cits = Number(d.citations ?? d.TC ?? 0);
      const insts = Array.from(
        new Set(
          extractInsts(
            d.institutions ||
              d.affiliations ||
              d.C1 ||
              d.RP ||
              d.affiliation
          )
        )
      );

      if (insts.length > 1) {
        multiInstitutionDocs++;
      }

      insts.forEach((inst) => {
        if (!instMap[inst]) {
          instMap[inst] = { count: 0, citations: 0, countries: new Set() };
        }
        instMap[inst].count++;
        instMap[inst].citations += cits;
      });
    });

    const topInstitutions = Object.entries(instMap)
      .map(([institution, val]) => ({
        institution,
        documents: val.count,
        citations: val.citations,
        avgCitations: Number((val.citations / (val.count || 1)).toFixed(1)),
      }))
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 15);

    const collaborationRate = documents.length
      ? Number(((multiInstitutionDocs / documents.length) * 100).toFixed(1))
      : 0;

    return {
      totalInstitutions: Object.keys(instMap).length,
      topInstitutions,
      multiInstitutionDocs,
      collaborationRate,
    };
  }, [documents]);

  // Lotka's Law Empirical vs Theoretical Model
  const lotkaAnalysis = useMemo(() => {
    const authorDocCount: Record<string, number> = {};

    documents.forEach((d: any) => {
      const authorsList: string[] = Array.isArray(d.authors)
        ? d.authors
        : Array.isArray(d.AU)
          ? d.AU
          : typeof d.author === "string"
            ? d.author.split(";")
            : [];

      authorsList.forEach((a) => {
        const trimmed = a.trim();
        if (trimmed) {
          authorDocCount[trimmed] = (authorDocCount[trimmed] || 0) + 1;
        }
      });
    });

    const totalAuthors = Object.keys(authorDocCount).length || 1;
    const frequencyOfFrequencies: Record<number, number> = {};

    Object.values(authorDocCount).forEach((cnt) => {
      frequencyOfFrequencies[cnt] = (frequencyOfFrequencies[cnt] || 0) + 1;
    });

    const authorsWithOnePaper = frequencyOfFrequencies[1] || 0;
    const cConstant = authorsWithOnePaper / totalAuthors || 0.6;
    const betaExponent = 2.0;

    const samplePoints = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const data = samplePoints.map((n) => {
      const observed = frequencyOfFrequencies[n] || 0;
      const obsProp = Number(((observed / totalAuthors) * 100).toFixed(2));
      const theoreticalProp = Number(
        ((cConstant / Math.pow(n, betaExponent)) * 100).toFixed(2)
      );
      const theoreticalCount = Math.round(
        (cConstant / Math.pow(n, betaExponent)) * totalAuthors
      );

      return {
        papers: `${n} paper${n > 1 ? "s" : ""}`,
        observedCount: observed,
        theoreticalCount,
        observedFraction: obsProp,
        theoreticalFraction: theoreticalProp,
      };
    });

    return {
      totalAuthors,
      betaExponent,
      cConstant: Number(cConstant.toFixed(3)),
      data,
    };
  }, [documents]);

  // Bradford's Law Analysis
  const bradfordAnalysis = useMemo(() => {
    const journalCounts: Record<string, number> = {};

    documents.forEach((d: any) => {
      const src = (d.source || d.SO || "").trim();
      if (src) {
        journalCounts[src] = (journalCounts[src] || 0) + 1;
      }
    });

    const sorted = Object.entries(journalCounts)
      .map(([journal, articles]) => ({ journal, articles }))
      .sort((a, b) => b.articles - a.articles);

    const totalArticles = documents.length || 1;
    const targetPerZone = Math.floor(totalArticles / 3);

    let cumArticles = 0;
    let currentZone = 1;
    let zone1Count = 0;
    let zone2Count = 0;
    let zone3Count = 0;

    const enriched = sorted.map((item, idx) => {
      cumArticles += item.articles;
      const cumPct = Math.round((cumArticles / totalArticles) * 100);

      if (cumArticles <= targetPerZone) {
        currentZone = 1;
        zone1Count++;
      } else if (cumArticles <= targetPerZone * 2) {
        currentZone = 2;
        zone2Count++;
      } else {
        currentZone = 3;
        zone3Count++;
      }

      return {
        rank: idx + 1,
        journal: item.journal,
        articles: item.articles,
        cumulativeArticles: cumArticles,
        cumulativePercentage: cumPct,
        zone: currentZone,
      };
    });

    const kMultiplier =
      zone1Count > 0 ? Number((zone2Count / zone1Count).toFixed(2)) : 3.1;

    return {
      coreSourcesCount: zone1Count,
      zone2Count,
      zone3Count,
      kMultiplier,
      zones: [
        {
          name: "Zone 1 (Nuclear Core)",
          sources: zone1Count,
          articles: enriched
            .filter((i) => i.zone === 1)
            .reduce((acc, i) => acc + i.articles, 0),
        },
        {
          name: "Zone 2 (Extension)",
          sources: zone2Count,
          articles: enriched
            .filter((i) => i.zone === 2)
            .reduce((acc, i) => acc + i.articles, 0),
        },
        {
          name: "Zone 3 (Periphery)",
          sources: zone3Count,
          articles: enriched
            .filter((i) => i.zone === 3)
            .reduce((acc, i) => acc + i.articles, 0),
        },
      ],
      topJournals: enriched.slice(0, 15),
    };
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Top Header & Corpus Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700">
              Descriptive Analytics
            </span>
          </div>

          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
            Descriptive Analytics Studio
          </h1>

          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
            Corpus-level bibliometrics, research grants (WoS & Scopus), institutional affiliations,
            growth trends, citation distribution, Lotka & Bradford laws, and capability models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 shadow-card">
            <Database className="h-3.5 w-3.5 text-brand-500" />

            <select
              value={currentDataset?.id || ""}
              onChange={(e) => selectDataset(e.target.value)}
              disabled={running || !datasets.length}
              className="bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count.toLocaleString()} docs)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(215px,250px)_minmax(0,1fr)]">
        {/* Flat Analysis Sidebar */}
        <aside
          aria-label="Corpus analysis methods"
          className="rounded-2xl border border-border-default bg-surface-canvas p-3 shadow-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <h2 className="sciai-kicker px-2 pb-2">Analysis methods</h2>

          <nav className="space-y-0.5">
            {[
              ...LOCAL_ANALYSES.map((item) => ({
                ...item,
                local: true as const,
              })),
              ...CORPUS_MODELS.map((item) => ({
                ...item,
                local: false as const,
              })),
            ].map((item) => {
              const Icon = item.icon;
              const selected = item.local
                ? activeSubTab === item.id
                : activeModelId === item.id;

              return (
                <button
                  key={`${item.local ? "view" : "model"}-${item.id}`}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => selectAnalysis(item.id, item.local)}
                  disabled={running}
                  className={`flex w-full cursor-pointer items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-wait ${
                    selected
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      selected ? "text-white" : "text-ink-subtle"
                    }`}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-5" aria-live="polite">
          {/* Analysis execution errors */}
          {runError && <AlertBanner tone="danger">{runError}</AlertBanner>}

          {/* SUB-TAB 1: GLOBAL COLLECTION METRICS */}
          {activeSubTab === "overview" && completedLocal === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card padding="md">
                  <div className="sciai-kicker">Timespan Covered</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {macroStats.timespan}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Historical publication span
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Total Documents</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-brand-500">
                    {macroStats.totalDocs.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">Peer-reviewed records</div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Avg Citations / Doc</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-status-success-text">
                    {macroStats.avgCitationsPerDoc}
                  </div>
                  <div className="tabular-metrics mt-1 text-[11px] text-ink-muted">
                    Total citations: {macroStats.totalCitations.toLocaleString()}
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Annual Growth Rate</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-brand-600">
                    +{macroStats.annualGrowthRate}%
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">CAGR across corpus</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Authors & Collaboration Card */}
                <Card padding="lg" className="space-y-4">
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink-primary">
                    <Users className="h-4 w-4 text-brand-500" />
                    Authors & Collaboration Index
                  </h2>

                  <div className="divide-y divide-border-subtle text-xs">
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Total Unique Authors</span>
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {macroStats.authorsCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Single-authored Documents</span>
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {macroStats.singleAuthorDocs.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Co-Authors per Document</span>
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {macroStats.totalDocs
                          ? (macroStats.authorsCount / macroStats.totalDocs).toFixed(2)
                          : 0}
                      </span>
                    </div>

                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Collaboration Index (CI)</span>
                      <span className="tabular-metrics font-bold text-status-success-text">
                        {macroStats.collaborationIndex}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Sources & Venues Card */}
                <Card padding="lg" className="space-y-4">
                  <h2 className="flex items-center gap-2 text-base font-bold text-ink-primary">
                    <BookOpen className="h-4 w-4 text-status-success-text" />
                    Sources & Publishing Venues
                  </h2>

                  <div className="divide-y divide-border-subtle text-xs">
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Total Unique Journals / Sources</span>
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {macroStats.sourcesCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Documents per Source (Avg)</span>
                      <span className="tabular-metrics font-bold text-ink-primary">
                        {macroStats.sourcesCount
                          ? (macroStats.totalDocs / macroStats.sourcesCount).toFixed(1)
                          : 0}
                      </span>
                    </div>

                    <div className="flex justify-between py-2.5">
                      <span className="text-ink-muted">Primary Document Formats</span>
                      <span className="font-bold text-ink-primary">
                        Journal Articles, Reviews, Conference
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ANNUAL PRODUCTION & TRENDS */}
          {activeSubTab === "trends" && completedLocal === "trends" && (
            <div className="space-y-6">
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary">Publication Trajectory</h3>
                    <p className="text-xs text-ink-muted">
                      Annual publication distribution and citation velocity for the active corpus.
                    </p>
                  </div>
                </div>

                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={longitudinalData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorArticles" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#315C7C" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#315C7C" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8e4" />
                      <XAxis dataKey="year" stroke="#828d98" fontSize={11} />
                      <YAxis stroke="#828d98" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101820",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "11px",
                          color: "#ffffff",
                        }}
                      />
                      <Legend />

                      <Area
                        type="monotone"
                        dataKey="articles"
                        stroke="#315C7C"
                        fillOpacity={1}
                        fill="url(#colorArticles)"
                        name="Published Articles"
                      />

                      <Line
                        type="monotone"
                        dataKey="meanCitations"
                        stroke="#0D9488"
                        strokeWidth={2}
                        name="Mean Citations / Doc"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* SUB-TAB 3: CITATION DISTRIBUTION */}
          {activeSubTab === "citations" && completedLocal === "citations" && (
            <div className="space-y-6">
              {/* Citation Opportunity & Window Adjustment KPI Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card padding="md">
                  <div className="flex items-center justify-between gap-1">
                    <span className="sciai-kicker">Raw Citations (CPP)</span>
                    <span className="rounded border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[9px] font-bold text-ink-secondary">
                      Calculated
                    </span>
                  </div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {macroStats.avgCitationsPerDoc}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Total citations / total documents
                  </div>
                </Card>

                <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 shadow-card">
                  <div className="flex items-center justify-between gap-1">
                    <span className="sciai-kicker text-brand-700!">Window Velocity</span>
                    <span className="rounded border border-brand-200 bg-brand-100/70 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                      Window-Adjusted
                    </span>
                  </div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-brand-800">
                    {windowMetrics?.windowAdjustedMeanVelocity != null
                      ? `${windowMetrics.windowAdjustedMeanVelocity}/yr`
                      : "Unavailable"}
                  </div>
                  <div className="mt-1 text-[11px] text-brand-600">
                    Mean citations per exposure-year
                  </div>
                </div>

                <Card padding="md">
                  <div className="flex items-center justify-between gap-1">
                    <span className="sciai-kicker">Weighted Velocity</span>
                    <span className="rounded border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[9px] font-bold text-ink-secondary">
                      Window-Adjusted
                    </span>
                  </div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {windowMetrics?.weightedCorpusVelocity != null
                      ? `${windowMetrics.weightedCorpusVelocity}/yr`
                      : "Unavailable"}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Total citations / total exposure years
                  </div>
                </Card>

                <div className="rounded-2xl border border-status-warning-border bg-status-warning-bg/50 p-5 shadow-card">
                  <div className="flex items-center justify-between gap-1">
                    <span className="sciai-kicker text-status-warning-text!">
                      Field Normalized
                    </span>
                    <span className="rounded border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[9px] font-bold text-status-warning-text">
                      Unavailable
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-ink-primary">Reference Missing</div>
                  <div className="mt-1 text-[11px] text-status-warning-text">
                    No external baseline population
                  </div>
                </div>
              </div>

              <Card padding="lg" className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Citation Distribution & Power Law Skewness
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Segmenting papers into citation brackets to identify uncited vs highly cited
                    breakthrough works.
                  </p>
                </div>

                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={citationBuckets}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8e4" />
                      <XAxis dataKey="range" stroke="#828d98" fontSize={11} />
                      <YAxis stroke="#828d98" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101820",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "11px",
                          color: "#ffffff",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#315C7C"
                        radius={[6, 6, 0, 0]}
                        name="Document Count"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Explanatory note */}
                <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-subtle p-3.5 text-xs text-ink-secondary">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <div>
                    <span className="font-bold text-ink-primary">
                      Longitudinal Opportunity Window:{" "}
                    </span>
                    <span>
                      Observation year cutoff: {windowMetrics?.obsYear ?? "Auto"}. Exposure elapsed
                      time is defined as (Cutoff - Publication Year) + 1.0 calendar years (
                      {windowMetrics?.eligible ?? 0} eligible papers). Disciplinary field
                      normalization (MNCS) is preserved as unavailable without external reference
                      baselines.
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* SUB-TAB 4: RESEARCH GRANTS & FUNDING */}
          {activeSubTab === "grants" && completedLocal === "grants" && (
            <div className="space-y-6">
              {/* Funding KPI Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card padding="md">
                  <div className="sciai-kicker">Funded Research</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-status-warning-text">
                    {grantFundingStats.fundedDocs.toLocaleString()}
                  </div>
                  <div className="tabular-metrics mt-1 text-[11px] text-ink-muted">
                    {grantFundingStats.fundingCoverageRate}% coverage rate
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Funding Agencies</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {grantFundingStats.totalFundingAgencies.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Distinct sponsors identified
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Grant Numbers</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-brand-500">
                    {grantFundingStats.totalGrantNumbers.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">Unique grant/award IDs</div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Funded Citation Advantage</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-status-success-text">
                    {grantFundingStats.avgCitationsFunded} vs{" "}
                    {grantFundingStats.avgCitationsUnfunded}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Funded vs Non-funded avg citations
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Top Funding Agencies Table */}
                <Card padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                      <Landmark className="h-4 w-4 text-status-warning-text" />
                      Top Funding Agencies & Sponsors
                    </h3>
                    <span className="text-xs text-ink-subtle">WoS FU & Scopus Funding</span>
                  </div>

                  <div className="max-h-72 overflow-x-auto overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase text-ink-muted">
                        <tr>
                          <th className="p-2.5">Funding Agency</th>
                          <th className="p-2.5 text-right">Funded Papers</th>
                          <th className="p-2.5 text-right">Total Cits</th>
                          <th className="p-2.5 text-right">Avg Cits</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border-subtle">
                        {grantFundingStats.topAgencies.map((ag: any, i: number) => (
                          <tr key={i} className="transition-colors hover:bg-surface-subtle/60">
                            <td className="line-clamp-1 max-w-[200px] p-2.5 font-bold text-ink-primary">
                              {ag.agency}
                            </td>
                            <td className="tabular-metrics p-2.5 text-right font-mono font-semibold text-ink-primary">
                              {ag.documents}
                            </td>
                            <td className="tabular-metrics p-2.5 text-right font-mono text-status-success-text">
                              {ag.totalCitations}
                            </td>
                            <td className="tabular-metrics p-2.5 text-right font-mono font-bold text-brand-500">
                              {ag.avgCitations}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Top Grant Numbers */}
                <Card padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                      <Coins className="h-4 w-4 text-brand-500" />
                      Top Grant / Award Contracts
                    </h3>
                    <span className="text-xs text-ink-subtle">Award Identification</span>
                  </div>

                  <div className="max-h-72 overflow-x-auto overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase text-ink-muted">
                        <tr>
                          <th className="p-2.5">Grant / Award #</th>
                          <th className="p-2.5 text-right">Publications</th>
                          <th className="p-2.5">Associated Sponsor</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border-subtle">
                        {grantFundingStats.topGrants.map((gr: any, i: number) => (
                          <tr key={i} className="transition-colors hover:bg-surface-subtle/60">
                            <td className="p-2.5 font-mono font-bold text-ink-primary">
                              #{gr.grant}
                            </td>
                            <td className="tabular-metrics p-2.5 text-right font-mono font-bold text-ink-primary">
                              {gr.documents}
                            </td>
                            <td className="line-clamp-1 max-w-[180px] p-2.5 text-[11px] text-ink-muted">
                              {gr.agencies}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: AFFILIATIONS & INSTITUTIONS */}
          {activeSubTab === "affiliations" && completedLocal === "affiliations" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card padding="md">
                  <div className="sciai-kicker">Total Affiliations</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {institutionalStats.totalInstitutions.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Universities & Research Institutes
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Multi-Institutional Papers</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-brand-600">
                    {institutionalStats.multiInstitutionDocs.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Inter-organizational collaborations
                  </div>
                </Card>

                <Card padding="md">
                  <div className="sciai-kicker">Collaboration Rate</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-status-success-text">
                    {institutionalStats.collaborationRate}%
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">Cross-institutional share</div>
                </Card>
              </div>

              {/* Top Institutions Table */}
              <Card padding="lg" className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                  <Building2 className="h-4 w-4 text-brand-500" />
                  Institutional Productivity Ranking (WoS C1 & Scopus)
                </h3>

                <div className="max-h-96 overflow-x-auto overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase text-ink-muted">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Institution / University</th>
                        <th className="p-3 text-right">Publications</th>
                        <th className="p-3 text-right">Total Citations</th>
                        <th className="p-3 text-right">Avg Citations</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border-subtle">
                      {institutionalStats.topInstitutions.map((inst, i) => (
                        <tr key={i} className="transition-colors hover:bg-surface-subtle/60">
                          <td className="tabular-metrics w-8 p-3 font-mono text-ink-subtle">
                            #{i + 1}
                          </td>
                          <td className="line-clamp-1 max-w-[280px] p-3 font-bold text-ink-primary">
                            {inst.institution}
                          </td>
                          <td className="tabular-metrics p-3 text-right font-mono font-bold text-ink-primary">
                            {inst.documents}
                          </td>
                          <td className="tabular-metrics p-3 text-right font-mono text-status-success-text">
                            {inst.citations.toLocaleString()}
                          </td>
                          <td className="tabular-metrics p-3 text-right font-mono font-bold text-brand-500">
                            {inst.avgCitations}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* SUB-TAB 6: LOTKA'S LAW */}
          {activeSubTab === "lotka" && completedLocal === "lotka" && (
            <div className="space-y-6">
              <Card padding="lg" className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Lotka's Inverse Square Law of Scientific Productivity
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Comparing empirical author productivity vs theoretical prediction (f(x) = C /
                    x^β).
                  </p>
                </div>

                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lotkaAnalysis.data}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8e4" />
                      <XAxis dataKey="papers" stroke="#828d98" fontSize={11} />
                      <YAxis stroke="#828d98" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101820",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "11px",
                          color: "#ffffff",
                        }}
                      />
                      <Legend />

                      <Bar
                        dataKey="observedCount"
                        fill="#315C7C"
                        name="Observed Authors"
                        radius={[4, 4, 0, 0]}
                      />

                      <Bar
                        dataKey="theoreticalCount"
                        fill="#89B2D1"
                        name="Theoretical Model"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* SUB-TAB 7: BRADFORD'S LAW */}
          {activeSubTab === "bradford" && completedLocal === "bradford" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {bradfordAnalysis.zones.map((z, idx) => (
                  <Card key={idx} padding="md">
                    <div className="sciai-kicker">{z.name}</div>
                    <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                      {z.sources} journals
                    </div>
                    <div className="tabular-metrics mt-1 text-xs text-ink-muted">
                      {z.articles} articles (~33% corpus)
                    </div>
                  </Card>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                <h3 className="text-sm font-bold text-ink-primary">Zone 1: Core Nuclear Journals</h3>

                <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default text-xs">
                  {bradfordAnalysis.topJournals.map((j) => (
                    <div
                      key={j.rank}
                      className="flex flex-wrap items-center justify-between gap-2 bg-surface-canvas p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="tabular-metrics w-5 font-mono text-ink-subtle">
                          #{j.rank}
                        </span>
                        <span className="font-bold text-ink-primary">{j.journal}</span>
                      </div>

                      <div className="tabular-metrics flex items-center gap-4 text-ink-secondary">
                        <span>
                          <strong className="text-ink-primary">{j.articles}</strong> articles
                        </span>

                        <span className="text-ink-subtle">({j.cumulativePercentage}% cum.)</span>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            j.zone === 1
                              ? "border-status-success-border bg-status-success-bg text-status-success-text"
                              : j.zone === 2
                                ? "border-brand-200 bg-brand-50 text-brand-700"
                                : "border-border-default bg-surface-subtle text-ink-muted"
                          }`}
                        >
                          Zone {j.zone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* CORPUS MODEL RESULT */}
          {selectedModel && focusedAnalysis && (
            <div key={focusedAnalysis.id}>
              <AnalysisResultPanel
                analysis={focusedAnalysis}
                onRefresh={refreshAnalysis}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}