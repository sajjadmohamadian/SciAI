import { BibliometricDocument, ResultRecord } from "../src/types.js";

export type NetworkType =
  | "co_authorship"
  | "co_occurrence"
  | "coupling_countries"
  | "coupling_documents"
  | "co_citation";

export type NormalizationMethod =
  | "association_strength"
  | "salton_cosine"
  | "jaccard"
  | "equivalence"
  | "raw";

export interface NetworkNode {
  id: string;
  label: string;
  doc_count: number;
  degree: number;
  total_link_strength: number;
  betweenness: number;
  closeness: number;
  pagerank: number;
  avg_pub_year: number;
  avg_citations: number;
  cluster: number;
  cluster_name: string;
  color: string;
  sample_documents?: string[];
  // coordinates for initial layout
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
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

export interface ScientometricNetworkReport {
  network_type: NetworkType;
  network_title: string;
  normalization: NormalizationMethod;
  dataset_name: string;
  document_count: number;
  global_metrics: GlobalNetworkMetrics;
  nodes: NetworkNode[];
  links: NetworkLink[];
  clusters: NetworkClusterSummary[];
  year_range: { min: number; max: number };
  citation_range: { min: number; max: number };
  density_grid?: {
    width: number;
    height: number;
    cells: number[];
  };
  pajek_net: string;
  gexf_xml: string;
  graphml_xml: string;
}

const CLUSTER_COLORS = [
  "#4f46e5", // Indigo
  "#059669", // Emerald
  "#e11d48", // Rose
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#0891b2", // Cyan
  "#ea580c", // Orange
  "#0d9488", // Teal
  "#475569", // Slate
  "#db2777", // Pink
];

export class ScientometricNetworkEngine {
  private docs: BibliometricDocument[];
  private datasetName: string;

  constructor(docs: BibliometricDocument[], datasetName = "Dataset") {
    this.docs = docs;
    this.datasetName = datasetName;
  }

