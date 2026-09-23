import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI, parseCSVLine } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// Dimensions CSV export parser
export function parseDimensions(text: string): CanonicalDocument[] {
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

  const idIdx = findIdx(["publication_id", "pub_id"]);
  const doiIdx = findIdx(["doi"]);
  const pmidIdx = findIdx(["pmid"]);
  const titleIdx = findIdx(["title"]);
  const sourceIdx = findIdx(["source_title", "journal"]);
  const yearIdx = findIdx(["pubyear", "publication_year", "year"]);
  const authorIdx = findIdx(["authors", "author"]);
  const affilIdx = findIdx(["research_organizations", "authors_raw_affiliation", "affiliations"]);
  const citIdx = findIdx(["times_cited", "recent_citations", "citations"]);
  const meshIdx = findIdx(["mesh_terms", "mesh"]);
  const forIdx = findIdx(["field_of_research", "anzsrc", "fields_of_research"]);
  const abstractIdx = findIdx(["abstract"]);
  const typeIdx = findIdx(["publication_type"]);
  const volIdx = findIdx(["volume"]);
  const issueIdx = findIdx(["issue"]);
  const pagesIdx = findIdx(["pagination"]);

  const docs: CanonicalDocument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : `Dimensions Record ${i}`;
    const authorRaw = authorIdx !== -1 ? cols[authorIdx] : "Unknown";
    const authors = splitAuthors(authorRaw);

    let year = 2023;
    if (yearIdx !== -1 && cols[yearIdx]) {
      const parsedYear = parseInt(cols[yearIdx].replace(/\D/g, "").slice(0, 4), 10);
      if (parsedYear && parsedYear > 1900 && parsedYear < 2050) {
        year = parsedYear;
      }
    }

    const source = sourceIdx !== -1 && cols[sourceIdx] ? cols[sourceIdx] : "Dimensions Indexed Source";

    let citations = 0;
    if (citIdx !== -1 && cols[citIdx]) {
      const parsedCit = parseInt(cols[citIdx].replace(/\D/g, ""), 10);
      if (!isNaN(parsedCit)) citations = parsedCit;
    }

    const mesh = meshIdx !== -1 && cols[meshIdx] ? splitKeywords(cols[meshIdx]) : [];
    const fieldsOfResearch = forIdx !== -1 && cols[forIdx] ? splitKeywords(cols[forIdx]) : [];
    const abstract = abstractIdx !== -1 && cols[abstractIdx] ? cols[abstractIdx] : undefined;
    const doi = doiIdx !== -1 ? cols[doiIdx] : undefined;
    const pmid = pmidIdx !== -1 && cols[pmidIdx] ? cols[pmidIdx].replace(/\D/g, "") : undefined;
    const pubId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `pub.${i}`;
    
    const affiliations = affilIdx !== -1 && cols[affilIdx] ? cols[affilIdx].split(";").map(clean).filter(Boolean) : [];

    docs.push(
      createCanonicalDocument({
        id: `dimensions-${i}`,
        UT: pubId,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(source),
        DE: Array.from(new Set(fieldsOfResearch)),
        ID: Array.from(new Set(mesh)),
        AB: abstract ? clean(abstract) : undefined,
        C1: affiliations,
        CR: [],
        TC: citations,
        PY: year,
        SC: fieldsOfResearch.slice(0, 4),
        DB: "Dimensions",
        DOI: normalizeDOI(doi),
        PMID: pmid && pmid.length > 3 ? pmid : undefined,
        volume: volIdx !== -1 ? cols[volIdx] : undefined,
        issue: issueIdx !== -1 ? cols[issueIdx] : undefined,
        pages: pagesIdx !== -1 ? cols[pagesIdx] : undefined,
        document_type: typeIdx !== -1 ? cols[typeIdx] : "Article",
      })
    );
  }

  return docs;
}
