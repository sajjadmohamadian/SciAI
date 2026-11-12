import { useState, useEffect } from "react";
import {
  Scale,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Hash,
  RefreshCw,
  Calculator,
  FileCode,
  HelpCircle,
  Activity,
  Info,
  PieChart,
  FileSpreadsheet,
} from "lucide-react";
import { Dataset } from "../types.js";
import { Button, Card } from "./CommonUI.js";

interface CorpusProfile {
  name: string;
  totalDocs: number;
  totalCitations: number;
  meanCitations: number;
  medianCitations: number;
  hIndex: number;
  gIndex: number;
  uncitedRate: number;
  top10PctCitations: number;
  meanAuthorsPerPaper: number;
  mcpRatio: number;
  uniqueVenues: number;
  bradfordCoreCount: number;
  bradfordK: number;
  uniqueKeywords: number;
  timespan: string;
  cagr: number;
}

export interface DistributionMetrics {
  min: number;
  q25: number;
  median: number;
  q75: number;
  iqr: number;
  max: number;
  mean: number;
  stdDev: number;
  variance: number;
  standardError: number;
  skewness: number;
}

export interface EcdfPoint {
  value: number;
  cdfA: number;
  cdfB: number;
  difference: number;
  isMaxD: boolean;
}

export interface Contingency2x2 {
  name: string;
  table: {
    row1Label: string;
    row2Label: string;
    col1Label: string;
    col2Label: string;
    a11: number;
    a12: number;
    a21: number;
    a22: number;
  };
  chi2: number;
  chi2Yates: number;
  pValue: number;
  significant: boolean;
  oddsRatio: number;
  oddsRatioCi95: [number, number];
  interpretation: string;
}

export interface BenchmarkStatistics {
  mannWhitneyU: {
    uStatistic: number;
    uA: number;
    uB: number;
    zScore: number;
    pValue: number;
    significant: boolean;
    cliffsDelta: number;
    rankBiserial: number;
    effectSize: "Negligible" | "Small" | "Medium" | "Large";
    interpretation: string;
    interpretationFa: string;
  };
  kolmogorovSmirnov: {
    dStatistic: number;
    criticalValue: number;
    pValue: number;
    significant: boolean;
    maxDLocation: number;
    interpretation: string;
    interpretationFa: string;
  };
  welchTTest: {
    tStatistic: number;
    degreesOfFreedom: number;
    pValue: number;
    significant: boolean;
    meanDiff: number;
    meanDiffCi95: [number, number];
    cohensD: number;
    effectSize: "Negligible" | "Small" | "Medium" | "Large";
    interpretation: string;
    interpretationFa: string;
  };
  permutationTest: {
    observedDiff: number;
    resamples: number;
    pValue: number;
    significant: boolean;
    bootstrapCi95: [number, number];
    interpretation: string;
    interpretationFa: string;
  };
  chiSquareCollaboration: Contingency2x2;
  chiSquareElitePapers: Contingency2x2;
  distributionA: DistributionMetrics;
  distributionB: DistributionMetrics;
  ecdfPoints: EcdfPoint[];
}

interface BenchmarkReport {
  corpusA: CorpusProfile;
  corpusB: CorpusProfile;
  statistics: BenchmarkStatistics;
  thematics: {
    jaccardSimilarity: number;
    cosineSimilarity: number;
    sharedKeywordsCount: number;
    distinctiveKeywordsA: Array<{
      keyword: string;
      freqA: number;
      freqB: number;
      specificity: number;
    }>;
    distinctiveKeywordsB: Array<{
      keyword: string;
      freqA: number;
      freqB: number;
      specificity: number;
    }>;
    sharedBridgeKeywords: Array<{
      keyword: string;
      freqA: number;
      freqB: number;
      balance: number;
    }>;
  };
  radarScores: Array<{
    dimension: string;
    scoreA: number;
    scoreB: number;
    metricLabelA: string;
    metricLabelB: string;
  }>;
  yearlyTrends: Array<{
    year: number;
    docsA: number;
    docsB: number;
    citesA: number;
    citesB: number;
  }>;
  executiveSummary: string;
}

interface Props {
  datasets: Dataset[];
}

