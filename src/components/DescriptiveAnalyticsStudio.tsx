import React, { useState, useEffect, useMemo } from "react";
import { Dataset, BibliometricDocument, Analysis } from "../types.js";
import {
  BarChart3,
  TrendingUp,
  BookOpen,
  Users,
  Award,
  Calendar,
  Sparkles,
  Download,
  Info,
  Database,
  ArrowUpRight,
  Filter,
  Layers,
  Scale,
  Building2,
  Landmark,
  Coins,
  BadgePercent,
  CheckCircle2,
  PieChart as PieIcon,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
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

type LocalAnalysisId = typeof LOCAL_ANALYSES[number]["id"];

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

  // Overview is visible immediately when the studio opens.
  const [completedLocal, setCompletedLocal] =
    useState<LocalAnalysisId | null>("overview");

  const [focusedAnalysis, setFocusedAnalysis] =
    useState<Analysis | null>(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    setDocuments([]);
    setFocusedAnalysis(null);
    setRunError("");

    // Keep the currently selected local analysis visible after changing dataset.
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

    fetch(
      `/api/datasets/${currentDataset.id}/documents?limit=5000`,
      { signal: controller.signal }
    )
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

        setDocumentsError(
          "Unable to load documents for this dataset."
        );

        console.warn("Error fetching documents:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentDataset?.id]);

  /*
   * Keep selectedModel because it is still required by the
   * AnalysisResultPanel section at the bottom.
   */
  const selectedModel = CORPUS_MODELS.find(
    (item) => item.id === activeModelId
  );

  /*
   * Clicking an analysis now immediately activates/runs it.
   *
   * Local analysis:
   *   - switches the visible local result immediately
   *
   * Corpus model:
   *   - calls onQuickRun immediately
   */
  const selectAnalysis = async (
    id: string,
    local: boolean
  ) => {
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
      const result = await onQuickRun(
        id,
        currentDataset.id
      );

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

  /*
   * Refresh only the currently selected corpus model.
   * This is used by AnalysisResultPanel.
   */
  const refreshAnalysis = async () => {
    if (
      !activeModelId ||
      !currentDataset?.id ||
      running
    ) {
      return;
    }

    setRunning(true);
    setRunError("");

    try {
      const result = await onQuickRun(
        activeModelId,
        currentDataset.id
      );

      if (result) {
        setFocusedAnalysis(result);
      } else {
        setRunError(
          "The analysis could not be completed. Check the message above for details."
        );
      }
    } catch (error) {
      console.error(
        "Corpus analysis refresh failed:",
        error
      );

      setRunError(
        "The analysis could not be completed."
      );
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
      totalCitations += Number(
        d.citations ?? d.TC ?? 0
      );

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

      const src = (
        d.source ||
        d.SO ||
        ""
      ).trim();

      if (src) {
        allSources.add(src);
      }
    });

    const totalDocs = documents.length;

    const avgCitationsPerDoc = Number(
      (
        totalCitations /
        (totalDocs || 1)
      ).toFixed(2)
    );

    const span = Math.max(
      1,
      maxYear - minYear
    );

    const annualGrowthRate = Number(
      (
        (Math.pow(totalDocs, 1 / span) - 1) *
        100
      ).toFixed(2)
    );

    const multiAuthorDocs = Math.max(
      1,
      totalDocs - singleAuthorCount
    );

    const collaborationIndex = Number(
      (
        (allAuthors.size - singleAuthorCount) /
        multiAuthorDocs
      ).toFixed(2)
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

  // Longitudinal Trends Data (Annual Production & Mean Citations)
  const longitudinalData = useMemo(() => {
    const yearMap: Record<
      number,
      { count: number; citations: number }
    > = {};

    documents.forEach((d: any) => {
      const yr = Number(d.year || d.PY);

      if (yr >= 1990 && yr <= 2030) {
        if (!yearMap[yr]) {
          yearMap[yr] = {
            count: 0,
            citations: 0,
          };
        }

        yearMap[yr].count++;
        yearMap[yr].citations += Number(
          d.citations ?? d.TC ?? 0
        );
      }
    });

    return Object.entries(yearMap)
      .map(([yr, data]) => ({
        year: yr,
        articles: data.count,
        meanCitations: Number(
          (
            data.citations /
            (data.count || 1)
          ).toFixed(2)
        ),
      }))
      .sort(
        (a, b) =>
          Number(a.year) -
          Number(b.year)
      );
  }, [documents]);

  // Citation Distribution Buckets
  const citationBuckets = useMemo(() => {
    const buckets = [
      {
        range: "0 Citations",
        min: 0,
        max: 0,
        count: 0,
      },
      {
        range: "1-5 Citations",
        min: 1,
        max: 5,
        count: 0,
      },
      {
        range: "6-20 Citations",
        min: 6,
        max: 20,
        count: 0,
      },
      {
        range: "21-50 Citations",
        min: 21,
        max: 50,
        count: 0,
      },
      {
        range: "51-100 Citations",
        min: 51,
        max: 100,
        count: 0,
      },
      {
        range: "100+ Citations",
        min: 101,
        max: Infinity,
        count: 0,
      },
    ];

    documents.forEach((d: any) => {
      const c = Number(
        d.citations ?? d.TC ?? 0
      );

      const b = buckets.find(
        (bucket) =>
          c >= bucket.min &&
          c <= bucket.max
      );

      if (b) {
        b.count++;
      }
    });

    return buckets.map((b) => ({
      range: b.range,
      count: b.count,
      percentage: Number(
        (
          (b.count /
            (documents.length || 1)) *
          100
        ).toFixed(1)
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

    const currentYear =
      new Date().getFullYear();

    const years = documents
      .map((d: any) =>
        Number(d.year || d.PY)
      )
      .filter(
        (y) =>
          !isNaN(y) &&
          y > 1800 &&
          y <= currentYear + 1
      );

    const obsYear = years.length
      ? Math.min(
          currentYear,
          Math.max(...years)
        )
      : currentYear;

    documents.forEach((d: any) => {
      const yr = Number(
        d.year || d.PY
      );

      const cits = Number(
        d.citations ?? d.TC ?? 0
      );

      if (
        isNaN(yr) ||
        yr < 1800 ||
        yr > obsYear
      ) {
        excluded++;
      } else {
        eligible++;

        const delta = Math.max(
          1.0,
          obsYear - yr + 1.0
        );

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
        eligible > 0
          ? Number(
              (
                totalRate /
                eligible
              ).toFixed(2)
            )
          : 0,
      weightedCorpusVelocity:
        totalExposure > 0
          ? Number(
              (
                totalCits /
                totalExposure
              ).toFixed(2)
            )
          : 0,
    };
  }, [documents]);

  // Research Grants & Funding Stats (WoS FU/FX & Scopus Funding)
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

    const agencyMap: Record<
      string,
      { count: number; citations: number }
    > = {};

    const grantMap: Record<
      string,
      {
        count: number;
        agencies: Set<string>;
      }
    > = {};

    const yearFundingMap: Record<
      number,
      {
        year: number;
        funded: number;
        nonFunded: number;
      }
    > = {};

    documents.forEach((d: any) => {
      const yr =
        Number(d.year || d.PY) ||
        2023;

      const cits = Number(
        d.citations ?? d.TC ?? 0
      );

      const agencies: string[] =
        Array.isArray(d.funding_agencies)
          ? d.funding_agencies
          : [];

      const grants: string[] =
        Array.isArray(d.grant_numbers)
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
        yearFundingMap[yr] = {
          year: yr,
          funded: 0,
          nonFunded: 0,
        };
      }

      if (hasFunding) {
        fundedDocs++;
        fundedCitations += cits;
        yearFundingMap[yr].funded++;

        const allAgencies = Array.from(
          new Set([
            ...agencies,
            ...fu.map((s: string) =>
              s
                .split("[")[0]
                .trim()
            ),
          ])
        ).filter(
          (s) =>
            s &&
            s.length > 2
        );

        allAgencies.forEach(
          (ag) => {
            if (!agencyMap[ag]) {
              agencyMap[ag] = {
                count: 0,
                citations: 0,
              };
            }

            agencyMap[ag].count++;
            agencyMap[ag].citations +=
              cits;
          }
        );

        grants.forEach((gr) => {
          const gStr = String(gr).trim();

          if (!grantMap[gStr]) {
            grantMap[gStr] = {
              count: 0,
              agencies: new Set(),
            };
          }

          grantMap[gStr].count++;

          allAgencies.forEach((a) =>
            grantMap[gStr].agencies.add(
              a
            )
          );
        });
      } else {
        unfundedCitations += cits;
        yearFundingMap[yr].nonFunded++;
      }
    });

    const unfundedDocs =
      documents.length - fundedDocs;

    const coverageRate = Number(
      (
        (fundedDocs /
          documents.length) *
        100
      ).toFixed(1)
    );

    const avgFunded =
      fundedDocs > 0
        ? Number(
            (
              fundedCitations /
              fundedDocs
            ).toFixed(1)
          )
        : 0;

    const avgUnfunded =
      unfundedDocs > 0
        ? Number(
            (
              unfundedCitations /
              (unfundedDocs || 1)
            ).toFixed(1)
          )
        : 0;

    const topAgencies =
      Object.entries(agencyMap)
        .map(([agency, val]) => ({
          agency,
          documents: val.count,
          totalCitations:
            val.citations,
          avgCitations: Number(
            (
              val.citations /
              (val.count || 1)
            ).toFixed(1)
          ),
        }))
        .sort(
          (a, b) =>
            b.documents -
            a.documents
        )
        .slice(0, 15);

    const topGrants =
      Object.entries(grantMap)
        .map(([grant, val]) => ({
          grant,
          documents: val.count,
          agencies:
            Array.from(
              val.agencies
            )
              .slice(0, 2)
              .join(", ") ||
            "Grant Award",
        }))
        .sort(
          (a, b) =>
            b.documents -
            a.documents
        )
        .slice(0, 15);

    const fundingByYear =
      Object.values(
        yearFundingMap
      ).sort(
        (a, b) =>
          a.year - b.year
      );

    return {
      fundedDocs,
      unfundedDocs,
      fundingCoverageRate:
        coverageRate,
      totalFundingAgencies:
        Object.keys(
          agencyMap
        ).length,
      totalGrantNumbers:
        Object.keys(
          grantMap
        ).length,
      fundedCitations,
      unfundedCitations,
      avgCitationsFunded:
        avgFunded,
      avgCitationsUnfunded:
        avgUnfunded,
      topAgencies,
      topGrants,
      fundingByYear,
    };
  }, [documents]);

  // Organizational Affiliations & Institutional Productivity
  const institutionalStats =
    useMemo(() => {
      const instMap: Record<
        string,
        {
          count: number;
          citations: number;
          countries: Set<string>;
        }
      > = {};

      let multiInstitutionDocs = 0;

      const extractInsts = (
        raw: any
      ): string[] => {
        if (!raw) return [];

        if (Array.isArray(raw)) {
          return raw.flatMap((i) =>
            extractInsts(i)
          );
        }

        return String(raw)
          .split(";")
          .map((item) => {
            let cleaned = item
              .replace(
                /\[.*?\]/g,
                ""
              )
              .trim();

            const parts =
              cleaned.split(",");

            let primary =
              parts[0]?.trim() ||
              "";

            if (
              /^(dept|department|fac|faculty|inst|institute|centre|center|school) of\s+/i.test(
                primary
              )
            ) {
              if (
                parts[1] &&
                parts[1].trim()
                  .length > 3
              ) {
                primary =
                  parts[1].trim();
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
          .filter(
            (s) =>
              s &&
              s.length > 2 &&
              !/^\d+$/.test(s)
          );
      };

      documents.forEach(
        (d: any) => {
          const cits = Number(
            d.citations ??
              d.TC ??
              0
          );

          const insts =
            Array.from(
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

          if (
            insts.length > 1
          ) {
            multiInstitutionDocs++;
          }

          insts.forEach(
            (inst) => {
              if (!instMap[inst]) {
                instMap[inst] = {
                  count: 0,
                  citations: 0,
                  countries:
                    new Set(),
                };
              }

              instMap[inst].count++;
              instMap[
                inst
              ].citations += cits;
            }
          );
        }
      );

      const topInstitutions =
        Object.entries(instMap)
          .map(
            ([
              institution,
              val,
            ]) => ({
              institution,
              documents:
                val.count,
              citations:
                val.citations,
              avgCitations:
                Number(
                  (
                    val.citations /
                    (val.count ||
                      1)
                  ).toFixed(1)
                ),
            })
          )
          .sort(
            (a, b) =>
              b.documents -
              a.documents
          )
          .slice(0, 15);

      const collaborationRate =
        documents.length
          ? Number(
              (
                (multiInstitutionDocs /
                  documents.length) *
                100
              ).toFixed(1)
            )
          : 0;

      return {
        totalInstitutions:
          Object.keys(
            instMap
          ).length,
        topInstitutions,
        multiInstitutionDocs,
        collaborationRate,
      };
    }, [documents]);

  // Lotka's Law Empirical vs Theoretical Model
  const lotkaAnalysis = useMemo(() => {
    const authorDocCount: Record<
      string,
      number
    > = {};

    documents.forEach(
      (d: any) => {
        const authorsList: string[] =
          Array.isArray(d.authors)
            ? d.authors
            : Array.isArray(d.AU)
            ? d.AU
            : typeof d.author ===
              "string"
            ? d.author.split(";")
            : [];

        authorsList.forEach(
          (a) => {
            const trimmed =
              a.trim();

            if (trimmed) {
              authorDocCount[
                trimmed
              ] =
                (authorDocCount[
                  trimmed
                ] || 0) + 1;
            }
          }
        );
      }
    );

    const totalAuthors =
      Object.keys(
        authorDocCount
      ).length || 1;

    const frequencyOfFrequencies: Record<
      number,
      number
    > = {};

    Object.values(
      authorDocCount
    ).forEach((cnt) => {
      frequencyOfFrequencies[
        cnt
      ] =
        (frequencyOfFrequencies[
          cnt
        ] || 0) + 1;
    });

    const authorsWithOnePaper =
      frequencyOfFrequencies[1] ||
      0;

    const cConstant =
      authorsWithOnePaper /
        totalAuthors || 0.6;

    const betaExponent = 2.0;

    const samplePoints = [
      1, 2, 3, 4, 5,
      6, 7, 8, 9, 10,
    ];

    const data =
      samplePoints.map((n) => {
        const observed =
          frequencyOfFrequencies[
            n
          ] || 0;

        const obsProp = Number(
          (
            (observed /
              totalAuthors) *
            100
          ).toFixed(2)
        );

        const theoreticalProp =
          Number(
            (
              (cConstant /
                Math.pow(
                  n,
                  betaExponent
                )) *
              100
            ).toFixed(2)
          );

        const theoreticalCount =
          Math.round(
            (cConstant /
              Math.pow(
                n,
                betaExponent
              )) *
              totalAuthors
          );

        return {
          papers: `${n} paper${
            n > 1 ? "s" : ""
          }`,
          observedCount:
            observed,
          theoreticalCount,
          observedFraction:
            obsProp,
          theoreticalFraction:
            theoreticalProp,
        };
      });

    return {
      totalAuthors,
      betaExponent,
      cConstant: Number(
        cConstant.toFixed(3)
      ),
      data,
    };
  }, [documents]);

  // Bradford's Law Analysis
  const bradfordAnalysis =
    useMemo(() => {
      const journalCounts: Record<
        string,
        number
      > = {};

      documents.forEach(
        (d: any) => {
          const src = (
            d.source ||
            d.SO ||
            ""
          ).trim();

          if (src) {
            journalCounts[src] =
              (journalCounts[
                src
              ] || 0) + 1;
          }
        }
      );

      const sorted =
        Object.entries(
          journalCounts
        )
          .map(
            ([
              journal,
              articles,
            ]) => ({
              journal,
              articles,
            })
          )
          .sort(
            (a, b) =>
              b.articles -
              a.articles
          );

      const totalArticles =
        documents.length || 1;

      const targetPerZone =
        Math.floor(
          totalArticles / 3
        );

      let cumArticles = 0;
      let currentZone = 1;
      let zone1Count = 0;
      let zone2Count = 0;
      let zone3Count = 0;

      const enriched =
        sorted.map(
          (item, idx) => {
            cumArticles +=
              item.articles;

            const cumPct =
              Math.round(
                (cumArticles /
                  totalArticles) *
                  100
              );

            if (
              cumArticles <=
              targetPerZone
            ) {
              currentZone = 1;
              zone1Count++;
            } else if (
              cumArticles <=
              targetPerZone * 2
            ) {
              currentZone = 2;
              zone2Count++;
            } else {
              currentZone = 3;
              zone3Count++;
            }

            return {
              rank: idx + 1,
              journal:
                item.journal,
              articles:
                item.articles,
              cumulativeArticles:
                cumArticles,
              cumulativePercentage:
                cumPct,
              zone: currentZone,
            };
          }
        );

      const kMultiplier =
        zone1Count > 0
          ? Number(
              (
                zone2Count /
                zone1Count
              ).toFixed(2)
            )
          : 3.1;

      return {
        coreSourcesCount:
          zone1Count,
        zone2Count,
        zone3Count,
        kMultiplier,
        zones: [
          {
            name:
              "Zone 1 (Nuclear Core)",
            sources:
              zone1Count,
            articles:
              enriched
                .filter(
                  (i) =>
                    i.zone ===
                    1
                )
                .reduce(
                  (acc, i) =>
                    acc +
                    i.articles,
                  0
                ),
          },
          {
            name:
              "Zone 2 (Extension)",
            sources:
              zone2Count,
            articles:
              enriched
                .filter(
                  (i) =>
                    i.zone ===
                    2
                )
                .reduce(
                  (acc, i) =>
                    acc +
                    i.articles,
                  0
                ),
          },
          {
            name:
              "Zone 3 (Periphery)",
            sources:
              zone3Count,
            articles:
              enriched
                .filter(
                  (i) =>
                    i.zone ===
                    3
                )
                .reduce(
                  (acc, i) =>
                    acc +
                    i.articles,
                  0
                ),
          },
        ],
        topJournals:
          enriched.slice(
            0,
            15
          ),
      };
    }, [documents]);

  return (
    <div className="space-y-6">
      {/* Top Header & Corpus Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-700">
              Descriptive Analytics
            </span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Descriptive Analytics Studio
          </h1>

          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Corpus-level bibliometrics, research grants (WoS & Scopus), institutional affiliations, growth trends, citation distribution, Lotka & Bradford laws, and capability models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
            <Database className="h-3.5 w-3.5 text-slate-400" />

            <select
              value={
                currentDataset?.id ||
                ""
              }
              onChange={(e) =>
                selectDataset(
                  e.target.value
                )
              }
              disabled={
                running ||
                !datasets.length
              }
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
            >
              {datasets.map(
                (d) => (
                  <option
                    key={d.id}
                    value={d.id}
                  >
                    {d.name} (
                    {d.record_count.toLocaleString()}{" "}
                    docs)
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(215px,250px)_minmax(0,1fr)]">
        {/* ============================================================
            FLAT ANALYSIS SIDEBAR
           ============================================================ */}
        <aside
          aria-label="Corpus analysis methods"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Analysis methods
          </h2>

          <nav className="space-y-0.5">
            {[
              ...LOCAL_ANALYSES.map(
                (item) => ({
                  ...item,
                  local: true as const,
                })
              ),

              ...CORPUS_MODELS.map(
                (item) => ({
                  ...item,
                  local: false as const,
                })
              ),
            ].map((item) => {
              const Icon =
                item.icon;

              const selected =
                item.local
                  ? activeSubTab ===
                    item.id
                  : activeModelId ===
                    item.id;

              return (
                <button
                  key={`${item.local ? "view" : "model"}-${item.id}`}
                  type="button"
                  aria-current={
                    selected
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    selectAnalysis(
                      item.id,
                      item.local
                    )
                  }
                  disabled={running}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold transition disabled:cursor-wait ${
                    selected
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <span>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section
          className="min-w-0 space-y-5"
          aria-live="polite"
        >
          {/* Analysis execution errors */}
          {runError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
            >
              {runError}
            </div>
          )}

          {/* ==========================================================
              SUB-TAB 1: GLOBAL COLLECTION METRICS
             ========================================================== */}
          {activeSubTab ===
            "overview" &&
            completedLocal ===
              "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Timespan Covered
                    </div>

                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {
                        macroStats.timespan
                      }
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Historical publication span
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total Documents
                    </div>

                    <div className="mt-2 text-2xl font-black text-blue-600">
                      {macroStats.totalDocs.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Peer-reviewed records
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Avg Citations / Doc
                    </div>

                    <div className="mt-2 text-2xl font-black text-emerald-600">
                      {
                        macroStats.avgCitationsPerDoc
                      }
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Total citations:{" "}
                      {macroStats.totalCitations.toLocaleString()}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Annual Growth Rate
                    </div>

                    <div className="mt-2 text-2xl font-black text-purple-600">
                      +
                      {
                        macroStats.annualGrowthRate
                      }
                      %
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      CAGR across corpus
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Authors & Collaboration Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      Authors & Collaboration Index
                    </h2>

                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Total Unique Authors
                        </span>

                        <span className="font-bold text-slate-800">
                          {macroStats.authorsCount.toLocaleString()}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Single-authored Documents
                        </span>

                        <span className="font-bold text-slate-800">
                          {macroStats.singleAuthorDocs.toLocaleString()}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Co-Authors per Document
                        </span>

                        <span className="font-bold text-slate-800">
                          {macroStats.totalDocs
                            ? (
                                macroStats.authorsCount /
                                macroStats.totalDocs
                              ).toFixed(2)
                            : 0}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Collaboration Index (CI)
                        </span>

                        <span className="font-bold text-emerald-600">
                          {
                            macroStats.collaborationIndex
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sources & Venues Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-emerald-600" />
                      Sources & Publishing Venues
                    </h2>

                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Total Unique Journals / Sources
                        </span>

                        <span className="font-bold text-slate-800">
                          {macroStats.sourcesCount.toLocaleString()}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Documents per Source (Avg)
                        </span>

                        <span className="font-bold text-slate-800">
                          {macroStats.sourcesCount
                            ? (
                                macroStats.totalDocs /
                                macroStats.sourcesCount
                              ).toFixed(1)
                            : 0}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-500">
                          Primary Document Formats
                        </span>

                        <span className="font-bold text-slate-800">
                          Journal Articles, Reviews, Conference
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 2: ANNUAL PRODUCTION & TRENDS
             ========================================================== */}
          {activeSubTab ===
            "trends" &&
            completedLocal ===
              "trends" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Publication Trajectory
                      </h3>

                      <p className="text-xs text-slate-500">
                        Annual publication distribution and citation velocity for the active corpus.
                      </p>
                    </div>
                  </div>

                  <div className="h-80 w-full pt-4">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={
                          longitudinalData
                        }
                        margin={{
                          top: 10,
                          right: 30,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="colorArticles"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={
                                0.4
                              }
                            />

                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={
                                0.0
                              }
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                        />

                        <XAxis
                          dataKey="year"
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              "#0f172a",
                            borderRadius:
                              "8px",
                            border: "none",
                            fontSize:
                              "11px",
                            color:
                              "#fff",
                          }}
                        />

                        <Legend />

                        <Area
                          type="monotone"
                          dataKey="articles"
                          stroke="#2563eb"
                          fillOpacity={1}
                          fill="url(#colorArticles)"
                          name="Published Articles"
                        />

                        <Line
                          type="monotone"
                          dataKey="meanCitations"
                          stroke="#10b981"
                          strokeWidth={2}
                          name="Mean Citations / Doc"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 3: CITATION DISTRIBUTION
             ========================================================== */}
          {activeSubTab ===
            "citations" &&
            completedLocal ===
              "citations" && (
              <div className="space-y-6">
                {/* Citation Opportunity & Window Adjustment KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Raw Citations (CPP)
                      </span>

                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                        Calculated
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {
                        macroStats.avgCitationsPerDoc
                      }
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Total citations / total documents
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                        Window Velocity
                      </span>

                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                        Window-Adjusted
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-black text-indigo-950">
                      {windowMetrics?.windowAdjustedMeanVelocity != null
                        ? `${windowMetrics.windowAdjustedMeanVelocity}/yr`
                        : "Unavailable"}
                    </div>

                    <div className="mt-1 text-[11px] text-indigo-600/70">
                      Mean citations per exposure-year
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Weighted Velocity
                      </span>

                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                        Window-Adjusted
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {windowMetrics?.weightedCorpusVelocity != null
                        ? `${windowMetrics.weightedCorpusVelocity}/yr`
                        : "Unavailable"}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Total citations / total exposure years
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Field Normalized
                      </span>

                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                        Unavailable
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-bold text-amber-950">
                      Reference Missing
                    </div>

                    <div className="mt-1 text-[11px] text-amber-700/80">
                      No external baseline population
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Citation Distribution & Power Law Skewness
                    </h3>

                    <p className="text-xs text-slate-500">
                      Segmenting papers into citation brackets to identify uncited vs highly cited breakthrough works.
                    </p>
                  </div>

                  <div className="h-72 w-full pt-4">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          citationBuckets
                        }
                        margin={{
                          top: 10,
                          right: 30,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                        />

                        <XAxis
                          dataKey="range"
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              "#0f172a",
                            borderRadius:
                              "8px",
                            border: "none",
                            fontSize:
                              "11px",
                            color:
                              "#fff",
                          }}
                        />

                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                          name="Document Count"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Explanatory note */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />

                    <div>
                      <span className="font-bold text-slate-800">
                        Longitudinal Opportunity Window:{" "}
                      </span>

                      <span>
                        Observation year cutoff:{" "}
                        {windowMetrics?.obsYear ??
                          "Auto"}
                        . Exposure elapsed time is defined as (Cutoff - Publication Year) + 1.0 calendar years (
                        {windowMetrics?.eligible ??
                          0}{" "}
                        eligible papers). Disciplinary field normalization (MNCS) is preserved as unavailable without external reference baselines.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 4: RESEARCH GRANTS & FUNDING
             ========================================================== */}
          {activeSubTab ===
            "grants" &&
            completedLocal ===
              "grants" && (
              <div className="space-y-6">
                {/* Funding KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Funded Research
                    </div>

                    <div className="mt-2 text-2xl font-black text-amber-600">
                      {grantFundingStats.fundedDocs.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      {
                        grantFundingStats.fundingCoverageRate
                      }
                      % coverage rate
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Funding Agencies
                    </div>

                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {grantFundingStats.totalFundingAgencies.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Distinct sponsors identified
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Grant Numbers
                    </div>

                    <div className="mt-2 text-2xl font-black text-blue-600">
                      {grantFundingStats.totalGrantNumbers.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Unique grant/award IDs
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Funded Citation Advantage
                    </div>

                    <div className="mt-2 text-2xl font-black text-emerald-600">
                      {
                        grantFundingStats.avgCitationsFunded
                      }{" "}
                      vs{" "}
                      {
                        grantFundingStats.avgCitationsUnfunded
                      }
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Funded vs Non-funded avg citations
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Funding Agencies Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-amber-600" />
                        Top Funding Agencies & Sponsors
                      </h3>

                      <span className="text-xs text-slate-400">
                        WoS FU & Scopus Funding
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="p-2.5">
                              Funding Agency
                            </th>
                            <th className="p-2.5 text-right">
                              Funded Papers
                            </th>
                            <th className="p-2.5 text-right">
                              Total Cits
                            </th>
                            <th className="p-2.5 text-right">
                              Avg Cits
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {grantFundingStats.topAgencies.map(
                            (
                              ag: any,
                              i: number
                            ) => (
                              <tr
                                key={i}
                                className="hover:bg-slate-50/80"
                              >
                                <td className="p-2.5 font-bold text-slate-800 line-clamp-1 max-w-[200px]">
                                  {
                                    ag.agency
                                  }
                                </td>

                                <td className="p-2.5 text-right font-mono text-slate-900 font-semibold">
                                  {
                                    ag.documents
                                  }
                                </td>

                                <td className="p-2.5 text-right font-mono text-emerald-600">
                                  {
                                    ag.totalCitations
                                  }
                                </td>

                                <td className="p-2.5 text-right font-mono text-blue-600 font-bold">
                                  {
                                    ag.avgCitations
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top Grant Numbers */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Coins className="h-4 w-4 text-blue-600" />
                        Top Grant / Award Contracts
                      </h3>

                      <span className="text-xs text-slate-400">
                        Award Identification
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="p-2.5">
                              Grant / Award #
                            </th>
                            <th className="p-2.5 text-right">
                              Publications
                            </th>
                            <th className="p-2.5">
                              Associated Sponsor
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {grantFundingStats.topGrants.map(
                            (
                              gr: any,
                              i: number
                            ) => (
                              <tr
                                key={i}
                                className="hover:bg-slate-50/80"
                              >
                                <td className="p-2.5 font-mono font-bold text-slate-800">
                                  #
                                  {
                                    gr.grant
                                  }
                                </td>

                                <td className="p-2.5 text-right font-mono text-slate-900 font-bold">
                                  {
                                    gr.documents
                                  }
                                </td>

                                <td className="p-2.5 text-slate-500 text-[11px] line-clamp-1 max-w-[180px]">
                                  {
                                    gr.agencies
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 5: AFFILIATIONS & INSTITUTIONS
             ========================================================== */}
          {activeSubTab ===
            "affiliations" &&
            completedLocal ===
              "affiliations" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total Affiliations
                    </div>

                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {institutionalStats.totalInstitutions.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Universities & Research Institutes
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Multi-Institutional Papers
                    </div>

                    <div className="mt-2 text-2xl font-black text-purple-600">
                      {institutionalStats.multiInstitutionDocs.toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Inter-organizational collaborations
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Collaboration Rate
                    </div>

                    <div className="mt-2 text-2xl font-black text-emerald-600">
                      {
                        institutionalStats.collaborationRate
                      }
                      %
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      Cross-institutional share
                    </div>
                  </div>
                </div>

                {/* Top Institutions Table */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Institutional Productivity Ranking (WoS C1 & Scopus)
                  </h3>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                        <tr>
                          <th className="p-3">
                            Rank
                          </th>

                          <th className="p-3">
                            Institution / University
                          </th>

                          <th className="p-3 text-right">
                            Publications
                          </th>

                          <th className="p-3 text-right">
                            Total Citations
                          </th>

                          <th className="p-3 text-right">
                            Avg Citations
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {institutionalStats.topInstitutions.map(
                          (
                            inst,
                            i
                          ) => (
                            <tr
                              key={i}
                              className="hover:bg-slate-50/80"
                            >
                              <td className="p-3 font-mono text-slate-400 w-8">
                                #
                                {i +
                                  1}
                              </td>

                              <td className="p-3 font-bold text-slate-800 line-clamp-1 max-w-[280px]">
                                {
                                  inst.institution
                                }
                              </td>

                              <td className="p-3 text-right font-mono text-slate-900 font-bold">
                                {
                                  inst.documents
                                }
                              </td>

                              <td className="p-3 text-right font-mono text-emerald-600">
                                {inst.citations.toLocaleString()}
                              </td>

                              <td className="p-3 text-right font-mono text-blue-600 font-bold">
                                {
                                  inst.avgCitations
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 6: LOTKA'S LAW
             ========================================================== */}
          {activeSubTab ===
            "lotka" &&
            completedLocal ===
              "lotka" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Lotka's Inverse Square Law of Scientific Productivity
                    </h3>

                    <p className="text-xs text-slate-500">
                      Comparing empirical author productivity vs theoretical prediction (f(x) = C / x^β).
                    </p>
                  </div>

                  <div className="h-80 w-full pt-4">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          lotkaAnalysis.data
                        }
                        margin={{
                          top: 10,
                          right: 30,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                        />

                        <XAxis
                          dataKey="papers"
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                        />

                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              "#0f172a",
                            borderRadius:
                              "8px",
                            border: "none",
                            fontSize:
                              "11px",
                            color:
                              "#fff",
                          }}
                        />

                        <Legend />

                        <Bar
                          dataKey="observedCount"
                          fill="#3b82f6"
                          name="Observed Authors"
                          radius={[
                            4,
                            4,
                            0,
                            0,
                          ]}
                        />

                        <Bar
                          dataKey="theoreticalCount"
                          fill="#94a3b8"
                          name="Theoretical Model"
                          radius={[
                            4,
                            4,
                            0,
                            0,
                          ]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              SUB-TAB 7: BRADFORD'S LAW
             ========================================================== */}
          {activeSubTab ===
            "bradford" &&
            completedLocal ===
              "bradford" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {bradfordAnalysis.zones.map(
                    (z, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {z.name}
                        </div>

                        <div className="mt-2 text-2xl font-black text-slate-900">
                          {z.sources}{" "}
                          journals
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {
                            z.articles
                          }{" "}
                          articles (~33% corpus)
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Zone 1: Core Nuclear Journals
                  </h3>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {bradfordAnalysis.topJournals.map(
                      (j) => (
                        <div
                          key={j.rank}
                          className="p-3 bg-white flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-400 w-5">
                              #
                              {
                                j.rank
                              }
                            </span>

                            <span className="font-bold text-slate-800">
                              {
                                j.journal
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-slate-600">
                            <span>
                              <strong>
                                {
                                  j.articles
                                }
                              </strong>{" "}
                              articles
                            </span>

                            <span className="text-slate-400">
                              (
                              {
                                j.cumulativePercentage
                              }
                              % cum.)
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                j.zone ===
                                1
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : j.zone ===
                                    2
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              Zone{" "}
                              {
                                j.zone
                              }
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* ==========================================================
              CORPUS MODEL RESULT
             ========================================================== */}
          {selectedModel &&
            focusedAnalysis && (
              <div
                key={
                  focusedAnalysis.id
                }
              >
                <AnalysisResultPanel
                  analysis={
                    focusedAnalysis
                  }
                  onRefresh={
                    refreshAnalysis
                  }
                />
              </div>
            )}
        </section>
      </div>
    </div>
  );
}