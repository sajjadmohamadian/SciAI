import { BibliometricDocument } from "../src/types.js";
import { splitAuthors, splitKeywords, extractCountry } from "./scientometrics.js";

export interface CorpusProfile {
  name: string;
  totalDocs: number;
  totalCitations: number;
  meanCitations: number;
  medianCitations: number;
  hIndex: number;
  gIndex: number;
  uncitedRate: number; // percentage of papers with 0 citations
  top10PctCitations: number; // citations threshold for top 10%
  meanAuthorsPerPaper: number;
  mcpRatio: number; // multi-country publication percentage
  uniqueVenues: number;
  bradfordCoreCount: number;
  bradfordK: number;
  uniqueKeywords: number;
  timespan: string;
  cagr: number; // Compound Annual Growth Rate
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
    a11: number; // e.g. MCP A
    a12: number; // e.g. SCP A
    a21: number; // e.g. MCP B
    a22: number; // e.g. SCP B
  };
  chi2: number;
  chi2Yates: number;
  pValue: number;
  significant: boolean;
  oddsRatio: number;
  oddsRatioCi95: [number, number];
  interpretation: string;
}

export interface StatisticalComparison {
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
    maxDLocation: number; // citation value where max D occurs
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

export interface ThematicBenchmarking {
  jaccardSimilarity: number;
  cosineSimilarity: number;
  sharedKeywordsCount: number;
  distinctiveKeywordsA: Array<{ keyword: string; freqA: number; freqB: number; specificity: number }>;
  distinctiveKeywordsB: Array<{ keyword: string; freqA: number; freqB: number; specificity: number }>;
  sharedBridgeKeywords: Array<{ keyword: string; freqA: number; freqB: number; balance: number }>;
}

export interface RadarDimension {
  dimension: string;
  scoreA: number; // 0 - 100
  scoreB: number; // 0 - 100
  metricLabelA: string;
  metricLabelB: string;
}

export interface BenchmarkReport {
  corpusA: CorpusProfile;
  corpusB: CorpusProfile;
  statistics: StatisticalComparison;
  thematics: ThematicBenchmarking;
  radarScores: RadarDimension[];
  yearlyTrends: Array<{
    year: number;
    docsA: number;
    docsB: number;
    citesA: number;
    citesB: number;
  }>;
  executiveSummary: string;
}

// -------------------------------------------------------------
// Biblium Comparative Benchmarking Engine
// -------------------------------------------------------------
export class BibliumBenchmarkingEngine {
  docsA: BibliometricDocument[];
  docsB: BibliometricDocument[];
  nameA: string;
  nameB: string;

  constructor(
    docsA: BibliometricDocument[],
    docsB: BibliometricDocument[],
    nameA: string = "Corpus A",
    nameB: string = "Corpus B"
  ) {
    this.docsA = docsA;
    this.docsB = docsB;
    this.nameA = nameA;
    this.nameB = nameB;
  }

  // Generate complete comparative benchmark
  runBenchmark(): BenchmarkReport {
    const profileA = this.computeProfile(this.docsA, this.nameA);
    const profileB = this.computeProfile(this.docsB, this.nameB);

    const stats = this.computeStatisticalTests();
    const thematics = this.computeThematicComparison();
    const radar = this.computeRadarDimensions(profileA, profileB);
    const trends = this.computeYearlyTrends();

    const executive = this.generateExecutiveSummary(profileA, profileB, stats);

    return {
      corpusA: profileA,
      corpusB: profileB,
      statistics: stats,
      thematics,
      radarScores: radar,
      yearlyTrends: trends,
      executiveSummary: executive,
    };
  }

