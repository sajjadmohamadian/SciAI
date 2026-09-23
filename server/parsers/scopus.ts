import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI, parseCSVLine, extractInstitution, extractCountry, parseFunding } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// Scopus CSV and BibTeX Parser
export function parseScopus(text: string): CanonicalDocument[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("@") || trimmed.includes("@ARTICLE{") || trimmed.includes("@article{") || trimmed.includes("@inproceedings{")) {
    return parseScopusBibTeX(trimmed);
  }
  return parseScopusCSV(trimmed);
}

// Scopus CSV Parser
export function parseScopusCSV(text: string): CanonicalDocument[] {
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

  const authorIdx = findIdx(["authors", "author"]);
  const titleIdx = findIdx(["title", "document_title"]);
  const yearIdx = findIdx(["year", "publication_year", "py"]);
  const sourceIdx = findIdx(["source_title", "journal_title", "publication_name"]);
  const citationIdx = findIdx(["cited_by", "citations", "citation_count"]);
  const authorKwIdx = findIdx(["author_keywords"]);
  const indexKwIdx = findIdx(["index_keywords"]);
  const abstractIdx = findIdx(["abstract", "description"]);
  const doiIdx = findIdx(["doi"]);
  const pmidIdx = findIdx(["pubmed_id", "pmid"]);
  const affilIdx = findIdx(["affiliations", "authors_with_affiliations"]);
  const eidIdx = findIdx(["eid"]);
  const refIdx = findIdx(["references"]);
  const volIdx = findIdx(["volume"]);
  const issueIdx = findIdx(["issue"]);
  const docTypeIdx = findIdx(["document_type"]);
  const fundingDetailsIdx = findIdx(["funding_details", "funding_sponsor", "sponsors"]);
  const fundingTextIdx = findIdx(["funding_text_1", "funding_text_2", "funding_text_3", "funding_text"]);
  const fundingNumberIdx = findIdx(["funding_number", "grant_number"]);
  const correspondenceIdx = findIdx(["correspondence_address", "correspondence"]);

  const docs: CanonicalDocument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : `Scopus Record ${i}`;
    const authorRaw = authorIdx !== -1 ? cols[authorIdx] : "Unknown";
    const authors = splitAuthors(authorRaw);

    let year = 2023;
    if (yearIdx !== -1 && cols[yearIdx]) {
      const parsedYear = parseInt(cols[yearIdx].replace(/\D/g, "").slice(0, 4), 10);
      if (parsedYear && parsedYear > 1900 && parsedYear < 2050) {
        year = parsedYear;
      }
    }

    const source = sourceIdx !== -1 && cols[sourceIdx] ? cols[sourceIdx] : "Scopus Indexed Journal";

    let citations = 0;
    if (citationIdx !== -1 && cols[citationIdx]) {
      const parsedCit = parseInt(cols[citationIdx].replace(/\D/g, ""), 10);
      if (!isNaN(parsedCit)) citations = parsedCit;
    }

    const authorKw = authorKwIdx !== -1 && cols[authorKwIdx] ? splitKeywords(cols[authorKwIdx]) : [];
    const indexKw = indexKwIdx !== -1 && cols[indexKwIdx] ? splitKeywords(cols[indexKwIdx]) : [];

    const abstract = abstractIdx !== -1 && cols[abstractIdx] ? cols[abstractIdx] : undefined;
    const doi = doiIdx !== -1 && cols[doiIdx] ? cols[doiIdx] : undefined;
    const pmid = pmidIdx !== -1 && cols[pmidIdx] ? cols[pmidIdx].replace(/\D/g, "") : undefined;
    const eid = eidIdx !== -1 && cols[eidIdx] ? cols[eidIdx] : `2-s2.0-${i}`;
    const affilRaw = affilIdx !== -1 && cols[affilIdx] ? cols[affilIdx] : "";
    const affiliations = affilRaw ? affilRaw.split(";").map(clean).filter(Boolean) : [];
    const correspondence = correspondenceIdx !== -1 && cols[correspondenceIdx] ? clean(cols[correspondenceIdx]) : undefined;

    const extractedInstitutions = Array.from(
      new Set(affiliations.map(extractInstitution).filter((inst) => inst && inst.length > 2))
    );
    const extractedCountries = Array.from(
      new Set(affiliations.map(extractCountry).filter((c) => c && c !== "International"))
    );

    // Research Grants & Funding Extraction
    const rawFundingDetails = fundingDetailsIdx !== -1 && cols[fundingDetailsIdx] ? clean(cols[fundingDetailsIdx]) : "";
    const rawFundingText = fundingTextIdx !== -1 && cols[fundingTextIdx] ? clean(cols[fundingTextIdx]) : "";
    const rawFundingNumber = fundingNumberIdx !== -1 && cols[fundingNumberIdx] ? clean(cols[fundingNumberIdx]) : "";

    const parsedFunding = rawFundingDetails ? parseFunding(rawFundingDetails) : { agencies: [], grants: [] };
    if (rawFundingNumber) {
      const extraGrants = rawFundingNumber.split(/[;,]/).map(clean).filter(Boolean);
      parsedFunding.grants = Array.from(new Set([...parsedFunding.grants, ...extraGrants]));
    }

    const references = refIdx !== -1 && cols[refIdx] ? cols[refIdx].split(";").map(clean).filter(Boolean) : [];

    docs.push(
      createCanonicalDocument({
        id: `scopus-${i}`,
        UT: eid,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(source),
        DE: Array.from(new Set(authorKw)),
        ID: Array.from(new Set(indexKw)),
        AB: abstract ? clean(abstract) : undefined,
        C1: affiliations,
        CR: references,
        TC: citations,
        PY: year,
        SC: [],
        DB: "Scopus",
        DOI: normalizeDOI(doi),
        PMID: pmid && pmid.length > 3 ? pmid : undefined,
        volume: volIdx !== -1 ? cols[volIdx] : undefined,
        issue: issueIdx !== -1 ? cols[issueIdx] : undefined,
        document_type: docTypeIdx !== -1 ? cols[docTypeIdx] : "Article",
        FU: rawFundingDetails ? [rawFundingDetails] : undefined,
        FX: rawFundingText || undefined,
        funding_agencies: parsedFunding.agencies,
        grant_numbers: parsedFunding.grants,
        funding_text: rawFundingText || undefined,
        affiliations,
        institutions: extractedInstitutions,
        reprint_address: correspondence,
        countries: extractedCountries,
      })
    );
  }

  return docs;
}

