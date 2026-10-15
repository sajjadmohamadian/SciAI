import test from 'node:test';
import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { createOfficeExport, OFFICE_EXPORT_LIMITS, type OfficeExportFormat } from '../src/utils/officeExport';
import type { ContextualExportPayload } from '../src/utils/contextualExport';

// Independent, bit-at-a-time CRC (not the producer's lookup-table implementation).
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function unzip(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const end = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(end), 0x06054b50);
  assert.equal(buffer.readUInt16LE(end + 4), 0);
  assert.equal(buffer.readUInt16LE(end + 6), 0);
  const count = buffer.readUInt16LE(end + 10);
  assert.equal(buffer.readUInt16LE(end + 8), count);
  assert.equal(buffer.readUInt16LE(end + 20), 0);
  const start = buffer.readUInt32LE(end + 16);
  assert.equal(start + buffer.readUInt32LE(end + 12), end);
  const result = new Map<string, string>();
  let central = start, localEnd = 0;
  for (let entry = 0; entry < count; entry++) {
    assert.equal(buffer.readUInt32LE(central), 0x02014b50);
    assert.equal(buffer.readUInt16LE(central + 8), 0x0800);
    assert.equal(buffer.readUInt16LE(central + 10), 0);
    const expectedCrc = buffer.readUInt32LE(central + 16);
    const size = buffer.readUInt32LE(central + 20);
    assert.equal(buffer.readUInt32LE(central + 24), size);
    const nameLength = buffer.readUInt16LE(central + 28);
    const extraLength = buffer.readUInt16LE(central + 30);
    const commentLength = buffer.readUInt16LE(central + 32);
    const local = buffer.readUInt32LE(central + 42);
    assert.equal(local, localEnd);
    assert.equal(buffer.readUInt32LE(local), 0x04034b50);
    assert.equal(buffer.readUInt16LE(local + 6), 0x0800);
    assert.equal(buffer.readUInt16LE(local + 8), 0);
    assert.equal(buffer.readUInt32LE(local + 14), expectedCrc);
    assert.equal(buffer.readUInt32LE(local + 18), size);
    assert.equal(buffer.readUInt32LE(local + 22), size);
    assert.equal(buffer.readUInt16LE(local + 26), nameLength);
    const localName = buffer.subarray(local + 30, local + 30 + nameLength);
    assert.deepEqual(localName, buffer.subarray(central + 46, central + 46 + nameLength));
    const name = decoder.decode(localName);
    assert.ok(!result.has(name));
    assert.ok(!name.includes('..') && !name.startsWith('/'));
    const dataStart = local + 30 + nameLength + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), expectedCrc, `${name} CRC`);
    result.set(name, decoder.decode(data));
    localEnd = dataStart + size;
    central += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(localEnd, start);
  assert.equal(central, end);
  return result;
}

