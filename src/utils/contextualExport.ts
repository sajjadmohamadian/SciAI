/** Selected-result exports. No corpus aggregation, network requests, or AI calls. */
export type ContextualExportRow = Record<string, unknown>;
export interface ContextualExportNode {
  id: string | number;
  label?: string;
  [key: string]: unknown;
}
export interface ContextualExportEdge {
  id?: string | number;
  source: string | number;
  target: string | number;
  weight?: number;
  directed?: boolean;
  [key: string]: unknown;
}
export interface ContextualExportPayload {
  title: string;
  provenance: Record<string, unknown>;
  rows: ContextualExportRow[];
  metadata?: Record<string, unknown>;
  graph?: { nodes: ContextualExportNode[]; edges: ContextualExportEdge[]; directed?: boolean };
}
export type ContextualExportFormat = 'csv' | 'json' | 'latex' | 'word' | 'excel' | 'powerpoint' | 'pdf' | 'net' | 'gexf' | 'graphml' | 'svg' | 'png' | 'jpg';
export interface ContextualExportArtifact {
  content: string;
  mimeType: string;
  extension: string;
  /** Honest description of the actual file, including compatibility fallbacks. */
  formatLabel: string;
}
export interface ContextualExportOptions {
  filename?: string;
  /** Pass the selected chart's ref.current, not a document-wide SVG query. */
  svgElement?: SVGSVGElement | null;
  backgroundColor?: string;
  scale?: number;
}
export type ContextualExportOutcome =
  | { kind: 'download'; filename: string; formatLabel: string }
  | { kind: 'print'; formatLabel: string };

const text = (value: unknown): string => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
// XML 1.0 does not permit most control characters, even as numeric entities.
export const escapeExportXml = (value: unknown): string => text(value)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const escapeExportLatex = (value: unknown): string => text(value).replace(/[\\{}$&#%_~^]/g, char => ({
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
  '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
})[char]!);
/** Spreadsheet programs must never interpret user-supplied text as a formula. */
export const safeSpreadsheetText = (value: unknown): string => {
  const result = text(value);
  return typeof value !== 'number' && (/^[\s\u0000-\u001f]*[=+@-]/.test(result) || /^[\t\r\n]/.test(result)) ? `'${result}` : result;
};
const columns = (payload: ContextualExportPayload): string[] => Array.from(new Set(payload.rows.flatMap(row => Object.keys(row))));
const artifact = (content: string, mimeType: string, extension: string, formatLabel: string): ContextualExportArtifact => ({ content, mimeType, extension, formatLabel });

