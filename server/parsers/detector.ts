import { CanonicalDocument, DatabaseSource } from "../../src/types.js";
import { parseWoS } from "./wos.js";
import { parseScopus } from "./scopus.js";
import { parsePubMed } from "./pubmed.js";
import { parseOpenAlex } from "./openalex.js";
import { parseDimensions } from "./dimensions.js";
import { parseLens } from "./lens.js";
import { parseCSV } from "../scientometrics.js";
import { createCanonicalDocument } from "./canonical.js";

export interface DetectionResult {
  source: DatabaseSource;
  confidence: number;
  format: "wos_tagged" | "scopus_csv" | "scopus_bib" | "pubmed_tagged" | "openalex_json" | "openalex_csv" | "dimensions_csv" | "lens_csv" | "generic_csv";
  matchedRule: string;
}

// Auto-detect format from content and filename
export function detectDatabaseFormat(content: string, filename = ""): DetectionResult {
  // Strip BOM and clean leading whitespace
  const cleanContent = (content.charCodeAt(0) === 0xfeff ? content.slice(1) : content).trim();
  const lowerFile = filename.toLowerCase();

  // 1. PubMed tagged (.nbib or PMID- pattern)
  if (/(^|\n)PMID\s*-\s*\d+/.test(cleanContent) || (lowerFile.endsWith(".nbib") && /(^|\n)[A-Z]{2,4}\s*-\s*/.test(cleanContent))) {
    return {
      source: "PubMed",
      confidence: 0.99,
      format: "pubmed_tagged",
      matchedRule: "Found PMID- MEDLINE tag pattern",
    };
  }

  // 2. WoS plain text tagged (.txt with PT, AU, TI, ER)
  if (
    /(^|\n)PT\s+[A-Z]/.test(cleanContent) ||
    (/(^|\n)TI\s+/.test(cleanContent) && /(^|\n)ER(\r?\n|$)/.test(cleanContent))
  ) {
    return {
      source: "WoS",
      confidence: 0.98,
      format: "wos_tagged",
      matchedRule: "Found WoS standard tag structure (PT/AU/TI/ER)",
    };
  }

  // 3. Lens.org JSON
  if (
    (cleanContent.startsWith("{") || cleanContent.startsWith("[")) &&
    (cleanContent.includes("lens_id") ||
      cleanContent.includes("lens.org") ||
      cleanContent.includes("scholarly_citations") ||
      (lowerFile.includes("lens") && lowerFile.endsWith(".json")))
  ) {
    return {
      source: "Lens",
      confidence: 0.99,
      format: "lens_csv",
      matchedRule: "Lens.org JSON format detected",
    };
  }

  // 4. OpenAlex JSON
  if (
    (cleanContent.startsWith("{") || cleanContent.startsWith("[")) &&
    (cleanContent.includes("openalex.org") || cleanContent.includes("cited_by_count") || cleanContent.includes("authorships"))
  ) {
    return {
      source: "OpenAlex",
      confidence: 0.99,
      format: "openalex_json",
      matchedRule: "OpenAlex JSON schema containing authorships and cited_by_count",
    };
  }

  // 5. BibTeX (.bib or @article / @ARTICLE)
  if (lowerFile.endsWith(".bib") || /@\w+\s*\{/i.test(cleanContent)) {
    return {
      source: "Scopus",
      confidence: 0.95,
      format: "scopus_bib",
      matchedRule: "BibTeX structure with entry delimiters",
    };
  }

  // 6. Filename-based Lens check (if filename contains lens and is csv/tsv/txt)
  if (
    lowerFile.includes("lens") &&
    (lowerFile.endsWith(".csv") || lowerFile.endsWith(".tsv") || lowerFile.endsWith(".txt"))
  ) {
    return {
      source: "Lens",
      confidence: 0.98,
      format: "lens_csv",
      matchedRule: "Filename indicates Lens.org export",
    };
  }

  // 7. Multi-line header scanning (inspect first 25 non-empty lines for headers & signatures)
  const previewLines = cleanContent
    .split(/\r?\n/)
    .slice(0, 25)
    .map((l) => l.toLowerCase());
  const combinedHeaderSample = previewLines.join(" ");

  // Lens.org CSV / TSV
  if (
    combinedHeaderSample.includes("lens id") ||
    combinedHeaderSample.includes("lens_id") ||
    combinedHeaderSample.includes("lens.org") ||
    combinedHeaderSample.includes("# the lens") ||
    (combinedHeaderSample.includes("citing works count") && combinedHeaderSample.includes("fields of study")) ||
    (combinedHeaderSample.includes("scholarly citations") && combinedHeaderSample.includes("fields of study")) ||
    (combinedHeaderSample.includes("author/inventors") && combinedHeaderSample.includes("source title"))
  ) {
    return {
      source: "Lens",
      confidence: 0.99,
      format: "lens_csv",
      matchedRule: "Lens.org signature columns (lens id, citing works/scholarly citations)",
    };
  }

  // Dimensions CSV
  if (
    combinedHeaderSample.includes("publication id") ||
    combinedHeaderSample.includes("pubyear") ||
    (combinedHeaderSample.includes("times cited") && combinedHeaderSample.includes("field of research"))
  ) {
    return {
      source: "Dimensions",
      confidence: 0.99,
      format: "dimensions_csv",
      matchedRule: "Dimensions signature columns (publication id, times cited, pubyear)",
    };
  }

  // Scopus CSV
  if (
    combinedHeaderSample.includes("eid") ||
    combinedHeaderSample.includes("author(s) id") ||
    (combinedHeaderSample.includes("source title") && combinedHeaderSample.includes("cited by")) ||
    combinedHeaderSample.includes("authors with affiliations")
  ) {
    return {
      source: "Scopus",
      confidence: 0.98,
      format: "scopus_csv",
      matchedRule: "Scopus signature columns (eid, author id, cited by)",
    };
  }

  // OpenAlex CSV
  if (combinedHeaderSample.includes("openalex") || (combinedHeaderSample.includes("host_venue") && combinedHeaderSample.includes("cited_by_count"))) {
    return {
      source: "OpenAlex",
      confidence: 0.95,
      format: "openalex_csv",
      matchedRule: "OpenAlex CSV header columns",
    };
  }

  // Generic CSV
  return {
    source: "Generic",
    confidence: 0.6,
    format: "generic_csv",
    matchedRule: "Standard CSV delimiter structure",
  };
}

// Multi-layer Bibliometric File Validation
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detected?: DetectionResult;
}

