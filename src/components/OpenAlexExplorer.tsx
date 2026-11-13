import React, { useState } from "react";
import {
  Search,
  Globe2,
  Download,
  BookOpen,
  Quote,
  ExternalLink,
  Layers,
  ArrowRight,
  Calendar,
  Users,
} from "lucide-react";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setImportSuccess(null);
    setErrorMsg(null);
    setPage(1);
    try {
      const data = await apiRequest<{
        works?: OpenAlexWork[];
        total_online?: number;
        count?: number;
        source?: string;
        has_more?: boolean;
      }>(
        `/api/openalex/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=1`
      );
      setWorks(data.works || []);
      setTotalOnline(data.total_online || data.count || 0);
      setSourceType(data.source || "openalex");
      setHasMore(Boolean(data.has_more));
    } catch (err) {
      console.error("OpenAlex search error:", err);
      setErrorMsg(getApiErrorMessage(err, "Failed to query OpenAlex API."));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !query.trim()) return;
    setLoadingMore(true);
    setErrorMsg(null);
    const nextPage = page + 1;
    try {
      const data = await apiRequest<{
        works?: OpenAlexWork[];
        has_more?: boolean;
      }>(
        `/api/openalex/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${nextPage}`
      );
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
      setErrorMsg(getApiErrorMessage(err, "Failed to load next page from OpenAlex."));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImport = async () => {
    if (works.length === 0) return;
    setImporting(true);
    setImportSuccess(null);
    setErrorMsg(null);
    try {
      const data = await apiJson<{
        success?: boolean;
        dataset?: { id: string; name: string };
        documents_count?: number;
      }>("/api/openalex/import", {
        query,
        works,
        dataset_name: `OpenAlex: ${query.slice(0, 35)} (${works.length} works)`,
      });
      if (data.success && data.dataset) {
        setImportSuccess(
          `Dataset "${data.dataset.name}" successfully created with ${data.documents_count} documents.`
        );
        onDatasetCreated(data.dataset.id);
      } else {
        setErrorMsg("Import completed without returning a dataset record.");
      }
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg(getApiErrorMessage(err, "Failed to import OpenAlex works into dataset."));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card padding="lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white shadow-xs">
                <Globe2 className="h-4 w-4" />
              </span>
              <h2 className="text-base font-black tracking-tight text-ink-primary">
                OpenAlex Live Explorer & Citation Net
              </h2>
              <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                pyBiblioNet API
              </span>
            </div>
            <p className="max-w-2xl text-xs leading-relaxed text-ink-muted">
              Query over 250M+ open scientific works from the OpenAlex global knowledge graph.
              Inspect citation metrics, seminal referenced works (Root Set), and convert directly
              into a SciAI research dataset.
            </p>
          </div>

          {works.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={importing}
              disabled={importing}
              onClick={handleImport}
              icon={<Download className="h-4 w-4" />}
              className="shrink-0"
            >
              {importing ? "Importing Corpus..." : `Import ${works.length} Works as Dataset`}
            </Button>
          )}
        </div>

        {/* Search Bar & Limit Selector */}
        <form onSubmit={handleSearch} className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scientific literature (e.g., deep learning in oncology, scientometrics, quantum computing)..."
                className="w-full rounded-xl border border-border-default bg-surface-subtle py-2.5 pl-10 pr-4 text-xs font-medium text-ink-primary placeholder:text-ink-subtle transition-colors focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
              />
            </div>

            {/* Records Limit Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-subtle px-3 py-1.5">
              <Layers className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span className="whitespace-nowrap text-[11px] font-bold text-ink-secondary">
                Fetch:
              </span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="cursor-pointer bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
              >
                <option value={15}>15 records</option>
                <option value={25}>25 records</option>
                <option value={50}>50 records (Standard)</option>
                <option value={100}>100 records (Deep)</option>
                <option value={200}>200 records (Max Batch)</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading}
              icon={<Search className="h-3.5 w-3.5" />}
              className="shrink-0"
            >
              {loading ? "Querying OpenAlex..." : "Search OpenAlex"}
            </Button>
          </div>

          {/* Quick presets & info badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-ink-muted">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink-secondary">Quick batch size:</span>
              {[25, 50, 100, 200].map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setPerPage(size)}
                  className={`tabular-metrics cursor-pointer rounded-md px-2 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                    perPage === size
                      ? "bg-brand-500 text-white"
                      : "border border-border-subtle bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <span className="italic text-ink-subtle">
              Up to 200 works per query · Use "Load More" to append multi-page batches
            </span>
          </div>
        </form>

        {importSuccess && (
          <div className="mt-4">
            <AlertBanner tone="success">{importSuccess}</AlertBanner>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4">
            <AlertBanner tone="danger">{errorMsg}</AlertBanner>
          </div>
        )}
      </Card>

      {/* Results Header / Stats */}
      {works.length > 0 && (
        <div className="flex flex-col justify-between gap-2 px-1 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-secondary">
            <span className="tabular-metrics rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-brand-700">
              {works.length} Works Collected
            </span>
            <span className="text-ink-subtle">·</span>
            <span className="tabular-metrics font-medium text-ink-muted">
              Estimated {totalOnline.toLocaleString()} global matches in OpenAlex
            </span>
            {sourceType === "openalex_live" && (
              <span className="rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[9px] font-bold text-status-success-text">
                LIVE API Connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasMore && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={loadingMore}
                disabled={loadingMore}
                onClick={handleLoadMore}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                {loadingMore ? `Loading Page ${page + 1}...` : `Load Next ${perPage} Works`}
              </Button>
            )}
            <span className="tabular-metrics text-[11px] text-ink-subtle">
              Page {page} · OpenAlex REST API v2
            </span>
          </div>
        </div>
      )}

      {/* Works List */}
      <div className="space-y-3">
        {works.map((work) => (
          <Card
            key={work.id}
            padding="sm"
            className="space-y-2.5 transition-colors hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <h3 className="text-xs font-bold leading-snug text-ink-primary">{work.title}</h3>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1 font-medium text-ink-secondary">
                    <Users className="h-3 w-3 text-ink-subtle" />
                    {Array.isArray(work.authors)
                      ? work.authors.slice(0, 3).join(", ")
                      : "Unknown Author"}
                    {Array.isArray(work.authors) &&
                      work.authors.length > 3 &&
                      ` +${work.authors.length - 3}`}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-ink-subtle" />
                    {work.source}
                  </span>
                  <span>·</span>
                  <span className="tabular-metrics flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-ink-subtle" />
                    {work.year}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="tabular-metrics inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-subtle px-2 py-1 font-mono text-xs font-bold text-ink-primary">
                  <Quote className="h-3 w-3 text-brand-500" />
                  {work.citations || 0} citations
                </span>
                {work.is_open_access && (
                  <span className="rounded-md border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[9px] font-bold text-status-success-text">
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
                  className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-ink-secondary"
                >
                  #{kw}
                </span>
              ))}
              {work.doi && (
                <a
                  href={`https://doi.org/${work.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-brand-500 hover:text-brand-700 hover:underline"
                >
                  <span>DOI: {work.doi}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </Card>
        ))}

        {works.length > 0 && (
          <Card
            padding="sm"
            className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
          >
            <div className="tabular-metrics text-xs text-ink-muted">
              Currently accumulated <span className="font-bold text-ink-primary">{works.length}</span>{" "}
              papers
              {totalOnline > works.length && (
                <span className="text-ink-subtle">
                  {" "}
                  (of ~{totalOnline.toLocaleString()} available online)
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasMore && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={loadingMore}
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  {loadingMore ? `Loading Page ${page + 1}...` : `Load Next ${perPage} Works`}
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={importing}
                disabled={importing}
                onClick={handleImport}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                {importing ? "Importing..." : `Import All ${works.length} Works as Dataset`}
              </Button>
            </div>
          </Card>
        )}

        {works.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-border-default bg-surface-subtle p-12 text-center">
            <Globe2 className="mx-auto mb-2 h-8 w-8 text-brand-500" />
            <h3 className="text-xs font-bold text-ink-primary">Explore OpenAlex Knowledge Graph</h3>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-ink-muted">
              Enter any research topic above to retrieve literature, citations, and metadata
              directly via the OpenAlex REST API.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleSearch()}
              icon={<Search className="h-3.5 w-3.5" />}
              className="mt-4"
            >
              Search Data Science
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}