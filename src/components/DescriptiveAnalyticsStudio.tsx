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
  Globe2,
  Hash,
} from "lucide-react";
import { EntityExplorerStudio } from "./EntityExplorerStudio.js";
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
import { AnalysisResultPanel } from "./AnalysisResultPanel.js";
import { CitationGraphicalSummary } from "./CitationGraphicalSummary.js";
import { AssociationRulesGraph } from "./AssociationRulesGraph.js";
import { AlertBanner, Card } from "./CommonUI.js";

const LOCAL_ANALYSES = [
  {
    id: "overview",
    name: "Global Collection Metrics",
    category: "Main",
    desc: "Corpus coverage, citation averages, authors, and sources.",
    icon: BarChart3,
  },
  {
    id: "authors",
    name: "Authors",
    category: "Main",
    desc: "Author productivity, Hirsch family metrics, Price elite group, and core H-index matrix.",
    icon: Users,
  },
  {
    id: "institutions",
    name: "Institutions",
    category: "Main",
    desc: "Institutional affiliations, rankings, and productivity analytics.",
    icon: Building2,
  },
  {
    id: "countries",
    name: "Countries",
    category: "Main",
    desc: "National scientific output, collaboration, and geographic affiliation maps.",
    icon: Globe2,
  },
  {
    id: "sources",
    name: "Sources",
    category: "Main",
    desc: "Publication venues, Lotka & Bradford laws, core documents, and venue impact.",
    icon: BookOpen,
  },
  {
    id: "keywords",
    name: "Keywords",
    category: "Main",
    desc: "Author keywords, descriptors, co-occurrence, and vocabulary growth.",
    icon: Hash,
  },
  {
    id: "grants",
    name: "Grants",
    category: "Main",
    desc: "Funding agencies, grant distribution, and funded citation impact.",
    icon: Landmark,
  },
  {
    id: "citations",
    name: "Citations",
    category: "Main",
    desc: "Citation frequency distribution, skewness, and annual velocity.",
    icon: TrendingUp,
  },
] as const;

type LocalAnalysisId = (typeof LOCAL_ANALYSES)[number]["id"];

const SUB_TABS_MAP: Record<string, Array<{ id: string; label: string }>> = {
  authors: [
    { id: "entitymodel:author.productivity", label: "1. Price's Law & Concentration" },
    { id: "entity:authors", label: "2. All Authors & Trajectory" },
    { id: "entitymodel:citation.advanced_hirsch", label: "3. Impact & Leadership Matrix" },
    { id: "local:lotka", label: "4. Lotka's Law (Author Productivity)" },
  ],
  institutions: [
    { id: "entitymodel:institution.productivity", label: "Institution Productivity Analytics" },
  ],
  countries: [
    
    { id: "entitymodel:group.analysis", label: "Geographic Map (C1)" },
    { id: "model:group.comparative_significance", label: "Domestic vs. International Impact (SCP vs. MCP)" },
  ],
  sources: [
    { id: "entitymodel:source.productivity", label: "Publication Venues & Impact" },
    { id: "local:bradford", label: "Bradford's Law" },
    { id: "entity:documents", label: "Core Documents" },
  ],
  keywords: [
    { id: "entitymodel:keyword.frequency", label: "Keyword Frequency" },
    { id: "local:coword_graph", label: "Co-Word & Association Rules" },
  ],
  grants: [
    { id: "local:grants_overview", label: "Grant Coverage & Funding Breakdown" },
  ],
  citations: [
    { id: "local:citations_overview", label: "Citations Graphical Summary & Normality" },
    { id: "model:citation.window_adjusted", label: "Citations per Document & Annual Velocity" },
  ],
};

