import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI, parseCSVRecords } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// Lens.org export parser (Supports CSV, TSV, and JSON formats)
export function parseLens(text: string): CanonicalDocument[] {
  if (!text || text.trim().length === 0) return [];
  const trimmed = text.trim();

  // 1. JSON Export Support (Lens Web UI / API exports)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawList: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.data)
        ? parsed.data
        : Array.isArray(parsed.results)
        ? parsed.results
        : Array.isArray(parsed.records)
        ? parsed.records
        : [];

      if (rawList.length > 0) {
        return rawList.map((item, idx) => {
          // Authors
          let authors: string[] = [];
          if (Array.isArray(item.authors)) {
            authors = item.authors
              .map((a: any) =>
                typeof a === "string"
                  ? clean(a)
                  : clean(
                      a.display_name ||
                        `${a.first_name || ""} ${a.last_name || ""}`.trim() ||
                        a.name ||
                        ""
                    )
              )
              .filter(Boolean);
          } else if (typeof item.authors === "string") {
            authors = splitAuthors(item.authors);
          } else if (typeof item["Author/Inventors"] === "string") {
            authors = splitAuthors(item["Author/Inventors"]);
          }

          // Year
          let year = 2023;
          if (item.publication_year || item.year) {
            year = parseInt(String(item.publication_year || item.year), 10) || 2023;
          } else if (item.date_published) {
            const y = parseInt(String(item.date_published).slice(0, 4), 10);
            if (y > 1900 && y < 2050) year = y;
          }

          // Citations
          const citations =
            item.scholarly_citations_count ??
            item.citing_works_count ??
            item.citations ??
            item.scholarly_citations ??
            0;

          // Fields / Keywords
          const fields = Array.isArray(item.fields_of_study)
            ? item.fields_of_study
            : typeof item.fields_of_study === "string"
            ? splitKeywords(item.fields_of_study)
            : [];
          const keywords = Array.isArray(item.keywords)
            ? item.keywords
            : typeof item.keywords === "string"
            ? splitKeywords(item.keywords)
            : [];

          return createCanonicalDocument({
            id: `lens-json-${idx + 1}`,
            UT: item.lens_id || item.id || `lens-${idx + 1}`,
            AU: authors.length > 0 ? authors : ["Anonymous"],
            TI: clean(item.title || item.Title || `Lens Document ${idx + 1}`),
            SO: clean(
              item.source_title ||
                item.journal?.name ||
                item.publisher ||
                "Lens.org Indexed Source"
            ),
            DE: Array.from(new Set(keywords)),
            ID: Array.from(new Set(fields)),
            AB: item.abstract ? clean(item.abstract) : undefined,
            C1: Array.isArray(item.affiliations)
              ? item.affiliations.map(clean)
              : typeof item.author_affiliations === "string"
              ? item.author_affiliations.split(";").map(clean).filter(Boolean)
              : [],
            CR: [],
            TC: typeof citations === "number" ? citations : parseInt(String(citations), 10) || 0,
            PY: year,
            SC: fields.slice(0, 4),
            DB: "Lens",
            DOI: normalizeDOI(item.doi || item.external_ids?.doi),
            PMID: item.pmid ? String(item.pmid).replace(/\D/g, "") : undefined,
            document_type: item.publication_type || item.type || "Article",
          });
        });
      }
    } catch {
      // If JSON parsing fails, continue to CSV/TSV parsing
    }
  }

  // 2. CSV / TSV Parsing using multi-line, delimiter-aware RFC-4180 parser
  const rows = parseCSVRecords(text);
  if (rows.length < 2) return [];

  // Locate the true header row (skipping metadata/comment rows like "# The Lens (https://www.lens.org)")
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const rowJoined = rows[r].join(" ").toLowerCase();
    if (
      rowJoined.includes("lens id") ||
      rowJoined.includes("lens_id") ||
      rowJoined.includes("citing works") ||
      rowJoined.includes("scholarly citations") ||
      rowJoined.includes("author/inventors") ||
      (rowJoined.includes("title") && rowJoined.includes("source")) ||
      rowJoined.includes("display key") ||
      rowJoined.includes("jurisdiction")
    ) {
      headerRowIdx = r;
      break;
    }
  }

  // If no obvious header was identified, default to row 0
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const rawHeaders = rows[headerRowIdx];
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "")
  );

  const findIdx = (aliases: string[]) => {
    for (const a of aliases) {
      const sanitized = a.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const idx = headers.findIndex(
        (h) => h === sanitized || h.includes(sanitized)
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = findIdx(["lens_id", "lens id", "id", "display_key", "jurisdiction"]);
  const doiIdx = findIdx(["doi", "external_url"]);
  const pmidIdx = findIdx(["pubmed_id", "pmid", "pmcid"]);
  const titleIdx = findIdx(["title", "invention_title", "english_title", "patent_title"]);
  const sourceIdx = findIdx(["source_title", "source", "journal", "publisher", "source_country"]);
  const yearIdx = findIdx([
    "publication_year",
    "pubyear",
    "date_published",
    "year",
    "publication_date",
    "earliest_priority_date",
    "application_date",
  ]);
  const authorIdx = findIdx([
    "author_inventors",
    "authors",
    "author",
    "inventors",
    "inventor",
    "applicants",
    "applicant",
  ]);
  const affilIdx = findIdx([
    "author_affiliations",
    "affiliations",
    "affiliation",
    "institutions",
    "research_organizations",
  ]);
  const citIdx = findIdx([
    "scholarly_citations",
    "citing_works_count",
    "scholarly_citations_count",
    "citations",
    "cited_works_count",
    "patent_citations",
  ]);
  const fosIdx = findIdx([
    "fields_of_study",
    "fields",
    "cpc_classifications",
    "ipcr_classifications",
    "subject",
  ]);
  const kwIdx = findIdx(["keywords", "author_keywords", "mesh_terms"]);
  const abstractIdx = findIdx(["abstract", "description"]);
  const typeIdx = findIdx(["publication_type", "document_type", "type", "kind"]);
  const volIdx = findIdx(["volume", "vol"]);
  const issueIdx = findIdx(["issuenumber", "issue_number", "issue"]);
  const startPageIdx = findIdx(["start_page", "page_start"]);
  const endPageIdx = findIdx(["end_page", "page_end"]);

  const docs: CanonicalDocument[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    // Title resolution with graceful fallback
    let title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : "";
    if (!title) {
      // Find candidate title column (string > 15 chars)
      const cand = cols.find((c) => c.length > 15 && !c.startsWith("10.") && !/^\d+$/.test(c));
      title = cand || `Lens Record ${i - headerRowIdx}`;
    }

    const authorRaw = authorIdx !== -1 && cols[authorIdx] ? cols[authorIdx] : "Unknown";
    const authors = splitAuthors(authorRaw);

    let year = 2023;
    if (yearIdx !== -1 && cols[yearIdx]) {
      const parsedYear = parseInt(cols[yearIdx].replace(/\D/g, "").slice(0, 4), 10);
      if (parsedYear && parsedYear > 1900 && parsedYear < 2050) {
        year = parsedYear;
      }
    }

    const source =
      sourceIdx !== -1 && cols[sourceIdx] ? cols[sourceIdx] : "Lens.org Indexed Source";

    let citations = 0;
    if (citIdx !== -1 && cols[citIdx]) {
      const parsedCit = parseInt(cols[citIdx].replace(/\D/g, ""), 10);
      if (!isNaN(parsedCit)) citations = parsedCit;
    }

    const fieldsOfStudy =
      fosIdx !== -1 && cols[fosIdx] ? splitKeywords(cols[fosIdx]) : [];
    const keywords =
      kwIdx !== -1 && cols[kwIdx] ? splitKeywords(cols[kwIdx]) : [];
    const abstract =
      abstractIdx !== -1 && cols[abstractIdx] ? cols[abstractIdx] : undefined;
    const doi = doiIdx !== -1 ? cols[doiIdx] : undefined;
    const pmid =
      pmidIdx !== -1 && cols[pmidIdx] ? cols[pmidIdx].replace(/\D/g, "") : undefined;
    const lensId =
      idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `lens-${i - headerRowIdx}`;

    const affiliations =
      affilIdx !== -1 && cols[affilIdx]
        ? cols[affilIdx].split(";").map(clean).filter(Boolean)
        : [];

    const pages =
      startPageIdx !== -1 && cols[startPageIdx]
        ? `${cols[startPageIdx]}${
            endPageIdx !== -1 && cols[endPageIdx] ? `-${cols[endPageIdx]}` : ""
          }`
        : undefined;

    docs.push(
      createCanonicalDocument({
        id: `lens-${i - headerRowIdx}`,
        UT: lensId,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(source),
        DE: Array.from(new Set(keywords)),
        ID: Array.from(new Set(fieldsOfStudy)),
        AB: abstract ? clean(abstract) : undefined,
        C1: affiliations,
        CR: [],
        TC: citations,
        PY: year,
        SC: fieldsOfStudy.slice(0, 4),
        DB: "Lens",
        DOI: normalizeDOI(doi),
        PMID: pmid && pmid.length > 3 ? pmid : undefined,
        volume: volIdx !== -1 ? cols[volIdx] : undefined,
        issue: issueIdx !== -1 ? cols[issueIdx] : undefined,
        pages,
        document_type: typeIdx !== -1 ? cols[typeIdx] : "Article",
      })
    );
  }

  return docs;
}

