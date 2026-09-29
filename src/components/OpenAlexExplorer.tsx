import React, { useState } from "react";
import {
  Search,
  Globe2,
  Download,
  BookOpen,
  Quote,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Layers,
  ArrowRight,
  Database,
  Calendar,
  Users,
} from "lucide-react";

interface OpenAlexWork {
  id: string;
  doi: string;
  title: string;
  year: number;
  source: string;
  citations: number;
  authors: string[];
  countries: string[];
  keywords: string[];
  is_open_access: boolean;
  oa_url: string;
  referenced_works_count: number;
}

interface Props {
  onDatasetCreated: (datasetId: string) => void;
}

export function OpenAlexExplorer({ onDatasetCreated }: Props) {
  const [query, setQuery] = useState("Data Science");
  const [perPage, setPerPage] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [works, setWorks] = useState<OpenAlexWork[]>([]);
  const [totalOnline, setTotalOnline] = useState<number>(0);
  const [sourceType, setSourceType] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setImportSuccess(null);
    setPage(1);
    try {
      const res = await fetch(`/api/openalex/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=1`);
      const data = await res.json();
      setWorks(data.works || []);
      setTotalOnline(data.total_online || data.count || 0);
      setSourceType(data.source || "openalex");
      setHasMore(Boolean(data.has_more));
    } catch (err) {
      console.error("OpenAlex search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !query.trim()) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/openalex/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${nextPage}`);
      const data = await res.json();
      const newWorks: OpenAlexWork[] = data.works || [];
      if (newWorks.length > 0) {
        setWorks((prev) => {
          const existingIds = new Set(prev.map((w) => w.id));
          const filtered = newWorks.filter((w) => !existingIds.has(w.id));
          return [...prev, ...filtered];
        });
        setPage(nextPage);
        setHasMore(Boolean(data.has_more));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more OpenAlex works:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImport = async () => {
    if (works.length === 0) return;
    setImporting(true);
    setImportSuccess(null);
    try {
      const res = await fetch("/api/openalex/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          works,
          dataset_name: `OpenAlex: ${query.slice(0, 35)} (${works.length} works)`,
        }),
      });
      const data = await res.json();
      if (data.success && data.dataset) {
        setImportSuccess(`Dataset "${data.dataset.name}" successfully created with ${data.documents_count} documents.`);
        onDatasetCreated(data.dataset.id);
      }
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Globe2 className="h-4 w-4" />
              </span>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                OpenAlex Live Explorer & Citation Net
              </h2>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                pyBiblioNet API
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Query over 250M+ open scientific works from the OpenAlex global knowledge graph. Inspect citation metrics, seminal referenced works (Root Set), and convert directly into a SciAI research dataset.
            </p>
          </div>

          {works.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {importing ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Importing Corpus...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Import {works.length} Works as Dataset</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Search Bar & Limit Selector */}
        <form onSubmit={handleSearch} className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scientific literature (e.g., deep learning in oncology, scientometrics, quantum computing)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Records Limit Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Fetch:</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value={15}>15 records</option>
                <option value={25}>25 records</option>
                <option value={50}>50 records (Standard)</option>
                <option value={100}>100 records (Deep)</option>
                <option value={200}>200 records (Max Batch)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Querying OpenAlex...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Search OpenAlex</span>
                </>
              )}
            </button>
          </div>

          {/* Quick presets & info badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Quick batch size:</span>
              {[25, 50, 100, 200].map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => {
                    setPerPage(size);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition cursor-pointer ${
                    perPage === size
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <span className="text-slate-400 italic">
              Up to 200 works per query · Use "Load More" to append multi-page batches
            </span>
          </div>
        </form>

        {importSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}
      </div>

      {/* Results Header / Stats */}
      {works.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="text-xs font-bold text-slate-700 flex flex-wrap items-center gap-2">
            <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {works.length} Works Collected
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 font-medium">
              Estimated {totalOnline.toLocaleString()} global matches in OpenAlex
            </span>
            {sourceType === "openalex_live" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                LIVE API Connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                    <span>Loading Page {page + 1}...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>Load Next {perPage} Works</span>
                  </>
                )}
              </button>
            )}
            <span className="text-[11px] text-slate-400">
              Page {page} · OpenAlex REST API v2
            </span>
          </div>
        </div>
      )}

      {/* Works List */}
      <div className="space-y-3">
        {works.map((work) => (
          <div
            key={work.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-slate-300 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <h3 className="text-xs font-bold text-slate-900 leading-snug">
                  {work.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Users className="h-3 w-3 text-slate-400" />
                    {Array.isArray(work.authors) ? work.authors.slice(0, 3).join(", ") : "Unknown Author"}
                    {Array.isArray(work.authors) && work.authors.length > 3 && ` +${work.authors.length - 3}`}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-slate-400" />
                    {work.source}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {work.year}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-mono font-bold text-slate-800">
                  <Quote className="h-3 w-3 text-slate-400" />
                  {work.citations || 0} citations
                </span>
                {work.is_open_access && (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                    Open Access
                  </span>
                )}
              </div>
            </div>

            {/* Concepts / Keywords */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(work.keywords || []).map((kw, kIdx) => (
                <span
                  key={kIdx}
                  className="rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  #{kw}
                </span>
              ))}
              {work.doi && (
                <a
                  href={`https://doi.org/${work.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 hover:underline"
                >
                  <span>DOI: {work.doi}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {works.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-600">
              Currently accumulated <span className="font-bold text-slate-900">{works.length}</span> papers
              {totalOnline > works.length && (
                <span className="text-slate-400"> (of ~{totalOnline.toLocaleString()} available online)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-800 border-t-transparent" />
                      <span>Loading Page {page + 1}...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>Load Next {perPage} Works</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Import All {works.length} Works as Dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {works.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <Globe2 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h3 className="text-xs font-bold text-slate-700">Explore OpenAlex Knowledge Graph</h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              Enter any research topic above to retrieve literature, citations, and metadata directly via the OpenAlex REST API.
            </p>
            <button
              onClick={() => handleSearch()}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search Data Science</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