const DEFAULT_INNER_VIEW: Record<LocalAnalysisId, string> = {
  overview: "default",
  authors: "entitymodel:author.productivity",
  institutions: "entitymodel:institution.productivity",
  countries: "entitymodel:group.analysis",
  sources: "entitymodel:source.productivity",
  keywords: "entitymodel:keyword.frequency",
  grants: "local:grants_overview",
  citations: "local:citations_overview",
};

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

  const [activeSubTab, setActiveSubTab] = useState<LocalAnalysisId>("overview");
  const [innerSubView, setInnerSubView] = useState<string>("default");
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [focusedAnalysis, setFocusedAnalysis] = useState<Analysis | null>(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [, setIsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const currentDataset =
    datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  const runServerModel = async (capId: string, dsId: string) => {
    setFocusedAnalysis(null);
    setActiveModelId(capId);
    setRunning(true);
    setRunError("");
    try {
      const result = await onQuickRun(capId, dsId);
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

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    setDocuments([]);
    setFocusedAnalysis(null);
    setRunError("");
    onSelectDataset?.(id);

    if (innerSubView.startsWith("model:") && id) {
      runServerModel(innerSubView.replace("model:", ""), id);
    }
  };

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDatasetId) {
      selectDataset(selectedDatasetId);
    }
  }, [selectedDatasetId]);

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

  const selectMainMenu = async (localId: LocalAnalysisId) => {
    if (running) return;

    setRunError("");
    setFocusedAnalysis(null);
    setActiveModelId(null);
    setActiveSubTab(localId);

    if (documentsError) {
      setRunError(documentsError);
      return;
    }

    const defaultTarget = DEFAULT_INNER_VIEW[localId] || "default";
    setInnerSubView(defaultTarget);

    if (defaultTarget.startsWith("model:")) {
      if (!currentDataset?.id) {
        setRunError("Please select a dataset first.");
        return;
      }
      await runServerModel(defaultTarget.replace("model:", ""), currentDataset.id);
    }
  };

  const selectInnerSubTab = async (subId: string) => {
    if (running) return;
    setInnerSubView(subId);
    setRunError("");

    if (subId.startsWith("model:")) {
      if (!currentDataset?.id) {
        setRunError("Please select a dataset first.");
        return;
      }
      await runServerModel(subId.replace("model:", ""), currentDataset.id);
    } else {
      setFocusedAnalysis(null);
      setActiveModelId(null);
    }
  };

  const refreshAnalysis = async () => {
    if (!activeModelId || !currentDataset?.id || running) {
      return;
    }
    await runServerModel(activeModelId, currentDataset.id);
  };

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

      authorsList.forEach((a: any) => {
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
    const sortedYrs = [...years].sort((a, b) => a - b);
    const firstYrCount = years.filter((y) => y === sortedYrs[0]).length || 1;
    const lastYrCount =
      years.filter((y) => y === sortedYrs[sortedYrs.length - 1]).length || 1;
    const annualGrowthRate =
      span > 0 && firstYrCount > 0
        ? Number(((Math.pow(lastYrCount / firstYrCount, 1 / span) - 1) * 100).toFixed(2))
        : 0;
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

      const scopusFundingRaw = [
        d["Funding Details"],
        d["Funding Texts"],
        d["Funding Text 1"],
        d.funding_details,
        d.funding_text,
        d.funding,
        d.Sponsor,
      ]
        .filter((v) => v && String(v).trim().length > 0)
        .map((v) => String(v).trim())
        .join("; ");

      const scopusAgencies: string[] = [];
      const scopusGrants: string[] = [];
      if (scopusFundingRaw) {
        // ??????? ??? ?????? ???? ? ????? ???? ?? ??? Scopus Funding Details / Texts
        const parts = scopusFundingRaw.split(/[;|]/).map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          // ????? ???? Scopus: Agency Name: Grant1, Grant2 ?? Agency Name (Grant1)
          const colonIdx = part.indexOf(":");
          if (colonIdx > 2) {
            const agName = part.slice(0, colonIdx).trim();
            if (agName.length > 2) scopusAgencies.push(agName);
            const rest = part.slice(colonIdx + 1);
            rest.split(/[,;]/).forEach((g) => {
              const cleanG = g.trim();
              if (cleanG && /[0-9]/.test(cleanG) && cleanG.length <= 35) {
                scopusGrants.push(cleanG);
              }
            });
          } else {
            const bracketMatch = part.match(/^([^(\[]+)[(\[]\s*([^)\]]+)\s*[)\]]/);
            if (bracketMatch) {
              const agName = bracketMatch[1].trim();
              if (agName.length > 2) scopusAgencies.push(agName);
              bracketMatch[2].split(/[,;]/).forEach((g) => {
                const cleanG = g.trim();
                if (cleanG) scopusGrants.push(cleanG);
              });
            } else if (part.length > 2 && part.length < 140) {
              scopusAgencies.push(part);
            }
          }
        }
      }

      const agencies: string[] = Array.from(
        new Set([
          ...(Array.isArray(d.funding_agencies) ? d.funding_agencies : []),
          ...scopusAgencies,
        ])
      );
      const grants: string[] = Array.from(
        new Set([
          ...(Array.isArray(d.grant_numbers) ? d.grant_numbers : []),
          ...scopusGrants,
        ])
      );
      const fu = d.FU
        ? Array.isArray(d.FU)
          ? d.FU
          : String(d.FU).split(";")
        : [];
      const fx = d.FX || scopusFundingRaw;

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

  const lotkaAnalysis = useMemo(() => {
    const authorDocCount: Record<string, number> = {};
    documents.forEach((d: any) => {
      const authorsList = Array.isArray(d.authors)
        ? d.authors
        : Array.isArray(d.AU)
          ? d.AU
          : typeof d.author === "string"
            ? d.author.split(";")
            : [];
      authorsList.forEach((a) => {
        const trimmed = a.trim();
        if (trimmed) authorDocCount[trimmed] = (authorDocCount[trimmed] || 0) + 1;
      });
    });
    const totalAuthors = Object.keys(authorDocCount).length || 1;
    const frequencyOfFrequencies: Record<number, number> = {};
    Object.values(authorDocCount).forEach((cnt: number) => {
      frequencyOfFrequencies[cnt] = (frequencyOfFrequencies[cnt] || 0) + 1;
    });
    const authorsWithOnePaper = frequencyOfFrequencies[1] || 0;
    const singlePaperPct = Number(
      ((authorsWithOnePaper / totalAuthors) * 100).toFixed(1)
    );
    const cConstant = authorsWithOnePaper / totalAuthors || 0.6;
    const pts = Object.entries(frequencyOfFrequencies)
      .map(([x, y]) => ({ x: Number(x), y: Number(y) }))
      .filter((p) => p.x > 0 && p.y > 0);
    let betaExponent = 2.0,
      rSquared = 0;
    if (pts.length >= 2) {
      const lx = pts.map((p) => Math.log(p.x)),
        ly = pts.map((p) => Math.log(p.y));
      const mx = lx.reduce((a, b) => a + b, 0) / lx.length,
        my = ly.reduce((a, b) => a + b, 0) / ly.length;
      const num = lx.reduce((s, v, i) => s + (v - mx) * (ly[i] - my), 0);
      const den = lx.reduce((s, v) => s + Math.pow(v - mx, 2), 0);
      if (den > 0) {
        const slope = num / den;
        betaExponent = Number(Math.abs(slope).toFixed(2));
        const ssTot = ly.reduce((s, v) => s + Math.pow(v - my, 2), 0);
        const ssRes = ly.reduce(
          (s, v, i) => s + Math.pow(v - (my + slope * (lx[i] - mx)), 2),
          0
        );
        rSquared = ssTot > 0 ? Number(Math.max(0, 1 - ssRes / ssTot).toFixed(3)) : 0;
      }
    }
    const maxN = Math.max(10, ...Object.keys(frequencyOfFrequencies).map(Number));
    const samplePoints = Array.from({ length: Math.min(maxN, 15) }, (_, i) => i + 1);
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
        papers: n + (n > 1 ? " documents" : " document"),
        observedCount: observed,
        theoreticalCount,
        observedFraction: obsProp,
        theoreticalFraction: theoreticalProp,
        deviation: Number((obsProp - theoreticalProp).toFixed(2)),
      };
    });
    return {
      totalAuthors,
      authorsWithOnePaper,
      singlePaperPct,
      betaExponent,
      rSquared,
      cConstant: Number(cConstant.toFixed(3)),
      data,
    };
  }, [documents]);

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

    const totalSourcesCount = sorted.length;
    return {
      totalSourcesCount,
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

  const currentSubTabs = SUB_TABS_MAP[activeSubTab] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700">
              Descriptive & Entity Analytics
            </span>
          </div>

          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
            Descriptive & Entity Analytics Studio
          </h1>

          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
            Unified corpus-level bibliometrics, actor & entity intelligence, Lotka & Bradford laws, geographic mapping, citation velocity, and collaboration impact.
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
        <aside
          aria-label="Corpus analysis methods"
          className="rounded-2xl border border-border-default bg-surface-canvas p-3 shadow-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <h2 className="sciai-kicker px-2 pb-2">Analysis methods</h2>

          <nav className="space-y-1">
            {LOCAL_ANALYSES.map((item) => {
              const Icon = item.icon;
              const selected = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => selectMainMenu(item.id)}
                  disabled={running}
                  className={
                    "flex w-full cursor-pointer items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-wait " +
                    (selected
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary")
                  }
                >
                  <Icon
                    className={
                      "mt-0.5 h-3.5 w-3.5 shrink-0 " +
                      (selected ? "text-white" : "text-ink-subtle")
                    }
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-5" aria-live="polite">
          {runError && <AlertBanner tone="danger">{runError}</AlertBanner>}

          {currentSubTabs.length > 1 && (
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-border-default bg-surface-subtle p-1.5">
              {currentSubTabs.map((t) => {
                const active = innerSubView === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={running}
                    onClick={() => selectInnerSubTab(t.id)}
                    className={
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all " +
                      (active
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary")
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {((innerSubView.startsWith("entity:") && innerSubView !== "entity:keywords") ||
            innerSubView.startsWith("entitymodel:")) && (
            <EntityExplorerStudio
              datasets={datasets}
              selectedDatasetId={activeDatasetId}
              onSelectDataset={selectDataset}
              onQuickRun={onQuickRun}
              embedded={true}
              externalDimension={
                (innerSubView.startsWith("entity:") && innerSubView !== "entity:keywords")
                  ? (innerSubView.replace("entity:", "") as any)
                  : undefined
              }
              externalModelId={
                innerSubView.startsWith("entitymodel:")
                  ? innerSubView.replace("entitymodel:", "")
                  : undefined
              }
            />
          )}

          {activeSubTab === "overview" && (
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
                        Journal Documents, Reviews, Conference
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
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
                        name="Published Documents"
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

          {activeSubTab === "keywords" && innerSubView === "local:coword_graph" && (
            <AssociationRulesGraph documents={documents} />
          )}

          {activeSubTab === "citations" && innerSubView === "local:citations_overview" && (
            <CitationGraphicalSummary documents={documents} />
          )}


          {activeSubTab === "grants" && innerSubView === "local:grants_overview" && (
            <div className="space-y-6">
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
                          <th className="p-2.5 text-right">Funded Documents</th>
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

          {activeSubTab === "authors" && innerSubView === "local:lotka" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card padding="md">
                  <div className="sciai-kicker">Total Unique Authors</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {lotkaAnalysis.totalAuthors.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">Distinct contributors in corpus</div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Occasional Authors (1 Document)</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {lotkaAnalysis.singlePaperPct}%
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {lotkaAnalysis.authorsWithOnePaper} authors (Classic benchmark: ~60%)
                  </div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Fitted Lotka Exponent (β)</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {lotkaAnalysis.betaExponent}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    OLS Log-Log slope (Inverse square = 2.0)
                  </div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Model Fit (R²) & Constant (C)</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {lotkaAnalysis.rSquared}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    Constant C = {lotkaAnalysis.cConstant}
                  </div>
                </Card>
              </div>
              <Card padding="lg" className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Lotka's Law of Scientific Productivity (Empirical vs. Fitted Model)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Comparing observed author frequency distribution against fitted power-law model f(x) = {lotkaAnalysis.cConstant} / x^{lotkaAnalysis.betaExponent}.
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
                        name="Fitted Theoretical Model"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card padding="lg" className="space-y-4">
                <h3 className="text-sm font-bold text-ink-primary">
                  Author Productivity Distribution Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-default text-ink-secondary">
                        <th className="py-2 pr-4 font-semibold">Productivity Level</th>
                        <th className="py-2 px-4 font-semibold">Observed Authors</th>
                        <th className="py-2 px-4 font-semibold">Observed Share (%)</th>
                        <th className="py-2 px-4 font-semibold">Theoretical Authors</th>
                        <th className="py-2 px-4 font-semibold">Theoretical Share (%)</th>
                        <th className="py-2 pl-4 font-semibold">Deviation (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {lotkaAnalysis.data.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-4 font-medium text-ink-primary">{row.papers}</td>
                          <td className="py-2 px-4 tabular-metrics">{row.observedCount}</td>
                          <td className="py-2 px-4 tabular-metrics">{row.observedFraction}%</td>
                          <td className="py-2 px-4 tabular-metrics">{row.theoreticalCount}</td>
                          <td className="py-2 px-4 tabular-metrics">{row.theoreticalFraction}%</td>
                          <td className="py-2 pl-4 tabular-metrics">
                            {row.deviation > 0 ? "+" + row.deviation : row.deviation}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeSubTab === "sources" && innerSubView === "local:bradford" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card padding="md">
                  <div className="sciai-kicker">Total Unique Journals</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {bradfordAnalysis.totalSourcesCount ||
                      bradfordAnalysis.coreSourcesCount +
                        bradfordAnalysis.zone2Count +
                        bradfordAnalysis.zone3Count}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">Distinct publication sources</div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Bradford Multiplier (k)</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {bradfordAnalysis.kMultiplier}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">Zone expansion factor (1 : k : k²)</div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Zone Ratio (1 : n : n²)</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {bradfordAnalysis.coreSourcesCount} : {bradfordAnalysis.zone2Count} :{" "}
                    {bradfordAnalysis.zone3Count}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">Empirical journal distribution</div>
                </Card>
                <Card padding="md">
                  <div className="sciai-kicker">Core Concentration</div>
                  <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                    {Math.round(
                      (bradfordAnalysis.coreSourcesCount /
                        Math.max(
                          1,
                          bradfordAnalysis.coreSourcesCount +
                            bradfordAnalysis.zone2Count +
                            bradfordAnalysis.zone3Count
                        )) *
                        100
                    )}
                    %
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">Journals producing ~33% of corpus</div>
                </Card>
              </div>

              <Card padding="lg" className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Bradford Scattering Curve (Cumulative Documents by Journal Rank)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Cumulative growth of literature across ranked journals illustrating core concentration and long-tail dispersion.
                  </p>
                </div>
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={bradfordAnalysis.topJournals}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8e4" />
                      <XAxis dataKey="rank" stroke="#828d98" fontSize={11} />
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
                      <Area
                        type="monotone"
                        dataKey="cumulativeArticles"
                        stroke="#315C7C"
                        fill="#89B2D1"
                        fillOpacity={0.35}
                        name="Cumulative Documents"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {bradfordAnalysis.zones.map((z, idx) => (
                  <Card key={idx} padding="md">
                    <div className="sciai-kicker">{z.name}</div>
                    <div className="tabular-metrics mt-2 text-2xl font-black text-ink-primary">
                      {z.sources} journals
                    </div>
                    <div className="tabular-metrics mt-1 text-xs text-ink-muted">
                      {z.articles} documents (~33% corpus)
                    </div>
                  </Card>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                <h3 className="text-sm font-bold text-ink-primary">
                  Journal Scattering & Bradford Zones Ranking
                </h3>

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
                          <strong className="text-ink-primary">{j.articles}</strong> documents
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

          {focusedAnalysis && (
            <div key={focusedAnalysis.id}>
              <AnalysisResultPanel
                analysis={focusedAnalysis}
                onRefresh={refreshAnalysis}
              />
              {activeSubTab === "keywords" && (
                <AssociationRulesGraph documents={documents} />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}