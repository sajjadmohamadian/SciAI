import React from "react";
import { BRAND } from "../brand.js";
import { NavTab } from "./Sidebar.js";
import { Menu } from "lucide-react";

interface Props {
  activeTab: NavTab;
  onToggleMobileNav?: () => void;
  onRefresh?: () => void;
}

export function Header({
  activeTab,
  onToggleMobileNav,
}: Props) {
  const titles: Record<NavTab, { label: string; subtitle?: string }> = {
    overview: { label: "Overview" },
    "corpus-pipeline": { label: "Dataset & Corpus Pipeline" },
    descriptive: { label: "Descriptive Analytics" },
    entities: { label: "Entity Explorer" },
    thematic: { label: "Thematic Evolution" },
    frontier: { label: "Dynamics & Frontier Detection" },
    historical: { label: "HistCite & RPYS" },
    collaboration: { label: "Network Analysis" },
    ml: { label: "Machine Learning" },
    benchmark: { label: "Comparative Benchmarking" },
    powerbi: { label: "Power BI Live Connector" },
    reports: { label: "Executive Reports" },
    ai: { label: "AI Research Assistance" },
  };

  const current = titles[activeTab] || titles.overview;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="flex h-16 items-center px-5 sm:px-8">
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#315C7C]">
              <span>{BRAND.name}</span>
              <span className="h-1 w-1 rounded-full bg-[#6E8B3D]" />
              <span>{BRAND.shellDescriptor}</span>
            </div>

            <div className="text-sm font-bold tracking-tight text-[#101820]">
              {current.label}
            </div>

            {current.subtitle && (
              <div className="hidden text-[11px] font-medium text-slate-500 sm:block">
                {current.subtitle}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

