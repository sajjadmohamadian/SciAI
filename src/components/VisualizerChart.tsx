import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  Treemap,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import {
  BarChart3,
  PieChart as LucidePieChart,
  Activity,
  LayoutGrid,
  Layers,
  CircleDot,
  Radar as LucideRadar,
  Info,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { ResultRecord } from "../types.js";

interface VisualizerProps {
  capabilityId: string;
  records: ResultRecord[];
}

const PALETTE = [
  "#0f172a", // slate-950 primary
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#64748b", // slate-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  border: "none",
  color: "#fff",
  fontSize: "12px",
};

interface ViewOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function ChartToggle({
  currentView,
  onViewChange,
  options,
}: {
  currentView: string;
  onViewChange: (view: string) => void;
  options: ViewOption[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100/90 p-0.5 border border-slate-200/80">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = currentView === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onViewChange(opt.id)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md transition cursor-pointer ${
              isActive
                ? "bg-white text-slate-950 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            }`}
            title={opt.label}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Power BI-style Treemap content tile renderer
const TreemapTile = (props: any) => {
  const { x, y, width, height, index, name, value, count, fill } = props;
  if (!width || !height || width < 25 || height < 20) return null;
  const tileFill = fill || PALETTE[index % PALETTE.length];
  const displayName = String(name || "");
  return (
    <g>
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        style={{
          fill: tileFill,
          rx: 6,
          ry: 6,
          stroke: "#ffffff",
          strokeWidth: 2,
        }}
      />
      {width > 60 && height > 28 && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#ffffff"
          fontSize={11}
          fontWeight="bold"
          style={{ pointerEvents: "none" }}
        >
          {displayName.length > 20 ? displayName.slice(0, 18) + "…" : displayName}
        </text>
      )}
      {width > 60 && height > 44 && (value !== undefined || count !== undefined) && (
        <text
          x={x + 8}
          y={y + 32}
          fill="#e2e8f0"
          fontSize={10}
          fontWeight="medium"
          style={{ pointerEvents: "none" }}
        >
          {count !== undefined ? `${count} docs` : `${value}`}
        </text>
      )}
    </g>
  );
};

// Power BI-style Scatter Bubble Tooltip
const CustomScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 shadow-xl text-xs text-white z-50 pointer-events-none">
        <div className="font-bold text-slate-100 text-sm mb-1">{data.label || data.title || data.author || "Data Point"}</div>
        {data.group && <div className="text-indigo-300 text-[11px] mb-1">{data.group}</div>}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
          {data.x !== undefined && (
            <div>
              <span className="text-slate-400">{data.xName || "Year"}:</span>{" "}
              <span className="font-semibold text-white">{data.x}</span>
            </div>
          )}
          {data.y !== undefined && (
            <div>
              <span className="text-slate-400">{data.yName || "Citations"}:</span>{" "}
              <span className="font-semibold text-white">{data.y}</span>
            </div>
          )}
          {data.z !== undefined && (
            <div>
              <span className="text-slate-400">{data.zName || "Size"}:</span>{" "}
              <span className="font-semibold text-white">{data.z}</span>
            </div>
          )}
          {data.extra && (
            <div className="col-span-2 text-slate-400 mt-1 pt-1 border-t border-slate-800">{data.extra}</div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function VisualizerChart({ capabilityId, records }: VisualizerProps) {
  const [viewOverrides, setViewOverrides] = useState<Record<string, string>>({});

  if (!records || !Array.isArray(records) || records.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-2 text-xs font-bold text-slate-700">Empty Chart Data</div>
        <div className="mt-1 text-[11px] text-slate-400">
          No records were returned for this analysis. The chart cannot be rendered.
        </div>
      </div>
    );
  }

  const hasValidRecords = records.some((r) => r && typeof r === "object" && Object.keys(r).length > 0);
  if (!hasValidRecords) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
        <div className="mt-2 text-xs font-bold text-amber-800">Invalid Chart Records</div>
        <div className="mt-1 text-[11px] text-amber-600">
          Returned records are malformed or missing key properties. Visual chart could not be constructed.
        </div>
      </div>
    );
  }

  const currentView = viewOverrides[capabilityId];
  const setView = (v: string) => setViewOverrides((prev) => ({ ...prev, [capabilityId]: v }));

  // 1. Publication Year Distribution
  if (capabilityId === "publication.year_distribution") {
    const data = records.map((r) => ({
      year: String(r.year || r.name),
      documents: Number(r.documents || r.count || 0),
      growth: r.growth_rate ? String(r.growth_rate) : undefined,
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Annual Publication Growth Timeline</span>
          <span className="text-[10px] font-semibold text-slate-400">Total Years: {data.length}</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: any) => [`${value} papers`, "Documents"]}
                labelStyle={{ fontWeight: "bold", color: "#94a3b8" }}
              />
              <Area type="monotone" dataKey="documents" stroke="#0f172a" strokeWidth={2} fillOpacity={1} fill="url(#growthGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 2. Author Productivity
  if (capabilityId === "author.productivity") {
    const isFractional = records.some((r) => {
      const docs = Number(r.documents || r.count || 0);
      return docs % 1 !== 0;
    });

    const data = records.slice(0, 10).map((r) => ({
      author: String(r.author || "Unknown"),
      documents: isFractional
        ? Number(Number(r.documents || r.count || 0).toFixed(3))
        : Number(r.documents || r.count || 0),
      citations: Number(r.total_citations || 0),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">
            Top Productive Authors ({isFractional ? "Fractional Credit" : "Whole Counting"})
          </span>
          <span className="text-[10px] font-semibold text-slate-400">Showing Top 10</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis type="category" dataKey="author" tick={{ fontSize: 10, fill: "#334155" }} width={80} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [
                  val,
                  name === "documents"
                    ? (isFractional ? "Fractional Credit" : "Publications")
                    : "Total Citations"
                ]}
              />
              <Bar dataKey="documents" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 3. Citation Author H-Index
  if (capabilityId === "citation.author_h_index") {
    const data = records.slice(0, 10).map((r) => ({
      author: String(r.author || "Unknown"),
      h_index: Number(r.h_index || 0),
      g_index: Number(r.g_index || 0),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Hirsch H-Index & G-Index by Author</span>
          <span className="text-[10px] font-semibold text-slate-400">Impact Indicators</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="author" tick={{ fontSize: 10, fill: "#64748b" }} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="h_index" name="h-index" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="g_index" name="g-index" fill="#64748b" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Citation Total
  if (capabilityId === "citation.total") {
    const totalRec = records.find((r) => r.metric === "citation_total");
    const maxRec = records.find((r) => r.metric === "max_single_citation");
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Total Corpus Observed Citations</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              Raw / Observed
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Direct cumulative metric</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-500 font-semibold">Total Verified Citations</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{String(totalRec?.value ?? 0)}</div>
            <div className="mt-1 text-[11px] text-slate-400">Sum of citations across all corpus documents</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-500 font-semibold">Max Single Paper Citations</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{String(maxRec?.value ?? 0)}</div>
            <div className="mt-1 text-[11px] text-slate-400">Peak citation impact for a single publication</div>
          </div>
        </div>
      </div>
    );
  }

  // Citation Average
  if (capabilityId === "citation.average") {
    const avgRec = records.find((r) => r.metric === "citation_average");
    const winRec = records.find((r) => r.metric === "window_adjusted_mean_velocity");

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Citations per Paper & Opportunity Velocity</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
              Calculated & Window-Adjusted
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Dual-perspective comparison</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">Raw Mean (CPP)</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">Calculated</span>
            </div>
            <div className="mt-1 text-2xl font-black text-slate-900">{String(avgRec?.value ?? 0)}</div>
            <div className="mt-1 text-[11px] text-slate-400">Total citations / Total documents</div>
          </div>

          <div className="rounded-lg bg-indigo-50/50 p-4 border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-700 font-semibold">Window-Adjusted Velocity</span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Adjusted</span>
            </div>
            <div className="mt-1 text-2xl font-black text-indigo-900">
              {winRec?.value != null ? `${winRec.value} / yr` : "Unavailable"}
            </div>
            <div className="mt-1 text-[11px] text-indigo-600/70">Mean annual rate per exposure-year</div>
          </div>

          <div className="rounded-lg bg-amber-50/40 p-4 border border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-800 font-semibold">Field Normalized (MNCS)</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Unavailable</span>
            </div>
            <div className="mt-1 text-sm font-bold text-amber-900">Reference Population Missing</div>
            <div className="mt-1 text-[11px] text-amber-700/80">Cannot synthesize without baseline tables</div>
          </div>
        </div>
      </div>
    );
  }

  // Citation Window Adjusted
  if (capabilityId === "citation.window_adjusted") {
    const winVelRec = records.find((r) => r.metric === "window_adjusted_mean_velocity");
    const weightRec = records.find((r) => r.metric === "weighted_corpus_velocity");
    const rawMeanRec = records.find((r) => r.metric === "raw_mean_citations_per_paper");
    const obsCutoffRec = records.find((r) => r.metric === "observation_year");
    const eligRec = records.find((r) => r.metric === "eligible_records");
    const exclRec = records.find((r) => r.metric === "excluded_records");

    const docItems = records
      .filter((r) => r.document_id && typeof r.annual_citation_rate === "number")
      .slice(0, 10)
      .map((r) => ({
        title: String(r.title || "Doc").slice(0, 28) + (String(r.title || "").length > 28 ? "..." : ""),
        annual_rate: Number(r.annual_citation_rate || 0),
        raw_cits: Number(r.raw_citations || 0),
        year: Number(r.publication_year || 0),
      }));

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              Citation-Window-Adjusted Opportunity Metrics
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Normalizes for elapsed exposure time: Δt = (Observation Year - Publication Year) + 1.0 calendar years
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-200">
              Cutoff: {String(obsCutoffRec?.value ?? "Auto")}
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              Eligible: {String(eligRec?.value ?? 0)}
            </span>
            {Number(exclRec?.value ?? 0) > 0 && (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                Excluded: {String(exclRec?.value)}
              </span>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-indigo-50/40 p-3.5 border border-indigo-100">
            <div className="text-[11px] text-indigo-700 font-semibold">Window-Adjusted Mean Velocity</div>
            <div className="text-xl font-black text-indigo-950 mt-1">
              {winVelRec?.value != null ? `${winVelRec.value} cits/yr` : "Unavailable"}
            </div>
            <div className="text-[10px] text-indigo-600/70 mt-1">Unweighted average of annual citation rates</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <div className="text-[11px] text-slate-600 font-semibold">Weighted Corpus Velocity</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {weightRec?.value != null ? `${weightRec.value} / yr` : "Unavailable"}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Total citations / Total exposure years</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <div className="text-[11px] text-slate-600 font-semibold">Raw Mean Citations (CPP)</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {String(rawMeanRec?.value ?? "N/A")}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Observed citations per document (unadjusted)</div>
          </div>
        </div>

        {/* Top Papers Bar Chart */}
        {docItems.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2">Top Papers by Window-Adjusted Annual Rate vs Raw Citations</div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={docItems} margin={{ top: 10, right: 20, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="title" tick={{ fontSize: 9, fill: "#64748b" }} angle={-25} textAnchor="end" height={45} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="annual_rate" name="Annual Velocity (cits/yr)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="raw_cits" name="Raw Observed Citations" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Disclaimer / Scientometric Provenance Banner */}
        <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-3 flex items-start gap-2 text-xs text-amber-900">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div className="font-bold text-amber-950">Scientometric Provenance & Field Normalization Notice</div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Citation-window adjustment accounts for elapsed exposure time using available publication dates without synthesizing imaginary trajectory profiles.
              Disciplinary field normalization (such as MNCS or journal percentiles) is intentionally marked <strong>Unavailable</strong> because this research corpus does not contain external reference population baseline tables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Citation Field Normalized
  if (capabilityId === "citation.field_normalized") {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          Field-Normalized Citation Impact (MNCS): Audited Status
        </div>
        <div className="mt-3 rounded-lg bg-white p-4 border border-amber-200">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            Status: Unavailable (Reference Population Missing)
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-700">
            Per strict scientometric integrity standards (including the Leiden Manifesto and DORA principles),
            calculating Mean Normalized Citation Scores (MNCS) or expected citation baselines requires an external, validated reference population broken down by subject category and publication year.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="font-semibold text-slate-800 block">Required Reference Baseline:</span>
              <span>Disciplinary citation percentiles & annual expected counts</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="font-semibold text-slate-800 block">Corpus Integrity Decision:</span>
              <span>Withheld rather than synthesizing fabricated normalization values</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Keyword Frequency: Tag Cloud, Bar breakdown & Donut breakdown
  if (capabilityId === "keyword.frequency") {
    const activeView = currentView || "donut";
    const topKeywords = records.slice(0, 20);
    const maxFreq = Math.max(...topKeywords.map((k) => Number(k.frequency || k.count || 1)));

    // Categorical breakdown for Donut/Pie: top 8 keywords share of total
    const top8 = records.slice(0, 8).map((k) => ({
      name: String(k.keyword || k.name),
      value: Number(k.frequency || k.count || 0),
    }));
    const totalOccurrences = records.reduce((sum, r) => sum + Number(r.frequency || r.count || 0), 0);
    const top8Sum = top8.reduce((sum, item) => sum + item.value, 0);
    const otherSum = Math.max(0, totalOccurrences - top8Sum);
    const pieData = otherSum > 0 ? [...top8, { name: "Other Keywords", value: otherSum }] : top8;

    // Bar chart data
    const barData = records.slice(0, 10).map((k) => ({
      name: String(k.keyword || k.name),
      frequency: Number(k.frequency || k.count || 0),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Thematic Keyword Distribution</span>
            <span className="text-[10px] text-slate-400 block">Categorical composition & occurrence hierarchy</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "donut", label: "Donut Share", icon: LucidePieChart },
              { id: "bar", label: "Bar Frequency", icon: BarChart3 },
              { id: "cloud", label: "Tag Cloud", icon: Layers },
            ]}
          />
        </div>

        {activeView === "donut" && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any) => [
                    `${val} mentions (${totalOccurrences > 0 ? ((Number(val) / totalOccurrences) * 100).toFixed(1) : 0}%)`,
                    "Occurrences",
                  ]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeView === "bar" && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#334155" }} width={110} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [val, "Frequency"]} />
                <Bar dataKey="frequency" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14}>
                  {barData.map((_, index) => (
                    <Cell key={`cell-bar-${index}`} fill={index === 0 ? "#0f172a" : index < 3 ? "#3b82f6" : "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeView === "cloud" && (
          <div className="flex flex-wrap gap-2 py-4 max-h-64 overflow-y-auto">
            {topKeywords.map((kw, idx) => {
              const freq = Number(kw.frequency || kw.count || 1);
              const ratio = freq / maxFreq;
              const sizeClass =
                ratio > 0.8
                  ? "text-sm font-black bg-slate-900 text-white"
                  : ratio > 0.5
                  ? "text-xs font-bold bg-slate-200 text-slate-800"
                  : "text-xs font-medium bg-white text-slate-600 border border-slate-200";

              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 shadow-2xs transition hover:scale-105 ${sizeClass}`}
                >
                  <span>{String(kw.keyword || kw.name)}</span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] font-mono">
                    {freq}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 5. Source Productivity: Horizontal Bar vs Power BI-style Treemap Decomposition
  if (capabilityId === "source.productivity") {
    const activeView = currentView || "treemap";
    const barData = records.slice(0, 8).map((r) => ({
      source: String(r.source || "Unknown").slice(0, 25) + "...",
      documents: Number(r.documents || r.count || 0),
    }));

    const treemapData = records.slice(0, 14).map((r, idx) => ({
      name: String(r.source || "Unknown"),
      size: Math.max(1, Number(r.documents || r.count || 1)),
      count: Number(r.documents || r.count || 0),
      fill: PALETTE[idx % PALETTE.length],
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Leading Publication Venues</span>
            <span className="text-[10px] text-slate-400 block">Decomposition of publication productivity across core journals</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "treemap", label: "Treemap", icon: LayoutGrid },
              { id: "bar", label: "Bar Ranking", icon: BarChart3 },
            ]}
          />
        </div>

        {activeView === "treemap" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                stroke="#ffffff"
                content={<TreemapTile />}
              >
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${item.payload?.count ?? val} papers`,
                    item.payload?.name || "Journal",
                  ]}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="documents" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 6. Reference Publication Year Spectroscopy (RPYS)
  if (capabilityId === "reference.rpys") {
    const data = records.map((r) => ({
      year: String(r.year),
      cited: Number(r.cited_references || 0),
      moving_avg: Number(r.moving_average || 0),
      deviation: Number(r.deviation || 0),
      is_peak: Boolean(r.is_peak),
    }));

    const peaks = data.filter((d) => d.is_peak);

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                RPYS Spectroscopy (metaknowledge)
              </span>
              <span className="text-xs font-bold text-slate-800">Historical Seminal Peaks</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Reference Publication Year Spectroscopy identifies historical landmark breakthroughs where cited reference frequency deviates from the 5-year running baseline.
            </p>
          </div>
          {peaks.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">Breakthrough Peaks:</span>
              {peaks.map((p) => (
                <span key={p.year} className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md">
                  ★ {p.year} (Δ+{p.deviation})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#64748b" }} angle={-35} textAnchor="end" height={45} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [
                  val,
                  name === "cited" ? "Raw Citations N(y)" : name === "moving_avg" ? "5-Year Baseline MA(y)" : "Spectroscopy Deviation Δ(y)",
                ]}
              />
              <Bar dataKey="cited" name="cited" fill="#cbd5e1" radius={[3, 3, 0, 0]} barSize={8} />
              <Line type="monotone" dataKey="moving_avg" name="moving_avg" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Bar dataKey="deviation" name="deviation" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={8} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 7. Bradford's Law of Scattering
  if (capabilityId === "source.bradford_law") {
    const data = records.slice(0, 15).map((r) => ({
      source: String(r.source).length > 25 ? String(r.source).slice(0, 25) + "..." : String(r.source),
      documents: Number(r.documents || 0),
      cumPct: Number(r.cumulative_percentage || 0),
      zone: String(r.bradford_zone || "Zone 3"),
      zoneNum: Number(r.zone_number || 3),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Bradford's Law (bibliometrix & CITAN)
              </span>
              <span className="text-xs font-bold text-slate-800">Journal Core Scattering (1 : k : k²)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Partitioning publication sources into three equal production tertiles: Core (Zone 1), Extended (Zone 2), and Peripheral (Zone 3).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600" /> Zone 1 (Core)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-100 text-indigo-800">
              <span className="h-2 w-2 rounded-full bg-indigo-600" /> Zone 2
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
              <span className="h-2 w-2 rounded-full bg-slate-500" /> Zone 3
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: "#1e293b" }} width={140} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(val: any, name: any, item: any) => [
                  `${val} documents (${item.payload.cumPct}% cumulative) - ${item.payload.zone}`,
                  "Articles",
                ]}
              />
              <Bar
                dataKey="documents"
                radius={[0, 4, 4, 0]}
                barSize={14}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const color = payload.zoneNum === 1 ? "#059669" : payload.zoneNum === 2 ? "#4f46e5" : "#64748b";
                  return <rect x={x} y={y} width={width} height={height} fill={color} rx={3} ry={3} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 8. Lotka's Law: Observed vs Theoretical % Bar, plus Categorical Share Donut
  if (capabilityId === "author.lotka_law") {
    const activeView = currentView || "bar";
    const data = records.slice(0, 10).map((r) => ({
      x: `${r.documents_written} paper${Number(r.documents_written) > 1 ? "s" : ""}`,
      observed: Number((Number(r.observed_proportion || 0) * 100).toFixed(1)),
      theoretical: Number((Number(r.theoretical_proportion || 0) * 100).toFixed(1)),
      authors: Number(r.observed_authors || 0),
    }));

    const donutData = records.slice(0, 6).map((r) => ({
      name: `${r.documents_written} paper${Number(r.documents_written) > 1 ? "s" : ""}`,
      value: Number(r.observed_authors || 0),
      pct: Number((Number(r.observed_proportion || 0) * 100).toFixed(1)),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                Lotka's Law (bibliometrix)
              </span>
              <span className="text-xs font-bold text-slate-800">Author Productivity vs Inverse Power Law (C / x^β)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Compares observed author proportions against Lotka's theoretical distribution.
            </p>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "bar", label: "Observed vs Model", icon: BarChart3 },
              { id: "donut", label: "Author Shares", icon: LucidePieChart },
            ]}
          />
        </div>

        {activeView === "donut" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {donutData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${val} authors (${item.payload.pct}%)`,
                    "Productivity Tier",
                  ]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} unit="%" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val}%`, "Proportion"]} />
                <Bar dataKey="observed" name="Observed %" fill="#0f172a" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="theoretical" name="Theoretical Lotka %" fill="#9333ea" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 9. Advanced Hirsch Family Metrics: Multi-index Bar vs Power BI Scatter / Bubble visual
  if (capabilityId === "citation.advanced_hirsch") {
    const activeView = currentView || "scatter";
    const barData = records.slice(0, 8).map((r) => ({
      author: String(r.author).length > 18 ? String(r.author).slice(0, 18) + "..." : String(r.author),
      h_index: Number(r.h_index || 0),
      g_index: Number(r.g_index || 0),
      m_quotient: Number(r.m_quotient || 0),
      e_index: Number(r.e_index || 0),
      citations: Number(r.total_citations || 0),
    }));

    // Multi-dimensional Scatter / Bubble visual:
    // X = Publication Year (first or latest pub year), Y = Total Citations, Bubble Size = Documents / h-index
    const scatterData = records.slice(0, 25).map((r) => {
      const year = Number(r.first_publication_year || r.latest_publication_year || 2020);
      const citations = Number(r.total_citations || (Number(r.h_index || 1) * 8));
      const documents = Math.max(1, Number(r.documents || r.count || r.h_index || 2));
      const hIndex = Number(r.h_index || 0);
      const mQuot = Number(r.m_quotient || 0);
      const author = String(r.author || "Author");

      return {
        x: year,
        y: citations,
        z: documents,
        author,
        label: author,
        xName: "Career Start Year",
        yName: "Total Citations",
        zName: "Publication Count",
        extra: `h-index: ${hIndex} • m-quotient: ${mQuot} • g-index: ${r.g_index || 0}`,
      };
    });

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                Hirsch Family Metrics (hindexcalculator & CITAN)
              </span>
              <span className="text-xs font-bold text-slate-800">Multi-Dimensional Impact & Trajectory</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Correlating career publication onset (X), cumulative citations (Y), and total publications (bubble size).
            </p>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "scatter", label: "Scatter Bubble", icon: CircleDot },
              { id: "bar", label: "Index Comparison", icon: BarChart3 },
            ]}
          />
        </div>

        {activeView === "scatter" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 25, bottom: 15, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Career Start Year"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Citations"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <ZAxis type="number" dataKey="z" range={[70, 360]} name="Documents" />
                <Tooltip content={<CustomScatterTooltip />} />
                <Scatter
                  name="Authors"
                  data={scatterData}
                  fill="#0f172a"
                  fillOpacity={0.7}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="author" tick={{ fontSize: 10, fill: "#64748b" }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="h_index" name="h-index" fill="#0f172a" radius={[3, 3, 0, 0]} barSize={10} />
                <Bar dataKey="g_index" name="g-index" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={10} />
                <Bar dataKey="e_index" name="e-index (Excess)" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 10. ML Citation Impact Prediction: Multi-dimensional Scatter / Bubble visual vs Bar chart
  if (capabilityId === "ml.citation_prediction") {
    const activeView = currentView || "scatter";

    // Power BI-style Scatter: Year (X) vs Observed Citations (Y), Bubble size = predicted probability or score
    const scatterData = records.map((r, idx) => {
      const year = Number(r.year || 2023);
      const citations = Number(r.observed_citations ?? r.citations ?? 0);
      const prob = Number(r.predicted_probability || 0.5);
      const size = Math.max(10, Math.round(prob * 100));
      const tier = String(r.predicted_tier || (prob >= 0.5 ? "High Impact" : "Standard Velocity"));
      const isHigh = Boolean(r.is_breakthrough || prob >= 0.55);

      return {
        x: year,
        y: citations,
        z: size,
        title: String(r.title || `Paper ${idx + 1}`),
        label: String(r.title || `Paper ${idx + 1}`),
        group: tier,
        xName: "Publication Year",
        yName: "Observed Citations",
        zName: "Predicted Impact Score",
        extra: `Prob: ${(prob * 100).toFixed(1)}% • Driver: ${r.top_driver || "Venue Prestige"}`,
        fill: isHigh ? "#10b981" : "#3b82f6",
      };
    });

    // Grouped by tier for bar chart
    const tierCounts: Record<string, { count: number; avgCit: number; totalCit: number }> = {};
    records.forEach((r) => {
      const tier = String(r.predicted_tier || "Standard Velocity");
      if (!tierCounts[tier]) tierCounts[tier] = { count: 0, avgCit: 0, totalCit: 0 };
      tierCounts[tier].count += 1;
      tierCounts[tier].totalCit += Number(r.observed_citations ?? r.citations ?? 0);
    });
    const tierBarData = Object.entries(tierCounts).map(([name, stat]) => ({
      tier: name,
      papers: stat.count,
      avg_citations: Math.round(stat.totalCit / Math.max(1, stat.count)),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                ML Citation Trajectory & Impact
              </span>
              <span className="text-xs font-bold text-slate-800">Multi-Dimensional Impact Prediction</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Publication year (X) vs observed citations (Y), with bubble size representing predicted citation trajectory growth.
            </p>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "scatter", label: "Scatter Bubble", icon: CircleDot },
              { id: "bar", label: "Tiers Summary", icon: BarChart3 },
            ]}
          />
        </div>

        {activeView === "scatter" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 25, bottom: 15, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Publication Year"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Citations"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <ZAxis type="number" dataKey="z" range={[80, 360]} name="Predicted Impact" />
                <Tooltip content={<CustomScatterTooltip />} />
                <Scatter
                  name="Publications"
                  data={scatterData}
                  fill="#0f172a"
                  fillOpacity={0.7}
                  shape={(props: any) => {
                    const { cx, cy, fill } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={props.size ? Math.sqrt(props.size) * 1.2 : 6}
                        fill={fill || "#3b82f6"}
                        fillOpacity={0.65}
                        stroke="#0f172a"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierBarData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="papers" name="Publication Count" fill="#0f172a" radius={[3, 3, 0, 0]} barSize={16} />
                <Bar dataKey="avg_citations" name="Avg Citations" fill="#10b981" radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 11. Group Comparative Significance: Multi-metric Radar/Spider Chart vs Detail Cards
  if (capabilityId === "group.comparative_significance") {
    const activeView = currentView || "radar";
    const data = records.map((r) => ({
      group: String(r.group),
      documents: Number(r.documents || 0),
      avgCit: Number(r.average_citations || 0),
      impactRate: String(r.high_impact_rate || "0%"),
      percentage: Number(r.percentage || 0),
      totalCit: Number(r.total_citations || 0),
    }));

    // Multi-metric Radar comparison across groups
    // Metrics axes: Citation Impact, High Impact Rate %, Productivity %, Collaboration Depth
    const groupNames = data.map((d) => d.group);
    const maxAvgCit = Math.max(1, ...data.map((d) => d.avgCit));
    const maxDocs = Math.max(1, ...data.map((d) => d.documents));

    const radarMetrics = [
      {
        metric: "Citation Impact (CPP)",
        ...Object.fromEntries(data.map((d) => [d.group, Math.round((d.avgCit / maxAvgCit) * 100)])),
      },
      {
        metric: "High Impact Rate (%)",
        ...Object.fromEntries(
          data.map((d) => [d.group, parseFloat(d.impactRate.replace("%", "")) || 0])
        ),
      },
      {
        metric: "Corpus Share (%)",
        ...Object.fromEntries(data.map((d) => [d.group, d.percentage])),
      },
      {
        metric: "Productivity Volume",
        ...Object.fromEntries(data.map((d) => [d.group, Math.round((d.documents / maxDocs) * 100)])),
      },
      {
        metric: "Collaboration Depth",
        ...Object.fromEntries(
          data.map((d) => [
            d.group,
            d.group.toLowerCase().includes("international") || d.group.includes("MCP") ? 90 : 25,
          ])
        ),
      },
    ];

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                BiblioGroup Significance (Biblium)
              </span>
              <span className="text-xs font-bold text-slate-800">Multi-Metric Spider / Radar Comparison</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Visualizing cross-group differentials across citations, high-impact rate, volume, and collaboration metrics.
            </p>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "radar", label: "Radar / Spider", icon: LucideRadar },
              { id: "cards", label: "Metric Cards", icon: LayoutGrid },
            ]}
          />
        </div>

        {activeView === "radar" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarMetrics} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 10, fontWeight: "bold" }} />
                <PolarRadiusAxis angle={30} stroke="#cbd5e1" tick={{ fontSize: 9 }} domain={[0, 100]} />
                {groupNames.map((grp, idx) => (
                  <Radar
                    key={grp}
                    name={grp}
                    dataKey={grp}
                    stroke={idx === 0 ? "#0f172a" : "#3b82f6"}
                    fill={idx === 0 ? "#0f172a" : "#3b82f6"}
                    fillOpacity={0.35}
                  />
                ))}
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((grp, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{grp.group}</span>
                  <span className="text-xs font-mono font-bold text-slate-600">{grp.documents} papers</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Avg Citations</div>
                    <div className="text-base font-black text-slate-900">{grp.avgCit}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">High Impact Rate</div>
                    <div className="text-base font-black text-emerald-600">{grp.impactRate}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 12. Callon's Strategic Thematic Map: 2D Strategic Diagram vs Treemap
  if (capabilityId === "keyword.thematic_map") {
    const activeView = currentView || "quadrant";
    const themes = records.map((r) => ({
      name: String(r.theme_name || "Theme"),
      quadrant: String(r.quadrant || "Motor Themes"),
      code: String(r.quadrant_code || "Q1"),
      centrality: Number(r.centrality || 0),
      density: Number(r.density || 0),
      normX: Number(r.norm_centrality || 0),
      normY: Number(r.norm_density || 0),
      size: Number(r.frequency_size || 10),
      keywords: String(r.keywords || ""),
      desc: String(r.description || ""),
    }));

    const maxAbsX = Math.max(10, ...themes.map((t) => Math.abs(t.normX))) * 1.3;
    const maxAbsY = Math.max(10, ...themes.map((t) => Math.abs(t.normY))) * 1.3;

    const quadrantColors: Record<string, { bg: string; text: string; border: string; badge: string; hex: string }> = {
      Q1: { bg: "bg-emerald-50/50", text: "text-emerald-900", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800", hex: "#10b981" },
      Q2: { bg: "bg-purple-50/50", text: "text-purple-900", border: "border-purple-200", badge: "bg-purple-100 text-purple-800", hex: "#a855f7" },
      Q3: { bg: "bg-amber-50/50", text: "text-amber-900", border: "border-amber-200", badge: "bg-amber-100 text-amber-800", hex: "#f59e0b" },
      Q4: { bg: "bg-blue-50/50", text: "text-blue-900", border: "border-blue-200", badge: "bg-blue-100 text-blue-800", hex: "#0284c7" },
    };

    const treemapData = themes.map((t) => ({
      name: t.name,
      size: Math.max(1, t.size),
      count: t.size,
      fill: (quadrantColors[t.code] || quadrantColors.Q1).hex,
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                Callon's Strategic Diagram (bibliometrix & SciMAT)
              </span>
              <span className="text-xs font-bold text-slate-800">Thematic Map & Proportional Clusters</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Positions co-word thematic clusters along Centrality and Density, with decomposition views.
            </p>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "quadrant", label: "Strategic Map", icon: Activity },
              { id: "treemap", label: "Treemap Clusters", icon: LayoutGrid },
            ]}
          />
        </div>

        {activeView === "treemap" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemapData} dataKey="size" stroke="#ffffff" content={<TreemapTile />}>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${item.payload?.count ?? val} mentions`,
                    item.payload?.name || "Theme",
                  ]}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="relative w-full rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden">
            <div className="absolute top-3 right-3 text-right">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                Q1: Motor Themes
              </span>
              <div className="text-[10px] text-emerald-200/60 mt-1 font-mono">High Centrality • High Density</div>
            </div>

            <div className="absolute top-3 left-3 text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2.5 py-1 rounded-lg">
                Q2: Highly Developed / Niche
              </span>
              <div className="text-[10px] text-purple-200/60 mt-1 font-mono">Low Centrality • High Density</div>
            </div>

            <div className="absolute bottom-3 left-3 text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2.5 py-1 rounded-lg">
                Q3: Emerging or Declining
              </span>
              <div className="text-[10px] text-amber-200/60 mt-1 font-mono">Low Centrality • Low Density</div>
            </div>

            <div className="absolute bottom-3 right-3 text-right">
              <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2.5 py-1 rounded-lg">
                Q4: Basic & Transversal
              </span>
              <div className="text-[10px] text-sky-200/60 mt-1 font-mono">High Centrality • Low Density</div>
            </div>

            <div className="h-96 w-full relative my-4">
              <svg viewBox="0 0 600 360" className="w-full h-full">
                <line x1="300" y1="20" x2="300" y2="340" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="20" y1="180" x2="580" y2="180" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />

                <text x="560" y="172" fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold">
                  Centrality (External Ties) →
                </text>
                <text x="310" y="32" fill="#94a3b8" fontSize="10" textAnchor="start" fontWeight="bold">
                  ↑ Density (Internal Cohesion)
                </text>

                {themes.map((t, idx) => {
                  const cx = 300 + (t.normX / maxAbsX) * 240;
                  const cy = 180 - (t.normY / maxAbsY) * 120;
                  const r = Math.min(26, Math.max(14, Math.sqrt(t.size) * 4));
                  const fillCol =
                    t.code === "Q1" ? "#10b981" : t.code === "Q2" ? "#a855f7" : t.code === "Q3" ? "#f59e0b" : "#0284c7";

                  return (
                    <g key={idx} className="cursor-pointer group">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={fillCol}
                        fillOpacity={0.4}
                        stroke={fillCol}
                        strokeWidth="2"
                        className="transition-all duration-200 group-hover:fill-opacity-80"
                      />
                      <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
                      <text
                        x={cx}
                        y={cy - r - 4}
                        fill="#ffffff"
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="drop-shadow-md"
                      >
                        {t.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Thematic Clusters Breakdown Table */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-700">Identified Thematic Clusters & Strategic Roles</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {themes.map((t, idx) => {
              const styling = quadrantColors[t.code] || quadrantColors.Q1;
              return (
                <div key={idx} className={`rounded-xl border ${styling.border} ${styling.bg} p-3.5 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{t.name}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${styling.badge}`}>
                        {t.quadrant}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-500">{t.size} mentions</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{t.desc}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[10px] text-slate-500 font-mono">
                    <span>Centrality: {t.centrality.toFixed(1)}</span>
                    <span>Density: {t.density.toFixed(1)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    <span className="font-semibold text-slate-700">Keywords:</span> {t.keywords}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 13. Author Co-Authorship: Horizontal Bar chart of top co-authorship pairs + Radial Breakdown
  if (capabilityId === "author.co_authorship") {
    const activeView = currentView || "bar";
    const topPairs = records.slice(0, 10).map((r) => {
      const a1 = String(r.author_1 || "Author 1");
      const a2 = String(r.author_2 || "Author 2");
      const label = `${a1} & ${a2}`;
      const count = Number(r.co_authored_documents ?? r.count ?? 1);
      return {
        pair: label.length > 28 ? label.slice(0, 26) + "…" : label,
        fullPair: label,
        count,
        strength: Number(r.collaboration_strength || count),
      };
    });

    const radialData = topPairs.slice(0, 6).map((p, idx) => ({
      name: p.pair,
      value: p.count,
      fill: PALETTE[idx % PALETTE.length],
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Top Co-Authorship Partnerships</span>
            <span className="text-[10px] text-slate-400 block">Collaboration pair frequency & joint document output</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "bar", label: "Bar Ranking", icon: BarChart3 },
              { id: "radial", label: "Radial Share", icon: CircleDot },
            ]}
          />
        </div>

        {activeView === "radial" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="20%"
                outerRadius="90%"
                barSize={12}
                data={radialData}
              >
                <RadialBar
                  background
                  dataKey="value"
                  label={{ position: "insideStart", fill: "#ffffff", fontSize: 10, fontWeight: "bold" }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val} joint papers`, "Co-authorship"]} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPairs} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis type="category" dataKey="pair" tick={{ fontSize: 10, fill: "#334155" }} width={160} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${val} shared publications`,
                    item.payload.fullPair,
                  ]}
                />
                <Bar dataKey="count" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14}>
                  {topPairs.map((_, index) => (
                    <Cell key={`cell-co-${index}`} fill={index === 0 ? "#0f172a" : index < 3 ? "#3b82f6" : "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 14. Keyword Thematic Evolution: Stacked Multi-Series Area Chart across longitudinal periods
  if (capabilityId === "keyword.thematic_evolution") {
    const activeView = currentView || "area";

    // Extract chronological periods & top thematic trajectories
    const periodSet = new Set<string>();
    records.forEach((r) => {
      if (r.source_period) periodSet.add(String(r.source_period));
      if (r.target_period) periodSet.add(String(r.target_period));
    });
    const periods = Array.from(periodSet);

    // Identify top unique themes
    const themeCounts: Record<string, number> = {};
    records.forEach((r) => {
      const sTheme = String(r.source_theme || "");
      const tTheme = String(r.target_theme || "");
      if (sTheme) themeCounts[sTheme] = (themeCounts[sTheme] || 0) + 1;
      if (tTheme) themeCounts[tTheme] = (themeCounts[tTheme] || 0) + 1;
    });
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);

    // Build timeline points per period
    const areaTimelineData = periods.map((period) => {
      const point: Record<string, any> = { period };
      topThemes.forEach((theme) => {
        // Find matching transitions involving this theme and period
        const matched = records.filter(
          (r) =>
            (String(r.source_period) === period && String(r.source_theme) === theme) ||
            (String(r.target_period) === period && String(r.target_theme) === theme)
        );
        const inclusionScore = matched.reduce((acc, m) => acc + Number(m.inclusion_index || 0.5), 0);
        point[theme] = Number(inclusionScore.toFixed(2)) || 0.2;
      });
      return point;
    });

    // Bar chart fallback for evolutionary trajectory strength
    const trajectoryBarData = records.slice(0, 8).map((r) => ({
      transition: `${r.source_theme} → ${r.target_theme}`,
      inclusion: Number(r.inclusion_index || 0),
      trajectory: String(r.trajectory || "Continuation"),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Longitudinal Thematic Evolution</span>
            <span className="text-[10px] text-slate-400 block">Thematic trajectory stability & keyword volume across time slices</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "area", label: "Stacked Evolution", icon: Layers },
              { id: "bar", label: "Trajectory Strength", icon: BarChart3 },
            ]}
          />
        </div>

        {activeView === "area" && periods.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaTimelineData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                {topThemes.map((theme, idx) => (
                  <Area
                    key={theme}
                    type="monotone"
                    dataKey={theme}
                    name={theme}
                    stackId="1"
                    stroke={PALETTE[idx % PALETTE.length]}
                    fill={PALETTE[idx % PALETTE.length]}
                    fillOpacity={0.65}
                  />
                ))}
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trajectoryBarData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="transition" tick={{ fontSize: 10 }} width={170} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`Inclusion Index: ${val}`, "Evolutionary Link"]} />
                <Bar dataKey="inclusion" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 15. ML K-Means Clusters: 2D Projection Scatter Chart vs Cluster Share Donut
  if (capabilityId === "ml.kmeans_clusters") {
    const activeView = currentView || "scatter";

    // Group records by cluster
    const clusterMap: Record<string, any[]> = {};
    records.forEach((r) => {
      const cName = String(r.cluster_name || `Cluster ${r.cluster_id || 1}`);
      if (!clusterMap[cName]) clusterMap[cName] = [];
      clusterMap[cName].push({
        x: Number(r.pca_x || 0),
        y: Number(r.pca_y || 0),
        z: Math.max(10, Math.min(100, Number(r.citations || 1) * 4)),
        title: String(r.title || "Document"),
        label: String(r.title || "Document"),
        group: cName,
        xName: "PCA Dimension 1",
        yName: "PCA Dimension 2",
        zName: "Citations",
        extra: `Year: ${r.year || 2024} • Terms: ${r.top_cluster_terms || "General"}`,
      });
    });

    const clustersList = Object.entries(clusterMap);

    // Donut data: document count share per cluster
    const donutData = clustersList.map(([name, items], idx) => ({
      name,
      value: items.length,
      fill: PALETTE[idx % PALETTE.length],
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">K-Means Semantic Document Clusters</span>
            <span className="text-[10px] text-slate-400 block">2D PCA projection of TF-IDF feature space colored by cluster</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "scatter", label: "2D Cluster Projection", icon: CircleDot },
              { id: "donut", label: "Cluster Share", icon: LucidePieChart },
            ]}
          />
        </div>

        {activeView === "scatter" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 25, bottom: 15, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="PCA 1"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="PCA 2"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <ZAxis type="number" dataKey="z" range={[50, 200]} name="Citations" />
                <Tooltip content={<CustomScatterTooltip />} />
                {clustersList.map(([name, items], idx) => (
                  <Scatter
                    key={name}
                    name={name}
                    data={items}
                    fill={PALETTE[idx % PALETTE.length]}
                    fillOpacity={0.7}
                  />
                ))}
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={`cell-c-${idx}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val} publications`, "Publication Volume"]} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 16. ML LDA Topics: Horizontal Bar Chart of Topic Weights vs Donut Share
  if (capabilityId === "ml.lda_topics") {
    const activeView = currentView || "bar";
    const topicData = records.map((r) => ({
      name: String(r.topic_name || `Topic ${r.topic_id}`),
      share: Number(r.corpus_share_pct || 0),
      topWords: String(r.top_words || ""),
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Latent Dirichlet Allocation (LDA) Topic Models</span>
            <span className="text-[10px] text-slate-400 block">Probabilistic corpus share and vocabulary distribution per latent topic</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "bar", label: "Topic Weights", icon: BarChart3 },
              { id: "donut", label: "Topic Share", icon: LucidePieChart },
            ]}
          />
        </div>

        {activeView === "donut" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicData}
                  dataKey="share"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {topicData.map((_, idx) => (
                    <Cell key={`cell-lda-${idx}`} fill={PALETTE[idx % PALETTE.length]} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% corpus share • Words: ${item.payload?.topWords}`,
                    item.payload?.name || "Topic",
                  ]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% • Top terms: ${item.payload?.topWords}`,
                    "Corpus Share",
                  ]}
                />
                <Bar dataKey="share" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={16}>
                  {topicData.map((_, idx) => (
                    <Cell key={`cell-tb-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 17. ML Statistical Text Classification: Feature Importance Bar vs Class Share Donut
  if (capabilityId === "ml.text_classification") {
    const activeView = currentView || "bar";
    const topFeatures = records.slice(0, 10).map((r) => ({
      feature: String(r.feature || "term"),
      score: Number(r.composite_score || r.odds_ratio || r.rf_importance || 1),
      targetClass: String(r.target_class || "Target"),
    }));

    // Target class distribution
    const classCounts: Record<string, number> = {};
    records.forEach((r) => {
      const tClass = String(r.target_class || "Class");
      classCounts[tClass] = (classCounts[tClass] || 0) + 1;
    });
    const classDonutData = Object.entries(classCounts).map(([name, count], idx) => ({
      name,
      value: count,
      fill: PALETTE[idx % PALETTE.length],
    }));

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-800">Statistical Text Classification & Features</span>
            <span className="text-[10px] text-slate-400 block">Top discriminative keywords and class representation</span>
          </div>
          <ChartToggle
            currentView={activeView}
            onViewChange={setView}
            options={[
              { id: "bar", label: "Feature Weights", icon: BarChart3 },
              { id: "donut", label: "Class Distribution", icon: LucidePieChart },
            ]}
          />
        </div>

        {activeView === "donut" ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classDonutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {classDonutData.map((entry, idx) => (
                    <Cell key={`cell-tc-${idx}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val} discriminative features`, "Features"]} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `Weight: ${val} (Class: ${item.payload?.targetClass})`,
                    "Feature Importance",
                  ]}
                />
                <Bar dataKey="score" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14}>
                  {topFeatures.map((_, idx) => (
                    <Cell key={`cell-feat-${idx}`} fill={idx < 3 ? "#0f172a" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // 18. Generic Categorical Composition Fallback for any capability representing parts of a whole
  const firstRec = records[0];
  const hasPercentageField =
    firstRec &&
    Object.keys(firstRec).some(
      (k) =>
        k.includes("percentage") ||
        k.includes("proportion") ||
        k.includes("share") ||
        k.includes("ratio")
    );

  if (hasPercentageField) {
    const pctKey = Object.keys(firstRec).find(
      (k) =>
        k.includes("percentage") ||
        k.includes("proportion") ||
        k.includes("share") ||
        k.includes("ratio")
    )!;
    const labelKey =
      Object.keys(firstRec).find(
        (k) => !["id", "_id", pctKey].includes(k) && typeof firstRec[k] === "string"
      ) || Object.keys(firstRec)[0];

    const genericDonutData = records.slice(0, 8).map((r, idx) => {
      const rawVal = r[pctKey];
      const numericVal =
        typeof rawVal === "number"
          ? rawVal > 1
            ? rawVal
            : rawVal * 100
          : parseFloat(String(rawVal).replace("%", "")) || 0;
      return {
        name: String(r[labelKey] || `Item ${idx + 1}`),
        value: Number(numericVal.toFixed(1)),
      };
    });

    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Categorical Composition Breakdown</span>
          <span className="text-[10px] font-semibold text-slate-400 capitalize">{pctKey.replace(/_/g, " ")}</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genericDonutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
              >
                {genericDonutData.map((_, idx) => (
                  <Cell key={`cell-gen-${idx}`} fill={PALETTE[idx % PALETTE.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val}%`, pctKey.replace(/_/g, " ")]} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
      <div className="mt-2 text-xs font-bold text-slate-700">No Visual Chart Available</div>
      <div className="mt-1 text-[11px] text-slate-400">
        Data format for &ldquo;{capabilityId}&rdquo; does not support standard graphical plotting. Please inspect the Tabular Records view.
      </div>
    </div>
  );
}
