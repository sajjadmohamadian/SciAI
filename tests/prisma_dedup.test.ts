import assert from "node:assert/strict";
import { test } from "node:test";
import { deduplicatePrismaRecords } from "../server/prisma_dedup.js";
import { BibliometricDocument } from "../src/types.js";

const document = (id: string, title: string, doi?: string): BibliometricDocument => ({
  id, title, doi, authors: ["Researcher"], year: 2022, source: "Journal", citations: 0, keywords: [],
});

test("PRISMA deduplication retains canonical records and audits exact matches", () => {
  const input = [
    document("a", "A sufficiently long original title", "10.1234/example"),
    document("b", "A sufficiently long original title", "https://doi.org/10.1234/example"),
    document("c", "A sufficiently long second title"),
    document("d", "A sufficiently long second title!"),
  ];
  const result = deduplicatePrismaRecords(input);
  assert.deepEqual(result.documents.map((item) => item.id), ["a", "c"]);
  assert.deepEqual(result.removed.map((item) => [item.document_id, item.retained_id, item.rule]), [
    ["b", "a", "exact_doi"], ["d", "c", "exact_title"],
  ]);
  assert.equal(input.length, 4);
});

test("PRISMA exact title deduplication does not merge conflicting DOIs", () => {
  const result = deduplicatePrismaRecords([
    document("a", "This shared long title has different identifiers", "10.1234/one"),
    document("b", "This shared long title has different identifiers", "10.1234/two"),
  ]);
  assert.equal(result.documents.length, 2);
  assert.equal(result.removed.length, 0);
});

test("ambiguous titles with conflicting DOIs do not absorb DOI-less records", () => {
  const title = "A shared title with different verified identities";
  const result = deduplicatePrismaRecords([
    document("unknown", title),
    document("one", title, "10.1234/one"),
    document("two", title, "10.1234/two"),
  ]);
  assert.deepEqual(result.documents.map((item) => item.id), ["unknown", "one", "two"]);
  assert.equal(result.removed.length, 0);
});
