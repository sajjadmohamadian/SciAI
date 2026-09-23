import assert from "node:assert/strict";
import { ScientometricEngine, calculateDocumentAuthorCredits, extractDocumentAuthors } from "./scientometrics.js";
import { BibliometricDocument } from "../src/types.js";

console.log("Starting test suite for fractional and whole author counting...");

function makeDoc(partial: Partial<BibliometricDocument> & { title: string; authors: string[] }): BibliometricDocument {
  return {
    id: `doc_${Math.random().toString(36).substring(2, 9)}`,
    year: 2024,
    source: "Journal of Informetrics",
    citations: 0,
    keywords: [],
    ...partial,
  };
}

// Test Case 1: Deduplication of authors on the same document
{
  const doc = makeDoc({
    title: "Paper with duplicates",
    authors: ["John Doe", "john doe", "  JANE ROE  "],
  });

  const { canonicalAuthors } = extractDocumentAuthors(doc);
  assert.equal(canonicalAuthors.length, 2, "Authors should be deduplicated case-insensitively");
  assert(canonicalAuthors.includes("John Doe"));
  assert(canonicalAuthors.includes("JANE ROE"));

  // Whole credits
  const wholeCredits = calculateDocumentAuthorCredits(doc, "whole");
  assert.equal(wholeCredits.validAuthorCount, 2);
  assert.equal(wholeCredits.totalDocumentCredit, 2.0);
  assert.equal(wholeCredits.credits.find((c) => c.author === "John Doe")?.credit, 1.0);
  assert.equal(wholeCredits.credits.find((c) => c.author === "JANE ROE")?.credit, 1.0);

  // Fractional credits
  const fracCredits = calculateDocumentAuthorCredits(doc, "fractional");
  assert.equal(fracCredits.validAuthorCount, 2);
  assert.equal(fracCredits.totalDocumentCredit, 1.0);
  assert.equal(fracCredits.credits.find((c) => c.author === "John Doe")?.credit, 0.5);
  assert.equal(fracCredits.credits.find((c) => c.author === "JANE ROE")?.credit, 0.5);
}

// Test Case 2: Multi-author paper fractional split (1/3)
{
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
}

// Test Case 3: Empty, anonymous, or invalid authors
{
  const docEmpty = makeDoc({
    title: "Empty paper",
    authors: ["", "   ", "anonymous", "N/A", "unknown", "[Anonymous]"],
  });

  const { canonicalAuthors } = extractDocumentAuthors(docEmpty);
  assert(canonicalAuthors.every((a) => a.length > 1));
  const whole = calculateDocumentAuthorCredits(docEmpty, "whole");
  assert.equal(whole.credits.every((c) => c.author.length > 1), true);
}

// Test Case 4: ScientometricEngine authorProductivity (Whole vs Fractional)
{
  const sampleDocs: BibliometricDocument[] = [
    // Doc 1: Alice & Bob (2 authors)
    makeDoc({
      title: "Doc 1",
      authors: ["Alice", "Bob"],
      citations: 10,
    }),
    // Doc 2: Alice only (1 author)
    makeDoc({
      title: "Doc 2",
      authors: ["Alice"],
      citations: 20,
    }),
    // Doc 3: Bob & Charlie & Dave (3 authors)
    makeDoc({
      title: "Doc 3",
      authors: ["Bob", "Charlie", "Dave"],
      citations: 15,
    }),
  ];

  const engine = new ScientometricEngine(sampleDocs);

  // Whole counting
  const wholeProd = engine.authorProductivity(10, "whole");
  const aliceWhole = wholeProd.find((r) => r.author === "Alice");
  const bobWhole = wholeProd.find((r) => r.author === "Bob");
  const charlieWhole = wholeProd.find((r) => r.author === "Charlie");

  assert.equal(aliceWhole?.documents, 2, "Alice has 2 whole documents");
  assert.equal(bobWhole?.documents, 2, "Bob has 2 whole documents");
  assert.equal(charlieWhole?.documents, 1, "Charlie has 1 whole document");

  // Fractional counting
  const fracProd = engine.authorProductivity(10, "fractional");
  const aliceFrac = fracProd.find((r) => r.author === "Alice");
  const bobFrac = fracProd.find((r) => r.author === "Bob");
  const charlieFrac = fracProd.find((r) => r.author === "Charlie");

  // Alice: 1/2 from Doc 1 + 1 from Doc 2 = 1.5
  assert.equal(aliceFrac?.documents, 1.5, "Alice gets 1.5 fractional credit");
  assert.equal(aliceFrac?.raw_documents, 2, "Alice raw documents is 2");

  // Bob: 1/2 from Doc 1 + 1/3 from Doc 3 = 5/6 = 0.8333
  const expectedBob = Number((1 / 2 + 1 / 3).toFixed(4));
  assert.equal(bobFrac?.documents, expectedBob, "Bob gets 0.8333 fractional credit");
  assert.equal(bobFrac?.raw_documents, 2, "Bob raw documents is 2");

  // Charlie: 1/3 from Doc 3 = 0.3333
  const expectedCharlie = Number((1 / 3).toFixed(4));
  assert.equal(charlieFrac?.documents, expectedCharlie, "Charlie gets 0.3333 fractional credit");
  assert.equal(charlieFrac?.raw_documents, 1, "Charlie raw documents is 1");
}

// Test Case 5: ScientometricEngine authorLotkaLaw (Whole vs Fractional)
{
  const docs: BibliometricDocument[] = [
    makeDoc({ title: "Doc 1", authors: ["Author A", "Author B"] }),
    makeDoc({ title: "Doc 2", authors: ["Author A"] }),
    makeDoc({ title: "Doc 3", authors: ["Author B"] }),
  ];

  const engine = new ScientometricEngine(docs);

  const lotkaWhole = engine.authorLotkaLaw("whole");
  assert(lotkaWhole.records.length > 0, "Lotka whole returns records");
  assert(Number(lotkaWhole.summary.lotka_exponent_beta) > 0, "Lotka beta calculated");

  const lotkaFrac = engine.authorLotkaLaw("fractional");
  assert(lotkaFrac.records.length > 0, "Lotka fractional returns records");
  assert(Number(lotkaFrac.summary.lotka_exponent_beta) > 0, "Lotka beta calculated");
}

// Test Case 6: ScientometricEngine collaborationMetrics
{
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
}

// Test Case 7: Consortium / group author preservation
{
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
}

// Test Case 8: Triple duplicate name on same document awards credit exactly once
{
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
}

console.log("All author counting tests passed successfully!");