// Small strict parser for the generated XML subset; no third-party XML/ZIP packages.
// We test parsed element/attribute structures rather than only matching XML strings.
interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }
function decode(text: string): string {
  return text.replace(/&([^;]+);/g, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity in named) return named[entity];
    assert.match(entity, /^#(?:\d+|x[\da-fA-F]+)$/);
    return String.fromCodePoint(entity.startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  });
}
function parse(xml: string): XmlNode {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"'));
  assert.doesNotMatch(xml, /<!DOCTYPE|<!ENTITY/);
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  const tokens = xml.match(/<[^>]*>|[^<]+/g)!;
  assert.equal(tokens.join(''), xml);
  for (const token of tokens) {
    if (token.startsWith('<?')) continue;
    if (token.startsWith('</')) {
      assert.ok(stack.length > 1);
      assert.equal(stack.pop()!.name, token.slice(2, -1));
    } else if (token.startsWith('<')) {
      const match = /^<([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>$/.exec(token);
      assert.ok(match, `valid start tag: ${token}`);
      const attrs: Record<string, string> = {};
      for (const attribute of match[2].matchAll(/([\w:.-]+)="([^"]*)"/g)) {
        assert.ok(!(attribute[1] in attrs));
        attrs[attribute[1]] = decode(attribute[2]);
      }
      const node: XmlNode = { name: match[1], attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!match[3]) stack.push(node);
    } else {
      assert.doesNotMatch(token, /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/);
      stack[stack.length - 1].text += decode(token);
    }
  }
  assert.equal(stack.length, 1);
  assert.equal(root.children.length, 1);
  return root.children[0];
}
function descendants(node: XmlNode, name: string): XmlNode[] {
  return [...(node.name === name ? [node] : []), ...node.children.flatMap(child => descendants(child, name))];
}
function textNodes(node: XmlNode, name: string): string[] { return descendants(node, name).map(item => item.text); }
function checkPackage(members: Map<string, string>): Map<string, XmlNode> {
  const parsed = new Map(Array.from(members, ([name, content]) => [name, parse(content)]));
  const types = parsed.get('[Content_Types].xml')!;
  assert.equal(types.name, 'Types');
  const contentTypes = new Map(descendants(types, 'Override').map(node => [node.attrs.PartName.slice(1), node.attrs.ContentType]));
  for (const name of members.keys()) {
    if (name.endsWith('.xml') && name !== '[Content_Types].xml') assert.ok(contentTypes.has(name), `content type: ${name}`);
    if (!name.endsWith('.rels')) continue;
    const relationships = descendants(parsed.get(name)!, 'Relationship');
    assert.equal(new Set(relationships.map(node => node.attrs.Id)).size, relationships.length);
    const base = name === '_rels/.rels' ? '' : posix.dirname(posix.dirname(name));
    for (const node of relationships) {
      assert.equal(node.attrs.TargetMode, undefined);
      assert.ok(members.has(posix.normalize(posix.join(base, node.attrs.Target))), `relationship ${name} → ${node.attrs.Target}`);
      assert.ok(node.attrs.Type.startsWith('http://schemas.openxmlformats.org/officeDocument/2006/relationships/'));
    }
  }
  return parsed;
}
const payload: ContextualExportPayload = {
  title: `Selected <result> & "quotes" — پژوهش 😀`,
  provenance: { studio: 'Network', source: 'study-1', query: 'x & y < z' },
  metadata: { note: 'Selected result only', count: 2 },
  rows: [
    { name: 'α پژوهش 😀', value: 42, formula: '=SUM(A1:A2)', nullable: null, empty: '', bool: false, missing: undefined },
    { name: '<&>\'"', value: 0, formula: '@HYPERLINK("https://example.test")', nullable: 'null', empty: '', bool: true, extra: { a: [1, null] } },
  ],
  graph: { directed: true, nodes: [{ id: 'n1', label: 'Node <one>' }, { id: 'n2', label: 'Node & two' }], edges: [{ source: 'n1', target: 'n2', weight: 0.5 }] },
};

for (const [format, extension, main] of [
  ['word', 'docx', 'word/document.xml'], ['excel', 'xlsx', 'xl/workbook.xml'], ['powerpoint', 'pptx', 'ppt/presentation.xml'],
] as const) {
  test(`${format}: real deterministic OOXML ZIP, UTF-8, CRC, content types and internal relationships`, () => {
    const before = JSON.stringify(payload);
    const artifact = createOfficeExport(payload, format);
    assert.equal(artifact.extension, extension);
    assert.ok(artifact.mimeType.startsWith('application/vnd.openxmlformats-officedocument.'));
    assert.ok(artifact.bytes.length < OFFICE_EXPORT_LIMITS.packageBytes);
    assert.deepEqual(createOfficeExport(payload, format).bytes, artifact.bytes);
    assert.equal(JSON.stringify(payload), before);
    const members = unzip(artifact.bytes);
    const parsed = checkPackage(members);
    assert.ok(parsed.has(main));
    const strings = [...members.values()].join('');
    assert.ok(strings.includes('پژوهش') && strings.includes('😀'));
    assert.ok(strings.includes('&lt;') && strings.includes('&amp;') && strings.includes('&quot;'));
    assert.doesNotMatch(strings, /<html|<script|<f[\s>]|TargetMode="External"/);
    const rootRel = descendants(parsed.get('_rels/.rels')!, 'Relationship')[0];
    assert.equal(rootRel.attrs.Target, main);
  });
}

test('DOCX retains context, all rows and graph data in editable paragraphs/tables', () => {
  const parsed = checkPackage(unzip(createOfficeExport(payload, 'word').bytes));
  const document = parsed.get('word/document.xml')!;
  assert.equal(document.name, 'w:document');
  const texts = textNodes(document, 'w:t');
  assert.ok(texts.includes(payload.title));
  for (const expected of ['Provenance', 'Metadata', 'Selected result', 'Graph nodes', 'Graph edges', 'study-1', '=SUM(A1:A2)', '[null]', '[missing]', 'false', '0', 'Node <one>']) assert.ok(texts.includes(expected), expected);
  for (const table of descendants(document, 'w:tbl')) {
    assert.ok(descendants(table, 'w:tr').length);
    assert.equal(descendants(table, 'w:gridCol').reduce((sum, column) => sum + Number(column.attrs['w:w']), 0), 9360);
  }
  const styles = parsed.get('word/styles.xml')!;
  assert.ok(descendants(styles, 'w:style').some(node => node.attrs['w:styleId'] === 'Heading1'));
  assert.equal(descendants(document, 'w:pgSz')[0].attrs['w:w'], '12240');
  assert.equal(descendants(document, 'w:pgSz')[0].attrs['w:h'], '15840');
  assert.equal(descendants(document, 'w:tbl').length, 7); // Context + 2 result records + 3 graph records.
});

test('XLSX uses typed cells, explicit null and missing distinctions, no formula interpretation', () => {
  const parsed = checkPackage(unzip(createOfficeExport(payload, 'excel').bytes));
  const workbook = parsed.get('xl/workbook.xml')!;
  assert.deepEqual(descendants(workbook, 'sheet').map(node => node.attrs.name), ['Selected result', 'Graph nodes', 'Graph edges', 'Context']);
  const cells = new Map(descendants(parsed.get('xl/worksheets/sheet1.xml')!, 'c').map(node => [node.attrs.r, node]));
  assert.equal(cells.get('B2')!.attrs.t, 'n');
  assert.deepEqual(textNodes(cells.get('B2')!, 'v'), ['42']);
  assert.equal(cells.get('C2')!.attrs.t, 'inlineStr');
  assert.deepEqual(textNodes(cells.get('C2')!, 't'), ['=SUM(A1:A2)']);
  assert.deepEqual(textNodes(cells.get('D2')!, 't'), ['[null]']);
  assert.equal(cells.get('D2')!.attrs.s, '2');
  assert.deepEqual(textNodes(cells.get('E2')!, 't'), ['']);
  assert.equal(cells.get('F2')!.attrs.t, 'b');
  assert.deepEqual(textNodes(cells.get('F2')!, 'v'), ['0']);
  assert.deepEqual(cells.get('G2')!.children, []);
  assert.deepEqual(textNodes(cells.get('B3')!, 'v'), ['0']);
  assert.ok(textNodes(parsed.get('xl/worksheets/sheet4.xml')!, 't').includes(JSON.stringify(payload.provenance)));
});

test('XLSX escapes Excel string-escape tokens, preserves precision as text, and rejects overlong cells', () => {
  const source = { title: 'Types', provenance: {}, rows: [{ a: '_x000A_', b: '=1+1', c: 1.2345678901234567, d: Number.MIN_VALUE, e: -0, f: 'line1\r\nline2\tend' }] };
  const members = unzip(createOfficeExport(source, 'excel').bytes);
  const parsed = parse(members.get('xl/worksheets/sheet1.xml')!);
  const cells = new Map(descendants(parsed, 'c').map(node => [node.attrs.r, node]));
  assert.deepEqual(textNodes(cells.get('A2')!, 't'), ['_x005F_x000A_']);
  for (const address of ['B2', 'C2', 'D2', 'E2']) assert.equal(cells.get(address)!.attrs.t, 'inlineStr');
  assert.deepEqual(textNodes(cells.get('C2')!, 't'), ['1.2345678901234567']);
  assert.deepEqual(textNodes(cells.get('E2')!, 't'), ['-0']);
  assert.deepEqual(textNodes(cells.get('F2')!, 't'), ['line1\r\nline2\tend']);
  assert.throws(() => createOfficeExport({ ...source, rows: [{ a: 'x'.repeat(32_768) }] }, 'excel'), /32,767/);
  assert.doesNotThrow(() => createOfficeExport({ ...source, rows: [{ a: 'x'.repeat(32_767) }] }, 'excel'));
});

test('PPTX paginates long rows and provenance without truncation, with a real master/layout/theme', () => {
  const longText = 'W'.repeat(1300) + 'LAST_ROW_CHARACTER';
  const source: ContextualExportPayload = { title: payload.title, provenance: { source: 'Provenance '.repeat(100) + 'PROVENANCE_END' }, metadata: { source: 'Metadata source' }, rows: [{ text: longText }, ...Array.from({ length: 19 }, (_, i) => ({ text: `Record item ${i}` }))] };
  const parsed = checkPackage(unzip(createOfficeExport(source, 'powerpoint').bytes));
  const slideIds = descendants(parsed.get('ppt/presentation.xml')!, 'p:sldId');
  assert.ok(slideIds.length > source.rows.length + 4);
  assert.equal(descendants(parsed.get('ppt/presentation.xml')!, 'p:sldSz')[0].attrs.cx, '12192000');
  const content: string[] = [];
  for (let i = 1; i <= slideIds.length; i++) {
    const slide = parsed.get(`ppt/slides/slide${i}.xml`)!;
    const shapes = descendants(slide, 'p:sp');
    assert.equal(shapes.length, 3);
    const body = textNodes(shapes[1], 'a:t');
    assert.ok(body.length <= 14);
    for (const line of body) assert.ok([...line].reduce((sum, char) => sum + (char === '\t' ? 8 : char.codePointAt(0)! > 127 ? 2 : 1), 0) <= 44);
    assert.ok(descendants(shapes[1], 'a:rPr').every(node => node.attrs.sz === '1800'));
    assert.equal(descendants(shapes[1], 'p:cNvSpPr')[0].attrs.txBox, '1');
    assert.ok(textNodes(shapes[2], 'a:t')[0].endsWith(`${i} / ${slideIds.length}`));
    content.push(...body);
  }
  const joined = content.join('');
  assert.ok(joined.includes(`text: ${longText}`));
  assert.ok(joined.includes('PROVENANCE_END'));
  for (let i = 0; i < 19; i++) assert.ok(joined.includes(`text: Record item ${i}`));
  assert.equal(parsed.get('ppt/theme/theme1.xml')!.name, 'a:theme');
  assert.equal(descendants(parsed.get('ppt/theme/theme1.xml')!, 'a:effectStyle').length, 3);
  assert.equal(descendants(parsed.get('ppt/slideMasters/slideMaster1.xml')!, 'p:sldLayoutId').length, 1);
  assert.equal(parsed.get('ppt/slideLayouts/slideLayout1.xml')!.attrs.type, 'blank');
});

test('empty data and empty context remain valid Office packages', () => {
  const source = { title: '', provenance: {}, rows: [{}, {}] };
  for (const format of ['word', 'excel', 'powerpoint'] as const) {
    checkPackage(unzip(createOfficeExport(source, format).bytes));
    checkPackage(unzip(createOfficeExport({ ...source, rows: [] }, format).bytes));
  }
});

test('resource and unsupported-data limits reject rather than silently truncate', () => {
  const base: ContextualExportPayload = { title: 'Limit', provenance: {}, rows: [] };
  assert.throws(() => createOfficeExport({ ...base, title: 'x'.repeat(OFFICE_EXPORT_LIMITS.sourceCharacters + 1) }, 'word'), /4,000,000/);
  assert.throws(() => createOfficeExport({ ...base, rows: Array.from({ length: OFFICE_EXPORT_LIMITS.records + 1 }, () => ({})) }, 'excel'), /50,000/);
  assert.throws(() => createOfficeExport({ ...base, rows: [Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`c${i}`, i]))] }, 'excel'), /256 columns/);
  assert.throws(() => createOfficeExport({ ...base, rows: Array.from({ length: 501 }, () => ({ a: 1 })) }, 'powerpoint'), /500 slides/);
  assert.throws(() => createOfficeExport({ ...base, rows: Array.from({ length: 201 }, () => Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`c${i}`, i]))) }, 'word'), /20,000 cells/);
  assert.throws(() => createOfficeExport({ ...base, title: '\ud800' }, 'word'), /unpaired Unicode/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: '\u0000' }] }, 'excel'), /XML 1.0/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: Infinity }] }, 'word'), /non-finite/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: 1n }] }, 'word'), /JSON-compatible/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: { missing: undefined } }] }, 'word'), /nested undefined/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: Array(2) }] }, 'word'), /sparse arrays/);
  assert.throws(() => createOfficeExport({ ...base, rows: Array(2) }, 'word'), /sparse arrays/);
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: new Date() }] }, 'word'), /plain objects/);
  let nested: unknown = 'leaf';
  for (let i = 0; i < 40; i++) nested = { nested };
  assert.throws(() => createOfficeExport({ ...base, rows: [{ nested }] }, 'word'), /32 levels/);
  // A sparse union of long column names can expand well beyond the source size.
  assert.throws(() => createOfficeExport({ ...base, rows: [{ ['key'.repeat(15_000)]: 1 }, ...Array.from({ length: 100 }, () => ({}))] }, 'word'), /expanded table text/);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.throws(() => createOfficeExport({ ...base, rows: [cycle] }, 'word'), /circular/);
  assert.throws(() => createOfficeExport(base, 'pdf' as OfficeExportFormat), /unsupported format/);
  // Source is <4M characters, but escaping expands the ZIP above the byte limit.
  assert.throws(() => createOfficeExport({ ...base, rows: [{ a: '&'.repeat(3_300_000) }] }, 'word'), /16,000,000 bytes/);
});