export function serializeContextualCsv(payload: ContextualExportPayload): string {
  const keys = columns(payload);
  const quote = (value: unknown) => `"${safeSpreadsheetText(value).replace(/"/g, '""')}"`;
  const header = ['Result title', 'Provenance (JSON)', 'Metadata (JSON)', ...keys];
  // Keep a rectangular table; repeat context so each selected result row stands alone.
  const rows = payload.rows.length ? payload.rows : [{}];
  return [header.map(quote).join(','), ...rows.map(row => [payload.title, payload.provenance, payload.metadata ?? {}, ...keys.map(key => row[key])].map(quote).join(','))].join('\r\n');
}
export function serializeContextualJson(payload: ContextualExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
export function serializeContextualLatex(payload: ContextualExportPayload): string {
  const e = escapeExportLatex;
  const keys = columns(payload);
  const context = [`\\section*{${e(payload.title)}}`, `\\paragraph{Provenance} ${e(payload.provenance)}`, `\\paragraph{Metadata} ${e(payload.metadata ?? {})}`];
  if (keys.length) context.push(`\\begin{tabular}{${keys.map(() => 'l').join('')}}`, keys.map(e).join(' & ') + ' \\\\', '\\hline', ...payload.rows.map(row => keys.map(key => e(row[key])).join(' & ') + ' \\\\'), '\\end{tabular}');
  else context.push('No result rows.');
  if (payload.graph) context.push(`\\paragraph{Graph data} ${e(payload.graph)}`);
  return ['\\documentclass{article}', '\\usepackage[T1]{fontenc}', '\\begin{document}', ...context, '\\end{document}'].join('\n');
}

function resultHtml(payload: ContextualExportPayload): string {
  const e = escapeExportXml;
  const keys = columns(payload);
  return `<h1>${e(payload.title)}</h1><h2>Provenance</h2><pre>${e(JSON.stringify(payload.provenance, null, 2))}</pre><h2>Metadata</h2><pre>${e(JSON.stringify(payload.metadata ?? {}, null, 2))}</pre><h2>Selected result</h2>` +
    (keys.length ? `<table><thead><tr>${keys.map(key => `<th>${e(key)}</th>`).join('')}</tr></thead><tbody>${payload.rows.map(row => `<tr>${keys.map(key => `<td>${e(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>No result rows.</p>') +
    (payload.graph ? `<h2>Graph data</h2><pre>${e(JSON.stringify(payload.graph, null, 2))}</pre>` : '');
}
function htmlDocument(payload: ContextualExportPayload, slides = false): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeExportXml(payload.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111;background:white}table{border-collapse:collapse;max-width:100%}th,td{border:1px solid #aaa;padding:6px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1,h2{break-after:avoid}tr{break-inside:avoid}${slides ? 'body{max-width:1200px;margin:48px auto}h2{break-before:page}@media print{@page{size:landscape}}' : ''}</style></head><body>${slides ? '<p>HTML presentation — not a PowerPoint (.pptx) file.</p>' : ''}${resultHtml(payload)}</body></html>`;
}
export function serializeContextualWord(payload: ContextualExportPayload): string { return htmlDocument(payload); }
export function serializeContextualPowerpoint(payload: ContextualExportPayload): string { return htmlDocument(payload, true); }
export function serializeContextualExcel(payload: ContextualExportPayload): string {
  const e = escapeExportXml;
  const cell = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
    : `<Cell><Data ss:Type="String">${e(safeSpreadsheetText(value))}</Data></Cell>`;
  const row = (values: unknown[]) => `<Row>${values.map(cell).join('')}</Row>`;
  const keys = columns(payload);
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Selected result"><Table>${row(keys)}${payload.rows.map(item => row(keys.map(key => item[key]))).join('')}</Table></Worksheet><Worksheet ss:Name="Context"><Table>${row(['Title', payload.title])}${row(['Provenance (JSON)', payload.provenance])}${row(['Metadata (JSON)', payload.metadata ?? {}])}${payload.graph ? row(['Graph (JSON)', payload.graph]) : ''}</Table></Worksheet></Workbook>`;
}

function requireGraph(payload: ContextualExportPayload) {
  if (!payload.graph) throw new Error('This selected result has no graph nodes and edges to export.');
  const graph = payload.graph;
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    const id = String(node.id);
    if (!id || ids.has(id)) throw new Error('Graph node IDs must be nonempty and unique.');
    ids.add(id);
  }
  for (const edge of graph.edges) {
    if (!ids.has(String(edge.source)) || !ids.has(String(edge.target))) throw new Error('A graph edge references a missing node.');
    if (edge.weight !== undefined && !Number.isFinite(edge.weight)) throw new Error('Graph edge weights must be finite numbers.');
  }
  return graph;
}
const edgeDirected = (graph: NonNullable<ContextualExportPayload['graph']>, edge: ContextualExportEdge) => edge.directed ?? graph.directed ?? false;
export function serializeContextualNet(payload: ContextualExportPayload): string {
  const graph = requireGraph(payload);
  const ids = new Map(graph.nodes.map((node, i) => [String(node.id), i + 1]));
  const label = (value: unknown) => `"${text(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')}"`;
  const lines = [`*Network ${label(payload.title)}`, `% Provenance ${text(payload.provenance).replace(/[\r\n]/g, ' ')}`, `% Metadata ${text(payload.metadata ?? {}).replace(/[\r\n]/g, ' ')}`, `*Vertices ${graph.nodes.length}`, ...graph.nodes.map((node, i) => `${i + 1} ${label(node.label ?? node.id)}`)];
  for (const directed of [false, true]) {
    const edges = graph.edges.filter(edge => edgeDirected(graph, edge) === directed);
    if (edges.length) lines.push(directed ? '*Arcs' : '*Edges', ...edges.map(edge => `${ids.get(String(edge.source))} ${ids.get(String(edge.target))} ${edge.weight ?? 1}`));
  }
  return lines.join('\n');
}
export function serializeContextualGexf(payload: ContextualExportPayload): string {
  const graph = requireGraph(payload), e = escapeExportXml;
  return `<?xml version="1.0" encoding="UTF-8"?><gexf xmlns="http://gexf.net/1.3" version="1.3"><meta><description>${e(JSON.stringify({ title: payload.title, provenance: payload.provenance, metadata: payload.metadata ?? {} }))}</description></meta><graph mode="static" defaultedgetype="${graph.directed ? 'directed' : 'undirected'}"><nodes>${graph.nodes.map(node => `<node id="${e(node.id)}" label="${e(node.label ?? node.id)}"/>`).join('')}</nodes><edges>${graph.edges.map((edge, i) => `<edge id="e${i}" source="${e(edge.source)}" target="${e(edge.target)}" type="${edgeDirected(graph, edge) ? 'directed' : 'undirected'}" weight="${edge.weight ?? 1}"/>`).join('')}</edges></graph></gexf>`;
}
export function serializeContextualGraphml(payload: ContextualExportPayload): string {
  const graph = requireGraph(payload), e = escapeExportXml;
  return `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="label" for="node" attr.name="label" attr.type="string"/><key id="weight" for="edge" attr.name="weight" attr.type="double"/><key id="context" for="graph" attr.name="context" attr.type="string"/><graph id="G" edgedefault="${graph.directed ? 'directed' : 'undirected'}"><data key="context">${e(JSON.stringify({ title: payload.title, provenance: payload.provenance, metadata: payload.metadata ?? {} }))}</data>${graph.nodes.map(node => `<node id="${e(node.id)}"><data key="label">${e(node.label ?? node.id)}</data></node>`).join('')}${graph.edges.map((edge, i) => `<edge id="e${i}" source="${e(edge.source)}" target="${e(edge.target)}" directed="${edgeDirected(graph, edge)}"><data key="weight">${edge.weight ?? 1}</data></edge>`).join('')}</graph></graphml>`;
}

/** Pure serialization; browser-only formats deliberately reject here. */
export function serializeContextualExport(payload: ContextualExportPayload, format: ContextualExportFormat): ContextualExportArtifact {
  switch (format) {
    case 'csv': return artifact(serializeContextualCsv(payload), 'text/csv;charset=utf-8', 'csv', 'CSV');
    case 'json': return artifact(serializeContextualJson(payload), 'application/json;charset=utf-8', 'json', 'JSON');
    case 'latex': return artifact(serializeContextualLatex(payload), 'application/x-latex;charset=utf-8', 'tex', 'LaTeX');
    case 'word': return artifact(serializeContextualWord(payload), 'application/msword;charset=utf-8', 'doc', 'Word-compatible HTML (.doc), not DOCX');
    case 'excel': return artifact(serializeContextualExcel(payload), 'application/vnd.ms-excel;charset=utf-8', 'xls', 'Excel Spreadsheet XML (.xls), not XLSX');
    case 'powerpoint': return artifact(serializeContextualPowerpoint(payload), 'text/html;charset=utf-8', 'html', 'HTML presentation (.html), not PowerPoint PPTX');
    case 'net': return artifact(serializeContextualNet(payload), 'text/plain;charset=utf-8', 'net', 'Pajek network');
    case 'gexf': return artifact(serializeContextualGexf(payload), 'application/xml;charset=utf-8', 'gexf', 'GEXF network');
    case 'graphml': return artifact(serializeContextualGraphml(payload), 'application/xml;charset=utf-8', 'graphml', 'GraphML network');
    default: throw new Error(`${format} requires a browser${format === 'pdf' ? ' print dialog' : ' and the selected SVG element'}.`);
  }
}
export function contextualExportFilename(title: string, extension: string): string {
  const base = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 140) || 'selected-result';
  return `${/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(base) ? '_' : ''}${base}.${extension}`;
}

/** Serialize the actual selected SVG, including its computed CSS, without mutating it. */
export function captureContextualSvg(element: SVGSVGElement): string {
  if (!element || element.localName !== 'svg') throw new Error('Select a result with an SVG visualization before exporting an image.');
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('The selected SVG has no browser window.');
  const clone = element.cloneNode(true) as SVGSVGElement;
  const originals = [element, ...Array.from(element.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  originals.forEach((source, index) => {
    const target = copies[index];
    if (['script', 'foreignobject', 'iframe', 'object', 'embed', 'animate', 'set'].includes(source.localName.toLowerCase())) throw new Error('The selected SVG contains active or embedded content that cannot be safely exported.');
    for (const attribute of Array.from(source.attributes)) {
      if (/^on/i.test(attribute.name)) target.removeAttribute(attribute.name);
      if (['href', 'xlink:href'].includes(attribute.name) && !/^(#|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(attribute.value)) throw new Error('The selected SVG references an external resource. Embed that resource before exporting.');
    }
    const style = view.getComputedStyle(source);
    const declarations: string[] = [];
    for (const key of Array.from(style)) {
      const value = style.getPropertyValue(key).replace(/url\(["']?[^)"']*#([^)'" ]+)["']?\)/g, 'url(#$1)');
      if (/url\(/i.test(value) && !/url\(["']?#/i.test(value)) throw new Error('The selected SVG uses an external CSS resource. Embed it before exporting.');
      declarations.push(`${key}:${value}`);
    }
    target.setAttribute('style', declarations.join(';'));
  });
  const bounds = element.getBoundingClientRect();
  const width = bounds.width || element.viewBox.baseVal.width || element.width.baseVal.value;
  const height = bounds.height || element.viewBox.baseVal.height || element.height.baseVal.value;
  if (!(width > 0 && height > 0)) throw new Error('The selected SVG must have a visible, nonzero size.');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(clone);
}

export async function contextualSvgImageBlob(element: SVGSVGElement, format: 'svg' | 'png' | 'jpg', options: Pick<ContextualExportOptions, 'scale' | 'backgroundColor'> = {}): Promise<Blob> {
  await element.ownerDocument.fonts?.ready;
  const svg = captureContextualSvg(element);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') return blob;
  const scale = options.scale ?? 2;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error('Image scale must be greater than zero and at most 8.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('The selected SVG could not be rendered as an image.')); image.src = url; });
    const canvas = element.ownerDocument.createElement('canvas');
    canvas.width = Math.ceil(image.naturalWidth * scale);
    canvas.height = Math.ceil(image.naturalHeight * scale);
    if (!canvas.width || !canvas.height || canvas.width * canvas.height > 64_000_000) throw new Error('The requested image dimensions are empty or too large.');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser does not support canvas image export.');
    if (format === 'jpg' || options.backgroundColor) {
      context.fillStyle = options.backgroundColor ?? '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      try { canvas.toBlob(result => result ? resolve(result) : reject(new Error('The browser failed to encode the selected image.')), format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95); }
      catch (error) { reject(error); }
    });
  } finally { URL.revokeObjectURL(url); }
}
export function downloadContextualBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url; link.download = filename; link.style.display = 'none';
    document.body.appendChild(link); link.click();
  } finally {
    link.remove();
    // A deferred revoke lets the browser consume the URL before download starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Opens browser Print; the user may choose Save as PDF. Does not generate a PDF file. */
export async function printContextualResult(payload: ContextualExportPayload, svgElement?: SVGSVGElement | null): Promise<void> {
  const svg = svgElement ? captureContextualSvg(svgElement) : '';
  const frame = document.createElement('iframe');
  frame.title = 'Print selected result';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  // No scripts or network resources in the generated document.
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  const html = htmlDocument(payload).replace('</body>', `${svg}</body>`);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { frame.remove(); reject(new Error('The print document did not load.')); }, 15000);
    frame.onload = async () => {
      clearTimeout(timeout);
      try {
        const printWindow = frame.contentWindow;
        if (!printWindow) throw new Error('The browser could not open the print document.');
        await frame.contentDocument?.fonts?.ready;
        printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
        printWindow.focus(); printWindow.print();
        // Some browsers do not fire afterprint when the dialog is cancelled.
        setTimeout(() => frame.remove(), 60000);
        resolve();
      } catch (error) { frame.remove(); reject(error); }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

/** Toolbar entry point. Await and show rejected errors; never report print as a saved PDF. */
/** Stable toolbar-facing alias. */
export const exportContext = exportContextualResult;
export const captureSvg = captureContextualSvg;
export function serializeNetwork(graph: NonNullable<ContextualExportPayload['graph']>, format: 'net' | 'gexf' | 'graphml', context: Pick<ContextualExportPayload, 'title' | 'provenance'> = { title: 'Selected network', provenance: {} }): string {
  const payload: ContextualExportPayload = { ...context, rows: [], graph };
  return format === 'net' ? serializeContextualNet(payload) : format === 'gexf' ? serializeContextualGexf(payload) : serializeContextualGraphml(payload);
}

export async function exportContextualResult(payload: ContextualExportPayload, format: ContextualExportFormat, options: ContextualExportOptions = {}): Promise<ContextualExportOutcome> {
  if (format === 'word' || format === 'excel' || format === 'powerpoint') {
    const { createOfficeExport } = await import('./officeExport.js');
    const result = createOfficeExport(payload, format);
    const filename = contextualExportFilename(options.filename ?? payload.title, result.extension);
    downloadContextualBlob(new Blob([new Uint8Array(result.bytes)], { type: result.mimeType }), filename);
    return { kind: 'download', filename, formatLabel: result.formatLabel };
  }
  if (format === 'pdf') {
    await printContextualResult(payload, options.svgElement);
    return { kind: 'print', formatLabel: 'Browser print dialog (choose Save as PDF)' };
  }
  if (format === 'svg' || format === 'png' || format === 'jpg') {
    if (!options.svgElement) throw new Error('Select a result with an SVG visualization before exporting an image.');
    const blob = await contextualSvgImageBlob(options.svgElement, format, options);
    const filename = contextualExportFilename(options.filename ?? payload.title, format);
    downloadContextualBlob(blob, filename);
    return { kind: 'download', filename, formatLabel: format.toUpperCase() };
  }
  const result = serializeContextualExport(payload, format);
  const filename = contextualExportFilename(options.filename ?? payload.title, result.extension);
  downloadContextualBlob(new Blob([result.content], { type: result.mimeType }), filename);
  return { kind: 'download', filename, formatLabel: result.formatLabel };
}
