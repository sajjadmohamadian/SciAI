import { CanonicalDocument } from "../../src/types.js";
import { clean, splitAuthors, splitKeywords, normalizeDOI, extractCountry, extractInstitution, parseFunding } from "./normalizer.js";
import { createCanonicalDocument } from "./canonical.js";

// Web of Science (WoS) Plain Text Tagged Parser
export function parseWoS(text: string): CanonicalDocument[] {
  // Split on ER (End of Record)
  const rawRecords = text.split(/\r?\n\s*ER\s*(?:\r?\n|$)/);
  const docs: CanonicalDocument[] = [];

  for (let idx = 0; idx < rawRecords.length; idx++) {
    const block = rawRecords[idx].trim();
    if (!block || (!block.includes("TI ") && !block.includes("AU "))) continue;

    const lines = block.split(/\r?\n/);
    const fields: Record<string, string[]> = {};
    let currentTag = "";

    for (const line of lines) {
      if (/^[A-Z0-9]{2}\s/.test(line)) {
        currentTag = line.substring(0, 2).trim();
        const content = line.substring(3).trim();
        if (!fields[currentTag]) {
          fields[currentTag] = [];
        }
        if (content) {
          fields[currentTag].push(content);
        }
      } else if (currentTag && (line.startsWith("   ") || line.startsWith("\t"))) {
        const continuation = line.trim();
        if (continuation) {
          fields[currentTag].push(continuation);
        }
      }
    }

    if (!fields["TI"] && !fields["AU"]) continue;

    const title = fields["TI"] ? fields["TI"].join(" ") : `WoS Record ${idx + 1}`;
    
    // Authors (AU = abbreviated, AF = full author name if available)
    const rawAuthors = fields["AF"] && fields["AF"].length > 0 ? fields["AF"] : fields["AU"] || [];
    const authors = rawAuthors.flatMap(splitAuthors);

    // Publication Year
    const yearStr = fields["PY"] ? fields["PY"][0].trim() : "";
    const parsedYear = parseInt(yearStr, 10);
    const year = parsedYear && parsedYear > 1900 && parsedYear < 2050 ? parsedYear : 2023;

    // Source (SO = Publication Name)
    const source = fields["SO"] ? fields["SO"].join(" ") : fields["J9"] ? fields["J9"].join(" ") : "Web of Science Publication";

    // Citations (TC = Web of Science Core Collection Times Cited, Z9 = Total Times Cited)
    const tcStr = fields["TC"] ? fields["TC"][0] : fields["Z9"] ? fields["Z9"][0] : "0";
    const citations = parseInt(tcStr.replace(/\D/g, ""), 10) || 0;

    // Keywords (DE = Author Keywords, ID = Keywords Plus)
    const authorKw = fields["DE"] ? fields["DE"].flatMap(splitKeywords) : [];
    const indexKw = fields["ID"] ? fields["ID"].flatMap(splitKeywords) : [];

    // Abstract (AB)
    const abstract = fields["AB"] ? fields["AB"].join(" ") : undefined;

    // Affiliations (C1) and Reprint Address (RP)
    const affiliations = fields["C1"] ? fields["C1"].map(clean) : [];
    const reprintAddress = fields["RP"] ? fields["RP"].join(" ") : undefined;
    const extractedInstitutions = Array.from(
      new Set(affiliations.map(extractInstitution).filter((inst) => inst && inst.length > 2))
    );
    const extractedCountries = Array.from(
      new Set(affiliations.map(extractCountry).filter((c) => c && c !== "International"))
    );

    // Research Grants & Funding (FU = Funding Agency and Grant Number, FX = Funding Text)
    const fuList = fields["FU"] ? fields["FU"].map(clean) : [];
    const fxText = fields["FX"] ? clean(fields["FX"].join(" ")) : undefined;
    const parsedFunding = fuList.length > 0 ? parseFunding(fuList.join("; ")) : { agencies: [], grants: [] };

    // Cited References (CR)
    const references = fields["CR"] ? fields["CR"] : [];

    // Categories (WC = Web of Science Categories, SC = Research Areas)
    const categories = [
      ...(fields["WC"] ? fields["WC"].flatMap(splitKeywords) : []),
      ...(fields["SC"] ? fields["SC"].flatMap(splitKeywords) : []),
    ];

    // Identifiers
    const rawDOI = fields["DI"] ? fields["DI"][0] : undefined;
    const ut = fields["UT"] ? fields["UT"][0].replace(/^WOS:/i, "WOS:") : `wos-${idx + 1}`;

    docs.push(
      createCanonicalDocument({
        id: `wos-${idx + 1}`,
        UT: ut,
        AU: authors.length > 0 ? authors : ["Anonymous"],
        TI: clean(title),
        SO: clean(source),
        DE: Array.from(new Set(authorKw)),
        ID: Array.from(new Set(indexKw)),
        AB: abstract ? clean(abstract) : undefined,
        C1: affiliations,
        CR: references.map(clean),
        TC: citations,
        PY: year,
        SC: Array.from(new Set(categories)),
        DB: "WoS",
        DOI: normalizeDOI(rawDOI),
        volume: fields["VL"] ? fields["VL"][0] : undefined,
        issue: fields["IS"] ? fields["IS"][0] : undefined,
        pages: fields["BP"] && fields["EP"] ? `${fields["BP"][0]}-${fields["EP"][0]}` : fields["BP"] ? fields["BP"][0] : undefined,
        document_type: fields["DT"] ? fields["DT"][0] : "Article",
        language: fields["LA"] ? fields["LA"][0] : "English",
        FU: fuList.length > 0 ? fuList : undefined,
        FX: fxText,
        funding_agencies: parsedFunding.agencies,
        grant_numbers: parsedFunding.grants,
        funding_text: fxText,
        affiliations,
        institutions: extractedInstitutions,
        reprint_address: reprintAddress,
        countries: extractedCountries,
      })
    );
  }

  return docs;
}
