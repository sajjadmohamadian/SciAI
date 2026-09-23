import { CanonicalDocument, DataHealthMetrics, DatabaseSource } from "../../src/types.js";
import { normalizeDOI, extractCountry } from "./normalizer.js";

// Helper to construct a normalized CanonicalDocument
export function createCanonicalDocument(params: {
  id: string;
  UT?: string;
  AU?: string[];
  TI?: string;
  SO?: string;
  DE?: string[];
  ID?: string[];
  AB?: string;
  C1?: string[];
  CR?: string[];
  TC?: number;
  PY?: number;
  SC?: string[];
  DB?: DatabaseSource;
  DOI?: string;
  ORCID?: string[];
  PMID?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  document_type?: string;
  language?: string;
  raw_sources?: DatabaseSource[];
  FU?: string[];
  FX?: string;
  funding_agencies?: string[];
  grant_numbers?: string[];
  funding_text?: string;
  affiliations?: string[];
  institutions?: string[];
  reprint_address?: string;
  countries?: string[];
}): CanonicalDocument {
  const db = params.DB || "Generic";
  const authors = (params.AU && params.AU.length > 0) ? params.AU : ["Anonymous"];
  const title = (params.TI && params.TI.trim().length > 0) ? params.TI.trim() : `Untitled Document ${params.id}`;
  const source = (params.SO && params.SO.trim().length > 0) ? params.SO.trim() : "Scientific Source";
  const year = (params.PY && params.PY >= 1800 && params.PY <= 2050) ? params.PY : 2023;
  const citations = typeof params.TC === "number" && !isNaN(params.TC) ? Math.max(0, params.TC) : 0;
  const doi = normalizeDOI(params.DOI);

  return {
    id: params.id,
    UT: params.UT,
    AU: authors,
    TI: title,
    SO: source,
    DE: params.DE || [],
    ID: params.ID || [],
    AB: params.AB,
    C1: params.C1 || [],
    CR: params.CR || [],
    TC: citations,
    PY: year,
    SC: params.SC || [],
    DB: db,
    DOI: doi,
    ORCID: params.ORCID || [],
    PMID: params.PMID,
    volume: params.volume,
    issue: params.issue,
    pages: params.pages,
    document_type: params.document_type || "Article",
    language: params.language || "English",
    raw_sources: params.raw_sources || [db],
    FU: params.FU,
    FX: params.FX,
    funding_agencies: params.funding_agencies || [],
    grant_numbers: params.grant_numbers || [],
    funding_text: params.funding_text,
    affiliations: params.affiliations || params.C1 || [],
    institutions: params.institutions || [],
    reprint_address: params.reprint_address,
    countries: params.countries || [],
  };
}

