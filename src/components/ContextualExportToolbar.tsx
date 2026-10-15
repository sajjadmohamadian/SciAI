import { useState, type RefObject } from "react";
import { Download, FileDown, Image as ImageIcon, Network } from "lucide-react";
import {
  exportContext,
  type ContextualExportFormat,
  type ContextualExportPayload,
} from "../utils/contextualExport.js";

interface Props {
  key?: string;
  payload: ContextualExportPayload;
  getPayload?: () => ContextualExportPayload | Promise<ContextualExportPayload>;
  svgElement?: SVGSVGElement | null;
  svgElementRef?: RefObject<SVGSVGElement | null>;
  getSvgElement?: () => SVGSVGElement | null;
  compact?: boolean;
}

const documentFormats: Array<{ format: ContextualExportFormat; label: string }> = [
  { format: "csv", label: "CSV" },
  { format: "json", label: "JSON" },
  { format: "word", label: "Word .docx" },
  { format: "excel", label: "Excel .xlsx" },
  { format: "powerpoint", label: "PowerPoint .pptx" },
  { format: "latex", label: "LaTeX" },
  { format: "pdf", label: "PDF / Print" },
];
const imageFormats: Array<{ format: ContextualExportFormat; label: string }> = [
  { format: "svg", label: "SVG" },
  { format: "png", label: "PNG" },
  { format: "jpg", label: "JPG" },
];
const graphFormats: Array<{ format: ContextualExportFormat; label: string }> = [
  { format: "net", label: "Pajek .net" },
  { format: "gexf", label: "GEXF" },
  { format: "graphml", label: "GraphML" },
];

export function ContextualExportToolbar({ payload, getPayload, svgElement = null, svgElementRef, getSvgElement, compact = false }: Props) {
  const [busy, setBusy] = useState<ContextualExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const run = async (format: ContextualExportFormat) => {
    setBusy(format); setMessage(null); setFailed(false);
    try {
      const selectedPayload = getPayload ? await getPayload() : payload;
      const outcome = await exportContext(selectedPayload, format, { svgElement: getSvgElement ? getSvgElement() : svgElementRef?.current ?? svgElement });
      setMessage(outcome.kind === "print" ? "Print dialog opened; choose Save as PDF." : `${outcome.formatLabel} downloaded.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally { setBusy(null); }
  };
  const button = ({ format, label }: { format: ContextualExportFormat; label: string }) => (
    <button key={format} type="button" onClick={() => void run(format)} disabled={busy !== null}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" title={`Export selected ${payload.title} as ${label}`}>
      {format === "png" || format === "jpg" || format === "svg" ? <ImageIcon className="h-3 w-3" /> : format === "net" || format === "gexf" || format === "graphml" ? <Network className="h-3 w-3" /> : <FileDown className="h-3 w-3" />}
      {busy === format ? "…" : label}
    </button>
  );
  return <div className={`rounded-xl border border-slate-200 bg-slate-50/70 ${compact ? "p-2" : "p-3"}`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500"><Download className="h-3 w-3" /> Selected result exports</span>
      {documentFormats.map(button)}
      {(svgElement || svgElementRef || getSvgElement) && imageFormats.map(button)}
      {payload.graph && graphFormats.map(button)}
    </div>
    <p className="mt-1 text-[10px] text-slate-500">{payload.title} · Office downloads contain the selected data, provenance and metadata as editable documents/tables/slides. Use SVG/PNG/JPG for the actual figure; PDF opens browser print.</p>
    {message && <p role={failed ? "alert" : "status"} className={`mt-1 text-[10px] font-semibold ${failed ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>}
  </div>;
}
