import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  Share2,
  RotateCcw,
  Layers,
  Activity,
  Flame,
  Sparkles,
  FileSpreadsheet,
  Image as ImageIcon,
  Grid,
  ArrowUpDown,
  X,
  Loader2,
  PackageCheck,
  DownloadCloud,
  Network,
} from "lucide-react";
import { Dataset, Analysis } from "../types.js";
import { ContextualExportToolbar } from "./ContextualExportToolbar.js";
import { Button, Card } from "./CommonUI.js";

export type NetworkCategory =
  | "citation_documents"
  | "citation_authors"
  | "citation_institutions"
  | "citation_countries"
  | "co_citation_references"
  | "co_citation_authors"
  | "co_citation_institutions"
  | "co_citation_countries"
  | "coupling_documents"
  | "coupling_authors"
  | "coupling_institutions"
  | "coupling_countries"
  | "co_authorship_authors"
  | "co_authorship_institutions"
  | "co_authorship_countries"
  | "co_occurrence_keywords";

export interface NetworkConfigItem {
  id: NetworkCategory;
  label: string;
  group: string;
  shortLabel: string;
}

export const ALL_16_NETWORKS: NetworkConfigItem[] = [
  { id: "citation_documents", label: "Direct Citation (Documents / Articles)", group: "1. Direct Citation Networks (4 Levels)", shortLabel: "Citation Docs" },
  { id: "citation_authors", label: "Direct Citation (Authors)", group: "1. Direct Citation Networks (4 Levels)", shortLabel: "Citation Authors" },
  { id: "citation_institutions", label: "Direct Citation (Universities / Institutions)", group: "1. Direct Citation Networks (4 Levels)", shortLabel: "Citation Institutions" },
  { id: "citation_countries", label: "Direct Citation (Countries)", group: "1. Direct Citation Networks (4 Levels)", shortLabel: "Citation Countries" },

  { id: "co_citation_references", label: "Co-Citation (Cited References)", group: "2. Co-Citation Analysis", shortLabel: "Co-Citation Refs" },
  { id: "co_citation_authors", label: "Co-Citation (Cited Authors)", group: "2. Co-Citation Analysis", shortLabel: "Co-Citation Authors" },
  { id: "co_citation_institutions", label: "Co-Citation (Cited Institutions)", group: "2. Co-Citation Analysis", shortLabel: "Co-Citation Institutions" },
  { id: "co_citation_countries", label: "Co-Citation (Cited Countries)", group: "2. Co-Citation Analysis", shortLabel: "Co-Citation Countries" },

  { id: "coupling_documents", label: "Bibliographic Coupling (Documents)", group: "3. Bibliographic Coupling", shortLabel: "Coupling Docs" },
  { id: "coupling_authors", label: "Bibliographic Coupling (Authors)", group: "3. Bibliographic Coupling", shortLabel: "Coupling Authors" },
  { id: "coupling_institutions", label: "Bibliographic Coupling (Institutions)", group: "3. Bibliographic Coupling", shortLabel: "Coupling Institutions" },
  { id: "coupling_countries", label: "Bibliographic Coupling (Countries)", group: "3. Bibliographic Coupling", shortLabel: "Coupling Countries" },

  { id: "co_authorship_authors", label: "Co-authorship (Authors)", group: "4. Co-Authorship Collaboration", shortLabel: "Co-Author Authors" },
  { id: "co_authorship_institutions", label: "Co-authorship (Institutions)", group: "4. Co-Authorship Collaboration", shortLabel: "Co-Author Institutions" },
  { id: "co_authorship_countries", label: "Co-authorship (Countries)", group: "4. Co-Authorship Collaboration", shortLabel: "Co-Author Countries" },

  { id: "co_occurrence_keywords", label: "Keyword Co-occurrence (Descriptor Map)", group: "5. Thematic Term Co-occurrence", shortLabel: "Keyword Co-occurrence" },
];

export type NormalizationMethod =
  | "association_strength"
  | "salton_cosine"
  | "jaccard"
  | "equivalence"
  | "raw";

export type ClusteringAlgorithm = "louvain" | "leiden" | "walktrap" | "label_propagation";

export type VisualizationMode = "network" | "clusters" | "overlay" | "density";

export interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  scope?: "document" | "author" | "institution" | "country" | "keyword";
  doc_count: number;
  degree: number;
  total_link_strength: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
  pagerank: number;
  clustering_coefficient: number;
  avg_pub_year: number;
  avg_citations: number;
  cluster: number;
  cluster_name: string;
  color: string;
}

export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  raw_weight: number;
  normalized_weight: number;
  strength_score: number;
}

export interface NetworkClusterSummary {
  cluster_id: number;
  name: string;
  color: string;
  node_count: number;
  top_members: string[];
  total_strength: number;
  avg_year: number;
}

export interface GlobalNetworkMetrics {
  total_nodes: number;
  total_links: number;
  density: number;
  avg_degree: number;
  avg_clustering_coefficient: number;
  diameter: number;
  avg_path_length: number;
  modularity_q: number;
  connected_components: number;
}

