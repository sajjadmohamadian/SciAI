import React, { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { Globe2 } from "lucide-react";

export interface CountryDatum {
  country: string;
  documents: number;
  citations: number;
  avgCitations: number;
  percentage: number;
}

type MapMetric = "documents" | "citations" | "avgCitations" | "percentage";

interface Props {
  records: Record<string, any>[];
  title?: string;
}

const METRIC_CONFIG: Record<
  MapMetric,
  {
    label: string;
    shortUnit: string;
    palette: [string, string, string, string, string];
    badgeClass: string;
    textClass: string;
  }
> = {
  documents: {
    label: "Documents",
    shortUnit: "docs",
    palette: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e1b4b"],
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    textClass: "text-blue-700",
  },
  citations: {
    label: "Total Citations",
    shortUnit: "cites",
    palette: ["#d1fae5", "#6ee7b7", "#10b981", "#047857", "#022c22"],
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    textClass: "text-emerald-700",
  },
  avgCitations: {
    label: "Avg Citations / Doc",
    shortUnit: "avg",
    palette: ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309", "#451a03"],
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    textClass: "text-amber-700",
  },
  percentage: {
    label: "Corpus Share (%)",
    shortUnit: "%",
    palette: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#2e1065"],
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    textClass: "text-violet-700",
  },
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  "united states of america": ["usa", "united states", "u.s.a.", "us"],
  "united kingdom": ["uk", "great britain", "england", "scotland", "wales"],
  "iran": ["islamic republic of iran", "iran, islamic republic of"],
  "russia": ["russian federation"],
  "south korea": ["korea", "republic of korea", "korea, republic of"],
  "north korea": ["democratic people's republic of korea"],
  "china": ["peoples republic of china", "pr china", "people's republic of china"],
  "taiwan": ["taiwan, province of china", "chinese taipei"],
  "vietnam": ["viet nam"],
  "united arab emirates": ["uae"],
  "czechia": ["czech republic"],
  "turkey": ["turkiye", "türkiye"],
  "syria": ["syrian arab republic"],
  "tanzania": ["united republic of tanzania"],
  "bolivia": ["bolivia (plurinational state of)"],
  "venezuela": ["venezuela (bolivarian republic of)"],
};

function getIntensityColor(
  val: number,
  maxVal: number,
  palette: [string, string, string, string, string]
): string {
  if (!val || val <= 0 || maxVal <= 0) return "#f1f5f9";
  const ratio = Math.min(1, val / maxVal);
  if (ratio < 0.12) return palette[0];
  if (ratio < 0.30) return palette[1];
  if (ratio < 0.55) return palette[2];
  if (ratio < 0.80) return palette[3];
  return palette[4];
}

function formatMetricValue(val: number, metric: MapMetric): string {
  if (metric === "avgCitations") return val.toFixed(2);
  if (metric === "percentage") return `${val.toFixed(1)}%`;
  return Math.round(val).toLocaleString();
}

export function WorldChoroplethMap({
  records,
  title = "Country Analysis — Global Distribution Map",
}: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MapMetric>("documents");
  const [hovered, setHovered] = useState<{
    name: string;
    documents: number;
    citations: number;
    avgCitations: number;
    percentage: number;
    x: number;
    y: number;
  } | null>(null);

  const { countryDataMap, maxMetricVal, activeCountriesCount, topCountries } = useMemo(() => {
    const map = new Map<string, CountryDatum>();

    records.forEach((r) => {
      const rawName = String(r.country || r.group || r.name || r.territory || "").trim();
      if (!rawName) return;
      const docs = Number(r.documents || r.count || r.articles || r.value || 0);
      const cites = Number(r.total_citations || r.citations || 0);
      const pct = Number(r.percentage || r.share || 0);

      const key = rawName.toLowerCase();
      const existing = map.get(key);
      const mergedDocs = (existing?.documents || 0) + docs;
      const mergedCites = (existing?.citations || 0) + cites;
      const mergedPct = Number(((existing?.percentage || 0) + pct).toFixed(1));
      const explicitAvg = Number(r.average_citations || r.avg_citations || 0);
      const computedAvg =
        explicitAvg > 0
          ? explicitAvg
          : mergedDocs > 0
          ? Number((mergedCites / mergedDocs).toFixed(2))
          : 0;

      map.set(key, {
        country: rawName,
        documents: mergedDocs,
        citations: mergedCites,
        avgCitations: computedAvg,
        percentage: mergedPct,
      });
    });

    const allCountries = Array.from(map.values()); const totalAllDocs = allCountries.reduce((s, x) => s + (x.documents || 0), 0); allCountries.forEach((x) => { if (!x.percentage && totalAllDocs > 0) { x.percentage = Number(((x.documents / totalAllDocs) * 100).toFixed(1)); } });
    let maxVal = 0;
    allCountries.forEach((c) => {
      const v = c[selectedMetric] || 0;
      if (v > maxVal) maxVal = v;
    });

    const sorted = [...allCountries].sort(
      (a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0)
    );

    return {
      countryDataMap: map,
      maxMetricVal: maxVal > 0 ? maxVal : 1,
      activeCountriesCount: allCountries.filter((c) => c.documents > 0).length,
      topCountries: sorted.slice(0, 6),
    };
  }, [records, selectedMetric]);

  const features = useMemo(() => {
    const topo = worldAtlas as any;
    const geoJson = feature(topo, topo.objects.countries) as any;
    const countriesList: any[] = (geoJson.features || []).filter(
      (f: any) => String(f.properties?.name || "").toLowerCase() !== "antarctica"
    );

    const projection = geoNaturalEarth1().scale(165).translate([460, 245]);
    const pathGen = geoPath().projection(projection);

    return countriesList.map((f: any, idx: number) => {
      const geoName = String(f.properties?.name || `Country-${idx}`);
      const lowerGeo = geoName.toLowerCase();

      let matched = countryDataMap.get(lowerGeo);
      if (!matched) {
        const aliases = COUNTRY_ALIASES[lowerGeo] || [];
        for (const alias of aliases) {
          if (countryDataMap.has(alias)) {
            matched = countryDataMap.get(alias);
            break;
          }
        }
      }
      if (!matched) {
        for (const [k, v] of countryDataMap.entries()) {
          if (lowerGeo.includes(k) || k.includes(lowerGeo)) {
            matched = v;
            break;
          }
        }
      }

      return {
        id: f.id || idx,
        name: matched?.country || geoName,
        d: pathGen(f) || "",
        datum: matched,
      };
    });
  }, [countryDataMap]);

  const activeConfig = METRIC_CONFIG[selectedMetric];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Header & Metric Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">{title}</h4>
            <p className="text-[11px] text-slate-500">
              Showing <strong className="text-slate-700">{activeConfig.label}</strong> across{" "}
              {activeCountriesCount} active countries
            </p>
          </div>
        </div>

        {/* Interactive Variable Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(METRIC_CONFIG) as MapMetric[]).map((metricKey) => {
            const cfg = METRIC_CONFIG[metricKey];
            const isSelected = selectedMetric === metricKey;
            return (
              <button
                key={metricKey}
                type="button"
                onClick={() => setSelectedMetric(metricKey)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? `${cfg.badgeClass} shadow-2xs`
                    : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Intensity Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
        <span>Hover any country to view full scientometric profile</span>
        <div className="flex items-center gap-2">
          <span>Low</span>
          <div className="flex items-center gap-1">
            <span className="h-3 w-5 rounded-xs border border-slate-200 bg-[#f1f5f9]" title="0" />
            {activeConfig.palette.map((hex, i) => (
              <span
                key={i}
                className="h-3 w-5 rounded-xs"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <span>
            High ({formatMetricValue(maxMetricVal, selectedMetric)}{" "}
            {selectedMetric !== "percentage" ? activeConfig.shortUnit : ""})
          </span>
        </div>
      </div>

      {/* SVG World Map Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70">
        <svg
          viewBox="0 0 940 460"
          className="h-auto w-full max-h-[450px] select-none"
          role="img"
          aria-label="World Choropleth Map"
        >
          <rect width="940" height="460" fill="#f8fafc" />
          <line x1="0" y1="245" x2="940" y2="245" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.7" />
          <line x1="460" y1="0" x2="460" y2="460" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.7" />

          {features.map((f) => {
            const val = f.datum ? f.datum[selectedMetric] || 0 : 0;
            const fill = getIntensityColor(val, maxMetricVal, activeConfig.palette);
            const isHovered = hovered?.name === f.name;

            return (
              <path
                key={f.id}
                d={f.d}
                fill={fill}
                stroke={isHovered ? "#0f172a" : "#94a3b8"}
                strokeWidth={isHovered ? 1.3 : 0.45}
                className="cursor-pointer transition-colors duration-150"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHovered({
                    name: f.name,
                    documents: f.datum?.documents || 0,
                    citations: f.datum?.citations || 0,
                    avgCitations: f.datum?.avgCitations || 0,
                    percentage: f.datum?.percentage || 0,
                    x: rect ? e.clientX - rect.left : 200,
                    y: rect ? e.clientY - rect.top : 100,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (rect) {
                    setHovered((prev) =>
                      prev
                        ? {
                            ...prev,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          }
                        : null
                    );
                  }
                }}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-xs"
            style={{
              left: Math.min(Math.max(12, hovered.x + 12), 640),
              top: Math.max(12, hovered.y - 68),
            }}
          >
            <div className="font-bold text-slate-900">{hovered.name}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-600">
              <span>
                Docs: <strong className="text-blue-700">{hovered.documents.toLocaleString()}</strong>
              </span>
              <span>
                Citations: <strong className="text-emerald-700">{hovered.citations.toLocaleString()}</strong>
              </span>
              <span>
                Avg Cites: <strong className="text-amber-700">{hovered.avgCitations.toFixed(2)}</strong>
              </span>
              <span>
                Share: <strong className="text-violet-700">{hovered.percentage.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top 6 Countries Ranked by Selected Variable */}
      {topCountries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {topCountries.map((c, idx) => (
            <div
              key={c.country}
              className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>#{idx + 1}</span>
                <span>{c.percentage.toFixed(1)}%</span>
              </div>
              <div className="truncate text-xs font-bold text-slate-900 mt-0.5">{c.country}</div>
              <div className={`font-mono text-[11px] font-semibold mt-0.5 ${activeConfig.textClass}`}>
                {formatMetricValue(c[selectedMetric] || 0, selectedMetric)}{" "}
                {selectedMetric !== "percentage" ? activeConfig.shortUnit : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}