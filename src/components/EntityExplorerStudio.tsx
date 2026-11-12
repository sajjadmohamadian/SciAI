import React, { useState, useEffect, useMemo } from "react";
import { Dataset, BibliometricDocument, Analysis } from "../types.js";
import {
  Users,
  BookOpen,
  Building2,
  Globe2,
  FileText,
  Search,
  TrendingUp,
  Download,
  Database,
  ArrowUpDown,
  BarChart2,
  Hash,
  Landmark,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  SCIENTOMETRIC_MODELS,
  ENTITY_ANALYSIS_IDS,
} from "./AnalysesListView.js";
import { AnalysisResultPanel } from "./AnalysisResultPanel.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

const ENTITY_MODELS = SCIENTOMETRIC_MODELS.filter((model) =>
  ENTITY_ANALYSIS_IDS.has(model.id)
);

const LOCAL_ENTITY_ANALYSES = [
  {
    id: "authors",
    name: "Authors & Scholars",
    category: "Entity & Author Metrics",
    desc: "Author output, citation impact, h-index and g-index rankings.",
    icon: Users,
  },
  {
    id: "sources",
    name: "Sources & Journals",
    category: "Sources & Institutions",
    desc: "Publication venues ranked by output, citations and core zones.",
    icon: BookOpen,
  },
  {
    id: "institutions",
    name: "Affiliations / Institutions",
    category: "Sources & Institutions",
    desc: "Institutional affiliations aggregated by output and impact.",
    icon: Building2,
  },
  {
    id: "grants",
    name: "Research Grants & Funding",
    category: "Sources & Institutions",
    desc: "Funding agencies and grant identifiers observed in the corpus.",
    icon: Landmark,
  },
  {
    id: "keywords",
    name: "Keywords & Concepts",
    category: "Knowledge Structures",
    desc: "Author keywords and indexed descriptors across the corpus.",
    icon: Hash,
  },
  {
    id: "countries",
    name: "Countries & Territories",
    category: "Knowledge Structures",
    desc: "Geographic distribution of scholarly output.",
    icon: Globe2,
  },
  {
    id: "documents",
    name: "Core Documents",
    category: "Knowledge Structures",
    desc: "Core publication records with citations and sources.",
    icon: FileText,
  },
] as const;

type LocalEntityId = (typeof LOCAL_ENTITY_ANALYSES)[number]["id"];

const SELECTABLE_ENTITY_DIMENSIONS = new Set<string>(
  LOCAL_ENTITY_ANALYSES.map((item) => item.id)
);

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  focusDimension?: "authors" | "sources" | "institutions";
  focusKey?: string;
  onQuickRun: (capId: string, dsId: string) => Promise<Analysis | null>;
}

type EntityDimension =
  | "authors"
  | "sources"
  | "keywords"
  | "institutions"
  | "grants"
  | "countries"
  | "documents";

interface EntityMetric {
  id: string;
  name: string;
  docCount: number;
  totalCitations: number;
  avgCitations: number;
  hIndex: number;
  gIndex: number;
  firstYear: number;
  lastYear: number;
  annualProduction: Record<number, number>;
  matchedDocIndices: number[];
}