// Ensure any document (CanonicalDocument, BibliometricDocument, or raw input) conforms safely to CanonicalDocument
export function ensureCanonical(doc: any, fallbackId?: string): CanonicalDocument {
  if (!doc) {
    return createCanonicalDocument({ id: fallbackId || `doc-${Date.now()}` });
  }

  const id = String(doc.id || doc.UT || fallbackId || `doc-${Date.now()}`);
  const title = String(doc.TI || doc.title || "Untitled Document").trim();
  
  let authors: string[] = [];
  if (Array.isArray(doc.AU) && doc.AU.length > 0) {
    authors = doc.AU.map(String).filter(Boolean);
  } else if (Array.isArray(doc.authors) && doc.authors.length > 0) {
    authors = doc.authors.map(String).filter(Boolean);
  } else if (typeof doc.AU === "string" && doc.AU.trim()) {
    authors = [doc.AU.trim()];
  } else if (typeof doc.authors === "string" && doc.authors.trim()) {
    authors = [doc.authors.trim()];
  } else {
    authors = ["Anonymous"];
  }

  const source = String(doc.SO || doc.source || "Scientific Publication").trim();
  const year = typeof doc.PY === "number" && !isNaN(doc.PY)
    ? doc.PY
    : typeof doc.year === "number" && !isNaN(doc.year)
    ? doc.year
    : 2023;
  const citations = typeof doc.TC === "number" && !isNaN(doc.TC)
    ? Math.max(0, doc.TC)
    : typeof doc.citations === "number" && !isNaN(doc.citations)
    ? Math.max(0, doc.citations)
    : 0;
  
  const keywords = Array.isArray(doc.DE)
    ? doc.DE.map(String).filter(Boolean)
    : Array.isArray(doc.keywords)
    ? doc.keywords.map(String).filter(Boolean)
    : [];
  const indexKeywords = Array.isArray(doc.ID) ? doc.ID.map(String).filter(Boolean) : [];
  const abstract = String(doc.AB || doc.abstract || "");
  const affiliations = Array.isArray(doc.C1)
    ? doc.C1.map(String).filter(Boolean)
    : Array.isArray(doc.affiliations)
    ? doc.affiliations.map(String).filter(Boolean)
    : doc.country
    ? [`Affiliation, ${doc.country}`]
    : [];
  const references = Array.isArray(doc.CR)
    ? doc.CR.map(String).filter(Boolean)
    : Array.isArray(doc.references)
    ? doc.references.map(String).filter(Boolean)
    : [];
  const doi = normalizeDOI(doc.DOI || doc.doi);
  const pmid = doc.PMID || doc.pmid;
  const db = (doc.DB || doc.database || "Generic") as DatabaseSource;

  const fu = Array.isArray(doc.FU) ? doc.FU : typeof doc.FU === "string" ? [doc.FU] : undefined;
  const fx = typeof doc.FX === "string" ? doc.FX : typeof doc.funding_text === "string" ? doc.funding_text : undefined;
  const fundingAgencies = Array.isArray(doc.funding_agencies) ? doc.funding_agencies : [];
  const grantNumbers = Array.isArray(doc.grant_numbers) ? doc.grant_numbers : [];
  const institutions = Array.isArray(doc.institutions) ? doc.institutions : [];
  const countries = Array.isArray(doc.countries) ? doc.countries : [];

  return createCanonicalDocument({
    id,
    UT: doc.UT || id,
    AU: authors,
    TI: title,
    SO: source,
    DE: keywords,
    ID: indexKeywords,
    AB: abstract,
    C1: affiliations,
    CR: references,
    TC: citations,
    PY: year,
    SC: Array.isArray(doc.SC) ? doc.SC : [],
    DB: db,
    DOI: doi,
    PMID: pmid,
    raw_sources: Array.isArray(doc.raw_sources) && doc.raw_sources.length > 0 ? doc.raw_sources : [db],
    FU: fu,
    FX: fx,
    funding_agencies: fundingAgencies,
    grant_numbers: grantNumbers,
    funding_text: fx,
    affiliations,
    institutions,
    reprint_address: doc.reprint_address || doc.RP,
    countries,
  });
}

// Convert CanonicalDocument to legacy BibliometricDocument if needed by older components
export function toBibliometricDocument(doc: CanonicalDocument): any {
  const country = (doc.countries && doc.countries.length > 0)
    ? doc.countries[0]
    : (doc.C1 && doc.C1.length > 0 ? extractCountry(doc.C1.join("; ")) : "Global");
  const keywords = Array.from(new Set([...(doc.DE || []), ...(doc.ID || [])]));
  return {
    ...doc,
    title: doc.TI,
    authors: doc.AU,
    year: doc.PY,
    source: doc.SO,
    citations: doc.TC,
    keywords,
    abstract: doc.AB,
    doi: doc.DOI,
    affiliations: doc.affiliations || doc.C1,
    institutions: doc.institutions,
    funding_agencies: doc.funding_agencies,
    grant_numbers: doc.grant_numbers,
    funding_text: doc.funding_text || doc.FX,
    reprint_address: doc.reprint_address,
    countries: doc.countries,
    country,
  };
}

