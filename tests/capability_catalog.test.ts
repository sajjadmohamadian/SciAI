import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Analysis, DatasetVersion } from "../src/types.js";
import { SCIENTOMETRIC_MODELS, ENTITY_ANALYSIS_IDS } from "../src/components/AnalysesListView.js";
import {
  CAPABILITY_CATALOG,
  CAPABILITY_CATEGORIES,
  getAnalysisDatasetId,
  getCapabilityPresentation,
  getStudioRuns,
  indexVersionOwners,
} from "../src/utils/capabilityCatalog.js";

const createRun = (id: string, capability_id: string, dataset_version_id: string): Analysis => ({
  id,
  capability_id,
  dataset_version_id,
  status: "completed",
});

describe("Analysis capability catalog and destinations", () => {
  test("covers each runnable server capability exactly once", () => {
    const source = readFileSync(fileURLToPath(new URL("../server.ts", import.meta.url)), "utf8");
    const registry = source.split("const capabilities: Capability[] = [")[1]?.split("// Helper to compute capability result")[0] || "";
    const serverIds = [...registry.matchAll(/name: "([a-z]+\.[a-z_]+)"/g)].map((match) => match[1]);
    assert.equal(serverIds.length, 27);
    assert.equal(new Set(serverIds).size, 27);
    assert.deepEqual(Object.keys(CAPABILITY_CATALOG).sort(), serverIds.sort());
    for (const id of serverIds) {
      const details = getCapabilityPresentation(id);
      assert.ok(CAPABILITY_CATEGORIES.includes(details.category));
      assert.ok(details.destination);
      assert.ok(details.title);
      assert.ok(details.requirement);
    }
  });

  test("routes author, source, institution, network, thematic and ML results to their homes", () => {
    assert.deepEqual(
      ["author.productivity", "author.lotka_law", "source.bradford_law", "institution.productivity"].map((id) => {
        const { destination, dimension } = getCapabilityPresentation(id);
        return [destination, dimension];
      }),
      [["entities", "authors"], ["entities", "authors"], ["entities", "sources"], ["entities", "institutions"]]
    );
    assert.equal(getCapabilityPresentation("group.comparative_significance").destination, "collaboration");
    assert.equal(getCapabilityPresentation("keyword.thematic_evolution").destination, "thematic");
    assert.equal(getCapabilityPresentation("reference.rpys").destination, "historical");
    assert.equal(getCapabilityPresentation("ml.text_classification").destination, "ml");
    assert.equal(getCapabilityPresentation("keyword.frequency").destination, "descriptive");
  });

  test("exposes every runnable capability in exactly one analysis section", () => {
    const listed = SCIENTOMETRIC_MODELS.map((model) => model.id);
    assert.equal(new Set(listed).size, listed.length);
    assert.deepEqual(listed.sort(), Object.keys(CAPABILITY_CATALOG).sort());
    for (const id of ENTITY_ANALYSIS_IDS) assert.ok(listed.includes(id));
    assert.ok(SCIENTOMETRIC_MODELS.some((model) => !ENTITY_ANALYSIS_IDS.has(model.id)));
  });

  test("keeps unknown future capabilities selectable with a fallback destination", () => {
    const fallback = getCapabilityPresentation("future.new_metric");
    assert.equal(fallback.category, "Other capabilities");
    assert.equal(fallback.destination, "descriptive");
    assert.equal(fallback.title, "Future New Metric");
  });

  test("preserves multiple runs of one capability by ID and never attributes known runs to another dataset", () => {
    const versions: DatasetVersion[] = [
      { id: "version-a", dataset_id: "dataset-a", version: 1, record_count: 10 },
      { id: "version-b", dataset_id: "dataset-b", version: 1, record_count: 12 },
    ];
    const owners = indexVersionOwners(versions);
    const runs = [
      createRun("run-1", "author.productivity", "version-a"),
      createRun("run-2", "author.productivity", "version-a"),
      createRun("run-3", "author.productivity", "version-b"),
      createRun("run-4", "citation.total", "version-a"),
      createRun("run-5", "author.productivity", "unresolved-version"),
    ];
    assert.deepEqual(getStudioRuns(runs, "entities", "dataset-a", owners).map((run) => run.id), ["run-1", "run-2", "run-5"]);
    assert.equal(getAnalysisDatasetId(runs[4], owners), undefined);
    assert.equal(getAnalysisDatasetId(runs[2], owners), "dataset-b");
  });
});
