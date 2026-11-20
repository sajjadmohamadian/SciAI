import React, { useState } from "react";
import {
  Search,
  UserCheck,
  Download,
  BookOpen,
  Quote,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Building2,
  FileText,
  Filter,
} from "lucide-react";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { AlertBanner, Button, Card } from "./CommonUI.js";
import { useAuth } from "../context/AuthContext.js";

export interface OrcidWorkItem {
  put_code: number;
  title: string;
  year: number | null;
  type: string;
  journal: string;
  doi: string;
  url: string;
  authors: string[];
  citations: number;
  keywords: string[];
  abstract: string;
  enriched_from_openalex: boolean;
}

export interface OrcidProfileData {
  orcid: string;
  name: string;
  credit_name: string;
  other_names: string[];
  biography: string;
  affiliation: string;
  total_works: number;
  works_with_doi: number;
  works: OrcidWorkItem[];
}

interface Props {
  onDatasetCreated: (datasetId: string) => void;
}

export function OrcidImporter({ onDatasetCreated }: Props) {
  const { user, linkOrcid } = useAuth();
  const [orcidInput, setOrcidInput] = useState(user?.orcid || "");
  const [enrichOpenAlex, setEnrichOpenAlex] = useState(true);
  const [customDatasetName, setCustomDatasetName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [profile, setProfile] = useState<OrcidProfileData | null>(null);
  const [selectedPutCodes, setSelectedPutCodes] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFetchProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = orcidInput
      .trim()
      .replace(/^https?:\/\/(www\.)?orcid\.org\//i, "")
      .trim();
    if (!cleaned) {
      setErrorMsg("Please enter a valid 16-digit ORCID identifier (e.g., 0000-0002-1825-0097).");
      return;
    }

    setLoadingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProfile(null);

    try {
      const data = await apiJson<{ success: boolean; profile: OrcidProfileData }>(
        `/api/orcid/profile/${encodeURIComponent(cleaned)}?enrich=${enrichOpenAlex ? "true" : "false"}`
      );
      setProfile(data.profile);
      setSelectedPutCodes(new Set(data.profile.works.map((w) => w.put_code)));
      setCustomDatasetName(
        `ORCID: ${data.profile.name} (${data.profile.orcid} · ${data.profile.total_works} works)`
      );
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Could not retrieve ORCID record."));
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleImportCorpus = async () => {
    if (!profile || selectedPutCodes.size === 0) return;

    setImporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await apiJson<{
        success: boolean;
        dataset: { id: string; name: string };
        documents_count: number;
      }>("/api/orcid/import", {
        orcid: (profile?.orcid || orcid || "").trim(),
        enrich_openalex: enrichOpenAlex,
        dataset_name: customDatasetName.trim() || undefined,
        put_codes: Array.from(selectedPutCodes),
      });

      setSuccessMsg(
        `Successfully imported ${result.documents_count} works into corpus "${result.dataset.name}".`
      );
      onDatasetCreated(result.dataset.id);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to import ORCID corpus."));
    } finally {
      setImporting(false);
    }
  };

  const toggleWorkSelection = (putCode: number) => {
    setSelectedPutCodes((prev) => {
      const next = new Set(prev);
      if (next.has(putCode)) next.delete(putCode);
      else next.add(putCode);
      return next;
    });
  };

  const filteredWorks = profile
    ? profile.works.filter((w) => {
        if (!filterText.trim()) return true;
        const q = filterText.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.journal.toLowerCase().includes(q) ||
          w.doi.toLowerCase().includes(q) ||
          String(w.year || "").includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-5">
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 border-b border-border-default pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                iD
              </span>
              <h2 className="text-base font-black text-ink-primary sm:text-lg">
                ORCID Researcher Corpus Importer
              </h2>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Public API v3.0
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Enter any 16-digit ORCID iD or profile URL to fetch all public publications and automatically build an analyzable bibliometric corpus.
            </p>
          </div>
        </div>

        <form onSubmit={handleFetchProfile} className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
              ORCID Identifier or URL
            </label>
            <input
              type="text"
              value={orcidInput}
              onChange={(e) => setOrcidInput(e.target.value)}
              placeholder="e.g., 0000-0002-1825-0097 or https://orcid.org/..."
              className="w-full rounded-xl border border-border-default bg-surface-canvas px-3.5 py-2.5 font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-end lg:col-span-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border-default bg-surface-subtle/60 px-3 py-2.5 text-xs font-semibold text-ink-primary">
              <input
                type="checkbox"
                checked={enrichOpenAlex}
                onChange={(e) => setEnrichOpenAlex(e.target.checked)}
                className="h-4 w-4 rounded border-border-default text-brand-500 focus:ring-brand-500"
              />
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Enrich via OpenAlex</span>
            </label>
          </div>

          <div className="flex flex-col justify-end lg:col-span-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loadingProfile || !orcidInput.trim()}
              icon={<Search className="h-4 w-4" />}
              className="w-full justify-center"
            >
              {loadingProfile ? "Fetching ORCID..." : "Fetch Researcher Works"}
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
          <span>Quick test examples:</span>
          {[
            { label: "0000-0002-1825-0097 (Josiah Carberry)", id: "0000-0002-1825-0097" },
            { label: "0000-0003-1419-2405 (Loet Leydesdorff)", id: "0000-0003-1419-2405" },
          ].map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => setOrcidInput(sample.id)}
              className="cursor-pointer rounded-lg border border-border-default bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-ink-secondary hover:border-brand-500 hover:text-ink-primary"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </Card>

      {errorMsg && <AlertBanner tone="danger">{errorMsg}</AlertBanner>}
      {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}

      {profile && (
        <Card padding="md" className="space-y-4">
          <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-4 lg:flex-row lg:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-black text-ink-primary">{profile.name}</h3>
                <a
                  href={`https://orcid.org/${profile.orcid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  {profile.orcid}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {profile.affiliation && (
                <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <Building2 className="h-3.5 w-3.5 text-ink-muted" />
                  <span>{profile.affiliation}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-ink-muted">
                <span className="tabular-metrics font-semibold text-ink-primary">
                  {profile.total_works} total works
                </span>
                <span>·</span>
                <span className="tabular-metrics">
                  {profile.works_with_doi} with DOI
                </span>
                <span>·</span>
                <span className="tabular-metrics">
                  {profile.works.filter((w) => w.enriched_from_openalex).length} enriched with citations/keywords
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={customDatasetName}
                onChange={(e) => setCustomDatasetName(e.target.value)}
                aria-label="Target Corpus Dataset Name"
                className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-xs font-semibold text-ink-primary sm:w-72 focus:border-brand-500 focus:outline-none"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={importing || selectedPutCodes.size === 0}
                onClick={handleImportCorpus}
                icon={<Download className="h-4 w-4" />}
              >
                {importing
                  ? "Building Corpus..."
                  : `Import ${selectedPutCodes.size} Works as Corpus`}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Filter className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter works by title, journal, year, or DOI..."
                className="w-full rounded-xl border border-border-default bg-surface-canvas py-1.5 pl-8 pr-3 text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedPutCodes(new Set(profile.works.map((w) => w.put_code)))}
                className="cursor-pointer rounded-lg border border-border-default px-2.5 py-1 font-semibold text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
              >
                Select All ({profile.works.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPutCodes(new Set())}
                className="cursor-pointer rounded-lg border border-border-default px-2.5 py-1 font-semibold text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-[460px] divide-y divide-border-default overflow-y-auto rounded-xl border border-border-default">
            {filteredWorks.map((work) => {
              const checked = selectedPutCodes.has(work.put_code);
              return (
                <label
                  key={work.put_code}
                  className={`flex cursor-pointer items-start gap-3 p-3.5 transition-colors ${
                    checked ? "bg-surface-canvas" : "bg-surface-subtle/40 opacity-65"
                  } hover:bg-surface-subtle`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWorkSelection(work.put_code)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-border-default text-brand-500 focus:ring-brand-500"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-ink-primary sm:text-sm">
                        {work.title}
                      </span>
                      {work.enriched_from_openalex && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Enriched
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                      {work.year && (
                        <span className="tabular-metrics font-bold text-ink-secondary">
                          {work.year}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {work.journal}
                      </span>
                      <span className="flex items-center gap-1 capitalize">
                        <FileText className="h-3 w-3" />
                        {work.type}
                      </span>
                      {work.citations > 0 && (
                        <span className="tabular-metrics flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400">
                          <Quote className="h-3 w-3" />
                          {work.citations} citations
                        </span>
                      )}
                      {work.doi && (
                        <span className="font-mono text-[10px] text-ink-secondary">
                          DOI: {work.doi}
                        </span>
                      )}
                    </div>
                    {work.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {work.keywords.slice(0, 5).map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-surface-subtle px-2 py-0.5 text-[10px] text-ink-secondary"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