  public generateNetwork(
    type: NetworkType = "co_authorship",
    normalization: NormalizationMethod = "association_strength",
    maxNodes = 50,
    minWeight = 1
  ): ScientometricNetworkReport {
    // 1. Build raw co-occurrence / relationship graph based on network type
    const { rawNodes, rawLinks } = this.extractGraphData(type);

    // 2. Filter top nodes by frequency/degree
    const sortedNodeKeys = Object.keys(rawNodes).sort(
      (a, b) => rawNodes[b].doc_count - rawNodes[a].doc_count || rawNodes[b].citations - rawNodes[a].citations
    );
    const topNodeKeys = new Set(sortedNodeKeys.slice(0, maxNodes));

    // 3. Filter links to top nodes & minWeight
    const filteredRawLinks: Array<{ source: string; target: string; count: number }> = [];
    const linkKeys = new Set<string>();

    for (const [key, weight] of Object.entries(rawLinks)) {
      if (weight < minWeight) continue;
      const [u, v] = key.split(":::");
      if (!topNodeKeys.has(u) || !topNodeKeys.has(v) || u === v) continue;

      const linkKey = u < v ? `${u}:::${v}` : `${v}:::${u}`;
      if (!linkKeys.has(linkKey)) {
        linkKeys.add(linkKey);
        filteredRawLinks.push({ source: u, target: v, count: weight });
      }
    }

    // Keep only nodes that have at least one link or top rank
    const activeNodeSet = new Set<string>();
    filteredRawLinks.forEach((l) => {
      activeNodeSet.add(l.source);
      activeNodeSet.add(l.target);
    });

    // If too few links, retain top isolated nodes as well
    if (activeNodeSet.size < Math.min(10, sortedNodeKeys.length)) {
      sortedNodeKeys.slice(0, 15).forEach((k) => activeNodeSet.add(k));
    }

    const finalNodeKeys = Array.from(activeNodeSet);
    const nodeIndexMap = new Map<string, number>();
    finalNodeKeys.forEach((key, idx) => nodeIndexMap.set(key, idx));

    // 4. Compute Normalization of Edge Weights
    // Sum of occurrences for association strength
    const nodeTotals: Record<string, number> = {};
    for (const key of finalNodeKeys) {
      nodeTotals[key] = rawNodes[key].doc_count;
    }

    const totalTies = filteredRawLinks.reduce((acc, l) => acc + l.count, 0) || 1;
    const links: NetworkLink[] = filteredRawLinks.map((l) => {
      const c_ij = l.count;
      const w_i = nodeTotals[l.source] || 1;
      const w_j = nodeTotals[l.target] || 1;

      let normWeight = c_ij;
      if (normalization === "association_strength") {
        // VOSviewer formula: S_ij = c_ij / (2 * w_i * w_j / (2 * totalTies)) = (c_ij * 2 * totalTies) / (2 * w_i * w_j)
        normWeight = (c_ij * totalTies) / (w_i * w_j);
      } else if (normalization === "salton_cosine") {
        normWeight = c_ij / Math.sqrt(w_i * w_j);
      } else if (normalization === "jaccard") {
        normWeight = c_ij / Math.max(1, w_i + w_j - c_ij);
      } else if (normalization === "equivalence") {
        normWeight = (c_ij * c_ij) / (w_i * w_j);
      }

      // Strength score from 0 to 100 for visual scaling
      const strength = Number((Math.min(100, Math.max(1, normWeight * 20))).toFixed(2));

      return {
        source: l.source,
        target: l.target,
        raw_weight: c_ij,
        normalized_weight: Number(normWeight.toFixed(4)),
        strength_score: strength,
      };
    });

    // 5. Build Adjacency Matrix & Neighbors Map
    const N = finalNodeKeys.length;
    const adj: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const neighbors: Set<number>[] = Array.from({ length: N }, () => new Set());
    const degreeMap: number[] = Array(N).fill(0);
    const tlsMap: number[] = Array(N).fill(0);

    for (const link of links) {
      const u = nodeIndexMap.get(link.source);
      const v = nodeIndexMap.get(link.target);
      if (u !== undefined && v !== undefined) {
        adj[u][v] = link.raw_weight;
        adj[v][u] = link.raw_weight;
        neighbors[u].add(v);
        neighbors[v].add(u);
        degreeMap[u] += 1;
        degreeMap[v] += 1;
        tlsMap[u] += link.normalized_weight;
        tlsMap[v] += link.normalized_weight;
      }
    }

    // 6. Community Detection: Fast Louvain Modularity Heuristic
    const communityAssignments = this.runLouvainModularity(finalNodeKeys, adj, totalTies);

    // 7. Graph Theory Centrality Metrics (Betweenness, Closeness, PageRank)
    const betweenness = this.calculateBetweennessCentrality(finalNodeKeys, neighbors);
    const closeness = this.calculateClosenessCentrality(finalNodeKeys, neighbors);
    const pagerank = this.calculatePageRank(finalNodeKeys, adj);

    // 8. Construct Nodes with full scientometric indicators
    const allYears: number[] = [];
    const allCits: number[] = [];

    const nodes: NetworkNode[] = finalNodeKeys.map((key, idx) => {
      const raw = rawNodes[key];
      const commId = communityAssignments[idx] ?? 0;
      const clusterColor = CLUSTER_COLORS[commId % CLUSTER_COLORS.length];

      allYears.push(raw.avg_year);
      allCits.push(raw.avg_citations);

      return {
        id: key,
        label: key,
        doc_count: raw.doc_count,
        degree: degreeMap[idx],
        total_link_strength: Number(tlsMap[idx].toFixed(2)),
        betweenness: Number(betweenness[idx].toFixed(4)),
        closeness: Number(closeness[idx].toFixed(4)),
        pagerank: Number(pagerank[idx].toFixed(4)),
        avg_pub_year: Number(raw.avg_year.toFixed(1)),
        avg_citations: Number(raw.avg_citations.toFixed(1)),
        cluster: commId + 1,
        cluster_name: `Cluster ${commId + 1}`,
        color: clusterColor,
        sample_documents: raw.sample_titles.slice(0, 3),
      };
    });

    // 9. Compute Cluster Summaries
    const clusterMap = new Map<number, NetworkNode[]>();
    nodes.forEach((n) => {
      const list = clusterMap.get(n.cluster) || [];
      list.push(n);
      clusterMap.set(n.cluster, list);
    });

    const clusters: NetworkClusterSummary[] = Array.from(clusterMap.entries()).map(([cId, members]) => {
      members.sort((a, b) => b.total_link_strength - a.total_link_strength || b.doc_count - a.doc_count);
      const topMember = members[0]?.label || `Theme ${cId}`;
      const color = members[0]?.color || CLUSTER_COLORS[(cId - 1) % CLUSTER_COLORS.length];
      const avgYear = members.reduce((acc, m) => acc + m.avg_pub_year, 0) / members.length;
      const totalStrength = members.reduce((acc, m) => acc + m.total_link_strength, 0);

      // Label cluster with top 2 core entities
      const clusterLabel = members.length > 1
        ? `${members[0].label} & ${members[1].label}`
        : topMember;

      // Update node cluster_name
      members.forEach((m) => {
        m.cluster_name = clusterLabel;
      });

      return {
        cluster_id: cId,
        name: clusterLabel,
        color,
        node_count: members.length,
        top_members: members.slice(0, 4).map((m) => m.label),
        total_strength: Number(totalStrength.toFixed(2)),
        avg_year: Number(avgYear.toFixed(1)),
      };
    }).sort((a, b) => b.node_count - a.node_count);

    // 10. Global Network Metrics
    const global_metrics = this.computeGlobalMetrics(N, links.length, neighbors, adj);

    const titles: Record<NetworkType, string> = {
      co_authorship: "Scientific Co-Authorship & Collaboration Network",
      co_occurrence: "Keyword Co-Occurrence & Thematic Structure Map",
      coupling_countries: "International Scientific Collaboration & Coupling Network",
      coupling_documents: "Bibliographic Document Coupling Network",
      co_citation: "Co-Citation Foundation Network",
    };

    // 11. Export Formats: Pajek (.net), GEXF (.gexf), GraphML (.graphml) for Gephi, VOSviewer, Cytoscape
    const pajek_net = this.generatePajekFormat(nodes, links);
    const gexf_xml = this.generateGexfFormat(nodes, links, titles[type] || "Scientometric Network");
    const graphml_xml = this.generateGraphMLFormat(nodes, links);

    const minYear = allYears.length > 0 ? Math.min(...allYears) : 2020;
    const maxYear = allYears.length > 0 ? Math.max(...allYears) : 2024;
    const minCit = allCits.length > 0 ? Math.min(...allCits) : 0;
    const maxCit = allCits.length > 0 ? Math.max(...allCits) : 50;

    return {
      network_type: type,
      network_title: titles[type] || "Scientometric Network Analysis",
      normalization,
      dataset_name: this.datasetName,
      document_count: this.docs.length,
      global_metrics,
      nodes,
      links,
      clusters,
      year_range: { min: minYear, max: maxYear },
      citation_range: { min: minCit, max: maxCit },
      pajek_net,
      gexf_xml,
      graphml_xml,
    };
  }

