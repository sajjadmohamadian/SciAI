import { BibliometricDocument } from "../src/types.js";
import { normalizeDOI, normalizeTitle } from "./parsers/normalizer.js";

export interface PrismaDedupResult {
  documents: BibliometricDocument[];
  removed: Array<{ index: number; document_id: string; retained_id: string; rule: "exact_doi" | "exact_title" }>;
}

/** Only exact, reviewable identity matches are removed. Input documents are never mutated. */
export function deduplicatePrismaRecords(documents: BibliometricDocument[]): PrismaDedupResult {
  const retained: BibliometricDocument[] = [];
  const removed: PrismaDedupResult["removed"] = [];
  const byDoi = new Map<string, BibliometricDocument>();
  const byTitle = new Map<string, BibliometricDocument>();
  const titleDois = new Map<string, Set<string>>();

  for (const document of documents) {
    const title = normalizeTitle(document.title || (document as any).TI || "");
    const doi = normalizeDOI(document.doi || (document as any).DOI);
    if (title.length < 16 || !doi) continue;
    if (!titleDois.has(title)) titleDois.set(title, new Set());
    titleDois.get(title)!.add(doi);
  }

  documents.forEach((document, index) => {
    const doi = normalizeDOI(document.doi || (document as any).DOI);
    const title = normalizeTitle(document.title || (document as any).TI || "");
    const sameDoi = doi ? byDoi.get(doi) : undefined;
    const sameTitle = title.length >= 16 && (titleDois.get(title)?.size || 0) <= 1 ? byTitle.get(title) : undefined;
    const titleMatchDoi = sameTitle && normalizeDOI(sameTitle.doi || (sameTitle as any).DOI);
    const titleMatch = sameTitle && !(doi && titleMatchDoi && doi !== titleMatchDoi) ? sameTitle : undefined;
    const primary = sameDoi || titleMatch;
    if (primary) {
      removed.push({ index, document_id: String(document.id), retained_id: String(primary.id), rule: sameDoi ? "exact_doi" : "exact_title" });
      return;
    }

    retained.push(document);
    if (doi) byDoi.set(doi, document);
    if (title.length >= 16 && !byTitle.has(title)) byTitle.set(title, document);
  });

  return { documents: retained, removed };
}
