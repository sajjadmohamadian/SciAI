/** Dependency-free, browser-safe OOXML snapshots of one selected result.
 * No macros, external links, formulas, charts, images, or analysis are generated.
 * All formats retain title, provenance, metadata, rows and optional graph data.
 * Limits reject the entire export, never silently shorten it. ZIP uses stored entries.
 */
import type { ContextualExportPayload, ContextualExportRow } from './contextualExport';

export type OfficeExportFormat = 'word' | 'excel' | 'powerpoint';
export interface OfficeExportArtifact {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  formatLabel: string;
}

/** Deliberately below ZIP32/Office limits to bound synchronous browser work. */
export const OFFICE_EXPORT_LIMITS = Object.freeze({
  sourceCharacters: 4_000_000,
  packageBytes: 16_000_000,
  records: 50_000,
  cells: 20_000,
  renderedTextCharacters: 4_000_000,
  columns: 256,
  slides: 500,
  excelCellCharacters: 32_767,
  nestingDepth: 32,
});
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org';
const REL = `${NS}/officeDocument/2006/relationships`;
const W = `${NS}/wordprocessingml/2006/main`;
const S = `${NS}/spreadsheetml/2006/main`;
const A = `${NS}/drawingml/2006/main`;
const P = `${NS}/presentationml/2006/main`;
const encoder = new TextEncoder();
type Part = { name: string; content: string };
type Table = { name: string; rows: ContextualExportRow[]; keys: string[] };
const limitation = 'Data snapshot only: no charts, images, live analysis, macros or formulas. Objects/arrays use JSON; null is shown as [null], missing values as [missing].';

function fail(message: string): never { throw new Error(`Office export: ${message}`); }
function checkXmlText(value: string): void {
  // XML 1.0 cannot represent these, including via numeric entities. Reject, do not lose data.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/u.test(value)) fail('text contains characters forbidden by XML 1.0.');
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) fail('text contains an unpaired Unicode surrogate.');
  }
}
const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\r/g, '&#13;');
function display(value: unknown): string {
  if (value === undefined) return '[missing]';
  if (value === null) return '[null]';
  if (typeof value === 'object') return JSON.stringify(value);
  return Object.is(value, -0) ? '-0' : String(value);
}