// Calculate the 3-Tier Weighted Data Health Score as defined in the roadmap (Phase 3)
export function calculateDataHealth(docs: CanonicalDocument[]): DataHealthMetrics {
  const total = docs.length;
  if (total === 0) {
    return {
      overall_score: 0,
      level_1_score: 0,
      level_2_score: 0,
      level_3_score: 0,
      field_completeness: {
        authors: 0,
        year: 0,
        source: 0,
        citations: 0,
        references: 0,
        title: 0,
        keywords: 0,
        affiliations: 0,
        abstract: 0,
        doi: 0,
        categories: 0,
      },
      total_records: 0,
      database_distribution: {},
    };
  }

  let countAuthors = 0;
  let countYear = 0;
  let countSource = 0;
  let countCitations = 0;
  let countReferences = 0;

  let countTitle = 0;
  let countKeywords = 0;
  let countAffiliations = 0;

  let countAbstract = 0;
  let countDOI = 0;
  let countCategories = 0;

  const dbDist: Record<string, number> = {};

  for (const item of docs) {
    const doc = ensureCanonical(item);
    // DB distribution
    const db = doc.DB || "Generic";
    dbDist[db] = (dbDist[db] || 0) + 1;

    // Level 1 (Weight 3)
    if (doc.AU && doc.AU.length > 0 && doc.AU[0] !== "Anonymous") countAuthors++;
    if (doc.PY && doc.PY > 1900) countYear++;
    if (doc.SO && doc.SO.length > 2) countSource++;
    if (typeof doc.TC === "number" && !isNaN(doc.TC)) countCitations++;
    if (doc.CR && doc.CR.length > 0) countReferences++;

    // Level 2 (Weight 2)
    if (doc.TI && doc.TI.length > 5 && !doc.TI.startsWith("Untitled")) countTitle++;
    if ((doc.DE && doc.DE.length > 0) || (doc.ID && doc.ID.length > 0)) countKeywords++;
    if (doc.C1 && doc.C1.length > 0) countAffiliations++;

    // Level 3 (Weight 1)
    if (doc.AB && doc.AB.length > 25) countAbstract++;
    if (doc.DOI && doc.DOI.length > 5) countDOI++;
    if (doc.SC && doc.SC.length > 0) countCategories++;
  }

  const pAU = countAuthors / total;
  const pPY = countYear / total;
  const pSO = countSource / total;
  const pTC = countCitations / total;
  const pCR = countReferences / total;

  const pTI = countTitle / total;
  const pKW = countKeywords / total;
  const pC1 = countAffiliations / total;

  const pAB = countAbstract / total;
  const pDOI = countDOI / total;
  const pSC = countCategories / total;

  // Level 1 score (Weight 3): author, year, source, citations, references
  const level1 = ((pAU + pPY + pSO + pTC + pCR) / 5) * 100;

  // Level 2 score (Weight 2): title, keywords, affiliations
  const level2 = ((pTI + pKW + pC1) / 3) * 100;

  // Level 3 score (Weight 1): abstract, DOI, categories
  const level3 = ((pAB + pDOI + pSC) / 3) * 100;

  // Overall Weighted Index: (3*L1 + 2*L2 + 1*L3) / 6
  const overall = (3 * level1 + 2 * level2 + 1 * level3) / 6;

  return {
    overall_score: Math.round(overall * 10) / 10,
    level_1_score: Math.round(level1 * 10) / 10,
    level_2_score: Math.round(level2 * 10) / 10,
    level_3_score: Math.round(level3 * 10) / 10,
    field_completeness: {
      authors: Math.round(pAU * 100),
      year: Math.round(pPY * 100),
      source: Math.round(pSO * 100),
      citations: Math.round(pTC * 100),
      references: Math.round(pCR * 100),
      title: Math.round(pTI * 100),
      keywords: Math.round(pKW * 100),
      affiliations: Math.round(pC1 * 100),
      abstract: Math.round(pAB * 100),
      doi: Math.round(pDOI * 100),
      categories: Math.round(pSC * 100),
    },
    total_records: total,
    database_distribution: dbDist,
  };
}
