import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI, parseCSVLine } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// OpenAlex JSON and CSV Parser
export function parseOpenAlex(text: string): CanonicalDocument[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      return parseOpenAlexJSON(data);
    } catch {
      // Fallback to CSV if json parse failed
    }
  }
  return parseOpenAlexCSV(trimmed);
}

// OpenAlex JSON Parser
export function parseOpenAlexJSON(data: any): CanonicalDocument[] {
  const items: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.works)
    ? data.works
    : [data];

  const docs: CanonicalDocument[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item || (!item.title && !item.display_name)) continue;

    const title = item.title || item.display_name || `OpenAlex Record ${idx + 1}`;
    
    // Authors and ORCIDs
    const authors: string[] = [];
    const orcids: string[] = [];
    const affiliations: string[] = [];

    if (Array.isArray(item.authorships)) {
      for (const ship of item.authorships) {
        const name = ship.author?.display_name;
        if (name) authors.push(clean(name));
        if (ship.author?.orcid) {
          const orcid = ship.author.orcid.replace(/^https?:\/\/orcid\.org\//, "");
          orcids.push(orcid);
        }
        if (Array.isArray(ship.institutions)) {
          for (const inst of ship.institutions) {
            if (inst.display_name) affiliations.push(clean(inst.display_name));
          }
        }
      }
    } else if (typeof item.authors === "string") {
      authors.push(...splitAuthors(item.authors));
    }

    const year = typeof item.publication_year === "number" ? item.publication_year : 2023;
    
    // Source / Journal
    const source =
      item.primary_location?.source?.display_name ||
      item.host_venue?.display_name ||
      item.primary_location?.venue?.display_name ||
      item.so ||
      "OpenAlex Scientific Venue";

    const citations = typeof item.cited_by_count === "number" ? item.cited_by_count : 0;

    // Concepts & Keywords
    const concepts: string[] = [];
    if (Array.isArray(item.concepts)) {
      for (const c of item.concepts) {
        if (c.display_name) concepts.push(c.display_name);
      }
    }
    const keywords: string[] = [];
    if (Array.isArray(item.keywords)) {
      for (const k of item.keywords) {
        if (typeof k === "string") keywords.push(k);
        else if (k?.keyword) keywords.push(k.keyword);
        else if (k?.display_name) keywords.push(k.display_name);
      }
    }

    // Reconstruct abstract from inverted index if present
    let abstract: string | undefined = undefined;
    if (typeof item.abstract === "string" && item.abstract.length > 0) {
      abstract = item.abstract;
    } else if (item.abstract_inverted_index && typeof item.abstract_inverted_index === "object") {
      try {
        const wordsWithPositions: Array<{ word: string; pos: number }> = [];
        for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
          if (Array.isArray(positions)) {
            for (const pos of positions) {
              wordsWithPositions.push({ word, pos: Number(pos) });
            }
          }
        }
        wordsWithPositions.sort((a, b) => a.pos - b.pos);
        abstract = wordsWithPositions.map((w) => w.word).join(" ");
      } catch {
        // ignore reconstruction error
      }
    }

    const openAlexId = item.id ? item.id.replace(/^https?:\/\/openalex\.org\//, "") : `W${idx + 1}`;

    docs.push(
      createCanonicalDocument({
        id: `openalex-${idx + 1}`,
        UT: openAlexId,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(source),
        DE: Array.from(new Set(keywords.map((k) => k.toLowerCase()))),
        ID: Array.from(new Set(concepts.map((c) => c.toLowerCase()))),
        AB: abstract ? clean(abstract) : undefined,
        C1: Array.from(new Set(affiliations)),
        CR: Array.isArray(item.referenced_works) ? item.referenced_works.map((r: string) => r.replace(/^https?:\/\/openalex\.org\//, "")) : [],
        TC: citations,
        PY: year,
        SC: concepts.slice(0, 4),
        DB: "OpenAlex",
        DOI: normalizeDOI(item.doi),
        ORCID: orcids,
        volume: item.biblio?.volume,
        issue: item.biblio?.issue,
        pages: item.biblio?.first_page ? `${item.biblio.first_page}-${item.biblio?.last_page || ""}` : undefined,
        document_type: item.type || "article",
        language: item.language || "en",
      })
    );
  }

  return docs;
}

// OpenAlex CSV Parser
export function parseOpenAlexCSV(text: string): CanonicalDocument[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "_"));

  const findIdx = (aliases: string[]) => {
    for (const a of aliases) {
      const idx = headers.findIndex((h) => h === a || h.includes(a));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = findIdx(["id", "openalex_id"]);
  const doiIdx = findIdx(["doi"]);
  const titleIdx = findIdx(["title", "display_name"]);
  const yearIdx = findIdx(["publication_year", "year"]);
  const sourceIdx = findIdx(["host_venue", "primary_location", "source", "journal"]);
  const citIdx = findIdx(["cited_by_count", "citations"]);
  const authorIdx = findIdx(["authors", "authorships"]);
  const conceptsIdx = findIdx(["concepts"]);
  const kwIdx = findIdx(["keywords"]);

  const docs: CanonicalDocument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : `OpenAlex Record ${i}`;
    const authors = authorIdx !== -1 && cols[authorIdx] ? splitAuthors(cols[authorIdx]) : ["Anonymous"];
    const year = yearIdx !== -1 ? parseInt(cols[yearIdx].replace(/\D/g, ""), 10) || 2023 : 2023;
    const source = sourceIdx !== -1 && cols[sourceIdx] ? cols[sourceIdx] : "OpenAlex Source";
    const citations = citIdx !== -1 ? parseInt(cols[citIdx].replace(/\D/g, ""), 10) || 0 : 0;
    const doi = doiIdx !== -1 ? cols[doiIdx] : undefined;
    const concepts = conceptsIdx !== -1 && cols[conceptsIdx] ? splitKeywords(cols[conceptsIdx]) : [];
    const kw = kwIdx !== -1 && cols[kwIdx] ? splitKeywords(cols[kwIdx]) : [];
    const openAlexId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `W${i}`;

    docs.push(
      createCanonicalDocument({
        id: `openalex-csv-${i}`,
        UT: openAlexId,
        AU: authors,
        TI: clean(title),
        SO: clean(source),
        DE: kw,
        ID: concepts,
        TC: citations,
        PY: year,
        SC: concepts.slice(0, 4),
        DB: "OpenAlex",
        DOI: normalizeDOI(doi),
      })
    );
  }

  return docs;
}
