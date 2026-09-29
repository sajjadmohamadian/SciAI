import React, { useState, useMemo, useEffect } from "react";
import { BRAND } from "../brand.js";
import { Project } from "../types.js";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  Users,
  BookOpen,
  Hash,
  Share2,
  Sparkles,
  GitMerge,
  FileText,
  BrainCircuit,
  Scale,
  GitBranch,
  History,
  Flame,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  ShieldCheck,
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

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

function BrandMark() {
  return (
    <div aria-hidden="true" className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[#315C7C]/25 bg-[#101820] text-white shadow-xs">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M8 25.5 17.5 16 28 21" fill="none" stroke="#8AA9BE" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M15.5 12 24 8" fill="none" stroke="#6E8B3D" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="25.5" r="2.1" fill="#6E8B3D" />
        <circle cx="17.5" cy="16" r="2" fill="#F7F8F6" />
        <circle cx="28" cy="21" r="2.1" fill="#B7832F" />
        <circle cx="24" cy="8" r="1.8" fill="#6D5BA6" />
      </svg>
      <span className="relative text-[13px] font-bold tracking-[-0.04em]">S</span>
    </div>
  );
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "data-pipeline",
    title: "Acquisition & Hygiene",
    items: [
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
    ],
  },
  {
    id: "bibliometrics",
    title: "Scientometrics",
    items: [
      {
        id: "descriptive",
        label: "Descriptive Analytics",
        icon: <LineChart className="h-4 w-4 text-blue-600" />,
        description: "Macro Trends, Grants, Lotka & Bradford",
      },
      {
        id: "entities",
        label: "Entity Explorer",
        icon: <Compass className="h-4 w-4 text-purple-600" />,
        description: "Authors, Sources, Affiliations & Grants",
      },
    ],
  },
  {
    id: "temporal-networks",
    title: "Longitudinal & Networks",
    items: [
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
        label: "Network Studio",
        icon: <Share2 className="h-4 w-4 text-sky-500" />,
        description: "VOSviewer Graphs",
      },
    ],
  },
  {
    id: "ai-intelligence",
    title: "Advanced Research Assistance",
    items: [
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
    ],
  },
  {
    id: "delivery",
    title: "Exports & Enterprise BI",
    items: [
      {
        id: "powerbi",
        label: "Power BI Connector",
        icon: <BarChart3 className="h-4 w-4 text-amber-500" />,
        description: "Streaming Direct Feeds",
      },
      {
        id: "reports",
        label: "Executive Reports",
        icon: <FileText className="h-4 w-4 text-rose-500" />,
        description: "Dossiers & Exports",
      },
    ],
  },
];

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  project?: Project;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  onChangeTab,
  project,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand group containing active tab
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) => item.id === activeTab)
    );
    if (activeGroup && collapsedGroups[activeGroup.id]) {
      setCollapsedGroups((prev) => ({ ...prev, [activeGroup.id]: false }));
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Filter groups and items based on search query
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return NAV_GROUPS;

    return NAV_GROUPS.map((group) => {
      const matchingItems = group.items.filter((item) => {
        return (
          item.label.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
        );
      });

      return {
        ...group,
        items: matchingItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const totalMatches = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredGroups]);

  const handleSelectTab = (tab: NavTab) => {
    onChangeTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex h-full flex-col bg-white">
      {/* Brand Header */}
      <div className="flex h-18 items-center justify-between border-b border-[#D8DDD8] bg-[#F7F8F6]/80 px-5">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-[#101820]">
              {BRAND.name}
              <span className="rounded-md border border-[#D8DDD8] bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#27313C]">
                {BRAND.version}
              </span>
            </div>
            <div className="text-[10px] font-semibold text-[#315C7C]">
              {BRAND.shellDescriptor}
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

      {/* Quick Search Filter */}
      <div className="px-3 pt-3 pb-1 border-b border-slate-100">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter studios & tools..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-1.5 px-1 text-[10px] text-slate-500 flex justify-between items-center">
            <span>
              {totalMatches} {totalMatches === 1 ? "match" : "matches"} found
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

      {/* Grouped Navigation List */}
      <nav className="flex-1 space-y-4 px-3 py-3 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="py-8 px-2 text-center text-xs text-slate-400">
            No matching studios for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]) && !searchQuery;
            const hasActiveChild = group.items.some((i) => i.id === activeTab);

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Header / Accordion Toggle */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer select-none"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {group.title}
                    {hasActiveChild && (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                    )}
                  </span>
                  <span className="text-slate-400">
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </button>

                {/* Group Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 pt-0.5">
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? "border border-[#315C7C]/25 bg-[#315C7C] text-white shadow-xs"
                              : "text-[#27313C] hover:bg-[#F7F8F6] hover:text-[#101820]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={isActive ? "text-white" : ""}>
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Workspace Footer Card */}
      <div className="border-t border-slate-200 p-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
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
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {content}
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sliding Panel */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

