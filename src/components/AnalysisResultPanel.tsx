import React, { useRef, useState } from "react";
import { Analysis, ResultRecord } from "../types.js";
import { AlertBanner, Button, Card, EmptyState, StatusBadge } from "./CommonUI.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { NetworkGraph } from "./NetworkGraph.js";
import { Sparkles, RefreshCw, BarChart3, Network, Table } from "lucide-react";
import { validateAiInterpretationResponse } from "../utils/responseValidation.js";
import { useAiProvider } from "../context/AiProviderContext.js";
import { ContextualExportToolbar } from "./ContextualExportToolbar.js";

interface Props {
  analysis: Analysis | null;
  onRefresh?: () => void;
}

export function AnalysisResultPanel({ analysis }: Props) {
  const { getAiRequestOptions } = useAiProvider();
  const [activeTab, setActiveTab] = useState<"visual" | "table" | "ai">(
    "visual"
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIsPartial, setAiIsPartial] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(
    analysis?.result?.ai_interpretation || null
  );
  const visualRef = useRef<HTMLDivElement | null>(null);

  if (!analysis) return null;

  const result = analysis.result || {};
  const records: ResultRecord[] = (
    Array.isArray(result.records) ? result.records : []
  ) as ResultRecord[];
  const scalarEntries = (
    Array.isArray(result.scalarEntries) ? result.scalarEntries : []
  ) as Array<[string, unknown]>;
  const metadata =
    result.metadata && typeof result.metadata === "object"
      ? (result.metadata as Record<string, unknown>)
      : {};
  const capabilityId =
    analysis.capability_id || analysis.analysis_type || "analysis";

  const columns: string[] = [];
  if (records.length > 0 && records[0] && typeof records[0] === "object") {
    const keys = Object.keys(records[0]);
    keys.forEach((k) => {
      if (!["id", "_id"].includes(k)) columns.push(k);
    });
  }

  const filteredRecords = records.filter((r) => {
    if (!filterQuery) return true;
    return Object.values(r).some((v) =>
      String(v).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  const handleGenerateAiInsight = async () => {
    try {
      setIsGeneratingAi(true);
      setAiError(null);
      setAiIsPartial(false);
      const res = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_id: analysis.id,
          capability_id: capabilityId,
          records: records.slice(0, 20),
          metadata,
          ...getAiRequestOptions(),
        }),
      });
      const data = await res.json();
      const val = validateAiInterpretationResponse(data);
      if (val.success && val.data) {
        setAiInsight(val.data);
        if (val.isPartial) {
          setAiIsPartial(true);
        }
        setActiveTab("ai");
      } else {
        setAiError(
          val.error || "Failed to generate valid AI interpretation."
        );
        setActiveTab("ai");
      }
    } catch (err) {
      console.error("AI Insight generation error:", err);
      setAiError(
        err instanceof Error
          ? err.message
          : "Error contacting AI interpretation service"
      );
      setActiveTab("ai");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const isCoAuthorship = capabilityId === "author.co_authorship";
  const graphRows = records.filter(
    (record) => record.author_1 != null && record.author_2 != null
  );
  const contextualGraph =
    graphRows.length > 0
      ? {
          nodes: Array.from(
            new Set(
              graphRows.flatMap((record) => [
                String(record.author_1),
                String(record.author_2),
              ])
            )
          ).map((id) => ({ id, label: id })),
          edges: graphRows.map((record) => ({
            source: String(record.author_1),
            target: String(record.author_2),
            weight: Number(
              record.co_authored_documents || record.weight || record.count || 1
            ),
          })),
        }
      : undefined;

  const contextualPayload = {
    title: analysis.name || capabilityId,
    provenance: {
      analysis_id: analysis.id,
      capability_id: capabilityId,
      dataset_id: analysis.dataset_id || null,
      dataset_version_id: analysis.dataset_version_id || null,
      status: analysis.status || "completed",
    },
    rows: filterQuery ? filteredRecords : records,
    metadata: {
      ...metadata,
      scalar_entries: scalarEntries,
      parameters: analysis.parameters || {},
      export_scope: filterQuery
        ? "filtered computed result"
        : "complete computed result",
      filter_query: filterQuery || null,
      ai_interpretation: activeTab === "ai" ? aiInsight : null,
      ai_is_partial: activeTab === "ai" ? aiIsPartial : null,
    },
    ...(contextualGraph ? { graph: contextualGraph } : {}),
  };

  return (
    <Card padding="lg" className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-ink-primary">
              {analysis.name ||
                capabilityId
                  .replace(/[._]/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
            </h2>
            <StatusBadge status={analysis.status || "completed"} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Capability:{" "}
            <code className="rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-mono text-ink-primary">
              {capabilityId}
            </code>{" "}
            · Computation Provider:{" "}
            {String(result.provider || "SciAINativeProvider")} ·{" "}
            <span className="tabular-metrics">{records.length}</span>{" "}
            bibliographic records processed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isGeneratingAi}
            disabled={isGeneratingAi}
            onClick={handleGenerateAiInsight}
            icon={
              !isGeneratingAi ? (
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              ) : undefined
            }
          >
            {isGeneratingAi ? "Synthesizing..." : "AI Research Synthesis"}
          </Button>
        </div>
      </div>

      {/* Scalar Metrics Highlights */}
      {scalarEntries.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scalarEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-border-default bg-surface-subtle p-4 transition-colors hover:border-border-strong"
            >
              <div className="sciai-kicker truncate text-[10px]!">
                {key.replace(/_/g, " ")}
              </div>
              <div className="tabular-metrics mt-1.5 truncate text-lg font-black tracking-tight text-ink-primary">
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-border-default">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition-colors ${
              activeTab === "visual"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-muted hover:text-ink-primary"
            }`}
          >
            {isCoAuthorship ? (
              <Network className="h-4 w-4" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            {isCoAuthorship ? "Network Topology" : "Visual Analytics"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`tabular-metrics inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition-colors ${
              activeTab === "table"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-muted hover:text-ink-primary"
            }`}
          >
            <Table className="h-4 w-4" />
            Bibliographic Records ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition-colors ${
              activeTab === "ai"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-muted hover:text-brand-600"
            }`}
          >
            <Sparkles className="h-4 w-4 text-brand-500" />
            AI Research Synthesis {aiInsight && "•"}
          </button>
        </div>

        {activeTab === "table" && (
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter bibliographic records..."
            className="mb-2 w-48 rounded-xl border border-border-default bg-surface-canvas px-3 py-1 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
          />
        )}
      </div>

      {/* Tab 1: Visual Analytics */}
      {activeTab === "visual" && (
        <div ref={visualRef} className="mt-4">
          {isCoAuthorship ? (
            <NetworkGraph records={records} />
          ) : (
            <VisualizerChart capabilityId={capabilityId} records={records} />
          )}
        </div>
      )}

      {/* Tab 2: Tabular Records */}
      {activeTab === "table" && (
        <div className="mt-4">
          {filteredRecords.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border-default">
              <table className="min-w-full text-xs">
                <thead className="border-b border-border-default bg-surface-subtle">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted"
                      >
                        {col.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredRecords.slice(0, 100).map((record, rIdx) => (
                    <tr
                      key={rIdx}
                      className="transition-colors hover:bg-surface-subtle/70"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="whitespace-nowrap px-4 py-2.5 font-medium text-ink-secondary"
                        >
                          {String(record[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length > 100 && (
                <div className="tabular-metrics bg-surface-subtle px-4 py-2 text-center text-xs text-ink-muted">
                  Showing first 100 of {filteredRecords.length} bibliographic
                  records.
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No bibliographic records matching filter"
              description="Try adjusting your filter keyword."
            />
          )}
        </div>
      )}

      {/* Tab 3: AI Research Synthesis */}
      {activeTab === "ai" && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-primary">
              <Sparkles className="h-4 w-4 text-brand-500" />
              AI Scientometric Synthesis
            </div>
            <button
              type="button"
              onClick={handleGenerateAiInsight}
              disabled={isGeneratingAi}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-600 underline hover:text-brand-800"
            >
              <RefreshCw
                className={`h-3 w-3 ${isGeneratingAi ? "animate-spin" : ""}`}
              />
              Re-analyze with AI
            </button>
          </div>

          {aiError && (
            <div className="mt-3">
              <AlertBanner tone="danger">
                <span className="font-bold">Interpretation Error: </span>
                {aiError}
              </AlertBanner>
            </div>
          )}

          {aiIsPartial && !aiError && (
            <div className="mt-3">
              <AlertBanner tone="warning">
                Partial Interpretation: Response was truncated or preliminary.
                It is not authoritative.
              </AlertBanner>
            </div>
          )}

          <div className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-secondary">
            {aiInsight || (
              <div className="py-6 text-center text-ink-muted">
                <p>
                  No AI-assisted interpretation generated yet for this analysis
                  run.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateAiInsight}
                  className="mt-3"
                >
                  Generate Research Synthesis
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Metadata Inspector */}
      {Object.keys(metadata).length > 0 && (
        <details className="mt-5 border-t border-border-subtle pt-3">
          <summary className="cursor-pointer text-[11px] font-bold text-ink-subtle hover:text-ink-secondary">
            Technical Result Metadata ({Object.keys(metadata).length}{" "}
            attributes)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-dark p-4 font-mono text-[11px] text-slate-300">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      )}

      {(records.length > 0 || scalarEntries.length > 0 || !!aiInsight) &&
        !["running", "queued", "pending", "failed", "error"].includes(
          analysis.status || ""
        ) && (
          <div className="mt-6" data-export-actions>
            <ContextualExportToolbar
              payload={contextualPayload}
              getSvgElement={
                activeTab === "visual"
                  ? () => visualRef.current?.querySelector("svg") || null
                  : undefined
              }
              compact
            />
          </div>
        )}
    </Card>
  );
}