import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  ScientometricEngine,
  calculateCitationWindowMetrics,
} from "../server/scientometrics.js";
import { BibliometricDocument } from "../src/types.js";

function makeDoc(
  partial: Partial<BibliometricDocument> & {
    id: string;
    title: string;
    year?: number;
    citations: number;
  }
): BibliometricDocument {
  return {
    id: partial.id,
    title: partial.title,
    authors: ["Test Author"],
    source: "Journal of Informetrics",
    keywords: ["scientometrics"],
    year: partial.year !== undefined ? partial.year : 2024,
    citations: partial.citations,
    ...partial,
  } as BibliometricDocument;
}

describe("Citation Window Metrics Suite", () => {
  test("Deterministic Window Calculation with Fixed Observation Date (2024)", () => {
    // Document A: 2024, 10 citations. Exposure = (2024 - 2024) + 1.0 = 1.0 year. Rate = 10.0
    // Document B: 2020, 25 citations. Exposure = (2024 - 2020) + 1.0 = 5.0 years. Rate = 5.0
    // Document C: 2022, 6 citations. Exposure = (2024 - 2022) + 1.0 = 3.0 years. Rate = 2.0
    const docs: BibliometricDocument[] = [
      makeDoc({ id: "doc_a", title: "Paper A", year: 2024, citations: 10 }),
      makeDoc({ id: "doc_b", title: "Paper B", year: 2020, citations: 25 }),
      makeDoc({ id: "doc_c", title: "Paper C", year: 2022, citations: 6 }),
    ];

    const FIXED_OBSERVATION_YEAR = 2024;
    const result = calculateCitationWindowMetrics(docs, {
      mode: "window_adjusted",
      observation_year: FIXED_OBSERVATION_YEAR,
    });

    assert.equal(result.observation_year, 2024, "Observation year must match fixed injection");
    assert.equal(result.eligible_records, 3, "All 3 documents have valid past/current years");
    assert.equal(result.excluded_records, 0, "No records should be excluded");

    // Raw metrics preserved
    assert.equal(result.raw_total_citations, 41, "Raw total citations = 10 + 25 + 6 = 41");
    assert.equal(result.raw_mean_citations_per_paper, 13.6667, "Raw CPP = 41 / 3 = 13.6667");
    assert.equal(result.raw_citations_per_paper, 13.6667, "Compatibility alias must match");

    // Window-adjusted mean annual velocity = (10.0 + 5.0 + 2.0) / 3 = 17.0 / 3 = 5.6667
    assert.equal(result.window_adjusted_mean_velocity, 5.6667, "Window-adjusted velocity = 17.0 / 3 = 5.6667 cits/year");

    // Weighted corpus velocity = 41 total citations / (1.0 + 5.0 + 3.0) = 41 / 9.0 = 4.5556
    assert.equal(result.weighted_corpus_velocity, 4.5556, "Weighted corpus velocity = 41 / 9.0 = 4.5556 cits/year");

    // Verify per-document calculations
    const docA = result.per_document_metrics?.find((d) => d.id === "doc_a")!;
    assert.equal(docA.year, 2024);
    assert.equal(docA.window_years, 1.0);
    assert.equal(docA.annual_citation_rate, 10.0);

    const docB = result.per_document_metrics?.find((d) => d.id === "doc_b")!;
    assert.equal(docB.year, 2020);
    assert.equal(docB.window_years, 5.0);
    assert.equal(docB.annual_citation_rate, 5.0);

    const docC = result.per_document_metrics?.find((d) => d.id === "doc_c")!;
    assert.equal(docC.year, 2022);
    assert.equal(docC.window_years, 3.0);
    assert.equal(docC.annual_citation_rate, 2.0);

    // Crucial invariant: Raw CPP (13.6667) and Window Velocity (5.6667) must NEVER be conflated
    assert.notEqual(
      result.raw_mean_citations_per_paper,
      result.window_adjusted_mean_velocity,
      "Raw citations per paper and window-adjusted velocity must remain distinct"
    );
  });

  test("Handling Missing Dates and Future Dates Relative to Cutoff", () => {
    const FIXED_OBSERVATION_YEAR = 2024;
    const docs: BibliometricDocument[] = [
      makeDoc({ id: "valid_1", title: "Valid 2023", year: 2023, citations: 8 }),
      makeDoc({ id: "valid_2", title: "Valid 2024", year: 2024, citations: 3 }),
      makeDoc({ id: "future_doc", title: "Future 2025", year: 2025, citations: 12 }),
      {
        id: "missing_year",
        title: "Missing Year",
        citations: 5,
        authors: ["Author"],
        source: "J",
        keywords: [],
      } as unknown as BibliometricDocument,
      makeDoc({ id: "invalid_year", title: "Ancient or bad", year: 1500, citations: 0 }),
    ];

    const result = calculateCitationWindowMetrics(docs, {
      mode: "window_adjusted",
      observation_year: FIXED_OBSERVATION_YEAR,
    });

    assert.equal(result.observation_year, 2024);
    assert.equal(result.eligible_records, 2, "Only valid_1 and valid_2 should be eligible");
    assert.equal(result.excluded_records, 3, "3 records should be excluded (future, missing, out-of-range)");

    // Mean velocity on eligible: (4.0 + 3.0) / 2 = 3.50
    assert.equal(result.window_adjusted_mean_velocity, 3.5);

    // Total raw citations preserves all records in the corpus
    assert.equal(result.raw_total_citations, 8 + 3 + 12 + 5 + 0, "Raw total citations counts all corpus papers");
  });

  test("Empty Corpus and Zero Citations Graceful Handling", () => {
    // Empty corpus
    const emptyResult = calculateCitationWindowMetrics([], {
      mode: "window_adjusted",
      observation_year: 2024,
    });
    assert.equal(emptyResult.eligible_records, 0);
    assert.equal(emptyResult.window_adjusted_mean_velocity, null);
    assert.equal(emptyResult.weighted_corpus_velocity, null);
    assert.equal(emptyResult.raw_total_citations, 0);
    assert.equal(emptyResult.raw_mean_citations_per_paper, 0);

    // Corpus with 0 citations
    const zeroCitDocs = [
      makeDoc({ id: "z1", title: "Zero 1", year: 2022, citations: 0 }),
      makeDoc({ id: "z2", title: "Zero 2", year: 2024, citations: 0 }),
    ];
    const zeroResult = calculateCitationWindowMetrics(zeroCitDocs, {
      mode: "window_adjusted",
      observation_year: 2024,
    });
    assert.equal(zeroResult.eligible_records, 2);
    assert.equal(zeroResult.window_adjusted_mean_velocity, 0);
    assert.equal(zeroResult.weighted_corpus_velocity, 0);
    assert.equal(zeroResult.raw_total_citations, 0);
    assert.equal(zeroResult.raw_mean_citations_per_paper, 0);

    // Corpus with only invalid years
    const invalidOnly: BibliometricDocument[] = [
      {
        id: "inv1",
        title: "Invalid",
        citations: 10,
        authors: ["A"],
        source: "S",
        keywords: [],
      } as unknown as BibliometricDocument,
      makeDoc({ id: "inv2", title: "Future", year: 2030, citations: 20 }),
    ];
    const invalidResult = calculateCitationWindowMetrics(invalidOnly, {
      mode: "window_adjusted",
      observation_year: 2024,
    });
    assert.equal(invalidResult.eligible_records, 0);
    assert.equal(invalidResult.excluded_records, 2);
    assert.equal(invalidResult.window_adjusted_mean_velocity, null);
  });

  test("ScientometricEngine Capabilities & Categorization Verification", () => {
    const docs = [
      makeDoc({ id: "d1", title: "Paper 1", year: 2021, citations: 12 }),
      makeDoc({ id: "d2", title: "Paper 2", year: 2024, citations: 6 }),
    ];
    const engine = new ScientometricEngine(docs);

    // 1. citationAverage capability
    const avgRecords = engine.citationAverage("window_adjusted", 2024);
    assert.equal(avgRecords.length, 6);

    const rawMeanRec = avgRecords.find((r) => r.metric === "citation_average")!;
    assert.equal(rawMeanRec.value, 9.0, "Raw CPP = (12 + 6) / 2 = 9.0");
    assert.equal(rawMeanRec.category, "calculated");

    const winMeanRec = avgRecords.find((r) => r.metric === "window_adjusted_mean_velocity")!;
    assert.equal(winMeanRec.value, 4.5, "Window velocity = (3.0 + 6.0) / 2 = 4.5 cits/yr");
    assert.equal(winMeanRec.category, "citation-window-adjusted");

    const fieldRec = avgRecords.find((r) => r.metric === "field_normalized_impact")!;
    assert.equal(fieldRec.status, "unavailable");
    assert.equal(fieldRec.category, "unavailable");
    const reasonText = String(fieldRec.reason ?? "");
    assert(reasonText.includes("missing"), "Reason should explain missing baseline");

    // 2. citationWindowAdjusted capability
    const winResult = engine.citationWindowAdjusted({
      observation_year: 2024,
      mode: "window_adjusted",
    });
    assert(winResult.records.some((r) => r.metric === "window_adjusted_mean_velocity" && r.value === 4.5));
    assert(winResult.records.some((r) => r.metric === "observation_year" && r.value === 2024));
    assert(winResult.records.some((r) => r.metric === "eligible_records" && r.value === 2));

    // 3. citationFieldNormalized capability
    const fldRecords = engine.citationFieldNormalized();
    assert.equal(fldRecords[0].status, "unavailable");
    assert.equal(fldRecords[0].category, "unavailable");
    assert.equal(fldRecords[0].value, null, "Must not return synthetic field normalization score");
  });

  test("Verify Raw Metrics are Never Overwritten or Conflated", () => {
    const docs = [
      makeDoc({ id: "p1", title: "P1", year: 2014, citations: 100 }),
      makeDoc({ id: "p2", title: "P2", year: 2024, citations: 10 }),
    ];

    const engine = new ScientometricEngine(docs);
    const totalRecords = engine.citationTotal();
    const rawTotal = totalRecords.find((r) => r.metric === "citation_total")!;
    assert.equal(rawTotal.value, 110, "Raw total citation sum must be 110");
    assert.equal(rawTotal.category, "raw/observed");

    const avgRecords = engine.citationAverage("window_adjusted", 2024);
    const rawAvg = avgRecords.find((r) => r.metric === "citation_average")!;
    const windowAvg = avgRecords.find((r) => r.metric === "window_adjusted_mean_velocity")!;

    assert.equal(rawAvg.value, 55.0, "Raw mean citations per paper = 110 / 2 = 55.0");
    assert.notEqual(rawAvg.value, windowAvg.value, "Raw CPP and Window Velocity must NOT be equal");
    assert.equal(rawAvg.category, "calculated");
    assert.equal(windowAvg.category, "citation-window-adjusted");
  });
});
