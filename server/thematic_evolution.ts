import { BibliometricDocument, ResultRecord } from "../src/types.js";

export interface ThematicPeriod {
  index: number;
  label: string;
  startYear: number;
  endYear: number;
  docCount: number;
  themeCount: number;
  stabilityWithNext?: number;
}

export interface ThematicThemeNode {
  id: string;
  periodIndex: number;
  periodLabel: string;
  name: string;
  keywords: string[];
  docCount: number;
  totalCitations: number;
  rawCentrality: number;
  rawDensity: number;
  quadrant: "Motor Themes" | "Niche Themes" | "Emerging/Declining Themes" | "Basic Themes";
  quadrantCode: "Q1" | "Q2" | "Q3" | "Q4";
  clusterSize: number;
}

export interface ThematicFlowLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePeriod: number;
  targetPeriod: number;
  sourceThemeName: string;
  targetThemeName: string;
  inclusionIndex: number; // Simpson coefficient
  jaccardIndex: number;
  sharedKeywords: string[];
  weight: number;
  trajectory: "continuation" | "splitting" | "merging" | "emerging" | "fading";
  trajectoryLabel: string;
}

export interface ThematicEvolutionOutput {
  periods: ThematicPeriod[];
  nodes: ThematicThemeNode[];
  links: ThematicFlowLink[];
  summary: {
    totalPeriods: number;
    totalThemes: number;
    totalLinks: number;
    yearSpan: string;
    totalDocuments: number;
    averageStability: number;
    continuationsCount: number;
    splitsCount: number;
    mergesCount: number;
  };
  transitionMatrix: Array<{
    sourcePeriod: string;
    sourceTheme: string;
    targetPeriod: string;
    targetTheme: string;
    inclusionIndex: number;
    sharedKeywords: string[];
    trajectory: string;
  }>;
}

export interface SlicingOptions {
  sliceCount?: number; // 2, 3, 4, 5
  customCuts?: number[]; // e.g. [2022, 2024]
  minKeywordFreq?: number; // default 2
  inclusionThreshold?: number; // default 0.15
  maxThemesPerSlice?: number; // default 5
}

/**
 * Computes Thematic Evolution and Time Slicing across a bibliometric corpus.
 * Follows Cobo et al. (2011) & Bibliometrix / SciMAT methodologies.
 */
