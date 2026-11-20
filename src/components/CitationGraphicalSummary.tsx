import React, { useMemo } from "react";
import { BibliometricDocument } from "../types.js";
import { Card } from "./CommonUI.js";
import { BarChart3, ShieldCheck, Sigma, TrendingUp } from "lucide-react";

interface Props {
  documents: BibliometricDocument[];
}

// ???? ????? ???? ????? ????? ????? ????????? (CDF)
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

export function CitationGraphicalSummary({ documents }: Props) {
  const stats = useMemo(() => {
    const vals = documents
      .map((d: any) => Number(d.citations ?? d.TC ?? 0))
      .filter((v) => !isNaN(v) && v >= 0)
      .sort((a, b) => a - b);

    const n = vals.length;
    if (n === 0) return null;

    const sum = vals.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const variance =
      n > 1
        ? vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
        : 0;
    const stDev = Math.sqrt(variance);

    // ?????? ????? (Skewness) ? ?????? (Kurtosis) ?????
    let m3 = 0;
    let m4 = 0;
    if (stDev > 0) {
      for (const v of vals) {
        const z = (v - mean) / stDev;
        m3 += Math.pow(z, 3);
        m4 += Math.pow(z, 4);
      }
    }
    const skewness =
      n > 2 && stDev > 0 ? (n / ((n - 1) * (n - 2))) * m3 : 0;
    const kurtosis =
      n > 3 && stDev > 0
        ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4 -
          (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3))
        : 0;

    // ??????? ? ??????
    const quantile = (p: number) => {
      const idx = (n - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return vals[lo];
      return vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
    };

    const min = vals[0];
    const q1 = quantile(0.25);
    const median = quantile(0.5);
    const q3 = quantile(0.75);
    const max = vals[n - 1];
    const iqr = q3 - q1;

    // ???? ??? (Outliers) ???? Boxplot
    const upperFence = q3 + 1.5 * iqr;
    const lowerFence = Math.max(min, q1 - 1.5 * iqr);
    const whiskerLow = vals.find((v) => v >= lowerFence) ?? min;
    const whiskerHigh =
      [...vals].reverse().find((v) => v <= upperFence) ?? max;
    const outliers = vals.filter((v) => v > upperFence || v < lowerFence);

    // ???????? ??????? 95% ???? Mean, Median, StDev
    const seMean = stDev / Math.sqrt(n);
    const z95 = 1.95996;
    const ciMeanLow = Math.max(0, mean - z95 * seMean);
    const ciMeanHigh = mean + z95 * seMean;

    // ???? ??????? 95% ???? ????? (Order Statistics)
    const medOffset = Math.ceil((z95 * Math.sqrt(n)) / 2);
    const medLowIdx = Math.max(0, Math.floor(n / 2) - medOffset);
    const medHighIdx = Math.min(n - 1, Math.floor(n / 2) + medOffset);
    const ciMedLow = vals[medLowIdx];
    const ciMedHigh = vals[medHighIdx];

    // ???? ??????? 95% ???? ?????? ?????
    const seStDev = stDev / Math.sqrt(Math.max(1, 2 * (n - 1)));
    const ciStDevLow = Math.max(0, stDev - z95 * seStDev);
    const ciStDevHigh = stDev + z95 * seStDev;

    // ????? ???????? ???????-??????? (Anderson-Darling A^2)
    let aSquared = 0;
    if (stDev > 0 && n > 1) {
      let sumAD = 0;
      for (let i = 0; i < n; i++) {
        const z1 = (vals[i] - mean) / stDev;
        const z2 = (vals[n - 1 - i] - mean) / stDev;
        const f1 = Math.min(1 - 1e-12, Math.max(1e-12, normalCDF(z1)));
        const f2 = Math.min(1 - 1e-12, Math.max(1e-12, normalCDF(z2)));
        sumAD += (2 * (i + 1) - 1) * (Math.log(f1) + Math.log(1 - f2));
      }
      const rawA2 = -n - sumAD / n;
      aSquared = rawA2 * (1 + 0.75 / n + 2.25 / (n * n));
    }
    const pValueLabel =
      aSquared > 1.092
        ? "< 0.005"
        : aSquared > 0.787
        ? "< 0.050"
        : "> 0.100";

    // ???? ?????? ????????? (Bins) ? ????? ????? ????????
    const binCount = 24;
    const binWidth = Math.max(1, (max - min) / binCount);
    const bins = Array.from({ length: binCount }, (_, idx) => {
      const start = min + idx * binWidth;
      const end = start + binWidth;
      const count = vals.filter((v) =>
        idx === binCount - 1 ? v >= start && v <= end : v >= start && v < end
      ).length;
      const mid = (start + end) / 2;
      const normalDensity =
        stDev > 0
          ? (1 / (stDev * Math.sqrt(2 * Math.PI))) *
            Math.exp(-0.5 * Math.pow((mid - mean) / stDev, 2))
          : 0;
      const expectedCount = normalDensity * n * binWidth;
      return { idx, start, end, mid, count, expectedCount };
    });

    const maxBinCount = Math.max(
      1,
      ...bins.map((b) => Math.max(b.count, b.expectedCount))
    );

    return {
      n,
      mean,
      stDev,
      variance,
      skewness,
      kurtosis,
      min,
      q1,
      median,
      q3,
      max,
      whiskerLow,
      whiskerHigh,
      outliers,
      ciMeanLow,
      ciMeanHigh,
      ciMedLow,
      ciMedHigh,
      ciStDevLow,
      ciStDevHigh,
      aSquared,
      pValueLabel,
      bins,
      maxBinCount,
    };
  }, [documents]);

  if (!stats) {
    return (
      <Card padding="lg" className="text-center text-xs text-ink-muted">
        No citation records available for statistical summary.
      </Card>
    );
  }

  // ????? SVG ???? ?????? ?????????? ????????? + Boxplot + ???? ???????
  const chartW = 640;
  const padL = 46;
  const padR = 24;
  const plotW = chartW - padL - padR;

  const histTop = 18;
  const histH = 215;
  const boxTop = histTop + histH + 34;
  const boxH = 44;
  const ciTop = boxTop + boxH + 46;
  const ciH = 92;
  const totalH = ciTop + ciH + 34;

  const domainMax = Math.max(1, stats.max * 1.03);
  const scaleX = (v: number) =>
    padL + (Math.max(0, v - stats.min) / Math.max(1, domainMax - stats.min)) * plotW;

  // ???? ????? ????? ????????
  const normalPoints = stats.bins
    .map((b) => {
      const x = scaleX(b.mid);
      const y = histTop + histH - (b.expectedCount / stats.maxBinCount) * histH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // ????? ???? ???? ?????? ???? ??????? 95% (Mean vs Median)
  const ciDomainMin = Math.max(0, Math.min(stats.ciMedLow, stats.ciMeanLow) * 0.85);
  const ciDomainMax = Math.max(ciDomainMin + 1, Math.max(stats.ciMedHigh, stats.ciMeanHigh) * 1.12);
  const scaleCiX = (v: number) =>
    padL + 36 + ((v - ciDomainMin) / (ciDomainMax - ciDomainMin)) * (plotW - 48);

  const ticksX = Array.from({ length: 7 }, (_, i) =>
    Math.round(stats.min + ((domainMax - stats.min) * i) / 6)
  );
  const ciTicks = Array.from({ length: 6 }, (_, i) =>
    Number((ciDomainMin + ((ciDomainMax - ciDomainMin) * i) / 5).toFixed(1))
  );

  return (
    <div className="space-y-5">
      {/* ??? ????? ????? */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-border-default pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <h3 className="text-base font-bold text-ink-primary">
                Citations ? Statistical Distribution & Normality Summary
              </h3>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Comprehensive parametric & non-parametric diagnostics: frequency histogram with normal density overlay, outlier boxplot, 95% confidence intervals, and Anderson-Darling test.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-bold text-brand-700">
            <Sigma className="h-4 w-4" />
            <span>N = {stats.n.toLocaleString()} Documents</span>
          </div>
        </div>

        {/* ?????? ?? ?????: ????????? ?????? ?? ?? ? ????? ????? ?? ???? */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* ???? ??: ????????? + ????? ????? + Boxplot + ???? ??????? 95% */}
          <div className="rounded-xl border border-border-default bg-white p-4 xl:col-span-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-secondary">
              <span className="font-bold text-ink-primary">
                Citation Frequency Distribution & Outlier Boxplot
              </span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-brand-600"></span>
                  Observed Citations
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 bg-rose-600"></span>
                  Normal Fit Curve
                </span>
              </div>
            </div>

            <svg viewBox={`0 0 ${chartW} ${totalH}`} className="h-auto w-full select-none">
              {/* ???? ??????? ????? ????????? */}
              {ticksX.map((tk, i) => {
                const x = scaleX(tk);
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={histTop}
                      x2={x}
                      y2={histTop + histH}
                      stroke="#e2e8f0"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={x}
                      y={histTop + histH + 15}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                    >
                      {tk}
                    </text>
                  </g>
                );
              })}

              {/* ?????? ????????? */}
              <rect
                x={padL}
                y={histTop}
                width={plotW}
                height={histH}
                fill="none"
                stroke="#cbd5e1"
              />

              {/* ???????? ????????? */}
              {stats.bins.map((b) => {
                const x1 = scaleX(b.start);
                const x2 = scaleX(b.end);
                const barW = Math.max(2, x2 - x1 - 1);
                const barH = (b.count / stats.maxBinCount) * histH;
                const y = histTop + histH - barH;
                return (
                  <rect
                    key={b.idx}
                    x={x1}
                    y={y}
                    width={barW}
                    height={barH}
                    fill="#315C7C"
                    fillOpacity={0.85}
                    rx={1.5}
                  >
                    <title>
                      {`Citations [${Math.round(b.start)} ? ${Math.round(b.end)}]: ${b.count} docs (Normal Expected: ${b.expectedCount.toFixed(1)})`}
                    </title>
                  </rect>
                );
              })}

              {/* ????? ????? ???????? */}
              <polyline
                fill="none"
                stroke="#be123c"
                strokeWidth="2.2"
                points={normalPoints}
              />

              {/* ?????? ??????? (Horizontal Boxplot) ??? ????????? */}
              <rect
                x={padL}
                y={boxTop}
                width={plotW}
                height={boxH}
                fill="#f8fafc"
                stroke="#cbd5e1"
                rx={4}
              />
              {/* ???? ?? ? ???? (Whiskers) */}
              <line
                x1={scaleX(stats.whiskerLow)}
                y1={boxTop + boxH / 2}
                x2={scaleX(stats.q1)}
                y2={boxTop + boxH / 2}
                stroke="#334155"
                strokeWidth="1.5"
              />
              <line
                x1={scaleX(stats.q3)}
                y1={boxTop + boxH / 2}
                x2={scaleX(stats.whiskerHigh)}
                y2={boxTop + boxH / 2}
                stroke="#334155"
                strokeWidth="1.5"
              />
              <line
                x1={scaleX(stats.whiskerLow)}
                y1={boxTop + 12}
                x2={scaleX(stats.whiskerLow)}
                y2={boxTop + boxH - 12}
                stroke="#334155"
                strokeWidth="1.5"
              />
              <line
                x1={scaleX(stats.whiskerHigh)}
                y1={boxTop + 12}
                x2={scaleX(stats.whiskerHigh)}
                y2={boxTop + boxH - 12}
                stroke="#334155"
                strokeWidth="1.5"
              />
              {/* ???? ???? ??? ?? ??? (IQR Box) */}
              <rect
                x={scaleX(stats.q1)}
                y={boxTop + 9}
                width={Math.max(4, scaleX(stats.q3) - scaleX(stats.q1))}
                height={boxH - 18}
                fill="#60a5fa"
                fillOpacity={0.65}
                stroke="#1d4ed8"
                strokeWidth="1.5"
                rx={2}
              >
                <title>{`IQR: Q1=${stats.q1.toFixed(1)}, Median=${stats.median.toFixed(1)}, Q3=${stats.q3.toFixed(1)}`}</title>
              </rect>
              {/* ?? ????? ???? ???? */}
              <line
                x1={scaleX(stats.median)}
                y1={boxTop + 9}
                x2={scaleX(stats.median)}
                y2={boxTop + boxH - 9}
                stroke="#1e3a8a"
                strokeWidth="2.2"
              />
              {/* ???? ??? (Outliers ?? ???? ?????) */}
              {stats.outliers.slice(0, 140).map((ov, i) => {
                const ox = scaleX(ov);
                const oy = boxTop + boxH / 2;
                return (
                  <g key={i} transform={`translate(${ox}, ${oy})`}>
                    <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#475569" strokeWidth="1.1" />
                    <line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5" stroke="#475569" strokeWidth="1.1" />
                    <title>{`Outlier: ${ov} citations`}</title>
                  </g>
                );
              })}

              {/* ??? ???: ?????? 95% Confidence Intervals ???? Mean ? Median */}
              <text
                x={padL + plotW / 2}
                y={ciTop - 12}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
              >
                95% Confidence Intervals (Mean vs. Median)
              </text>
              <rect
                x={padL}
                y={ciTop}
                width={plotW}
                height={ciH}
                fill="#ffffff"
                stroke="#cbd5e1"
                rx={4}
              />

              {ciTicks.map((tk, i) => {
                const x = scaleCiX(tk);
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={ciTop}
                      x2={x}
                      y2={ciTop + ciH}
                      stroke="#f1f5f9"
                    />
                    <text
                      x={x}
                      y={ciTop + ciH + 15}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                    >
                      {tk}
                    </text>
                  </g>
                );
              })}

              {/* ???? Mean CI */}
              <text
                x={padL + 10}
                y={ciTop + 30}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
              >
                Mean
              </text>
              <line
                x1={scaleCiX(stats.ciMeanLow)}
                y1={ciTop + 26}
                x2={scaleCiX(stats.ciMeanHigh)}
                y2={ciTop + 26}
                stroke="#1d4ed8"
                strokeWidth="2"
              />
              <line
                x1={scaleCiX(stats.ciMeanLow)}
                y1={ciTop + 20}
                x2={scaleCiX(stats.ciMeanLow)}
                y2={ciTop + 32}
                stroke="#1d4ed8"
                strokeWidth="2"
              />
              <line
                x1={scaleCiX(stats.ciMeanHigh)}
                y1={ciTop + 20}
                x2={scaleCiX(stats.ciMeanHigh)}
                y2={ciTop + 32}
                stroke="#1d4ed8"
                strokeWidth="2"
              />
              <circle
                cx={scaleCiX(stats.mean)}
                cy={ciTop + 26}
                r="4.5"
                fill="#1d4ed8"
              >
                <title>{`Mean: ${stats.mean.toFixed(3)} (95% CI: ${stats.ciMeanLow.toFixed(3)} ? ${stats.ciMeanHigh.toFixed(3)})`}</title>
              </circle>

              {/* ???? Median CI */}
              <text
                x={padL + 10}
                y={ciTop + 68}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
              >
                Median
              </text>
              <line
                x1={scaleCiX(stats.ciMedLow)}
                y1={ciTop + 64}
                x2={scaleCiX(stats.ciMedHigh)}
                y2={ciTop + 64}
                stroke="#0f766e"
                strokeWidth="2"
              />
              <line
                x1={scaleCiX(stats.ciMedLow)}
                y1={ciTop + 58}
                x2={scaleCiX(stats.ciMedLow)}
                y2={ciTop + 70}
                stroke="#0f766e"
                strokeWidth="2"
              />
              <line
                x1={scaleCiX(stats.ciMedHigh)}
                y1={ciTop + 58}
                x2={scaleCiX(stats.ciMedHigh)}
                y2={ciTop + 70}
                stroke="#0f766e"
                strokeWidth="2"
              />
              <circle
                cx={scaleCiX(stats.median)}
                cy={ciTop + 64}
                r="4.5"
                fill="#0f766e"
              >
                <title>{`Median: ${stats.median.toFixed(3)} (95% CI: ${stats.ciMedLow.toFixed(3)} ? ${stats.ciMedHigh.toFixed(3)})`}</title>
              </circle>
            </svg>
          </div>

          {/* ???? ????: ????? ???? ??????? ???????? ????? Anderson-Darling ? ???????? ??????? */}
          <div className="space-y-3.5 xl:col-span-4">
            {/* ???? ?: Anderson-Darling Normality Test */}
            <div className="rounded-xl border border-border-default bg-surface-subtle/50 p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-primary">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                Anderson-Darling Normality Test
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border-default bg-white px-2.5 py-1.5">
                  <div className="text-[10px] font-semibold text-ink-muted">A-Squared (A?)</div>
                  <div className="font-mono text-sm font-bold text-ink-primary">
                    {stats.aSquared.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-border-default bg-white px-2.5 py-1.5">
                  <div className="text-[10px] font-semibold text-ink-muted">P-Value</div>
                  <div className="font-mono text-sm font-bold text-rose-700">
                    {stats.pValueLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* ???? ?: ???????? ?????? ???????? ? ????? */}
            <div className="rounded-xl border border-border-default bg-white p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-primary">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                Moments & Dispersion Metrics
              </div>
              <dl className="divide-y divide-border-subtle text-xs">
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Mean</dt>
                  <dd className="font-mono font-bold text-ink-primary">{stats.mean.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">StDev</dt>
                  <dd className="font-mono font-bold text-ink-primary">{stats.stDev.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Variance</dt>
                  <dd className="font-mono font-bold text-ink-primary">{stats.variance.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Skewness</dt>
                  <dd className="font-mono font-bold text-amber-700">{stats.skewness.toFixed(4)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Kurtosis</dt>
                  <dd className="font-mono font-bold text-amber-700">{stats.kurtosis.toFixed(4)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Sample Size (N)</dt>
                  <dd className="font-mono font-bold text-brand-700">{stats.n}</dd>
                </div>
              </dl>
            </div>

            {/* ???? ?: ??????? ? ?????? */}
            <div className="rounded-xl border border-border-default bg-white p-3.5">
              <div className="mb-2 text-xs font-bold text-ink-primary">
                Order Statistics & Quartiles
              </div>
              <dl className="divide-y divide-border-subtle text-xs">
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Minimum</dt>
                  <dd className="font-mono font-semibold text-ink-primary">{stats.min.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">1st Quartile (Q1)</dt>
                  <dd className="font-mono font-semibold text-ink-primary">{stats.q1.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Median (Q2)</dt>
                  <dd className="font-mono font-bold text-teal-700">{stats.median.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">3rd Quartile (Q3)</dt>
                  <dd className="font-mono font-semibold text-ink-primary">{stats.q3.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-secondary">Maximum</dt>
                  <dd className="font-mono font-semibold text-ink-primary">{stats.max.toFixed(3)}</dd>
                </div>
              </dl>
            </div>

            {/* ???? ?: ???????? ??????? 95% */}
            <div className="rounded-xl border border-border-default bg-surface-subtle/50 p-3.5">
              <div className="mb-2 text-xs font-bold text-ink-primary">
                95% Confidence Intervals
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border-default bg-white px-2.5 py-1.5">
                  <span className="font-semibold text-ink-secondary">Mean</span>
                  <span className="font-mono font-bold text-brand-700">
                    [{stats.ciMeanLow.toFixed(3)} , {stats.ciMeanHigh.toFixed(3)}]
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-default bg-white px-2.5 py-1.5">
                  <span className="font-semibold text-ink-secondary">Median</span>
                  <span className="font-mono font-bold text-teal-700">
                    [{stats.ciMedLow.toFixed(3)} , {stats.ciMedHigh.toFixed(3)}]
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-default bg-white px-2.5 py-1.5">
                  <span className="font-semibold text-ink-secondary">StDev</span>
                  <span className="font-mono font-bold text-ink-primary">
                    [{stats.ciStDevLow.toFixed(3)} , {stats.ciStDevHigh.toFixed(3)}]
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