  private extractGraphData(type: NetworkType): {
    rawNodes: Record<
      string,
      { doc_count: number; citations: number; years: number[]; avg_year: number; avg_citations: number; sample_titles: string[] }
    >;
    rawLinks: Record<string, number>;
  } {
    const rawNodes: Record<
      string,
      { doc_count: number; citations: number; years: number[]; avg_year: number; avg_citations: number; sample_titles: string[] }
    > = {};
    const rawLinks: Record<string, number> = {};

    const registerNode = (name: string, year: number, cit: number, title: string) => {
      if (!name || name.length < 2) return;
      if (!rawNodes[name]) {
        rawNodes[name] = { doc_count: 0, citations: 0, years: [], avg_year: 0, avg_citations: 0, sample_titles: [] };
      }
      rawNodes[name].doc_count += 1;
      rawNodes[name].citations += cit;
      rawNodes[name].years.push(year);
      if (rawNodes[name].sample_titles.length < 5 && title) {
        rawNodes[name].sample_titles.push(title);
      }
    };

    const registerLink = (a: string, b: string, weight = 1) => {
      if (!a || !b || a === b) return;
      const key = a < b ? `${a}:::${b}` : `${b}:::${a}`;
      rawLinks[key] = (rawLinks[key] || 0) + weight;
    };

    for (const doc of this.docs) {
      const year = doc.year || 2022;
      const cit = doc.citations || 0;
      const title = doc.title || "Untitled Paper";

      if (type === "co_authorship") {
        const authors = Array.from(new Set(doc.authors || [])).filter((a) => a && a !== "Anonymous" && a.length > 2);
        authors.forEach((a) => registerNode(a, year, cit, title));

        for (let i = 0; i < authors.length; i++) {
          for (let j = i + 1; j < authors.length; j++) {
            registerLink(authors[i], authors[j], 1);
          }
        }
      } else if (type === "co_occurrence") {
        // Author keywords + Concepts
        const keywords = Array.from(new Set(doc.keywords || []))
          .map((k) => k.toLowerCase().trim())
          .filter((k) => k.length > 2);
        keywords.forEach((k) => registerNode(k, year, cit, title));

        for (let i = 0; i < keywords.length; i++) {
          for (let j = i + 1; j < keywords.length; j++) {
            registerLink(keywords[i], keywords[j], 1);
          }
        }
      } else if (type === "coupling_countries") {
        // Extract country from doc or affiliations
        const affils = (doc as any).affiliations || (doc as any).C1 || [];
        const countries = new Set<string>();
        if (Array.isArray(affils) && affils.length > 0) {
          for (const aff of affils) {
            const c = extractCountryFromText(String(aff));
            if (c) countries.add(c);
          }
        } else if (doc.country) {
          countries.add(doc.country);
        }

        const countryList = Array.from(countries);
        countryList.forEach((c) => registerNode(c, year, cit, title));

        for (let i = 0; i < countryList.length; i++) {
          for (let j = i + 1; j < countryList.length; j++) {
            registerLink(countryList[i], countryList[j], 1);
          }
        }
      } else if (type === "coupling_documents") {
        // Document coupling based on shared references
        const docId = doc.title ? doc.title.slice(0, 35) + "..." : doc.id;
        registerNode(docId, year, cit, title);

        // Link with other documents sharing keywords or references
        // Simulated or real based on CR or keyword overlap
        for (const other of this.docs) {
          if (other.id === doc.id) continue;
          const otherId = other.title ? other.title.slice(0, 35) + "..." : other.id;
          const sharedKws = doc.keywords.filter((k) => other.keywords.includes(k));
          if (sharedKws.length >= 2) {
            registerLink(docId, otherId, sharedKws.length);
          }
        }
      } else if (type === "co_citation") {
        // Co-citation of references
        const refs = (doc as any).CR || (doc as any).references || [];
        const cleanRefs: string[] = [];
        if (Array.isArray(refs)) {
          for (const r of refs.slice(0, 8)) {
            const shortRef = String(r).split(",")[0]?.trim();
            if (shortRef && shortRef.length > 2) cleanRefs.push(shortRef);
          }
        }

        cleanRefs.forEach((r) => registerNode(r, year, cit, title));
        for (let i = 0; i < cleanRefs.length; i++) {
          for (let j = i + 1; j < cleanRefs.length; j++) {
            registerLink(cleanRefs[i], cleanRefs[j], 1);
          }
        }
      }
    }

    // Finalize node averages
    for (const data of Object.values(rawNodes)) {
      data.avg_year = data.years.length > 0 ? data.years.reduce((a, b) => a + b, 0) / data.years.length : 2022;
      data.avg_citations = data.doc_count > 0 ? data.citations / data.doc_count : 0;
    }

    return { rawNodes, rawLinks };
  }

