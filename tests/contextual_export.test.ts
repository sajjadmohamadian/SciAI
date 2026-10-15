import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contextualExportFilename,
  escapeExportXml,
  escapeExportLatex,
  safeSpreadsheetText,
  serializeContextualCsv,
  serializeContextualExcel,
  serializeContextualExport,
  serializeContextualGexf,
  serializeContextualGraphml,
  serializeContextualNet,
  serializeContextualPowerpoint,
  serializeContextualWord,
  serializeNetwork,
  type ContextualExportPayload,
} from '../src/utils/contextualExport';

const payload: ContextualExportPayload = {
  title: 'Selected <result>',
  provenance: { source: 'study-1', query: 'x&y' },
  metadata: { count: 1 },
  rows: [{ id: 'r1', value: 42, note: '=SUM(A1:A2)' }],
  graph: {
    directed: true,
    nodes: [{ id: 'a', label: 'A & <alpha>' }, { id: 'b', label: 'B' }],
    edges: [{ source: 'a', target: 'b', weight: 0.5 }],
  },
};

test('escaping protects XML, LaTeX, and spreadsheet formulas', () => {
  assert.equal(escapeExportXml(`<&"'`), '&lt;&amp;&quot;&apos;');
  assert.match(escapeExportLatex('a_b%'), /\\_/);
  assert.equal(safeSpreadsheetText('=1+1'), "'=1+1");
  assert.equal(safeSpreadsheetText(42), '42');
});

test('CSV exports only selected rows and repeats context', () => {
  const csv = serializeContextualCsv(payload);
  assert.match(csv, /Selected <result>/);
  assert.match(csv, /study-1/);
  assert.match(csv, /r1/);
  assert.match(csv, /'=SUM/);
  assert.doesNotMatch(csv, /corpus|all studies/i);
});

test('JSON and document fallbacks preserve payload context', () => {
  const json = serializeContextualExport(payload, 'json');
  assert.match(json.content, /"rows"/);
  assert.equal(json.extension, 'json');
  assert.match(serializeContextualWord(payload), /Word-compatible|Selected/);
  assert.match(serializeContextualPowerpoint(payload), /not a PowerPoint/);
});

test('Spreadsheet XML is honest .xls and escapes cells', () => {
  const xml = serializeContextualExcel(payload);
  assert.match(xml, /urn:schemas-microsoft-com:office:spreadsheet/);
  assert.match(xml, /&lt;result&gt;/);
  assert.match(xml, /&amp;lt;|&lt;/);
  assert.equal(serializeContextualExport(payload, 'excel').extension, 'xls');
});

test('network formats contain actual nodes, edges, ids, labels, and weights', () => {
  const net = serializeContextualNet(payload);
  assert.match(net, /\*Vertices 2/);
  assert.match(net, /1 "A &lt;alpha&gt;"|1 "A & <alpha>"/);
  assert.match(net, /1 2 0\.5/);
  const gexf = serializeContextualGexf(payload);
  assert.match(gexf, /id="a"/);
  assert.match(gexf, /weight="0\.5"/);
  const graphml = serializeContextualGraphml(payload);
  assert.match(graphml, /source="a" target="b"/);
  assert.match(serializeNetwork(payload.graph!, 'gexf'), /<gexf/);
});

test('network serializers reject missing nodes and duplicate ids', () => {
  assert.throws(() => serializeContextualNet({ ...payload, graph: { nodes: [{ id: 'a' }, { id: 'a' }], edges: [] } }), /unique/);
  assert.throws(() => serializeContextualGraphml({ ...payload, graph: { nodes: [{ id: 'a' }], edges: [{ source: 'a', target: 'missing' }] } }), /missing node/);
});

test('filename sanitization handles unsafe and reserved names', () => {
  assert.equal(contextualExportFilename('report:final?', 'csv'), 'report_final_.csv');
  assert.equal(contextualExportFilename('CON', 'json'), '_CON.json');
  assert.equal(contextualExportFilename('  ', 'csv'), 'selected-result.csv');
});

test('browser-only formats are explicit rather than fake files', () => {
  assert.throws(() => serializeContextualExport(payload, 'pdf'), /browser/);
  assert.throws(() => serializeContextualExport(payload, 'png'), /SVG/);
  assert.equal(serializeContextualExport(payload, 'powerpoint').extension, 'html');
});