function validate(payload: ContextualExportPayload): Table[] {
  let characters = 0;
  let values = 0;
  const stack = new Set<object>();
  const missingAllowed = new Set<object>();
  function visit(value: unknown, depth: number): void {
    if (++values > 1_000_000) fail('too many values (maximum 1,000,000).');
    if (depth > OFFICE_EXPORT_LIMITS.nestingDepth) fail('data nesting exceeds 32 levels.');
    if (value === null || value === undefined || typeof value === 'boolean') return;
    if (typeof value === 'string') {
      characters += value.length;
      if (characters > OFFICE_EXPORT_LIMITS.sourceCharacters) fail('source text exceeds 4,000,000 characters.');
      checkXmlText(value);
      return;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('non-finite numbers are not supported; supply an explicit string instead.');
      return;
    }
    if (typeof value !== 'object') fail('only plain JSON-compatible values and missing cells are supported.');
    if (stack.has(value)) fail('circular data cannot be exported.');
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('only plain objects and arrays are supported.');
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) fail('sparse arrays and named array properties are not supported.');
    }
    stack.add(value);
    for (const key of Object.keys(value)) {
      visit(key, depth + 1);
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor)) fail('accessor properties are not supported.');
      // JSON silently changes these inside objects/arrays: refuse rather than lose information.
      if (descriptor.value === undefined && !missingAllowed.has(value)) {
        fail('nested undefined values are not supported; use null or omit the property.');
      }
      visit(descriptor.value, depth + 1);
    }
    stack.delete(value);
  }
  if (!payload || typeof payload.title !== 'string' || !Array.isArray(payload.rows) || !payload.provenance || typeof payload.provenance !== 'object' || Array.isArray(payload.provenance)) fail('a title, provenance object and rows array are required.');
  const isRow = (value: unknown): value is ContextualExportRow => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!payload.rows.every(isRow)) fail('every result row must be an object.');
  if (payload.metadata !== undefined && !isRow(payload.metadata)) fail('metadata must be an object.');
  if (payload.graph && (!Array.isArray(payload.graph.nodes) || !Array.isArray(payload.graph.edges) || !payload.graph.nodes.every(isRow) || !payload.graph.edges.every(isRow))) fail('graph nodes and edges must be arrays of objects.');
  const count = payload.rows.length + (payload.graph?.nodes.length ?? 0) + (payload.graph?.edges.length ?? 0);
  if (count > OFFICE_EXPORT_LIMITS.records) fail('more than 50,000 result/graph records.');
  missingAllowed.add(payload);
  for (const row of payload.rows) missingAllowed.add(row);
  if (payload.graph) {
    missingAllowed.add(payload.graph);
    for (const row of [...payload.graph.nodes, ...payload.graph.edges]) missingAllowed.add(row);
  }
  visit(payload, 0);
  const table = (name: string, rows: ContextualExportRow[]): Table => {
    const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    if (keys.length > OFFICE_EXPORT_LIMITS.columns) fail('a table exceeds 256 columns.');
    return { name, rows, keys };
  };
  const tables = [table('Selected result', payload.rows)];
  if (payload.graph) tables.push(table('Graph nodes', payload.graph.nodes), table('Graph edges', payload.graph.edges));
  if (tables.reduce((sum, item) => sum + item.rows.length * Math.max(1, item.keys.length), 0) > OFFICE_EXPORT_LIMITS.cells) fail('tables exceed 20,000 cells.');
  let renderedCharacters = display(payload.provenance).length + display(payload.metadata ?? {}).length + payload.title.length;
  for (const table of tables) {
    for (const row of table.rows) {
      for (const key of table.keys) {
        renderedCharacters += key.length + display(row[key]).length;
        if (renderedCharacters > OFFICE_EXPORT_LIMITS.renderedTextCharacters) fail('expanded table text exceeds 4,000,000 characters.');
      }
    }
  }
  return tables;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(parts: Part[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  let localSize = 0, centralSize = 0;
  for (const part of parts) {
    // Avoid even the UTF-8 allocation if the UTF-16 source already exceeds the limit.
    if (part.content.length > OFFICE_EXPORT_LIMITS.packageBytes) fail('package exceeds 16,000,000 bytes.');
    const name = encoder.encode(part.name), data = encoder.encode(part.content);
    const nextLocal = localSize + 30 + name.length + data.length;
    centralSize += 46 + name.length;
    if (nextLocal + centralSize + 22 > OFFICE_EXPORT_LIMITS.packageBytes) fail('package exceeds 16,000,000 bytes.');
    entries.push({ name, data, crc: crc32(data), offset: localSize });
    localSize = nextLocal;
  }
  if (entries.length > 65_535) fail('too many ZIP entries.');
  const bytes = new Uint8Array(localSize + centralSize + 22), view = new DataView(bytes.buffer);
  const u16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) => view.setUint32(offset, value, true);
  let cursor = 0;
  for (const entry of entries) {
    u32(cursor, 0x04034b50); u16(cursor + 4, 20); u16(cursor + 6, 0x0800);
    u16(cursor + 8, 0); u16(cursor + 12, 33); // Stored; deterministic 1980-01-01.
    u32(cursor + 14, entry.crc); u32(cursor + 18, entry.data.length); u32(cursor + 22, entry.data.length);
    u16(cursor + 26, entry.name.length);
    bytes.set(entry.name, cursor + 30); bytes.set(entry.data, cursor + 30 + entry.name.length);
    cursor += 30 + entry.name.length + entry.data.length;
  }
  const start = cursor;
  for (const entry of entries) {
    u32(cursor, 0x02014b50); u16(cursor + 4, 20); u16(cursor + 6, 20); u16(cursor + 8, 0x0800);
    u16(cursor + 10, 0); u16(cursor + 14, 33); u32(cursor + 16, entry.crc);
    u32(cursor + 20, entry.data.length); u32(cursor + 24, entry.data.length); u16(cursor + 28, entry.name.length);
    u32(cursor + 42, entry.offset); bytes.set(entry.name, cursor + 46);
    cursor += 46 + entry.name.length;
  }
  u32(cursor, 0x06054b50); u16(cursor + 8, entries.length); u16(cursor + 10, entries.length);
  u32(cursor + 12, cursor - start); u32(cursor + 16, start);
  return bytes;
}
function relations(items: [string, string, string][]): string {
  return XML + `<Relationships xmlns="${NS}/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
}
function packageParts(main: string, overrides: [string, string][], parts: Part[]): Part[] {
  return [
    { name: '[Content_Types].xml', content: XML + `<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([path, type]) => `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', content: relations([['rId1', 'officeDocument', main]]) },
    ...parts,
  ];
}

function word(payload: ContextualExportPayload, tables: Table[]): Part[] {
  const paragraph = (value: string, style = ''): string => value.split(/\r\n|\n|\r/).map(line => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escape(line)}</w:t></w:r></w:p>`).join('');
  const heading = (value: string) => paragraph(value, 'Heading1');
  const pair = (key: string, value: unknown) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${paragraph(key)}</w:tc><w:tc><w:tcPr><w:tcW w:w="6960" w:type="dxa"/></w:tcPr>${paragraph(display(value))}</w:tc></w:tr>`;
  const table = (pairs: [string, unknown][]) => !pairs.length ? paragraph('{}') : `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="CBD5E1"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="6960"/></w:tblGrid>${pairs.map(([key, value]) => pair(key, value)).join('')}</w:tbl>`;
  const body = [paragraph(payload.title, 'Title'), paragraph(limitation), heading('Provenance'), table(Object.entries(payload.provenance)), heading('Metadata'), table(Object.entries(payload.metadata ?? {}))];
  if (payload.graph) body.push(paragraph(`Graph directed: ${display(payload.graph.directed)}`));
  for (const item of tables) {
    body.push(heading(item.name));
    if (!item.rows.length) body.push(paragraph('No records.'));
    item.rows.forEach((row, index) => {
      body.push(paragraph(`Record ${index + 1}`, 'Heading2'));
      body.push(item.keys.length ? table(item.keys.map(key => [key, row[key]])) : paragraph('Empty record.'));
    });
  }
  const document = body.join('');
  return packageParts('word/document.xml', [['word/document.xml', 'wordprocessingml.document.main'], ['word/styles.xml', 'wordprocessingml.styles']], [
    { name: 'word/document.xml', content: XML + `<w:document xmlns:w="${W}" xmlns:r="${REL}"><w:body>${document}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>` },
    { name: 'word/_rels/document.xml.rels', content: relations([['rId1', 'styles', 'styles.xml']]) },
    { name: 'word/styles.xml', content: XML + `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[['Title', 'Title', '36'], ['Heading1', 'heading 1', '28'], ['Heading2', 'heading 2', '24']].map(([id, name, size], i) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/>${i ? `<w:outlineLvl w:val="${i - 1}"/>` : ''}</w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`).join('')}</w:styles>` },
  ]);
}

