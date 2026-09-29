import React, { forwardRef } from "react";
import type { PrismaCount, PrismaFlow } from "../types.js";
import { formatPrismaCount, manualFields, type PrismaDraft } from "../hooks/usePrismaFlow.js";

type Props = { flow: PrismaFlow | null; reasonsRecorded?: boolean };

export const PrismaFlowDiagram = forwardRef<SVGSVGElement, Props>(function PrismaFlowDiagram({ flow, reasonsRecorded = false }, ref) {
  if (!flow) return <p className="py-10 text-center text-sm text-slate-500">PRISMA flow is not available.</p>;
  const reasons = flow.excluded_eligibility;
  const reasonHeight = Math.max(78, 48 + reasons.length * 19);
  const eligibilityY = 520;
  const includedY = Math.max(eligibilityY + reasonHeight + 52, 680);
  const height = includedY + 100;
  const count = (entry: PrismaCount) => `n = ${formatPrismaCount(entry.value)}`;
  const stage = (x: number, y: number, label: string, entry: PrismaCount, color = "#f8fafc", stroke = "#94a3b8") => (
    <g key={label}>
      <title>{`${label}: ${count(entry)}. ${entry.source.replaceAll("_", " ")}. ${entry.basis || ""}`}</title>
      <rect x={x} y={y} width="295" height="66" rx="7" fill={color} stroke={stroke} strokeWidth="1.5" />
      <text x={x + 14} y={y + 26} fontSize="12" fontWeight="600" fill="#0f172a">{label}</text>
      <text x={x + 14} y={y + 48} fontSize="11" fill="#334155">{count(entry)}</text>
    </g>
  );
  const line = (y1: number, y2: number) => <path d={`M 340 ${y1} V ${y2}`} fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />;
  const sideLine = (y: number) => <path d={`M 488 ${y} H 510`} fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />;

  return (
    <div className="overflow-x-auto" role="group" aria-label="PRISMA 2020 flow diagram">
      <svg ref={ref} viewBox={`0 0 850 ${height}`} className="h-auto w-full min-w-[600px]" role="img" aria-label="PRISMA 2020 flow diagram. Unknown counts are not recorded, not zero." xmlns="http://www.w3.org/2000/svg">
        <rect width="850" height={height} fill="#ffffff" />
        <defs><marker id="prisma-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#64748b" /></marker></defs>
        <text x="32" y="46" fill="#475569" fontSize="12" fontWeight="700">IDENTIFICATION</text>
        <text x="32" y="276" fill="#475569" fontSize="12" fontWeight="700">SCREENING</text>
        <text x="32" y="586" fill="#475569" fontSize="12" fontWeight="700">ELIGIBILITY</text>
        <text x="32" y={includedY + 35} fill="#475569" fontSize="12" fontWeight="700">INCLUDED</text>
        {stage(190, 28, "Records identified from databases", flow.identified_databases)}
        {stage(510, 28, "Records identified from registers", flow.identified_registers)}
        {line(94, 175)}
        {stage(190, 175, "Records screened", flow.screened)}
        {stage(510, 116, "Duplicate records removed", flow.removed_duplicates, "#fff7ed", "#fdba74")}
        {stage(510, 195, "Removed by automation", flow.removed_automation, "#fff7ed", "#fdba74")}
        {stage(510, 274, "Removed for other reasons", flow.removed_other, "#fff7ed", "#fdba74")}
        {sideLine(145)}
        {line(241, 304)}
        {stage(190, 304, "Reports sought for retrieval", flow.sought_retrieval)}
        {stage(510, 353, "Records excluded at screening", flow.excluded_screening, "#fff7ed", "#fdba74")}
        {sideLine(336)}
        {line(370, 412)}
        {stage(190, 412, "Reports assessed for eligibility", flow.assessed_eligibility)}
        {stage(510, 433, "Reports not retrieved", flow.not_retrieved, "#fff7ed", "#fdba74")}
        {sideLine(449)}
        {line(478, includedY)}
        <g>
          <rect x="510" y={eligibilityY} width="295" height={reasonHeight} rx="7" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.5" />
          <text x="524" y={eligibilityY + 24} fontSize="12" fontWeight="600" fill="#0f172a">Reports excluded, with reasons</text>
          {reasons.length ? reasons.map((item, index) => (
            <g key={`${item.reason}-${index}`}>
              <title>{`${item.reason}: ${count(item.count)}. ${item.count.basis || ""}`}</title>
              <text x="524" y={eligibilityY + 45 + index * 19} fontSize="10" fill="#334155">
                {`${item.reason.slice(0, 30)}${item.reason.length > 30 ? "…" : ""}: ${count(item.count)}`}
              </text>
            </g>
          )) : <text x="524" y={eligibilityY + 45} fontSize="11" fill="#64748b">{reasonsRecorded ? "No exclusions recorded (n = 0)" : "Not recorded"}</text>}
        </g>
        {sideLine(eligibilityY + 30)}
        {stage(190, includedY, "Studies included in synthesis", flow.included_studies, "#ecfdf5", "#10b981")}
      </svg>
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold">Count provenance and accessible data table</summary>
        <table className="mt-2 w-full text-left"><thead><tr><th className="py-1">Stage</th><th>Count</th><th>Source / basis</th></tr></thead><tbody>
          {([
            ["Databases", flow.identified_databases], ["Registers", flow.identified_registers],
            ["Duplicates removed", flow.removed_duplicates], ["Automation removals", flow.removed_automation],
            ["Other removals", flow.removed_other], ["Screened", flow.screened],
            ["Excluded at screening", flow.excluded_screening], ["Sought retrieval", flow.sought_retrieval],
            ["Not retrieved", flow.not_retrieved], ["Assessed eligibility", flow.assessed_eligibility],
            ...reasons.map((item): [string, PrismaCount] => [`Excluded: ${item.reason}`, item.count]),
            ["Included studies", flow.included_studies],
          ] as Array<[string, PrismaCount]>).map(([name, item]) => (
            <tr className="border-t border-slate-100" key={name}><th className="py-1 font-medium">{name}</th><td>{formatPrismaCount(item.value)}</td><td>{item.source.replaceAll("_", " ")}: {item.basis}</td></tr>
          ))}
        </tbody></table>
      </details>
    </div>
  );
});

