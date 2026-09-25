import React, { useState, useMemo, useEffect } from "react";
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
  Globe2,
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
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "data-pipeline",
    title: "Phase 1: Acquisition & Hygiene",
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
        badge: "Phase 1",
        badgeColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
        description: "Unified 4-Step Dataset Studio",
      },
    ],
  },
  {
    id: "bibliometrics",
    title: "Phase 2 & 3 Scientometrics",
    items: [
      {
        id: "descriptive",
        label: "Descriptive Analytics",
        icon: <LineChart className="h-4 w-4 text-blue-600" />,
        badge: "Phase 2",
        badgeColor: "text-blue-700 bg-blue-50 border-blue-200",
        description: "Macro Trends, Grants, Lotka & Bradford",
      },
      {
        id: "entities",
        label: "Entity Explorer",
        icon: <Compass className="h-4 w-4 text-purple-600" />,
        badge: "Phase 3",
        badgeColor: "text-purple-700 bg-purple-50 border-purple-200",
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
        badge: "AI",
        badgeColor: "text-indigo-700 bg-indigo-50 border-indigo-200",
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
        badge: "Live Sync",
        badgeColor: "text-amber-700 bg-amber-50 border-amber-200",
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
          (item.description && item.description.toLowerCase().includes(query)) ||
          (item.badge && item.badge.toLowerCase().includes(query))
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
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white font-black text-sm shadow-xs">
            S
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-1.5">
              SciAI
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                v0.1
              </span>
            </div>
            <div className="text-[10px] font-semibold text-slate-400">
              Scientometrics & Intelligence
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
                              ? "bg-slate-950 text-white shadow-xs"
                              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={isActive ? "text-white" : ""}>
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span
                              className={`ml-1.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold border whitespace-nowrap ${
                                isActive
                                  ? "bg-white/20 text-white border-white/30"
                                  : item.badgeColor || "text-slate-600 bg-slate-100 border-slate-200"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
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
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Active Workspace
          </div>
          <div className="mt-1 truncate text-xs font-bold text-slate-900">
            {project?.name || "SciAI Research Workspace"}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            SQLite Persisted • Offline Ready
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