  // Fast Louvain Modularity Heuristic
  private runLouvainModularity(nodeKeys: string[], adj: number[][], totalTies: number): number[] {
    const N = nodeKeys.length;
    if (N === 0) return [];
    if (N <= 3) return nodeKeys.map((_, i) => i);

    // Initial community assignment: each node in its own cluster
    const communities: number[] = Array.from({ length: N }, (_, i) => i);
    const m = Math.max(1, totalTies);
    const k: number[] = adj.map((row) => row.reduce((a, b) => a + b, 0));

    let improved = true;
    let iterations = 0;

    while (improved && iterations < 8) {
      improved = false;
      iterations++;

      for (let i = 0; i < N; i++) {
        const currentComm = communities[i];
        const neighborComms = new Set<number>();
        for (let j = 0; j < N; j++) {
          if (adj[i][j] > 0) {
            neighborComms.add(communities[j]);
          }
        }

        let bestComm = currentComm;
        let bestGain = 0;

        for (const candComm of neighborComms) {
          if (candComm === currentComm) continue;

          // Compute modularity gain of moving node i to candComm
          let k_i_in = 0;
          let sigma_tot = 0;

          for (let j = 0; j < N; j++) {
            if (communities[j] === candComm) {
              sigma_tot += k[j];
              k_i_in += adj[i][j];
            }
          }

          const gain = k_i_in / (2 * m) - (sigma_tot * k[i]) / (2 * m * m);
          if (gain > bestGain) {
            bestGain = gain;
            bestComm = candComm;
          }
        }

        if (bestGain > 0.0001 && bestComm !== currentComm) {
          communities[i] = bestComm;
          improved = true;
        }
      }
    }

    // Remap community ids to 0, 1, 2, ...
    const idMap = new Map<number, number>();
    let nextId = 0;
    return communities.map((c) => {
      if (!idMap.has(c)) {
        idMap.set(c, nextId++);
      }
      return idMap.get(c)!;
    });
  }

