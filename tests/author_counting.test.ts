import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  ScientometricEngine,
  calculateDocumentAuthorCredits,
  extractDocumentAuthors,
} from "../server/scientometrics.js";
import { BibliometricDocument } from "../src/types.js";

function makeDoc(
  partial: Partial<BibliometricDocument> & { title: string; authors: string[] }
): BibliometricDocument {
  return {
    id: `doc_${Math.random().toString(36).substring(2, 9)}`,
    year: 2024,
    source: "Journal of Informetrics",
    citations: 0,
    keywords: [],
    ...partial,
  };
}

describe("Author Counting & Productivity Suite", () => {
  test("Deduplication of authors on the same document (case-folding and whitespace trimming)", () => {
    const doc = makeDoc({
      title: "Paper with duplicates",
      authors: ["John Doe", "john doe", "  JANE ROE  "],
    });

    const { canonicalAuthors } = extractDocumentAuthors(doc);
    assert.equal(canonicalAuthors.length, 2, "Authors should be deduplicated case-insensitively");
    assert(canonicalAuthors.includes("John Doe"));
    assert(canonicalAuthors.includes("JANE ROE"));

    // Whole credits: each author receives 1.0 credit, sum = 2.0
    const wholeCredits = calculateDocumentAuthorCredits(doc, "whole");
    assert.equal(wholeCredits.validAuthorCount, 2);
    assert.equal(wholeCredits.totalDocumentCredit, 2.0);
    assert.equal(wholeCredits.credits.find((c) => c.author === "John Doe")?.credit, 1.0);
    assert.equal(wholeCredits.credits.find((c) => c.author === "JANE ROE")?.credit, 1.0);

    // Fractional credits: 1/N per author, sum = 1.0
    const fracCredits = calculateDocumentAuthorCredits(doc, "fractional");
    assert.equal(fracCredits.validAuthorCount, 2);
    assert.equal(fracCredits.totalDocumentCredit, 1.0);
    assert.equal(fracCredits.credits.find((c) => c.author === "John Doe")?.credit, 0.5);
    assert.equal(fracCredits.credits.find((c) => c.author === "JANE ROE")?.credit, 0.5);
  });

  test("Multi-author paper fractional split assigns exactly 1/N", () => {
    const doc = makeDoc({
      title: "Paper with 3 authors",
      authors: ["Alice Smith", "Bob Jones", "Charlie Brown"],
      citations: 30,
    });

    const frac = calculateDocumentAuthorCredits(doc, "fractional");
    assert.equal(frac.validAuthorCount, 3);
    assert.equal(frac.totalDocumentCredit, 1.0);
    for (const c of frac.credits) {
      assert.equal(c.credit, 1 / 3);
    }
  });

  test("Empty, anonymous, or invalid authors are excluded transparently", () => {
    const docEmpty = makeDoc({
      title: "Empty paper",
      authors: ["", "   ", "anonymous", "N/A", "unknown", "[Anonymous]"],
    });

    const { canonicalAuthors } = extractDocumentAuthors(docEmpty);
    assert(canonicalAuthors.every((a) => a.length > 1));
    const whole = calculateDocumentAuthorCredits(docEmpty, "whole");
    assert.equal(whole.credits.every((c) => c.author.length > 1), true);
  });

  test("ScientometricEngine authorProductivity: Whole vs Fractional counting", () => {
    const sampleDocs: BibliometricDocument[] = [
      makeDoc({ title: "Doc 1", authors: ["Alice", "Bob"], citations: 10 }),
      makeDoc({ title: "Doc 2", authors: ["Alice"], citations: 20 }),
      makeDoc({ title: "Doc 3", authors: ["Bob", "Charlie", "Dave"], citations: 15 }),
    ];

    const engine = new ScientometricEngine(sampleDocs);

    // Whole counting: Alice has 2 docs, Bob has 2 docs, Charlie has 1 doc, Dave has 1 doc
    const wholeProd = engine.authorProductivity(10, "whole");
    const aliceWhole = wholeProd.find((r) => r.author === "Alice");
    const bobWhole = wholeProd.find((r) => r.author === "Bob");
    const charlieWhole = wholeProd.find((r) => r.author === "Charlie");

    assert.equal(aliceWhole?.documents, 2);
    assert.equal(bobWhole?.documents, 2);
    assert.equal(charlieWhole?.documents, 1);

    // Fractional counting:
    // Alice = 1/2 (Doc 1) + 1.0 (Doc 2) = 1.5
    // Bob = 1/2 (Doc 1) + 1/3 (Doc 3) = 0.8333
    // Charlie = 1/3 (Doc 3) = 0.3333
    // Dave = 1/3 (Doc 3) = 0.3333
    const fracProd = engine.authorProductivity(10, "fractional");
    const aliceFrac = fracProd.find((r) => r.author === "Alice");
    const bobFrac = fracProd.find((r) => r.author === "Bob");
    const charlieFrac = fracProd.find((r) => r.author === "Charlie");

    assert.equal(Number(aliceFrac?.documents), 1.5);
    assert.equal(Number(bobFrac?.documents), 0.8333);
    assert.equal(Number(charlieFrac?.documents), 0.3333);

    // Invariant: sum of fractional credits across all authors must equal total papers with valid authors (3.0)
    const totalFracSum = fracProd.reduce((sum, r) => sum + Number(r.documents), 0);
    assert.equal(Math.round(totalFracSum), 3);
  });

  test("ScientometricEngine collaborationMetrics preserves author counting mode", () => {
    const docs: BibliometricDocument[] = [
      makeDoc({ title: "Solo paper", authors: ["Solo Author"] }),
      makeDoc({ title: "Duo paper", authors: ["Author A", "Author B"] }),
    ];

    const engine = new ScientometricEngine(docs);

    const collWhole = engine.collaborationMetrics("whole");
    assert.equal(collWhole.summary.total_valid_documents, 2);
    assert.equal(collWhole.summary.single_author_documents, 1);
    assert.equal(collWhole.summary.multi_author_documents, 1);
    assert.equal(collWhole.summary.total_assigned_author_credit, 3); // 1 + 2

    const collFrac = engine.collaborationMetrics("fractional");
    assert.equal(collFrac.summary.total_valid_documents, 2);
    assert.equal(collFrac.summary.total_assigned_author_credit, 2); // 1 + 1/2 + 1/2 = 2
  });

  test("Consortium / group author preservation", () => {
    const doc = makeDoc({
      title: "Consortium paper",
      authors: [
        "The Wellcome Trust Case Control Consortium",
        "Alice Smith",
        "Bob Jones",
      ],
    });

    const { canonicalAuthors } = extractDocumentAuthors(doc);
    assert.equal(canonicalAuthors.length, 3);
    assert(canonicalAuthors.includes("The Wellcome Trust Case Control Consortium"));

    const frac = calculateDocumentAuthorCredits(doc, "fractional");
    assert.equal(frac.validAuthorCount, 3);
    const consortium = frac.credits.find((c) => c.author.includes("Consortium"));
    assert.equal(consortium?.credit, 1 / 3);
  });

  test("Triple duplicate name on same document awards credit exactly once", () => {
    const doc = makeDoc({
      title: "Triple duplicate paper",
      authors: ["Smith, John", "smith, john", "  Smith, John  "],
    });

    const whole = calculateDocumentAuthorCredits(doc, "whole");
    assert.equal(whole.validAuthorCount, 1);
    assert.equal(whole.totalDocumentCredit, 1.0);
    assert.equal(whole.credits.length, 1);
    assert.equal(whole.credits[0].credit, 1.0);

    const frac = calculateDocumentAuthorCredits(doc, "fractional");
    assert.equal(frac.validAuthorCount, 1);
    assert.equal(frac.totalDocumentCredit, 1.0);
    assert.equal(frac.credits.length, 1);
    assert.equal(frac.credits[0].credit, 1.0);
  });

  test("Document total credit satisfies expected invariants", () => {
    // 1-author paper
    const doc1 = makeDoc({ title: "Solo", authors: ["Solo Scientist"] });
    assert.equal(calculateDocumentAuthorCredits(doc1, "whole").totalDocumentCredit, 1.0);
    assert.equal(calculateDocumentAuthorCredits(doc1, "fractional").totalDocumentCredit, 1.0);

    // 4-author paper
    const doc4 = makeDoc({ title: "Quad", authors: ["A1", "A2", "A3", "A4"] });
    assert.equal(calculateDocumentAuthorCredits(doc4, "whole").totalDocumentCredit, 4.0);
    assert.equal(calculateDocumentAuthorCredits(doc4, "fractional").totalDocumentCredit, 1.0);
  });
});
