import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// PubMed MEDLINE (.nbib / .txt) format parser
export function parsePubMed(text: string): CanonicalDocument[] {
  // PubMed records are separated by double newlines or lines starting with PMID-
  const rawRecords = text.split(/(?=\r?\nPMID-|\r?\nPMID\s*-\s*|^PMID-|^PMID\s*-\s*)/);
  const docs: CanonicalDocument[] = [];

  let recordIdx = 1;
  for (const block of rawRecords) {
    const trimmed = block.trim();
    if (!trimmed || !trimmed.includes("PMID")) continue;

    const lines = trimmed.split(/\r?\n/);
    const fields: Record<string, string[]> = {};
    let currentTag = "";

    for (const line of lines) {
      // Tags in PubMed MEDLINE are 4 characters plus a dash (e.g. "PMID- ", "TI  - ", "FAU - ", "AB  - ")
      const tagMatch = line.match(/^([A-Z]{2,4})\s*-\s*(.*)$/);
      if (tagMatch) {
        currentTag = tagMatch[1].trim();
        const content = tagMatch[2].trim();
        if (!fields[currentTag]) fields[currentTag] = [];
        if (content) fields[currentTag].push(content);
      } else if (currentTag && (line.startsWith("      ") || line.startsWith("    ") || line.startsWith("\t"))) {
        const continuation = line.trim();
        if (continuation) {
          const arr = fields[currentTag];
          if (arr.length > 0) {
            arr[arr.length - 1] = arr[arr.length - 1] + " " + continuation;
          } else {
            arr.push(continuation);
          }
        }
      }
    }

    const pmid = fields["PMID"] ? fields["PMID"][0].trim() : undefined;
    if (!pmid && !fields["TI"]) continue;

    const title = fields["TI"] ? fields["TI"].join(" ") : fields["BTI"] ? fields["BTI"].join(" ") : `PubMed Record ${recordIdx}`;
    
    // Prefer Full Authors (FAU) over AU
    const rawAuthors = fields["FAU"] && fields["FAU"].length > 0 ? fields["FAU"] : fields["AU"] || [];
    const authors = rawAuthors.map(clean).filter((a) => a.length > 0);

    // Publication Date / Year
    let year = 2023;
    const dp = fields["DP"] ? fields["DP"][0] : fields["DA"] ? fields["DA"][0] : "";
    const yearMatch = dp.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Journal Title (JT = Full title, TA = Medline Abbreviation)
    const journal = fields["JT"] ? fields["JT"].join(" ") : fields["TA"] ? fields["TA"].join(" ") : "PubMed Indexed Journal";

    // MeSH terms (MH) and Other Terms (OT)
    const meshTerms = fields["MH"] ? fields["MH"].flatMap(splitKeywords) : [];
    const otherTerms = fields["OT"] ? fields["OT"].flatMap(splitKeywords) : [];

    // Abstract (AB)
    const abstract = fields["AB"] ? fields["AB"].join(" ") : undefined;

    // Affiliations (AD)
    const affiliations = fields["AD"] ? fields["AD"].map(clean) : [];

    // DOI from LID or AID (e.g. "10.1038/s41586-020-2003-x [doi]")
    let doi: string | undefined = undefined;
    const idCandidates = [...(fields["LID"] || []), ...(fields["AID"] || [])];
    for (const cand of idCandidates) {
      if (cand.includes("[doi]") || cand.startsWith("10.")) {
        const cleanCand = cand.replace(/\[doi\]/i, "").trim();
        const norm = normalizeDOI(cleanCand);
        if (norm) {
          doi = norm;
          break;
        }
      }
    }

    const docType = fields["PT"] ? fields["PT"][0] : "Journal Article";

    docs.push(
      createCanonicalDocument({
        id: `pubmed-${pmid || recordIdx}`,
        UT: pmid ? `PMID:${pmid}` : `pmid-${recordIdx}`,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(journal),
        DE: Array.from(new Set(otherTerms)),
        ID: Array.from(new Set(meshTerms)),
        AB: abstract ? clean(abstract) : undefined,
        C1: affiliations,
        CR: [],
        TC: 0, // PubMed does not store citing work counts natively
        PY: year,
        SC: Array.from(new Set(meshTerms.slice(0, 5))),
        DB: "PubMed",
        DOI: doi,
        PMID: pmid,
        document_type: docType,
        language: fields["LA"] ? fields["LA"][0] : "English",
      })
    );
    recordIdx++;
  }

  return docs;
}
