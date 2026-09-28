import React, { useState, useEffect, useMemo } from "react";
import { Dataset, BibliometricDocument } from "../types.js";
import {
  Users,
  BookOpen,
  Building2,
  Globe2,
  FileText,
  Search,
  Award,
  TrendingUp,
  Download,
  Database,
  ArrowUpDown,
  Filter,
  BarChart2,
  Calendar,
  Hash,
  Landmark,
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

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  focusDimension?: "authors" | "sources" | "institutions";
  focusKey?: string;
}

type EntityDimension = "authors" | "sources" | "keywords" | "institutions" | "grants" | "countries" | "documents";

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
}: Props) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(
    selectedDatasetId || datasets[0]?.id || ""
  );
  const [dimension, setDimension] = useState<EntityDimension>(focusDimension || "authors");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"docCount" | "totalCitations" | "hIndex" | "gIndex">("docCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedEntity, setSelectedEntity] = useState<EntityMetric | null>(null);

  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (focusDimension) {
      setDimension(focusDimension);
      setSelectedEntity(null);
    }
  }, [focusDimension, focusKey]);

  useEffect(() => {
    if (selectedDatasetId && selectedDatasetId !== activeDatasetId) {
      setActiveDatasetId(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!activeDatasetId) return;
    setIsLoading(true);
    fetch(`/api/datasets/${activeDatasetId}/documents?limit=5000`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      })
      .then((data) => {
        const docs = Array.isArray(data) ? data : data.documents || data.records || [];
        setDocuments(docs);
      })
      .catch((err) => console.warn("Error fetching documents:", err))
      .finally(() => setIsLoading(false));
  }, [activeDatasetId]);

  // Extract Institutions Helper (handles Web of Science C1/RP addresses and Scopus Affiliations)
  const extractInstitutions = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.flatMap((item) => extractInstitutions(item));
    }
    const str = String(raw);
    const items = str.split(";");
    return items
      .map((item: any) => {
        let cleaned = String(item).replace(/\[.*?\]/g, "").trim();
        const parts = cleaned.split(",");
        let primary = parts[0]?.trim() || "";
        if (
          /^(dept|department|fac|faculty|inst|institute|centre|center|school|coll|college) of\s+/i.test(primary) ||
          /^(department|faculty|division)\b/i.test(primary)
        ) {
          if (parts[1] && parts[1].trim().length > 3) {
            primary = parts[1].trim();
          }
        }
        return primary.replace(/^(dept|department|fac|faculty|inst|institute|centre|center) of\s+/i, "").slice(0, 60).trim();
      })
      .filter((s: string) => s && s.length > 2 && !/^\d+$/.test(s));
  };

  // Extract Countries Helper
  const extractCountries = (raw: any): string[] => {
    if (!raw) return [];
    const text = Array.isArray(raw) ? raw.join(" ") : String(raw);
    const countryList = [
      "USA", "United States", "China", "United Kingdom", "UK", "Germany", "Iran",
      "Canada", "France", "Japan", "Australia", "Italy", "Spain", "India",
      "Netherlands", "Brazil", "South Korea", "Switzerland", "Sweden", "Turkey",
      "Russia", "Poland", "Belgium", "Taiwan", "Austria", "Denmark", "Norway"
    ];
    const found: string[] = [];
    const textLower = text.toLowerCase();
    countryList.forEach((c) => {
      if (textLower.includes(c.toLowerCase())) {
        const norm = c === "United States" ? "USA" : c === "United Kingdom" ? "UK" : c;
        if (!found.includes(norm)) found.push(norm);
      }
    });
    return found;
  };

  // Calculate H-Index and G-Index
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

    return { hIndex: h, gIndex: g };
  };

  // Entity Aggregation Engine across all research dimensions
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
        if (Array.isArray(d.authors)) keys = d.authors;
        else if (Array.isArray(d.AU)) keys = d.AU;
        else if (typeof d.author === "string") keys = d.author.split(";");
      } else if (dimension === "sources") {
        const src = (d.source || d.SO || "").trim();
        if (src) keys = [src];
      } else if (dimension === "keywords") {
        if (Array.isArray(d.keywords)) keys = d.keywords;
        else if (Array.isArray(d.DE)) keys = d.DE;
        else if (Array.isArray(d.ID)) keys = d.ID;
        else if (typeof d.keyword === "string") keys = d.keyword.split(";");
      } else if (dimension === "institutions") {
        keys = extractInstitutions(d.institutions || d.affiliations || d.C1 || d.RP || d.affiliation);
      } else if (dimension === "grants") {
        if (Array.isArray(d.funding_agencies)) keys = [...keys, ...d.funding_agencies];
        if (Array.isArray(d.grant_numbers)) keys = [...keys, ...d.grant_numbers.map((g: string) => `Grant #${g}`)];
        if (d.FU) {
          const fuList = Array.isArray(d.FU) ? d.FU : String(d.FU).split(";");
          keys = [...keys, ...fuList.map((f: string) => f.split("[")[0].trim()).filter((s: string) => s && s.length > 2)];
        }
      } else if (dimension === "countries") {
        keys = extractCountries(d.country || d.countries || d.affiliations || d.C1);
      } else if (dimension === "documents") {
        const title = (d.title || d.TI || `Doc #${idx + 1}`).trim();
        keys = [title];
      }

      const uniqueKeys = Array.from(new Set(keys.map((k) => String(k).trim()).filter(Boolean)));

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
      const avgCitations = Number((totalCitations / (docCount || 1)).toFixed(1));
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

  // Filtered & Sorted
  const filteredEntities = useMemo(() => {
    let list = entities;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const mul = sortOrder === "desc" ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * mul;
    });
  }, [entities, searchQuery, sortBy, sortOrder]);

  const handleSort = (field: "docCount" | "totalCitations" | "hIndex" | "gIndex") => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Prepare annual chart data for selected entity
  const annualChartData = useMemo(() => {
    if (!selectedEntity) return [];
    const yrs = Object.keys(selectedEntity.annualProduction).map(Number).sort((a, b) => a - b);
    return yrs.map((yr) => ({
      year: String(yr),
      articles: selectedEntity.annualProduction[yr] || 0,
    }));
  }, [selectedEntity]);

  // Associated publications for selected entity
  const matchedDocs = useMemo(() => {
    if (!selectedEntity || !selectedEntity.matchedDocIndices) return [];
    return selectedEntity.matchedDocIndices
      .slice(0, 10)
      .map((idx) => documents[idx])
      .filter(Boolean);
  }, [selectedEntity, documents]);

  // Export CSV
  const exportCsv = () => {
    const headers = ["Name", "Documents", "Total Citations", "Avg Citations", "H-Index", "G-Index", "First Year", "Last Year"];
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
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Phase 3
            </span>
            <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700">
              Entities & Micro Performance
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Scientometric Entity Explorer
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Deep drill-down across authors, publication venues, conceptual keywords, institutional affiliations, research grants (WoS & Scopus), and global countries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={activeDatasetId}
              onChange={(e) => {
                const id = e.target.value;
                setActiveDatasetId(id);
                onSelectDataset?.(id);
              }}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count.toLocaleString()} docs)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Multi-Dimension Pill Selector */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {[
          { id: "authors", label: "Authors & Scholars", icon: Users },
          { id: "sources", label: "Sources & Journals", icon: BookOpen },
          { id: "keywords", label: "Keywords & Concepts", icon: Hash },
          { id: "institutions", label: "Affiliations / Institutions", icon: Building2 },
          { id: "grants", label: "Research Grants & Funding", icon: Landmark },
          { id: "countries", label: "Countries & Territories", icon: Globe2 },
          { id: "documents", label: "Core Documents", icon: FileText },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = dimension === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDimension(item.id as EntityDimension);
                setSelectedEntity(null);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${dimension}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 bg-transparent focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Found <strong>{filteredEntities.length.toLocaleString()}</strong> {dimension}
        </div>
      </div>

      {/* Main Grid: Entity Table & Drill-down */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table View (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 z-10">
                <tr>
                  <th className="p-3.5">Name / Label</th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort("docCount")}
                  >
                    <div className="inline-flex items-center gap-1">
                      Articles
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort("totalCitations")}
                  >
                    <div className="inline-flex items-center gap-1">
                      Citations
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort("hIndex")}
                  >
                    <div className="inline-flex items-center gap-1">
                      H-Index
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort("gIndex")}
                  >
                    <div className="inline-flex items-center gap-1">
                      G-Index
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntities.slice(0, 50).map((entity) => {
                  const isSelected = selectedEntity?.id === entity.id;
                  return (
                    <tr
                      key={entity.id}
                      onClick={() => setSelectedEntity(entity)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isSelected ? "bg-blue-50/60 font-semibold" : ""
                      }`}
                    >
                      <td className="p-3.5 font-bold text-slate-800 line-clamp-1 max-w-[220px]">
                        {entity.name}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-900">
                        {entity.docCount.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-emerald-600 font-bold">
                        {entity.totalCitations.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-purple-600 font-bold">
                        {entity.hIndex}
                      </td>
                      <td className="p-3.5 text-right font-mono text-blue-600">
                        {entity.gIndex}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drill-down Detail Inspector */}
        <div className="space-y-6">
          {selectedEntity ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Selected Entity
                </span>
                <h3 className="text-base font-black text-slate-900 line-clamp-2 mt-1">
                  {selectedEntity.name}
                </h3>
                <div className="mt-1 text-xs text-slate-500">
                  Active Years: {selectedEntity.firstYear} - {selectedEntity.lastYear}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Publications</div>
                  <div className="text-xl font-black text-slate-900">{selectedEntity.docCount}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Citations</div>
                  <div className="text-xl font-black text-emerald-600">{selectedEntity.totalCitations}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Hirsch (H-Index)</div>
                  <div className="text-xl font-black text-purple-600">{selectedEntity.hIndex}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Egghe (G-Index)</div>
                  <div className="text-xl font-black text-blue-600">{selectedEntity.gIndex}</div>
                </div>
              </div>

              {/* Longitudinal Production Chart */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                  Annual Production Curve
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={annualChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "11px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey="articles" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Related Documents with Funding & Affiliation Badges */}
              {matchedDocs.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Sample Publications ({matchedDocs.length})</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {matchedDocs.map((doc: any, i) => (
                      <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1">
                        <div className="font-bold text-slate-900 line-clamp-1">{doc.title}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{doc.year || doc.PY}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">{doc.citations ?? doc.TC ?? 0} citations</span>
                          {doc.source && (
                            <>
                              <span>•</span>
                              <span className="line-clamp-1 text-slate-600">{doc.source}</span>
                            </>
                          )}
                        </div>
                        {/* Grant & Funding Info */}
                        {(doc.funding_agencies?.length > 0 || doc.grant_numbers?.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {doc.funding_agencies?.slice(0, 2).map((fa: string, fai: number) => (
                              <span key={fai} className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                <Landmark className="h-2.5 w-2.5" />
                                {fa}
                              </span>
                            ))}
                            {doc.grant_numbers?.slice(0, 2).map((gn: string, gni: number) => (
                              <span key={gni} className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-700">
                                #{gn}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Affiliation Info */}
                        {(doc.institutions?.length > 0 || doc.affiliations?.length > 0) && (
                          <div className="text-[10px] text-slate-500 line-clamp-1 pt-0.5">
                            🏛️ {(doc.institutions?.[0] || doc.affiliations?.[0] || "").slice(0, 45)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <BarChart2 className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">No Entity Selected</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Click any row in the table to inspect longitudinal citation impact, annual production curves, and affiliated publications.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
