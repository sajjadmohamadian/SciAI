import { run } from "node:test";
import { spec } from "node:test/reporters";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// Isolate test environment
process.env.NODE_ENV = "test";
process.env.SCIAI_DEV_AUTH_BYPASS = "false";
process.env.HOST = "localhost";

// Set isolated temporary database for test suite so production sciai.db is NEVER touched
const tempTestDb = path.join(
  os.tmpdir(),
  `sciai-global-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.db`
);
process.env.SCIAI_DB_PATH = tempTestDb;

const testFiles = [
  path.resolve("server/test_author_counting.ts"),
  path.resolve("server/test_citation_window.ts"),
  path.resolve("tests/author_counting.test.ts"),
  path.resolve("tests/citation_window.test.ts"),
  path.resolve("tests/security.test.ts"),
  path.resolve("tests/persistence.test.ts"),
  path.resolve("tests/bulk_delete_api.test.ts"),
  path.resolve("tests/api_contracts.test.ts"),
  path.resolve("tests/capability_catalog.test.ts"),
  path.resolve("tests/parsers_scientific.test.ts"),
  path.resolve("tests/side_effects.test.ts"),
  path.resolve("tests/version_selection_race.test.ts"),
  path.resolve("tests/api_client.test.ts"),
  path.resolve("tests/ai_provider_config.test.ts"),
  path.resolve("tests/ai_provider_routing.test.ts"),
  path.resolve("tests/ai_provider_ui.test.ts"),
  path.resolve("tests/response_validation.test.ts"),
  path.resolve("tests/prisma_flow.test.ts"),
  path.resolve("tests/prisma_dedup.test.ts"),
  path.resolve("tests/prisma_api.test.ts"),
];

console.log(`Starting SciAI Test Runner (${testFiles.length} test files)...`);

const stream = run({
  files: testFiles,
  concurrency: 1,
});

let failedCount = 0;
let passedCount = 0;
let skippedCount = 0;

stream.on("test:pass", () => {
  passedCount++;
});

stream.on("test:fail", () => {
  failedCount++;
});

stream.on("test:skip", () => {
  skippedCount++;
});

stream.compose(new spec()).pipe(process.stdout);

stream.on("end", () => {
  // Cleanup global temp test database
  for (const ext of ["", "-wal", "-shm"]) {
    const f = `${tempTestDb}${ext}`;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  }

  console.log("\n=========================================");
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
});
