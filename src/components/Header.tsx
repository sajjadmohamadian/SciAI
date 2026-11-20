import React from "react";
import { BRAND } from "../brand.js";
import { NavTab } from "./Sidebar.js";
import { Menu, LogOut, ShieldCheck, User, Laptop, RefreshCw } from "lucide-react";

interface Props {
  activeTab: NavTab;
  onToggleMobileNav?: () => void;
  onRefresh?: () => void;
  onLogout?: () => void;
  userRole?: "admin" | "user";
  userOrcid?: string | null;
  syncingOrcid?: boolean;
  onSyncMyOrcid?: () => void;
}

export function Header({
  activeTab,
  onToggleMobileNav,
  onLogout,
  userRole,
  userOrcid,
  syncingOrcid,
  onSyncMyOrcid,
}: Props) {
  const titles: Record<NavTab, { label: string; subtitle?: string }> = {
    overview: { label: "Overview" },
    "corpus-pipeline": { label: "Dataset & Corpus Pipeline" },
    "data-hygiene": { label: "Dataset & Corpus Pipeline" },
    datasets: { label: "Dataset & Corpus Pipeline" },
    openalex: { label: "Dataset & Corpus Pipeline" },
    merge: { label: "Dataset & Corpus Pipeline" },
    descriptive: { label: "Descriptive Analytics" },
    analyses: { label: "Descriptive & Entity Analytics" },
    entities: { label: "Entity Explorer" },
    authors: { label: "Entity Explorer" },
    sources: { label: "Entity Explorer" },
    keywords: { label: "Entity Explorer" },
    thematic: { label: "Thematic Evolution" },
    frontier: { label: "Dynamics & Frontier Detection" },
    historical: { label: "HistCite & RPYS" },
    collaboration: { label: "Network Analysis" },
    ml: { label: "Machine Learning" },
    benchmark: { label: "Comparative Benchmarking" },
    powerbi: { label: "Power BI Research Intelligence Export" },
    reports: { label: "Executive Reports" },
    ai: { label: "AI Research Assistance" },
    admin: { label: "User Administration" },
  };

  const current = titles[activeTab] || titles.overview;

  const roleMeta =
    userRole === "admin"
      ? {
          label: "Administrator",
          icon: <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />,
          tone: "border-brand-200 bg-brand-50 text-brand-700",
        }
      : userRole === "user"
        ? {
            label: "Researcher",
            icon: <User className="h-3.5 w-3.5 text-ink-secondary" />,
            tone: "border-border-default bg-surface-subtle text-ink-secondary",
          }
        : {
            label: "Local workspace",
            icon: <Laptop className="h-3.5 w-3.5 text-ink-muted" />,
            tone: "border-border-default bg-surface-subtle text-ink-muted",
          };

  return (
    <header className="sticky top-0 z-20 border-b border-border-default bg-surface-canvas/95 backdrop-blur-xs">
      <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
        {/* Left: Mobile Nav Trigger + Breadcrumb & Active Studio Title */}
        <div className="flex min-w-0 items-center gap-3">
          {onToggleMobileNav && (
            <button
              type="button"
              aria-label="Open navigation"
              onClick={onToggleMobileNav}
              className="rounded-xl border border-transparent p-1.5 text-ink-secondary transition-colors hover:border-border-default hover:bg-surface-subtle hover:text-ink-primary lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-brand-500">
              <span>{BRAND.name}</span>
              <span className="h-1 w-1 rounded-full bg-brand-400" />
              <span className="truncate">{BRAND.shellDescriptor}</span>
            </div>

            <h1 className="truncate text-sm font-bold tracking-tight text-ink-primary">
              {current.label}
            </h1>

            {current.subtitle && (
              <p className="hidden truncate text-[11px] font-medium text-ink-muted sm:block">
                {current.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Session Role Badge & Sign-Out Action */}
        <div className="flex shrink-0 items-center gap-2.5">
          {userOrcid && onSyncMyOrcid && (
            <button
              type="button"
              onClick={onSyncMyOrcid}
              disabled={syncingOrcid}
              title={`Connected ORCID: ${userOrcid} — Click to sync all publications into a corpus`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white">
                iD
              </span>
              <RefreshCw className={`h-3 w-3 ${syncingOrcid ? "animate-spin" : ""}`} />
              <span>{syncingOrcid ? "Syncing ORCID..." : "Sync My ORCID Corpus"}</span>
            </button>
          )}

          

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-border-default bg-surface-canvas text-ink-secondary transition-colors hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger-text cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}