type EditorProps = {
  flow: PrismaFlow | null;
  draft: PrismaDraft | null;
  saving: boolean;
  error: string | null;
  reasonsRecorded?: boolean;
  onFieldChange: (field: typeof manualFields[number], value: string) => void;
  onReasonsChange: (reasons: PrismaDraft["exclusion_reasons"]) => void;
  onSave: () => Promise<boolean>;
};

const fieldLabels: Record<typeof manualFields[number], string> = {
  identified_registers: "Records identified from registers",
  removed_automation: "Removed by automation",
  removed_other: "Removed for other reasons",
  excluded_screening: "Records excluded during screening",
  not_retrieved: "Reports not retrieved",
  included_studies: "Studies included in synthesis",
};

export function PrismaManualEditor({ flow, draft, saving, error, reasonsRecorded = false, onFieldChange, onReasonsChange, onSave }: EditorProps) {
  if (!flow || !draft) return <p className="text-xs text-slate-500">Load a dataset version to edit study-selection counts.</p>;
  return (
    <div className="space-y-4 text-xs">
      <p className="text-slate-600">Counts are saved to dataset version {flow.dataset_version_id}. Identification and duplicate counts come from persisted ingestion/deduplication provenance and cannot be edited here. Blank fields have no manual entry (the flow may still show a measured value). Enter 0 only when zero was observed.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {manualFields.map((field) => <label key={field} className="block font-semibold text-slate-700">
          {fieldLabels[field]}
          <input type="number" min="0" step="1" placeholder={flow[field].value === null ? "Not recorded" : `Measured: ${formatPrismaCount(flow[field].value)}`} value={draft[field]} onChange={(event) => onFieldChange(field, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900" />
        </label>)}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><h4 className="font-bold text-slate-800">Full-text exclusion reasons</h4><button type="button" className="font-semibold text-blue-700" onClick={() => onReasonsChange([...draft.exclusion_reasons, { reason: "", count: "" }])}>Add reason</button></div>
        {draft.exclusion_reasons.length === 0 && <p className="text-slate-500">{reasonsRecorded ? "No exclusion reasons recorded (n = 0)" : "Not recorded"}</p>}
        {draft.exclusion_reasons.map((item, index) => <div key={index} className="flex flex-wrap items-center gap-2">
          <input aria-label={`Exclusion reason ${index + 1}`} placeholder="Reason" value={item.reason} onChange={(event) => onReasonsChange(draft.exclusion_reasons.map((reason, i) => i === index ? { ...reason, reason: event.target.value } : reason))} className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-2" />
          <input aria-label={`Exclusion count ${index + 1}`} type="number" min="0" step="1" placeholder="Not recorded" value={item.count} onChange={(event) => onReasonsChange(draft.exclusion_reasons.map((reason, i) => i === index ? { ...reason, count: event.target.value } : reason))} className="w-28 rounded-lg border border-slate-200 px-3 py-2" />
          <button type="button" onClick={() => onReasonsChange(draft.exclusion_reasons.filter((_, i) => i !== index))} className="font-semibold text-rose-700">Remove</button>
        </div>)}
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</p>}
      <button type="button" disabled={saving} onClick={() => { void onSave(); }} className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save PRISMA counts"}</button>
    </div>
  );
}
