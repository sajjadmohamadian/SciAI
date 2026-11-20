import React, { useMemo, useState } from "react";
import { BibliometricDocument } from "../types.js";
import { Card } from "./CommonUI.js";
import { Network, Sliders, Table2, Search } from "lucide-react";

interface Props {
  documents: BibliometricDocument[];
}

interface RuleItem {
  id: string;
  order: number;
  items: string[];
  comboLabel: string;
  antecedent: string[];
  consequent: string;
  ruleLabel: string;
  supportCount: number;
  supportPct: number;
  confidence: number;
  lift: number;
}

export function AssociationRulesGraph({ documents }: Props) {
  const [tupleOrder, setTupleOrder] = useState<number>(2); // 2=Pairs, 3=Triads, 4=Tetrads, 5=Pentads, 6=Hexads
  const [minSupport, setMinSupport] = useState<number>(3);
  const [strongRatio, setStrongRatio] = useState<number>(0.45);
  const [maxNodes, setMaxNodes] = useState<number>(18);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{ key: "supportCount" | "supportPct" | "confidence" | "lift" | "comboLabel"; direction: "asc" | "desc" }>({
    key: "supportCount",
    direction: "desc",
  });

  const totalDocs = documents.length || 1;

  const { nodes, edges, rules, maxEdgeWeight } = useMemo(() => {
    const docKeywords: string[][] = [];
    const wordFreq: Record<string, number> = {};

    for (const doc of documents) {
      const rawKws = [
        ...(Array.isArray(doc.keywords) ? doc.keywords : []),
        ...(Array.isArray((doc as any).author_keywords) ? (doc as any).author_keywords : []),
        ...(Array.isArray((doc as any).index_keywords) ? (doc as any).index_keywords : []),
      ];
      const kws = Array.from(
        new Set(rawKws.map((k) => String(k || "").trim().toLowerCase()).filter(Boolean))
      ).sort();

      docKeywords.push(kws);
      for (const kw of kws) {
        wordFreq[kw] = (wordFreq[kw] || 0) + 1;
      }
    }

    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxNodes);

    const topSet = new Set(topKeywords.map(([kw]) => kw));
    const tupleCounts: Record<string, { items: string[]; count: number }> = {};

    const generateCombinations = (arr: string[], k: number, start = 0, current: string[] = []) => {
      if (current.length === k) {
        const key = current.join(" || ");
        if (!tupleCounts[key]) {
          tupleCounts[key] = { items: [...current], count: 0 };
        }
        tupleCounts[key].count += 1;
        return;
      }
      for (let i = start; i <= arr.length - (k - current.length); i++) {
        current.push(arr[i]);
        generateCombinations(arr, k, i + 1, current);
        current.pop();
      }
    };

    for (const kws of docKeywords) {
      const filtered = kws.filter((k) => topSet.has(k));
      if (filtered.length >= tupleOrder) {
        generateCombinations(filtered.slice(0, 14), tupleOrder);
      }
    }

    const validTuples = Object.values(tupleCounts)
      .filter((t) => t.count >= minSupport)
      .sort((a, b) => b.count - a.count)
      .slice(0, 120);

    // ???? ??????? ???? ?? ??? ????????? k-????
    const edgeMap: Record<string, { source: string; target: string; weight: number; tuplesCount: number }> = {};
    const activeNodeSet = new Set<string>();

    for (const t of validTuples) {
      for (const item of t.items) activeNodeSet.add(item);
      for (let i = 0; i < t.items.length; i++) {
        for (let j = i + 1; j < t.items.length; j++) {
          const a = t.items[i];
          const b = t.items[j];
          const eKey = `${a}__${b}`;
          if (!edgeMap[eKey]) {
            edgeMap[eKey] = { source: a, target: b, weight: 0, tuplesCount: 0 };
          }
          edgeMap[eKey].weight = Math.max(edgeMap[eKey].weight, t.count);
          edgeMap[eKey].tuplesCount += 1;
        }
      }
    }

    const finalNodeList = topKeywords
      .filter(([kw]) => activeNodeSet.has(kw) || activeNodeSet.size === 0)
      .slice(0, maxNodes);

    const edgeList = Object.values(edgeMap);
    const maxW = edgeList.reduce((m, e) => Math.max(m, e.weight), 1);

    const extractedRules: RuleItem[] = validTuples.map((t, idx) => {
      const sortedByFreq = [...t.items].sort((a, b) => (wordFreq[b] || 0) - (wordFreq[a] || 0));
      const consequent = sortedByFreq[0];
      const antecedent = sortedByFreq.slice(1);
      const antFreq =
        antecedent.length === 1
          ? wordFreq[antecedent[0]] || t.count
          : Math.max(t.count, Math.min(...antecedent.map((a) => wordFreq[a] || t.count)));
      const consFreq = wordFreq[consequent] || 1;
      const supportPct = (t.count / totalDocs) * 100;
      const confidence = Math.min(100, (t.count / Math.max(1, antFreq)) * 100);
      const lift = t.count / totalDocs / ((antFreq / totalDocs) * (consFreq / totalDocs));

      return {
        id: `rule-${idx}`,
        order: tupleOrder,
        items: t.items,
        comboLabel: t.items.join(" + "),
        antecedent,
        consequent,
        ruleLabel: `${antecedent.join(" + ")} ? ${consequent}`,
        supportCount: t.count,
        supportPct,
        confidence,
        lift,
      };
    });

    return {
      nodes: finalNodeList,
      edges: edgeList,
      rules: extractedRules,
      maxEdgeWeight: maxW,
    };
  }, [documents, tupleOrder, minSupport, maxNodes, totalDocs]);

  const sortedRules = useMemo(() => {
    return rules
      .filter((r) => (!selectedNode || r.items.includes(selectedNode)))
      .filter((r) => !tableFilter || r.comboLabel.includes(tableFilter.toLowerCase()))
      .sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        const cmp =
          typeof valA === "number" && typeof valB === "number"
            ? valA - valB
            : String(valA).localeCompare(String(valB));
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
  }, [rules, selectedNode, tableFilter, sortConfig]);

  const handleSort = (key: "supportCount" | "supportPct" | "confidence" | "lift" | "comboLabel") => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    );
  };

  // ?????? ???????? ???? ????? Web Graph
  const width = 760;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 185;

  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; angle: number; freq: number; color: string }> = {};
    const palette = [
      "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
      "#0891b2", "#db2777", "#4f46e5", "#059669", "#ea580c"
    ];
    nodes.forEach(([kw, freq], idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, nodes.length) - Math.PI / 2;
      pos[kw] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        angle,
        freq,
        color: palette[idx % palette.length],
      };
    });
    return pos;
  }, [nodes, cx, cy, radius]);

  const tupleNames: Record<number, string> = {
    2: "2-Tuple (Pairs / ????)",
    3: "3-Tuple (Triads / ???????)",
    4: "4-Tuple (Tetrads / ????????)",
    5: "5-Tuple (Pentads / ????????)",
    6: "6-Tuple (Hexads / ???????)",
  };

  return (
    <div className="space-y-6">
      {/* ??? ?: ???? Association Rules Web Graph */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-border-default pb-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-brand-600" />
              <h3 className="text-base font-bold text-ink-primary">
                Co-Word & Association Rules Web Graph
              </h3>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Circular network topology displaying strong (solid bold) vs. weak (dashed) keyword co-occurrence rules across configurable tuple orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border-default bg-surface-subtle p-1">
            {[2, 3, 4, 5, 6].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setTupleOrder(level);
                  if (level >= 4 && minSupport > 2) setMinSupport(2);
                }}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  tupleOrder === level
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-ink-secondary hover:bg-white hover:text-ink-primary"
                }`}
              >
                {level}-Tuple ({level === 2 ? "Pairs" : level === 3 ? "Triads" : level === 4 ? "Tetrads" : `${level}-Way`})
              </button>
            ))}
          </div>
        </div>

        {/* ??? ??????? ???? */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border-default bg-surface-subtle/60 p-3.5 sm:grid-cols-3">
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-ink-secondary">
              <span className="flex items-center gap-1"><Sliders className="h-3.5 w-3.5" /> Min Support (Docs)</span>
              <span className="font-mono font-bold text-brand-700">{minSupport} docs</span>
            </div>
            <input
              type="range"
              min={1}
              max={25}
              value={minSupport}
              onChange={(e) => setMinSupport(Number(e.target.value))}
              className="mt-1.5 w-full accent-brand-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-ink-secondary">
              <span>Strong Link Threshold</span>
              <span className="font-mono font-bold text-brand-700">{Math.round(strongRatio * 100)}% of max</span>
            </div>
            <input
              type="range"
              min={15}
              max={85}
              value={Math.round(strongRatio * 100)}
              onChange={(e) => setStrongRatio(Number(e.target.value) / 100)}
              className="mt-1.5 w-full accent-brand-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-ink-secondary">
              <span>Max Graph Nodes</span>
              <span className="font-mono font-bold text-brand-700">{maxNodes} terms</span>
            </div>
            <input
              type="range"
              min={8}
              max={30}
              value={maxNodes}
              onChange={(e) => setMaxNodes(Number(e.target.value))}
              className="mt-1.5 w-full accent-brand-600"
            />
          </div>
        </div>

        {/* ??? ???? ???????? */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-white p-4">
          {nodes.length === 0 || edges.length === 0 ? (
            <div className="py-16 text-center text-xs text-ink-muted">
              No {tupleNames[tupleOrder]} co-occurrences found with Min Support ? {minSupport}. Try lowering Min Support.
            </div>
          ) : (
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-[760px] select-none">
              {edges.map((edge, idx) => {
                const p1 = nodePositions[edge.source];
                const p2 = nodePositions[edge.target];
                if (!p1 || !p2) return null;

                const ratio = edge.weight / maxEdgeWeight;
                const isStrong = ratio >= strongRatio;
                const isHighlighted =
                  !selectedNode || edge.source === selectedNode || edge.target === selectedNode;

                return (
                  <line
                    key={idx}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#1d4ed8"
                    strokeWidth={isStrong ? Math.max(2.4, ratio * 5) : 1.1}
                    strokeDasharray={isStrong ? undefined : "3,4"}
                    strokeOpacity={isHighlighted ? (isStrong ? 0.92 : 0.45) : 0.08}
                  >
                    <title>
                      {`${edge.source} ? ${edge.target} (Max Support: ${edge.weight} docs, Shared ${tupleOrder}-Tuples: ${edge.tuplesCount})`}
                    </title>
                  </line>
                );
              })}

              {nodes.map(([kw, freq]) => {
                const p = nodePositions[kw];
                if (!p) return null;

                const isRightSide = Math.cos(p.angle) >= -0.05;
                const labelOffset = 13;
                const lx = p.x + Math.cos(p.angle) * labelOffset;
                const ly = p.y + Math.sin(p.angle) * labelOffset;
                const isSelected = selectedNode === kw;

                return (
                  <g
                    key={kw}
                    onClick={() => setSelectedNode(isSelected ? null : kw)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isSelected ? 8 : 6}
                      fill={p.color}
                      stroke="#1e293b"
                      strokeWidth={isSelected ? 2.2 : 1.2}
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={isRightSide ? "start" : "end"}
                      dominantBaseline="middle"
                      fontSize="12"
                      fontWeight={isSelected ? "700" : "600"}
                      fill={isSelected ? "#1d4ed8" : "#0f172a"}
                    >
                      {kw}
                    </text>
                    <title>{`${kw} (Frequency: ${freq})`}</title>
                  </g>
                );
              })}
            </svg>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-6 border-t border-border-default pt-3 text-[11px] text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-6 bg-blue-700"></span>
              Strong Association (? {Math.round(strongRatio * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-blue-500"></span>
              Moderate / Weak Association
            </span>
            <span className="text-ink-muted">Click any node to filter its co-occurrence rules below</span>
            {selectedNode && (
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="font-bold text-brand-600 hover:underline"
              >
                Clear Node Filter ({selectedNode})
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ??? ?: ???? ???????? ???????? ? ?????? ?????? ??? ???? */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-brand-600" />
            <h4 className="text-sm font-bold text-ink-primary">
              {tupleNames[tupleOrder]} Co-Occurrence & Association Rules Table ({sortedRules.length})
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-muted" />
            <input
              type="text"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Filter co-occurring terms..."
              className="w-full rounded-lg border border-border-default bg-surface-subtle py-1.5 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border-default">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-surface-subtle">
              <tr>
                <th
                  onClick={() => handleSort("comboLabel")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary"
                >
                  Co-Occurrence Set ({tupleOrder}-Tuple) {sortConfig.key === "comboLabel" ? (sortConfig.direction === "asc" ? "?" : "?") : "?"}
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Association Rule (Antecedent ? Consequent)
                </th>
                <th
                  onClick={() => handleSort("supportCount")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary"
                >
                  Co-Occurrence Docs {sortConfig.key === "supportCount" ? (sortConfig.direction === "asc" ? "?" : "?") : "?"}
                </th>
                <th
                  onClick={() => handleSort("supportPct")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary"
                >
                  Support % {sortConfig.key === "supportPct" ? (sortConfig.direction === "asc" ? "?" : "?") : "?"}
                </th>
                <th
                  onClick={() => handleSort("confidence")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary"
                >
                  Confidence % {sortConfig.key === "confidence" ? (sortConfig.direction === "asc" ? "?" : "?") : "?"}
                </th>
                <th
                  onClick={() => handleSort("lift")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary"
                >
                  Lift {sortConfig.key === "lift" ? (sortConfig.direction === "asc" ? "?" : "?") : "?"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-white">
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    No co-occurrence rules found for the current filter settings.
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule) => (
                  <tr key={rule.id} className="transition-colors hover:bg-surface-subtle/50">
                    <td className="px-3 py-2.5 font-semibold text-ink-primary">
                      {rule.comboLabel}
                    </td>
                    <td className="px-3 py-2.5 text-ink-secondary">
                      {rule.antecedent.join(" + ")} <span className="font-bold text-brand-600">?</span> {rule.consequent}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-brand-700">
                      {rule.supportCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink-secondary">
                      {rule.supportPct.toFixed(2)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink-secondary">
                      {rule.confidence.toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink-secondary">
                      {rule.lift.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
