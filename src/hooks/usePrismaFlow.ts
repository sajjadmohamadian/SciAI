import { useCallback, useEffect, useRef, useState } from "react";
import type { BibliometricDocument, DatasetVersion, PrismaFlow, PrismaManualCounts } from "../types.js";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";

type ManualField = "identified_registers" | "removed_automation" | "removed_other" | "excluded_screening" | "not_retrieved" | "included_studies";
export const manualFields: ManualField[] = ["identified_registers", "removed_automation", "removed_other", "excluded_screening", "not_retrieved", "included_studies"];
export type PrismaDraft = Record<ManualField, string> & { exclusion_reasons: Array<{ reason: string; count: string }> };

const draftFromFlow = (flow: PrismaFlow): PrismaDraft => ({
  identified_registers: flow.identified_registers.source === "user_entered" ? String(flow.identified_registers.value) : "",
  removed_automation: flow.removed_automation.source === "user_entered" ? String(flow.removed_automation.value) : "",
  removed_other: flow.removed_other.source === "user_entered" ? String(flow.removed_other.value) : "",
  excluded_screening: flow.excluded_screening.source === "user_entered" ? String(flow.excluded_screening.value) : "",
  not_retrieved: flow.not_retrieved.source === "user_entered" ? String(flow.not_retrieved.value) : "",
  included_studies: flow.included_studies.source === "user_entered" ? String(flow.included_studies.value) : "",
  exclusion_reasons: flow.excluded_eligibility.map(({ reason, count }) => ({ reason, count: count.value === null ? "" : String(count.value) })),
});

export const hasRecordedExclusions = (version: DatasetVersion | null): boolean => {
  const prisma = version?.metadata?.prisma as { manual?: Partial<PrismaManualCounts> } | undefined;
  return prisma?.manual?.exclusion_reasons !== undefined;
};

export const formatPrismaCount = (value: number | null | undefined): string =>
  value === null || value === undefined ? "Not recorded" : value.toLocaleString();

export function usePrismaFlow(datasetId: string) {
  const [flow, setFlow] = useState<PrismaFlow | null>(null);
  const [version, setVersion] = useState<DatasetVersion | null>(null);
  const [draft, setDraft] = useState<PrismaDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const currentDataset = useRef(datasetId);
  currentDataset.current = datasetId;

  const apply = useCallback((nextFlow: PrismaFlow, nextVersion: DatasetVersion) => {
    setFlow(nextFlow);
    setVersion(nextVersion);
    setDraft(draftFromFlow(nextFlow));
    setError(null);
  }, []);

  const reload = useCallback(async (versionId?: string) => {
    const sequence = ++requestId.current;
    if (!datasetId) {
      setFlow(null);
      setVersion(null);
      setDraft(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : "";
      const data = await apiRequest<{ flow: PrismaFlow; version: DatasetVersion }>(`/api/datasets/${encodeURIComponent(datasetId)}/prisma${query}`);
      if (sequence === requestId.current && datasetId === currentDataset.current) apply(data.flow, data.version);
    } catch (err) {
      if (sequence === requestId.current) setError(getApiErrorMessage(err, "Unable to load PRISMA flow."));
    } finally {
      if (sequence === requestId.current) setLoading(false);
    }
  }, [datasetId, apply]);

  useEffect(() => {
    setFlow(null);
    setVersion(null);
    setDraft(null);
    void reload();
    return () => { requestId.current++; };
  }, [reload]);

  const updateField = (field: ManualField, value: string) =>
    setDraft((previous) => previous ? { ...previous, [field]: value } : previous);
  const updateReasons = (reasons: PrismaDraft["exclusion_reasons"]) =>
    setDraft((previous) => previous ? { ...previous, exclusion_reasons: reasons } : previous);

  const save = async (): Promise<boolean> => {
    if (!draft || !flow || !version || saving || datasetId !== currentDataset.current) return false;
    const input: Partial<PrismaManualCounts> = {};
    for (const field of manualFields) {
      const text = draft[field].trim();
      if (!text) {
        if (flow[field].source === "user_entered") {
          setError(`${field.replaceAll("_", " ")} was previously recorded and cannot be cleared; enter a non-negative integer.`);
          return false;
        }
        continue;
      }
      if (!/^(0|[1-9]\d*)$/.test(text) || !Number.isSafeInteger(Number(text))) {
        setError(`${field.replaceAll("_", " ")} must be a non-negative integer.`);
        return false;
      }
      input[field] = Number(text);
    }
    const reasons = draft.exclusion_reasons.map(({ reason, count }) => ({ reason: reason.trim(), count: Number(count.trim()) }));
    if (draft.exclusion_reasons.some(({ reason, count }) => !reason.trim() || !/^(0|[1-9]\d*)$/.test(count.trim()) || !Number.isSafeInteger(Number(count)))) {
      setError("Each eligibility exclusion needs a reason and a non-negative integer count.");
      return false;
    }
    if (reasons.length || hasRecordedExclusions(version)) input.exclusion_reasons = reasons;
    const savingDatasetId = datasetId;
    const savingVersionId = version.id;
    setSaving(true);
    setError(null);
    try {
      const data = await apiJson<{ flow: PrismaFlow; version: DatasetVersion }>(
        `/api/datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(version.id)}/prisma`, input, { method: "PUT" },
      );
      if (savingDatasetId === currentDataset.current && savingVersionId === version.id) apply(data.flow, data.version);
      return true;
    } catch (err) {
      if (savingDatasetId === currentDataset.current) {
        const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
        const message = Array.isArray(details) ? details.join("; ") : getApiErrorMessage(err, "Unable to save PRISMA counts.");
        setError(message);
      }
      return false;
    } finally {
      if (savingDatasetId === currentDataset.current) setSaving(false);
    }
  };

  const adoptVersion = (nextFlow: PrismaFlow, nextVersion: DatasetVersion) => {
    requestId.current++;
    apply(nextFlow, nextVersion);
    setLoading(false);
  };

  return { flow, version, draft, error, loading, saving, reload, adoptVersion, updateField, updateReasons, save, setError };
}

export function useVersionDocuments(datasetId: string, versionId?: string) {
  const [documents, setDocuments] = useState<BibliometricDocument[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setDocuments([]);
    setTotal(null);
    setError(null);
    if (!datasetId || !versionId) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const collected: BibliometricDocument[] = [];
        let expected: number | null = null;
        while (active && (expected === null || collected.length < expected)) {
          const page = await apiRequest<{ total: number; documents: BibliometricDocument[] }>(
            `/api/datasets/${encodeURIComponent(datasetId)}/documents?version_id=${encodeURIComponent(versionId)}&limit=1000&offset=${collected.length}`,
          );
          if (!Number.isSafeInteger(page.total) || page.total < 0 || !Array.isArray(page.documents)) throw new Error("Invalid document pagination response.");
          if (expected !== null && page.total !== expected) throw new Error("Dataset changed during pagination; reload the version.");
          expected = page.total;
          if (page.documents.length === 0 && collected.length < expected) throw new Error("Document pagination ended before all records were loaded.");
          collected.push(...page.documents);
        }
        if (active) { setDocuments(collected); setTotal(expected ?? 0); }
      } catch (err) {
        if (active) { setDocuments([]); setTotal(null); setError(getApiErrorMessage(err, "Unable to load all documents.")); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [datasetId, versionId, revision]);
  return { documents, total, loading, error, refresh };
}