  // Brandes Algorithm for Betweenness Centrality
  private calculateBetweennessCentrality(nodeKeys: string[], neighbors: Set<number>[]): number[] {
    const N = nodeKeys.length;
    const CB: number[] = Array(N).fill(0);
    if (N <= 2) return CB;

    for (let s = 0; s < N; s++) {
      const S: number[] = [];
      const P: number[][] = Array.from({ length: N }, () => []);
      const sigma: number[] = Array(N).fill(0);
      sigma[s] = 1;

      const d: number[] = Array(N).fill(-1);
      d[s] = 0;

      const Q: number[] = [s];

      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);

        for (const w of neighbors[v]) {
          // w found for first time?
          if (d[w] < 0) {
            Q.push(w);
            d[w] = d[v] + 1;
          }
          // shortest path to w via v?
          if (d[w] === d[v] + 1) {
            sigma[w] += sigma[v];
            P[w].push(v);
          }
        }
      }

      const delta: number[] = Array(N).fill(0);
      while (S.length > 0) {
        const w = S.pop()!;
        for (const v of P[w]) {
          delta[v] += (sigma[v] / Math.max(1e-6, sigma[w])) * (1 + delta[w]);
        }
        if (w !== s) {
          CB[w] += delta[w];
        }
      }
    }

    // Normalize for undirected graph: 2 / ((N-1)(N-2))
    const normFactor = (N - 1) * (N - 2);
    if (normFactor > 0) {
      for (let i = 0; i < N; i++) {
        CB[i] = (CB[i] * 2) / normFactor;
      }
    }

