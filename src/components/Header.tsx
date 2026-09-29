import React from "react";
import { BRAND } from "../brand.js";
import { NavTab } from "./Sidebar.js";
import { RefreshCw, Upload, Menu } from "lucide-react";

interface Props {
  activeTab: NavTab;
  onRefresh: () => void;
  onOpenUpload: () => void;
  onToggleMobileNav?: () => void;
}

export function Header({
  activeTab,
  onRefresh,
  onOpenUpload,
  onToggleMobileNav,
}: Props) {
  const titles: Record<NavTab, { label: string; subtitle: string }> = {
    overview: { label: "Research Overview", subtitle: "Scientometric Metrics & Visual Trends" },
    "corpus-pipeline": { label: "Dataset & Research Corpus Pipeline", subtitle: "Integrated Acquisition, Ingestion, Harmonization & PRISMA Quality Assurance" },
    "data-hygiene": { label: "Data & Hygiene", subtitle: "Dataset Management, Deduplication & PRISMA Flow Diagram" },
    datasets: { label: "Datasets & Versions", subtitle: "Bibliographic Dataset Repository & Parsers" },
    openalex: { label: "OpenAlex Explorer", subtitle: "Live Global Knowledge Graph & Citation Net" },
    merge: { label: "Smart Merge Studio", subtitle: "Multi-Source Harmonization & Deduplication" },
    descriptive: { label: "Descriptive Analytics", subtitle: "Macro Trends, Lotka's Law & Bradford's Law" },
    entities: { label: "Entity Explorer", subtitle: "Entity-Level Research Metrics & Profiles" },
    analyses: { label: "Corpus Analyses", subtitle: "Corpus-Level Scientometric Methods" },
    authors: { label: "Author Productivity", subtitle: "Lotka's Law & H-Index Metrics" },
    sources: { label: "Source Productivity", subtitle: "Bradford's Law of Scattering" },
    keywords: { label: "Keyword Dynamics", subtitle: "Frequency & Co-occurrence Networks" },
    thematic: { label: "Thematic Evolution & Slicing Studio", subtitle: "Longitudinal Slicing, Sankey River Flows & Inclusion Index" },
    frontier: { label: "Dynamics & Frontier Detection", subtitle: "Kleinberg's Burst Detection & Sleeping Beauties in Science" },
    historical: { label: "HistCite & RPYS (Historical)", subtitle: "Algorithmic Historiography & Reference Spectroscopy" },
    collaboration: { label: "Collaboration Network", subtitle: "Co-authorship Topology" },
    ml: { label: "Machine Learning Studio", subtitle: "K-Means, LDA Topic Modeling & Citation Impact Prediction" },
    benchmark: { label: "Comparative Benchmarking Studio", subtitle: "Biblium Cross-Dataset Hypotheses & Thematic Specificity" },
    powerbi: { label: "Power BI Live Connector", subtitle: "Direct OData / Web Feed & Star-Schema Relational Model" },
    reports: { label: "Executive Reports Studio", subtitle: "Publication-Ready Summaries & Multi-Format Export" },
    ai: { label: "AI Research Assistance", subtitle: "Multi-provider AI-Assisted Synthesis" },
  };

  const current = titles[activeTab] || titles.overview;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
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
            <div className="text-sm font-bold text-[#101820] tracking-tight">
              {current.label}
            </div>
            <div className="hidden text-[11px] font-medium text-slate-500 sm:block">
              {current.subtitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Upload className="h-3 w-3" />
            <span className="hidden sm:inline">Upload Dataset</span>
          </button>

        </div>
      </div>
    </header>
  );
}