export function EntityExplorerStudio({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  focusDimension,
  focusKey,
  onQuickRun,
}: Props) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(
    selectedDatasetId || datasets[0]?.id || ""
  );

  const [dimension, setDimension] = useState<EntityDimension>(
    focusDimension || "authors"
  );

  const [searchQuery, setSearchQuery] = useState("");

  const [sortBy, setSortBy] = useState<
    "docCount" | "totalCitations" | "hIndex" | "gIndex"
  >("docCount");

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [selectedEntity, setSelectedEntity] =
    useState<EntityMetric | null>(null);

  const [activeViewId, setActiveViewId] =
    useState<LocalEntityId | null>(
      SELECTABLE_ENTITY_DIMENSIONS.has(String(focusDimension))
        ? (focusDimension as LocalEntityId)
        : "authors"
    );

  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const [completedView, setCompletedView] =
    useState<LocalEntityId | null>(
      SELECTABLE_ENTITY_DIMENSIONS.has(String(focusDimension))
        ? (focusDimension as LocalEntityId)
        : "authors"
    );

  const [focusedAnalysis, setFocusedAnalysis] =
    useState<Analysis | null>(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedModel = activeModelId
    ? ENTITY_MODELS.find((item) => item.id === activeModelId)
    : undefined;

  useEffect(() => {
    if (
      focusDimension &&
      SELECTABLE_ENTITY_DIMENSIONS.has(focusDimension)
    ) {
      setDimension(focusDimension);
      setActiveViewId(focusDimension as LocalEntityId);
      setActiveModelId(null);
      setCompletedView(focusDimension as LocalEntityId);
    }

    setSelectedEntity(null);
    setFocusedAnalysis(null);
    setRunError("");
  }, [focusDimension, focusKey]);

  useEffect(() => {
    if (
      selectedDatasetId &&
      selectedDatasetId !== activeDatasetId
    ) {
      setActiveDatasetId(selectedDatasetId);
    }
  }, [selectedDatasetId, activeDatasetId]);

  useEffect(() => {
    if (!activeDatasetId) return;

    setIsLoading(true);

    fetch(`/api/datasets/${activeDatasetId}/documents?limit=5000`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch documents");
        }

        return res.json();
      })
      .then((data) => {
        const docs = Array.isArray(data)
          ? data
          : data.documents || data.records || [];

        setDocuments(docs);
      })
      .catch((err) => {
        console.warn("Error fetching documents:", err);
        setDocuments([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeDatasetId]);

  const extractInstitutions = (raw: any): string[] => {
    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw.flatMap((item) => extractInstitutions(item));
    }

    const str = String(raw);
    const items = str.split(";");

    return items
      .map((item: any) => {
        const cleaned = String(item)
          .replace(/\[.*?\]/g, "")
          .trim();

        const parts = cleaned.split(",");
        let primary = parts[0]?.trim() || "";

        if (
          /^(dept|department|fac|faculty|inst|institute|centre|center|school|coll|college) of\s+/i.test(
            primary
          ) ||
          /^(department|faculty|division)\b/i.test(primary)
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
      .filter(
        (s: string) =>
          s &&
          s.length > 2 &&
          !/^\d+$/.test(s)
      );
  };

  const extractCountries = (raw: any): string[] => {
    if (!raw) return [];

    const text = Array.isArray(raw)
      ? raw.join(" ")
      : String(raw);

    const countryList = [
      "USA",
      "United States",
      "China",
      "United Kingdom",
      "UK",
      "Germany",
      "Iran",
      "Canada",
      "France",
      "Japan",
      "Australia",
      "Italy",
      "Spain",
      "India",
      "Netherlands",
      "Brazil",
      "South Korea",
      "Switzerland",
      "Sweden",
      "Turkey",
      "Russia",
      "Poland",
      "Belgium",
      "Taiwan",
      "Austria",
      "Denmark",
      "Norway",
    ];

    const found: string[] = [];
    const textLower = text.toLowerCase();

    countryList.forEach((country) => {
      if (textLower.includes(country.toLowerCase())) {
        const normalized =
          country === "United States"
            ? "USA"
            : country === "United Kingdom"
              ? "UK"
              : country;

        if (!found.includes(normalized)) {
          found.push(normalized);
        }
      }
    });

    return found;
  };

  const computeImpactIndices = (citationList: number[]) => {
    const sorted = [...citationList].sort((a, b) => b - a);

    let h = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] >= i + 1) {
        h = i + 1;
      } else {
        break;
      }
    }

    let g = 0;
    let cumSum = 0;

    for (let i = 0; i < sorted.length; i++) {
      cumSum += sorted[i];

      if (cumSum >= (i + 1) * (i + 1)) {
        g = i + 1;
      }
    }

    return {
      hIndex: h,
      gIndex: g,
    };
  };

  const entities = useMemo<EntityMetric[]>(() => {
    if (documents.length === 0) return [];

    const map = new Map<
      string,
      {
        name: string;
        citations: number[];
        years: number[];
        annualMap: Record<number, number>;
        docIndices: number[];
      }
    >();

    documents.forEach((d: any, idx) => {
      const year = Number(d.year || d.PY || 2023);
      const cits = Number(d.citations ?? d.TC ?? 0);

      let keys: string[] = [];

      if (dimension === "authors") {
        if (Array.isArray(d.authors)) {
          keys = d.authors;
        } else if (Array.isArray(d.AU)) {
          keys = d.AU;
        } else if (typeof d.author === "string") {
          keys = d.author.split(";");
        }
      } else if (dimension === "sources") {
        const src = (d.source || d.SO || "").trim();
        if (src) {
          keys = [src];
        }
      } else if (dimension === "keywords") {
        if (Array.isArray(d.keywords)) {
          keys = d.keywords;
        } else if (Array.isArray(d.DE)) {
          keys = d.DE;
        } else if (Array.isArray(d.ID)) {
          keys = d.ID;
        } else if (typeof d.keyword === "string") {
          keys = d.keyword.split(";");
        }
      } else if (dimension === "institutions") {
        keys = extractInstitutions(
          d.institutions ||
            d.affiliations ||
            d.C1 ||
            d.RP ||
            d.affiliation
        );
      } else if (dimension === "grants") {
        if (Array.isArray(d.funding_agencies)) {
          keys = [...keys, ...d.funding_agencies];
        }

        if (Array.isArray(d.grant_numbers)) {
          keys = [
            ...keys,
            ...d.grant_numbers.map((g: string) => `Grant #${g}`),
          ];
        }

        if (d.FU) {
          const fuList = Array.isArray(d.FU)
            ? d.FU
            : String(d.FU).split(";");

          keys = [
            ...keys,
            ...fuList
              .map((f: string) => f.split("[")[0].trim())
              .filter((s: string) => s && s.length > 2),
          ];
        }
      } else if (dimension === "countries") {
        keys = extractCountries(
          d.country || d.countries || d.affiliations || d.C1
        );
      } else if (dimension === "documents") {
        const title = (d.title || d.TI || `Doc #${idx + 1}`).trim();
        keys = [title];
      }

      const uniqueKeys = Array.from(
        new Set(keys.map((k) => String(k).trim()).filter(Boolean))
      );

      uniqueKeys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, {
            name: key,
            citations: [],
            years: [],
            annualMap: {},
            docIndices: [],
          });
        }

        const record = map.get(key)!;

        record.citations.push(cits);
        record.docIndices.push(idx);

        if (year) {
          record.years.push(year);
          record.annualMap[year] = (record.annualMap[year] || 0) + 1;
        }
      });
    });

    const result: EntityMetric[] = [];

    map.forEach((val, key) => {
      const docCount = val.citations.length;
      const totalCitations = val.citations.reduce((acc, c) => acc + c, 0);
      const avgCitations = Number(
        (totalCitations / (docCount || 1)).toFixed(1)
      );
      const { hIndex, gIndex } = computeImpactIndices(val.citations);

      const minYr = val.years.length ? Math.min(...val.years) : 2020;
      const maxYr = val.years.length ? Math.max(...val.years) : 2024;

      result.push({
        id: key,
        name: key,
        docCount,
        totalCitations,
        avgCitations,
        hIndex,
        gIndex,
        firstYear: minYr,
        lastYear: maxYr,
        annualProduction: val.annualMap,
        matchedDocIndices: val.docIndices,
      });
    });

    return result;
  }, [documents, dimension]);

  const filteredEntities = useMemo(() => {
    let list = [...entities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const mul = sortOrder === "desc" ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * mul;
    });
  }, [entities, searchQuery, sortBy, sortOrder]);

  const handleSort = (
    field: "docCount" | "totalCitations" | "hIndex" | "gIndex"
  ) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const annualChartData = useMemo(() => {
    if (!selectedEntity) return [];

    const yrs = Object.keys(selectedEntity.annualProduction)
      .map(Number)
      .sort((a, b) => a - b);

    return yrs.map((yr) => ({
      year: String(yr),
      articles: selectedEntity.annualProduction[yr] || 0,
    }));
  }, [selectedEntity]);

  const matchedDocs = useMemo(() => {
    if (!selectedEntity || !selectedEntity.matchedDocIndices) {
      return [];
    }

    return selectedEntity.matchedDocIndices
      .slice(0, 10)
      .map((idx) => documents[idx])
      .filter(Boolean);
  }, [selectedEntity, documents]);

  const selectEntityDataset = (id: string) => {
    setActiveDatasetId(id);
    setSelectedEntity(null);
    setFocusedAnalysis(null);
    setRunError("");

    if (activeViewId) {
      setCompletedView(activeViewId);
    } else {
      setCompletedView(null);
    }

    onSelectDataset?.(id);
  };

  const selectAnalysis = async (id: string, local: boolean) => {
    if (running) return;

    setSelectedEntity(null);
    setCompletedView(null);
    setFocusedAnalysis(null);
    setRunError("");

    if (local) {
      const localId = id as LocalEntityId;

      setActiveViewId(localId);
      setActiveModelId(null);
      setDimension(localId as EntityDimension);
      setCompletedView(localId);

      return;
    }

    if (!activeDatasetId) {
      setRunError("Please select a dataset first.");
      return;
    }

    setActiveViewId(null);
    setActiveModelId(id);
    setRunning(true);

    try {
      const result = await onQuickRun(id, activeDatasetId);

      if (result) {
        setFocusedAnalysis(result);
      } else {
        setRunError("The analysis could not be completed.");
      }
    } catch (error) {
      console.error("Entity analysis failed:", error);
      setRunError("The analysis could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  const refreshAnalysis = async () => {
    if (!activeModelId || !activeDatasetId || running) {
      return;
    }

    setRunning(true);
    setRunError("");

    try {
      const result = await onQuickRun(activeModelId, activeDatasetId);

      if (result) {
        setFocusedAnalysis(result);
      } else {
        setRunError("The analysis could not be completed.");
      }
    } catch (error) {
      console.error("Entity analysis refresh failed:", error);
      setRunError("The analysis could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      "Name",
      "Documents",
      "Total Citations",
      "Avg Citations",
      "H-Index",
      "G-Index",
      "First Year",
      "Last Year",
    ];

    const rows = filteredEntities.map((e) => [
      `"${e.name.replace(/"/g, '""')}"`,
      e.docCount,
      e.totalCitations,
      e.avgCitations,
      e.hIndex,
      e.gIndex,
      e.firstYear,
      e.lastYear,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");

    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${dimension}_performance_analysis.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="space-y-4 border-b border-border-default pb-5">
        <div className="min-w-0">
          <p className="sciai-kicker">Entity & Actor Intelligence</p>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary sm:text-3xl">
            Scientometric Entity Explorer
          </h1>

          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Deep drill-down across authors, publication venues, conceptual keywords, institutional
            affiliations, research grants (WoS & Scopus), and global countries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 shadow-card sm:w-80">
            <Database className="h-3.5 w-3.5 shrink-0 text-brand-500" />

            <select
              aria-label="Target Dataset"
              value={activeDatasetId}
              onChange={(e) => selectEntityDataset(e.target.value)}
              disabled={running || !datasets.length}
              className="min-w-0 flex-1 truncate bg-transparent text-xs font-bold text-ink-primary focus:outline-none disabled:text-ink-subtle"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count.toLocaleString()} docs)
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(215px,250px)_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside
          aria-label="Entity and author analysis methods"
          className="rounded-2xl border border-border-default bg-surface-canvas p-3 shadow-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
        >
          <div className="px-2 pb-2 pt-1">
            <div className="sciai-kicker">Analysis methods</div>
          </div>

          <nav className="space-y-0.5">
            {/* Local Entity Analyses */}
            {LOCAL_ENTITY_ANALYSES.map((item) => {
              const Icon = item.icon;
              const isActive = activeViewId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectAnalysis(item.id, true)}
                  disabled={running}
                  title={item.desc}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold transition-colors disabled:opacity-60 ${
                    isActive
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isActive ? "text-white" : "text-ink-subtle"
                    }`}
                  />

                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </button>
              );
            })}

            {/* Capability / Model Analyses */}
            {ENTITY_MODELS.map((model) => {
              const Icon = model.icon;
              const isActive = activeModelId === model.id;
              const isRunning = running && activeModelId === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => selectAnalysis(model.id, false)}
                  disabled={running}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold transition-colors disabled:opacity-60 ${
                    isActive
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                  }`}
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white" />
                  ) : (
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? "text-white" : "text-ink-subtle"
                      }`}
                    />
                  )}

                  <span className="min-w-0 flex-1 truncate">{model.name}</span>

                  {isRunning && (
                    <span className="shrink-0 text-[9px] font-bold text-brand-100">
                      Running
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <section className="min-w-0 space-y-5" aria-live="polite">
          {/* Error */}
          {runError && <AlertBanner tone="danger">{runError}</AlertBanner>}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-canvas px-4 py-3 text-xs font-semibold text-ink-muted shadow-card">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
              Loading dataset...
            </div>
          )}

          {/* Legacy Entity Dimension Results */}
          {activeViewId && completedView === activeViewId && (
            <div className="space-y-5">
              {/* Search & Sort Controls */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border-default bg-surface-canvas p-3 shadow-card sm:flex-row sm:items-center">
                <div className="flex max-w-md flex-1 items-center gap-2">
                  <Search className="h-4 w-4 text-ink-subtle" />

                  <input
                    type="text"
                    placeholder={`Search ${dimension}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-ink-primary placeholder:text-ink-subtle focus:outline-none"
                  />
                </div>

                <div className="tabular-metrics text-xs font-semibold text-ink-muted">
                  Found{" "}
                  <strong className="text-ink-primary">
                    {filteredEntities.length.toLocaleString()}
                  </strong>{" "}
                  {dimension}
                </div>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Table */}
                <Card padding="none" className="overflow-hidden lg:col-span-2">
                  <div className="max-h-[640px] overflow-x-auto overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                        <tr>
                          <th className="p-3.5">Name / Label</th>

                          <th
                            className="cursor-pointer p-3.5 text-right transition-colors hover:text-ink-primary"
                            onClick={() => handleSort("docCount")}
                          >
                            <div className="inline-flex items-center gap-1">
                              Articles
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </th>

                          <th
                            className="cursor-pointer p-3.5 text-right transition-colors hover:text-ink-primary"
                            onClick={() => handleSort("totalCitations")}
                          >
                            <div className="inline-flex items-center gap-1">
                              Citations
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </th>

                          <th
                            className="cursor-pointer p-3.5 text-right transition-colors hover:text-ink-primary"
                            onClick={() => handleSort("hIndex")}
                          >
                            <div className="inline-flex items-center gap-1">
                              H-Index
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </th>

                          <th
                            className="cursor-pointer p-3.5 text-right transition-colors hover:text-ink-primary"
                            onClick={() => handleSort("gIndex")}
                          >
                            <div className="inline-flex items-center gap-1">
                              G-Index
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border-subtle">
                        {filteredEntities.slice(0, 50).map((entity) => {
                          const isSelected = selectedEntity?.id === entity.id;

                          return (
                            <tr
                              key={entity.id}
                              onClick={() => setSelectedEntity(entity)}
                              className={`cursor-pointer transition-colors hover:bg-surface-subtle/70 ${
                                isSelected ? "bg-brand-50/70 font-semibold" : ""
                              }`}
                            >
                              <td className="line-clamp-1 max-w-[220px] p-3.5 font-bold text-ink-primary">
                                {entity.name}
                              </td>

                              <td className="tabular-metrics p-3.5 text-right font-mono text-ink-primary">
                                {entity.docCount.toLocaleString()}
                              </td>

                              <td className="tabular-metrics p-3.5 text-right font-mono font-bold text-status-success-text">
                                {entity.totalCitations.toLocaleString()}
                              </td>

                              <td className="tabular-metrics p-3.5 text-right font-mono font-bold text-brand-600">
                                {entity.hIndex}
                              </td>

                              <td className="tabular-metrics p-3.5 text-right font-mono text-status-info-text">
                                {entity.gIndex}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Drill-down Detail Inspector */}
                <div className="space-y-6">
                  {selectedEntity ? (
                    <Card padding="lg" className="space-y-5">
                      <div className="border-b border-border-subtle pb-3">
                        <span className="sciai-kicker">Selected Entity</span>

                        <h3 className="mt-1 line-clamp-2 text-base font-black text-ink-primary">
                          {selectedEntity.name}
                        </h3>

                        <div className="tabular-metrics mt-1 text-xs text-ink-muted">
                          Active Years: {selectedEntity.firstYear} - {selectedEntity.lastYear}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                          <div className="sciai-kicker text-[10px]!">Publications</div>
                          <div className="tabular-metrics mt-0.5 text-xl font-black text-ink-primary">
                            {selectedEntity.docCount}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                          <div className="sciai-kicker text-[10px]!">Citations</div>
                          <div className="tabular-metrics mt-0.5 text-xl font-black text-status-success-text">
                            {selectedEntity.totalCitations}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                          <div className="sciai-kicker text-[10px]!">Hirsch (H-Index)</div>
                          <div className="tabular-metrics mt-0.5 text-xl font-black text-brand-600">
                            {selectedEntity.hIndex}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                          <div className="sciai-kicker text-[10px]!">Egghe (G-Index)</div>
                          <div className="tabular-metrics mt-0.5 text-xl font-black text-status-info-text">
                            {selectedEntity.gIndex}
                          </div>
                        </div>
                      </div>

                      {/* Annual Production */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-ink-primary">
                          <TrendingUp className="h-3.5 w-3.5 text-brand-500" />
                          Annual Production Curve
                        </div>

                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={annualChartData}
                              margin={{
                                top: 5,
                                right: 10,
                                left: -20,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e8e4" />

                              <XAxis dataKey="year" stroke="#828d98" fontSize={10} />

                              <YAxis stroke="#828d98" fontSize={10} />

                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#101820",
                                  borderRadius: "8px",
                                  border: "none",
                                  fontSize: "11px",
                                  color: "#ffffff",
                                }}
                              />

                              <Bar dataKey="articles" fill="#315C7C" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Related Publications */}
                      {matchedDocs.length > 0 && (
                        <div className="space-y-2.5 border-t border-border-subtle pt-3">
                          <div className="tabular-metrics flex items-center justify-between text-xs font-bold text-ink-primary">
                            <span>Sample Publications ({matchedDocs.length})</span>
                          </div>

                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {matchedDocs.map((doc: any, i) => (
                              <div
                                key={i}
                                className="space-y-1 rounded-xl border border-border-subtle bg-surface-subtle p-2.5 text-xs"
                              >
                                <div className="line-clamp-1 font-bold text-ink-primary">
                                  {doc.title}
                                </div>

                                <div className="tabular-metrics flex items-center gap-2 text-[10px] text-ink-muted">
                                  <span>{doc.year || doc.PY}</span>
                                  <span>·</span>
                                  <span className="font-semibold text-status-success-text">
                                    {doc.citations ?? doc.TC ?? 0} citations
                                  </span>

                                  {doc.source && (
                                    <>
                                      <span>·</span>
                                      <span className="line-clamp-1 text-ink-secondary">
                                        {doc.source}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Funding */}
                                {(doc.funding_agencies?.length > 0 ||
                                  doc.grant_numbers?.length > 0) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-1">
                                    {doc.funding_agencies
                                      ?.slice(0, 2)
                                      .map((fa: string, fai: number) => (
                                        <span
                                          key={fai}
                                          className="inline-flex items-center gap-1 rounded border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[9px] font-semibold text-status-warning-text"
                                        >
                                          <Landmark className="h-2.5 w-2.5" />
                                          {fa}
                                        </span>
                                      ))}

                                    {doc.grant_numbers
                                      ?.slice(0, 2)
                                      .map((gn: string, gni: number) => (
                                        <span
                                          key={gni}
                                          className="rounded border border-border-default bg-surface-canvas px-1.5 py-0.5 font-mono text-[9px] font-medium text-ink-secondary"
                                        >
                                          #{gn}
                                        </span>
                                      ))}
                                  </div>
                                )}

                                {/* Affiliation */}
                                {(doc.institutions?.length > 0 ||
                                  doc.affiliations?.length > 0) && (
                                  <div className="line-clamp-1 pt-0.5 text-[10px] text-ink-muted">
                                    {(
                                      doc.institutions?.[0] ||
                                      doc.affiliations?.[0] ||
                                      ""
                                    ).slice(0, 45)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-dashed border-border-default bg-surface-subtle p-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-canvas text-brand-500">
                        <BarChart2 className="h-5 w-5" />
                      </div>

                      <h4 className="text-xs font-bold text-ink-primary">No Entity Selected</h4>

                      <p className="text-[11px] leading-relaxed text-ink-muted">
                        Click any row in the table to inspect longitudinal citation impact, annual
                        production curves, and affiliated publications.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Capability Model Results */}
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