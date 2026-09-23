import { DatabaseSource } from "../../src/types.js";

// Clean and normalize strings
export function clean(val: string): string {
  if (!val) return "";
  return val.replace(/\s+/g, " ").trim();
}

// Clean and standardize DOI: returns lowercase, e.g. "10.1016/j.joi.2023.101400"
export function normalizeDOI(raw?: string): string | undefined {
  if (!raw) return undefined;
  let cleaned = raw.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  cleaned = cleaned.replace(/^doi:\s*/i, "");
  cleaned = cleaned.replace(/[;,.\s]+$/, ""); // strip trailing punctuation
  // Validate standard DOI prefix: 10.xxxx/...
  if (/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(cleaned)) {
    return cleaned;
  }
  return cleaned.length > 5 && cleaned.startsWith("10.") ? cleaned : undefined;
}

// Clean and normalize title for fuzzy matching: lowercase, strip punctuation, collapse whitespace
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  return rawTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^\w\s]/g, " ") // replace non-alphanumeric with spaces
    .replace(/\s+/g, " ")
    .trim();
}

// Extract surname of primary (first) author for blocking
export function extractFirstAuthorSurname(authors: string[]): string {
  if (!authors || authors.length === 0) return "unknown";
  const primary = authors[0].trim();
  if (primary.includes(",")) {
    return clean(primary.split(",")[0]).toLowerCase().replace(/[^\w]/g, "");
  }
  const parts = primary.split(" ").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase().replace(/[^\w]/g, "") : "unknown";
}

// Split multiple authors string cleanly
export function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  const normalized = raw.replace(/\r?\n/g, " ");
  // Scopus/WoS semicolon separation vs comma vs " and "
  let items: string[] = [];
  if (normalized.includes(";")) {
    items = normalized.split(";");
  } else if (normalized.includes(" and ")) {
    items = normalized.split(" and ");
  } else if (normalized.includes("|")) {
    items = normalized.split("|");
  } else {
    items = [normalized];
  }

  return items
    .map((s) => clean(s.replace(/^,\s*/, "").replace(/,\s*$/, "")))
    .filter((s) => s.length > 1 && !/^\d+$/.test(s));
}

// Split keywords cleanly
export function splitKeywords(raw: string): string[] {
  if (!raw) return [];
  const delimiters = raw.includes(";") ? ";" : raw.includes("|") ? "|" : raw.includes(",") ? "," : "\n";
  return raw
    .split(delimiters)
    .map((k) => clean(k).toLowerCase())
    .filter((k) => k.length > 1 && !/^[0-9]+$/.test(k));
}

// Extract standardized ISO country or country name from affiliation string
export function extractCountry(affiliation?: string): string {
  if (!affiliation) return "International";
  const countries = [
    { pattern: /\b(United States|USA|U\.S\.A\.|US)\b/i, name: "United States" },
    { pattern: /\b(United Kingdom|UK|England|Scotland|Wales)\b/i, name: "United Kingdom" },
    { pattern: /\b(China|People's Republic of China|PR China)\b/i, name: "China" },
    { pattern: /\b(Germany|Deutschland)\b/i, name: "Germany" },
    { pattern: /\b(Iran|Islamic Republic of Iran)\b/i, name: "Iran" },
    { pattern: /\b(Canada)\b/i, name: "Canada" },
    { pattern: /\b(Australia)\b/i, name: "Australia" },
    { pattern: /\b(France)\b/i, name: "France" },
    { pattern: /\b(Japan)\b/i, name: "Japan" },
    { pattern: /\b(Italy|Italia)\b/i, name: "Italy" },
    { pattern: /\b(Spain|España)\b/i, name: "Spain" },
    { pattern: /\b(Netherlands|Holland)\b/i, name: "Netherlands" },
    { pattern: /\b(Switzerland|Swiss)\b/i, name: "Switzerland" },
    { pattern: /\b(Sweden)\b/i, name: "Sweden" },
    { pattern: /\b(Brazil|Brasil)\b/i, name: "Brazil" },
    { pattern: /\b(India)\b/i, name: "India" },
    { pattern: /\b(South Korea|Republic of Korea|Korea)\b/i, name: "South Korea" },
    { pattern: /\b(Singapore)\b/i, name: "Singapore" },
    { pattern: /\b(Norway)\b/i, name: "Norway" },
    { pattern: /\b(Denmark)\b/i, name: "Denmark" },
    { pattern: /\b(Finland)\b/i, name: "Finland" },
    { pattern: /\b(Belgium)\b/i, name: "Belgium" },
    { pattern: /\b(Austria)\b/i, name: "Austria" },
    { pattern: /\b(Turkey|Türkiye)\b/i, name: "Turkey" },
    { pattern: /\b(South Africa)\b/i, name: "South Africa" }
  ];

  for (const item of countries) {
    if (item.pattern.test(affiliation)) {
      return item.name;
    }
  }

  const parts = affiliation.split(",");
  return parts.length > 1 ? clean(parts[parts.length - 1]) : "International";
}

// Jaro Distance between two strings (0.0 to 1.0)
export function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(l1, l2) / 2) - 1;
  const s1Matches = new Array(l1).fill(false);
  const s2Matches = new Array(l2).fill(false);

  let matches = 0;
  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }

  return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3.0;
}