  // 1. Compute Individual Corpus Scientometric Profile
  private computeProfile(docs: BibliometricDocument[], name: string): CorpusProfile {
    const n = Math.max(1, docs.length);
    const citationsList = docs.map((d) => Number(d.citations) || 0).sort((a, b) => b - a);
    const totalCitations = citationsList.reduce((a, b) => a + b, 0);
    const meanCitations = Number((totalCitations / n).toFixed(2));

    // Median citations
    const mid = Math.floor(citationsList.length / 2);
    const medianCitations = citationsList.length % 2 !== 0
      ? citationsList[mid] || 0
      : Number((((citationsList[mid - 1] || 0) + (citationsList[mid] || 0)) / 2).toFixed(1));

    // h-index
    let hIndex = 0;
    for (let i = 0; i < citationsList.length; i++) {
      if (citationsList[i] >= i + 1) {
        hIndex = i + 1;
      } else {
        break;
      }
    }

    // g-index: largest g such that sum of top g citations >= g^2
    let gIndex = 0;
    let cumCites = 0;
    for (let i = 0; i < citationsList.length; i++) {
      cumCites += citationsList[i];
      if (cumCites >= (i + 1) * (i + 1)) {
        gIndex = i + 1;
      }
    }

    // Uncited rate (papers with 0 citations)
    const uncitedCount = citationsList.filter((c) => c === 0).length;
    const uncitedRate = Number(((uncitedCount / n) * 100).toFixed(1));

    // Top 10% threshold
    const top10Idx = Math.max(0, Math.floor(n * 0.1) - 1);
    const top10PctCitations = citationsList[top10Idx] || citationsList[0] || 0;

    // Authors per paper
    let totalAuthors = 0;
    let internationalDocs = 0;
    docs.forEach((d) => {
      const authors = d.authors && d.authors.length > 0 ? d.authors : [];
      totalAuthors += authors.length || 1;

      const country = (d.country || "").toLowerCase();
      if (country.includes("international") || authors.length >= 4) {
        internationalDocs++;
      }
    });
    const meanAuthorsPerPaper = Number((totalAuthors / n).toFixed(2));
    const mcpRatio = Number(((internationalDocs / n) * 100).toFixed(1));

    // Venues & Bradford
    const venueCounts: Record<string, number> = {};
    docs.forEach((d) => {
      const v = (d.source || d.SO || "Unknown").trim();
      venueCounts[v] = (venueCounts[v] || 0) + 1;
    });
    const sortedVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]);
    const uniqueVenues = sortedVenues.length;

    // Bradford Zone 1 (Core = ~33.3% of docs)
    const oneThird = n / 3;
    let bradfordCoreCount = 0;
    let runningDocs = 0;
    for (const [, cnt] of sortedVenues) {
      runningDocs += cnt;
      bradfordCoreCount++;
      if (runningDocs >= oneThird) break;
    }
    const bradfordK = Number((Math.max(1, uniqueVenues / Math.max(1, bradfordCoreCount * 2))).toFixed(2));

    // Keywords
    const keywordSet = new Set<string>();
    docs.forEach((d) => {
      const kws: string[] = d.keywords && d.keywords.length > 0
        ? d.keywords
        : (Array.isArray(d.DE) ? d.DE : (typeof d.DE === "string" ? splitKeywords(d.DE) : []));
      kws.forEach((k) => keywordSet.add(k.toLowerCase().trim()));
    });

    // Timespan & CAGR
    const years = docs.map((d) => Number(d.year) || 2020).filter((y) => y > 1900 && y <= 2030);
    const minYear = years.length ? Math.min(...years) : 2020;
    const maxYear = years.length ? Math.max(...years) : 2024;
    const timespan = `${minYear}–${maxYear}`;

    const startDocs = docs.filter((d) => (d.year || minYear) === minYear).length || 1;
    const endDocs = docs.filter((d) => (d.year || maxYear) === maxYear).length || 1;
    const yearSpan = Math.max(1, maxYear - minYear);
    const cagr = Number(((Math.pow(endDocs / startDocs, 1 / yearSpan) - 1) * 100).toFixed(1));

