import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialVersionState,
  onDatasetChange,
  handleVersionsLoaded,
  handleVersionsError,
  validateAnalysisSubmission,
  VersionFetchManager,
} from "../src/utils/versionSelection.js";
import { DatasetVersion } from "../src/types.js";

describe("Frontend Version Selection Race & Synchronization Suite", () => {
  const datasetA = "dataset-alpha";
  const datasetB = "dataset-beta";

  const versionsA: DatasetVersion[] = [
    {
      id: "ver-alpha-1",
      dataset_id: datasetA,
      version: 1,
      version_number: 1,
      record_count: 100,
      created_at: new Date().toISOString(),
    },
    {
      id: "ver-alpha-2",
      dataset_id: datasetA,
      version: 2,
      version_number: 2,
      record_count: 150,
      created_at: new Date().toISOString(),
    },
  ];

  const versionsB: DatasetVersion[] = [
    {
      id: "ver-beta-1",
      dataset_id: datasetB,
      version: 1,
      version_number: 1,
      record_count: 220,
      created_at: new Date().toISOString(),
    },
  ];

  test("1. Selecting dataset A, then quickly selecting dataset B: B's versions remain authoritative and A's late response is ignored", () => {
    let state = createInitialVersionState();

    // 1. User selects Dataset A
    state = onDatasetChange(state, datasetA);
    assert.equal(state.selectedDatasetId, datasetA);
    assert.equal(state.status, "loading");
    assert.equal(state.selectedVersionId, "");
    assert.deepEqual(state.versions, []);

    // 2. User quickly switches to Dataset B before A finishes
    state = onDatasetChange(state, datasetB);
    assert.equal(state.selectedDatasetId, datasetB);
    assert.equal(state.status, "loading");
    assert.equal(state.selectedVersionId, "");

    // 3. Fast response for B arrives first
    state = handleVersionsLoaded(state, datasetB, versionsB);
    assert.equal(state.selectedDatasetId, datasetB);
    assert.equal(state.status, "success");
    assert.equal(state.selectedVersionId, "ver-beta-1");
    assert.deepEqual(state.versions, versionsB);

    // 4. Slow late response for Dataset A arrives NOW
    state = handleVersionsLoaded(state, datasetA, versionsA);

    // B's state MUST remain completely intact and unaffected
    assert.equal(state.selectedDatasetId, datasetB);
    assert.equal(state.status, "success");
    assert.equal(state.selectedVersionId, "ver-beta-1");
    assert.deepEqual(state.versions, versionsB);
    assert.equal(state.error, null);
  });

  test("2. A failed request for dataset A arriving after dataset B was selected must not replace B's state or show obsolete error", () => {
    let state = createInitialVersionState(datasetA);
    assert.equal(state.status, "loading");

    // Switch to dataset B
    state = onDatasetChange(state, datasetB);
    state = handleVersionsLoaded(state, datasetB, versionsB);
    assert.equal(state.status, "success");
    assert.equal(state.selectedVersionId, "ver-beta-1");

    // Now error arrives for dataset A
    state = handleVersionsError(state, datasetA, new Error("Network timeout on Dataset A"));

    // State for B must NOT be replaced with error
    assert.equal(state.selectedDatasetId, datasetB);
    assert.equal(state.status, "success");
    assert.equal(state.selectedVersionId, "ver-beta-1");
    assert.equal(state.error, null);
  });

  test("3. A dataset with no versions clears selection and blocks analysis submission with a useful message", () => {
    let state = createInitialVersionState();
    state = onDatasetChange(state, "dataset-empty");
    assert.equal(state.status, "loading");

    // Loaded empty array
    state = handleVersionsLoaded(state, "dataset-empty", []);
    assert.equal(state.status, "empty");
    assert.equal(state.selectedVersionId, "");
    assert.deepEqual(state.versions, []);

    // Submission validation must fail with clear actionable error
    const validation = validateAnalysisSubmission({
      selectedDatasetId: state.selectedDatasetId,
      selectedVersionId: state.selectedVersionId,
      versions: state.versions,
      status: state.status,
    });

    assert.equal(validation.valid, false);
    if (!validation.valid) {
      assert.match(validation.error, /no recorded snapshot versions available/i);
    }
  });

  test("4. Stale selectedVersionId from dataset A after switching to dataset B is immediately cleared and analysis request is blocked", () => {
    let state = createInitialVersionState(datasetA);
    state = handleVersionsLoaded(state, datasetA, versionsA);
    assert.equal(state.selectedVersionId, "ver-alpha-1");

    // Attempting submission for A works
    const validA = validateAnalysisSubmission({
      selectedDatasetId: state.selectedDatasetId,
      selectedVersionId: state.selectedVersionId,
      versions: state.versions,
      status: state.status,
    });
    assert.equal(validA.valid, true);

    // Switch to dataset B: selectedVersionId must be cleared immediately
    state = onDatasetChange(state, datasetB);
    assert.equal(state.selectedVersionId, "", "selectedVersionId must be immediately cleared");
    assert.deepEqual(state.versions, [], "versions must be cleared immediately");

    // Submission immediately after switch must be blocked (cannot leak ver-alpha-1 to B)
    const blockedDuringPending = validateAnalysisSubmission({
      selectedDatasetId: state.selectedDatasetId,
      selectedVersionId: state.selectedVersionId,
      versions: state.versions,
      status: state.status,
    });
    assert.equal(blockedDuringPending.valid, false);

    // Even if an adversarial or rogue state had old ver-alpha-1 with datasetB and empty/new versions
    const adversarialCheck = validateAnalysisSubmission({
      selectedDatasetId: datasetB,
      selectedVersionId: "ver-alpha-1", // stale from A
      versions: versionsB, // loaded for B
      status: "success",
    });
    assert.equal(adversarialCheck.valid, false);
    if (!adversarialCheck.valid) {
      assert.match(adversarialCheck.error, /does not exist in the loaded versions/i);
    }
  });

  test("5. Submission while versions are loading is blocked with explicit loading message", () => {
    const loadingValidation = validateAnalysisSubmission({
      selectedDatasetId: datasetA,
      selectedVersionId: "",
      versions: [],
      status: "loading",
    });

    assert.equal(loadingValidation.valid, false);
    if (!loadingValidation.valid) {
      assert.match(loadingValidation.error, /versions are currently loading/i);
    }
  });

  test("6. A version ID not present in the currently loaded versions is blocked", () => {
    const nonExistentValidation = validateAnalysisSubmission({
      selectedDatasetId: datasetB,
      selectedVersionId: "non-existent-version-id-999",
      versions: versionsB,
      status: "success",
    });

    assert.equal(nonExistentValidation.valid, false);
    if (!nonExistentValidation.valid) {
      assert.match(nonExistentValidation.error, /does not exist in the loaded versions/i);
    }

    // Version object that exists in array but has mismatched dataset_id
    const mismatchedDatasetVersion: DatasetVersion = {
      id: "foreign-ver",
      dataset_id: "other-foreign-dataset",
      version: 1,
      version_number: 1,
      record_count: 50,
      created_at: new Date().toISOString(),
    };

    const foreignValidation = validateAnalysisSubmission({
      selectedDatasetId: datasetB,
      selectedVersionId: "foreign-ver",
      versions: [mismatchedDatasetVersion],
      status: "success",
    });
    assert.equal(foreignValidation.valid, false);
    if (!foreignValidation.valid) {
      assert.match(foreignValidation.error, /does not match active dataset/i);
    }
  });

  test("7. Component unmount or request cancellation: AbortController cancels active request without obsolete state update or unhandled rejection", async () => {
    const manager = new VersionFetchManager();

    // Start request for dataset A
    const reqA = manager.startRequest(datasetA);
    assert.equal(reqA.isCurrent(), true);
    assert.equal(reqA.signal.aborted, false);

    // Immediately start request for dataset B (simulating rapid switch or unmount)
    const reqB = manager.startRequest(datasetB);

    // Req A signal must now be aborted
    assert.equal(reqA.signal.aborted, true);
    assert.equal(reqA.isCurrent(), false);

    // Req B must be active
    assert.equal(reqB.isCurrent(), true);
    assert.equal(reqB.signal.aborted, false);

    // An aborted fetch error handled through handleVersionsError does not mutate state or throw
    const initialState = createInitialVersionState(datasetB);
    const abortError = new Error("This operation was aborted");
    abortError.name = "AbortError";

    const afterAbortHandled = handleVersionsError(initialState, datasetA, abortError, true);
    assert.deepEqual(afterAbortHandled, initialState);

    // Cancel all on unmount
    manager.cancel();
    assert.equal(reqB.signal.aborted, true);
    assert.equal(reqB.isCurrent(), false);
  });
});
