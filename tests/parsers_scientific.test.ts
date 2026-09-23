import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  parseCSVRecords,
  parseCSVLine,
  normalizeDOI,
  normalizeTitle,
  clean,
  splitAuthors,
} from "../server/parsers/normalizer.js";
import {
  ensureCanonical,
  createCanonicalDocument,
} from "../server/parsers/canonical.js";
import { parseCSV } from "../server/scientometrics.js";
import { SmartMergeEngine } from "../server/merge/deduplicator.js";

describe("Parser & Normalizer Scientific Regression Suite", () => {
  describe("CSV Quoting, Escaping & Multiline Handling (RFC-4180)", () => {
    test("Quoted CSV commas: commas inside quotes do not split columns", () => {
      const line = '"Doe, John","Scientometrics, informetrics, and altmetrics",2024';
      const cols = parseCSVLine(line);
      assert.equal(cols.length, 3);
      assert.equal(cols[0], "Doe, John");
      assert.equal(cols[1], "Scientometrics, informetrics, and altmetrics");
      assert.equal(cols[2], "2024");
    });

    test("Quoted CSV quotes: escaped quotes (\"\"') are unescaped properly", () => {
      const line = '"Smith, Alice","Study on ""Deep Learning"" in Bibliometrics",2023';
      const cols = parseCSVLine(line);
      assert.equal(cols.length, 3);
      assert.equal(cols[0], "Smith, Alice");
      assert.equal(cols[1], 'Study on "Deep Learning" in Bibliometrics');
      assert.equal(cols[2], "2023");
    });

    test("CSV fields containing embedded newlines (multiline cells)", () => {
      const csvText =
        'Authors,Title,Abstract,Year\n' +
        '"Doe, J.","Paper Title","Line 1 of abstract.\nLine 2 of abstract with embedded newline.",2024\n' +
        '"Roe, J.","Second Paper","Single line abstract",2023';

      const records = parseCSVRecords(csvText);
      assert.equal(records.length, 3, "Header + 2 data rows");

      const header = records[0];
      assert.equal(header[2], "Abstract");

      const row1 = records[1];
      assert.equal(row1[0], "Doe, J.");
      assert.equal(row1[1], "Paper Title");
      assert(row1[2].includes("\n"), "Abstract field should preserve embedded newline");
      assert(row1[2].includes("Line 1 of abstract."));
      assert(row1[2].includes("Line 2 of abstract with embedded newline."));
      assert.equal(row1[3], "2024");

      const row2 = records[2];
      assert.equal(row2[0], "Roe, J.");
      assert.equal(row2[1], "Second Paper");
      assert.equal(row2[2], "Single line abstract");
      assert.equal(row2[3], "2023");
    });
  });

  describe("DOI Standard Normalization", () => {
    test("Normalizes DOI from various raw formats to lowercase canonical string", () => {
      // Standard DOI
      assert.equal(normalizeDOI("10.1016/j.joi.2023.101400"), "10.1016/j.joi.2023.101400");

      // Uppercase converted to lowercase
      assert.equal(normalizeDOI("10.1038/S41586-020-2649-2"), "10.1038/s41586-020-2649-2");

      // https://doi.org/ prefix stripped
      assert.equal(
        normalizeDOI("https://doi.org/10.1016/j.joi.2023.101400"),
        "10.1016/j.joi.2023.101400"
      );

      // http://dx.doi.org/ prefix stripped
      assert.equal(
        normalizeDOI("http://dx.doi.org/10.1016/j.joi.2023.101400"),
        "10.1016/j.joi.2023.101400"
      );

      // doi: prefix stripped
      assert.equal(
        normalizeDOI("doi: 10.1016/j.joi.2023.101400"),
        "10.1016/j.joi.2023.101400"
      );

      // Trailing punctuation (;,. whitespace) stripped
      assert.equal(
        normalizeDOI("https://doi.org/10.1016/j.joi.2023.101400;"),
        "10.1016/j.joi.2023.101400"
      );
      assert.equal(
        normalizeDOI("10.1016/j.joi.2023.101400."),
        "10.1016/j.joi.2023.101400"
      );

      // Invalid DOI strings return undefined
      assert.equal(normalizeDOI(""), undefined);
      assert.equal(normalizeDOI("not-a-doi"), undefined);
      assert.equal(normalizeDOI(undefined), undefined);
    });
  });

  describe("Title & Whitespace Normalization", () => {
    test("Collapses whitespace, removes diacritics, and strips non-alphanumeric punctuation", () => {
      const raw = "  Machine   Learning   in Scientometrics:   A Review & Meta-Analysis!  ";
      const normalized = normalizeTitle(raw);
      assert.equal(normalized, "machine learning in scientometrics a review meta analysis");

      // Diacritic stripping: e.g. "Clément" -> "clement"
      const withAccents = "Étude bibliométrique de l'intelligence artificielle";
      const cleanedAccents = normalizeTitle(withAccents);
      assert(cleanedAccents.includes("etude"));
      assert(cleanedAccents.includes("bibliometrique"));
    });

    test("clean helper collapses internal whitespace and trims", () => {
      assert.equal(clean("   Hello     World   "), "Hello World");
      assert.equal(clean("\n\t  Single   Line   "), "Single Line");
      assert.equal(clean(""), "");
    });
  });

  describe("Duplicate DOI Handling in SmartMergeEngine", () => {
    test("SmartMergeEngine deduplicates records with matching normalized DOIs", () => {
      const doc1 = createCanonicalDocument({
        id: "wos-1",
        TI: "Attention Is All You Need",
        AU: ["Vaswani, Ashish", "Shazeer, Noam"],
        PY: 2017,
        TC: 50000,
        DOI: "https://doi.org/10.48550/arXiv.1706.03762",
        DB: "WoS",
      });

      const doc2 = createCanonicalDocument({
        id: "scopus-2",
        TI: "Attention Is All You Need (Conference Version)",
        AU: ["Vaswani, A.", "Shazeer, N."],
        PY: 2017,
        TC: 52000,
        DOI: "10.48550/arxiv.1706.03762;", // different case and punctuation
        DB: "Scopus",
      });

      const mergeEngine = new SmartMergeEngine();
      const result = mergeEngine.merge([doc1, doc2]);

      // Both documents have the same normalized DOI -> should merge into 1 record
      assert.equal(result.merged_documents.length, 1);
      assert.equal(result.duplicates_resolved, 1);
      assert.equal(result.final_unique_count, 1);
      assert.equal(result.audit_log[0].matched_rule, "EXACT_DOI");

      // Max citation retention policy
      assert.equal(result.merged_documents[0].TC, 52000);
      assert.deepEqual(result.merged_documents[0].raw_sources?.sort(), ["Scopus", "WoS"]);
    });
  });

  describe("Missing Publication Years & Fallbacks", () => {
    test("createCanonicalDocument supplies default fallback year when missing or out of valid range", () => {
      const docMissingYear = createCanonicalDocument({
        id: "doc-no-year",
        TI: "Undated Study",
      });
      assert.equal(docMissingYear.PY, 2023);

      const docAncientYear = createCanonicalDocument({
        id: "doc-bad-year",
        TI: "Bad Year Study",
        PY: 1200, // < 1800
      });
      assert.equal(docAncientYear.PY, 2023);
    });

    test("ensureCanonical preserves valid year and handles missing year safely", () => {
      const valid = ensureCanonical({ id: "v1", title: "Valid", PY: 2021 });
      assert.equal(valid.PY, 2021);

      const missing = ensureCanonical({ id: "m1", title: "Missing" });
      assert.equal(typeof missing.PY, "number");
      assert(missing.PY >= 1800 && missing.PY <= 2050);
    });
  });

  describe("Canonical Author Parsing & Malformed Records Recovery", () => {
    test("splitAuthors parses semicolons, 'and', and commas cleanly", () => {
      const semi = splitAuthors("Smith, J.; Doe, A.; Johnson, B.");
      assert.deepEqual(semi, ["Smith, J.", "Doe, A.", "Johnson, B."]);

      const andAuth = splitAuthors("Alice Smith and Bob Jones and Charlie Brown");
      assert.deepEqual(andAuth, ["Alice Smith", "Bob Jones", "Charlie Brown"]);

      const single = splitAuthors("Solo Author");
      assert.deepEqual(single, ["Solo Author"]);
    });

    test("ensureCanonical recovers malformed document without throwing", () => {
      // Null input
      const nullDoc = ensureCanonical(null);
      assert(nullDoc.id);
      assert.equal(nullDoc.AU[0], "Anonymous");

      // Corrupted document without authors or citations
      const corruptDoc = ensureCanonical({
        id: 9999,
        title: null,
        citations: "twenty",
        authors: null,
      });
      assert.equal(corruptDoc.id, "9999");
      assert.equal(corruptDoc.TC, 0);
      assert.equal(corruptDoc.AU[0], "Anonymous");
    });

    test("parseCSV handles records with missing optional fields without crashing", () => {
      const csvData =
        "Authors,Title,Year,Source,Citations\n" +
        '"Smith, J.","Only 3 Columns",2024\n' + // fewer columns than header
        ',"",,,\n' + // empty row
        '"Doe, A.","Complete Row",2022,"J. Info",10\n';

      const docs = parseCSV(csvData);
      assert(docs.length >= 1, "Should recover valid row from CSV with partially malformed rows");
      const completeRow = docs.find((d) => d.title === "Complete Row");
      assert(completeRow);
      assert.equal(completeRow?.year, 2022);
      assert.equal(completeRow?.citations, 10);
    });
  });
});