export function ComparativeBenchmarkingStudio({ datasets }: Props) {
  const [datasetIdA, setDatasetIdA] = useState<string>(
    datasets[0]?.id || "dataset-bio-1"
  );
  const [datasetIdB, setDatasetIdB] = useState<string>(
    datasets[1]?.id || "dataset-crispr-2"
  );
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "statistics" | "thematics" | "trends"
  >("overview");
  const [statSubTab, setStatSubTab] = useState<
    "matrix" | "ecdf" | "quantiles" | "contingency" | "guide"
  >("matrix");
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [hoveredEcdf, setHoveredEcdf] = useState<EcdfPoint | null>(null);

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/benchmark/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIdA, datasetIdB }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBenchmark();
  }, []);

  const handleCopySummary = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.executiveSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLatex = () => {
    if (!report || !report.statistics) return;
    const s = report.statistics;
    const latex = `% =======================================================
% Comparative Bibliometric Hypothesis Testing Matrix (Biblium / Scientometrics)
% Generated by Biblium Benchmarking Studio
% =======================================================
\\begin{table}[htbp]
\\centering
\\caption{Comparative Statistical Significance Suite: ${report.corpusA.name} vs. ${report.corpusB.name}}
\\label{tab:bibliometric_significance}
\\begin{tabular}{lccccc}
\\hline
\\textbf{Statistical Hypothesis Test} & \\textbf{Test Statistic} & \\textbf{p-Value} & \\textbf{Effect Size} & \\textbf{Decision ($\\alpha=0.05$)} \\\\
\\hline
Mann-Whitney $U$ (Wilcoxon Rank-Sum) & $U=${s.mannWhitneyU.uStatistic},\\, Z=${s.mannWhitneyU.zScore}$ & $p=${s.mannWhitneyU.pValue}$ & Cliff's $\\delta=${s.mannWhitneyU.cliffsDelta}$ (${s.mannWhitneyU.effectSize}) & ${s.mannWhitneyU.significant ? "Reject $H_0$ (Significant)" : "Fail to Reject $H_0$"} \\\\
Two-Sample Kolmogorov-Smirnov & $D=${s.kolmogorovSmirnov.dStatistic},\\, D_{\\text{crit}}=${s.kolmogorovSmirnov.criticalValue}$ & $p=${s.kolmogorovSmirnov.pValue}$ & $D_{\\max}$ at ${s.kolmogorovSmirnov.maxDLocation} cites & ${s.kolmogorovSmirnov.significant ? "Distinct ECDF Curves" : "Equivalent Shapes"} \\\\
Welch's $t$-test (Unequal Var) & $t(${s.welchTTest.degreesOfFreedom})=${s.welchTTest.tStatistic}$ & $p=${s.welchTTest.pValue}$ & Cohen's $d=${s.welchTTest.cohensD}$ (${s.welchTTest.effectSize}) & ${s.welchTTest.significant ? "Reject $H_0$ (Significant)" : "Fail to Reject $H_0$"} \\\\
Monte Carlo Permutation (1,000 runs) & $\\Delta=${s.permutationTest.observedDiff}$ & $p=${s.permutationTest.pValue}$ & 95\\% Bootstrap CI: $[${s.permutationTest.bootstrapCi95[0]}, ${s.permutationTest.bootstrapCi95[1]}]$ & ${s.permutationTest.significant ? "Significant" : "Fail to Reject $H_0$"} \\\\
$\\chi^2$ International Collaboration (MCP) & $\\chi^2=${s.chiSquareCollaboration.chi2},\\, \\chi^2_{\\text{Yates}}=${s.chiSquareCollaboration.chi2Yates}$ & $p=${s.chiSquareCollaboration.pValue}$ & $\\text{OR}=${s.chiSquareCollaboration.oddsRatio}$ [${s.chiSquareCollaboration.oddsRatioCi95[0]}--${s.chiSquareCollaboration.oddsRatioCi95[1]}]$ & ${s.chiSquareCollaboration.significant ? "Significant Association" : "Independent"} \\\\
$\\chi^2$ Elite Papers (Top 10\\% Citations) & $\\chi^2=${s.chiSquareElitePapers.chi2},\\, \\chi^2_{\\text{Yates}}=${s.chiSquareElitePapers.chi2Yates}$ & $p=${s.chiSquareElitePapers.pValue}$ & $\\text{OR}=${s.chiSquareElitePapers.oddsRatio}$ [${s.chiSquareElitePapers.oddsRatioCi95[0]}--${s.chiSquareElitePapers.oddsRatioCi95[1]}]$ & ${s.chiSquareElitePapers.significant ? "Significant Association" : "Independent"} \\\\
\\hline
\\end{tabular}
\\end{table}`;
    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const handleCopyMarkdown = () => {
    if (!report || !report.statistics) return;
    const s = report.statistics;
    const md = `### Comparative Statistical Significance Suite: ${report.corpusA.name} vs. ${report.corpusB.name}
| Statistical Hypothesis Test | Test Statistic | p-Value | Effect Size / Metric | 95% Confidence Interval | Decision (α=0.05) |
|---|---|---|---|---|---|
| **Mann-Whitney U (Wilcoxon)** | U = ${s.mannWhitneyU.uStatistic}, Z = ${s.mannWhitneyU.zScore} | ${s.mannWhitneyU.pValue} | Cliff's δ = ${s.mannWhitneyU.cliffsDelta} (${s.mannWhitneyU.effectSize}) | Rank-Biserial r = ${s.mannWhitneyU.rankBiserial} | ${s.mannWhitneyU.significant ? "Reject H₀ (Significant)" : "Fail to Reject H₀"} |
| **Two-Sample Kolmogorov-Smirnov** | D = ${s.kolmogorovSmirnov.dStatistic} (crit: ${s.kolmogorovSmirnov.criticalValue}) | ${s.kolmogorovSmirnov.pValue} | Max D at ${s.kolmogorovSmirnov.maxDLocation} citations | - | ${s.kolmogorovSmirnov.significant ? "Distinct ECDF Curves" : "Equivalent Shapes"} |
| **Welch's t-test (unequal var)** | t(${s.welchTTest.degreesOfFreedom}) = ${s.welchTTest.tStatistic} | ${s.welchTTest.pValue} | Cohen's d = ${s.welchTTest.cohensD} (${s.welchTTest.effectSize}) | [${s.welchTTest.meanDiffCi95[0]}, ${s.welchTTest.meanDiffCi95[1]}] | ${s.welchTTest.significant ? "Reject H₀ (Significant)" : "Fail to Reject H₀"} |
| **Monte Carlo Permutation (1,000 runs)** | Δ = ${s.permutationTest.observedDiff} | ${s.permutationTest.pValue} | Resampling mean diff | [${s.permutationTest.bootstrapCi95[0]}, ${s.permutationTest.bootstrapCi95[1]}] | ${s.permutationTest.significant ? "Significant" : "Fail to Reject H₀"} |
| **Chi-Square Collaboration (MCP vs SCP)** | χ² = ${s.chiSquareCollaboration.chi2} (Yates: ${s.chiSquareCollaboration.chi2Yates}) | ${s.chiSquareCollaboration.pValue} | Odds Ratio = ${s.chiSquareCollaboration.oddsRatio} | [${s.chiSquareCollaboration.oddsRatioCi95[0]}, ${s.chiSquareCollaboration.oddsRatioCi95[1]}] | ${s.chiSquareCollaboration.significant ? "Significant Association" : "Independent"} |
| **Chi-Square Elite Papers (Top 10%)** | χ² = ${s.chiSquareElitePapers.chi2} (Yates: ${s.chiSquareElitePapers.chi2Yates}) | ${s.chiSquareElitePapers.pValue} | Odds Ratio = ${s.chiSquareElitePapers.oddsRatio} | [${s.chiSquareElitePapers.oddsRatioCi95[0]}, ${s.chiSquareElitePapers.oddsRatioCi95[1]}] | ${s.chiSquareElitePapers.significant ? "Significant Association" : "Independent"} |
`;
    navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const pA = report?.corpusA;
  const pB = report?.corpusB;
  const stats = report?.statistics;
  const thematics = report?.thematics;
  const radar = report?.radarScores || [];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="sciai-studio-shell p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
              <Scale className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-ink-primary">
                  Biblium Comparative Cross-Dataset Benchmarking
                </h2>
                <span className="whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                  Biblium Framework
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ink-muted">
                Side-by-side scientometric benchmarking across two independent
                scientific corpora. Features non-parametric hypothesis testing
                (Mann-Whitney U, Kolmogorov-Smirnov, Pearson’s χ²), relative
                thematic specialization (Log-Odds specificity), and
                6-dimensional radar alignment.
              </p>
            </div>
          </div>

          {/* Dataset Pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border-default bg-surface-canvas px-2.5 py-1 text-xs shadow-card">
              <span className="shrink-0 font-bold text-brand-600">
                Corpus A:
              </span>
              <select
                value={datasetIdA}
                onChange={(e) => setDatasetIdA(e.target.value)}
                className="min-w-0 max-w-full truncate bg-transparent font-semibold text-ink-primary focus:outline-none sm:max-w-64"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.record_count} docs)
                  </option>
                ))}
              </select>
            </div>

            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />

            <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border-default bg-surface-canvas px-2.5 py-1 text-xs shadow-card">
              <span className="shrink-0 font-bold text-status-success-text">
                Corpus B:
              </span>
              <select
                value={datasetIdB}
                onChange={(e) => setDatasetIdB(e.target.value)}
                className="min-w-0 max-w-full truncate bg-transparent font-semibold text-ink-primary focus:outline-none sm:max-w-64"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.record_count} docs)
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={loading}
              disabled={loading}
              onClick={runBenchmark}
              icon={
                !loading ? <RefreshCw className="h-3.5 w-3.5" /> : undefined
              }
              className="shrink-0"
            >
              Compute Benchmark
            </Button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeTab === "overview"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            1. Comparative Profiles &amp; Radar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statistics")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeTab === "statistics"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            2. Statistical Significance Suite (U, K-S, χ²)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("thematics")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeTab === "thematics"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            3. Thematic Specialization &amp; Log-Odds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trends")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
              activeTab === "trends"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-surface-canvas hover:text-ink-primary"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            4. Longitudinal Trajectory &amp; Growth
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* TAB 1: Profiles & 6-Axis Radar */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Executive Summary Card with Copy */}
              <Card padding="md">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    <h3 className="sciai-kicker text-ink-primary!">
                      Executive Scientometric Synthesis
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySummary}
                    icon={
                      copied ? (
                        <Check className="h-3 w-3 text-status-success-text" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )
                    }
                  >
                    {copied ? "Copied" : "Copy Synthesis"}
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                  {report.executiveSummary}
                </p>
              </Card>

              {/* Side-by-Side Comparison Metrics Table */}
              <Card padding="md">
                <div className="mb-4 border-b border-border-subtle pb-3">
                  <h3 className="text-sm font-black text-ink-primary">
                    Side-by-Side Scientometric Indicators
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Direct comparison of volume, citation velocity, author
                    productivity, and venue concentration
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                        <th className="px-4 py-2.5">
                          Scientometric Dimension
                        </th>
                        <th className="px-4 py-2.5 font-black text-brand-700">
                          {pA?.name} (Corpus A)
                        </th>
                        <th className="px-4 py-2.5 font-black text-status-success-text">
                          {pB?.name} (Corpus B)
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Relative Delta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Indexed Document Volume (N)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pA?.totalDocs}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pB?.totalDocs}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] text-ink-muted">
                          {pA && pB
                            ? `${Math.round(((pA.totalDocs - pB.totalDocs) / pB.totalDocs) * 100)}%`
                            : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Total Citation Count
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pA?.totalCitations}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pB?.totalCitations}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] text-ink-muted">
                          {pA && pB
                            ? `${Math.round(((pA.totalCitations - pB.totalCitations) / pB.totalCitations) * 100)}%`
                            : "N/A"}
                        </td>
                      </tr>
                      <tr className="bg-surface-subtle/50">
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Mean Citation Velocity (μ)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-brand-600">
                          {pA?.meanCitations}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-status-success-text">
                          {pB?.meanCitations}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] font-bold text-ink-primary">
                          {pA && pB && (
                            <span
                              className={
                                pA.meanCitations >= pB.meanCitations
                                  ? "text-brand-600"
                                  : "text-status-success-text"
                              }
                            >
                              {pA.meanCitations >= pB.meanCitations
                                ? `+${Math.round(((pA.meanCitations - pB.meanCitations) / pB.meanCitations) * 100)}% A`
                                : `+${Math.round(((pB.meanCitations - pA.meanCitations) / pA.meanCitations) * 100)}% B`}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Median Citations
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pA?.medianCitations}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pB?.medianCitations}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-ink-subtle">
                          -
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Corpus H-Index &amp; G-Index
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          h={pA?.hIndex}, g={pA?.gIndex}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          h={pB?.hIndex}, g={pB?.gIndex}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] text-ink-muted">
                          Δh = {(pA?.hIndex || 0) - (pB?.hIndex || 0)}
                        </td>
                      </tr>
                      <tr className="bg-surface-subtle/50">
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Uncited Paper Rate (% zeroes)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pA?.uncitedRate}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pB?.uncitedRate}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] text-ink-subtle">
                          {pA && pB
                            ? `${(pA.uncitedRate - pB.uncitedRate).toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Co-authorship Density (Authors/Doc)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pA?.meanAuthorsPerPaper}
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pB?.meanAuthorsPerPaper}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-ink-subtle">
                          -
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          International Collaboration (MCP %)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-brand-600">
                          {pA?.mcpRatio}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-status-success-text">
                          {pB?.mcpRatio}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] font-bold text-ink-primary">
                          Δ ={" "}
                          {pA && pB
                            ? `${(pA.mcpRatio - pB.mcpRatio).toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                      <tr className="bg-surface-subtle/50">
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Bradford Core Journals (Zone 1) &amp; Coeff (k)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pA?.bradfordCoreCount} venues (k={pA?.bradfordK})
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                          {pB?.bradfordCoreCount} venues (k={pB?.bradfordK})
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-ink-subtle">
                          -
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold text-ink-primary">
                          Annual Growth Momentum (CAGR)
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pA?.cagr}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                          {pB?.cagr}%
                        </td>
                        <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-[11px] text-ink-subtle">
                          Δ ={" "}
                          {pA && pB
                            ? `${(pA.cagr - pB.cagr).toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 6-Axis Comparative Radar & Alignment */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <Card padding="md" className="lg:col-span-6">
                  <div className="border-b border-border-subtle pb-3">
                    <h3 className="text-sm font-black text-ink-primary">
                      Hexagonal Scientometric Radar
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Normalized alignment across 6 essential scientometric
                      pillars
                    </p>
                  </div>

                  <div className="relative mt-4 flex h-80 w-full items-center justify-center">
                    <svg
                      viewBox="-110 -110 220 220"
                      className="h-full w-full max-w-sm"
                    >
                      {[0.25, 0.5, 0.75, 1.0].map((scale, sIdx) => {
                        const points = [0, 1, 2, 3, 4, 5]
                          .map((i) => {
                            const angle = (i * 60 - 90) * (Math.PI / 180);
                            const r = 80 * scale;
                            return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                          })
                          .join(" ");
                        return (
                          <polygon
                            key={sIdx}
                            points={points}
                            fill="none"
                            stroke="#d8ddd8"
                            strokeWidth="1"
                            strokeDasharray={scale === 1.0 ? "none" : "2 2"}
                          />
                        );
                      })}

                      {[0, 1, 2, 3, 4, 5].map((i) => {
                        const angle = (i * 60 - 90) * (Math.PI / 180);
                        const x = 80 * Math.cos(angle);
                        const y = 80 * Math.sin(angle);
                        return (
                          <line
                            key={i}
                            x1="0"
                            y1="0"
                            x2={x}
                            y2={y}
                            stroke="#d8ddd8"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Polygon A (Brand Steel Blue) */}
                      {(() => {
                        const ptsA = radar
                          .map((dim, i) => {
                            const angle = (i * 60 - 90) * (Math.PI / 180);
                            const r = (dim.scoreA / 100) * 80;
                            return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                          })
                          .join(" ");
                        return (
                          <polygon
                            points={ptsA}
                            fill="#315C7C"
                            fillOpacity="0.25"
                            stroke="#315C7C"
                            strokeWidth="2"
                          />
                        );
                      })()}

                      {/* Polygon B (Teal / Emerald) */}
                      {(() => {
                        const ptsB = radar
                          .map((dim, i) => {
                            const angle = (i * 60 - 90) * (Math.PI / 180);
                            const r = (dim.scoreB / 100) * 80;
                            return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                          })
                          .join(" ");
                        return (
                          <polygon
                            points={ptsB}
                            fill="#0D9488"
                            fillOpacity="0.25"
                            stroke="#0D9488"
                            strokeWidth="2"
                          />
                        );
                      })()}

                      {radar.map((dim, i) => {
                        const angle = (i * 60 - 90) * (Math.PI / 180);
                        const x = 96 * Math.cos(angle);
                        const y = 96 * Math.sin(angle);
                        return (
                          <text
                            key={i}
                            x={x}
                            y={y}
                            fontSize="6.5"
                            fontWeight="bold"
                            fill="#27313c"
                            textAnchor={
                              x > 5 ? "start" : x < -5 ? "end" : "middle"
                            }
                            dominantBaseline="central"
                          >
                            {dim.dimension.split(" ")[0]}
                          </text>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-xs bg-[#315C7C]" />
                      <span className="font-bold text-ink-primary">
                        {pA?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-xs bg-[#0D9488]" />
                      <span className="font-bold text-ink-primary">
                        {pB?.name}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Radar Breakdown Bars */}
                <Card padding="md" className="lg:col-span-6">
                  <div className="border-b border-border-subtle pb-3">
                    <h3 className="text-sm font-black text-ink-primary">
                      Dimension Scores &amp; Disciplinary Divergence
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Relative percentile performance in each bibliometric
                      vector
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {radar.map((dim, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink-primary">
                            {dim.dimension}
                          </span>
                          <div className="tabular-metrics flex items-center gap-3 font-mono text-[11px]">
                            <span className="font-bold text-brand-600">
                              A: {dim.metricLabelA}
                            </span>
                            <span className="text-border-strong">|</span>
                            <span className="font-bold text-status-success-text">
                              B: {dim.metricLabelB}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full bg-[#315C7C] transition-all duration-500"
                              style={{ width: `${dim.scoreA}%` }}
                            />
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full bg-[#0D9488] transition-all duration-500"
                              style={{ width: `${dim.scoreB}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: Statistical Significance Suite */}
          {activeTab === "statistics" && stats && (
            <div className="space-y-6">
              {/* Statistical Suite Sub-Navigation & Quick Action Bar */}
              <Card
                padding="sm"
                className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatSubTab("matrix")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      statSubTab === "matrix"
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Hypothesis Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatSubTab("ecdf")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      statSubTab === "ecdf"
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    ECDF &amp; K-S Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatSubTab("quantiles")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      statSubTab === "quantiles"
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Boxplot &amp; Skewness
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatSubTab("contingency")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      statSubTab === "contingency"
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <PieChart className="h-3.5 w-3.5" />
                    2×2 Contingency Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatSubTab("guide")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      statSubTab === "guide"
                        ? "bg-brand-500 text-white shadow-xs"
                        : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Methodology &amp; LaTeX
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyLatex}
                    icon={
                      copiedLatex ? (
                        <Check className="h-3.5 w-3.5 text-status-success-text" />
                      ) : (
                        <FileCode className="h-3.5 w-3.5 text-ink-subtle" />
                      )
                    }
                    title="Copy LaTeX Table for Academic Paper Submission"
                  >
                    {copiedLatex ? "LaTeX Copied" : "Copy LaTeX"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyMarkdown}
                    icon={
                      copiedMarkdown ? (
                        <Check className="h-3.5 w-3.5 text-status-success-text" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-ink-subtle" />
                      )
                    }
                    title="Copy Markdown Table"
                  >
                    {copiedMarkdown ? "Markdown Copied" : "Copy MD"}
                  </Button>
                </div>
              </Card>

              {/* SUB-TAB 1: HYPOTHESIS TESTING MATRIX */}
              {statSubTab === "matrix" && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 shadow-card">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <Scale className="h-5 w-5 text-brand-500" />
                          <h3 className="text-sm font-black text-ink-primary">
                            Comparative Statistical Significance Matrix
                          </h3>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                          Hypothesis tests evaluating whether observed citation
                          and structural divergences between “{pA?.name}” and “
                          {pB?.name}” are statistically significant or
                          attributable to random sampling noise.
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-center shadow-card">
                          <div className="sciai-kicker text-[10px]!">
                            Tests Evaluated
                          </div>
                          <div className="tabular-metrics text-lg font-black text-ink-primary">
                            6 Tests
                          </div>
                        </div>
                        <div className="rounded-xl border border-status-success-border bg-surface-canvas px-3 py-2 text-center shadow-card">
                          <div className="sciai-kicker text-[10px]! text-status-success-text!">
                            Reject Null (H₀)
                          </div>
                          <div className="tabular-metrics text-lg font-black text-status-success-text">
                            {
                              [
                                stats.mannWhitneyU.significant,
                                stats.kolmogorovSmirnov.significant,
                                stats.welchTTest.significant,
                                stats.permutationTest.significant,
                                stats.chiSquareCollaboration.significant,
                                stats.chiSquareElitePapers.significant,
                              ].filter(Boolean).length
                            }{" "}
                            of 6
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6 Decision Cards Grid */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {/* 1. Mann-Whitney U */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-brand-600!">
                          Non-Parametric Rank Sum
                        </span>
                        {stats.mannWhitneyU.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            Fail to Reject H₀
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Mann-Whitney U Test
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Non-parametric Wilcoxon rank-sum test robust against
                        heavy positive skewness and extreme citation
                        blockbusters.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            U-Statistic
                          </div>
                          <div className="tabular-metrics text-sm font-black text-ink-primary">
                            {stats.mannWhitneyU.uStatistic}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            p-Value (Two-Sided)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.mannWhitneyU.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">Z-Score</div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.mannWhitneyU.zScore}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Cliff&apos;s Delta (δ)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-brand-600">
                            {stats.mannWhitneyU.cliffsDelta} (
                            {stats.mannWhitneyU.effectSize})
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.mannWhitneyU.interpretation}
                      </div>
                    </Card>

                    {/* 2. Kolmogorov-Smirnov */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-status-info-text!">
                          Continuous ECDF Distance
                        </span>
                        {stats.kolmogorovSmirnov.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            Equivalent Distribution
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Kolmogorov-Smirnov Two-Sample Test
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Quantifies supremum distance between empirical
                        cumulative distribution functions (ECDF) across both
                        corpora.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            D-Statistic (Dmax)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.kolmogorovSmirnov.dStatistic}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Critical D (α=0.05)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.kolmogorovSmirnov.criticalValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            p-Value (K-S)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.kolmogorovSmirnov.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Max Divergence At
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-status-info-text">
                            {stats.kolmogorovSmirnov.maxDLocation} citations
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-status-info-border bg-status-info-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.kolmogorovSmirnov.interpretation}
                      </div>
                    </Card>

                    {/* 3. Welch's t-Test */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-brand-700!">
                          Parametric (Unequal Variances)
                        </span>
                        {stats.welchTTest.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            No Mean Difference
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Welch&apos;s Two-Sample t-Test
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Difference of means test with Welch-Satterthwaite
                        adjusted degrees of freedom for heteroscedastic data.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            t-Stat (df={stats.welchTTest.degreesOfFreedom})
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.welchTTest.tStatistic}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            p-Value (Student t)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.welchTTest.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Cohen&apos;s d (Effect)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-brand-700">
                            {stats.welchTTest.cohensD} (
                            {stats.welchTTest.effectSize})
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            95% CI (Δ Means)
                          </div>
                          <div className="tabular-metrics font-mono text-xs font-bold text-ink-secondary">
                            [{stats.welchTTest.meanDiffCi95[0]},{" "}
                            {stats.welchTTest.meanDiffCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.welchTTest.interpretation}
                      </div>
                    </Card>

                    {/* 4. Monte Carlo Permutation */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-status-warning-text!">
                          Exact Resampling (1,000 Runs)
                        </span>
                        {stats.permutationTest.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            Random Chance Likely
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Monte Carlo Permutation Test
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Empirical 1,000-run permutation test without
                        distributional assumptions to validate citation mean
                        divergence.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Observed Diff (Δ)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.permutationTest.observedDiff}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Permutation p-Value
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.permutationTest.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Resamples
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-status-warning-text">
                            {stats.permutationTest.resamples} runs
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            95% Bootstrap CI
                          </div>
                          <div className="tabular-metrics font-mono text-xs font-bold text-ink-secondary">
                            [{stats.permutationTest.bootstrapCi95[0]},{" "}
                            {stats.permutationTest.bootstrapCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-status-warning-border bg-status-warning-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.permutationTest.interpretation}
                      </div>
                    </Card>

                    {/* 5. Chi-Square Collaboration */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-status-success-text!">
                          Categorical Association (MCP)
                        </span>
                        {stats.chiSquareCollaboration.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            Association
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            Independent (No Link)
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Chi-Square International Collaboration (χ²)
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Tests whether international collaboration rate (MCP vs
                        SCP) is independent of research domain.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Chi-Square (χ²)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.chiSquareCollaboration.chi2}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            p-Value (Chi-Square)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.chiSquareCollaboration.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Yates&apos; Continuity
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.chiSquareCollaboration.chi2Yates}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Odds Ratio (OR)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-status-success-text">
                            {stats.chiSquareCollaboration.oddsRatio}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-status-success-border bg-status-success-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.chiSquareCollaboration.interpretation}
                      </div>
                    </Card>

                    {/* 6. Chi-Square Elite Papers */}
                    <Card padding="md">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <span className="sciai-kicker text-[10px]! text-status-danger-text!">
                          Elite Top 10% Odds
                        </span>
                        {stats.chiSquareElitePapers.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text">
                            <CheckCircle2 className="h-3 w-3" /> Significant
                            Advantage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                            Balanced Proportion
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-black text-ink-primary">
                        Chi-Square Elite Papers (Top 10%)
                      </h4>
                      <p className="mt-1 text-xs text-ink-muted">
                        Compares likelihood of producing papers in the top 10%
                        citation decile of the joint corpus.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Chi-Square (χ²)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.chiSquareElitePapers.chi2}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            p-Value (Chi-Square)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-ink-primary">
                            {stats.chiSquareElitePapers.pValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            Odds Ratio (OR)
                          </div>
                          <div className="tabular-metrics font-mono text-sm font-black text-status-danger-text">
                            {stats.chiSquareElitePapers.oddsRatio}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
                          <div className="sciai-kicker text-[9px]!">
                            95% CI for OR
                          </div>
                          <div className="tabular-metrics font-mono text-xs font-bold text-ink-secondary">
                            [{stats.chiSquareElitePapers.oddsRatioCi95[0]},{" "}
                            {stats.chiSquareElitePapers.oddsRatioCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-status-danger-border bg-status-danger-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                        {stats.chiSquareElitePapers.interpretation}
                      </div>
                    </Card>
                  </div>

                  {/* Comparative Matrix Table */}
                  <Card padding="md">
                    <div className="border-b border-border-subtle pb-3">
                      <h3 className="text-sm font-black text-ink-primary">
                        Comprehensive Hypothesis Testing Table
                      </h3>
                      <p className="text-xs text-ink-muted">
                        Consolidated summary of parametric and non-parametric
                        statistical hypothesis tests at significance level α =
                        0.05
                      </p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs text-ink-secondary">
                        <thead className="border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          <tr>
                            <th className="px-4 py-2.5">Statistical Test</th>
                            <th className="px-4 py-2.5">Methodology</th>
                            <th className="px-4 py-2.5">Test Statistic</th>
                            <th className="px-4 py-2.5">p-Value</th>
                            <th className="px-4 py-2.5">Effect Size</th>
                            <th className="px-4 py-2.5">
                              95% CI / Diagnostic
                            </th>
                            <th className="px-4 py-2.5 text-center">
                              Decision (α=0.05)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle font-sans">
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Mann-Whitney U Test
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                                Non-Parametric
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              U = {stats.mannWhitneyU.uStatistic}, Z ={" "}
                              {stats.mannWhitneyU.zScore}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.mannWhitneyU.pValue}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-brand-600">
                              δ = {stats.mannWhitneyU.cliffsDelta} (
                              {stats.mannWhitneyU.effectSize})
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-muted">
                              Rank-Biserial: {stats.mannWhitneyU.rankBiserial}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.mannWhitneyU.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.mannWhitneyU.significant
                                  ? "Reject H₀"
                                  : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Kolmogorov-Smirnov (K-S)
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-status-info-border bg-status-info-bg px-1.5 py-0.5 text-[10px] font-bold text-status-info-text">
                                ECDF Distance
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              D = {stats.kolmogorovSmirnov.dStatistic} (Dcrit ={" "}
                              {stats.kolmogorovSmirnov.criticalValue})
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.kolmogorovSmirnov.pValue}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-status-info-text">
                              Dmax @ {stats.kolmogorovSmirnov.maxDLocation}{" "}
                              cites
                            </td>
                            <td className="px-4 py-2.5 font-mono text-ink-subtle">
                              -
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.kolmogorovSmirnov.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.kolmogorovSmirnov.significant
                                  ? "Distinct Distributions"
                                  : "Equivalent Shapes"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Welch&apos;s t-Test
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                                Parametric
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              t({stats.welchTTest.degreesOfFreedom}) ={" "}
                              {stats.welchTTest.tStatistic}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.welchTTest.pValue}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-brand-700">
                              d = {stats.welchTTest.cohensD} (
                              {stats.welchTTest.effectSize})
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              [{stats.welchTTest.meanDiffCi95[0]},{" "}
                              {stats.welchTTest.meanDiffCi95[1]}]
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.welchTTest.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.welchTTest.significant
                                  ? "Reject H₀"
                                  : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Monte Carlo Permutation
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[10px] font-bold text-status-warning-text">
                                Exact Resampling
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              Δ = {stats.permutationTest.observedDiff} (
                              {stats.permutationTest.resamples} runs)
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.permutationTest.pValue}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-status-warning-text">
                              Observed Mean Diff
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              [{stats.permutationTest.bootstrapCi95[0]},{" "}
                              {stats.permutationTest.bootstrapCi95[1]}]
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.permutationTest.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.permutationTest.significant
                                  ? "Reject H₀"
                                  : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Chi-Square Collaboration (MCP)
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[10px] font-bold text-status-success-text">
                                Categorical 2×2
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              χ² = {stats.chiSquareCollaboration.chi2} (Yates:{" "}
                              {stats.chiSquareCollaboration.chi2Yates})
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.chiSquareCollaboration.pValue}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-status-success-text">
                              OR = {stats.chiSquareCollaboration.oddsRatio}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              [{stats.chiSquareCollaboration.oddsRatioCi95[0]},{" "}
                              {stats.chiSquareCollaboration.oddsRatioCi95[1]}]
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.chiSquareCollaboration.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.chiSquareCollaboration.significant
                                  ? "Significant Link"
                                  : "Independent"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Chi-Square Elite Papers (Top 10%)
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-sm border border-status-danger-border bg-status-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-status-danger-text">
                                Decile Distribution
                              </span>
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono">
                              χ² = {stats.chiSquareElitePapers.chi2}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.chiSquareElitePapers.pValue}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-status-danger-text">
                              OR = {stats.chiSquareElitePapers.oddsRatio}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              [{stats.chiSquareElitePapers.oddsRatioCi95[0]},{" "}
                              {stats.chiSquareElitePapers.oddsRatioCi95[1]}]
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  stats.chiSquareElitePapers.significant
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-border-default bg-surface-subtle text-ink-muted"
                                }`}
                              >
                                {stats.chiSquareElitePapers.significant
                                  ? "Significant Link"
                                  : "Balanced Share"}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {/* SUB-TAB 2: ECDF & K-S DISTANCE */}
              {statSubTab === "ecdf" && (
                <div className="space-y-6">
                  <Card padding="md">
                    <div className="flex flex-col justify-between gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="text-sm font-black text-ink-primary">
                          Empirical Cumulative Distribution Functions (ECDF)
                        </h3>
                        <p className="text-xs text-ink-muted">
                          Cumulative citation probability step curves and
                          Kolmogorov-Smirnov supremum divergence marker (Dmax)
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#315C7C]" />
                          <span className="font-bold text-ink-primary">
                            {pA?.name} (FA)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488]" />
                          <span className="font-bold text-ink-primary">
                            {pB?.name} (FB)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-1 border-r-2 border-dashed border-[#E11D48]" />
                          <span className="tabular-metrics font-bold text-status-danger-text">
                            Dmax = {stats.kolmogorovSmirnov.dStatistic}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-5 h-80 w-full overflow-hidden">
                      {(() => {
                        const pts = stats.ecdfPoints || [];
                        if (pts.length < 2)
                          return (
                            <div className="p-4 text-xs text-ink-subtle">
                              Insufficient data points to render ECDF.
                            </div>
                          );

                        const maxVal = Math.max(
                          ...pts.map((p) => p.value),
                          10
                        );
                        const minVal = 0;
                        const w = 700;
                        const h = 260;
                        const padX = 50;
                        const padY = 30;

                        const scaleX = (v: number) =>
                          padX +
                          ((v - minVal) / (maxVal - minVal || 1)) *
                            (w - padX * 2);
                        const scaleY = (cdf: number) =>
                          h - padY - cdf * (h - padY * 2);

                        let pathA = `M ${scaleX(0)} ${scaleY(0)}`;
                        pts.forEach((pt) => {
                          pathA += ` H ${scaleX(pt.value)} V ${scaleY(pt.cdfA)}`;
                        });

                        let pathB = `M ${scaleX(0)} ${scaleY(0)}`;
                        pts.forEach((pt) => {
                          pathB += ` H ${scaleX(pt.value)} V ${scaleY(pt.cdfB)}`;
                        });

                        const maxDPt =
                          pts.find((p) => p.isMaxD) ||
                          pts[Math.floor(pts.length / 2)];
                        const maxDX = scaleX(maxDPt.value);
                        const maxDYA = scaleY(maxDPt.cdfA);
                        const maxDYB = scaleY(maxDPt.cdfB);

                        return (
                          <svg
                            viewBox={`0 0 ${w} ${h}`}
                            className="h-full w-full"
                          >
                            {[0, 0.25, 0.5, 0.75, 1.0].map((gridP) => (
                              <g key={gridP}>
                                <line
                                  x1={padX}
                                  y1={scaleY(gridP)}
                                  x2={w - padX}
                                  y2={scaleY(gridP)}
                                  stroke="#e5e8e4"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padX - 8}
                                  y={scaleY(gridP) + 3}
                                  fontSize="9"
                                  fill="#828d98"
                                  textAnchor="end"
                                  fontFamily="monospace"
                                >
                                  {gridP.toFixed(2)}
                                </text>
                              </g>
                            ))}

                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((frac) => {
                              const tickVal = Math.round(
                                minVal + frac * (maxVal - minVal)
                              );
                              return (
                                <g key={frac}>
                                  <line
                                    x1={scaleX(tickVal)}
                                    y1={h - padY}
                                    x2={scaleX(tickVal)}
                                    y2={h - padY + 4}
                                    stroke="#bcc4bc"
                                  />
                                  <text
                                    x={scaleX(tickVal)}
                                    y={h - padY + 16}
                                    fontSize="9"
                                    fill="#828d98"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {tickVal}
                                  </text>
                                </g>
                              );
                            })}

                            <line
                              x1={maxDX}
                              y1={maxDYA}
                              x2={maxDX}
                              y2={maxDYB}
                              stroke="#E11D48"
                              strokeWidth="3"
                              strokeDasharray="3 3"
                            />
                            <circle
                              cx={maxDX}
                              cy={maxDYA}
                              r="4"
                              fill="#315C7C"
                            />
                            <circle
                              cx={maxDX}
                              cy={maxDYB}
                              r="4"
                              fill="#0D9488"
                            />

                            <rect
                              x={maxDX + 8}
                              y={Math.min(maxDYA, maxDYB) + 10}
                              width="125"
                              height="34"
                              rx="4"
                              fill="#101820"
                              opacity="0.92"
                            />
                            <text
                              x={maxDX + 14}
                              y={Math.min(maxDYA, maxDYB) + 24}
                              fontSize="9"
                              fontWeight="bold"
                              fill="#ffffff"
                            >
                              Dmax = {stats.kolmogorovSmirnov.dStatistic}
                            </text>
                            <text
                              x={maxDX + 14}
                              y={Math.min(maxDYA, maxDYB) + 36}
                              fontSize="8"
                              fill="#d9e7f1"
                            >
                              at {maxDPt.value} citations
                            </text>

                            <path
                              d={pathA}
                              fill="none"
                              stroke="#315C7C"
                              strokeWidth="2.5"
                            />
                            <path
                              d={pathB}
                              fill="none"
                              stroke="#0D9488"
                              strokeWidth="2.5"
                            />

                            {pts.map((pt, pIdx) => {
                              const xPos = scaleX(pt.value);
                              return (
                                <g
                                  key={pIdx}
                                  className="group cursor-pointer"
                                  onMouseEnter={() => setHoveredEcdf(pt)}
                                  onMouseLeave={() => setHoveredEcdf(null)}
                                >
                                  <circle
                                    cx={xPos}
                                    cy={scaleY(pt.cdfA)}
                                    r={pt.isMaxD ? "4.5" : "2.5"}
                                    fill="#315C7C"
                                    className="transition-all"
                                  />
                                  <circle
                                    cx={xPos}
                                    cy={scaleY(pt.cdfB)}
                                    r={pt.isMaxD ? "4.5" : "2.5"}
                                    fill="#0D9488"
                                    className="transition-all"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>

                    {hoveredEcdf ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-primary px-4 py-2 text-xs text-white">
                        <div>
                          <span className="text-brand-200">
                            Citation Threshold:
                          </span>{" "}
                          <span className="tabular-metrics font-mono font-bold text-amber-300">
                            {hoveredEcdf.value} citations
                          </span>
                        </div>
                        <div className="tabular-metrics flex items-center gap-6 font-mono">
                          <span className="font-bold text-brand-200">
                            FA(x) = {hoveredEcdf.cdfA}
                          </span>
                          <span className="font-bold text-emerald-300">
                            FB(x) = {hoveredEcdf.cdfB}
                          </span>
                          <span className="font-bold text-rose-300">
                            Δ = {hoveredEcdf.difference}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-center text-xs text-ink-subtle">
                        Hover over curve data points to inspect cumulative
                        probabilities and point-by-point divergence.
                      </div>
                    )}
                  </Card>

                  <div className="rounded-2xl border border-status-info-border bg-status-info-bg/60 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info-text" />
                      <div className="space-y-1.5 text-xs leading-relaxed text-ink-secondary">
                        <div className="font-bold text-ink-primary">
                          Interpreting the Kolmogorov-Smirnov Test in
                          Scientometrics:
                        </div>
                        <p>
                          The two-sample Kolmogorov-Smirnov test tests whether
                          two samples are drawn from the same continuous
                          distribution without normality constraints. The test
                          statistic D = {stats.kolmogorovSmirnov.dStatistic}{" "}
                          identifies the maximal vertical distance between both
                          ECDFs. Because this value is{" "}
                          {stats.kolmogorovSmirnov.significant
                            ? `greater than critical D (${stats.kolmogorovSmirnov.criticalValue}), the null hypothesis of distributional equivalence is rejected (p = ${stats.kolmogorovSmirnov.pValue}), confirming distinct citation accumulation trajectories.`
                            : `less than critical D (${stats.kolmogorovSmirnov.criticalValue}), the empirical distribution shapes are statistically equivalent.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: FIVE-NUMBER SUMMARY, SKEWNESS & BOXPLOT */}
              {statSubTab === "quantiles" && (
                <div className="space-y-6">
                  <Card padding="md">
                    <div className="border-b border-border-subtle pb-3">
                      <h3 className="text-sm font-black text-ink-primary">
                        Comparative Citation Box-and-Whisker Plot
                      </h3>
                      <p className="text-xs text-ink-muted">
                        Visual depiction of 25th percentile (Q1), median (Q2),
                        75th percentile (Q3), interquartile range (IQR), and
                        extrema
                      </p>
                    </div>

                    <div className="relative mt-6 h-48 w-full">
                      {(() => {
                        const dA = stats.distributionA;
                        const dB = stats.distributionB;
                        if (!dA || !dB) return null;

                        const globalMax = Math.max(dA.max, dB.max, 100);
                        const w = 600;
                        const h = 180;
                        const padX = 80;

                        const scaleX = (val: number) =>
                          padX + (val / globalMax) * (w - padX - 30);

                        return (
                          <svg
                            viewBox={`0 0 ${w} ${h}`}
                            className="h-full w-full"
                          >
                            <line
                              x1={padX}
                              y1={h - 25}
                              x2={w - 30}
                              y2={h - 25}
                              stroke="#bcc4bc"
                              strokeWidth="1"
                            />
                            {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                              const tickVal = Math.round(frac * globalMax);
                              return (
                                <g key={frac}>
                                  <line
                                    x1={scaleX(tickVal)}
                                    y1={h - 25}
                                    x2={scaleX(tickVal)}
                                    y2={h - 20}
                                    stroke="#828d98"
                                  />
                                  <text
                                    x={scaleX(tickVal)}
                                    y={h - 8}
                                    fontSize="9"
                                    fill="#5a6570"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {tickVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Boxplot A */}
                            <g>
                              <text
                                x="10"
                                y="55"
                                fontSize="10"
                                fontWeight="bold"
                                fill="#315C7C"
                              >
                                {pA?.name.slice(0, 10)}..
                              </text>
                              <line
                                x1={scaleX(dA.min)}
                                y1="50"
                                x2={scaleX(dA.max)}
                                y2="50"
                                stroke="#315C7C"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={scaleX(dA.min)}
                                y1="42"
                                x2={scaleX(dA.min)}
                                y2="58"
                                stroke="#315C7C"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={scaleX(dA.max)}
                                y1="42"
                                x2={scaleX(dA.max)}
                                y2="58"
                                stroke="#315C7C"
                                strokeWidth="1.5"
                              />
                              <rect
                                x={scaleX(dA.q25)}
                                y="35"
                                width={Math.max(
                                  2,
                                  scaleX(dA.q75) - scaleX(dA.q25)
                                )}
                                height="30"
                                fill="#548CB8"
                                fillOpacity="0.3"
                                stroke="#315C7C"
                                strokeWidth="2"
                                rx="2"
                              />
                              <line
                                x1={scaleX(dA.median)}
                                y1="35"
                                x2={scaleX(dA.median)}
                                y2="65"
                                stroke="#182B3B"
                                strokeWidth="2.5"
                              />
                              <polygon
                                points={`${scaleX(dA.mean)},45 ${scaleX(dA.mean) + 4},50 ${scaleX(dA.mean)},55 ${scaleX(dA.mean) - 4},50`}
                                fill="#D97706"
                              />
                            </g>

                            {/* Boxplot B */}
                            <g>
                              <text
                                x="10"
                                y="115"
                                fontSize="10"
                                fontWeight="bold"
                                fill="#0D9488"
                              >
                                {pB?.name.slice(0, 10)}..
                              </text>
                              <line
                                x1={scaleX(dB.min)}
                                y1="110"
                                x2={scaleX(dB.max)}
                                y2="110"
                                stroke="#0D9488"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={scaleX(dB.min)}
                                y1="102"
                                x2={scaleX(dB.min)}
                                y2="118"
                                stroke="#0D9488"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={scaleX(dB.max)}
                                y1="102"
                                x2={scaleX(dB.max)}
                                y2="118"
                                stroke="#0D9488"
                                strokeWidth="1.5"
                              />
                              <rect
                                x={scaleX(dB.q25)}
                                y="95"
                                width={Math.max(
                                  2,
                                  scaleX(dB.q75) - scaleX(dB.q25)
                                )}
                                height="30"
                                fill="#14B8A6"
                                fillOpacity="0.3"
                                stroke="#0D9488"
                                strokeWidth="2"
                                rx="2"
                              />
                              <line
                                x1={scaleX(dB.median)}
                                y1="95"
                                x2={scaleX(dB.median)}
                                y2="125"
                                stroke="#047857"
                                strokeWidth="2.5"
                              />
                              <polygon
                                points={`${scaleX(dB.mean)},105 ${scaleX(dB.mean) + 4},110 ${scaleX(dB.mean)},115 ${scaleX(dB.mean) - 4},110`}
                                fill="#D97706"
                              />
                            </g>
                          </svg>
                        );
                      })()}
                    </div>
                  </Card>

                  {/* Complete 11-Parameter Distribution Metrics Table */}
                  <Card padding="md">
                    <div className="border-b border-border-subtle pb-3">
                      <h3 className="text-sm font-black text-ink-primary">
                        Five-Number Summary &amp; Distribution Moments
                      </h3>
                      <p className="text-xs text-ink-muted">
                        Location, dispersion, interquartile range (IQR), and
                        Fisher-Pearson coefficient of skewness
                      </p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs text-ink-secondary">
                        <thead className="border-b border-border-default bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          <tr>
                            <th className="px-4 py-2.5">Metric</th>
                            <th className="px-4 py-2.5">
                              Mathematical Notation
                            </th>
                            <th className="px-4 py-2.5 font-mono text-brand-700">
                              Corpus A ({pA?.name})
                            </th>
                            <th className="px-4 py-2.5 font-mono text-status-success-text">
                              Corpus B ({pB?.name})
                            </th>
                            <th className="px-4 py-2.5 text-right">
                              Difference (Δ = A - B)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle font-sans">
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Minimum
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              Min(C)
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.min}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.min}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.min -
                                stats.distributionB.min
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              First Quartile (Q1 / P25)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              P25
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.q25}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.q25}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.q25 -
                                stats.distributionB.q25
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr className="bg-status-warning-bg/30">
                            <td className="px-4 py-2.5 font-black text-ink-primary">
                              Median (Q2 / P50)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              Q2 / P50
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-brand-700">
                              {stats.distributionA.median}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-status-success-text">
                              {stats.distributionB.median}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono font-bold text-ink-primary">
                              {(
                                stats.distributionA.median -
                                stats.distributionB.median
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Third Quartile (Q3 / P75)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              P75
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.q75}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.q75}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.q75 -
                                stats.distributionB.q75
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Interquartile Range (IQR)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              Q3 - Q1
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.iqr}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.iqr}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.iqr -
                                stats.distributionB.iqr
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Maximum
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              Max(C)
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.max}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.max}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.max -
                                stats.distributionB.max
                              ).toFixed(1)}
                            </td>
                          </tr>
                          <tr className="bg-surface-subtle/60">
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Arithmetic Mean
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              μ = Σx / n
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionA.mean}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-bold text-ink-primary">
                              {stats.distributionB.mean}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.mean -
                                stats.distributionB.mean
                              ).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Standard Deviation
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              σ = √Var
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              {stats.distributionA.stdDev}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              {stats.distributionB.stdDev}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.stdDev -
                                stats.distributionB.stdDev
                              ).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-ink-primary">
                              Standard Error (SE)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              SE = σ / √n
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              {stats.distributionA.standardError}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono text-ink-secondary">
                              {stats.distributionB.standardError}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 text-right font-mono text-ink-muted">
                              {(
                                stats.distributionA.standardError -
                                stats.distributionB.standardError
                              ).toFixed(2)}
                            </td>
                          </tr>
                          <tr className="bg-status-danger-bg/40">
                            <td className="px-4 py-2.5 font-black text-status-danger-text">
                              Skewness Coefficient (g₁)
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
                              m3 / s³
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-status-danger-text">
                              {stats.distributionA.skewness}
                            </td>
                            <td className="tabular-metrics px-4 py-2.5 font-mono font-black text-status-danger-text">
                              {stats.distributionB.skewness}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-status-danger-text">
                              {Math.abs(stats.distributionA.skewness) > 1 ||
                              Math.abs(stats.distributionB.skewness) > 1
                                ? "Heavy Skewness"
                                : "Nearly Symmetric"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg/60 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-danger-text" />
                      <div className="space-y-1 text-xs leading-relaxed text-ink-secondary">
                        <div className="font-bold text-status-danger-text">
                          Why High Positive Skewness Matters in Scientometrics:
                        </div>
                        <p>
                          In accordance with Lotka&apos;s and Bradford&apos;s
                          laws as well as Pareto power-law dynamics, the vast
                          majority of scientific papers receive modest citations
                          while a select few gather hundreds or thousands. This
                          makes citation distributions strongly right-skewed
                          (g₁ &gt; 1). Consequently, relying solely on
                          parametric Student t-tests and arithmetic means can be
                          biased. Methodological guidelines recommend
                          prioritizing the non-parametric Mann-Whitney U test,
                          medians, and ECDF distance metrics.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: 2x2 CONTINGENCY TABLES */}
              {statSubTab === "contingency" && (
                <div className="space-y-6">
                  {/* Table 1 */}
                  <Card padding="md">
                    <div className="border-b border-border-subtle pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-ink-primary">
                          Contingency Table 1: International Researcher
                          Collaboration (MCP vs. SCP)
                        </h3>
                        {stats.chiSquareCollaboration.significant ? (
                          <span className="rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-[10px] font-bold text-status-success-text">
                            Statistically Significant (p &lt; 0.05)
                          </span>
                        ) : (
                          <span className="rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-[10px] font-bold text-ink-muted">
                            Independent (No Association)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        Pearson&apos;s Chi-Square Test of Independence (χ²) with
                        Yates&apos; continuity correction
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
                      <div className="lg:col-span-7">
                        <div className="overflow-x-auto rounded-xl border border-border-default">
                          <table className="w-full text-center text-xs">
                            <thead className="bg-surface-subtle font-bold text-ink-secondary">
                              <tr>
                                <th className="border-b border-r border-border-default px-3 py-2.5">
                                  Corpus
                                </th>
                                <th className="border-b border-r border-border-default px-3 py-2.5 font-black text-brand-700">
                                  Multi-Country (MCP)
                                </th>
                                <th className="border-b border-r border-border-default px-3 py-2.5 font-black text-ink-primary">
                                  Single-Country (SCP)
                                </th>
                                <th className="border-b border-border-default bg-surface-muted px-3 py-2.5 font-black">
                                  Row Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="tabular-metrics divide-y divide-border-subtle font-mono">
                              <tr>
                                <td className="border-r border-border-default px-3 py-3 text-left font-sans font-bold text-ink-primary">
                                  Corpus A ({pA?.name.slice(0, 15)}..)
                                </td>
                                <td className="border-r border-border-default bg-brand-50/50 px-3 py-3 font-bold text-brand-800">
                                  {stats.chiSquareCollaboration.table.a11}
                                </td>
                                <td className="border-r border-border-default px-3 py-3">
                                  {stats.chiSquareCollaboration.table.a12}
                                </td>
                                <td className="bg-surface-subtle px-3 py-3 font-bold text-ink-primary">
                                  {stats.chiSquareCollaboration.table.a11 +
                                    stats.chiSquareCollaboration.table.a12}
                                </td>
                              </tr>
                              <tr>
                                <td className="border-r border-border-default px-3 py-3 text-left font-sans font-bold text-ink-primary">
                                  Corpus B ({pB?.name.slice(0, 15)}..)
                                </td>
                                <td className="border-r border-border-default bg-status-success-bg/50 px-3 py-3 font-bold text-status-success-text">
                                  {stats.chiSquareCollaboration.table.a21}
                                </td>
                                <td className="border-r border-border-default px-3 py-3">
                                  {stats.chiSquareCollaboration.table.a22}
                                </td>
                                <td className="bg-surface-subtle px-3 py-3 font-bold text-ink-primary">
                                  {stats.chiSquareCollaboration.table.a21 +
                                    stats.chiSquareCollaboration.table.a22}
                                </td>
                              </tr>
                              <tr className="bg-surface-muted font-bold text-ink-primary">
                                <td className="border-r border-border-default px-3 py-2.5 text-left font-sans">
                                  Column Total
                                </td>
                                <td className="border-r border-border-default px-3 py-2.5">
                                  {stats.chiSquareCollaboration.table.a11 +
                                    stats.chiSquareCollaboration.table.a21}
                                </td>
                                <td className="border-r border-border-default px-3 py-2.5">
                                  {stats.chiSquareCollaboration.table.a12 +
                                    stats.chiSquareCollaboration.table.a22}
                                </td>
                                <td className="px-3 py-2.5">
                                  {stats.chiSquareCollaboration.table.a11 +
                                    stats.chiSquareCollaboration.table.a12 +
                                    stats.chiSquareCollaboration.table.a21 +
                                    stats.chiSquareCollaboration.table.a22}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-3 lg:col-span-5">
                        <div className="tabular-metrics space-y-2 rounded-xl border border-border-default bg-surface-subtle p-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-secondary">
                              Pearson Chi-Square (χ²):
                            </span>
                            <span className="font-mono font-black text-ink-primary">
                              {stats.chiSquareCollaboration.chi2}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-secondary">
                              χ² with Yates&apos; Correction:
                            </span>
                            <span className="font-mono font-black text-ink-primary">
                              {stats.chiSquareCollaboration.chi2Yates}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-secondary">
                              Significance Level (p-Value):
                            </span>
                            <span className="font-mono font-black text-ink-primary">
                              {stats.chiSquareCollaboration.pValue}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-border-default pt-1 text-xs">
                            <span className="font-bold text-brand-700">
                              Odds Ratio (OR):
                            </span>
                            <span className="font-mono text-sm font-black text-brand-700">
                              {stats.chiSquareCollaboration.oddsRatio}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-muted">
                              95% Confidence Interval for OR:
                            </span>
                            <span className="font-mono font-bold text-ink-secondary">
                              [{stats.chiSquareCollaboration.oddsRatioCi95[0]},{" "}
                              {stats.chiSquareCollaboration.oddsRatioCi95[1]}]
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-status-success-border bg-status-success-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                          {stats.chiSquareCollaboration.interpretation}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Table 2 */}
                  <Card padding="md">
                    <div className="border-b border-border-subtle pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-ink-primary">
                          Contingency Table 2: Elite Citation Blockbusters (Top
                          10% Papers)
                        </h3>
                        {stats.chiSquareElitePapers.significant ? (
                          <span className="rounded-full border border-status-danger-border bg-status-danger-bg px-2.5 py-0.5 text-[10px] font-bold text-status-danger-text">
                            Significant Odds Advantage for Elite Papers
                          </span>
                        ) : (
                          <span className="rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-[10px] font-bold text-ink-muted">
                            Balanced Representation of Elite Papers
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        Odds comparison of producing top-decile cited
                        publications across the pooled dataset
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
                      <div className="lg:col-span-7">
                        <div className="overflow-x-auto rounded-xl border border-border-default">
                          <table className="w-full text-center text-xs">
                            <thead className="bg-surface-subtle font-bold text-ink-secondary">
                              <tr>
                                <th className="border-b border-r border-border-default px-3 py-2.5">
                                  Corpus
                                </th>
                                <th className="border-b border-r border-border-default px-3 py-2.5 font-black text-status-danger-text">
                                  Elite Papers (Top 10%)
                                </th>
                                <th className="border-b border-r border-border-default px-3 py-2.5 font-black text-ink-primary">
                                  Standard Papers
                                </th>
                                <th className="border-b border-border-default bg-surface-muted px-3 py-2.5 font-black">
                                  Row Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="tabular-metrics divide-y divide-border-subtle font-mono">
                              <tr>
                                <td className="border-r border-border-default px-3 py-3 text-left font-sans font-bold text-ink-primary">
                                  Corpus A ({pA?.name.slice(0, 15)}..)
                                </td>
                                <td className="border-r border-border-default bg-status-danger-bg/50 px-3 py-3 font-bold text-status-danger-text">
                                  {stats.chiSquareElitePapers.table.a11}
                                </td>
                                <td className="border-r border-border-default px-3 py-3">
                                  {stats.chiSquareElitePapers.table.a12}
                                </td>
                                <td className="bg-surface-subtle px-3 py-3 font-bold text-ink-primary">
                                  {stats.chiSquareElitePapers.table.a11 +
                                    stats.chiSquareElitePapers.table.a12}
                                </td>
                              </tr>
                              <tr>
                                <td className="border-r border-border-default px-3 py-3 text-left font-sans font-bold text-ink-primary">
                                  Corpus B ({pB?.name.slice(0, 15)}..)
                                </td>
                                <td className="border-r border-border-default bg-status-warning-bg/50 px-3 py-3 font-bold text-status-warning-text">
                                  {stats.chiSquareElitePapers.table.a21}
                                </td>
                                <td className="border-r border-border-default px-3 py-3">
                                  {stats.chiSquareElitePapers.table.a22}
                                </td>
                                <td className="bg-surface-subtle px-3 py-3 font-bold text-ink-primary">
                                  {stats.chiSquareElitePapers.table.a21 +
                                    stats.chiSquareElitePapers.table.a22}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-3 lg:col-span-5">
                        <div className="tabular-metrics space-y-2 rounded-xl border border-border-default bg-surface-subtle p-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-secondary">
                              Pearson Chi-Square (χ²):
                            </span>
                            <span className="font-mono font-black text-ink-primary">
                              {stats.chiSquareElitePapers.chi2}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-secondary">
                              Significance Level (p-Value):
                            </span>
                            <span className="font-mono font-black text-ink-primary">
                              {stats.chiSquareElitePapers.pValue}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-border-default pt-1 text-xs">
                            <span className="font-bold text-status-danger-text">
                              Elite Paper Odds Ratio (OR):
                            </span>
                            <span className="font-mono text-sm font-black text-status-danger-text">
                              {stats.chiSquareElitePapers.oddsRatio}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink-muted">
                              95% Confidence Interval:
                            </span>
                            <span className="font-mono font-bold text-ink-secondary">
                              [{stats.chiSquareElitePapers.oddsRatioCi95[0]},{" "}
                              {stats.chiSquareElitePapers.oddsRatioCi95[1]}]
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-status-danger-border bg-status-danger-bg/70 p-3 text-xs font-medium leading-relaxed text-ink-primary">
                          {stats.chiSquareElitePapers.interpretation}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* SUB-TAB 5: METHODOLOGY & LATEX */}
              {statSubTab === "guide" && (
                <div className="space-y-6">
                  <Card padding="lg" className="space-y-5">
                    <div className="border-b border-border-subtle pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-brand-500" />
                        <h3 className="text-sm font-black text-ink-primary">
                          Scientometric Comparative Methodology Guide
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        Statistical reporting and methodological guidelines for
                        Scientometrics, JASIST, and Journal of Informetrics
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 text-xs leading-relaxed text-ink-secondary md:grid-cols-2">
                      <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
                        <h4 className="flex items-center gap-1.5 font-black text-ink-primary">
                          <span className="h-2 w-2 rounded-full bg-brand-500" />
                          1. Why Mann-Whitney U is preferred over Student&apos;s
                          t-test
                        </h4>
                        <p>
                          Scientific citations intrinsically follow power-law
                          (Pareto) and over-dispersed Poisson distributions. The
                          presence of hyper-cited blockbuster papers produces
                          heavy right skewness. The Mann-Whitney U test
                          evaluates rank sums rather than raw citation means,
                          testing stochastic dominance without imposing false
                          normality assumptions.
                        </p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
                        <h4 className="flex items-center gap-1.5 font-black text-ink-primary">
                          <span className="h-2 w-2 rounded-full bg-status-info-text" />
                          2. Mann-Whitney U vs. Kolmogorov-Smirnov
                        </h4>
                        <p>
                          While Mann-Whitney tests location shift (median
                          dominance), the two-sample Kolmogorov-Smirnov test
                          simultaneously assesses the entire geometric CDF
                          shape—including variance, skewness, and extreme tails.
                          If U is significant but K-S is not, location differs
                          while distribution shape remains similar.
                        </p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
                        <h4 className="flex items-center gap-1.5 font-black text-ink-primary">
                          <span className="h-2 w-2 rounded-full bg-status-warning-text" />
                          3. Effect Size: Cliff&apos;s δ and Cohen&apos;s d
                        </h4>
                        <p>
                          In large bibliometric corpora (n &gt; 1,000), even
                          minuscule differences yield tiny p-values. Reporting
                          standardized effect sizes is mandatory: Cliff&apos;s
                          delta provides a non-parametric metric (|δ| &lt; 0.147
                          negligible, &lt; 0.33 small, &lt; 0.474 medium, ≥
                          0.474 large) that is independent of sample size.
                        </p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4">
                        <h4 className="flex items-center gap-1.5 font-black text-ink-primary">
                          <span className="h-2 w-2 rounded-full bg-status-success-text" />
                          4. Odds Ratios (OR) in Collaboration &amp; Elite Papers
                        </h4>
                        <p>
                          Odds ratios in 2x2 contingency tables quantify how
                          much higher the odds of international collaboration or
                          producing top-decile cited papers are in one corpus
                          versus another, paired with 95% confidence intervals.
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Ready-to-Paste LaTeX Code Block */}
                  <div className="rounded-2xl border border-border-default bg-surface-dark p-5 text-white shadow-elevated">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-brand-300" />
                        <span className="text-xs font-bold text-white">
                          Publication-Ready LaTeX Code
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleCopyLatex}
                        icon={
                          copiedLatex ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {copiedLatex ? "Copied" : "Copy LaTeX Code"}
                      </Button>
                    </div>

                    <pre className="mt-4 max-h-64 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                      {`% Comparative Bibliometric Hypothesis Testing Matrix (Biblium)
\\begin{table}[htbp]
\\centering
\\caption{Comparative Statistical Significance Suite: ${pA?.name} vs. ${pB?.name}}
\\label{tab:bibliometric_significance}
\\begin{tabular}{lccccc}
\\hline
\\textbf{Statistical Hypothesis Test} & \\textbf{Test Statistic} & \\textbf{p-Value} & \\textbf{Effect Size} & \\textbf{Decision ($\\alpha=0.05$)} \\\\
\\hline
Mann-Whitney $U$ (Wilcoxon Rank-Sum) & $U=${stats.mannWhitneyU.uStatistic},\\, Z=${stats.mannWhitneyU.zScore}$ & $p=${stats.mannWhitneyU.pValue}$ & Cliff's $\\delta=${stats.mannWhitneyU.cliffsDelta}$ (${stats.mannWhitneyU.effectSize}) & ${stats.mannWhitneyU.significant ? "Reject $H_0$" : "Fail to Reject $H_0$"} \\\\
Two-Sample Kolmogorov-Smirnov & $D=${stats.kolmogorovSmirnov.dStatistic},\\, D_{\\text{crit}}=${stats.kolmogorovSmirnov.criticalValue}$ & $p=${stats.kolmogorovSmirnov.pValue}$ & $D_{\\max}$ at ${stats.kolmogorovSmirnov.maxDLocation} cites & ${stats.kolmogorovSmirnov.significant ? "Distinct ECDF Curves" : "Equivalent Shapes"} \\\\
Welch's $t$-test (Unequal Var) & $t(${stats.welchTTest.degreesOfFreedom})=${stats.welchTTest.tStatistic}$ & $p=${stats.welchTTest.pValue}$ & Cohen's $d=${stats.welchTTest.cohensD}$ (${stats.welchTTest.effectSize}) & ${stats.welchTTest.significant ? "Reject $H_0$" : "Fail to Reject $H_0$"} \\\\
Monte Carlo Permutation (1,000 runs) & $\\Delta=${stats.permutationTest.observedDiff}$ & $p=${stats.permutationTest.pValue}$ & 95\\% CI: $[${stats.permutationTest.bootstrapCi95[0]}, ${stats.permutationTest.bootstrapCi95[1]}]$ & ${stats.permutationTest.significant ? "Reject $H_0$" : "Fail to Reject $H_0$"} \\\\
$\\chi^2$ International Collaboration (MCP) & $\\chi^2=${stats.chiSquareCollaboration.chi2},\\, \\chi^2_{\\text{Yates}}=${stats.chiSquareCollaboration.chi2Yates}$ & $p=${stats.chiSquareCollaboration.pValue}$ & $\\text{OR}=${stats.chiSquareCollaboration.oddsRatio}$ & ${stats.chiSquareCollaboration.significant ? "Significant Association" : "Independent"} \\\\
$\\chi^2$ Elite Papers (Top 10\\% Citations) & $\\chi^2=${stats.chiSquareElitePapers.chi2}$ & $p=${stats.chiSquareElitePapers.pValue}$ & $\\text{OR}=${stats.chiSquareElitePapers.oddsRatio}$ & ${stats.chiSquareElitePapers.significant ? "Significant Association" : "Independent"} \\\\
\\hline
\\end{tabular}
\\end{table}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Thematics & Log-Odds Specialization */}
          {activeTab === "thematics" && thematics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card padding="sm">
                  <div className="sciai-kicker">Jaccard Vocabulary Overlap</div>
                  <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                    {thematics.jaccardSimilarity}%
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-ink-muted">
                    |A ∩ B| / |A ∪ B| intersection
                  </div>
                </Card>

                <Card padding="sm">
                  <div className="sciai-kicker">Salton Cosine Similarity</div>
                  <div className="tabular-metrics mt-1 text-2xl font-black text-brand-500">
                    {thematics.cosineSimilarity}%
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-ink-muted">
                    Vector angle of term frequencies
                  </div>
                </Card>

                <Card padding="sm">
                  <div className="sciai-kicker">Shared Concept Nodes</div>
                  <div className="tabular-metrics mt-1 text-2xl font-black text-ink-primary">
                    {thematics.sharedKeywordsCount} Keywords
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-status-success-text">
                    Interdisciplinary Bridges
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Corpus A Distinctive Terms */}
                <Card padding="md" className="border-brand-200">
                  <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                    <span className="h-2 w-2 rounded-full bg-brand-500" />
                    <h3 className="text-sm font-black text-ink-primary">
                      Distinctive Signatures in {pA?.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Keywords exhibiting the highest log-odds specificity over
                    Corpus B (Biblium Relative Advantage)
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {thematics.distinctiveKeywordsA.map((kw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold capitalize text-ink-primary">
                            {kw.keyword}
                          </span>
                          <span className="tabular-metrics ml-2 font-mono text-[10px] text-brand-600">
                            (A: {kw.freqA} vs B: {kw.freqB})
                          </span>
                        </div>
                        <span className="tabular-metrics rounded-full bg-brand-500 px-2.5 py-0.5 font-mono text-[10px] font-black text-white">
                          {kw.specificity}x Specific
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Corpus B Distinctive Terms */}
                <Card padding="md" className="border-status-success-border">
                  <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                    <span className="h-2 w-2 rounded-full bg-status-success-text" />
                    <h3 className="text-sm font-black text-ink-primary">
                      Distinctive Signatures in {pB?.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Keywords exhibiting the highest log-odds specificity over
                    Corpus A
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {thematics.distinctiveKeywordsB.map((kw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-status-success-border bg-status-success-bg/50 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold capitalize text-ink-primary">
                            {kw.keyword}
                          </span>
                          <span className="tabular-metrics ml-2 font-mono text-[10px] text-status-success-text">
                            (B: {kw.freqB} vs A: {kw.freqA})
                          </span>
                        </div>
                        <span className="tabular-metrics rounded-full bg-status-success-text px-2.5 py-0.5 font-mono text-[10px] font-black text-white">
                          {kw.specificity}x Specific
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Shared Bridge Keywords */}
              <Card padding="md">
                <h3 className="text-sm font-black text-ink-primary">
                  Shared Interdisciplinary Bridging Concepts
                </h3>
                <p className="text-xs text-ink-muted">
                  Keywords appearing robustly across both scientific corpora,
                  representing common methodological foundations
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {thematics.sharedBridgeKeywords.map((kw, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-subtle px-3 py-1.5 text-xs"
                    >
                      <span className="font-bold capitalize text-ink-primary">
                        {kw.keyword}
                      </span>
                      <span className="tabular-metrics rounded-sm border border-border-default bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                        A: {kw.freqA} | B: {kw.freqB}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: Yearly Trends & Growth */}
          {activeTab === "trends" && (
            <div className="space-y-6">
              <Card padding="md">
                <div className="border-b border-border-subtle pb-3">
                  <h3 className="text-sm font-black text-ink-primary">
                    Annual Publication &amp; Citation Trajectories
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Year-by-year document volumes and average citations for both
                    research collections
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                        <th className="px-4 py-2.5">Publication Year</th>
                        <th className="px-4 py-2.5 font-bold text-brand-700">
                          Docs A ({pA?.name})
                        </th>
                        <th className="px-4 py-2.5 font-bold text-status-success-text">
                          Docs B ({pB?.name})
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Mean Cites A
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Mean Cites B
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular-metrics divide-y divide-border-subtle">
                      {report.yearlyTrends.map((t, idx) => (
                        <tr
                          key={idx}
                          className="transition-colors hover:bg-surface-subtle/70"
                        >
                          <td className="px-4 py-2.5 font-mono font-bold text-ink-primary">
                            {t.year}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-brand-600">
                            {t.docsA} papers
                          </td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-status-success-text">
                            {t.docsB} papers
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-ink-secondary">
                            {t.citesA} cites/doc
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-ink-secondary">
                            {t.citesB} cites/doc
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}