// Scopus BibTeX Parser
export function parseScopusBibTeX(text: string): CanonicalDocument[] {
  const entries = text.split(/@(?=[a-zA-Z]+\s*\{)/);
  const docs: CanonicalDocument[] = [];

  let idx = 1;
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const firstBrace = trimmed.indexOf("{");
    if (firstBrace === -1) continue;

    const type = trimmed.slice(0, firstBrace).trim();
    const body = trimmed.slice(firstBrace + 1);

    const keyEnd = body.indexOf(",");
    const citationKey = keyEnd !== -1 ? body.slice(0, keyEnd).trim() : `entry-${idx}`;
    const fieldsContent = keyEnd !== -1 ? body.slice(keyEnd + 1) : body;

    // Parse key-value pairs
    const fieldRegex = /([a-zA-Z_-]+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|([a-zA-Z0-9_-]+))/g;
    const fields: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = fieldRegex.exec(fieldsContent)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2] ?? match[3] ?? match[4] ?? "";
      fields[key] = clean(val);
    }

    if (!fields["title"] && !fields["author"]) continue;

    const title = fields["title"] || `Scopus Document ${idx}`;
    const authors = fields["author"] ? splitAuthors(fields["author"]) : ["Anonymous"];
    const year = parseInt(fields["year"] || "2023", 10) || 2023;
    const source = fields["journal"] || fields["booktitle"] || "Scopus Indexed";
    
    // Note often contains "cited By X"
    let citations = 0;
    if (fields["note"]) {
      const citMatch = fields["note"].match(/cited\s*by\s*(\d+)/i);
      if (citMatch) citations = parseInt(citMatch[1], 10);
    }

    const keywords = [
      ...(fields["keywords"] ? splitKeywords(fields["keywords"]) : []),
      ...(fields["author_keywords"] ? splitKeywords(fields["author_keywords"]) : []),
    ];

    const affiliations = fields["affiliations"] ? fields["affiliations"].split(";").map(clean) : [];

    docs.push(
      createCanonicalDocument({
        id: `scopus-bib-${idx}`,
        UT: fields["eid"] || citationKey,
        AU: authors,
        TI: clean(title),
        SO: clean(source),
        DE: keywords,
        ID: [],
        AB: fields["abstract"],
        C1: affiliations,
        CR: [],
        TC: citations,
        PY: year,
        SC: [],
        DB: "Scopus",
        DOI: normalizeDOI(fields["doi"]),
        volume: fields["volume"],
        issue: fields["number"],
        pages: fields["pages"],
        document_type: type,
      })
    );
    idx++;
  }

  return docs;
}