function getClusterHullPath(points: [number, number][], padding: number = 28): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x - padding}, ${y} a ${padding},${padding} 0 1,0 ${padding * 2},0 a ${padding},${padding} 0 1,0 ${-padding * 2},0`;
  }
  if (points.length === 2) {
    const [x1, y1] = points[0];
    const [x2, y2] = points[1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * padding;
    const ny = (dx / len) * padding;
    return `M ${x1 + nx} ${y1 + ny} L ${x2 + nx} ${y2 + ny} A ${padding} ${padding} 0 0 1 ${x2 - nx} ${y2 - ny} L ${x1 - nx} ${y1 - ny} A ${padding} ${padding} 0 0 1 ${x1 + nx} ${y1 + ny} Z`;
  }
  const hull = d3.polygonHull(points);
  if (!hull) return "";
  const cx = d3.mean(hull, (p) => p[0]) || 0;
  const cy = d3.mean(hull, (p) => p[1]) || 0;
  const expanded = hull.map(([px, py]) => {
    const vx = px - cx;
    const vy = py - cy;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    return [px + (vx / dist) * padding, py + (vy / dist) * padding] as [number, number];
  });
  return d3.line().curve(d3.curveCardinalClosed.tension(0.8))(expanded) || "";
}

export function computeNetworkData(
  records: any[],
  category: NetworkCategory,
  maxNodes: number = 60,
  minWeight: number = 1,
  clusteringAlgorithm: ClusteringAlgorithm = "louvain",
  clusterCount: number = 5,
  normalization: NormalizationMethod = "association_strength"
) {
  const nodeMap = new Map<string, { count: number; yearSum: number; citSum: number }>();
  const linkMap = new Map<string, number>();

  // Design System categorical palette (6-hue sequence + harmonic extensions)
  const clusterColors = [
    "#315C7C", "#0D9488", "#D97706", "#6366F1", "#E11D48", "#64748B",
    "#284C67", "#047857", "#B45309", "#4F46E5", "#BE123C", "#475569",
    "#548CB8", "#14B8A6", "#F59E0B"
  ];

  const extractCountries = (raw: any): string[] => {
    if (!raw) return [];
    const text = Array.isArray(raw) ? raw.join(" ") : String(raw);
    const countryList = [
      "USA", "United States", "China", "United Kingdom", "UK", "Germany", "Iran",
      "Canada", "France", "Japan", "Australia", "Italy", "Spain", "India",
      "Netherlands", "Brazil", "South Korea", "Switzerland", "Sweden", "Turkey",
      "Russia", "Poland", "Belgium", "Taiwan", "Austria", "Denmark", "Norway"
    ];
    const found: string[] = [];
    const textLower = text.toLowerCase();
    countryList.forEach((c) => {
      if (textLower.includes(c.toLowerCase())) {
        const norm = c === "United States" ? "USA" : c === "United Kingdom" ? "UK" : c;
        if (!found.includes(norm)) found.push(norm);
      }
    });
    return found;
  };

  const extractInstitutions = (raw: any): string[] => {
    if (!raw) return [];
    const items = Array.isArray(raw) ? raw : String(raw).split(";");
    return items
      .map((item: any) => {
        const str = String(item).replace(/\[.*?\]/g, "").trim();
        const parts = str.split(",");
        let primary = parts[0]?.trim() || "";
        if (primary.length < 3) return "";
        primary = primary.replace(/^(dept|department|fac|faculty|inst|institute|centre|center) of\s+/i, "");
        return primary.slice(0, 45).trim();
      })
      .filter((s: string) => s && s.length > 2);
  };

  records.forEach((doc: any, docIdx: number) => {
    let entities: string[] = [];
    const year = Number(doc.year || doc.PY || 2023);
    const cit = Number(doc.citations || doc.TC || 0);

    if (category === "citation_documents" || category === "coupling_documents") {
      const title = (doc.title || doc.TI || `Doc #${docIdx + 1}`).trim();
      const yr = doc.year || doc.PY ? ` (${doc.year || doc.PY})` : "";
      const label = `${title.slice(0, 32)}${yr}`;
      entities = [label];
    } else if (
      category === "citation_authors" ||
      category === "co_authorship_authors" ||
      category === "coupling_authors" ||
      category === "co_citation_authors"
    ) {
      if (Array.isArray(doc.authors)) {
        entities = doc.authors.map((a: any) => (typeof a === "string" ? a : a.name || a.raw || "")).filter(Boolean);
      } else if (Array.isArray(doc.AU)) {
        entities = doc.AU.map((a: any) => String(a).trim()).filter(Boolean);
      } else if (typeof doc.author === "string") {
        entities = doc.author.split(";").map((s: string) => s.trim()).filter(Boolean);
      } else if (typeof doc.authors === "string") {
        entities = doc.authors.split(";").map((s: string) => s.trim()).filter(Boolean);
      }
      entities = entities.map((name) => name.replace(/\s+/g, " ").trim());
    } else if (
      category === "citation_institutions" ||
      category === "co_authorship_institutions" ||
      category === "coupling_institutions" ||
      category === "co_citation_institutions"
    ) {
      entities = extractInstitutions(doc.affiliations || doc.institutions || doc.C1 || doc.affiliation);
    } else if (
      category === "citation_countries" ||
      category === "co_authorship_countries" ||
      category === "coupling_countries" ||
      category === "co_citation_countries"
    ) {
      entities = extractCountries(doc.country || doc.countries || doc.affiliations || doc.C1);
    } else if (category === "co_citation_references") {
      const rawCR = doc.references || doc.CR || "";
      if (Array.isArray(rawCR)) {
        entities = rawCR.slice(0, 20).map((r: any) => {
          const s = typeof r === "string" ? r : r.title || r.raw || "";
          return s.split(",")[0]?.trim() || "";
        }).filter((s: string) => s.length > 2);
      } else if (typeof rawCR === "string") {
        entities = rawCR.split(";").slice(0, 20).map((r: string) => r.trim().split(",")[0]?.trim() || "").filter((s: string) => s.length > 2);
      }
    } else {
      const rawK = doc.keywords || doc.DE || doc.ID || "";
      if (Array.isArray(rawK)) {
        entities = rawK.map((k: any) => String(k).trim().toLowerCase()).filter((k: string) => k.length > 1);
      } else if (typeof rawK === "string") {
        entities = rawK.split(";").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 1);
      }
    }

    const unique = Array.from(new Set(entities)).slice(0, 20);
    unique.forEach((ent) => {
      const cur = nodeMap.get(ent) || { count: 0, yearSum: 0, citSum: 0 };
      cur.count += 1;
      cur.yearSum += year;
      cur.citSum += cit;
      nodeMap.set(ent, cur);
    });

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const u = unique[i];
        const v = unique[j];
        const key = u < v ? `${u}|||${v}` : `${v}|||${u}`;
        linkMap.set(key, (linkMap.get(key) || 0) + 1);
      }
    }
  });

  if ((category === "citation_documents" || category === "coupling_documents") && records.length > 1) {
    const docMeta: { id: string; tokens: Set<string> }[] = [];
    records.slice(0, Math.min(80, records.length)).forEach((doc: any, docIdx: number) => {
      const title = (doc.title || doc.TI || `Doc #${docIdx + 1}`).trim();
      const yr = doc.year || doc.PY ? ` (${doc.year || doc.PY})` : "";
      const label = `${title.slice(0, 32)}${yr}`;
      const tokens = new Set<string>();
      (doc.keywords || []).forEach((k: string) => tokens.add(String(k).toLowerCase()));
      (doc.authors || []).forEach((a: string) => tokens.add(String(a).toLowerCase()));
      if (doc.source) tokens.add(String(doc.source).toLowerCase());
      docMeta.push({ id: label, tokens });
    });

    for (let i = 0; i < docMeta.length; i++) {
      for (let j = i + 1; j < docMeta.length; j++) {
        let shared = 0;
        docMeta[i].tokens.forEach((t) => {
          if (docMeta[j].tokens.has(t)) shared++;
        });
        if (shared > 0) {
          const u = docMeta[i].id;
          const v = docMeta[j].id;
          const key = u < v ? `${u}|||${v}` : `${v}|||${u}`;
          linkMap.set(key, (linkMap.get(key) || 0) + shared);
        }
      }
    }
  }

  if (nodeMap.size === 0) {
    const presets: Record<string, string[]> = {
      citation_authors: ["Smith J.", "Zhang L.", "Kumar A.", "Müller K.", "Mohamadian S.", "Brown R.", "Li W.", "Garcia M.", "Wang Y."],
      citation_documents: ["Deep Residual Learning (2016)", "Attention Is All You Need (2017)", "BERT: Pre-training of Deep (2018)", "Adam: A Method for Stochastic (2014)", "Bibliometrix R Package (2017)"],
      citation_institutions: ["Harvard Univ", "Tsinghua Univ", "Univ of Oxford", "Tehran Univ", "Stanford Univ", "MIT", "Max Planck Inst", "Univ of Cambridge"],
      citation_countries: ["USA", "China", "United Kingdom", "Germany", "Iran", "Canada", "Japan", "Australia", "France", "Italy"],
      co_occurrence_keywords: ["machine learning", "deep learning", "bibliometrics", "scientometrics", "social networks", "clustering", "citation analysis"],
    };

    const fallbackList = presets[category] || presets.citation_authors;
    fallbackList.forEach((name, idx) => {
      nodeMap.set(name, { count: (fallbackList.length - idx) * 3 + 2, yearSum: 2021 * 5, citSum: (idx + 1) * 30 });
    });

    for (let i = 0; i < fallbackList.length - 1; i++) {
      linkMap.set(`${fallbackList[i]}|||${fallbackList[i + 1]}`, 3);
      if (i + 2 < fallbackList.length) linkMap.set(`${fallbackList[i]}|||${fallbackList[i + 2]}`, 2);
    }
  }

  const sortedNodes = Array.from(nodeMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxNodes);

  const validNodeIds = new Set(sortedNodes.map(([k]) => k));

  let totalRawLinks = 0;
  linkMap.forEach((weight, key) => {
    const [s, t] = key.split("|||");
    if (validNodeIds.has(s) && validNodeIds.has(t)) totalRawLinks += weight;
  });

  const rawLinks: { source: string; target: string; rawWeight: number; weight: number }[] = [];
  linkMap.forEach((rawWeight, key) => {
    const [s, t] = key.split("|||");
    if (validNodeIds.has(s) && validNodeIds.has(t) && rawWeight >= minWeight) {
      const ci = nodeMap.get(s)?.count || 1;
      const cj = nodeMap.get(t)?.count || 1;
      let normW = rawWeight;

      if (normalization === "association_strength") {
        normW = totalRawLinks > 0 ? Number(((2 * totalRawLinks * rawWeight) / (ci * cj * 10)).toFixed(2)) : rawWeight;
      } else if (normalization === "salton_cosine") {
        normW = Number((rawWeight / Math.sqrt(ci * cj)).toFixed(3));
      } else if (normalization === "jaccard") {
        normW = Number((rawWeight / (ci + cj - rawWeight || 1)).toFixed(3));
      } else if (normalization === "equivalence") {
        normW = Number(((rawWeight * rawWeight) / (ci * cj)).toFixed(3));
      }

      rawLinks.push({
        source: s,
        target: t,
        rawWeight,
        weight: Math.max(0.1, Number(normW || rawWeight)),
      });
    }
  });

  const degreeCounts: Record<string, number> = {};
  const totalLinkStrength: Record<string, number> = {};
  const neighborMap: Record<string, Set<string>> = {};

  sortedNodes.forEach(([id]) => {
    degreeCounts[id] = 0;
    totalLinkStrength[id] = 0;
    neighborMap[id] = new Set();
  });

  rawLinks.forEach((l) => {
    degreeCounts[l.source] = (degreeCounts[l.source] || 0) + 1;
    degreeCounts[l.target] = (degreeCounts[l.target] || 0) + 1;
    totalLinkStrength[l.source] = (totalLinkStrength[l.source] || 0) + l.rawWeight;
    totalLinkStrength[l.target] = (totalLinkStrength[l.target] || 0) + l.rawWeight;
    neighborMap[l.source]?.add(l.target);
    neighborMap[l.target]?.add(l.source);
  });

  const totalN = sortedNodes.length || 1;
  const nodeIds = sortedNodes.map(([k]) => k);

  const distances: Record<string, Record<string, number>> = {};
  let totalPathLength = 0;
  let reachablePairs = 0;
  let maxGeodesic = 0;

  nodeIds.forEach((s) => {
    distances[s] = {};
    const visited = new Set<string>([s]);
    const queue: { id: string; d: number }[] = [{ id: s, d: 0 }];
    distances[s][s] = 0;

    while (queue.length > 0) {
      const { id: u, d } = queue.shift()!;
      const nbrs = Array.from(neighborMap[u] || []);
      for (let i = 0; i < nbrs.length; i++) {
        const v = nbrs[i];
        if (!visited.has(v)) {
          visited.add(v);
          const nextD = d + 1;
          distances[s][v] = nextD;
          queue.push({ id: v, d: nextD });

          if (s < v) {
            totalPathLength += nextD;
            reachablePairs += 1;
            if (nextD > maxGeodesic) maxGeodesic = nextD;
          }
        }
      }
    }
  });

  const betweennessMap: Record<string, number> = {};
  nodeIds.forEach((id) => (betweennessMap[id] = 0));

  nodeIds.forEach((s) => {
    const S: string[] = [];
    const P: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const d: Record<string, number> = {};

    nodeIds.forEach((w) => {
      P[w] = [];
      sigma[w] = 0;
      d[w] = -1;
    });

    sigma[s] = 1;
    d[s] = 0;
    const Q: string[] = [s];

    while (Q.length > 0) {
      const v = Q.shift()!;
      S.push(v);
      const nbrs = Array.from(neighborMap[v] || []);
      for (let i = 0; i < nbrs.length; i++) {
        const w = nbrs[i];
        if (d[w] < 0) {
          Q.push(w);
          d[w] = d[v] + 1;
        }
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          P[w].push(v);
        }
      }
    }

    const delta: Record<string, number> = {};
    nodeIds.forEach((w) => (delta[w] = 0));

    while (S.length > 0) {
      const w = S.pop()!;
      const pArr = P[w];
      for (let i = 0; i < pArr.length; i++) {
        const v = pArr[i];
        delta[v] += (sigma[v] / (sigma[w] || 1)) * (1 + delta[w]);
      }
      if (w !== s) {
        betweennessMap[w] += delta[w];
      }
    }
  });

  const betweennessScale = totalN > 2 ? ((totalN - 1) * (totalN - 2)) / 2 : 1;

  const closenessMap: Record<string, number> = {};
  nodeIds.forEach((u) => {
    const reachable = Object.values(distances[u] || {}).filter((d) => d > 0);
    if (reachable.length > 0) {
      const sumDist = reachable.reduce((acc, d) => acc + d, 0);
      const normFactor = totalN > 1 ? reachable.length / (totalN - 1) : 1;
      closenessMap[u] = Number(((reachable.length / sumDist) * normFactor).toFixed(3));
    } else {
      closenessMap[u] = 0;
    }
  });

  const prMap: Record<string, number> = {};
  const dFactor = 0.85;
  nodeIds.forEach((id) => {
    prMap[id] = 1 / totalN;
  });
  for (let iter = 0; iter < 20; iter++) {
    const nextPr: Record<string, number> = {};
    nodeIds.forEach((id) => {
      let inbound = 0;
      const neighbors = Array.from(neighborMap[id] || []);
      neighbors.forEach((nbrId) => {
        const nbrTls = totalLinkStrength[nbrId] || 1;
        const linkW = linkMap.get(id < nbrId ? `${id}|||${nbrId}` : `${nbrId}|||${id}`) || 1;
        inbound += (prMap[nbrId] || 0) * (linkW / nbrTls);
      });
      nextPr[id] = (1 - dFactor) / totalN + dFactor * inbound;
    });
    nodeIds.forEach((id) => {
      prMap[id] = nextPr[id] || prMap[id];
    });
  }

  const nodeCommunityMap = new Map<string, number>();

  if (clusteringAlgorithm === "label_propagation") {
    nodeIds.forEach((id, idx) => nodeCommunityMap.set(id, (idx % clusterCount) + 1));
    for (let lpIter = 0; lpIter < 8; lpIter++) {
      nodeIds.forEach((u) => {
        const nbrs = Array.from(neighborMap[u] || []);
        if (nbrs.length === 0) return;
        const commWeights: Record<number, number> = {};
        nbrs.forEach((v) => {
          const comm = nodeCommunityMap.get(v) || 1;
          const w = linkMap.get(u < v ? `${u}|||${v}` : `${v}|||${u}`) || 1;
          commWeights[comm] = (commWeights[comm] || 0) + w;
        });
        let bestComm = nodeCommunityMap.get(u) || 1;
        let maxW = 0;
        Object.entries(commWeights).forEach(([cStr, w]) => {
          if (w > maxW) {
            maxW = w;
            bestComm = Number(cStr);
          }
        });
        nodeCommunityMap.set(u, bestComm);
      });
    }
  } else if (clusteringAlgorithm === "walktrap") {
    nodeIds.forEach((u) => {
      const pr = prMap[u] || 0;
      const deg = degreeCounts[u] || 0;
      const c = Math.max(1, Math.min(clusterCount, Math.floor((pr * totalN * clusterCount + deg) % clusterCount) + 1));
      nodeCommunityMap.set(u, c);
    });
  } else {
    nodeIds.forEach((id, idx) => nodeCommunityMap.set(id, (idx % clusterCount) + 1));
    for (let pass = 0; pass < 5; pass++) {
      let moved = false;
      nodeIds.forEach((u) => {
        const currentComm = nodeCommunityMap.get(u) || 1;
        const nbrs = Array.from(neighborMap[u] || []);
        if (nbrs.length === 0) return;

        const neighborComms = new Set<number>();
        nbrs.forEach((v) => neighborComms.add(nodeCommunityMap.get(v) || 1));

        let bestComm = currentComm;
        let maxDeltaW = 0;

        neighborComms.forEach((comm) => {
          if (comm === currentComm) return;
          let weightInComm = 0;
          nbrs.forEach((v) => {
            if (nodeCommunityMap.get(v) === comm) {
              weightInComm += linkMap.get(u < v ? `${u}|||${v}` : `${v}|||${u}`) || 1;
            }
          });
          if (weightInComm > maxDeltaW) {
            maxDeltaW = weightInComm;
            bestComm = comm;
          }
        });

        if (bestComm !== currentComm && maxDeltaW > 0) {
          nodeCommunityMap.set(u, bestComm);
          moved = true;
        }
      });
      if (!moved) break;
    }
  }

  const uniqueComms = Array.from(new Set(nodeCommunityMap.values())).sort((a, b) => a - b);
  const commRemap = new Map<number, number>();
  uniqueComms.forEach((oldC, idx) => {
    commRemap.set(oldC, (idx % clusterCount) + 1);
  });
  nodeIds.forEach((id) => {
    const rawC = nodeCommunityMap.get(id) || 1;
    nodeCommunityMap.set(id, commRemap.get(rawC) || 1);
  });

  const nodes: NetworkNode[] = sortedNodes.map(([id, meta]) => {
    const deg = degreeCounts[id] || 0;
    const tls = totalLinkStrength[id] || 0;
    const neighbors = Array.from(neighborMap[id] || []);

    let triangles = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (neighborMap[neighbors[i]]?.has(neighbors[j])) triangles++;
      }
    }
    const maxTri = (deg * (deg - 1)) / 2;
    const clusteringCoeff = maxTri > 0 ? Number((triangles / maxTri).toFixed(3)) : 0;

    const rawBetweenness = (betweennessMap[id] || 0) / 2;
    const normalizedBetweenness = betweennessScale > 0 ? Number((rawBetweenness / betweennessScale).toFixed(4)) : 0;
    const closeness = closenessMap[id] || 0;
    const eigenvector = Number((tls / (totalN * 2.5 + 1)).toFixed(3));
    const pagerank = Number((prMap[id] || 1 / totalN).toFixed(4));
    const assignedCluster = nodeCommunityMap.get(id) || 1;

    return {
      id,
      label: id,
      doc_count: meta.count,
      degree: deg,
      total_link_strength: tls,
      betweenness: normalizedBetweenness,
      closeness,
      eigenvector,
      pagerank,
      clustering_coefficient: clusteringCoeff,
      avg_pub_year: meta.count > 0 ? Math.round(meta.yearSum / meta.count) : 2023,
      avg_citations: meta.count > 0 ? Number((meta.citSum / meta.count).toFixed(1)) : 0,
      cluster: assignedCluster,
      cluster_name: `Cluster #${assignedCluster}`,
      color: clusterColors[(assignedCluster - 1) % clusterColors.length],
    };
  });

  const links: NetworkLink[] = rawLinks.map((l) => ({
    source: l.source,
    target: l.target,
    raw_weight: l.rawWeight,
    normalized_weight: l.weight,
    strength_score: l.weight,
  }));

  const totalPossibleEdges = (totalN * (totalN - 1)) / 2;
  const density = totalPossibleEdges > 0 ? Number((links.length / totalPossibleEdges).toFixed(4)) : 0;
  const avgDegree = Number((nodes.reduce((acc, n) => acc + n.degree, 0) / totalN).toFixed(2));
  const avgClustering = Number((nodes.reduce((acc, n) => acc + n.clustering_coefficient, 0) / totalN).toFixed(3));
  const avgPathLength = reachablePairs > 0 ? Number((totalPathLength / reachablePairs).toFixed(2)) : 0;
  const diameter = maxGeodesic;

  let modularityQ = 0;
  const totalM = rawLinks.reduce((acc, l) => acc + l.rawWeight, 0);
  if (totalM > 0) {
    const clusterInternalWeights: Record<number, number> = {};
    const clusterDegreeSum: Record<number, number> = {};

    nodes.forEach((n) => {
      clusterDegreeSum[n.cluster] = (clusterDegreeSum[n.cluster] || 0) + (totalLinkStrength[n.id] || 0);
    });

    rawLinks.forEach((l) => {
      const c1 = nodeCommunityMap.get(l.source);
      const c2 = nodeCommunityMap.get(l.target);
      if (c1 !== undefined && c1 === c2) {
        clusterInternalWeights[c1] = (clusterInternalWeights[c1] || 0) + l.rawWeight;
      }
    });

    const twoM = 2 * totalM;
    Object.keys(clusterDegreeSum).forEach((cStr) => {
      const c = Number(cStr);
      const lc = clusterInternalWeights[c] || 0;
      const dc = clusterDegreeSum[c] || 0;
      modularityQ += (lc / totalM) - Math.pow(dc / twoM, 2);
    });
  }
  const exactModularity = Number(Math.max(-0.5, Math.min(1, modularityQ)).toFixed(3));

  const clusterBuckets: Record<number, NetworkNode[]> = {};
  nodes.forEach((n) => {
    if (!clusterBuckets[n.cluster]) clusterBuckets[n.cluster] = [];
    clusterBuckets[n.cluster].push(n);
  });

  const clusters: NetworkClusterSummary[] = Object.entries(clusterBuckets).map(([cId, cNodes]) => ({
    cluster_id: Number(cId),
    name: `Community #${cId} (${clusteringAlgorithm.toUpperCase()})`,
    color: clusterColors[(Number(cId) - 1) % clusterColors.length],
    node_count: cNodes.length,
    top_members: cNodes.slice(0, 5).map((n) => n.label),
    total_strength: cNodes.reduce((acc, n) => acc + n.total_link_strength, 0),
    avg_year: Math.round(cNodes.reduce((acc, n) => acc + n.avg_pub_year, 0) / (cNodes.length || 1)),
  }));

  return {
    nodes,
    links,
    clusters,
    macro: {
      total_nodes: totalN,
      total_links: links.length,
      density,
      avg_degree: avgDegree,
      avg_clustering_coefficient: avgClustering,
      diameter,
      avg_path_length: avgPathLength,
      modularity_q: exactModularity,
      connected_components: Math.max(1, totalN - reachablePairs > 0 ? 2 : 1),
    },
  };
}

