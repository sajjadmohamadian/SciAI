import React, { useState, useEffect } from "react";
import { Dataset } from "../types.js";
import { DatasetsView } from "./DatasetsView.js";
import { OpenAlexExplorer } from "./OpenAlexExplorer.js";
import { SmartMergeStudio } from "./SmartMergeStudio.js";
import { DataHygieneStudio } from "./DataHygieneStudio.js";
import { PrismaExtractionReportStudio } from "./PrismaExtractionReportStudio.js";
import {
  Database,
  Globe2,
  GitMerge,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Upload,
  CheckCircle2,
  RefreshCw,
  FileText,
} from "lucide-react";

export type PipelineStep = "repository" | "openalex" | "merge" | "hygiene" | "prisma";

interface Props {
  datasets: Dataset[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
  onOpenUpload: () => void;
  onOpenDescriptive: (datasetId: string) => void;
  onRefreshData: () => void;
  onDatasetDeleted?: (deletedDatasetIds: string[]) => void;
  initialStep?: PipelineStep;
  onStepChange?: (step: PipelineStep) => void;
}

export function CorpusPipelineStudio({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  onOpenUpload,
  onOpenDescriptive,
  onRefreshData,
  onDatasetDeleted,
  initialStep = "repository",
  onStepChange,
}: Props) {
  const [activeStep, setActiveStep] = useState<PipelineStep>(initialStep);
  const [hygieneSubMode, setHygieneSubMode] = useState<"prisma" | "hygiene">("prisma");

  useEffect(() => {
    if (initialStep && initialStep !== activeStep) {
      if (initialStep === "prisma") {
        setActiveStep("hygiene");
        setHygieneSubMode("prisma");
      } else {
        setActiveStep(initialStep);
      }
    }
  }, [initialStep]);

  const handleStepSelect = (step: PipelineStep) => {
    setActiveStep(step);
    onStepChange?.(step);
  };

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  const steps = [
    {
      id: "repository" as PipelineStep,
      stepNumber: "1",
      title: "Dataset Repository",
      subtitle: "Files & Versions",
      icon: Database,
      badge: `${datasets.length} Datasets`,
    },
    {
      id: "openalex" as PipelineStep,
      stepNumber: "2",
      title: "OpenAlex Explorer",
      subtitle: "Live Global Fetch",
      icon: Globe2,
      badge: "250M+ Works",
    },
    {
      id: "merge" as PipelineStep,
      stepNumber: "3",
      title: "Smart Merge",
      subtitle: "Multi-Source Fusion",
      icon: GitMerge,
      badge: "Cross-DB",
    },
    {
      id: "hygiene" as PipelineStep,
      stepNumber: "4",
      title: "PRISMA & Hygiene",
      subtitle: "AI Report & Audit",
      icon: ShieldCheck,
      badge: "PRISMA 2020",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Pipeline Workflow Stepper */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Unified Workspace
              </span>
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700">
                Dataset & Research Corpus Pipeline
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Dataset Acquisition & Research Corpus Harmonization Pipeline
            </h1>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              End-to-end data preparation workflow: ingest bibliographic files, query the OpenAlex live graph, fuse heterogeneous data sources with schema alignment, and synthesize PRISMA 2020 extraction outcomes with multi-provider AI.
            </p>
          </div>

        </div>

        {/* 4-Step Interactive Pipeline Progress Bar */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepSelect(s.id)}
                className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow-xs ring-1 ring-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      Step {s.stepNumber}
                    </span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold truncate mt-0.5">
                    {s.title}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      isActive ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {s.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Body */}
      <div className="transition-all duration-200">
        {activeStep === "repository" && (
          <DatasetsView
            datasets={datasets}
            onOpenUpload={onOpenUpload}
            onOpenDescriptive={onOpenDescriptive}
            onDatasetDeleted={onDatasetDeleted}
          />
        )}

        {activeStep === "openalex" && (
          <OpenAlexExplorer
            onDatasetCreated={(newId) => {
              onRefreshData();
              onSelectDataset?.(newId);
              handleStepSelect("hygiene");
            }}
          />
        )}

        {activeStep === "merge" && (
          <SmartMergeStudio
            datasets={datasets}
            onRefreshData={onRefreshData}
          />
        )}

        {activeStep === "hygiene" && (
          <div className="space-y-4">
            {/* Step 4 Sub-View Mode Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  id="tab-prisma-report"
                  onClick={() => setHygieneSubMode("prisma")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    hygieneSubMode === "prisma"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  PRISMA AI Workflow & Descriptive Report
                </button>

                <button
                  type="button"
                  id="tab-hygiene-audit"
                  onClick={() => setHygieneSubMode("hygiene")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    hygieneSubMode === "hygiene"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
                  Dataset Hygiene & Deduplication Engine
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <Database className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <select
                    aria-label="Select dataset for PRISMA and Hygiene"
                    value={currentDataset?.id || ""}
                    onChange={(event) => onSelectDataset?.(event.target.value)}
                    disabled={!datasets.length}
                    className="w-44 max-w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden disabled:text-slate-400 sm:w-56"
                  >
                    {!datasets.length && <option value="">No datasets available</option>}
                    {datasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name} ({dataset.record_count.toLocaleString()} docs)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Dataset
                </button>
              </div>
            </div>

            {!currentDataset && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Upload a dataset to use the PRISMA and Hygiene tools.
              </div>
            )}

            {/* Sub-mode 1: PRISMA AI Descriptive Report & Extraction Outcomes Generator */}
            {currentDataset && hygieneSubMode === "prisma" && (
              <div key={currentDataset.id}>
                <PrismaExtractionReportStudio
                  dataset={currentDataset}
                  allDatasets={datasets}
                  onSelectDataset={onSelectDataset}
                  onNavigateToDedup={() => setHygieneSubMode("hygiene")}
                  onRefreshData={onRefreshData}
                />
              </div>
            )}

            {/* Sub-mode 2: Detailed Hygiene, Deduplication & Record Cleaner */}
            {currentDataset && hygieneSubMode === "hygiene" && (
              <div key={currentDataset.id}>
                <DataHygieneStudio
                  datasets={datasets}
                  selectedDatasetId={currentDataset.id}
                  onRefreshData={onRefreshData}
                  initialSubTab="health"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
