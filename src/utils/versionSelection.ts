import { DatasetVersion } from "../types.js";

export type VersionFetchStatus = "idle" | "loading" | "success" | "empty" | "error";

export type ValidationResult =
  | { valid: true; error?: undefined }
  | { valid: false; error: string };

export interface VersionSelectionState {
  selectedDatasetId: string;
  selectedVersionId: string;
  versions: DatasetVersion[];
  status: VersionFetchStatus;
  error: string | null;
}

export function createInitialVersionState(initialDatasetId: string = ""): VersionSelectionState {
  return {
    selectedDatasetId: initialDatasetId,
    selectedVersionId: "",
    versions: [],
    status: initialDatasetId ? "loading" : "idle",
    error: null,
  };
}

/**
 * Immediately clears dependent version state when a dataset changes.
 * Invalidates the existing versions list and resets selectedVersionId so stale
 * versions from the previous dataset cannot be displayed or submitted.
 */
export function onDatasetChange(
  prevState: VersionSelectionState,
  newDatasetId: string
): VersionSelectionState {
  // If the dataset has not changed, retain state
  if (prevState.selectedDatasetId === newDatasetId) {
    return prevState;
  }

  return {
    selectedDatasetId: newDatasetId,
    selectedVersionId: "",
    versions: [],
    status: newDatasetId ? "loading" : "idle",
    error: null,
  };
}

/**
 * Handles successful version fetch. Verifies request identity: if the response belongs
 * to an older/superseded dataset ID, it is discarded immediately without mutating state.
 */
export function handleVersionsLoaded(
  currentState: VersionSelectionState,
  responseDatasetId: string,
  rawVersions: unknown
): VersionSelectionState {
  // Stale response check: ignore late arrivals for older datasets
  if (!responseDatasetId || responseDatasetId !== currentState.selectedDatasetId) {
    return currentState;
  }

  const safeList = Array.isArray(rawVersions)
    ? (rawVersions.filter(
        (v) => v && typeof v === "object" && typeof v.id === "string"
      ) as DatasetVersion[])
    : [];

  if (safeList.length === 0) {
    return {
      ...currentState,
      versions: [],
      selectedVersionId: "",
      status: "empty",
      error: null,
    };
  }

  // Check if current selectedVersionId is already verified to belong to safeList
  const currentStillValid = safeList.some((v) => v.id === currentState.selectedVersionId);
  const selectedVersionId = currentStillValid
    ? currentState.selectedVersionId
    : safeList[0].id;

  return {
    ...currentState,
    versions: safeList,
    selectedVersionId,
    status: "success",
    error: null,
  };
}

/**
 * Handles failed version fetch. Late errors for superseded datasets are discarded.
 * Aborted/cancelled requests are ignored without raising user-facing errors.
 */
export function handleVersionsError(
  currentState: VersionSelectionState,
  responseDatasetId: string,
  err: unknown,
  isAborted: boolean = false
): VersionSelectionState {
  if (isAborted) {
    return currentState;
  }

  // If this failure belongs to an older dataset, discard
  if (!responseDatasetId || responseDatasetId !== currentState.selectedDatasetId) {
    return currentState;
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Failed to load versions for the selected dataset";

  return {
    ...currentState,
    versions: [],
    selectedVersionId: "",
    status: "error",
    error: message,
  };
}

/**
 * Validates whether an analysis can be submitted with the current dataset/version combination.
 * Enforces authoritative relationship verification: selectedVersionId MUST exist in the
 * loaded versions array for selectedDatasetId.
 */
export function validateAnalysisSubmission(params: {
  selectedDatasetId: string;
  selectedVersionId: string;
  versions: DatasetVersion[];
  status?: VersionFetchStatus;
}): ValidationResult {
  const { selectedDatasetId, selectedVersionId, versions, status } = params;

  if (!selectedDatasetId || !selectedDatasetId.trim()) {
    return {
      valid: false,
      error: "Please select a target dataset before running an analysis.",
    };
  }

  if (status === "loading") {
    return {
      valid: false,
      error: "Dataset versions are currently loading. Please wait for versions to load.",
    };
  }

  if (status === "error") {
    return {
      valid: false,
      error: "Cannot run analysis because loading versions for this dataset failed.",
    };
  }

  if (status === "empty" || !versions || versions.length === 0) {
    return {
      valid: false,
      error: "The selected dataset has no recorded snapshot versions available for analysis.",
    };
  }

  if (!selectedVersionId || !selectedVersionId.trim()) {
    return {
      valid: false,
      error: "Please select a verified dataset version before running an analysis.",
    };
  }

  // Verify that the selected version actually exists in the current versions list
  const matchingVersion = versions.find((v) => v.id === selectedVersionId);
  if (!matchingVersion) {
    return {
      valid: false,
      error: `Selected version "${selectedVersionId}" does not exist in the loaded versions for dataset "${selectedDatasetId}".`,
    };
  }

  // If dataset_id is present on the version record, verify it matches
  if (matchingVersion.dataset_id && matchingVersion.dataset_id !== selectedDatasetId) {
    return {
      valid: false,
      error: `Selected version belongs to dataset "${matchingVersion.dataset_id}", which does not match active dataset "${selectedDatasetId}".`,
    };
  }

  return { valid: true };
}

/**
 * Async manager that binds an AbortController to the latest requested dataset ID.
 * Cancels pending requests when a new request starts or when unmounted.
 */
export class VersionFetchManager {
  private activeController: AbortController | null = null;
  private activeDatasetId: string = "";
  private requestCounter: number = 0;

  public startRequest(datasetId: string): {
    requestId: number;
    signal: AbortSignal;
    isCurrent: () => boolean;
  } {
    // Abort previous in-flight request
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }

    const controller = new AbortController();
    this.activeController = controller;
    this.activeDatasetId = datasetId;
    const currentRequestId = ++this.requestCounter;

    return {
      requestId: currentRequestId,
      signal: controller.signal,
      isCurrent: () =>
        this.requestCounter === currentRequestId &&
        this.activeDatasetId === datasetId &&
        !controller.signal.aborted,
    };
  }

  public cancel(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  public getActiveDatasetId(): string {
    return this.activeDatasetId;
  }
}