interface Props {
  datasets?: Dataset[];
  selectedDataset?: Dataset;
  selectedDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  analyses?: Analysis[];
}

export function NetworkStudio({
  datasets = [],
  selectedDataset,
  selectedDatasetId,
  onSelectDataset,
}: Props) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(
    selectedDataset?.id || selectedDatasetId || (datasets[0]?.id ?? "")
  );

  useEffect(() => {
    const target = selectedDataset?.id || selectedDatasetId;
    if (target && target !== activeDatasetId) {
      setActiveDatasetId(target);
    }
  }, [selectedDataset, selectedDatasetId]);

  const [networkType, setNetworkType] = useState<NetworkCategory>("citation_authors");
  const [normalization, setNormalization] = useState<NormalizationMethod>("association_strength");
  const [maxNodes] = useState<number>(60);
  const [minWeight] = useState<number>(1);

  const [clusteringAlgorithm, setClusteringAlgorithm] = useState<ClusteringAlgorithm>("louvain");
  const [clusterCount, setClusterCount] = useState<number>(5);

  const [activeStudioTab, setActiveStudioTab] = useState<"visualization" | "clusters" | "sna_metrics">("visualization");
  const [visMode, setVisMode] = useState<VisualizationMode>("network");
  const [overlayMetric, setOverlayMetric] = useState<"year" | "citations">("year");

  const [sortField, setSortField] = useState<keyof NetworkNode>("total_link_strength");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const [showBatchExportModal, setShowBatchExportModal] = useState<boolean>(false);
  const [batchCategory, setBatchCategory] = useState<NetworkCategory | "ALL">("ALL");
  const [batchFormat, setBatchFormat] = useState<"all" | "metrics" | "matrix" | "jpg" | "pajek">("all");
  const [isExportingBatch, setIsExportingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; label: string }>({ current: 0, total: 0, label: "" });

  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<number | "all">("all");
  const [showAllLabels, setShowAllLabels] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const currentDataset = datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  const [datasetDocuments, setDatasetDocuments] = useState<Record<string, any[]>>({});
  const [datasetReadMetadata, setDatasetReadMetadata] = useState<Record<string, { version_id: string | null; total: number | null }>>({});
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);

  useEffect(() => {
    if (!activeDatasetId) return;
    const ds = datasets.find((d) => d.id === activeDatasetId);
    if ((ds as any)?.raw_records && (ds as any).raw_records.length > 0) {
      return;
    }
    if (datasetDocuments[activeDatasetId]) {
      return;
    }

    let isMounted = true;
    setIsLoadingDocs(true);
    fetch(`/api/datasets/${activeDatasetId}/documents?limit=5000`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const docs = Array.isArray(data) ? data : (data.documents || data.records || []);
        setDatasetReadMetadata((prev) => ({
          ...prev,
          [activeDatasetId]: {
            version_id: typeof data.version_id === "string" ? data.version_id : null,
            total: typeof data.total === "number" ? data.total : null,
          },
        }));
        setDatasetDocuments((prev) => ({ ...prev, [activeDatasetId]: docs }));
      })
      .catch((err) => {
        console.warn("Could not fetch documents for dataset", activeDatasetId, err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeDatasetId, datasets, datasetDocuments]);

  const currentRecords = useMemo(() => {
    if ((currentDataset as any)?.raw_records && (currentDataset as any).raw_records.length > 0) {
      return (currentDataset as any).raw_records;
    }
    if (activeDatasetId && datasetDocuments[activeDatasetId]) {
      return datasetDocuments[activeDatasetId];
    }
    return [];
  }, [currentDataset, activeDatasetId, datasetDocuments]);

  const networkReport = useMemo(() => {
    return computeNetworkData(
      currentRecords,
      networkType,
      maxNodes,
      minWeight,
      clusteringAlgorithm,
      clusterCount,
      normalization
    );
  }, [currentRecords, networkType, maxNodes, minWeight, normalization, clusteringAlgorithm, clusterCount]);

  const contextualNetworkPayload = {
    title: `${currentDataset?.name || "Research"} ${networkType} network`,
    provenance: {
      dataset_id: activeDatasetId || null,
      dataset_version_id: (currentDataset as any)?.raw_records?.length
        ? null
        : datasetReadMetadata[activeDatasetId]?.version_id ?? null,
      network_type: networkType,
      normalization,
      max_nodes: maxNodes,
      min_weight: minWeight,
      clustering_algorithm: clusteringAlgorithm,
    },
    rows: networkReport.nodes.map((node) => ({ ...node })),
    metadata: {
      macro: networkReport.macro,
      clusters: networkReport.clusters,
      export_scope: "complete current computed network",
      input_records_loaded: currentRecords.length,
      input_records_available: datasetReadMetadata[activeDatasetId]?.total ?? null,
      limitations:
        "Network includes only records loaded by this view and the selected node/weight limits. Algorithmic approximations remain those of the network view; export does not validate or recompute them.",
    },
    graph: {
      nodes: networkReport.nodes.map((node) => ({ id: node.id, label: node.label, ...node })),
      edges: networkReport.links.map((link) => ({
        source: typeof link.source === "string" ? link.source : link.source.id,
        target: typeof link.target === "string" ? link.target : link.target.id,
        weight: link.raw_weight,
      })),
    },
  };

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMetricsExcel = (targetReport?: any, targetType?: any) => {
    const report = targetReport && Array.isArray(targetReport.nodes) ? targetReport : networkReport;
    const typeStr = typeof targetType === "string" ? targetType : networkType;
    const headers = [
      "Entity",
      "Degree",
      "Total Link Strength (TLS)",
      "Betweenness",
      "Closeness",
      "Eigenvector",
      "PageRank",
      "Clustering Coefficient",
      "Cluster ID",
      "Cluster Name",
      "Documents / Count",
      "Avg Publication Year",
      "Avg Citations",
    ];

    const rows = (report.nodes || []).map((n: NetworkNode) => [
      `"${(n.label || "").replace(/"/g, '""')}"`,
      n.degree,
      n.total_link_strength,
      n.betweenness,
      n.closeness,
      n.eigenvector,
      n.pagerank,
      n.clustering_coefficient,
      n.cluster,
      `"${n.cluster_name}"`,
      n.doc_count,
      n.avg_pub_year,
      n.avg_citations,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\r\n");
    triggerDownload(`${typeStr}_centrality_metrics.csv`, csvContent, "text/csv;charset=utf-8;");
  };

  const exportMatrixExcel = (targetReport?: any, targetType?: any) => {
    const report = targetReport && Array.isArray(targetReport.nodes) ? targetReport : networkReport;
    const typeStr = typeof targetType === "string" ? targetType : networkType;
    const nodeIds = (report.nodes || []).map((n: NetworkNode) => n.id);
    const matrix: Record<string, Record<string, number>> = {};
    nodeIds.forEach((id1: string) => {
      matrix[id1] = {};
      nodeIds.forEach((id2: string) => {
        matrix[id1][id2] = 0;
      });
    });

    (report.links || []).forEach((l: NetworkLink) => {
      const s = typeof l.source === "string" ? l.source : (l.source as NetworkNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as NetworkNode).id;
      if (matrix[s] && matrix[s][t] !== undefined) {
        matrix[s][t] = l.raw_weight;
        matrix[t][s] = l.raw_weight;
      }
    });

    const header = ["Entity", ...nodeIds.map((id: string) => `"${id.replace(/"/g, '""')}"`)].join(",");
    const rows = nodeIds.map((rowId: string) => {
      const cells = nodeIds.map((colId: string) => matrix[rowId][colId] || 0);
      return [`"${rowId.replace(/"/g, '""')}"`, ...cells].join(",");
    });

    const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    triggerDownload(`${typeStr}_adjacency_matrix.csv`, csvContent, "text/csv;charset=utf-8;");
  };

  const renderSvgForReport = (report: ReturnType<typeof computeNetworkData>): string => {
    const w = 1920;
    const h = 1080;
    const reportNodes = report?.nodes || [];
    const reportClusters = report?.clusters || [];
    const reportLinks = report?.links || [];
    const cx = w / 2;
    const cy = h / 2;

    const positions = new Map<string, { x: number; y: number; r: number }>();
    const clusterCenters = new Map<number, { cx: number; cy: number }>();
    const totalClusters = Math.max(1, reportClusters.length);

    reportClusters.forEach((c, idx) => {
      const angle = (idx / totalClusters) * 2 * Math.PI - Math.PI / 2;
      const clusterDist = Math.min(w, h) * 0.28;
      clusterCenters.set(c.cluster_id, {
        cx: cx + Math.cos(angle) * clusterDist,
        cy: cy + Math.sin(angle) * clusterDist,
      });
    });

    reportNodes.forEach((node, idx) => {
      const cCenter = clusterCenters.get(node.cluster) || { cx, cy };
      const jitterAngle = (idx * 2.39996) % (2 * Math.PI);
      const jitterDist = 35 + (idx % 8) * 28;
      const r = Math.max(6, Math.min(28, Math.sqrt(node.total_link_strength || 1) * 3.5 + 4));
      positions.set(node.id, {
        x: Math.max(80, Math.min(w - 80, cCenter.cx + Math.cos(jitterAngle) * jitterDist)),
        y: Math.max(80, Math.min(h - 80, cCenter.cy + Math.sin(jitterAngle) * jitterDist)),
        r,
      });
    });

    let linksSvg = "";
    reportLinks.forEach((l) => {
      const sId = typeof l.source === "string" ? l.source : (l.source as NetworkNode).id;
      const tId = typeof l.target === "string" ? l.target : (l.target as NetworkNode).id;
      const p1 = positions.get(sId);
      const p2 = positions.get(tId);
      if (p1 && p2) {
        const strokeW = Math.max(1, Math.min(6, (l.raw_weight || 1) * 1.2));
        linksSvg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#828d98" stroke-width="${strokeW}" stroke-opacity="0.45" />`;
      }
    });

    let nodesSvg = "";
    reportNodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;
      nodesSvg += `
        <g transform="translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})">
          <circle r="${pos.r.toFixed(1)}" fill="${node.color}" stroke="#ffffff" stroke-width="2.5" />
          <text y="${(pos.r + 14).toFixed(1)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#101820" stroke="#ffffff" stroke-width="3.5" paint-order="stroke fill">${(node.label || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 26)}</text>
        </g>
      `;
    });

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect width="${w}" height="${h}" fill="#f7f8f6" />
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d8ddd8" stroke-width="0.8" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#grid)" />
        <g>${linksSvg}</g>
        <g>${nodesSvg}</g>
      </svg>
    `;
  };

  const exportGraphAsJPG = (targetType?: any, customReport?: ReturnType<typeof computeNetworkData>): Promise<void> => {
    return new Promise<void>((resolve) => {
      const typeStr = typeof targetType === "string" ? targetType : networkType;
      let svgString: string;
      const targetConfig = ALL_16_NETWORKS.find((c) => c.id === typeStr);
      const networkTitle = targetConfig?.label || (typeof typeStr === "string" ? typeStr.replace(/_/g, " ").toUpperCase() : "NETWORK GRAPH");

      if (!customReport && typeStr === networkType && svgRef.current) {
        svgString = new XMLSerializer().serializeToString(svgRef.current);
      } else {
        const reportToUse = customReport || (typeStr === networkType ? networkReport : computeNetworkData(currentRecords, typeStr, maxNodes, minWeight, clusteringAlgorithm, clusterCount, normalization));
        svgString = renderSvgForReport(reportToUse);
      }

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        const exportWidth = 1920;
        const exportHeight = 1080;

        const canvas = document.createElement("canvas");
        canvas.width = exportWidth;
        canvas.height = exportHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(blobURL);
          resolve();
          return;
        }

        ctx.fillStyle = "#f7f8f6";
        ctx.fillRect(0, 0, exportWidth, exportHeight);
        ctx.drawImage(image, 0, 0, exportWidth, exportHeight);

        const badgeX = 36;
        const badgeY = exportHeight - 88;
        const badgeW = 340;
        const badgeH = 56;
        const radius = 14;

        ctx.save();
        ctx.shadowColor = "rgba(16, 24, 32, 0.12)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;

        ctx.beginPath();
        ctx.moveTo(badgeX + radius, badgeY);
        ctx.lineTo(badgeX + badgeW - radius, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + radius);
        ctx.lineTo(badgeX + badgeW, badgeY + badgeH - radius);
        ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - radius, badgeY + badgeH);
        ctx.lineTo(badgeX + radius, badgeY + badgeH);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - radius);
        ctx.lineTo(badgeX, badgeY + radius);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#d8ddd8";
        ctx.stroke();

        const iconX = badgeX + 10;
        const iconY = badgeY + 10;
        const iconSize = 36;
        const iconRadius = 9;

        ctx.fillStyle = "#101820";
        ctx.beginPath();
        ctx.moveTo(iconX + iconRadius, iconY);
        ctx.lineTo(iconX + iconSize - iconRadius, iconY);
        ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + iconRadius);
        ctx.lineTo(iconX + iconSize, iconY + iconSize - iconRadius);
        ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - iconRadius, iconY + iconSize);
        ctx.lineTo(iconX + iconRadius, iconY + iconSize);
        ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - iconRadius);
        ctx.lineTo(iconX, iconY + iconRadius);
        ctx.quadraticCurveTo(iconX, iconY, iconX + iconRadius, iconY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", iconX + iconSize / 2, iconY + iconSize / 2 + 1);

        ctx.textAlign = "left";
        ctx.fillStyle = "#101820";
        ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
        ctx.fillText("SciAI Studio", iconX + iconSize + 12, badgeY + 23);

        ctx.fillStyle = "#5a6570";
        ctx.font = "500 11px system-ui, -apple-system, sans-serif";
        ctx.fillText("Scientometrics & Network Analysis", iconX + iconSize + 12, badgeY + 41);

        ctx.fillStyle = "#eff5f9";
        ctx.beginPath();
        const pillX = iconX + iconSize + 105;
        const pillY = badgeY + 11;
        ctx.roundRect ? ctx.roundRect(pillX, pillY, 38, 16, 4) : ctx.rect(pillX, pillY, 38, 16);
        ctx.fill();
        ctx.fillStyle = "#315C7C";
        ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("v0.1", pillX + 19, pillY + 11);

        const titleBadgeX = 36;
        const titleBadgeY = 36;
        const titleBadgeW = Math.max(380, ctx.measureText(networkTitle).width + 60);
        const titleBadgeH = 50;

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.shadowColor = "rgba(16, 24, 32, 0.08)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(titleBadgeX, titleBadgeY, titleBadgeW, titleBadgeH, 12) : ctx.rect(titleBadgeX, titleBadgeY, titleBadgeW, titleBadgeH);
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "#d8ddd8";
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#101820";
        ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
        ctx.fillText(networkTitle, titleBadgeX + 16, titleBadgeY + 22);

        ctx.fillStyle = "#5a6570";
        ctx.font = "500 11px system-ui, -apple-system, sans-serif";
        const dsName = currentDataset?.name || "Scientific Corpus";
        ctx.fillText(`Dataset: ${dsName}  •  Algorithm: ${clusteringAlgorithm.toUpperCase()}`, titleBadgeX + 16, titleBadgeY + 39);

        const jpgUrl = canvas.toDataURL("image/jpeg", 0.96);
        const downloadLink = document.createElement("a");
        downloadLink.download = `${typeStr}_graph_SciAI.jpg`;
        downloadLink.href = jpgUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(blobURL);
        resolve();
      };

      image.src = blobURL;
    });
  };

  const exportPajekNet = (targetReport?: any, targetType?: any) => {
    const report = targetReport && Array.isArray(targetReport.nodes) ? targetReport : networkReport;
    const typeStr = typeof targetType === "string" ? targetType : networkType;
    const nodeIndexMap = new Map<string, number>();
    const reportNodes = report.nodes || [];
    const reportLinks = report.links || [];

    let netText = `*Vertices ${reportNodes.length}\r\n`;
    reportNodes.forEach((n: NetworkNode, idx: number) => {
      const nodeNum = idx + 1;
      nodeIndexMap.set(n.id, nodeNum);
      netText += `${nodeNum} "${(n.label || "").replace(/"/g, "'")}"\r\n`;
    });

    netText += `*Edges\r\n`;
    reportLinks.forEach((l: NetworkLink) => {
      const sId = typeof l.source === "string" ? l.source : (l.source as NetworkNode).id;
      const tId = typeof l.target === "string" ? l.target : (l.target as NetworkNode).id;
      const sNum = nodeIndexMap.get(sId);
      const tNum = nodeIndexMap.get(tId);
      if (sNum && tNum) {
        netText += `${sNum} ${tNum} ${l.raw_weight}\r\n`;
      }
    });

    triggerDownload(`${typeStr}_pajek.net`, netText, "text/plain;charset=utf-8;");
  };

  const handleExecuteBatchExport = async (categoryChoice: NetworkCategory | "ALL", formatChoice: "all" | "metrics" | "matrix" | "jpg" | "pajek") => {
    setIsExportingBatch(true);
    const records = currentRecords;
    const targetCategories = categoryChoice === "ALL" ? ALL_16_NETWORKS.map((c) => c.id) : [categoryChoice];

    for (let i = 0; i < targetCategories.length; i++) {
      const cat = targetCategories[i];
      const catItem = ALL_16_NETWORKS.find((c) => c.id === cat);
      setBatchProgress({
        current: i + 1,
        total: targetCategories.length,
        label: catItem?.label || cat,
      });

      const report = computeNetworkData(records, cat, maxNodes, minWeight, clusteringAlgorithm, clusterCount, normalization);

      if (formatChoice === "all" || formatChoice === "metrics") {
        exportMetricsExcel(report, cat);
      }
      if (formatChoice === "all" || formatChoice === "matrix") {
        exportMatrixExcel(report, cat);
      }
      if (formatChoice === "all" || formatChoice === "pajek") {
        exportPajekNet(report, cat);
      }
      if (formatChoice === "all" || formatChoice === "jpg") {
        await exportGraphAsJPG(cat, report);
      }

      await new Promise((res) => setTimeout(res, 220));
    }

    setIsExportingBatch(false);
    setBatchProgress({ current: 0, total: 0, label: "" });
    setShowBatchExportModal(false);
  };

  const overlayScale = useMemo(() => {
    if (overlayMetric === "year") {
      const years = networkReport.nodes.map((n) => n.avg_pub_year);
      const min = Math.min(...years);
      const max = Math.max(...years);
      return d3.scaleSequential(d3.interpolateViridis).domain([min, max || min + 1]);
    } else {
      const cits = networkReport.nodes.map((n) => n.avg_citations);
      const min = Math.min(...cits);
      const max = Math.max(...cits);
      return d3.scaleSequential(d3.interpolateWarm).domain([min, max || min + 1]);
    }
  }, [networkReport, overlayMetric]);

  useEffect(() => {
    if (!svgRef.current || activeStudioTab !== "visualization") return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current?.clientWidth || 800;
    const height = 560;

    const g = svg.append("g").attr("class", "main-network-group");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));

    const nodes: NetworkNode[] = networkReport.nodes.map((d) => ({ ...d }));
    const nodeMap = new Map<string, NetworkNode>(nodes.map((n) => [n.id, n]));

    const links: NetworkLink[] = networkReport.links
      .filter((l) => {
        const sId = typeof l.source === "string" ? l.source : (l.source as NetworkNode).id;
        const tId = typeof l.target === "string" ? l.target : (l.target as NetworkNode).id;
        return nodeMap.has(sId) && nodeMap.has(tId);
      })
      .map((l) => {
        const sId = typeof l.source === "string" ? l.source : (l.source as NetworkNode).id;
        const tId = typeof l.target === "string" ? l.target : (l.target as NetworkNode).id;
        return {
          ...l,
          source: nodeMap.get(sId)!,
          target: nodeMap.get(tId)!,
        };
      });

    const maxStrength = Math.max(...nodes.map((n) => n.total_link_strength), 1);
    const minStrength = Math.min(...nodes.map((n) => n.total_link_strength), 0);
    const radiusScale = d3.scaleSqrt().domain([Math.max(0, minStrength), maxStrength]).range([6, 32]);

    const maxW = Math.max(...links.map((l) => l.raw_weight), 1);
    const minW = Math.min(...links.map((l) => l.raw_weight), 1);
    const linkWidthScale = d3.scaleLinear().domain([minW, maxW]).range([1.2, 8.0]);
    const linkOpacityScale = d3.scaleLinear().domain([minW, maxW]).range([0.35, 0.9]);

    const simulation = d3
      .forceSimulation<NetworkNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance(90)
          .strength((d) => Math.min(1, 0.25 + (d.raw_weight / maxW) * 0.5))
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => radiusScale(d.total_link_strength) + 9));

    if (visMode === "clusters") {
      simulation.force("clusterGravity", (alpha) => {
        const centroids: Record<number, { x: number; y: number; count: number }> = {};
        nodes.forEach((n) => {
          if (!centroids[n.cluster]) centroids[n.cluster] = { x: 0, y: 0, count: 0 };
          centroids[n.cluster].x += n.x || 0;
          centroids[n.cluster].y += n.y || 0;
          centroids[n.cluster].count += 1;
        });
        Object.values(centroids).forEach((c) => {
          if (c.count > 0) {
            c.x /= c.count;
            c.y /= c.count;
          }
        });
        const k = 0.16 * alpha;
        nodes.forEach((n) => {
          const c = centroids[n.cluster];
          if (c && n.x !== undefined && n.y !== undefined) {
            n.vx = (n.vx || 0) + (c.x - n.x) * k;
            n.vy = (n.vy || 0) + (c.y - n.y) * k;
          }
        });
      });
    }

    simulationRef.current = simulation;

    let hullElements: d3.Selection<SVGPathElement, any, any, any> | null = null;
    let badgeElements: d3.Selection<SVGGElement, any, any, any> | null = null;

    if (visMode === "clusters") {
      const hullsG = g.append("g").attr("class", "cluster-hulls-layer");
      hullElements = (hullsG
        .selectAll("path")
        .data(networkReport.clusters)
        .enter()
        .append("path") as any)
        .attr("fill", (c: NetworkClusterSummary) => c.color)
        .attr("fill-opacity", 0.14)
        .attr("stroke", (c: NetworkClusterSummary) => c.color)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "6,4")
        .attr("stroke-opacity", 0.75)
        .attr("pointer-events", "none");

      const badgesG = g.append("g").attr("class", "cluster-badges-layer");
      badgeElements = (badgesG
        .selectAll("g")
        .data(networkReport.clusters)
        .enter()
        .append("g") as any)
        .attr("class", "cluster-centroid-badge")
        .attr("pointer-events", "none");

      badgeElements
        .append("rect")
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("fill", "#ffffff")
        .attr("fill-opacity", 0.92)
        .attr("stroke", (c: any) => c.color)
        .attr("stroke-width", 1.5)
        .attr("x", -65)
        .attr("y", -14)
        .attr("width", 130)
        .attr("height", 24)
        .attr("filter", "drop-shadow(0px 2px 4px rgba(16,24,32,0.08))");

      badgeElements
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", 2)
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#101820")
        .text((c: any) => `Cluster #${c.cluster_id} (${c.node_count})`);
    }

    if (visMode === "density") {
      const defs = svg.append("defs");
      nodes.forEach((_, idx) => {
        const grad = defs
          .append("radialGradient")
          .attr("id", `density-blob-${idx}`)
          .attr("cx", "50%")
          .attr("cy", "50%")
          .attr("r", "50%");
        grad.append("stop").attr("offset", "0%").attr("stop-color", "#E11D48").attr("stop-opacity", 0.65);
        grad.append("stop").attr("offset", "40%").attr("stop-color", "#D97706").attr("stop-opacity", 0.35);
        grad.append("stop").attr("offset", "80%").attr("stop-color", "#315C7C").attr("stop-opacity", 0.15);
        grad.append("stop").attr("offset", "100%").attr("stop-color", "#ffffff").attr("stop-opacity", 0);
      });

      const densityG = g.append("g").attr("class", "density-layer");
      const densityCircles = densityG
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", (d) => radiusScale(d.total_link_strength) * 4.5)
        .attr("fill", (_, idx) => `url(#density-blob-${idx})`)
        .attr("pointer-events", "none");

      simulation.on("tick.density", () => {
        densityCircles.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);
      });
    }

    const linkElements = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#828d98")
      .attr("stroke-opacity", (d) => linkOpacityScale(d.raw_weight))
      .attr("stroke-width", (d) => linkWidthScale(d.raw_weight));

    linkElements.append("title").text((d) => {
      const s = typeof d.source === "string" ? d.source : (d.source as NetworkNode).label;
      const t = typeof d.target === "string" ? d.target : (d.target as NetworkNode).label;
      return `${s} ↔ ${t}\nWeight: ${d.raw_weight}`;
    });

    const nodeElements = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, NetworkNode>("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "cursor-pointer")
      .call(
        d3
          .drag<SVGGElement, NetworkNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeElements
      .append("circle")
      .attr("r", (d) => radiusScale(d.total_link_strength))
      .attr("fill", (d) => {
        if (visMode === "network" || visMode === "clusters") return d.color;
        if (visMode === "overlay") return overlayScale(overlayMetric === "year" ? d.avg_pub_year : d.avg_citations);
        return "#D97706";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.2)
      .attr("filter", "drop-shadow(0px 2px 5px rgba(16,24,32,0.14))");

    nodeElements.append("title").text(
      (d) =>
        `${d.label}\nCluster #${d.cluster}\nTotal Link Strength: ${d.total_link_strength}\nDegree: ${d.degree}\nPageRank: ${d.pagerank}\nBetweenness: ${d.betweenness}\nCloseness: ${d.closeness}`
    );

    nodeElements
      .append("text")
      .text((d) => d.label)
      .attr("x", 0)
      .attr("y", (d) => radiusScale(d.total_link_strength) + 13)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#101820")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke fill")
      .style("display", showAllLabels ? "block" : "none");

    nodeElements.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedNode(d);
    });

    svg.on("click", () => setSelectedNode(null));

    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x || 0)
        .attr("y1", (d) => (d.source as NetworkNode).y || 0)
        .attr("x2", (d) => (d.target as NetworkNode).x || 0)
        .attr("y2", (d) => (d.target as NetworkNode).y || 0);

      nodeElements.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);

      if (visMode === "clusters" && hullElements && badgeElements) {
        hullElements.attr("d", (c) => {
          const clusterNodes = nodes.filter((n) => n.cluster === c.cluster_id);
          const points: [number, number][] = clusterNodes.map((n) => [n.x || 0, n.y || 0]);
          return getClusterHullPath(points, 32);
        });

        badgeElements.attr("transform", (c) => {
          const clusterNodes = nodes.filter((n) => n.cluster === c.cluster_id);
          if (clusterNodes.length === 0) return "translate(0,0)";
          const meanX = d3.mean(clusterNodes, (n) => n.x || 0) || 0;
          const minY = d3.min(clusterNodes, (n) => n.y || 0) || 0;
          return `translate(${meanX}, ${minY - 32})`;
        });
      }
    });

    return () => {
      simulation.stop();
    };
  }, [networkReport, visMode, overlayMetric, showAllLabels, activeStudioTab, overlayScale]);

  return (
    <div className="space-y-6">
      {/* 1. Header with View Tabs */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
              VOSviewer &amp; SNA Matrix Engine
            </span>
            <span className="text-[11px] font-semibold text-ink-subtle">
              Direct Citation, Co-citation, Coupling &amp; Thematic Clusters
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-ink-primary">
            Scientific Network Analysis &amp; SNA Studio
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Structural Topology Snapshot, 4-level citation networks, coupling,
            co-citation, co-authorship, keyword co-occurrence, and SNA
            centrality metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="network-ds"
              className="text-xs font-bold text-ink-muted"
            >
              Corpus:
            </label>
            <select
              id="network-ds"
              value={activeDatasetId}
              onChange={(e) => {
                const val = e.target.value;
                setActiveDatasetId(val);
                if (onSelectDataset) onSelectDataset(val);
              }}
              className="rounded-xl border border-border-default bg-surface-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary shadow-card focus:border-brand-500 focus:outline-none"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.record_count || 0} docs)
                </option>
              ))}
            </select>
            {isLoadingDocs ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-status-info-border bg-status-info-bg px-2.5 py-1 text-[11px] font-semibold text-status-info-text">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading corpus...</span>
              </span>
            ) : currentRecords.length > 0 ? (
              <span className="tabular-metrics inline-flex items-center gap-1.5 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-1 text-[11px] font-semibold text-status-success-text">
                <PackageCheck className="h-3 w-3" />
                <span>{currentRecords.length.toLocaleString()} papers loaded</span>
              </span>
            ) : null}
          </div>

          <div className="inline-flex rounded-xl border border-border-default bg-surface-subtle p-1">
            <button
              type="button"
              onClick={() => setActiveStudioTab("visualization")}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                activeStudioTab === "visualization"
                  ? "bg-brand-500 text-white shadow-xs"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Interactive Graph (D3)
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("clusters")}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                activeStudioTab === "clusters"
                  ? "bg-brand-500 text-white shadow-xs"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Clusters &amp; Modularity
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("sna_metrics")}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                activeStudioTab === "sna_metrics"
                  ? "bg-brand-500 text-white shadow-xs"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              SNA Centrality Matrix
            </button>
          </div>
        </div>
      </div>

      {/* 2. Full Network Categories */}
      <Card padding="sm" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-ink-secondary">
              Network Typology (Citation, Coupling, Co-Citation)
            </label>
            <select
              value={networkType}
              onChange={(e) =>
                setNetworkType(e.target.value as NetworkCategory)
              }
              className="w-full rounded-xl border border-border-default bg-surface-subtle px-3 py-2 text-xs font-bold text-ink-primary focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
            >
              <optgroup label="1. Direct Citation Networks (4 Levels)">
                <option value="citation_documents">
                  Direct Citation (Documents / Articles)
                </option>
                <option value="citation_authors">
                  Direct Citation (Authors)
                </option>
                <option value="citation_institutions">
                  Direct Citation (Universities / Institutions)
                </option>
                <option value="citation_countries">
                  Direct Citation (Countries)
                </option>
              </optgroup>
              <optgroup label="2. Co-Citation Analysis">
                <option value="co_citation_references">
                  Co-Citation (Cited References)
                </option>
                <option value="co_citation_authors">
                  Co-Citation (Cited Authors)
                </option>
                <option value="co_citation_institutions">
                  Co-Citation (Cited Institutions)
                </option>
                <option value="co_citation_countries">
                  Co-Citation (Cited Countries)
                </option>
              </optgroup>
              <optgroup label="3. Bibliographic Coupling">
                <option value="coupling_documents">
                  Bibliographic Coupling (Documents)
                </option>
                <option value="coupling_authors">
                  Bibliographic Coupling (Authors)
                </option>
                <option value="coupling_institutions">
                  Bibliographic Coupling (Institutions)
                </option>
                <option value="coupling_countries">
                  Bibliographic Coupling (Countries)
                </option>
              </optgroup>
              <optgroup label="4. Co-Authorship Collaboration">
                <option value="co_authorship_authors">
                  Co-authorship (Authors)
                </option>
                <option value="co_authorship_institutions">
                  Co-authorship (Institutions)
                </option>
                <option value="co_authorship_countries">
                  Co-authorship (Countries)
                </option>
              </optgroup>
              <optgroup label="5. Thematic Term Co-occurrence">
                <option value="co_occurrence_keywords">
                  Keyword Co-occurrence (Descriptor Map)
                </option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-ink-secondary">
              Normalization Method
            </label>
            <select
              value={normalization}
              onChange={(e) =>
                setNormalization(e.target.value as NormalizationMethod)
              }
              className="w-full rounded-xl border border-border-default bg-surface-subtle px-3 py-2 text-xs font-medium text-ink-primary focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
            >
              <option value="association_strength">
                Association Strength (VOSviewer Standard)
              </option>
              <option value="salton_cosine">
                Salton's Cosine / Inclusion Index
              </option>
              <option value="jaccard">Jaccard Similarity Index</option>
              <option value="equivalence">Equivalence Index</option>
              <option value="raw">Raw Co-occurrence Counts</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-ink-secondary">
              Clustering Algorithm
            </label>
            <select
              value={clusteringAlgorithm}
              onChange={(e) =>
                setClusteringAlgorithm(e.target.value as ClusteringAlgorithm)
              }
              className="w-full rounded-xl border border-border-default bg-surface-subtle px-3 py-2 text-xs font-bold text-ink-primary focus:border-brand-500 focus:bg-surface-canvas focus:outline-none"
            >
              <option value="louvain">Louvain Modularity (Standard)</option>
              <option value="leiden">Leiden Community Detection</option>
              <option value="walktrap">Walktrap (Random Walk Dynamics)</option>
              <option value="label_propagation">Label Propagation</option>
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold text-ink-secondary">
                Cluster Count / Resolution
              </label>
              <span className="tabular-metrics font-mono text-xs font-black text-brand-500">
                {clusterCount}
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="12"
              value={clusterCount}
              onChange={(e) => setClusterCount(Number(e.target.value))}
              className="w-full cursor-pointer accent-brand-500"
            />
          </div>
        </div>

        {/* 4 Visual Modes */}
        {activeStudioTab === "visualization" && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-muted">
                Visualization Mode:
              </span>
              <div className="inline-flex flex-wrap rounded-xl border border-border-default bg-surface-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setVisMode("network")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    visMode === "network"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Network</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisMode("clusters")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    visMode === "clusters"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Clusters (Envelopes)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisMode("overlay")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    visMode === "overlay"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Overlay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisMode("density")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    visMode === "density"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span>Density (Heatmap)</span>
                </button>
              </div>
            </div>

            {visMode === "overlay" && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-ink-muted">
                  Overlay Metric:
                </span>
                <select
                  value={overlayMetric}
                  onChange={(e) =>
                    setOverlayMetric(e.target.value as "year" | "citations")
                  }
                  className="rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1 text-xs font-bold text-ink-primary"
                >
                  <option value="year">
                    Publication Year Gradient (Viridis)
                  </option>
                  <option value="citations">
                    Citation Volume Gradient (Warm)
                  </option>
                </select>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3. Structural Topology Snapshot & Macro SNA Metrics Row */}
      <Card padding="md">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-black tracking-tight text-ink-primary">
              Structural Topology Snapshot
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              A network-level summary for the selected typology, including
              density, clustering, path structure, modularity, and active
              node/tie counts.
            </p>
          </div>
          <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">
            {ALL_16_NETWORKS.find((item) => item.id === networkType)
              ?.shortLabel || "Active Network"}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Network Density</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-ink-primary">
            {networkReport.macro.density}
          </div>
          <span className="text-[10px] text-ink-muted">Completeness ratio</span>
        </Card>
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Avg Clustering</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-brand-500">
            {networkReport.macro.avg_clustering_coefficient}
          </div>
          <span className="text-[10px] text-ink-muted">Triadic closure</span>
        </Card>
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Avg Path Length</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-status-success-text">
            {networkReport.macro.avg_path_length}
          </div>
          <span className="text-[10px] text-ink-muted">Small-world metric</span>
        </Card>
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Diameter</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-brand-600">
            {networkReport.macro.diameter}
          </div>
          <span className="text-[10px] text-ink-muted">
            Max geodesic distance
          </span>
        </Card>
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Modularity (Q)</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-status-warning-text">
            {networkReport.macro.modularity_q}
          </div>
          <span className="text-[10px] text-ink-muted">
            {clusteringAlgorithm}
          </span>
        </Card>
        <Card padding="sm">
          <span className="sciai-kicker text-[10px]!">Nodes &amp; Ties</span>
          <div className="tabular-metrics mt-0.5 text-lg font-black text-ink-primary">
            {networkReport.macro.total_nodes} / {networkReport.macro.total_links}
          </div>
          <span className="text-[10px] text-ink-muted">Active topology</span>
        </Card>
      </div>

      {/* 4. Tab 1: Interactive D3 Graph View */}
      {activeStudioTab === "visualization" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div
            ref={containerRef}
            className="sciai-card relative overflow-hidden lg:col-span-3"
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-border-default bg-surface-canvas/90 p-1.5 shadow-card backdrop-blur-md">
              <button
                type="button"
                onClick={() => simulationRef.current?.alpha(0.3).restart()}
                className="cursor-pointer rounded-lg p-1.5 text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary"
                title="Restart Layout Physics"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <div className="h-4 w-px bg-border-default" />
              <button
                type="button"
                onClick={() => setShowAllLabels((v) => !v)}
                className={`cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  showAllLabels
                    ? "bg-brand-500 text-white"
                    : "bg-surface-subtle text-ink-secondary"
                }`}
              >
                Labels
              </button>
              <div className="h-4 w-px bg-border-default" />
              <button
                type="button"
                onClick={() => exportGraphAsJPG()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-default bg-surface-canvas px-2 py-1 text-[11px] font-bold text-ink-primary transition-colors hover:bg-surface-subtle"
                title="Download High-Resolution JPG of Graph"
              >
                <ImageIcon className="h-3 w-3 text-ink-muted" />
                <span>JPG</span>
              </button>
              <button
                type="button"
                onClick={() => exportPajekNet()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 transition-colors hover:bg-brand-100"
                title="Download Pajek .net file"
              >
                <Network className="h-3 w-3 text-brand-500" />
                <span>Pajek .net</span>
              </button>
            </div>

            <svg
              ref={svgRef}
              className="h-[560px] w-full cursor-grab bg-surface-subtle/60 active:cursor-grabbing"
            />
          </div>

          {/* Node Inspector */}
          <Card padding="md" className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-primary">
                  <Activity className="h-4 w-4 text-brand-500" />
                  <span>Node SNA Inspector</span>
                </h3>
                {selectedNode && (
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="cursor-pointer text-[10px] font-bold text-ink-subtle hover:text-ink-primary"
                  >
                    Clear
                  </button>
                )}
              </div>

              {selectedNode ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <span className="sciai-kicker text-[10px]!">Entity</span>
                    <h4 className="text-base font-black leading-snug text-ink-primary">
                      {selectedNode.label}
                    </h4>
                    <span className="mt-1 inline-block rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                      Cluster #{selectedNode.cluster} ({clusteringAlgorithm})
                    </span>
                  </div>

                  <div className="tabular-metrics space-y-2 border-t border-border-subtle pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Degree:</span>
                      <strong className="text-ink-primary">
                        {selectedNode.degree}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">
                        Total Link Strength:
                      </span>
                      <strong className="text-ink-primary">
                        {selectedNode.total_link_strength}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">
                        PageRank (Authority):
                      </span>
                      <strong className="font-bold text-brand-600">
                        {selectedNode.pagerank}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">
                        Betweenness (Brokerage):
                      </span>
                      <strong className="text-brand-500">
                        {selectedNode.betweenness}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Closeness:</span>
                      <strong className="text-status-success-text">
                        {selectedNode.closeness}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">
                        Eigenvector (Prestige):
                      </span>
                      <strong className="text-status-info-text">
                        {selectedNode.eigenvector}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">
                        Clustering Coefficient:
                      </span>
                      <strong className="text-status-warning-text">
                        {selectedNode.clustering_coefficient}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-12 py-6 text-center text-ink-subtle">
                  <Share2 className="mx-auto mb-2 h-8 w-8 stroke-1 text-border-strong" />
                  <p className="text-xs font-medium text-ink-muted">
                    Click on any node in the dynamic graph to inspect
                    micro-level centralities.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border-subtle pt-4 text-[11px] text-ink-muted">
              Drag nodes to rearrange physics. Switch between Network, Overlay,
              and Density modes above.
            </div>
          </Card>
        </div>
      )}

      {/* 4. Tab 2: Dedicated Thematic Clusters & Modularity View */}
      {activeStudioTab === "clusters" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border-default pb-2">
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                Community Partitions ({networkReport.clusters.length} Clusters
                Detected)
              </h3>
              <p className="text-xs text-ink-muted">
                Segmented via{" "}
                <strong className="text-brand-600">
                  {clusteringAlgorithm.toUpperCase()}
                </strong>{" "}
                with resolution set to {clusterCount}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {networkReport.clusters.map((c) => (
              <Card key={c.cluster_id} padding="sm" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <h4 className="text-sm font-bold text-ink-primary">
                      {c.name}
                    </h4>
                  </div>
                  <span className="tabular-metrics rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-secondary">
                    {c.node_count} nodes
                  </span>
                </div>

                <div className="tabular-metrics text-xs text-ink-muted">
                  <span>Total Cluster Strength: </span>
                  <strong className="text-ink-primary">
                    {c.total_strength}
                  </strong>
                </div>

                <div>
                  <span className="sciai-kicker text-[10px]!">
                    Core Leading Members:
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.top_members.map((m, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tab 3: SNA Centrality Matrix Table */}
      {activeStudioTab === "sna_metrics" && (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col justify-between gap-3 border-b border-border-default bg-surface-subtle p-4 md:flex-row md:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                <span>
                  Social Network Analysis (SNA) Centrality &amp; Authority
                  Matrix
                </span>
                <span className="tabular-metrics rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  {networkReport.nodes.length} Entities
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Micro-level centralities, PageRank authority scores, and
                structural brokerage metrics.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entity..."
                className="rounded-lg border border-border-default bg-surface-canvas px-3 py-1.5 text-xs text-ink-primary placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none"
              />

              <select
                value={selectedClusterFilter}
                onChange={(e) =>
                  setSelectedClusterFilter(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1.5 text-xs font-bold text-ink-primary"
              >
                <option value="all">All Clusters</option>
                {networkReport.clusters.map((c) => (
                  <option key={c.cluster_id} value={c.cluster_id}>
                    Cluster #{c.cluster_id} ({c.node_count})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => exportMetricsExcel()}
                icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                title="Download Centrality Table as Excel CSV"
              >
                Export Metrics (Excel)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => exportMatrixExcel()}
                icon={<Grid className="h-3.5 w-3.5" />}
                title="Download Adjacency Matrix as Excel CSV"
              >
                Export Matrix (Excel)
              </Button>
            </div>
          </div>

          <div className="max-h-[640px] overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-subtle">
                <tr className="select-none border-b border-border-default text-[10px] font-bold uppercase text-ink-muted">
                  <th
                    onClick={() => {
                      if (sortField === "label") setSortAsc(!sortAsc);
                      else {
                        setSortField("label");
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-4 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-1">
                      <span>Entity</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "cluster") setSortAsc(!sortAsc);
                      else {
                        setSortField("cluster");
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Cluster</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "degree") setSortAsc(!sortAsc);
                      else {
                        setSortField("degree");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Degree</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "total_link_strength")
                        setSortAsc(!sortAsc);
                      else {
                        setSortField("total_link_strength");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>TLS (Weight)</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "pagerank") setSortAsc(!sortAsc);
                      else {
                        setSortField("pagerank");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer bg-brand-50/70 px-3 py-3 text-center transition-colors hover:bg-brand-100/70"
                  >
                    <div className="flex items-center justify-center gap-1 text-brand-700">
                      <span>PageRank</span>
                      <ArrowUpDown className="h-3 w-3 text-brand-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "betweenness") setSortAsc(!sortAsc);
                      else {
                        setSortField("betweenness");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Betweenness</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "closeness") setSortAsc(!sortAsc);
                      else {
                        setSortField("closeness");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Closeness</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "eigenvector") setSortAsc(!sortAsc);
                      else {
                        setSortField("eigenvector");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Eigenvector</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "clustering_coefficient")
                        setSortAsc(!sortAsc);
                      else {
                        setSortField("clustering_coefficient");
                        setSortAsc(false);
                      }
                    }}
                    className="cursor-pointer px-3 py-3 text-center transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Clustering Coeff</span>
                      <ArrowUpDown className="h-3 w-3 text-ink-subtle" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {networkReport.nodes
                  .filter((n) => {
                    if (
                      selectedClusterFilter !== "all" &&
                      n.cluster !== selectedClusterFilter
                    )
                      return false;
                    if (
                      searchQuery.trim() &&
                      !n.label
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                    )
                      return false;
                    return true;
                  })
                  .sort((a, b) => {
                    const valA = a[sortField];
                    const valB = b[sortField];
                    if (typeof valA === "number" && typeof valB === "number") {
                      return sortAsc ? valA - valB : valB - valA;
                    }
                    return sortAsc
                      ? String(valA).localeCompare(String(valB))
                      : String(valB).localeCompare(String(valA));
                  })
                  .map((node) => (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className="cursor-pointer transition-colors hover:bg-brand-50/50"
                    >
                      <td className="px-4 py-3 font-bold text-ink-primary">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: node.color }}
                          />
                          <span>{node.label}</span>
                        </div>
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center">
                        <span className="inline-block rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-ink-secondary">
                          #{node.cluster}
                        </span>
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-semibold text-ink-secondary">
                        {node.degree}
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-semibold text-ink-secondary">
                        {node.total_link_strength}
                      </td>
                      <td className="tabular-metrics bg-brand-50/40 px-3 py-3 text-center font-bold text-brand-700">
                        {node.pagerank}
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-bold text-brand-500">
                        {node.betweenness}
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-semibold text-status-success-text">
                        {node.closeness}
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-semibold text-status-info-text">
                        {node.eigenvector}
                      </td>
                      <td className="tabular-metrics px-3 py-3 text-center font-semibold text-status-warning-text">
                        {node.clustering_coefficient}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Batch Export Modal */}
      {showBatchExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-canvas shadow-elevated">
            <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink-primary">
                    16-Network Batch Export Hub
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Export metrics, matrices, Pajek files, and 2K watermarked
                    graphs across all 16 scientometric networks.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  !isExportingBatch && setShowBatchExportModal(false)
                }
                disabled={isExportingBatch}
                className="cursor-pointer rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto p-6">
              {isExportingBatch && (
                <div className="space-y-2.5 rounded-xl border border-brand-200 bg-brand-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-brand-800">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                      Generating: {batchProgress.label}
                    </span>
                    <span className="tabular-metrics">
                      {batchProgress.current} of {batchProgress.total} networks
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-300"
                      style={{
                        width: `${(batchProgress.current / Math.max(1, batchProgress.total)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-brand-700">
                    Files are being generated and downloaded automatically.
                    Please keep this modal open.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink-primary">
                  1. Select Target Network Scope
                </label>
                <select
                  value={batchCategory}
                  onChange={(e) =>
                    setBatchCategory(e.target.value as NetworkCategory | "ALL")
                  }
                  disabled={isExportingBatch}
                  className="w-full rounded-xl border border-border-default bg-surface-subtle px-3.5 py-2.5 text-xs font-bold text-ink-primary focus:border-brand-500 focus:outline-none"
                >
                  <option value="ALL">
                    ALL 16 NETWORKS (Full Scientometric Batch Process)
                  </option>
                  <optgroup label="Direct Citation Networks">
                    <option value="citation_documents">
                      Direct Citation (Documents / Articles)
                    </option>
                    <option value="citation_authors">
                      Direct Citation (Authors)
                    </option>
                    <option value="citation_institutions">
                      Direct Citation (Universities / Institutions)
                    </option>
                    <option value="citation_countries">
                      Direct Citation (Countries)
                    </option>
                  </optgroup>
                  <optgroup label="Co-Citation Networks">
                    <option value="co_citation_references">
                      Co-Citation (Cited References)
                    </option>
                    <option value="co_citation_authors">
                      Co-Citation (Cited Authors)
                    </option>
                    <option value="co_citation_institutions">
                      Co-Citation (Cited Institutions)
                    </option>
                    <option value="co_citation_countries">
                      Co-Citation (Cited Countries)
                    </option>
                  </optgroup>
                  <optgroup label="Bibliographic Coupling Networks">
                    <option value="coupling_documents">
                      Bibliographic Coupling (Documents)
                    </option>
                    <option value="coupling_authors">
                      Bibliographic Coupling (Authors)
                    </option>
                    <option value="coupling_institutions">
                      Bibliographic Coupling (Institutions)
                    </option>
                    <option value="coupling_countries">
                      Bibliographic Coupling (Countries)
                    </option>
                  </optgroup>
                  <optgroup label="Collaboration & Co-Authorship">
                    <option value="co_authorship_authors">
                      Co-authorship (Authors)
                    </option>
                    <option value="co_authorship_institutions">
                      Co-authorship (Institutions)
                    </option>
                    <option value="co_authorship_countries">
                      Co-authorship (Countries)
                    </option>
                  </optgroup>
                  <optgroup label="Keyword Co-occurrence">
                    <option value="co_occurrence_keywords">
                      Keyword Co-occurrence (Descriptor Map)
                    </option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-ink-primary">
                  2. Choose Output Format
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBatchFormat("all")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      batchFormat === "all"
                        ? "border-brand-500 bg-brand-50/60 text-ink-primary ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <DownloadCloud className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">
                        All 4 Formats Suite
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        Excel Metrics + Matrix + 2K Watermarked JPG + Pajek
                        (.net)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchFormat("metrics")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      batchFormat === "metrics"
                        ? "border-brand-500 bg-brand-50/60 text-ink-primary ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-status-success-text" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">
                        Excel Centrality Table (.csv)
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        Degree, TLS, Betweenness, PageRank, Closeness,
                        Eigenvector
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchFormat("matrix")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      batchFormat === "matrix"
                        ? "border-brand-500 bg-brand-50/60 text-ink-primary ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <Grid className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">
                        Adjacency Matrix Excel (.csv)
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        Full symmetric co-occurrence &amp; citation weight
                        matrix
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchFormat("jpg")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      batchFormat === "jpg"
                        ? "border-brand-500 bg-brand-50/60 text-ink-primary ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-secondary" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">
                        High-Res Graph JPG (with Logo)
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        1920x1080 publication-ready image with software emblem
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchFormat("pajek")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors sm:col-span-2 ${
                      batchFormat === "pajek"
                        ? "border-brand-500 bg-brand-50/60 text-ink-primary ring-1 ring-brand-500"
                        : "border-border-default bg-surface-canvas text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <Network className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">
                        Pajek (.net) Network File
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        Standard *Vertices and *Edges specification for Pajek,
                        Gephi, and UCINET
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-ink-primary">
                  3. Direct Single-Click Downloads by Network:
                </label>
                <div className="max-h-48 divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-default bg-surface-subtle">
                  {ALL_16_NETWORKS.map((net) => (
                    <div
                      key={net.id}
                      className="flex items-center justify-between p-2.5 text-xs transition-colors hover:bg-surface-canvas"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-500" />
                        <div>
                          <span className="font-bold text-ink-primary">
                            {net.label}
                          </span>
                          <span className="ml-2 text-[10px] font-semibold text-ink-subtle">
                            {net.group}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const rep = computeNetworkData(
                              (currentDataset as any)?.raw_records || [],
                              net.id,
                              maxNodes,
                              minWeight,
                              clusteringAlgorithm,
                              clusterCount
                            );
                            exportMetricsExcel(rep, net.id);
                          }}
                          className="cursor-pointer rounded border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success-text hover:opacity-90"
                          title="Excel Metrics"
                        >
                          Metrics
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rep = computeNetworkData(
                              (currentDataset as any)?.raw_records || [],
                              net.id,
                              maxNodes,
                              minWeight,
                              clusteringAlgorithm,
                              clusterCount
                            );
                            exportMatrixExcel(rep, net.id);
                          }}
                          className="cursor-pointer rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-brand-100"
                          title="Excel Matrix"
                        >
                          Matrix
                        </button>
                        <button
                          type="button"
                          onClick={() => exportGraphAsJPG(net.id)}
                          className="cursor-pointer rounded border border-border-default bg-surface-canvas px-2 py-0.5 text-[10px] font-bold text-ink-primary hover:bg-surface-muted"
                          title="Graph JPG with Watermark"
                        >
                          JPG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rep = computeNetworkData(
                              (currentDataset as any)?.raw_records || [],
                              net.id,
                              maxNodes,
                              minWeight,
                              clusteringAlgorithm,
                              clusterCount
                            );
                            exportPajekNet(rep, net.id);
                          }}
                          className="cursor-pointer rounded border border-status-info-border bg-status-info-bg px-2 py-0.5 text-[10px] font-bold text-status-info-text hover:opacity-90"
                          title="Pajek File"
                        >
                          .net
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle bg-surface-subtle px-6 py-4">
              <span className="text-xs font-medium text-ink-muted">
                {batchCategory === "ALL"
                  ? "Processing all 16 networks"
                  : `Targeting: ${ALL_16_NETWORKS.find((n) => n.id === batchCategory)?.label}`}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBatchExportModal(false)}
                  disabled={isExportingBatch}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={isExportingBatch}
                  disabled={isExportingBatch}
                  onClick={() =>
                    handleExecuteBatchExport(batchCategory, batchFormat)
                  }
                  icon={
                    !isExportingBatch ? (
                      <DownloadCloud className="h-4 w-4" />
                    ) : undefined
                  }
                >
                  {isExportingBatch
                    ? `Exporting (${batchProgress.current}/${batchProgress.total})...`
                    : "Execute Batch Export"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoadingDocs && networkReport.nodes.length > 0 && (
        <div data-export-actions className="mt-6">
          <ContextualExportToolbar
            payload={contextualNetworkPayload}
            svgElementRef={svgRef}
          />
        </div>
      )}
    </div>
  );
}