function columnName(index: number): string {
  let result = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result;
  return result;
}
function excel(payload: ContextualExportPayload, tables: Table[]): Part[] {
  function cell(value: unknown, address: string, header = false): string {
    if (value === undefined) return `<c r="${address}"/>`;
    if (typeof value === 'boolean') return `<c r="${address}" t="b"><v>${value ? 1 : 0}</v></c>`;
    // Excel retains only 15 significant decimal digits and cannot represent subnormal doubles.
    const numericText = typeof value === 'number' ? String(value) : '';
    const significant = numericText.replace(/e.*$/i, '').replace(/[-.]/g, '').replace(/^0+|0+$/g, '').length;
    if (typeof value === 'number' && !Object.is(value, -0) && significant <= 15 && (value === 0 || Math.abs(value) >= 2.2250738585072014e-308)) return `<c r="${address}" t="n"><v>${value}</v></c>`;
    const valueText = display(value);
    if (valueText.length > OFFICE_EXPORT_LIMITS.excelCellCharacters) fail('an Excel cell exceeds 32,767 characters.');
    // Inline strings, never <f>, preserve formula-like text without modifying its contents.
    // Excel's _xHHHH_ escape syntax is itself escaped before XML escaping.
    const encoded = escape(valueText.replace(/_x[\da-f]{4}_/gi, match => `_x005F_${match.slice(1)}`)).replace(/\t/g, '&#9;').replace(/\n/g, '&#10;');
    return `<c r="${address}" s="${header ? 1 : value === null ? 2 : 0}" t="inlineStr"><is><t xml:space="preserve">${encoded}</t></is></c>`;
  }
  const context: unknown[][] = [['Field', 'Value'], ['Title', payload.title], ['Limitations', limitation], ['Cell types', '[null] in italic gray = explicit null; a blank cell = missing; empty text is an inline string. Numbers exceeding Excel precision/range are text.'], ['Provenance (JSON)', payload.provenance], ['Metadata (JSON)', payload.metadata ?? {}]];
  if (payload.graph) context.push(['Graph directed', payload.graph.directed]);
  const sheets = tables.map(item => ({ name: item.name, values: [item.keys.length ? item.keys : ['Record'], ...item.rows.map((row, index) => item.keys.length ? item.keys.map(key => row[key]) : [index + 1])] }));
  sheets.push({ name: 'Context', values: context });
  const parts: Part[] = [
    { name: 'xl/workbook.xml', content: XML + `<workbook xmlns="${S}" xmlns:r="${REL}"><sheets>${sheets.map((sheet, i) => `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: relations([...sheets.map((_, i): [string, string, string] => [`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`]), [`rId${sheets.length + 1}`, 'styles', 'styles.xml']]) },
    { name: 'xl/styles.xml', content: XML + `<styleSheet xmlns="${S}"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="11"/><color rgb="FF64748B"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3">${[0, 1, 2].map(i => `<xf numFmtId="0" fontId="${i}" fillId="${i === 1 ? 2 : 0}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
  ];
  sheets.forEach((sheet, index) => {
    const columns = Math.max(1, ...sheet.values.map(row => row.length));
    parts.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: XML + `<worksheet xmlns="${S}"><dimension ref="A1:${columnName(columns - 1)}${sheet.values.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="${columns}" width="28" customWidth="1"/></cols><sheetData>${sheet.values.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => cell(value, `${columnName(c)}${r + 1}`, r === 0)).join('')}</row>`).join('')}</sheetData></worksheet>` });
  });
  return packageParts('xl/workbook.xml', [['xl/workbook.xml', 'spreadsheetml.sheet.main'], ['xl/styles.xml', 'spreadsheetml.styles'], ...sheets.map((_, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, 'spreadsheetml.worksheet'])], parts);
}

// A conservative width estimate: wide Unicode and every non-ASCII code point consume
// two units. At 44 units, even full-width ASCII capitals have generous horizontal
// slack in the 12-inch body at 18pt; 14 lines at 26.1pt fit its 5.4-inch height.
function wrap(text: string, width = 44): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\n|\r/)) {
    let line = '', units = 0;
    for (const char of paragraph) {
      const cost = char === '\t' ? 8 : char.codePointAt(0)! > 127 ? 2 : 1;
      if (units + cost > width && line) { lines.push(line); line = ''; units = 0; }
      line += char; units += cost;
    }
    lines.push(line);
  }
  return lines;
}
const groupShape = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const colorMap = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
function theme(): string {
  const colors = { dk1: '17212B', lt1: 'FFFFFF', dk2: '334155', lt2: 'F1F5F9', accent1: '475569', accent2: '526D82', accent3: '577A6B', accent4: '97745A', accent5: '806683', accent6: '74828F', hlink: '0563C1', folHlink: '954F72' };
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return XML + `<a:theme xmlns:a="${A}" name="Selected result"><a:themeElements><a:clrScheme name="Selected result">${Object.entries(colors).map(([name, value]) => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`).join('')}</a:clrScheme><a:fontScheme name="Arial">${['majorFont', 'minorFont'].map(name => `<a:${name}><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:${name}>`).join('')}</a:fontScheme><a:fmtScheme name="Selected result"><a:fillStyleLst>${fill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[6350, 12700, 19050].map(width => `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}
function powerpoint(payload: ContextualExportPayload, tables: Table[]): Part[] {
  const pages: { title: string; lines: string[] }[] = [];
  function paginate(title: string, lines: string[]): void {
    for (let offset = 0; offset < Math.max(1, lines.length); offset += 14) {
      if (pages.length >= OFFICE_EXPORT_LIMITS.slides) fail('presentation exceeds 500 slides.');
      pages.push({ title: `${title}${offset ? ' (continued)' : ''}`, lines: lines.slice(offset, offset + 14) });
    }
  }
  paginate('Selected result title', wrap(payload.title));
  paginate('Export scope and limitations', wrap(limitation));
  paginate('Provenance', wrap(JSON.stringify(payload.provenance, null, 2)));
  paginate('Metadata', wrap(JSON.stringify(payload.metadata ?? {}, null, 2)));
  if (payload.graph) paginate('Graph context', wrap(`Directed: ${display(payload.graph.directed)}`));
  for (const table of tables) {
    if (!table.rows.length) paginate(table.name, ['No records.']);
    table.rows.forEach((row, index) => paginate(`${table.name} | Record ${index + 1}`, table.keys.length ? table.keys.flatMap(key => wrap(`${key}: ${display(row[key])}`)) : ['Empty record.']));
  }
  function shape(id: number, name: string, text: string[], x: number, y: number, cx: number, cy: number, size: number, title = false): string {
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${text.map(line => `<a:p><a:pPr><a:lnSpc><a:spcPts val="${Math.round(size * 1.45)}"/></a:lnSpc><a:buNone/></a:pPr><a:r><a:rPr lang="en-US" sz="${size}"${title ? ' b="1"' : ''}><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:rPr><a:t xml:space="preserve">${escape(line)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`).join('')}</p:txBody></p:sp>`;
  }
  const parts: Part[] = [
    { name: 'ppt/presentation.xml', content: XML + `<p:presentation xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${pages.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: 'ppt/_rels/presentation.xml.rels', content: relations([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ...pages.map((_, i): [string, string, string] => [`rId${i + 2}`, 'slide', `slides/slide${i + 1}.xml`])]) },
    { name: 'ppt/theme/theme1.xml', content: theme() },
    { name: 'ppt/slideMasters/slideMaster1.xml', content: XML + `<p:sldMaster xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"><p:cSld name="Selected result master"><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupShape}</p:spTree></p:cSld>${colorMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>` },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: relations([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', content: XML + `<p:sldLayout xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}" type="blank" preserve="1"><p:cSld name="Selected result text"><p:spTree>${groupShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: relations([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]) },
  ];
  pages.forEach((page, i) => {
    parts.push({ name: `ppt/slides/slide${i + 1}.xml`, content: XML + `<p:sld xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"><p:cSld><p:spTree>${groupShape}${shape(2, 'Section title', [page.title], 548640, 365760, 11094720, 731520, 2800, true)}${shape(3, 'Selected result content', page.lines, 548640, 1371600, 11094720, 4937760, 1800)}${shape(4, 'Page number', [`Selected result export | ${i + 1} / ${pages.length}`], 548640, 6400800, 11094720, 274320, 1000)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>` });
    parts.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, content: relations([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]) });
  });
  return packageParts('ppt/presentation.xml', [
    ['ppt/presentation.xml', 'presentationml.presentation.main'], ['ppt/theme/theme1.xml', 'theme'], ['ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster'], ['ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout'], ...pages.map((_, i): [string, string] => [`ppt/slides/slide${i + 1}.xml`, 'presentationml.slide']),
  ], parts);
}

/** Synchronous pure serialization. The caller owns download/Blob/UI handling.
 * Throws on unsupported data, XML-invalid text or a documented resource/Office limit.
 * Strings are UTF-8 XML-escaped. No DOM, Buffer, Node imports or third-party runtime.
 */
export function createOfficeExport(payload: ContextualExportPayload, format: OfficeExportFormat): OfficeExportArtifact {
  const tables = validate(payload);
  switch (format) {
    case 'word': return { bytes: zip(word(payload, tables)), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx', formatLabel: 'Word DOCX (editable data snapshot)' };
    case 'excel': return { bytes: zip(excel(payload, tables)), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', formatLabel: 'Excel XLSX (data snapshot; no formulas)' };
    case 'powerpoint': return { bytes: zip(powerpoint(payload, tables)), mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx', formatLabel: 'PowerPoint PPTX (paginated editable text snapshot)' };
    default: return fail(`unsupported format: ${String(format)}.`);
  }
}
