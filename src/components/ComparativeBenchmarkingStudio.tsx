import { useState, useEffect } from "react";
import {
  Scale,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  Award,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Hash,
  Share2,
  RefreshCw,
  Layers,
  Calculator,
  FileCode,
  HelpCircle,
  Activity,
  ChevronRight,
  Info,
  Percent,
  ArrowUpRight,
  PieChart,
  FileSpreadsheet,
} from "lucide-react";
import { Dataset } from "../types.js";

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
    distinctiveKeywordsA: Array<{ keyword: string; freqA: number; freqB: number; specificity: number }>;
    distinctiveKeywordsB: Array<{ keyword: string; freqA: number; freqB: number; specificity: number }>;
    sharedBridgeKeywords: Array<{ keyword: string; freqA: number; freqB: number; balance: number }>;
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
  const [datasetIdA, setDatasetIdA] = useState<string>(datasets[0]?.id || "dataset-bio-1");
  const [datasetIdB, setDatasetIdB] = useState<string>(datasets[1]?.id || "dataset-crispr-2");
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "statistics" | "thematics" | "trends">("overview");
  const [statSubTab, setStatSubTab] = useState<"matrix" | "ecdf" | "quantiles" | "contingency" | "guide">("matrix");
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [hoveredEcdf, setHoveredEcdf] = useState<EcdfPoint | null>(null);

  // Fetch benchmark on mount or when requested
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
      <div className="rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50/70 via-sky-50/40 to-white p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-slate-900">
                  Biblium Comparative Cross-Dataset Benchmarking
                </h2>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">
                  Biblium Framework
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
                Side-by-side scientometric benchmarking across two independent scientific corpora. Features non-parametric hypothesis testing (Mann-Whitney U, Kolmogorov-Smirnov, Pearson’s χ²), relative thematic specialization (Log-Odds specificity), and 6-dimensional radar alignment.
              </p>
            </div>
          </div>

          {/* Dataset Pickers */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs">
              <span className="font-bold text-indigo-700">Corpus A:</span>
              <select
                value={datasetIdA}
                onChange={(e) => setDatasetIdA(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.record_count} docs)
                  </option>
                ))}
              </select>
            </div>

            <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs">
              <span className="font-bold text-emerald-700">Corpus B:</span>
              <select
                value={datasetIdB}
                onChange={(e) => setDatasetIdB(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.record_count} docs)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runBenchmark}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Compute Benchmark
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="mt-5 flex items-center gap-1.5 border-t border-indigo-100/70 pt-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            1. Comparative Profiles & Radar
          </button>
          <button
            onClick={() => setActiveTab("statistics")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "statistics"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            2. Statistical Significance Suite (U, K-S, χ²)
          </button>
          <button
            onClick={() => setActiveTab("thematics")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "thematics"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            3. Thematic Specialization & Log-Odds
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "trends"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            4. Longitudinal Trajectory & Growth
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* TAB 1: Profiles & 6-Axis Radar */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Executive Summary Card with Copy */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Executive Scientometric Synthesis
                    </h3>
                  </div>
                  <button
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy Synthesis"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-700">
                  {report.executiveSummary}
                </p>
              </div>

              {/* Side-by-Side Comparison Metrics Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-black text-slate-900">
                    Side-by-Side Scientometric Indicators
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct comparison of volume, citation velocity, author productivity, and venue concentration
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-4">Scientometric Dimension</th>
                        <th className="py-2.5 px-4 text-indigo-700 font-black">
                          {pA?.name} (Corpus A)
                        </th>
                        <th className="py-2.5 px-4 text-emerald-700 font-black">
                          {pB?.name} (Corpus B)
                        </th>
                        <th className="py-2.5 px-4 text-right">Relative Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Indexed Document Volume (N)</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pA?.totalDocs}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pB?.totalDocs}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                          {pA && pB ? `${Math.round(((pA.totalDocs - pB.totalDocs) / pB.totalDocs) * 100)}%` : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Total Citation Count</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pA?.totalCitations}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pB?.totalCitations}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                          {pA && pB ? `${Math.round(((pA.totalCitations - pB.totalCitations) / pB.totalCitations) * 100)}%` : "N/A"}
                        </td>
                      </tr>
                      <tr className="bg-slate-50/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Mean Citation Velocity (μ)</td>
                        <td className="py-2.5 px-4 font-mono font-black text-indigo-700">{pA?.meanCitations}</td>
                        <td className="py-2.5 px-4 font-mono font-black text-emerald-700">{pB?.meanCitations}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] font-bold text-slate-900">
                          {pA && pB && (
                            <span className={pA.meanCitations >= pB.meanCitations ? "text-indigo-600" : "text-emerald-600"}>
                              {pA.meanCitations >= pB.meanCitations ? `+${Math.round(((pA.meanCitations - pB.meanCitations) / pB.meanCitations) * 100)}% A` : `+${Math.round(((pB.meanCitations - pA.meanCitations) / pA.meanCitations) * 100)}% B`}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Median Citations</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pA?.medianCitations}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pB?.medianCitations}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Corpus H-Index & G-Index</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">h={pA?.hIndex}, g={pA?.gIndex}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">h={pB?.hIndex}, g={pB?.gIndex}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                          Δh = {(pA?.hIndex || 0) - (pB?.hIndex || 0)}
                        </td>
                      </tr>
                      <tr className="bg-slate-50/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Uncited Paper Rate (% zeroes)</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pA?.uncitedRate}%</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pB?.uncitedRate}%</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">
                          {pA && pB ? `${(pA.uncitedRate - pB.uncitedRate).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Co-authorship Density (Authors/Doc)</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pA?.meanAuthorsPerPaper}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pB?.meanAuthorsPerPaper}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">International Collaboration (MCP %)</td>
                        <td className="py-2.5 px-4 font-mono font-black text-indigo-700">{pA?.mcpRatio}%</td>
                        <td className="py-2.5 px-4 font-mono font-black text-emerald-700">{pB?.mcpRatio}%</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] font-bold text-slate-900">
                          Δ = {pA && pB ? `${(pA.mcpRatio - pB.mcpRatio).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                      <tr className="bg-slate-50/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Bradford Core Journals (Zone 1) & Coeff (k)</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pA?.bradfordCoreCount} venues (k={pA?.bradfordK})</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{pB?.bradfordCoreCount} venues (k={pB?.bradfordK})</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">Annual Growth Momentum (CAGR)</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pA?.cagr}%</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{pB?.cagr}%</td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">
                          Δ = {pA && pB ? `${(pA.cagr - pB.cagr).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6-Axis Comparative Radar & Alignment */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Visual SVG Hexagon Radar */}
                <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900">
                      Hexagonal Scientometric Radar
                    </h3>
                    <p className="text-xs text-slate-500">
                      Normalized alignment across 6 essential scientometric pillars
                    </p>
                  </div>

                  <div className="relative mt-4 flex items-center justify-center h-80 w-full">
                    {/* SVG Hexagon */}
                    <svg viewBox="-110 -110 220 220" className="h-full w-full max-w-sm">
                      {/* Concentric Hexagons */}
                      {[0.25, 0.5, 0.75, 1.0].map((scale, sIdx) => {
                        const points = [0, 1, 2, 3, 4, 5].map((i) => {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const r = 80 * scale;
                          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                        }).join(" ");
                        return (
                          <polygon
                            key={sIdx}
                            points={points}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            strokeDasharray={scale === 1.0 ? "none" : "2 2"}
                          />
                        );
                      })}

                      {/* Axes */}
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
                            stroke="#e2e8f0"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Polygon A (Indigo) */}
                      {(() => {
                        const ptsA = radar.map((dim, i) => {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const r = (dim.scoreA / 100) * 80;
                          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                        }).join(" ");
                        return (
                          <polygon
                            points={ptsA}
                            fill="#6366f1"
                            fillOpacity="0.25"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                        );
                      })()}

                      {/* Polygon B (Emerald) */}
                      {(() => {
                        const ptsB = radar.map((dim, i) => {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const r = (dim.scoreB / 100) * 80;
                          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
                        }).join(" ");
                        return (
                          <polygon
                            points={ptsB}
                            fill="#10b981"
                            fillOpacity="0.25"
                            stroke="#059669"
                            strokeWidth="2"
                          />
                        );
                      })()}

                      {/* Labels around vertices */}
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
                            fill="#475569"
                            textAnchor={x > 5 ? "start" : x < -5 ? "end" : "middle"}
                            dominantBaseline="central"
                          >
                            {dim.dimension.split(" ")[0]}
                          </text>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="mt-2 flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-xs bg-indigo-600" />
                      <span className="font-bold text-slate-800">{pA?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-xs bg-emerald-600" />
                      <span className="font-bold text-slate-800">{pB?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Radar Breakdown Bars */}
                <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900">
                      Dimension Scores & Disciplinary Divergence
                    </h3>
                    <p className="text-xs text-slate-500">
                      Relative percentile performance in each bibliometric vector
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {radar.map((dim, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{dim.dimension}</span>
                          <div className="flex items-center gap-3 text-[11px] font-mono">
                            <span className="font-bold text-indigo-700">A: {dim.metricLabelA}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-emerald-700">B: {dim.metricLabelB}</span>
                          </div>
                        </div>

                        {/* Dual Bar */}
                        <div className="space-y-1">
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                              style={{ width: `${dim.scoreA}%` }}
                            />
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                              style={{ width: `${dim.scoreB}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Statistical Significance Suite */}
          {activeTab === "statistics" && stats && (
            <div className="space-y-6">
              {/* Statistical Suite Sub-Navigation & Quick Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                {/* Sub-Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setStatSubTab("matrix")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      statSubTab === "matrix"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Hypothesis Matrix
                  </button>
                  <button
                    onClick={() => setStatSubTab("ecdf")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      statSubTab === "ecdf"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    ECDF & K-S Distance
                  </button>
                  <button
                    onClick={() => setStatSubTab("quantiles")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      statSubTab === "quantiles"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Boxplot & Skewness
                  </button>
                  <button
                    onClick={() => setStatSubTab("contingency")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      statSubTab === "contingency"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <PieChart className="h-3.5 w-3.5" />
                    2×2 Contingency Tables
                  </button>
                  <button
                    onClick={() => setStatSubTab("guide")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      statSubTab === "guide"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Methodology & LaTeX
                  </button>
                </div>

                {/* Copy Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLatex}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Copy LaTeX Table for Academic Paper Submission"
                  >
                    {copiedLatex ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <FileCode className="h-3.5 w-3.5 text-slate-500" />}
                    {copiedLatex ? "LaTeX Copied" : "Copy LaTeX"}
                  </button>
                  <button
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Copy Markdown Table"
                  >
                    {copiedMarkdown ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />}
                    {copiedMarkdown ? "Markdown Copied" : "Copy MD"}
                  </button>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SUB-TAB 1: HYPOTHESIS TESTING MATRIX                          */}
              {/* ------------------------------------------------------------- */}
              {statSubTab === "matrix" && (
                <div className="space-y-6">
                  {/* Summary Banner */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-2xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Scale className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-black text-slate-900">
                            Comparative Statistical Significance Matrix
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Hypothesis tests evaluating whether observed citation and structural divergences between &ldquo;{pA?.name}&rdquo; and &ldquo;{pB?.name}&rdquo; are statistically significant or attributable to random sampling noise.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="rounded-lg bg-white px-3 py-2 border border-indigo-100 shadow-2xs text-center">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Tests Evaluated</div>
                          <div className="text-lg font-black text-slate-900">6 Tests</div>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2 border border-emerald-200 shadow-2xs text-center">
                          <div className="text-[10px] font-bold uppercase text-emerald-700">Reject Null (H₀)</div>
                          <div className="text-lg font-black text-emerald-700">
                            {[
                              stats.mannWhitneyU.significant,
                              stats.kolmogorovSmirnov.significant,
                              stats.welchTTest.significant,
                              stats.permutationTest.significant,
                              stats.chiSquareCollaboration.significant,
                              stats.chiSquareElitePapers.significant,
                            ].filter(Boolean).length} of 6
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6 High-Contrast Decision Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* 1. Mann-Whitney U Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                          Non-Parametric Rank Sum
                        </span>
                        {stats.mannWhitneyU.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Fail to Reject H₀
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Mann-Whitney U Test
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Non-parametric Wilcoxon rank-sum test robust against heavy positive skewness and extreme citation blockbusters.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">U-Statistic</div>
                          <div className="text-sm font-black text-slate-900">{stats.mannWhitneyU.uStatistic}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">p-Value (Two-Sided)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.mannWhitneyU.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Z-Score</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.mannWhitneyU.zScore}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Cliff&apos;s Delta (δ)</div>
                          <div className="text-sm font-black text-indigo-700 font-mono">
                            {stats.mannWhitneyU.cliffsDelta} ({stats.mannWhitneyU.effectSize})
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-indigo-50/70 p-3 text-xs text-indigo-950 border border-indigo-100 leading-relaxed font-medium">
                        {stats.mannWhitneyU.interpretation}
                      </div>
                    </div>

                    {/* 2. Kolmogorov-Smirnov Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">
                          Continuous ECDF Distance
                        </span>
                        {stats.kolmogorovSmirnov.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Equivalent Distribution
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Kolmogorov-Smirnov Two-Sample Test
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Quantifies supremum distance between empirical cumulative distribution functions (ECDF) across both corpora.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">D-Statistic (Dmax)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.kolmogorovSmirnov.dStatistic}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Critical D (α=0.05)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.kolmogorovSmirnov.criticalValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">p-Value (K-S)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.kolmogorovSmirnov.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Max Divergence At</div>
                          <div className="text-sm font-black text-sky-700 font-mono">
                            {stats.kolmogorovSmirnov.maxDLocation} citations
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-sky-50/70 p-3 text-xs text-sky-950 border border-sky-100 leading-relaxed font-medium">
                        {stats.kolmogorovSmirnov.interpretation}
                      </div>
                    </div>

                    {/* 3. Welch's Two-Sample t-Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600">
                          Parametric (Unequal Variances)
                        </span>
                        {stats.welchTTest.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            No Mean Difference
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Welch&apos;s Two-Sample t-Test
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Difference of means test with Welch-Satterthwaite adjusted degrees of freedom for heteroscedastic data.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">t-Stat (df={stats.welchTTest.degreesOfFreedom})</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.welchTTest.tStatistic}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">p-Value (Student t)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.welchTTest.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Cohen&apos;s d (Effect)</div>
                          <div className="text-sm font-black text-purple-700 font-mono">
                            {stats.welchTTest.cohensD} ({stats.welchTTest.effectSize})
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">95% CI (Δ Means)</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            [{stats.welchTTest.meanDiffCi95[0]}, {stats.welchTTest.meanDiffCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-purple-50/70 p-3 text-xs text-purple-950 border border-purple-100 leading-relaxed font-medium">
                        {stats.welchTTest.interpretation}
                      </div>
                    </div>

                    {/* 4. Monte Carlo Permutation Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                          Exact Resampling (1,000 Runs)
                        </span>
                        {stats.permutationTest.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant (Reject H₀)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Random Chance Likely
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Monte Carlo Permutation Test
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Empirical 1,000-run permutation test without distributional assumptions to validate citation mean divergence.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Observed Diff (Δ)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.permutationTest.observedDiff}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Permutation p-Value</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.permutationTest.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Resamples</div>
                          <div className="text-sm font-black text-amber-700 font-mono">{stats.permutationTest.resamples} runs</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">95% Bootstrap CI</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            [{stats.permutationTest.bootstrapCi95[0]}, {stats.permutationTest.bootstrapCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-amber-50/70 p-3 text-xs text-amber-950 border border-amber-100 leading-relaxed font-medium">
                        {stats.permutationTest.interpretation}
                      </div>
                    </div>

                    {/* 5. Chi-Square Collaboration Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                          Categorical Association (MCP)
                        </span>
                        {stats.chiSquareCollaboration.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant Association
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Independent (No Link)
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Chi-Square International Collaboration (χ²)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Tests whether international collaboration rate (MCP vs SCP) is independent of research domain.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Chi-Square (χ²)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.chiSquareCollaboration.chi2}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">p-Value (Chi-Square)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.chiSquareCollaboration.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Yates&apos; Continuity</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.chiSquareCollaboration.chi2Yates}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Odds Ratio (OR)</div>
                          <div className="text-sm font-black text-emerald-700 font-mono">{stats.chiSquareCollaboration.oddsRatio}</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-950 border border-emerald-100 leading-relaxed font-medium">
                        {stats.chiSquareCollaboration.interpretation}
                      </div>
                    </div>

                    {/* 6. Chi-Square Elite Papers Test Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
                          Elite Top 10% Odds
                        </span>
                        {stats.chiSquareElitePapers.significant ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Significant Advantage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Balanced Proportion
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-2">
                        Chi-Square Elite Papers (Top 10%)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Compares likelihood of producing papers in the top 10% citation decile of the joint corpus.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Chi-Square (χ²)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.chiSquareElitePapers.chi2}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">p-Value (Chi-Square)</div>
                          <div className="text-sm font-black text-slate-900 font-mono">{stats.chiSquareElitePapers.pValue}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Odds Ratio (OR)</div>
                          <div className="text-sm font-black text-rose-700 font-mono">{stats.chiSquareElitePapers.oddsRatio}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                          <div className="text-[9px] font-bold uppercase text-slate-400">95% CI for OR</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            [{stats.chiSquareElitePapers.oddsRatioCi95[0]}, {stats.chiSquareElitePapers.oddsRatioCi95[1]}]
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-rose-50/70 p-3 text-xs text-rose-950 border border-rose-100 leading-relaxed font-medium">
                        {stats.chiSquareElitePapers.interpretation}
                      </div>
                    </div>
                  </div>

                  {/* Comparative Matrix Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900">
                        Comprehensive Hypothesis Testing Table
                      </h3>
                      <p className="text-xs text-slate-500">
                        Consolidated summary of parametric and non-parametric statistical hypothesis tests at significance level α = 0.05
                      </p>
                    </div>

                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4">Statistical Test</th>
                            <th className="py-2.5 px-4">Methodology</th>
                            <th className="py-2.5 px-4">Test Statistic</th>
                            <th className="py-2.5 px-4">p-Value</th>
                            <th className="py-2.5 px-4">Effect Size</th>
                            <th className="py-2.5 px-4">95% CI / Diagnostic</th>
                            <th className="py-2.5 px-4 text-center">Decision (α=0.05)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Mann-Whitney U Test</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Non-Parametric</span></td>
                            <td className="py-2.5 px-4 font-mono">U = {stats.mannWhitneyU.uStatistic}, Z = {stats.mannWhitneyU.zScore}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.mannWhitneyU.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">δ = {stats.mannWhitneyU.cliffsDelta} ({stats.mannWhitneyU.effectSize})</td>
                            <td className="py-2.5 px-4 font-mono text-slate-500">Rank-Biserial: {stats.mannWhitneyU.rankBiserial}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.mannWhitneyU.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.mannWhitneyU.significant ? "Reject H₀" : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Kolmogorov-Smirnov (K-S)</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">ECDF Distance</span></td>
                            <td className="py-2.5 px-4 font-mono">D = {stats.kolmogorovSmirnov.dStatistic} (Dcrit = {stats.kolmogorovSmirnov.criticalValue})</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.kolmogorovSmirnov.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-sky-700">Dmax @ {stats.kolmogorovSmirnov.maxDLocation} cites</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">-</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.kolmogorovSmirnov.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.kolmogorovSmirnov.significant ? "Distinct Distributions" : "Equivalent Shapes"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Welch&apos;s t-Test</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Parametric</span></td>
                            <td className="py-2.5 px-4 font-mono">t({stats.welchTTest.degreesOfFreedom}) = {stats.welchTTest.tStatistic}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.welchTTest.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-purple-700">d = {stats.welchTTest.cohensD} ({stats.welchTTest.effectSize})</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">[{stats.welchTTest.meanDiffCi95[0]}, {stats.welchTTest.meanDiffCi95[1]}]</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.welchTTest.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.welchTTest.significant ? "Reject H₀" : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Monte Carlo Permutation</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Exact Resampling</span></td>
                            <td className="py-2.5 px-4 font-mono">Δ = {stats.permutationTest.observedDiff} ({stats.permutationTest.resamples} runs)</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.permutationTest.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-amber-700">Observed Mean Diff</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">[{stats.permutationTest.bootstrapCi95[0]}, {stats.permutationTest.bootstrapCi95[1]}]</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.permutationTest.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.permutationTest.significant ? "Reject H₀" : "Fail to Reject H₀"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Chi-Square Collaboration (MCP)</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Categorical 2×2</span></td>
                            <td className="py-2.5 px-4 font-mono">χ² = {stats.chiSquareCollaboration.chi2} (Yates: {stats.chiSquareCollaboration.chi2Yates})</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.chiSquareCollaboration.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">OR = {stats.chiSquareCollaboration.oddsRatio}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">[{stats.chiSquareCollaboration.oddsRatioCi95[0]}, {stats.chiSquareCollaboration.oddsRatioCi95[1]}]</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.chiSquareCollaboration.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.chiSquareCollaboration.significant ? "Significant Link" : "Independent"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Chi-Square Elite Papers (Top 10%)</td>
                            <td className="py-2.5 px-4"><span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Decile Distribution</span></td>
                            <td className="py-2.5 px-4 font-mono">χ² = {stats.chiSquareElitePapers.chi2}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.chiSquareElitePapers.pValue}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-rose-700">OR = {stats.chiSquareElitePapers.oddsRatio}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">[{stats.chiSquareElitePapers.oddsRatioCi95[0]}, {stats.chiSquareElitePapers.oddsRatioCi95[1]}]</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.chiSquareElitePapers.significant ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                                {stats.chiSquareElitePapers.significant ? "Significant Link" : "Balanced Share"}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-TAB 2: EMPIRICAL CDF & KOLMOGOROV-SMIRNOV STEP CHART      */}
              {/* ------------------------------------------------------------- */}
              {statSubTab === "ecdf" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          Empirical Cumulative Distribution Functions (ECDF)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Cumulative citation probability step curves and Kolmogorov-Smirnov supremum divergence marker (Dmax)
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                          <span className="font-bold text-slate-800">{pA?.name} (FA)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                          <span className="font-bold text-slate-800">{pB?.name} (FB)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-1 border-r-2 border-dashed border-rose-500" />
                          <span className="font-bold text-rose-600">Dmax = {stats.kolmogorovSmirnov.dStatistic}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive SVG ECDF Chart */}
                    <div className="relative mt-5 h-80 w-full overflow-hidden">
                      {(() => {
                        const pts = stats.ecdfPoints || [];
                        if (pts.length < 2) return <div className="text-xs text-slate-400 p-4">Insufficient data points to render ECDF.</div>;

                        const maxVal = Math.max(...pts.map((p) => p.value), 10);
                        const minVal = 0;
                        const w = 700;
                        const h = 260;
                        const padX = 50;
                        const padY = 30;

                        const scaleX = (v: number) => padX + ((v - minVal) / (maxVal - minVal || 1)) * (w - padX * 2);
                        const scaleY = (cdf: number) => h - padY - cdf * (h - padY * 2);

                        // Build step path for A
                        let pathA = `M ${scaleX(0)} ${scaleY(0)}`;
                        pts.forEach((pt) => {
                          pathA += ` H ${scaleX(pt.value)} V ${scaleY(pt.cdfA)}`;
                        });

                        // Build step path for B
                        let pathB = `M ${scaleX(0)} ${scaleY(0)}`;
                        pts.forEach((pt) => {
                          pathB += ` H ${scaleX(pt.value)} V ${scaleY(pt.cdfB)}`;
                        });

                        const maxDPt = pts.find((p) => p.isMaxD) || pts[Math.floor(pts.length / 2)];
                        const maxDX = scaleX(maxDPt.value);
                        const maxDYA = scaleY(maxDPt.cdfA);
                        const maxDYB = scaleY(maxDPt.cdfB);

                        return (
                          <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
                            {/* Horizontal Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1.0].map((gridP) => (
                              <g key={gridP}>
                                <line
                                  x1={padX}
                                  y1={scaleY(gridP)}
                                  x2={w - padX}
                                  y2={scaleY(gridP)}
                                  stroke="#f1f5f9"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padX - 8}
                                  y={scaleY(gridP) + 3}
                                  fontSize="9"
                                  fill="#94a3b8"
                                  textAnchor="end"
                                  fontFamily="monospace"
                                >
                                  {gridP.toFixed(2)}
                                </text>
                              </g>
                            ))}

                            {/* X-Axis Ticks */}
                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((frac) => {
                              const tickVal = Math.round(minVal + frac * (maxVal - minVal));
                              return (
                                <g key={frac}>
                                  <line
                                    x1={scaleX(tickVal)}
                                    y1={h - padY}
                                    x2={scaleX(tickVal)}
                                    y2={h - padY + 4}
                                    stroke="#cbd5e1"
                                  />
                                  <text
                                    x={scaleX(tickVal)}
                                    y={h - padY + 16}
                                    fontSize="9"
                                    fill="#94a3b8"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {tickVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Dmax Vertical Marker Line */}
                            <line
                              x1={maxDX}
                              y1={maxDYA}
                              x2={maxDX}
                              y2={maxDYB}
                              stroke="#f43f5e"
                              strokeWidth="3"
                              strokeDasharray="3 3"
                            />
                            <circle cx={maxDX} cy={maxDYA} r="4" fill="#4f46e5" />
                            <circle cx={maxDX} cy={maxDYB} r="4" fill="#059669" />

                            {/* Dmax Callout Label */}
                            <rect
                              x={maxDX + 8}
                              y={Math.min(maxDYA, maxDYB) + 10}
                              width="125"
                              height="34"
                              rx="4"
                              fill="#1e293b"
                              opacity="0.9"
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
                              fill="#cbd5e1"
                            >
                              at {maxDPt.value} citations
                            </text>

                            {/* Path A (Indigo) */}
                            <path d={pathA} fill="none" stroke="#4f46e5" strokeWidth="2.5" />

                            {/* Path B (Emerald) */}
                            <path d={pathB} fill="none" stroke="#059669" strokeWidth="2.5" />

                            {/* Interactive Points */}
                            {pts.map((pt, pIdx) => {
                              const xPos = scaleX(pt.value);
                              return (
                                <g
                                  key={pIdx}
                                  className="cursor-pointer group"
                                  onMouseEnter={() => setHoveredEcdf(pt)}
                                  onMouseLeave={() => setHoveredEcdf(null)}
                                >
                                  <circle
                                    cx={xPos}
                                    cy={scaleY(pt.cdfA)}
                                    r={pt.isMaxD ? "4.5" : "2.5"}
                                    fill="#4f46e5"
                                    className="hover:r-4 transition-all"
                                  />
                                  <circle
                                    cx={xPos}
                                    cy={scaleY(pt.cdfB)}
                                    r={pt.isMaxD ? "4.5" : "2.5"}
                                    fill="#059669"
                                    className="hover:r-4 transition-all"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>

                    {/* Hover Inspector Tooltip */}
                    {hoveredEcdf ? (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-2 text-xs text-white">
                        <div>
                          <span className="text-slate-400">Citation Threshold:</span>{" "}
                          <span className="font-mono font-bold text-amber-300">{hoveredEcdf.value} citations</span>
                        </div>
                        <div className="flex items-center gap-6 font-mono">
                          <span className="text-indigo-300 font-bold">FA(x) = {hoveredEcdf.cdfA}</span>
                          <span className="text-emerald-300 font-bold">FB(x) = {hoveredEcdf.cdfB}</span>
                          <span className="text-rose-300 font-bold">Δ = {hoveredEcdf.difference}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-center text-xs text-slate-400">
                        Hover over curve data points to inspect cumulative probabilities and point-by-point divergence.
                      </div>
                    )}
                  </div>

                  {/* K-S Methodological Explanation Box */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 text-xs text-sky-950 leading-relaxed">
                        <div className="font-bold text-sky-900">
                          Interpreting the Kolmogorov-Smirnov Test in Scientometrics:
                        </div>
                        <p>
                          The two-sample Kolmogorov-Smirnov test tests whether two samples are drawn from the same continuous distribution without normality constraints.
                          The test statistic D = {stats.kolmogorovSmirnov.dStatistic} identifies the maximal vertical distance between both ECDFs. Because this value is {stats.kolmogorovSmirnov.significant ? `greater than critical D (${stats.kolmogorovSmirnov.criticalValue}), the null hypothesis of distributional equivalence is rejected (p = ${stats.kolmogorovSmirnov.pValue}), confirming distinct citation accumulation trajectories.` : `less than critical D (${stats.kolmogorovSmirnov.criticalValue}), the empirical distribution shapes are statistically equivalent.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-TAB 3: FIVE-NUMBER SUMMARY, SKEWNESS & BOXPLOT             */}
              {/* ------------------------------------------------------------- */}
              {statSubTab === "quantiles" && (
                <div className="space-y-6">
                  {/* Visual Boxplot Comparison */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900">
                        Comparative Citation Box-and-Whisker Plot
                      </h3>
                      <p className="text-xs text-slate-500">
                        Visual depiction of 25th percentile (Q1), median (Q2), 75th percentile (Q3), interquartile range (IQR), and extrema
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

                        const scaleX = (val: number) => padX + (val / globalMax) * (w - padX - 30);

                        return (
                          <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
                            {/* Axis */}
                            <line x1={padX} y1={h - 25} x2={w - 30} y2={h - 25} stroke="#cbd5e1" strokeWidth="1" />
                            {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                              const tickVal = Math.round(frac * globalMax);
                              return (
                                <g key={frac}>
                                  <line x1={scaleX(tickVal)} y1={h - 25} x2={scaleX(tickVal)} y2={h - 20} stroke="#94a3b8" />
                                  <text x={scaleX(tickVal)} y={h - 8} fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">
                                    {tickVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Boxplot A (Indigo) */}
                            <g>
                              <text x="10" y="55" fontSize="10" fontWeight="bold" fill="#4f46e5">
                                {pA?.name.slice(0, 10)}..
                              </text>
                              {/* Whisker Line */}
                              <line x1={scaleX(dA.min)} y1="50" x2={scaleX(dA.max)} y2="50" stroke="#4f46e5" strokeWidth="1.5" />
                              <line x1={scaleX(dA.min)} y1="42" x2={scaleX(dA.min)} y2="58" stroke="#4f46e5" strokeWidth="1.5" />
                              <line x1={scaleX(dA.max)} y1="42" x2={scaleX(dA.max)} y2="58" stroke="#4f46e5" strokeWidth="1.5" />
                              {/* Box */}
                              <rect
                                x={scaleX(dA.q25)}
                                y="35"
                                width={Math.max(2, scaleX(dA.q75) - scaleX(dA.q25))}
                                height="30"
                                fill="#818cf8"
                                fillOpacity="0.3"
                                stroke="#4f46e5"
                                strokeWidth="2"
                                rx="2"
                              />
                              {/* Median */}
                              <line x1={scaleX(dA.median)} y1="35" x2={scaleX(dA.median)} y2="65" stroke="#312e81" strokeWidth="2.5" />
                              {/* Mean Diamond */}
                              <polygon
                                points={`${scaleX(dA.mean)},45 ${scaleX(dA.mean) + 4},50 ${scaleX(dA.mean)},55 ${scaleX(dA.mean) - 4},50`}
                                fill="#f59e0b"
                              />
                            </g>

                            {/* Boxplot B (Emerald) */}
                            <g>
                              <text x="10" y="115" fontSize="10" fontWeight="bold" fill="#059669">
                                {pB?.name.slice(0, 10)}..
                              </text>
                              {/* Whisker Line */}
                              <line x1={scaleX(dB.min)} y1="110" x2={scaleX(dB.max)} y2="110" stroke="#059669" strokeWidth="1.5" />
                              <line x1={scaleX(dB.min)} y1="102" x2={scaleX(dB.min)} y2="118" stroke="#059669" strokeWidth="1.5" />
                              <line x1={scaleX(dB.max)} y1="102" x2={scaleX(dB.max)} y2="118" stroke="#059669" strokeWidth="1.5" />
                              {/* Box */}
                              <rect
                                x={scaleX(dB.q25)}
                                y="95"
                                width={Math.max(2, scaleX(dB.q75) - scaleX(dB.q25))}
                                height="30"
                                fill="#34d399"
                                fillOpacity="0.3"
                                stroke="#059669"
                                strokeWidth="2"
                                rx="2"
                              />
                              {/* Median */}
                              <line x1={scaleX(dB.median)} y1="95" x2={scaleX(dB.median)} y2="125" stroke="#064e3b" strokeWidth="2.5" />
                              {/* Mean Diamond */}
                              <polygon
                                points={`${scaleX(dB.mean)},105 ${scaleX(dB.mean) + 4},110 ${scaleX(dB.mean)},115 ${scaleX(dB.mean) - 4},110`}
                                fill="#f59e0b"
                              />
                            </g>
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Complete 11-Parameter Distribution Metrics Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900">
                        Five-Number Summary & Distribution Moments
                      </h3>
                      <p className="text-xs text-slate-500">
                        Location, dispersion, interquartile range (IQR), and Fisher-Pearson coefficient of skewness
                      </p>
                    </div>

                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4">Metric</th>
                            <th className="py-2.5 px-4">Mathematical Notation</th>
                            <th className="py-2.5 px-4 font-mono text-indigo-700">Corpus A ({pA?.name})</th>
                            <th className="py-2.5 px-4 font-mono text-emerald-700">Corpus B ({pB?.name})</th>
                            <th className="py-2.5 px-4 text-right">Difference (Δ = A - B)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Minimum</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">Min(C)</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.min}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.min}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.min - stats.distributionB.min).toFixed(1)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">First Quartile (Q1 / P25)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">P25</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.q25}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.q25}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.q25 - stats.distributionB.q25).toFixed(1)}</td>
                          </tr>
                          <tr className="bg-amber-50/30">
                            <td className="py-2.5 px-4 font-black text-slate-900">Median (Q2 / P50)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">Q2 / P50</td>
                            <td className="py-2.5 px-4 font-mono font-black text-indigo-700">{stats.distributionA.median}</td>
                            <td className="py-2.5 px-4 font-mono font-black text-emerald-700">{stats.distributionB.median}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{(stats.distributionA.median - stats.distributionB.median).toFixed(1)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Third Quartile (Q3 / P75)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">P75</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.q75}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.q75}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.q75 - stats.distributionB.q75).toFixed(1)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Interquartile Range (IQR)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">Q3 - Q1</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.iqr}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.iqr}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.iqr - stats.distributionB.iqr).toFixed(1)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Maximum</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">Max(C)</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.max}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.max}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.max - stats.distributionB.max).toFixed(1)}</td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="py-2.5 px-4 font-bold text-slate-900">Arithmetic Mean</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">μ = Σx / n</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionA.mean}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{stats.distributionB.mean}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.mean - stats.distributionB.mean).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Standard Deviation</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">σ = √Var</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">{stats.distributionA.stdDev}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">{stats.distributionB.stdDev}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.stdDev - stats.distributionB.stdDev).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Standard Error (SE)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">SE = σ / √n</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">{stats.distributionA.standardError}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-700">{stats.distributionB.standardError}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">{(stats.distributionA.standardError - stats.distributionB.standardError).toFixed(2)}</td>
                          </tr>
                          <tr className="bg-rose-50/40">
                            <td className="py-2.5 px-4 font-black text-rose-900">Skewness Coefficient (g₁)</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">m3 / s³</td>
                            <td className="py-2.5 px-4 font-mono font-black text-rose-700">{stats.distributionA.skewness}</td>
                            <td className="py-2.5 px-4 font-mono font-black text-rose-700">{stats.distributionB.skewness}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-900">
                              {Math.abs(stats.distributionA.skewness) > 1 || Math.abs(stats.distributionB.skewness) > 1 ? "Heavy Skewness" : "Nearly Symmetric"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Skewness Callout */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs text-rose-950 leading-relaxed">
                        <div className="font-bold text-rose-900">
                          Why High Positive Skewness Matters in Scientometrics:
                        </div>
                        <p>
                          In accordance with Lotka&apos;s and Bradford&apos;s laws as well as Pareto power-law dynamics, the vast majority of scientific papers receive modest citations while a select few gather hundreds or thousands. This makes citation distributions strongly right-skewed (g₁ &gt; 1). Consequently, relying solely on parametric Student t-tests and arithmetic means can be biased. Methodological guidelines recommend prioritizing the non-parametric Mann-Whitney U test, medians, and ECDF distance metrics.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-TAB 4: 2x2 CONTINGENCY TABLES & ODDS RATIOS               */}
              {/* ------------------------------------------------------------- */}
              {statSubTab === "contingency" && (
                <div className="space-y-6">
                  {/* Table 1: International Collaboration */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900">
                          Contingency Table 1: International Researcher Collaboration (MCP vs. SCP)
                        </h3>
                        {stats.chiSquareCollaboration.significant ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Statistically Significant (p &lt; 0.05)
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            Independent (No Association)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Pearson&apos;s Chi-Square Test of Independence (χ²) with Yates&apos; continuity correction
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Matrix Grid */}
                      <div className="lg:col-span-7">
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-center text-xs">
                            <thead className="bg-slate-50 font-bold text-slate-700">
                              <tr>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200">Corpus</th>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200 text-indigo-700 font-black">Multi-Country (MCP)</th>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200 text-slate-700 font-black">Single-Country (SCP)</th>
                                <th className="py-2.5 px-3 border-b border-slate-200 bg-slate-100 font-black">Row Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              <tr>
                                <td className="py-3 px-3 font-sans font-bold text-slate-900 border-r border-slate-200 text-left">
                                  Corpus A ({pA?.name.slice(0, 15)}..)
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 bg-indigo-50/40 font-bold text-indigo-950">
                                  {stats.chiSquareCollaboration.table.a11}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200">
                                  {stats.chiSquareCollaboration.table.a12}
                                </td>
                                <td className="py-3 px-3 bg-slate-50 font-bold text-slate-900">
                                  {stats.chiSquareCollaboration.table.a11 + stats.chiSquareCollaboration.table.a12}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-sans font-bold text-slate-900 border-r border-slate-200 text-left">
                                  Corpus B ({pB?.name.slice(0, 15)}..)
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 bg-emerald-50/40 font-bold text-emerald-950">
                                  {stats.chiSquareCollaboration.table.a21}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200">
                                  {stats.chiSquareCollaboration.table.a22}
                                </td>
                                <td className="py-3 px-3 bg-slate-50 font-bold text-slate-900">
                                  {stats.chiSquareCollaboration.table.a21 + stats.chiSquareCollaboration.table.a22}
                                </td>
                              </tr>
                              <tr className="bg-slate-100 font-bold text-slate-900">
                                <td className="py-2.5 px-3 font-sans border-r border-slate-200 text-left">Column Total</td>
                                <td className="py-2.5 px-3 border-r border-slate-200">
                                  {stats.chiSquareCollaboration.table.a11 + stats.chiSquareCollaboration.table.a21}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200">
                                  {stats.chiSquareCollaboration.table.a12 + stats.chiSquareCollaboration.table.a22}
                                </td>
                                <td className="py-2.5 px-3 bg-slate-200">
                                  {stats.chiSquareCollaboration.table.a11 + stats.chiSquareCollaboration.table.a12 + stats.chiSquareCollaboration.table.a21 + stats.chiSquareCollaboration.table.a22}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Odds Ratio & Chi2 Statistics Callout */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">Pearson Chi-Square (χ²):</span>
                            <span className="font-mono font-black text-slate-900">{stats.chiSquareCollaboration.chi2}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">χ² with Yates&apos; Correction:</span>
                            <span className="font-mono font-black text-slate-900">{stats.chiSquareCollaboration.chi2Yates}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">Significance Level (p-Value):</span>
                            <span className="font-mono font-black text-slate-900">{stats.chiSquareCollaboration.pValue}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                            <span className="font-bold text-indigo-700">Odds Ratio (OR):</span>
                            <span className="font-mono font-black text-indigo-700 text-sm">{stats.chiSquareCollaboration.oddsRatio}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-500">95% Confidence Interval for OR:</span>
                            <span className="font-mono font-bold text-slate-700">
                              [{stats.chiSquareCollaboration.oddsRatioCi95[0]}, {stats.chiSquareCollaboration.oddsRatioCi95[1]}]
                            </span>
                          </div>
                        </div>

                        <div className="rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-950 border border-emerald-200 leading-relaxed font-medium">
                          {stats.chiSquareCollaboration.interpretation}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table 2: Elite Papers Representation */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900">
                          Contingency Table 2: Elite Citation Blockbusters (Top 10% Papers)
                        </h3>
                        {stats.chiSquareElitePapers.significant ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Significant Odds Advantage for Elite Papers
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            Balanced Representation of Elite Papers
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Odds comparison of producing top-decile cited publications across the pooled dataset
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Matrix Grid */}
                      <div className="lg:col-span-7">
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-center text-xs">
                            <thead className="bg-slate-50 font-bold text-slate-700">
                              <tr>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200">Corpus</th>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200 text-rose-700 font-black">Elite Papers (Top 10%)</th>
                                <th className="py-2.5 px-3 border-r border-b border-slate-200 text-slate-700 font-black">Standard Papers</th>
                                <th className="py-2.5 px-3 border-b border-slate-200 bg-slate-100 font-black">Row Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              <tr>
                                <td className="py-3 px-3 font-sans font-bold text-slate-900 border-r border-slate-200 text-left">
                                  Corpus A ({pA?.name.slice(0, 15)}..)
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 bg-rose-50/40 font-bold text-rose-950">
                                  {stats.chiSquareElitePapers.table.a11}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200">
                                  {stats.chiSquareElitePapers.table.a12}
                                </td>
                                <td className="py-3 px-3 bg-slate-50 font-bold text-slate-900">
                                  {stats.chiSquareElitePapers.table.a11 + stats.chiSquareElitePapers.table.a12}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-sans font-bold text-slate-900 border-r border-slate-200 text-left">
                                  Corpus B ({pB?.name.slice(0, 15)}..)
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 bg-amber-50/40 font-bold text-amber-950">
                                  {stats.chiSquareElitePapers.table.a21}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200">
                                  {stats.chiSquareElitePapers.table.a22}
                                </td>
                                <td className="py-3 px-3 bg-slate-50 font-bold text-slate-900">
                                  {stats.chiSquareElitePapers.table.a21 + stats.chiSquareElitePapers.table.a22}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="lg:col-span-5 space-y-3">
                        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">Pearson Chi-Square (χ²):</span>
                            <span className="font-mono font-black text-slate-900">{stats.chiSquareElitePapers.chi2}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">Significance Level (p-Value):</span>
                            <span className="font-mono font-black text-slate-900">{stats.chiSquareElitePapers.pValue}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                            <span className="font-bold text-rose-700">Elite Paper Odds Ratio (OR):</span>
                            <span className="font-mono font-black text-rose-700 text-sm">{stats.chiSquareElitePapers.oddsRatio}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-500">95% Confidence Interval:</span>
                            <span className="font-mono font-bold text-slate-700">
                              [{stats.chiSquareElitePapers.oddsRatioCi95[0]}, {stats.chiSquareElitePapers.oddsRatioCi95[1]}]
                            </span>
                          </div>
                        </div>

                        <div className="rounded-lg bg-rose-50/70 p-3 text-xs text-rose-950 border border-rose-200 leading-relaxed font-medium">
                          {stats.chiSquareElitePapers.interpretation}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-TAB 5: METHODOLOGICAL GUIDE & LATEX EXPORT                */}
              {/* ------------------------------------------------------------- */}
              {statSubTab === "guide" && (
                <div className="space-y-6">
                  {/* Methodological Guidance in Persian */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                        <h3 className="text-sm font-black text-slate-900">
                          Scientometric Comparative Methodology Guide
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Statistical reporting and methodological guidelines for Scientometrics, JASIST, and Journal of Informetrics
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs leading-relaxed text-slate-700">
                      <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
                        <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-600" />
                          1. Why Mann-Whitney U is preferred over Student&apos;s t-test
                        </h4>
                        <p>
                          Scientific citations intrinsically follow power-law (Pareto) and over-dispersed Poisson distributions. The presence of hyper-cited blockbuster papers produces heavy right skewness. The Mann-Whitney U test evaluates rank sums rather than raw citation means, testing stochastic dominance without imposing false normality assumptions.
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
                        <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-sky-600" />
                          2. Mann-Whitney U vs. Kolmogorov-Smirnov
                        </h4>
                        <p>
                          While Mann-Whitney tests location shift (median dominance), the two-sample Kolmogorov-Smirnov test simultaneously assesses the entire geometric CDF shape—including variance, skewness, and extreme tails. If U is significant but K-S is not, location differs while distribution shape remains similar.
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
                        <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-600" />
                          3. Effect Size: Cliff&apos;s δ and Cohen&apos;s d
                        </h4>
                        <p>
                          In large bibliometric corpora (n &gt; 1,000), even minuscule differences yield tiny p-values. Reporting standardized effect sizes is mandatory: Cliff&apos;s delta provides a non-parametric metric (|δ| &lt; 0.147 negligible, &lt; 0.33 small, &lt; 0.474 medium, &ge; 0.474 large) that is independent of sample size.
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
                        <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                          4. Odds Ratios (OR) in Collaboration &amp; Elite Papers
                        </h4>
                        <p>
                          Odds ratios in 2x2 contingency tables quantify how much higher the odds of international collaboration or producing top-decile cited papers are in one corpus versus another, paired with 95% confidence intervals.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ready-to-Paste LaTeX Code Block */}
                  <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs font-bold text-slate-200">
                          Publication-Ready LaTeX Code
                        </span>
                      </div>
                      <button
                        onClick={handleCopyLatex}
                        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                      >
                        {copiedLatex ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedLatex ? "Copied" : "Copy LaTeX Code"}
                      </button>
                    </div>

                    <pre className="mt-4 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed max-h-64 p-2 bg-slate-950/70 rounded-lg">
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
              {/* Overlap Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Jaccard Vocabulary Overlap
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-900">
                    {thematics.jaccardSimilarity}%
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-medium">
                    |A ∩ B| / |A ∪ B| intersection
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Salton Cosine Similarity
                  </div>
                  <div className="mt-1 text-2xl font-black text-indigo-600">
                    {thematics.cosineSimilarity}%
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-medium">
                    Vector angle of term frequencies
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Shared Concept Nodes
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-900">
                    {thematics.sharedKeywordsCount} Keywords
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-600 font-semibold">
                    Interdisciplinary Bridges
                  </div>
                </div>
              </div>

              {/* Distinctive Keywords (Log-Odds Ratio Specificity) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Corpus A Distinctive Terms */}
                <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    <h3 className="text-sm font-black text-slate-900">
                      Distinctive Signatures in {pA?.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Keywords exhibiting the highest log-odds specificity over Corpus B (Biblium Relative Advantage)
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {thematics.distinctiveKeywordsA.map((kw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-indigo-50 bg-indigo-50/40 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-indigo-950 capitalize">{kw.keyword}</span>
                          <span className="ml-2 text-[10px] text-indigo-500 font-mono">
                            (A: {kw.freqA} vs B: {kw.freqB})
                          </span>
                        </div>
                        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-mono font-black text-white">
                          {kw.specificity}x Specific
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Corpus B Distinctive Terms */}
                <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-emerald-100 pb-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900">
                      Distinctive Signatures in {pB?.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Keywords exhibiting the highest log-odds specificity over Corpus A
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {thematics.distinctiveKeywordsB.map((kw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-emerald-50 bg-emerald-50/40 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-emerald-950 capitalize">{kw.keyword}</span>
                          <span className="ml-2 text-[10px] text-emerald-500 font-mono">
                            (B: {kw.freqB} vs A: {kw.freqA})
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-mono font-black text-white">
                          {kw.specificity}x Specific
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shared Bridge Keywords */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-black text-slate-900">
                  Shared Interdisciplinary Bridging Concepts
                </h3>
                <p className="text-xs text-slate-500">
                  Keywords appearing robustly across both scientific corpora, representing common methodological foundations
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {thematics.sharedBridgeKeywords.map((kw, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                    >
                      <span className="font-bold text-slate-800 capitalize">{kw.keyword}</span>
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                        A: {kw.freqA} | B: {kw.freqB}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Yearly Trends & Growth */}
          {activeTab === "trends" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900">
                    Annual Publication & Citation Trajectories
                  </h3>
                  <p className="text-xs text-slate-500">
                    Year-by-year document volumes and average citations for both research collections
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-4">Publication Year</th>
                        <th className="py-2.5 px-4 text-indigo-700 font-bold">Docs A ({pA?.name})</th>
                        <th className="py-2.5 px-4 text-emerald-700 font-bold">Docs B ({pB?.name})</th>
                        <th className="py-2.5 px-4 text-right">Mean Cites A</th>
                        <th className="py-2.5 px-4 text-right">Mean Cites B</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.yearlyTrends.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{t.year}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-indigo-700">
                            {t.docsA} papers
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">
                            {t.docsB} papers
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {t.citesA} cites/doc
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {t.citesB} cites/doc
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
