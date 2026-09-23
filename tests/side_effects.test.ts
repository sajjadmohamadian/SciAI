import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("Calculation Modules Side-Effect Boundaries Suite", () => {
  const PROD_DB_PATH = path.join(process.cwd(), "data", "sciai.db");
  const PROD_DIR = path.join(process.cwd(), "data");

  test("Importing calculation modules has zero side effects on production storage or network", async () => {
    // Record initial state of data/sciai.db
    const initialDbExists = fs.existsSync(PROD_DB_PATH);
    const initialMtime = initialDbExists ? fs.statSync(PROD_DB_PATH).mtimeMs : 0;
    const initialSize = initialDbExists ? fs.statSync(PROD_DB_PATH).size : 0;

    // Track any network calls during module imports
    let networkCallMade = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: any[]) => {
      networkCallMade = true;
      throw new Error(`Unexpected network call during module import: ${args[0]}`);
    }) as any;

    try {
      // Dynamically import all scientific and analytical computation modules
      const modules = await Promise.all([
        import("../server/scientometrics.js"),
        import("../server/parsers/canonical.js"),
        import("../server/parsers/detector.js"),
        import("../server/parsers/normalizer.js"),
        import("../server/parsers/scopus.js"),
        import("../server/parsers/wos.js"),
        import("../server/parsers/pubmed.js"),
        import("../server/parsers/openalex.js"),
        import("../server/parsers/dimensions.js"),
        import("../server/parsers/lens.js"),
        import("../server/merge/deduplicator.js"),
        import("../server/machine_learning.js"),
        import("../server/text_classifier.js"),
        import("../server/network_engine.js"),
        import("../server/thematic_evolution.js"),
        import("../server/historical_analysis.js"),
        import("../server/frontier_detection.js"),
        import("../server/geo_collaboration.js"),
        import("../server/benchmarking.js"),
        import("../server/report_export_engine.js"),
      ]);

      assert.equal(modules.length, 20, "All 20 calculation modules must import cleanly");

      // Verify no network call was made
      assert.equal(networkCallMade, false, "Importing calculation modules must never make network requests");

      // Verify production database was not touched or mutated
      if (initialDbExists) {
        const currentMtime = fs.statSync(PROD_DB_PATH).mtimeMs;
        const currentSize = fs.statSync(PROD_DB_PATH).size;
        assert.equal(currentMtime, initialMtime, "Production data/sciai.db mtime must be unchanged");
        assert.equal(currentSize, initialSize, "Production data/sciai.db size must be unchanged");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