// Jaro-Winkler Distance: adjusts Jaro score for common prefix length (up to 4 chars)
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroDistance(s1, s2);
  if (jaro < 0.7) return jaro;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return jaro + prefix * prefixScale * (1 - jaro);
}

// Robust CSV row splitter that handles quoted commas and escaped quotes
export function parseCSVLine(line: string, delimiter = ","): string[] {
  const row: string[] = [];
  let insideQuote = false;
  let entry = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        entry += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === delimiter && !insideQuote) {
      row.push(entry);
      entry = "";
    } else {
      entry += char;
    }
  }
  row.push(entry);
  return row.map((r) => r.trim());
}

// Complete RFC-4180 compliant CSV / TSV / DSV parser supporting:
// 1. Multiline fields (newlines embedded inside quotes)
// 2. Escaped quotes ("")
// 3. UTF-8 BOM removal
// 4. Auto-detected delimiter (comma, tab, semicolon)
export function parseCSVRecords(text: string, forceDelimiter?: string): string[][] {
  if (!text) return [];
  // Strip BOM
  let content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  // Auto-detect delimiter if not forced
  let delimiter = forceDelimiter;
  if (!delimiter) {
    const sample = content.slice(0, 3000);
    const tabCount = (sample.match(/\t/g) || []).length;
    const semicolonCount = (sample.match(/;/g) || []).length;
    const commaCount = (sample.match(/,/g) || []).length;
    if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = "\t";
    } else if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ";";
    } else {
      delimiter = ",";
    }
  }

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  const len = content.length;

  for (let i = 0; i < len; i++) {
    const char = content[i];

    if (char === '"') {
      if (insideQuotes && i + 1 < len && content[i + 1] === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      // Handle \r\n
      if (char === "\r" && i + 1 < len && content[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some((c) => c.length > 0)) {
        records.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      records.push(currentRow);
    }
  }

  return records;
}

// Extract primary standardized institution from affiliation string
export function extractInstitution(rawAffiliation: string): string {
  if (!rawAffiliation) return "";
  // Strip bracketed author tags: e.g. [Vaswani, Ashish; Shazeer, Noam] Google Brain, CA, USA
  let text = rawAffiliation.replace(/\[.*?\]/g, "").trim();
  // Split on commas or semicolons
  const parts = text.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  
  // Look for university, institute, college, hospital, lab, company
  const orgKeywords = /\b(Univ|University|Institute|Institut|College|Hospital|Clinic|Center|Centre|Laboratory|Lab|Academy|School|Research|Google|Microsoft|IBM|Meta|Max Planck|CNRS|INSERM|RIKEN|CERN|Mayo Clinic|Charité)\b/i;
  
  for (const part of parts) {
    if (orgKeywords.test(part) && part.length > 3 && !part.match(/\b(Dept|Department|Division|Faculty|Section|Floor|Street|St\.|Ave|Blvd|Box|USA|UK|Iran|Germany|China)\b/i)) {
      return clean(part);
    }
  }

  // Fallback: first non-department part
  for (const part of parts) {
    if (!part.match(/\b(Dept|Department|Division|Faculty|Section|Floor|Street|St\.|Ave|Blvd|Box|P\.O\.|Postal)\b/i) && part.length > 3) {
      return clean(part);
    }
  }

  return clean(parts[0]);
}

// Parse funding agency names and grant numbers from WoS FU or Scopus Funding details
export function parseFunding(fundingStr: string): { agencies: string[]; grants: string[] } {
  if (!fundingStr) return { agencies: [], grants: [] };
  const agencies: string[] = [];
  const grants: string[] = [];

  // Patterns like: "National Science Foundation [1943440, 1823901]; European Research Council [ERC-2020-8910]"
  const segments = fundingStr.split(";").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const match = seg.match(/^([^\[]+)(?:\[(.*?)\])?/);
    if (match) {
      const agency = clean(match[1]);
      if (agency && agency.length > 2 && !/^\d+$/.test(agency)) {
        agencies.push(agency);
      }
      if (match[2]) {
        const grantList = match[2].split(/[,/]/).map((g) => clean(g)).filter(Boolean);
        grants.push(...grantList);
      }
    } else {
      const cleaned = clean(seg);
      if (cleaned.length > 2) agencies.push(cleaned);
    }
  }

  return {
    agencies: Array.from(new Set(agencies)),
    grants: Array.from(new Set(grants)),
  };
}


