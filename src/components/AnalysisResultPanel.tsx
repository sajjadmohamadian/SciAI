import React, { useState } from "react";
import { Analysis, ResultRecord } from "../types.js";
import { SectionHeader, StatusBadge, EmptyState } from "./CommonUI.js";
import { VisualizerChart } from "./VisualizerChart.js";
import { NetworkGraph } from "./NetworkGraph.js";
import { Download, Sparkles, RefreshCw, FileText, BarChart3, Network, Table } from "lucide-react";
import { validateAiInterpretationResponse } from "../utils/responseValidation.js";
import { useAiProvider } from "../context/AiProviderContext.js";

interface Props {
  analysis: Analysis | null;
  onRefresh?: () => void;
}

export function AnalysisResultPanel({ analysis, onRefresh }: Props) {
  const { getAiRequestOptions } = useAiProvider();
  const [activeTab, setActiveTab] = useState<"visual" | "table" | "ai">("visual");
  const [filterQuery, setFilterQuery] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIsPartial, setAiIsPartial] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(
    analysis?.result?.ai_interpretation || null
  );

  if (!analysis) return null;

  const result = analysis.result || {};
  const records: ResultRecord[] = (Array.isArray(result.records) ? result.records : []) as ResultRecord[];
  const scalarEntries = (Array.isArray(result.scalarEntries) ? result.scalarEntries : []) as Array<[string, unknown]>;
  const metadata = (result.metadata && typeof result.metadata === "object") ? (result.metadata as Record<string, unknown>) : {};
  const capabilityId = analysis.capability_id || analysis.analysis_type || "analysis";

  // Auto-generate columns from records
  const columns: string[] = [];
  if (records.length > 0 && records[0] && typeof records[0] === "object") {
    const keys = Object.keys(records[0]);
    keys.forEach((k) => {
      if (!["id", "_id"].includes(k)) columns.push(k);
    });
  }

  // Filtered records
  const filteredRecords = records.filter((r) => {
    if (!filterQuery) return true;
    return Object.values(r).some((v) =>
      String(v).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  const exportCSV = () => {
    if (records.length === 0) return;
    const headerRow = columns.join(",");
    const rows = records.map((r) =>
      columns.map((c) => JSON.stringify(r[c] ?? "")).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headerRow, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${capabilityId}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        setAiError(val.error || "Failed to generate valid AI interpretation.");
        setActiveTab("ai");
      }
    } catch (err) {
      console.error("AI Insight generation error:", err);
      setAiError(err instanceof Error ? err.message : "Error contacting AI interpretation service");
      setActiveTab("ai");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const isCoAuthorship = capabilityId === "author.co_authorship";

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              {analysis.name || capabilityId.replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h2>
            <StatusBadge status={analysis.status || "completed"} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Capability: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">{capabilityId}</code> · 
            Provider: {String(result.provider || "SciAINativeProvider")} · 
            {records.length} records processed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateAiInsight}
            disabled={isGeneratingAi}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            {isGeneratingAi ? "Synthesizing..." : "AI Intelligence"}
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Scalar Metrics Highlights */}
      {scalarEntries.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scalarEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {key.replace(/_/g, " ")}
              </div>
              <div className="mt-1.5 text-lg font-black text-slate-900 tracking-tight truncate">
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="mt-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === "visual"
                ? "border-slate-950 text-slate-950"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {isCoAuthorship ? <Network className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            {isCoAuthorship ? "Network Topology" : "Visual Analytics"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === "table"
                ? "border-slate-950 text-slate-950"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <Table className="h-4 w-4" />
            Tabular Records ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === "ai"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-indigo-600"
            }`}
          >
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Research Synthesis {aiInsight && "•"}
          </button>
        </div>

        {activeTab === "table" && (
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter records..."
            className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs outline-none focus:border-slate-950 w-48"
          />
        )}
      </div>

      {/* Tab 1: Visual Analytics */}
      {activeTab === "visual" && (
        <div className="mt-4">
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
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-500 text-[10px]"
                      >
                        {col.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.slice(0, 100).map((record, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition">
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700"
                        >
                          {String(record[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length > 100 && (
                <div className="bg-slate-50 px-4 py-2 text-center text-xs text-slate-500">
                  Showing first 100 of {filteredRecords.length} records.
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No records matching filter"
              description="Try adjusting your filter keyword."
            />
          )}
        </div>
      )}

      {/* Tab 3: AI Research Synthesis */}
      {activeTab === "ai" && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              AI Scientometric Synthesis
            </div>
            <button
              type="button"
              onClick={handleGenerateAiInsight}
              disabled={isGeneratingAi}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isGeneratingAi ? "animate-spin" : ""}`} />
              Re-analyze with AI
            </button>
          </div>

          {aiError && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <span className="font-bold">Interpretation Error: </span>
              {aiError}
            </div>
          )}

          {aiIsPartial && !aiError && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 font-medium">
              Partial Interpretation: Response was truncated or preliminary. Not authoritative.
            </div>
          )}

          <div className="mt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">
            {aiInsight || (
              <div className="py-6 text-center text-slate-500">
                <p>No AI interpretation generated yet for this run.</p>
                <button
                  type="button"
                  onClick={handleGenerateAiInsight}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  Generate Research Synthesis
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Metadata Inspector */}
      {Object.keys(metadata).length > 0 && (
        <details className="mt-5 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600">
            Technical Result Metadata ({Object.keys(metadata).length} attributes)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] font-mono text-slate-300">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
