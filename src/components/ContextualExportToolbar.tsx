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

export function ContextualExportToolbar({
  payload,
  getPayload,
  svgElement = null,
  svgElementRef,
  getSvgElement,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState<ContextualExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (format: ContextualExportFormat) => {
    setBusy(format);
    setMessage(null);
    setFailed(false);
    try {
      const selectedPayload = getPayload ? await getPayload() : payload;
      const outcome = await exportContext(selectedPayload, format, {
        svgElement: getSvgElement
          ? getSvgElement()
          : (svgElementRef?.current ?? svgElement),
      });
      setMessage(
        outcome.kind === "print"
          ? "Print dialog opened; choose Save as PDF."
          : `${outcome.formatLabel} downloaded.`
      );
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const button = ({
    format,
    label,
  }: {
    format: ContextualExportFormat;
    label: string;
  }) => (
    <button
      key={format}
      type="button"
      onClick={() => void run(format)}
      disabled={busy !== null}
      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-ink-primary disabled:opacity-50"
      title={`Export selected ${payload.title} as ${label}`}
    >
      {format === "png" || format === "jpg" || format === "svg" ? (
        <ImageIcon className="h-3 w-3 text-brand-500" />
      ) : format === "net" || format === "gexf" || format === "graphml" ? (
        <Network className="h-3 w-3 text-brand-500" />
      ) : (
        <FileDown className="h-3 w-3 text-ink-subtle" />
      )}
      {busy === format ? "…" : label}
    </button>
  );

  return (
    <div
      className={`rounded-xl border border-border-default bg-surface-subtle ${
        compact ? "p-2.5" : "p-3.5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="sciai-kicker mr-1 inline-flex items-center gap-1 text-[10px]!">
          <Download className="h-3 w-3 text-brand-500" /> Selected result exports
        </span>
        {documentFormats.map(button)}
        {(svgElement || svgElementRef || getSvgElement) &&
          imageFormats.map(button)}
        {payload.graph && graphFormats.map(button)}
      </div>
      <p className="mt-1.5 text-[10px] text-ink-muted">
        {payload.title} · Office downloads contain the selected data, provenance
        and metadata as editable documents/tables/slides. Use SVG/PNG/JPG for
        the actual figure; PDF opens browser print.
      </p>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`mt-1 text-[10px] font-semibold ${
            failed ? "text-status-danger-text" : "text-status-success-text"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}