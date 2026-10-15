import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { ContextualExportToolbar } from "./ContextualExportToolbar.js";
import type { ContextualExportPayload } from "../utils/contextualExport.js";

interface Output { element: Element; title: string; kind: "table" | "figure" | "text" }

function titleFor(element: Element, fallback: string): string {
  let container = element.parentElement;
  while (container) {
    const heading = Array.from(container.querySelectorAll("h2,h3,h4")).filter((candidate) => candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    if (heading?.textContent?.trim()) return heading.textContent.trim();
    if (container.hasAttribute("data-export-studio")) break;
    container = container.parentElement;
  }
  return fallback;
}

/** Export only explicitly selected rendered output; never substitute a different analysis. */
export function StudioExportBoundary({ studio, children }: { key?: string; studio: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  useEffect(() => {
    const root: HTMLDivElement | null = contentRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout>;
    const discover = () => {
      const elements = Array.from(root.querySelectorAll("table,pre,svg,.whitespace-pre-wrap,[data-export-text]"))
        .filter((element) => {
          if (element.closest('[hidden],[aria-hidden="true"]') || element.parentElement?.closest("pre,.whitespace-pre-wrap,[data-export-text]")) return false;
          const bounds = element.getBoundingClientRect();
          if (bounds.width <= 0 || bounds.height <= 0) return false;
          if (element.localName === "svg") {
            return !element.classList.contains("lucide") && bounds.width > 100 && bounds.height > 70 && !element.parentElement?.closest("svg") && !!element.querySelector("path,rect,line,circle,polygon,text,image");
          }
          if (element.localName === "table") return !!element.querySelector("tbody td");
          const text = element.textContent?.trim();
          return !!text && text !== "[]" && text !== "{}" && text !== "null";
        });
      const next = elements.map((element, index): Output => ({
        element,
        title: titleFor(element, `${studio} output ${index + 1}`),
        kind: element.localName === "table" ? "table" : element.localName === "svg" ? "figure" : "text",
      }));
      setSelectedElement((previous) => next.some((item) => item.element === previous) ? previous : null);
      setOutputs((previous) => previous.length === next.length && previous.every((item, index) => item.element === next[index].element && item.title === next[index].title) ? previous : next);
    };
    discover();
    // Debounce D3 layout ticks; selection reads current content at export time.
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(discover, 200); });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [studio]);

  const selectedIndex = outputs.findIndex((item) => item.element === selectedElement);
  const output = selectedIndex >= 0 ? outputs[selectedIndex] : undefined;
  const getPayload = (): ContextualExportPayload => {
    if (!output || !contentRef.current?.contains(output.element)) throw new Error("Select an available rendered output first.");
    let rows: Record<string, unknown>[] = [];
    if (output.kind === "table") {
      const table = output.element as HTMLTableElement;
      const headers = Array.from(table.querySelectorAll("thead th")).map((cell, index) => `${cell.textContent?.trim() || "Column"} (${index + 1})`);
      rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => Object.fromEntries(Array.from(row.querySelectorAll("td")).map((cell, index) => [headers[index] || `Column ${index + 1}`, cell.textContent?.trim() ?? ""])));
    } else {
      const content = output.element.textContent?.trim() || "";
      if (output.kind === "text") {
        try {
          const parsed: unknown = JSON.parse(content);
          rows = Array.isArray(parsed) ? parsed.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : { value: item }) : [{ result: parsed }];
        } catch { rows = [{ text: content }]; }
      } else rows = [{ visible_figure_labels: content }];
    }
    return {
      title: output.title,
      rows,
      provenance: { studio, output_kind: output.kind, export_scope: "selected rendered output", dataset_version_id: null },
      metadata: { limitations: "Contains only displayed rows/labels, including current display filters and pagination. Source version is not inferred. Use an analysis-specific export for the complete computed result.", ...(output.kind === "figure" ? { note: "Select SVG/PNG/JPG to export the actual rendered figure; labels alone are not the underlying chart dataset." } : {}) },
    };
  };
  return <>
    <div ref={contentRef} data-export-studio={studio}>{children}</div>
    {outputs.length > 0 && <div data-export-actions className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
      <label className="block text-xs font-bold text-slate-700">Export an output from this tab
        <select aria-label="Rendered output to export" value={selectedIndex >= 0 ? String(selectedIndex) : ""} onChange={(event) => setSelectedElement(event.target.value === "" ? null : outputs[Number(event.target.value)]?.element || null)} className="my-2 w-full rounded-lg border border-slate-300 p-2 text-xs">
          <option value="">Select a displayed table, figure, or text result</option>
          {outputs.map((item, index) => <option key={index} value={index}>{index + 1}. {item.title} · {item.kind}</option>)}
        </select>
      </label>
      {output && <ContextualExportToolbar key={`${studio}:${selectedIndex}`} payload={{ title: output.title, provenance: { studio, export_scope: "selected rendered output" }, rows: [] }} getPayload={getPayload} svgElement={output.kind === "figure" ? output.element as SVGSVGElement : null} />}
    </div>}
  </>;
}
