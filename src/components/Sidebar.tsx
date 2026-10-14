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
  | "ai";

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
    id: "entities",
    label: "Entity Explorer",
    icon: <Compass className="h-4 w-4 text-blue-600" />,
    description: "Authors, Sources, Affiliations & Grants",
  },
  {
    id: "descriptive",
    label: "Descriptive Analytics",
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
    id: "ai",
    label: "AI Research Assistance",
    icon: <Sparkles className="h-4 w-4 text-indigo-500" />,
    description: "AI-Assisted Synthesis",
  },
  {
    id: "powerbi",
    label: "Power BI Connector",
    icon: <BarChart3 className="h-4 w-4 text-amber-500" />,
    description: "Governed Research Exports",
  },
  {
    id: "reports",
    label: "Executive Reports",
    icon: <FileText className="h-4 w-4 text-rose-500" />,
    description: "Dossiers & Exports",
  },
];

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  project?: Project;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#315C7C]/25 bg-[#101820] text-white shadow-xs">
      <span className="text-[13px] font-bold tracking-[-0.04em]">
        S
      </span>
    </div>
  );
}

export function Sidebar({
  activeTab,
  onChangeTab,
  project,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return NAV_ITEMS;
    }

    return NAV_ITEMS.filter((item) => {
      return (
        item.label.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        Boolean(item.description?.toLowerCase().includes(query))
      );
    });
  }, [searchQuery]);

  const handleSelectTab = (tab: NavTab) => {
    onChangeTab(tab);

    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-18 items-center justify-between border-b border-[#D8DDD8] bg-[#F7F8F6]/80 px-5">
        <div className="flex items-center gap-3">
          <BrandMark />

          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-[#101820]">
              <span>{BRAND.name}</span>

              <span className="rounded-md border border-[#D8DDD8] bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#27313C]">
                {BRAND.version}
              </span>
            </div>

            <div className="text-[10px] font-semibold text-[#315C7C]">
              <span>{BRAND.shellDescriptor}</span>
            </div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="border-b border-slate-100 px-3 pb-2 pt-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter studios & tools..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 transition focus:border-slate-900 focus:bg-white focus:outline-hidden"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searchQuery && (
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-500">
            <span>
              {filteredItems.length}{" "}
              {filteredItems.length === 1 ? "match" : "matches"} found
            </span>

            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[10px] font-semibold text-slate-700 hover:underline"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {filteredItems.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-slate-400">
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
                  className={
                    isActive
                      ? "flex w-full items-center rounded-xl border border-[#315C7C]/25 bg-[#315C7C] px-2.5 py-2.5 text-xs font-semibold text-white shadow-xs transition"
                      : "flex w-full items-center rounded-xl px-2.5 py-2.5 text-xs font-semibold text-[#27313C] transition hover:bg-[#F7F8F6] hover:text-[#101820]"
                  }
                >
                  <span className="mr-2.5 flex shrink-0 items-center justify-center">
                    {item.icon}
                  </span>

                  <span className="min-w-0 truncate text-left">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3">
          <div className="text-[10px] font-bold text-[#315C7C]">
            Workspace
          </div>

          <div className="mt-1 truncate text-xs font-bold text-[#101820]">
            {project?.name || `${BRAND.name} Research Intelligence`}
          </div>

          <div className="mt-0.5 text-[10px] text-[#27313C]/60">
            Local evidence store · Offline ready
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}