const ALLOWED_EXTENSIONS = [".csv", ".txt", ".ciw", ".tsv", ".nbib", ".json", ".bib"];

export function validateBibliometricUpload(
  filename: string,
  mimetype: string | undefined,
  content: string
): FileValidationResult {
  const lowerName = filename.toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

  if (!hasAllowedExt) {
    return {
      valid: false,
      error: `Unsupported file extension for '${filename}'. Allowed file formats: .csv, .txt, .ciw, .tsv, .nbib, .json, .bib.`,
    };
  }

  // Check for binary garbage / null bytes (safety against executable or binary payload uploads)
  const probeLen = Math.min(content.length, 2048);
  for (let i = 0; i < probeLen; i++) {
    if (content.charCodeAt(i) === 0) {
      return {
        valid: false,
        error: `File '${filename}' contains invalid binary data and cannot be parsed as a bibliometric document.`,
      };
    }
  }

  // Check content format
  const detected = detectDatabaseFormat(content, filename);

  // Reconcile extension and detected format
  if (lowerName.endsWith(".json")) {
    if (detected.format !== "openalex_json" && detected.format !== "lens_csv") {
      // Must at least be valid JSON
      try {
        JSON.parse(content);
      } catch {
        return {
          valid: false,
          error: `File '${filename}' has .json extension but is not valid JSON content.`,
        };
      }
    }
  }

  if (lowerName.endsWith(".nbib")) {
    // If explicitly named .nbib, it must have MEDLINE-like tagged records
    if (!/(^|\n)PMID\s*-\s*\d+/.test(content) && !/(^|\n)[A-Z]{2,4}\s*-\s*/.test(content)) {
      return {
        valid: false,
        error: `File '${filename}' has .nbib extension but does not contain valid PubMed/MEDLINE tagged entries.`,
      };
    }
  }

  if (lowerName.endsWith(".bib") && detected.format !== "scopus_bib") {
    if (!/@\w+\s*\{/i.test(content)) {
      return {
        valid: false,
        error: `File '${filename}' has .bib extension but does not contain valid BibTeX entries (@article, @book, etc.).`,
      };
    }
  }

  return {
    valid: true,
    detected,
  };
}
export function parseAnyDatabaseSource(content: string, filename = "", explicitSource?: DatabaseSource): {
  documents: CanonicalDocument[];
  detected: DetectionResult;
} {
  const detected = detectDatabaseFormat(content, filename);
  const targetSource = explicitSource && explicitSource !== "Generic" ? explicitSource : detected.source;

  let docs: CanonicalDocument[] = [];

  switch (targetSource) {
    case "WoS":
      docs = parseWoS(content);
      break;
    case "Scopus":
      docs = parseScopus(content);
      break;
    case "PubMed":
      docs = parsePubMed(content);
      break;
    case "OpenAlex":
      docs = parseOpenAlex(content);
      break;
    case "Dimensions":
      docs = parseDimensions(content);
      break;
    case "Lens":
      docs = parseLens(content);
      break;
    default: {
      // If detected format is specific, use that
      if (detected.format === "wos_tagged") docs = parseWoS(content);
      else if (detected.format === "pubmed_tagged") docs = parsePubMed(content);
      else if (detected.format === "openalex_json" || detected.format === "openalex_csv") docs = parseOpenAlex(content);
      else if (detected.format === "dimensions_csv") docs = parseDimensions(content);
      else if (detected.format === "lens_csv") docs = parseLens(content);
      else if (detected.format === "scopus_csv" || detected.format === "scopus_bib") docs = parseScopus(content);
      else {
        // Generic fallback using existing CSV parser converted to canonical
        const legacyDocs = parseCSV(content);
        docs = legacyDocs.map((d, i) =>
          createCanonicalDocument({
            id: `generic-${i + 1}`,
            AU: d.authors,
            TI: d.title,
            SO: d.source,
            DE: d.keywords,
            TC: d.citations,
            PY: d.year,
            DB: "Generic",
            DOI: d.doi,
            AB: d.abstract,
          })
        );
      }
    }
  }

  return {
    documents: docs,
    detected,
  };
}