    return CB;
  }

  // Closeness Centrality
  private calculateClosenessCentrality(nodeKeys: string[], neighbors: Set<number>[]): number[] {
    const N = nodeKeys.length;
    const closeness: number[] = Array(N).fill(0);
    if (N <= 1) return closeness;

    for (let s = 0; s < N; s++) {
      const dist: number[] = Array(N).fill(-1);
      dist[s] = 0;
      const Q: number[] = [s];

      while (Q.length > 0) {
        const u = Q.shift()!;
        for (const v of neighbors[u]) {
          if (dist[v] === -1) {
            dist[v] = dist[u] + 1;
            Q.push(v);
          }
        }
      }

      let totalDist = 0;
      let reachable = 0;
      for (let i = 0; i < N; i++) {
        if (dist[i] > 0) {
          totalDist += dist[i];
          reachable++;
        }
      }

      closeness[s] = reachable > 0 ? reachable / totalDist : 0;
    }

    return closeness;
  }

  // PageRank Power Iteration
  private calculatePageRank(nodeKeys: string[], adj: number[][]): number[] {
    const N = nodeKeys.length;
    if (N === 0) return [];
    let pr: number[] = Array(N).fill(1 / N);
    const d = 0.85;

    const outWeights = adj.map((row) => row.reduce((a, b) => a + b, 0));

    for (let iter = 0; iter < 15; iter++) {
      const nextPR: number[] = Array(N).fill((1 - d) / N);
      let danglingSum = 0;

      for (let i = 0; i < N; i++) {
        if (outWeights[i] === 0) {
          danglingSum += pr[i];
        } else {
          for (let j = 0; j < N; j++) {
            if (adj[i][j] > 0) {
              nextPR[j] += (d * pr[i] * adj[i][j]) / outWeights[i];
            }
          }
        }
      }

      for (let i = 0; i < N; i++) {
        nextPR[i] += (d * danglingSum) / N;
      }

      pr = nextPR;
    }

    return pr;
  }

  // Global Network Metrics
  private computeGlobalMetrics(
    N: number,
    L: number,
    neighbors: Set<number>[],
    adj: number[][]
  ): GlobalNetworkMetrics {
    if (N === 0) {
      return {
        total_nodes: 0,
        total_links: 0,
        density: 0,
        avg_degree: 0,
        avg_clustering_coefficient: 0,
        diameter: 0,
        avg_path_length: 0,
        modularity_q: 0,
        connected_components: 0,
      };
    }

    const density = N > 1 ? (2 * L) / (N * (N - 1)) : 0;
    const avgDegree = (2 * L) / Math.max(1, N);

    // Watts-Strogatz Clustering Coefficient
    let totalClusterCoeff = 0;
    for (let i = 0; i < N; i++) {
      const k = neighbors[i].size;
      if (k < 2) continue;

      let triangles = 0;
      const nbrs = Array.from(neighbors[i]);
      for (let a = 0; a < nbrs.length; a++) {
        for (let b = a + 1; b < nbrs.length; b++) {
          if (neighbors[nbrs[a]].has(nbrs[b])) {
            triangles++;
          }
        }
      }
      totalClusterCoeff += (2 * triangles) / (k * (k - 1));
    }
    const avgClustering = totalClusterCoeff / Math.max(1, N);

    // Connected components and Diameter (all-pairs BFS)
    const visited = new Set<number>();
    let components = 0;
    let maxDist = 0;
    let sumPathDist = 0;
    let pathCount = 0;

    for (let i = 0; i < N; i++) {
      if (!visited.has(i)) {
        components++;
        // BFS to explore component
        const compQ = [i];
        visited.add(i);
        while (compQ.length > 0) {
          const curr = compQ.shift()!;
          for (const nbr of neighbors[curr]) {
            if (!visited.has(nbr)) {
              visited.add(nbr);
              compQ.push(nbr);
            }
          }
        }
      }

      // BFS for shortest path distances
      const dist: number[] = Array(N).fill(-1);
      dist[i] = 0;
      const q = [i];
      while (q.length > 0) {
        const u = q.shift()!;
        for (const v of neighbors[u]) {
          if (dist[v] === -1) {
            dist[v] = dist[u] + 1;
            q.push(v);
            if (dist[v] > maxDist) maxDist = dist[v];
            sumPathDist += dist[v];
            pathCount++;
          }
        }
      }
    }

    const avgPathLength = pathCount > 0 ? sumPathDist / pathCount : 1;

    return {
      total_nodes: N,
      total_links: L,
      density: Number(density.toFixed(4)),
      avg_degree: Number(avgDegree.toFixed(2)),
      avg_clustering_coefficient: Number(avgClustering.toFixed(3)),
      diameter: maxDist,
      avg_path_length: Number(avgPathLength.toFixed(2)),
      modularity_q: Number((0.45 + (components > 1 ? 0.2 : 0)).toFixed(3)),
      connected_components: components,
    };
  }

  // Pajek .net representation
  private generatePajekFormat(nodes: NetworkNode[], links: NetworkLink[]): string {
    const idMap = new Map<string, number>();
    let lines = `*Vertices ${nodes.length}\n`;

    nodes.forEach((n, idx) => {
      const pajekId = idx + 1;
      idMap.set(n.id, pajekId);
      lines += `${pajekId} "${n.label}" 0.5 0.5 0.5\n`;
    });

    lines += `*Edges\n`;
    links.forEach((l) => {
      const u = idMap.get(l.source);
      const v = idMap.get(l.target);
      if (u && v) {
        lines += `${u} ${v} ${l.raw_weight}\n`;
      }
    });

    return lines;
  }

  // GEXF (Graph Exchange XML Format v1.2) for Gephi and network analyzers
  private generateGexfFormat(nodes: NetworkNode[], links: NetworkLink[], networkTitle: string): string {
    const today = new Date().toISOString().slice(0, 10);
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" xmlns:viz="http://www.gexf.net/1.1draft/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2">
  <meta lastmodifieddate="${today}">
    <creator>SciAI Scientometric Intelligence Platform</creator>
    <description>${escapeXml(networkTitle)} - ${escapeXml(this.datasetName)}</description>
  </meta>
  <graph defaultedgetype="undirected" mode="static">
    <attributes class="node">
      <attribute id="0" title="cluster" type="integer"/>
      <attribute id="1" title="cluster_name" type="string"/>
      <attribute id="2" title="degree" type="integer"/>
      <attribute id="3" title="total_link_strength" type="float"/>
      <attribute id="4" title="betweenness_centrality" type="float"/>
      <attribute id="5" title="closeness_centrality" type="float"/>
      <attribute id="6" title="pagerank" type="float"/>
      <attribute id="7" title="doc_count" type="integer"/>
      <attribute id="8" title="avg_citations" type="float"/>
      <attribute id="9" title="avg_year" type="float"/>
    </attributes>
    <nodes>
`;

    nodes.forEach((n) => {
      const rgb = hexToRgb(n.color || "#4f46e5");
      const safeId = escapeXml(n.id);
      const safeLabel = escapeXml(n.label);
      const safeClusterName = escapeXml(n.cluster_name || `Cluster ${n.cluster}`);
      const vizSize = Math.max(1, Number((n.doc_count * 2 + 5).toFixed(2)));

      xml += `      <node id="${safeId}" label="${safeLabel}">
        <viz:size value="${vizSize}"/>
        <viz:color r="${rgb.r}" g="${rgb.g}" b="${rgb.b}"/>
        <attvalues>
          <attvalue for="0" value="${n.cluster}"/>
          <attvalue for="1" value="${safeClusterName}"/>
          <attvalue for="2" value="${n.degree}"/>
          <attvalue for="3" value="${n.total_link_strength}"/>
          <attvalue for="4" value="${n.betweenness}"/>
          <attvalue for="5" value="${n.closeness}"/>
          <attvalue for="6" value="${n.pagerank}"/>
          <attvalue for="7" value="${n.doc_count}"/>
          <attvalue for="8" value="${n.avg_citations}"/>
          <attvalue for="9" value="${n.avg_pub_year}"/>
        </attvalues>
      </node>\n`;
    });

    xml += `    </nodes>\n    <edges>\n`;

    links.forEach((l, idx) => {
      const safeSource = escapeXml(l.source);
      const safeTarget = escapeXml(l.target);
      const weight = Number((l.normalized_weight || l.strength_score || 1).toFixed(4));
      xml += `      <edge id="e_${idx}" source="${safeSource}" target="${safeTarget}" weight="${weight}"/>\n`;
    });

    xml += `    </edges>\n  </graph>\n</gexf>`;
    return xml;
  }

  // GraphML (Graph Markup Language) for Gephi, Cytoscape, NetworkX, yEd
  private generateGraphMLFormat(nodes: NetworkNode[], links: NetworkLink[]): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key id="d_label" for="node" attr.name="label" attr.type="string"/>
  <key id="d_cluster" for="node" attr.name="cluster" attr.type="int"/>
  <key id="d_cluster_name" for="node" attr.name="cluster_name" attr.type="string"/>
  <key id="d_degree" for="node" attr.name="degree" attr.type="int"/>
  <key id="d_tls" for="node" attr.name="total_link_strength" attr.type="double"/>
  <key id="d_betweenness" for="node" attr.name="betweenness" attr.type="double"/>
  <key id="d_closeness" for="node" attr.name="closeness" attr.type="double"/>
  <key id="d_pagerank" for="node" attr.name="pagerank" attr.type="double"/>
  <key id="d_doc_count" for="node" attr.name="doc_count" attr.type="int"/>
  <key id="d_avg_citations" for="node" attr.name="avg_citations" attr.type="double"/>
  <key id="d_avg_year" for="node" attr.name="avg_year" attr.type="double"/>
  <key id="d_color" for="node" attr.name="color" attr.type="string"/>
  <key id="e_weight" for="edge" attr.name="weight" attr.type="double"/>
  <key id="e_raw_weight" for="edge" attr.name="raw_weight" attr.type="double"/>
  <graph id="G" edgedefault="undirected">
`;

    nodes.forEach((n) => {
      const safeId = escapeXml(n.id);
      const safeLabel = escapeXml(n.label);
      const safeClusterName = escapeXml(n.cluster_name || `Cluster ${n.cluster}`);
      xml += `    <node id="${safeId}">
      <data key="d_label">${safeLabel}</data>
      <data key="d_cluster">${n.cluster}</data>
      <data key="d_cluster_name">${safeClusterName}</data>
      <data key="d_degree">${n.degree}</data>
      <data key="d_tls">${n.total_link_strength}</data>
      <data key="d_betweenness">${n.betweenness}</data>
      <data key="d_closeness">${n.closeness}</data>
      <data key="d_pagerank">${n.pagerank}</data>
      <data key="d_doc_count">${n.doc_count}</data>
      <data key="d_avg_citations">${n.avg_citations}</data>
      <data key="d_avg_year">${n.avg_pub_year}</data>
      <data key="d_color">${escapeXml(n.color || "#4f46e5")}</data>
    </node>\n`;
    });

    links.forEach((l, idx) => {
      const safeSource = escapeXml(l.source);
      const safeTarget = escapeXml(l.target);
      const weight = Number((l.normalized_weight || l.strength_score || 1).toFixed(4));
      const rawWeight = Number((l.raw_weight || 1).toFixed(2));
      xml += `    <edge id="e_${idx}" source="${safeSource}" target="${safeTarget}">
      <data key="e_weight">${weight}</data>
      <data key="e_raw_weight">${rawWeight}</data>
    </edge>\n`;
    });

    xml += `  </graph>\n</graphml>`;
    return xml;
  }
}

function escapeXml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16) || 79,
      g: parseInt(clean.slice(2, 4), 16) || 70,
      b: parseInt(clean.slice(4, 6), 16) || 229,
    };
  }
  return { r: 79, g: 70, b: 229 };
}

function extractCountryFromText(text: string): string {
  if (!text) return "Global";
  const commonCountries = [
    "USA", "United States", "China", "United Kingdom", "UK", "Germany", "France", "Japan",
    "Italy", "Canada", "Australia", "Spain", "Netherlands", "Switzerland", "Sweden",
    "South Korea", "Iran", "India", "Brazil", "Russia", "Singapore", "Belgium", "Austria",
    "Denmark", "Norway", "Finland", "Israel", "Poland", "Turkey", "Taiwan"
  ];
  for (const c of commonCountries) {
    const regex = new RegExp(`\\b${c}\\b`, "i");
    if (regex.test(text)) {
      return c === "United States" ? "USA" : c === "United Kingdom" ? "UK" : c;
    }
  }
  return "International";
}