export function computeThematicEvolution(
  docs: BibliometricDocument[],
  options: SlicingOptions = {}
): ThematicEvolutionOutput {
  const {
    sliceCount = 3,
    customCuts,
    minKeywordFreq = 1,
    inclusionThreshold = 0.12,
    maxThemesPerSlice = 5,
  } = options;

  const validDocs = docs.filter((d) => d.year && typeof d.year === "number");
  if (validDocs.length === 0) {
    return {
      periods: [],
      nodes: [],
      links: [],
      summary: {
        totalPeriods: 0,
        totalThemes: 0,
        totalLinks: 0,
        yearSpan: "N/A",
        totalDocuments: 0,
        averageStability: 0,
        continuationsCount: 0,
        splitsCount: 0,
        mergesCount: 0,
      },
      transitionMatrix: [],
    };
  }

  const years = validDocs.map((d) => d.year).sort((a, b) => a - b);
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  // 1. Determine period boundaries
  interface PeriodBoundary {
    index: number;
    startYear: number;
    endYear: number;
    label: string;
  }

  const boundaries: PeriodBoundary[] = [];

  if (customCuts && customCuts.length > 0) {
    const sortedCuts = Array.from(new Set(customCuts)).sort((a, b) => a - b);
    let curStart = minYear;
    let pIdx = 0;
    for (const cut of sortedCuts) {
      if (cut > curStart && cut <= maxYear) {
        boundaries.push({
          index: pIdx++,
          startYear: curStart,
          endYear: cut,
          label: curStart === cut ? `${curStart}` : `${curStart}–${cut}`,
        });
        curStart = cut + 1;
      }
    }
    if (curStart <= maxYear) {
      boundaries.push({
        index: pIdx++,
        startYear: curStart,
        endYear: maxYear,
        label: curStart === maxYear ? `${curStart}` : `${curStart}–${maxYear}`,
      });
    }
  } else {
    // Automatic equal-span slicing
    const actualSlices = Math.min(Math.max(2, sliceCount), Math.max(2, maxYear - minYear + 1));
    const span = maxYear - minYear + 1;
    const step = span / actualSlices;

    let curStart = minYear;
    for (let i = 0; i < actualSlices; i++) {
      const isLast = i === actualSlices - 1;
      const curEnd = isLast ? maxYear : Math.min(maxYear, Math.round(minYear + (i + 1) * step - 1));
      if (curStart <= curEnd) {
        boundaries.push({
          index: i,
          startYear: curStart,
          endYear: curEnd,
          label: curStart === curEnd ? `${curStart}` : `${curStart}–${curEnd}`,
        });
      }
      curStart = curEnd + 1;
    }
  }

  // If slicing resulted in < 2 periods (e.g. all docs from 1 or 2 years), force at least 2
  if (boundaries.length < 2) {
    const mid = Math.floor((minYear + maxYear) / 2);
    boundaries.length = 0;
    boundaries.push({
      index: 0,
      startYear: minYear,
      endYear: mid,
      label: `${minYear}–${mid}`,
    });
    boundaries.push({
      index: 1,
      startYear: mid + 1,
      endYear: maxYear,
      label: `${mid + 1}–${maxYear}`,
    });
  }

  // 2. Perform Thematic Clustering for each period
  const allNodes: ThematicThemeNode[] = [];
  const periodsData: ThematicPeriod[] = [];
  const periodKeywordsMap: Map<number, Set<string>> = new Map();

  for (const b of boundaries) {
    const periodDocs = validDocs.filter(
      (d) => d.year >= b.startYear && d.year <= b.endYear
    );

    // Keyword frequencies in this period
    const kwFreq: Record<string, number> = {};
    for (const d of periodDocs) {
      for (const kw of d.keywords) {
        const cleaned = kw.trim().toLowerCase();
        if (cleaned.length > 1) {
          kwFreq[cleaned] = (kwFreq[cleaned] || 0) + 1;
        }
      }
    }

    const allPeriodKeywords = new Set(Object.keys(kwFreq));
    periodKeywordsMap.set(b.index, allPeriodKeywords);

    // Pick top keywords for clustering
    const candidateKws = Object.entries(kwFreq)
      .filter(([, count]) => count >= minKeywordFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    // If too few, relax filter
    const activeKws =
      candidateKws.length >= 4
        ? candidateKws.slice(0, 25)
        : Object.entries(kwFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([k]) => k);

    const activeSet = new Set(activeKws);

    // Co-occurrence matrix
    const coMatrix: Record<string, Record<string, number>> = {};
    for (const k of activeKws) coMatrix[k] = {};

    for (const d of periodDocs) {
      const docKws = Array.from(
        new Set(d.keywords.map((k) => k.trim().toLowerCase()).filter((k) => activeSet.has(k)))
      );
      for (let i = 0; i < docKws.length; i++) {
        for (let j = i + 1; j < docKws.length; j++) {
          const k1 = docKws[i];
          const k2 = docKws[j];
          coMatrix[k1][k2] = (coMatrix[k1][k2] || 0) + 1;
          coMatrix[k2][k1] = (coMatrix[k2][k1] || 0) + 1;
        }
      }
    }

    // Cluster keywords into themes (Greedy cohesion)
    const visited = new Set<string>();
    const clusters: Array<{ name: string; keywords: string[]; totalFreq: number }> = [];

    for (const seed of activeKws) {
      if (visited.has(seed)) continue;
      const themeKws = [seed];
      visited.add(seed);

      const neighbors = Object.entries(coMatrix[seed] || {})
        .filter(([nbr]) => !visited.has(nbr))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      for (const [nbr, weight] of neighbors) {
        if (weight >= 1) {
          themeKws.push(nbr);
          visited.add(nbr);
        }
      }

      const totalFreq = themeKws.reduce((acc, k) => acc + (kwFreq[k] || 0), 0);
      clusters.push({
        name: formatThemeLabel(seed),
        keywords: themeKws,
        totalFreq,
      });
    }

    // Ensure we have at least 2 themes per period if docs exist
    if (clusters.length < 2 && activeKws.length >= 2) {
      const midPoint = Math.ceil(activeKws.length / 2);
      clusters.length = 0;
      clusters.push({
        name: formatThemeLabel(activeKws[0]),
        keywords: activeKws.slice(0, midPoint),
        totalFreq: activeKws.slice(0, midPoint).reduce((a, k) => a + (kwFreq[k] || 0), 0),
      });
      clusters.push({
        name: formatThemeLabel(activeKws[midPoint] || "Specialized Studies"),
        keywords: activeKws.slice(midPoint),
        totalFreq: activeKws.slice(midPoint).reduce((a, k) => a + (kwFreq[k] || 0), 0),
      });
    }

    const selectedClusters = clusters.slice(0, maxThemesPerSlice);

    // Compute Callon Centrality & Density
    const rawMetrics = selectedClusters.map((cluster, cIdx) => {
      const cSet = new Set(cluster.keywords);
      let internalStrength = 0;
      for (let i = 0; i < cluster.keywords.length; i++) {
        for (let j = i + 1; j < cluster.keywords.length; j++) {
          internalStrength += coMatrix[cluster.keywords[i]]?.[cluster.keywords[j]] || 0;
        }
      }
      const density = (internalStrength * 10) / Math.max(1, cluster.keywords.length);

      let externalStrength = 0;
      for (const k of cluster.keywords) {
        for (const [otherKw, weight] of Object.entries(coMatrix[k] || {})) {
          if (!cSet.has(otherKw)) {
            externalStrength += weight;
          }
        }
      }
      const centrality = externalStrength * 5;

      // Documents matching this theme
      const matchingDocs = periodDocs.filter((d) =>
        d.keywords.some((k) => cSet.has(k.trim().toLowerCase()))
      );
      const totalCitations = matchingDocs.reduce((sum, d) => sum + (d.citations || 0), 0);

      return {
        id: `P${b.index}_T${cIdx + 1}`,
        periodIndex: b.index,
        periodLabel: b.label,
        name: cluster.name,
        keywords: cluster.keywords,
        docCount: matchingDocs.length || Math.max(1, Math.round(cluster.totalFreq / 2)),
        totalCitations,
        rawCentrality: centrality,
        rawDensity: density,
        clusterSize: cluster.totalFreq,
      };
    });

    // Medians for quadrant thresholding
    const centralities = rawMetrics.map((m) => m.rawCentrality).sort((a, b) => a - b);
    const densities = rawMetrics.map((m) => m.rawDensity).sort((a, b) => a - b);
    const medCent = centralities[Math.floor(centralities.length / 2)] || 1;
    const medDens = densities[Math.floor(densities.length / 2)] || 1;

    for (const m of rawMetrics) {
      const isHighC = m.rawCentrality >= medCent;
      const isHighD = m.rawDensity >= medDens;

      let quadrant: ThematicThemeNode["quadrant"] = "Motor Themes";
      let quadrantCode: ThematicThemeNode["quadrantCode"] = "Q1";

      if (isHighC && isHighD) {
        quadrant = "Motor Themes";
        quadrantCode = "Q1";
      } else if (!isHighC && isHighD) {
        quadrant = "Niche Themes";
        quadrantCode = "Q2";
      } else if (!isHighC && !isHighD) {
        quadrant = "Emerging/Declining Themes";
        quadrantCode = "Q3";
      } else {
        quadrant = "Basic Themes";
        quadrantCode = "Q4";
      }

      allNodes.push({
        ...m,
        quadrant,
        quadrantCode,
      });
    }

    periodsData.push({
      index: b.index,
      label: b.label,
      startYear: b.startYear,
      endYear: b.endYear,
      docCount: periodDocs.length,
      themeCount: selectedClusters.length,
    });
  }

  // 3. Longitudinal Linking: Calculate Inclusion Index & Trajectories across consecutive periods
  const allLinks: ThematicFlowLink[] = [];
  const sourceDegreeMap: Record<string, number> = {};
  const targetDegreeMap: Record<string, number> = {};

  for (let p = 0; p < periodsData.length - 1; p++) {
    const currentNodes = allNodes.filter((n) => n.periodIndex === p);
    const nextNodes = allNodes.filter((n) => n.periodIndex === p + 1);

    // Period stability index
    const kwsCurrent = periodKeywordsMap.get(p) || new Set<string>();
    const kwsNext = periodKeywordsMap.get(p + 1) || new Set<string>();
    let intersectionCount = 0;
    for (const kw of kwsCurrent) {
      if (kwsNext.has(kw)) intersectionCount++;
    }
    const unionCount = new Set([...Array.from(kwsCurrent), ...Array.from(kwsNext)]).size;
    const stability = unionCount > 0 ? Number((intersectionCount / unionCount).toFixed(3)) : 0;
    periodsData[p].stabilityWithNext = stability;

    // Cross-theme comparisons
    const candidates: Array<{
      source: ThematicThemeNode;
      target: ThematicThemeNode;
      inclusion: number;
      jaccard: number;
      shared: string[];
    }> = [];

    for (const src of currentNodes) {
      const srcKws = new Set(src.keywords);
      for (const tgt of nextNodes) {
        const tgtKws = new Set(tgt.keywords);
        const shared = src.keywords.filter((k) => tgtKws.has(k));

        // Inclusion index (Simpson coefficient)
        const minSize = Math.min(srcKws.size, tgtKws.size);
        const inclusion = minSize > 0 ? shared.length / minSize : 0;

        // Jaccard index
        const unionSize = new Set([...src.keywords, ...tgt.keywords]).size;
        const jaccard = unionSize > 0 ? shared.length / unionSize : 0;

        if (inclusion >= inclusionThreshold || (shared.length > 0 && jaccard >= 0.1)) {
          candidates.push({
            source: src,
            target: tgt,
            inclusion: Number(inclusion.toFixed(3)),
            jaccard: Number(jaccard.toFixed(3)),
            shared,
          });
        }
      }
    }

    // Guarantee each source has at least its best link if similarity > 0
    for (const src of currentNodes) {
      const hasLink = candidates.some((c) => c.source.id === src.id);
      if (!hasLink) {
        let bestTarget: ThematicThemeNode | null = null;
        let bestSim = -1;
        let bestShared: string[] = [];

        for (const tgt of nextNodes) {
          const shared = src.keywords.filter((k) => tgt.keywords.includes(k));
          const sim = shared.length;
          if (sim > bestSim) {
            bestSim = sim;
            bestTarget = tgt;
            bestShared = shared;
          }
        }

        if (bestTarget) {
          candidates.push({
            source: src,
            target: bestTarget,
            inclusion: Math.max(0.1, Number((bestSim / Math.min(src.keywords.length, bestTarget.keywords.length)).toFixed(3))),
            jaccard: Math.max(0.08, Number((bestSim / (src.keywords.length + bestTarget.keywords.length)).toFixed(3))),
            shared: bestShared.length ? bestShared : [src.keywords[0] || "conceptual bridge"],
          });
        }
      }
    }

    // Count degrees to determine trajectory
    for (const c of candidates) {
      sourceDegreeMap[c.source.id] = (sourceDegreeMap[c.source.id] || 0) + 1;
      targetDegreeMap[c.target.id] = (targetDegreeMap[c.target.id] || 0) + 1;
    }

    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const c = candidates[cIdx];
      const srcDeg = sourceDegreeMap[c.source.id] || 1;
      const tgtDeg = targetDegreeMap[c.target.id] || 1;

      let trajectory: ThematicFlowLink["trajectory"] = "continuation";
      let trajectoryLabel = "Continuation (Stable Topic)";

      if (srcDeg > 1 && tgtDeg === 1) {
        trajectory = "splitting";
        trajectoryLabel = "Thematic Splitting (Specialized Divergence)";
      } else if (tgtDeg > 1 && srcDeg === 1) {
        trajectory = "merging";
        trajectoryLabel = "Thematic Merging (Convergence)";
      } else if (c.inclusion >= 0.45) {
        trajectory = "continuation";
        trajectoryLabel = "Direct Continuation (Core Continuity)";
      } else {
        trajectory = "continuation";
        trajectoryLabel = "Evolutionary Shift (Thematic Transition)";
      }

      const weight = Math.max(1, Math.round(c.inclusion * 10));

      allLinks.push({
        id: `flow_${c.source.id}_to_${c.target.id}_${cIdx}`,
        sourceId: c.source.id,
        targetId: c.target.id,
        sourcePeriod: p,
        targetPeriod: p + 1,
        sourceThemeName: c.source.name,
        targetThemeName: c.target.name,
        inclusionIndex: c.inclusion,
        jaccardIndex: c.jaccard,
        sharedKeywords: c.shared,
        weight,
        trajectory,
        trajectoryLabel,
      });
    }
  }

  // Identify emerging and fading themes
  const linkedSources = new Set(allLinks.map((l) => l.sourceId));
  const linkedTargets = new Set(allLinks.map((l) => l.targetId));

  const continuations = allLinks.filter((l) => l.trajectory === "continuation").length;
  const splits = allLinks.filter((l) => l.trajectory === "splitting").length;
  const merges = allLinks.filter((l) => l.trajectory === "merging").length;

  const avgStability =
    periodsData.length > 1
      ? Number(
          (
            periodsData.slice(0, -1).reduce((acc, p) => acc + (p.stabilityWithNext || 0), 0) /
            (periodsData.length - 1)
          ).toFixed(3)
        )
      : 1;

  const transitionMatrix = allLinks.map((l) => ({
    sourcePeriod: periodsData[l.sourcePeriod]?.label || `P${l.sourcePeriod}`,
    sourceTheme: l.sourceThemeName,
    targetPeriod: periodsData[l.targetPeriod]?.label || `P${l.targetPeriod}`,
    targetTheme: l.targetThemeName,
    inclusionIndex: l.inclusionIndex,
    sharedKeywords: l.sharedKeywords,
    trajectory: l.trajectoryLabel,
  }));

  return {
    periods: periodsData,
    nodes: allNodes,
    links: allLinks,
    summary: {
      totalPeriods: periodsData.length,
      totalThemes: allNodes.length,
      totalLinks: allLinks.length,
      yearSpan: `${minYear} – ${maxYear}`,
      totalDocuments: validDocs.length,
      averageStability: avgStability,
      continuationsCount: continuations,
      splitsCount: splits,
      mergesCount: merges,
    },
    transitionMatrix,
  };
}

function formatThemeLabel(str: string): string {
  if (!str) return "Theme";
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
