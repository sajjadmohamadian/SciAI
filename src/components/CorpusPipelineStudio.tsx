import React, { useState, useEffect } from "react";
import { Dataset } from "../types.js";
import { DatasetsView } from "./DatasetsView.js";
import { OpenAlexExplorer } from "./OpenAlexExplorer.js";
import { SmartMergeStudio } from "./SmartMergeStudio.js";
import { DataHygieneStudio } from "./DataHygieneStudio.js";
import { AlertBanner } from "./CommonUI.js";
import {
  Database,
  Globe2,
  GitMerge,
  ShieldCheck,
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
  const [activeStep, setActiveStep] = useState<PipelineStep>(
    initialStep === "prisma" ? "hygiene" : initialStep
  );

  useEffect(() => {
    if (initialStep) {
      const normalizedStep = initialStep === "prisma" ? "hygiene" : initialStep;
      if (normalizedStep !== activeStep) {
        setActiveStep(normalizedStep);
      }
    }
  }, [initialStep]);

  const handleStepSelect = (step: PipelineStep) => {
    const normalizedStep = step === "prisma" ? "hygiene" : step;
    setActiveStep(normalizedStep);
    onStepChange?.(normalizedStep);
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
      <div className="sciai-studio-shell p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="sciai-kicker">Unified Workspace</span>
              <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-[10px] font-bold text-status-success-text">
                Dataset & Research Corpus Pipeline
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary">
              Dataset Acquisition & Research Corpus Harmonization Pipeline
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
              End-to-end data preparation workflow: ingest bibliographic files, query the OpenAlex
              live graph, fuse heterogeneous data sources with schema alignment, and synthesize
              PRISMA 2020 extraction outcomes with multi-provider AI.
            </p>
          </div>
        </div>

        {/* 4-Step Interactive Pipeline Progress Bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepSelect(s.id)}
                className={`relative flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? "border-brand-600/20 bg-brand-500 text-white shadow-xs"
                    : "border-border-default bg-surface-canvas text-ink-secondary hover:border-border-strong hover:bg-surface-canvas/80"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "border border-border-subtle bg-surface-subtle text-brand-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? "text-brand-100" : "text-ink-subtle"
                      }`}
                    >
                      Step {s.stepNumber}
                    </span>
                    <span
                      className={`tabular-metrics rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "border border-border-subtle bg-surface-subtle text-ink-secondary"
                      }`}
                    >
                      {s.badge}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-bold">{s.title}</div>
                  <div
                    className={`truncate text-[11px] ${
                      isActive ? "text-brand-100" : "text-ink-muted"
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
              handleStepSelect("repository");
            }}
          />
        )}

        {activeStep === "merge" && (
          <SmartMergeStudio datasets={datasets} onRefreshData={onRefreshData} />
        )}

        {activeStep === "hygiene" && (
          <div className="space-y-4">
            {!currentDataset ? (
              <AlertBanner tone="info">
                Upload a dataset to use the PRISMA and Hygiene tools.
              </AlertBanner>
            ) : (
              <div key={currentDataset.id}>
                <DataHygieneStudio
                  datasets={datasets}
                  selectedDatasetId={currentDataset.id}
                  onRefreshData={onRefreshData}
                  initialSubTab={initialStep === "prisma" ? "prisma" : "health"}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}