    return {
      name,
      totalDocs: docs.length,
      totalCitations,
      meanCitations,
      medianCitations,
      hIndex,
      gIndex,
      uncitedRate,
      top10PctCitations,
      meanAuthorsPerPaper,
      mcpRatio,
      uniqueVenues,
      bradfordCoreCount,
      bradfordK,
      uniqueKeywords: keywordSet.size,
      timespan,
      cagr: isNaN(cagr) ? 0 : cagr,
    };
  }

  // Helper to compute five-number summary and moment-based distribution metrics
  private computeDistribution(vals: number[]): DistributionMetrics {
    const n = Math.max(1, vals.length);
    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0] || 0;
    const max = sorted[sorted.length - 1] || 0;

    const getPercentile = (p: number) => {
      const idx = (sorted.length - 1) * p;
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      const weight = idx - lower;
      return Number(((sorted[lower] || 0) * (1 - weight) + (sorted[upper] || 0) * weight).toFixed(1));
    };

    const q25 = getPercentile(0.25);
    const median = getPercentile(0.5);
    const q75 = getPercentile(0.75);
    const iqr = Number((q75 - q25).toFixed(1));

    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = Number((sum / n).toFixed(2));

    const sumSqDiff = sorted.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const variance = n > 1 ? Number((sumSqDiff / (n - 1)).toFixed(2)) : 0;
    const stdDev = Number(Math.sqrt(variance).toFixed(2));
    const standardError = Number((stdDev / Math.sqrt(n)).toFixed(2));

    // Fisher-Pearson coefficient of skewness
    let skewness = 0;
    if (n > 2 && stdDev > 0) {
      const m3 = sorted.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / n;
      skewness = Number((m3 / Math.pow(stdDev, 3)).toFixed(3));
    }

    return {
      min,
      q25,
      median,
      q75,
      iqr,
      max,
      mean,
      stdDev,
      variance,
      standardError,
      skewness,
    };
  }

  // 2. Compute Non-Parametric, Parametric & Resampling Statistical Tests
  private computeStatisticalTests(): StatisticalComparison {
    const citesA = this.docsA.map((d) => Number(d.citations) || 0);
    const citesB = this.docsB.map((d) => Number(d.citations) || 0);
    const nA = Math.max(1, citesA.length);
    const nB = Math.max(1, citesB.length);

    const distA = this.computeDistribution(citesA);
    const distB = this.computeDistribution(citesB);

    // --- 1. Mann-Whitney U Test (Wilcoxon Rank-Sum) ---
    const combined: Array<{ val: number; group: "A" | "B" }> = [
      ...citesA.map((v) => ({ val: v, group: "A" as const })),
      ...citesB.map((v) => ({ val: v, group: "B" as const })),
    ].sort((a, b) => a.val - b.val);

    let rankSumA = 0;
    for (let i = 0; i < combined.length; i++) {
      const rank = i + 1;
      if (combined[i].group === "A") {
        rankSumA += rank;
      }
    }

    const uA = rankSumA - (nA * (nA + 1)) / 2;
    const uB = nA * nB - uA;
    const uStat = Math.min(uA, uB);

    // Normal approximation for Z
    const meanU = (nA * nB) / 2;
    const sigmaU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12) || 1;
    const zScore = Number(((uStat - meanU) / sigmaU).toFixed(3));

    // Approximate two-tailed p-value from standard normal
    const absZ = Math.abs(zScore);
    const tZ = 1.0 / (1.0 + 0.2316419 * absZ);
    const polyZ = tZ * (0.31938153 + tZ * (-0.356563782 + tZ * (1.781477937 + tZ * (-1.821255978 + tZ * 1.330274429))));
    const normalCdf = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * absZ * absZ) * polyZ;
    const pValU = Number(Math.max(0.0001, 2 * (1.0 - normalCdf)).toFixed(4));

    // Cliff's Delta: d = (2 * uA) / (nA * nB) - 1
    const cliffsDelta = Number(((2 * uA) / (nA * nB) - 1).toFixed(3));
    let effectSize: "Negligible" | "Small" | "Medium" | "Large" = "Negligible";
    const absDelta = Math.abs(cliffsDelta);
    if (absDelta >= 0.474) effectSize = "Large";
    else if (absDelta >= 0.33) effectSize = "Medium";
    else if (absDelta >= 0.147) effectSize = "Small";

    // Rank-biserial correlation
    const rankBiserial = Number((1 - (2 * uStat) / (nA * nB)).toFixed(3));

    // --- 2. Two-Sample Kolmogorov-Smirnov Test (K-S) & ECDF Curve ---
    const allValues = Array.from(new Set([...citesA, ...citesB])).sort((a, b) => a - b);
    let maxD = 0;
    let maxDVal = 0;
    const ecdfPoints: EcdfPoint[] = [];

    // Sample up to 50 representative threshold points for clean plotting
    const stepInterval = Math.max(1, Math.floor(allValues.length / 50));
    for (let i = 0; i < allValues.length; i++) {
      const val = allValues[i];
      const cdfA = Number((citesA.filter((v) => v <= val).length / nA).toFixed(3));
      const cdfB = Number((citesB.filter((v) => v <= val).length / nB).toFixed(3));
      const diff = Number(Math.abs(cdfA - cdfB).toFixed(3));
      if (diff > maxD) {
        maxD = diff;
        maxDVal = val;
      }
      if (i % stepInterval === 0 || i === allValues.length - 1) {
        ecdfPoints.push({
          value: val,
          cdfA,
          cdfB,
          difference: diff,
          isMaxD: false,
        });
      }
    }

    // Mark point closest to maxD
    ecdfPoints.forEach((pt) => {
      if (pt.value === maxDVal) pt.isMaxD = true;
    });

    const dStat = Number(maxD.toFixed(3));
    const ksCrit = Number((1.36 * Math.sqrt((nA + nB) / (nA * nB))).toFixed(3));
    const ksSignificant = dStat > ksCrit;

    // Asymptotic K-S p-value approximation
    const nEff = (nA * nB) / (nA + nB);
    const lambdaKS = (Math.sqrt(nEff) + 0.12 + 0.11 / Math.sqrt(nEff)) * dStat;
    let ksPVal = 1.0;
    if (lambdaKS > 0) {
      let sumKS = 0;
      for (let k = 1; k <= 5; k++) {
        sumKS += Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambdaKS * lambdaKS);
      }
      ksPVal = Math.min(1, Math.max(0.0001, Number((2 * sumKS).toFixed(4))));
    }

    // --- 3. Welch's Two-Sample t-Test (Unequal Variances) ---
    const meanDiff = Number((distA.mean - distB.mean).toFixed(2));
    const seA = Math.pow(distA.stdDev, 2) / nA;
    const seB = Math.pow(distB.stdDev, 2) / nB;
    const seDiff = Math.sqrt(seA + seB) || 0.001;
    const tStat = Number((meanDiff / seDiff).toFixed(3));

    // Welch–Satterthwaite degrees of freedom
    const numDf = Math.pow(seA + seB, 2);
    const denDf = (nA > 1 ? Math.pow(seA, 2) / (nA - 1) : 0) + (nB > 1 ? Math.pow(seB, 2) / (nB - 1) : 0);
    const dfWelch = Math.max(1, Math.round(denDf > 0 ? numDf / denDf : 1));

    // Approximate p-value for Student t with dfWelch
    const absT = Math.abs(tStat);
    const wT = absT * (1 - 1 / (4 * dfWelch)) / Math.sqrt(1 + (absT * absT) / (2 * dfWelch));
    const tNormal = 1.0 / (1.0 + 0.2316419 * wT);
    const polyT = tNormal * (0.31938153 + tNormal * (-0.356563782 + tNormal * (1.781477937 + tNormal * (-1.821255978 + tNormal * 1.330274429))));
    const pValT = Number(Math.max(0.0001, 2 * (1.0 - (1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * wT * wT) * polyT))).toFixed(4));

    // Cohen's d: (meanA - meanB) / s_pooled
    const pooledStd = Math.sqrt(((nA - 1) * distA.variance + (nB - 1) * distB.variance) / Math.max(1, nA + nB - 2)) || 1;
    const cohensD = Number((meanDiff / pooledStd).toFixed(3));
    let tEffectSize: "Negligible" | "Small" | "Medium" | "Large" = "Negligible";
    const absD = Math.abs(cohensD);
    if (absD >= 0.8) tEffectSize = "Large";
    else if (absD >= 0.5) tEffectSize = "Medium";
    else if (absD >= 0.2) tEffectSize = "Small";

    // 95% Confidence Interval for mean difference
    const tCritApprox = 1.96 + 2.37 / dfWelch;
    const ciLow = Number((meanDiff - tCritApprox * seDiff).toFixed(2));
    const ciHigh = Number((meanDiff + tCritApprox * seDiff).toFixed(2));

    // --- 4. Monte Carlo Permutation & Bootstrap Resampling (1,000 resamples) ---
    const allCitesCombined = [...citesA, ...citesB];
    const nCombined = allCitesCombined.length;
    let permGreaterCount = 0;
    const permReps = 1000;
    const bootstrapDiffs: number[] = [];

    // Deterministic pseudo-random seed generator for reproducible resampling
    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let r = 0; r < permReps; r++) {
      // 1. Shuffling for permutation
      let sumPermA = 0;
      for (let i = 0; i < nA; i++) {
        const randIdx = Math.floor(pseudoRandom() * nCombined);
        sumPermA += allCitesCombined[randIdx] || 0;
      }
      const meanPermA = sumPermA / nA;
      const meanPermB = (distA.mean * nA + distB.mean * nB - sumPermA) / nB;
      if (Math.abs(meanPermA - meanPermB) >= Math.abs(meanDiff)) {
        permGreaterCount++;
      }

      // 2. Bootstrap resample with replacement for CI
      let sumBootA = 0;
      for (let i = 0; i < nA; i++) {
        sumBootA += citesA[Math.floor(pseudoRandom() * nA)] || 0;
      }
      let sumBootB = 0;
      for (let i = 0; i < nB; i++) {
        sumBootB += citesB[Math.floor(pseudoRandom() * nB)] || 0;
      }
      bootstrapDiffs.push(sumBootA / nA - sumBootB / nB);
    }

    const permPVal = Number(Math.max(0.001, permGreaterCount / permReps).toFixed(4));
    bootstrapDiffs.sort((a, b) => a - b);
    const bootCiLow = Number((bootstrapDiffs[Math.floor(permReps * 0.025)] || ciLow).toFixed(2));
    const bootCiHigh = Number((bootstrapDiffs[Math.floor(permReps * 0.975)] || ciHigh).toFixed(2));

    // --- 5. Chi-Square Contingency Tables ---
    // Helper function for 2x2 contingency analysis
    const analyzeContingency2x2 = (
      name: string,
      r1: string,
      r2: string,
      c1: string,
      c2: string,
      a11: number,
      a12: number,
      a21: number,
      a22: number
    ): Contingency2x2 => {
      const row1Total = a11 + a12;
      const row2Total = a21 + a22;
      const col1Total = a11 + a21;
      const col2Total = a12 + a22;
      const total = row1Total + row2Total;

      const exp11 = (row1Total * col1Total) / (total || 1);
      const exp12 = (row1Total * col2Total) / (total || 1);
      const exp21 = (row2Total * col1Total) / (total || 1);
      const exp22 = (row2Total * col2Total) / (total || 1);

      const chi2 = Number((
        Math.pow(a11 - exp11, 2) / (exp11 || 1) +
        Math.pow(a12 - exp12, 2) / (exp12 || 1) +
        Math.pow(a21 - exp21, 2) / (exp21 || 1) +
        Math.pow(a22 - exp22, 2) / (exp22 || 1)
      ).toFixed(3));

      // Yates continuity-corrected chi-square
      const chi2Yates = Number((
        Math.pow(Math.max(0, Math.abs(a11 - exp11) - 0.5), 2) / (exp11 || 1) +
        Math.pow(Math.max(0, Math.abs(a12 - exp12) - 0.5), 2) / (exp12 || 1) +
        Math.pow(Math.max(0, Math.abs(a21 - exp21) - 0.5), 2) / (exp21 || 1) +
        Math.pow(Math.max(0, Math.abs(a22 - exp22) - 0.5), 2) / (exp22 || 1)
      ).toFixed(3));

      // For df=1, p-value from chi2
      const zFromChi = Math.sqrt(chi2);
      const tChi = 1.0 / (1.0 + 0.2316419 * zFromChi);
      const polyChi = tChi * (0.31938153 + tChi * (-0.356563782 + tChi * (1.781477937 + tChi * (-1.821255978 + tChi * 1.330274429))));
      const pVal = Number(Math.max(0.0001, 2 * (1.0 - (1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * chi2) * polyChi))).toFixed(4));

      const significant = chi2 > 3.841; // alpha=0.05
      const oddsA = a11 / Math.max(1, a12);
      const oddsB = a21 / Math.max(1, a22);
      const oddsRatio = Number((oddsA / Math.max(0.01, oddsB)).toFixed(2));

      // 95% Confidence interval for Odds Ratio: exp(ln(OR) +/- 1.96 * sqrt(1/a + 1/b + 1/c + 1/d))
      const seLnOr = Math.sqrt(1 / Math.max(1, a11) + 1 / Math.max(1, a12) + 1 / Math.max(1, a21) + 1 / Math.max(1, a22));
      const lnOr = Math.log(Math.max(0.01, oddsRatio));
      const orCiLow = Number(Math.exp(lnOr - 1.96 * seLnOr).toFixed(2));
      const orCiHigh = Number(Math.exp(lnOr + 1.96 * seLnOr).toFixed(2));

      return {
        name,
        table: {
          row1Label: r1,
          row2Label: r2,
          col1Label: c1,
          col2Label: c2,
          a11,
          a12,
          a21,
          a22,
        },
        chi2,
        chi2Yates,
        pValue: pVal,
        significant,
        oddsRatio,
        oddsRatioCi95: [orCiLow, orCiHigh],
        interpretation: significant
          ? `Statistically significant association detected (χ² = ${chi2}, p = ${pVal}, Odds Ratio = ${oddsRatio} [95% CI: ${orCiLow}–${orCiHigh}]).`
          : `No statistically significant association observed (χ² = ${chi2}, p = ${pVal}).`,
      };
    };

    // 5a. Collaboration Contingency (MCP vs SCP)
    const mcpA = this.docsA.filter((d) => (d.country || "").toLowerCase().includes("international") || (d.authors?.length || 0) >= 4).length;
    const scpA = nA - mcpA;
    const mcpB = this.docsB.filter((d) => (d.country || "").toLowerCase().includes("international") || (d.authors?.length || 0) >= 4).length;
    const scpB = nB - mcpB;

    const chiCollab = analyzeContingency2x2(
      "International Collaboration (MCP vs SCP)",
      this.nameA,
      this.nameB,
      "Multi-Country (MCP)",
      "Single-Country (SCP)",
      mcpA,
      scpA,
      mcpB,
      scpB
    );

    // 5b. Elite High-Impact Representation (Top 10% highly cited papers in combined corpus)
    const combinedSorted = [...allCitesCombined].sort((a, b) => b - a);
    const eliteCutoffIdx = Math.max(0, Math.floor(combinedSorted.length * 0.1) - 1);
    const eliteCutoff = combinedSorted[eliteCutoffIdx] || 100;

    const eliteA = citesA.filter((c) => c >= eliteCutoff).length;
    const standardA = nA - eliteA;
    const eliteB = citesB.filter((c) => c >= eliteCutoff).length;
    const standardB = nB - eliteB;

    const chiElite = analyzeContingency2x2(
      "Elite Paper Representation (Top 10% Combined Citations)",
      this.nameA,
      this.nameB,
      `Top 10% (≥${eliteCutoff} cites)`,
      `Standard (<${eliteCutoff} cites)`,
      eliteA,
      standardA,
      eliteB,
      standardB
    );

    return {
      mannWhitneyU: {
        uStatistic: Math.round(uStat),
        uA: Math.round(uA),
        uB: Math.round(uB),
        zScore,
        pValue: pValU,
        significant: pValU < 0.05,
        cliffsDelta,
        rankBiserial,
        effectSize,
        interpretation: pValU < 0.05
          ? `Statistically significant difference in citation distributions (p = ${pValU}, Cliff's δ = ${cliffsDelta} [${effectSize} effect size]).`
          : `No statistically significant difference in citation distributions (p = ${pValU}, Cliff's δ = ${cliffsDelta}).`,
        interpretationFa: pValU < 0.05
          ? `Statistically significant difference in citation distributions confirmed (p = ${pValU}, Cliff's δ = ${cliffsDelta}, ${effectSize} effect).`
          : `No statistically significant difference in citation distributions observed (p = ${pValU}). Null hypothesis not rejected.`,
      },
      kolmogorovSmirnov: {
        dStatistic: dStat,
        criticalValue: ksCrit,
        pValue: ksPVal,
        significant: ksSignificant,
        maxDLocation: maxDVal,
        interpretation: ksSignificant
          ? `K-S test indicates distinct cumulative citation distributions (D = ${dStat} > D_crit ${ksCrit}, p = ${ksPVal}), maximal divergence occurs at ${maxDVal} citations.`
          : `K-S test shows cumulative citation curves follow statistically equivalent shapes (D = ${dStat} ≤ D_crit ${ksCrit}, p = ${ksPVal}).`,
        interpretationFa: ksSignificant
          ? `Kolmogorov-Smirnov test indicates empirical cumulative distribution functions (ECDF) diverge significantly (D = ${dStat}, max divergence at ${maxDVal} citations).`
          : `Empirical cumulative distribution functions of citations are statistically equivalent (D = ${dStat}).`,
      },
      welchTTest: {
        tStatistic: tStat,
        degreesOfFreedom: dfWelch,
        pValue: pValT,
        significant: pValT < 0.05,
        meanDiff,
        meanDiffCi95: [ciLow, ciHigh],
        cohensD,
        effectSize: tEffectSize,
        interpretation: pValT < 0.05
          ? `Welch's t-test (unequal variances) confirms significant difference in mean citations (t(${dfWelch}) = ${tStat}, p = ${pValT}, Cohen's d = ${cohensD} [${tEffectSize}]).`
          : `Welch's t-test reveals no significant difference in citation means (t(${dfWelch}) = ${tStat}, p = ${pValT}).`,
        interpretationFa: pValT < 0.05
          ? `Welch's t-test (unequal variances) confirms significant difference in citation means (t(${dfWelch}) = ${tStat}, p = ${pValT}, Cohen's d = ${cohensD}).`
          : `Welch's t-test indicates no significant difference in citation means (p = ${pValT}).`,
      },
      permutationTest: {
        observedDiff: meanDiff,
        resamples: permReps,
        pValue: permPVal,
        significant: permPVal < 0.05,
        bootstrapCi95: [bootCiLow, bootCiHigh],
        interpretation: permPVal < 0.05
          ? `Monte Carlo permutation test (1,000 resamples) rejects null hypothesis of exchangeability (p = ${permPVal}, 95% Bootstrap CI: [${bootCiLow}, ${bootCiHigh}]).`
          : `Permutation test indicates observed difference could arise by chance (p = ${permPVal}).`,
        interpretationFa: permPVal < 0.05
          ? `Monte Carlo permutation test (1,000 resamples) rejects random difference in citations (p = ${permPVal}, 95% Bootstrap CI: [${bootCiLow}, ${bootCiHigh}]).`
          : `Permutation test suggests observed difference could be attributed to chance (p = ${permPVal}).`,
      },
      chiSquareCollaboration: chiCollab,
      chiSquareElitePapers: chiElite,
      distributionA: distA,
      distributionB: distB,
      ecdfPoints,
    };
  }

  // 3. Thematic Overlap & Distinctive Signature Keywords (Biblium Log-Odds Specificity)
  private computeThematicComparison(): ThematicBenchmarking {
    const kwFreqA: Record<string, number> = {};
    const kwFreqB: Record<string, number> = {};

    this.docsA.forEach((d) => {
      const kws: string[] = d.keywords && d.keywords.length > 0
        ? d.keywords
        : (Array.isArray(d.DE) ? d.DE : (typeof d.DE === "string" ? splitKeywords(d.DE) : []));
      kws.forEach((k) => {
        const norm = k.toLowerCase().trim();
        if (norm.length > 2) kwFreqA[norm] = (kwFreqA[norm] || 0) + 1;
      });
    });

    this.docsB.forEach((d) => {
      const kws: string[] = d.keywords && d.keywords.length > 0
        ? d.keywords
        : (Array.isArray(d.DE) ? d.DE : (typeof d.DE === "string" ? splitKeywords(d.DE) : []));
      kws.forEach((k) => {
        const norm = k.toLowerCase().trim();
        if (norm.length > 2) kwFreqB[norm] = (kwFreqB[norm] || 0) + 1;
      });
    });

    const setA = new Set(Object.keys(kwFreqA));
    const setB = new Set(Object.keys(kwFreqB));
    const allKeywords = new Set([...setA, ...setB]);

    // Jaccard similarity: |A ∩ B| / |A ∪ B|
    let intersectionCount = 0;
    for (const k of setA) {
      if (setB.has(k)) intersectionCount++;
    }
    const unionCount = allKeywords.size || 1;
    const jaccard = Number(((intersectionCount / unionCount) * 100).toFixed(1));

    // Salton Cosine similarity
    let dot = 0;
    let normASq = 0;
    let normBSq = 0;
    for (const k of allKeywords) {
      const fA = kwFreqA[k] || 0;
      const fB = kwFreqB[k] || 0;
      dot += fA * fB;
      normASq += fA * fA;
      normBSq += fB * fB;
    }
    const cosine = Number(((dot / (Math.sqrt(normASq) * Math.sqrt(normBSq) || 1)) * 100).toFixed(1));

    // Specificity score (Log-Odds Ratio with Laplace smoothing)
    const totalTokensA = Object.values(kwFreqA).reduce((a, b) => a + b, 0) || 1;
    const totalTokensB = Object.values(kwFreqB).reduce((a, b) => a + b, 0) || 1;

    const scoredKeywords = Array.from(allKeywords).map((k) => {
      const fA = kwFreqA[k] || 0;
      const fB = kwFreqB[k] || 0;
      const probA = (fA + 0.5) / (totalTokensA + 1);
      const probB = (fB + 0.5) / (totalTokensB + 1);
      const logOdds = Math.log(probA / probB);
      return { keyword: k, freqA: fA, freqB: fB, logOdds };
    });

    // Top distinctive keywords for Corpus A
    const distinctiveA = scoredKeywords
      .filter((k) => k.freqA >= 2)
      .sort((a, b) => b.logOdds - a.logOdds)
      .slice(0, 6)
      .map((k) => ({
        keyword: k.keyword,
        freqA: k.freqA,
        freqB: k.freqB,
        specificity: Number(Math.max(1.1, Math.exp(k.logOdds)).toFixed(2)),
      }));

    // Top distinctive keywords for Corpus B
    const distinctiveB = scoredKeywords
      .filter((k) => k.freqB >= 2)
      .sort((a, b) => a.logOdds - b.logOdds)
      .slice(0, 6)
      .map((k) => ({
        keyword: k.keyword,
        freqA: k.freqA,
        freqB: k.freqB,
        specificity: Number(Math.max(1.1, Math.exp(-k.logOdds)).toFixed(2)),
      }));

    // Shared Bridge Keywords
    const sharedBridge = scoredKeywords
      .filter((k) => k.freqA >= 2 && k.freqB >= 2)
      .sort((a, b) => (b.freqA + b.freqB) - (a.freqA + a.freqB))
      .slice(0, 6)
      .map((k) => ({
        keyword: k.keyword,
        freqA: k.freqA,
        freqB: k.freqB,
        balance: Number((Math.min(k.freqA, k.freqB) / Math.max(k.freqA, k.freqB)).toFixed(2)),
      }));

    return {
      jaccardSimilarity: jaccard,
      cosineSimilarity: cosine,
      sharedKeywordsCount: intersectionCount,
      distinctiveKeywordsA: distinctiveA,
      distinctiveKeywordsB: distinctiveB,
      sharedBridgeKeywords: sharedBridge,
    };
  }

  // 4. Multi-dimensional Radar Scores (Normalized 0 to 100)
  private computeRadarDimensions(pA: CorpusProfile, pB: CorpusProfile): RadarDimension[] {
    function scale(vA: number, vB: number, higherIsBetter: boolean = true): [number, number] {
      const maxVal = Math.max(0.01, vA, vB);
      if (higherIsBetter) {
        return [
          Math.min(100, Math.round((vA / maxVal) * 95)),
          Math.min(100, Math.round((vB / maxVal) * 95)),
        ];
      } else {
        // Lower is better (e.g. uncitedness rate)
        return [
          Math.min(100, Math.round((1 - vA / maxVal) * 95 + 5)),
          Math.min(100, Math.round((1 - vB / maxVal) * 95 + 5)),
        ];
      }
    }

    const [citesA, citesB] = scale(pA.meanCitations, pB.meanCitations);
    const [hA, hB] = scale(pA.hIndex, pB.hIndex);
    const [mcpA, mcpB] = scale(pA.mcpRatio, pB.mcpRatio);
    const [growthA, growthB] = scale(Math.max(0, pA.cagr), Math.max(0, pB.cagr));
    const [collabA, collabB] = scale(pA.meanAuthorsPerPaper, pB.meanAuthorsPerPaper);
    const [citedA, citedB] = scale(pA.uncitedRate, pB.uncitedRate, false);

    return [
      {
        dimension: "Citation Velocity",
        scoreA: citesA,
        scoreB: citesB,
        metricLabelA: `${pA.meanCitations} cites/doc`,
        metricLabelB: `${pB.meanCitations} cites/doc`,
      },
      {
        dimension: "Corpus H-Index",
        scoreA: hA,
        scoreB: hB,
        metricLabelA: `h = ${pA.hIndex}`,
        metricLabelB: `h = ${pB.hIndex}`,
      },
      {
        dimension: "Internationalization (MCP)",
        scoreA: mcpA,
        scoreB: mcpB,
        metricLabelA: `${pA.mcpRatio}% multi-country`,
        metricLabelB: `${pB.mcpRatio}% multi-country`,
      },
      {
        dimension: "Growth Momentum (CAGR)",
        scoreA: growthA,
        scoreB: growthB,
        metricLabelA: `${pA.cagr}% CAGR`,
        metricLabelB: `${pB.cagr}% CAGR`,
      },
      {
        dimension: "Co-authorship Density",
        scoreA: collabA,
        scoreB: collabB,
        metricLabelA: `${pA.meanAuthorsPerPaper} authors/paper`,
        metricLabelB: `${pB.meanAuthorsPerPaper} authors/paper`,
      },
      {
        dimension: "Citation Coverage (Low Zeroes)",
        scoreA: citedA,
        scoreB: citedB,
        metricLabelA: `${100 - pA.uncitedRate}% cited`,
        metricLabelB: `${100 - pB.uncitedRate}% cited`,
      },
    ];
  }

  // 5. Yearly Trend Evolution Comparison
  private computeYearlyTrends(): Array<{ year: number; docsA: number; docsB: number; citesA: number; citesB: number }> {
    const yearsSet = new Set<number>();
    const countA: Record<number, number> = {};
    const countB: Record<number, number> = {};
    const citesMapA: Record<number, number> = {};
    const citesMapB: Record<number, number> = {};

    this.docsA.forEach((d) => {
      const y = Number(d.year) || 2022;
      yearsSet.add(y);
      countA[y] = (countA[y] || 0) + 1;
      citesMapA[y] = (citesMapA[y] || 0) + (Number(d.citations) || 0);
    });

    this.docsB.forEach((d) => {
      const y = Number(d.year) || 2022;
      yearsSet.add(y);
      countB[y] = (countB[y] || 0) + 1;
      citesMapB[y] = (citesMapB[y] || 0) + (Number(d.citations) || 0);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
    return sortedYears.map((year) => ({
      year,
      docsA: countA[year] || 0,
      docsB: countB[year] || 0,
      citesA: countA[year] ? Math.round((citesMapA[year] || 0) / countA[year]) : 0,
      citesB: countB[year] ? Math.round((citesMapB[year] || 0) / countB[year]) : 0,
    }));
  }

  // 6. Generate Narrative Synthesis
  private generateExecutiveSummary(
    pA: CorpusProfile,
    pB: CorpusProfile,
    stats: StatisticalComparison
  ): string {
    const leadCitation = pA.meanCitations >= pB.meanCitations ? pA.name : pB.name;
    const diffPct = Math.abs(Math.round(((pA.meanCitations - pB.meanCitations) / Math.max(0.1, pB.meanCitations)) * 100));

    return `Comparative benchmarking of **${pA.name}** (N=${pA.totalDocs}) versus **${pB.name}** (N=${pB.totalDocs}) indicates that ${leadCitation} demonstrates a ${diffPct}% citation velocity advantage. ${stats.mannWhitneyU.interpretation} In terms of international collaboration, ${pA.name} displays an MCP ratio of ${pA.mcpRatio}% compared to ${pB.mcpRatio}% in ${pB.name} (${stats.chiSquareCollaboration.interpretation}). Core publishing venues follow distinct Bradford scattering curves (k=${pA.bradfordK} vs k=${pB.bradfordK}), reflecting distinct disciplinary diffusion dynamics.`;
  }
}
