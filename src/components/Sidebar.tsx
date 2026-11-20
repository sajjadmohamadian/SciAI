import { useAuth } from "../context/AuthContext.js";
import { Settings, LogOut, KeyRound } from "lucide-react";
import sciaiMark from "../assets/sciai-mark.png";
import React, { useMemo, useState } from "react";
import { BRAND } from "../brand.js";
import { Project } from "../types.js";
import {
  LayoutDashboard,
  BarChart3,
  Share2,
  Sparkles,
  FileText,
  BrainCircuit,
  Scale,
  GitBranch,
  History,
  Flame,
  Search,
  X,
  Compass,
  LineChart,
  Layers,
  ShieldCheck,
} from "lucide-react";

export type NavTab =
  | "overview"
  | "corpus-pipeline"
  | "data-hygiene"
  | "datasets"
  | "openalex"
  | "merge"
  | "descriptive"
  | "entities"
  | "analyses"
  | "authors"
  | "sources"
  | "keywords"
  | "thematic"
  | "frontier"
  | "historical"
  | "collaboration"
  | "ml"
  | "benchmark"
  | "powerbi"
  | "reports"
  | "ai"
  | "admin";

export interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
    description: "Cockpit & KPIs",
  },
  {
    id: "corpus-pipeline",
    label: "Dataset & Corpus Pipeline",
    icon: <Layers className="h-4 w-4 text-emerald-600" />,
    description: "Unified 4-Step Dataset Studio",
  },
  {
    id: "descriptive",
    label: "Descriptive & Entity Analytics",
    icon: <LineChart className="h-4 w-4 text-purple-600" />,
    description: "Macro Trends, Grants, Lotka & Bradford",
  },
  {
    id: "thematic",
    label: "Thematic Evolution",
    icon: <GitBranch className="h-4 w-4 text-purple-600" />,
    description: "Time Slicing & River Flows",
  },
  {
    id: "frontier",
    label: "Dynamics & Frontiers",
    icon: <Flame className="h-4 w-4 text-rose-600" />,
    description: "Bursts & Sleeping Beauties",
  },
  {
    id: "historical",
    label: "HistCite & RPYS",
    icon: <History className="h-4 w-4 text-amber-600" />,
    description: "Genealogy & Spectroscopy",
  },
  {
    id: "collaboration",
    label: "Network Analysis",
    icon: <Share2 className="h-4 w-4 text-sky-500" />,
    description: "VOSviewer Graphs",
  },
  {
    id: "ml",
    label: "Machine Learning",
    icon: <BrainCircuit className="h-4 w-4 text-emerald-600" />,
    description: "K-Means, LDA & Prediction",
  },
  {
    id: "benchmark",
    label: "Benchmarking",
    icon: <Scale className="h-4 w-4 text-indigo-600" />,
    description: "Biblium Cross-Validation",
  },
  {
    id: "powerbi",
    label: "Power BI Connector",
    icon: <BarChart3 className="h-4 w-4 text-amber-500" />,
    description: "Governed Research Exports",
  },
  {
    id: "reports",
    label: "AI & Executive Reports",
    icon: <FileText className="h-4 w-4 text-rose-500" />,
    description: "Synthesis, Dossiers & Exports",
  },
  {
    id: "admin",
    label: "User Administration",
    icon: <ShieldCheck className="h-4 w-4 text-ink-secondary" />,
    description: "Admin-only account management",
  },
];

interface Props {
  isAdmin?: boolean;
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  project?: Project;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function BrandMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-white p-1 shadow-xs">
      <img
        src={sciaiMark}
        alt="SciAI Research Intelligence"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function Sidebar({
  isAdmin = false,
  activeTab,
  onChangeTab,
  project,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const { user, logout, requestPasswordChange } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

  const displayName = React.useMemo(() => {
    const rawEmail = user?.email || "sajjad.mohammadian@gmail.com";
    const localPart = rawEmail.split("@")[0] || "Researcher";
    return localPart
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, [user?.email]);

  const initials = React.useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const roleSubtitle = user?.role === "admin" ? "Administrator" : "Researcher";
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const available = NAV_ITEMS.filter((item) => item.id !== "admin" || isAdmin);
    if (!query) return available;

    return available.filter((item) => {
      return (
        item.label.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        Boolean(item.description?.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, isAdmin]);

  const handleSelectTab = (tab: NavTab) => {
    onChangeTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex h-full flex-col bg-surface-canvas">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border-default bg-surface-subtle/80 px-5">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-ink-primary">
              <span>{BRAND.name}</span>
              <span className="rounded-md border border-border-default bg-surface-canvas px-1.5 py-0.5 text-[9px] font-bold text-ink-secondary">
                {BRAND.version}
              </span>
            </div>
            <div className="text-[10px] font-semibold text-brand-500">
              <span>{BRAND.shellDescriptor}</span>
            </div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary lg:hidden cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Studio Filter Search */}
      <div className="border-b border-border-subtle px-3 pb-2.5 pt-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter studios & tools..."
            className="w-full rounded-lg border border-border-default bg-surface-subtle py-1.5 pl-8 pr-7 text-xs text-ink-primary placeholder:text-ink-subtle transition-colors focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 p-0.5 text-ink-subtle transition-colors hover:text-ink-primary cursor-pointer"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searchQuery && (
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-ink-muted">
            <span className="tabular-metrics">
              {filteredItems.length} {filteredItems.length === 1 ? "match" : "matches"} found
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[10px] font-semibold text-brand-500 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
        {filteredItems.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-ink-subtle">
            No matching studios for "{searchQuery}"
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  title={item.description}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "flex w-full items-center rounded-xl border border-brand-600/20 bg-brand-500 px-2.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                      : "flex w-full items-center rounded-xl px-2.5 py-2.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary cursor-pointer"
                  }
                >
                  <span
                    className={`mr-2.5 flex shrink-0 items-center justify-center ${
                      isActive ? "[&>svg]:text-white!" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Gemini-Style Bottom-Left User Profile & Settings Footer */}
      <div className="relative border-t border-border-default p-3">
        {profileMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl border border-border-default bg-surface-canvas p-1.5 shadow-elevated">
            <div className="border-b border-border-default px-3 py-2">
              <div className="truncate text-xs font-bold text-ink-primary">
                {displayName}
              </div>
              <div className="truncate font-mono text-[10px] text-ink-muted">
                {user?.email || "admin@sciai.local"}
              </div>
            </div>

            {user?.role === "admin" && (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onChangeTab("admin");
                  onCloseMobile();
                }}
                className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
                <span>User Administration</span>
              </button>
            )}

            {requestPasswordChange && (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  requestPasswordChange();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary"
              >
                <KeyRound className="h-3.5 w-3.5 text-ink-muted" />
                <span>Change Password</span>
              </button>
            )}

            {logout && (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void logout();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-status-danger-text transition-colors hover:bg-status-danger-bg"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2.5 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-subtle">
          <div className="flex min-w-0 items-center gap-3">
            {/* Circular Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white ring-2 ring-brand-500/20">
              {initials}
            </div>

            {/* Name & Role Subtitle */}
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-ink-primary">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-xs text-ink-muted">
                {roleSubtitle}
              </div>
            </div>
          </div>

          {/* Settings Gear Button */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            title="Account & Settings"
            aria-label="Account & Settings"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink-primary"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border-default bg-surface-canvas lg:flex lg:flex-col">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-surface-dark/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-elevated">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
