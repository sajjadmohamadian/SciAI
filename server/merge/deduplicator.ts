import {
  CanonicalDocument,
  SmartMergeSummary,
  MergeAuditEntry,
  BorderlineMatch,
  DatabaseSource,
} from "../../src/types.js";
import {
  normalizeDOI,
  normalizeTitle,
  extractFirstAuthorSurname,
  jaroWinklerSimilarity,
  clean,
} from "../parsers/normalizer.js";
import { calculateDataHealth, ensureCanonical } from "../parsers/canonical.js";

export interface MergeOptions {
  similarityThreshold?: number; // default 0.92
  borderlineThreshold?: number; // default 0.78
  allowYearTolerance?: boolean; // default true (+- 1 year for preprints/online-first)
  autoMergeHighConfidence?: boolean; // default true
}

// Smart Merge & Deduplication Engine
export class SmartMergeEngine {
  options: Required<MergeOptions>;

  constructor(options: MergeOptions = {}) {
    this.options = {
      similarityThreshold: options.similarityThreshold ?? 0.92,
      borderlineThreshold: options.borderlineThreshold ?? 0.78,
      allowYearTolerance: options.allowYearTolerance ?? true,
      autoMergeHighConfidence: options.autoMergeHighConfidence ?? true,
    };
  }

  // Generate blocking key: e.g. "2023_smith" or "nodate_doe"
  private getBlockKey(doc: CanonicalDocument): string {
    const rawYear = doc.PY || (doc as any).year;
    const yearPart = typeof rawYear === "number" && rawYear > 1800 ? `${rawYear}` : "noyear";
    const authors = Array.isArray(doc.AU) && doc.AU.length > 0
      ? doc.AU
      : Array.isArray((doc as any).authors) && (doc as any).authors.length > 0
      ? (doc as any).authors
      : [];
    const authorPart = extractFirstAuthorSurname(authors);
    return `${yearPart}_${authorPart}`;
  }

  // Consolidate two matching records with "fetch-once-fill-all" smart priority rules
  private mergeRecords(
    primary: CanonicalDocument,
    secondary: CanonicalDocument,
    matchRule: "EXACT_DOI" | "EXACT_PMID" | "JARO_WINKLER_FUZZY" | "EXACT_ACCESSION",
    confidence: number
  ): CanonicalDocument {
    // Title: pick the cleaner / longer title
    const pTI = primary.TI || (primary as any).title || "";
    const sTI = secondary.TI || (secondary as any).title || "";
    const title = pTI.length >= sTI.length && !pTI.includes("&lt;") ? pTI : (sTI || pTI || "Untitled Document");

    // Authors: pick list with more full characters/detail
    const pAU = Array.isArray(primary.AU) ? primary.AU : Array.isArray((primary as any).authors) ? (primary as any).authors : [];
    const sAU = Array.isArray(secondary.AU) ? secondary.AU : Array.isArray((secondary as any).authors) ? (secondary as any).authors : [];
    const authors = pAU.join(" ").length >= sAU.join(" ").length ? pAU : sAU;

    // Source / Journal
    const pSO = primary.SO || (primary as any).source || "";
    const sSO = secondary.SO || (secondary as any).source || "";
    const source = pSO.length >= sSO.length ? pSO : sSO;

    // Citations: maximum cited count across databases
    const pTC = typeof primary.TC === "number" ? primary.TC : typeof (primary as any).citations === "number" ? (primary as any).citations : 0;
    const sTC = typeof secondary.TC === "number" ? secondary.TC : typeof (secondary as any).citations === "number" ? (secondary as any).citations : 0;
    const citations = Math.max(pTC, sTC);

    // Abstract: longest abstract
    const pAB = primary.AB || (primary as any).abstract || "";
    const sAB = secondary.AB || (secondary as any).abstract || "";
    const abstract = pAB.length >= sAB.length ? pAB : sAB;

    // Keywords union
    const pDE = Array.isArray(primary.DE) ? primary.DE : Array.isArray((primary as any).keywords) ? (primary as any).keywords : [];
    const sDE = Array.isArray(secondary.DE) ? secondary.DE : Array.isArray((secondary as any).keywords) ? (secondary as any).keywords : [];
    const keywordsUnion = Array.from(new Set([...pDE, ...sDE]));
    const indexKeywordsUnion = Array.from(new Set([...(primary.ID || []), ...(secondary.ID || [])]));

    // Affiliations union
    const pC1 = Array.isArray(primary.C1) ? primary.C1 : Array.isArray((primary as any).affiliations) ? (primary as any).affiliations : [];
    const sC1 = Array.isArray(secondary.C1) ? secondary.C1 : Array.isArray((secondary as any).affiliations) ? (secondary as any).affiliations : [];
    const affiliationsUnion = Array.from(new Set([...pC1, ...sC1]));

    // References union
    const referencesUnion = Array.from(new Set([...(primary.CR || []), ...(secondary.CR || [])]));

    // Identifiers
    const doi = primary.DOI || secondary.DOI || (primary as any).doi || (secondary as any).doi;
    const pmid = primary.PMID || secondary.PMID || (primary as any).pmid || (secondary as any).pmid;
    const ut = primary.UT || secondary.UT;

    // Contributing sources list
    const primaryDB = primary.DB || (primary as any).database || "Generic";
    const secondaryDB = secondary.DB || (secondary as any).database || "Generic";
    const existingSources = primary.raw_sources || [primaryDB];
    const incomingSources = secondary.raw_sources || [secondaryDB];
    const raw_sources = Array.from(new Set([...existingSources, ...incomingSources]));

    // Categories union
    const categories = Array.from(new Set([...(primary.SC || []), ...(secondary.SC || [])]));

    return {
      ...primary,
      TI: clean(title),
      AU: authors.length > 0 ? authors : ["Anonymous"],
      SO: clean(source),
      TC: citations,
      AB: abstract,
      DE: keywordsUnion,
      ID: indexKeywordsUnion,
      C1: affiliationsUnion,
      CR: referencesUnion,
      DOI: doi,
      PMID: pmid,
      UT: ut,
      SC: categories,
      raw_sources,
      merge_confidence: Math.min(primary.merge_confidence || 1.0, confidence),
      merge_match_rule: matchRule,
    };
  }

  // Deduplicate and merge array of canonical documents
  merge(rawDocuments: any[]): SmartMergeSummary {
    // Defensively ensure all incoming records conform strictly to CanonicalDocument
    const normalizedDocs: CanonicalDocument[] = (rawDocuments || []).map((doc, idx) =>
      ensureCanonical(doc, `input-doc-${idx + 1}`)
    );

    const totalRaw = normalizedDocs.length;
    const auditLog: MergeAuditEntry[] = [];
    const borderlineQueue: BorderlineMatch[] = [];

    // Track input counts by database
    const sourcesBreakdown: Record<string, number> = {};
    for (const doc of normalizedDocs) {
      const db = doc.DB || "Generic";
      sourcesBreakdown[db] = (sourcesBreakdown[db] || 0) + 1;
    }

    // Fast Direct Indexing Maps for Identifiers
    const doiMap = new Map<string, number>(); // doi -> index in mergedList
    const pmidMap = new Map<string, number>(); // pmid -> index in mergedList

    // Blocks map: blockKey -> indices in mergedList
    const blocks = new Map<string, number[]>();

    const mergedList: CanonicalDocument[] = [];

    for (let i = 0; i < normalizedDocs.length; i++) {
      const doc = normalizedDocs[i];
      const normDoi = normalizeDOI(doc.DOI);
      const normPmid = doc.PMID?.trim();
      const normTitle = normalizeTitle(doc.TI || "");

      let matchedIndex = -1;
      let matchedRule: "EXACT_DOI" | "EXACT_PMID" | "JARO_WINKLER_FUZZY" | "EXACT_ACCESSION" = "EXACT_DOI";
      let matchConfidence = 1.0;

      // 1. Tier 1: Exact DOI matching
      if (normDoi && doiMap.has(normDoi)) {
        matchedIndex = doiMap.get(normDoi)!;
        matchedRule = "EXACT_DOI";
        matchConfidence = 1.0;
      }

      // 2. Tier 2: Exact PMID matching (if no DOI match)
      if (matchedIndex === -1 && normPmid && pmidMap.has(normPmid)) {
        const candidateIdx = pmidMap.get(normPmid)!;
        const candidate = mergedList[candidateIdx];
        // DOI SHIELD: Never merge if both have conflicting valid DOIs
        if (!normDoi || !candidate.DOI || normDoi === candidate.DOI) {
          matchedIndex = candidateIdx;
          matchedRule = "EXACT_PMID";
          matchConfidence = 0.98;
        }
      }

      // 3. Tier 3: Blocked Jaro-Winkler title fuzzy comparison
      if (matchedIndex === -1 && normTitle) {
        const currentBlockKey = this.getBlockKey(doc);
        const candidateIndices: number[] = [];

        // Check primary block
        if (blocks.has(currentBlockKey)) {
          candidateIndices.push(...blocks.get(currentBlockKey)!);
        }

        // Also check year tolerance (+- 1 year) with same author if enabled
        if (this.options.allowYearTolerance && doc.PY) {
          const surname = extractFirstAuthorSurname(doc.AU || []);
          const prevYearKey = `${doc.PY - 1}_${surname}`;
          const nextYearKey = `${doc.PY + 1}_${surname}`;
          if (blocks.has(prevYearKey)) candidateIndices.push(...blocks.get(prevYearKey)!);
          if (blocks.has(nextYearKey)) candidateIndices.push(...blocks.get(nextYearKey)!);
        }

        // Fallback: If candidate indices found, compare against them
        const searchSet = candidateIndices.length > 0 ? Array.from(new Set(candidateIndices)) : [];

        for (const candIdx of searchSet) {
          const candidate = mergedList[candIdx];

          // DOI SHIELD: If both have valid DOIs and they differ, DO NOT MERGE!
          if (normDoi && candidate.DOI && normDoi !== candidate.DOI) {
            continue;
          }

          const candNormTitle = normalizeTitle(candidate.TI || "");
          const sim = jaroWinklerSimilarity(normTitle, candNormTitle);

          if (sim >= this.options.similarityThreshold) {
            matchedIndex = candIdx;
            matchedRule = "JARO_WINKLER_FUZZY";
            matchConfidence = Math.round(sim * 100) / 100;
            break;
          } else if (sim >= this.options.borderlineThreshold) {
            // Borderline case: route to review queue
            borderlineQueue.push({
              id: `borderline-${i}-${candIdx}`,
              candidate_a: candidate,
              candidate_b: doc,
              similarity_score: Math.round(sim * 100) / 100,
              reason: `Fuzzy title match (${(sim * 100).toFixed(1)}%) in publication block ${currentBlockKey}`,
            });
          }
        }
      }

      // Execute Merge or Insert
      if (matchedIndex !== -1 && this.options.autoMergeHighConfidence) {
        const existing = mergedList[matchedIndex];
        const updated = this.mergeRecords(existing, doc, matchedRule, matchConfidence);
        mergedList[matchedIndex] = updated;

        // Update fast lookups with any newly discovered IDs
        if (updated.DOI && !doiMap.has(updated.DOI)) doiMap.set(updated.DOI, matchedIndex);
        if (updated.PMID && !pmidMap.has(updated.PMID)) pmidMap.set(updated.PMID, matchedIndex);

        // Record in Audit Log
        auditLog.push({
          canonical_id: updated.id,
          title: updated.TI || "Untitled Document",
          matched_rule: matchedRule,
          confidence: matchConfidence,
          contributing_databases: updated.raw_sources || [updated.DB || "Generic"],
          doi: updated.DOI,
          pmid: updated.PMID,
          records_merged_count: (updated.raw_sources?.length || 1),
          timestamp: new Date().toISOString(),
        });
      } else {
        // Insert as new canonical record
        const newIndex = mergedList.length;
        const canonical: CanonicalDocument = {
          ...doc,
          id: `canon-${newIndex + 1}`,
          DOI: normDoi,
          raw_sources: doc.raw_sources && doc.raw_sources.length > 0 ? doc.raw_sources : [doc.DB || "Generic"],
        };
        mergedList.push(canonical);

        if (normDoi) doiMap.set(normDoi, newIndex);
        if (normPmid) pmidMap.set(normPmid, newIndex);

        const blockKey = this.getBlockKey(canonical);
        if (!blocks.has(blockKey)) blocks.set(blockKey, []);
        blocks.get(blockKey)!.push(newIndex);
      }
    }

    // Overlap Statistics
    let singleSource = 0;
    let twoSources = 0;
    let threeOrMore = 0;

    for (const doc of mergedList) {
      const srcCount = doc.raw_sources ? doc.raw_sources.length : 1;
      if (srcCount === 1) singleSource++;
      else if (srcCount === 2) twoSources++;
      else threeOrMore++;
    }

    const duplicatesResolved = totalRaw - mergedList.length;
    const reductionPct = totalRaw > 0 ? Math.round((duplicatesResolved / totalRaw) * 1000) / 10 : 0;
    const databasesIncluded = Object.keys(sourcesBreakdown) as DatabaseSource[];

    // Calculate Data Health of the clean unified corpus
    const dataHealth = calculateDataHealth(mergedList);

    // Generate Formal Research Methodology Paragraph
    const methodologyNarrative = this.generateMethodologyParagraph({
      totalRaw,
      finalUnique: mergedList.length,
      duplicatesResolved,
      databasesIncluded,
      sourcesBreakdown,
      overlapTwo: twoSources,
      overlapThreePlus: threeOrMore,
    });

    return {
      merged_dataset_id: `merged-${Date.now()}`,
      total_raw_inputs: totalRaw,
      duplicates_resolved: duplicatesResolved,
      final_unique_count: mergedList.length,
      reduction_percentage: reductionPct,
      databases_included: databasesIncluded,
      sources_breakdown: sourcesBreakdown,
      overlap_breakdown: {
        single_source_only: singleSource,
        two_sources: twoSources,
        three_or_more_sources: threeOrMore,
      },
      audit_log: auditLog,
      borderline_queue: borderlineQueue.slice(0, 50),
      methodology_narrative: methodologyNarrative,
      data_health: dataHealth,
      merged_documents: mergedList,
    };
  }

  // Generate formal academic methodology narrative for research manuscripts
  generateMethodologyParagraph(stats: {
    totalRaw: number;
    finalUnique: number;
    duplicatesResolved: number;
    databasesIncluded: string[];
    sourcesBreakdown: Record<string, number>;
    overlapTwo: number;
    overlapThreePlus: number;
  }): string {
    const dbListStr = Object.entries(stats.sourcesBreakdown)
      .map(([db, count]) => `${db} (n = ${count.toLocaleString()})`)
      .join(", ");

    return (
      `Bibliographic records were retrieved and aggregated from ${stats.databasesIncluded.length} citation databases: ` +
      `${dbListStr}, yielding an initial corpus of ${stats.totalRaw.toLocaleString()} raw records. ` +
      `Data ingestion and schema harmonization were conducted using the Scientrix canonical bibliographic framework, ` +
      `standardizing field tags into a unified internal representation (AU, TI, SO, DE, ID, AB, C1, CR, TC, PY, DOI, PMID). ` +
      `Cross-database deduplication was executed via a multi-tiered hierarchical matching protocol. Records were blocked ` +
      `by publication year and primary author surname to eliminate quadratic comparison overhead. Candidate pairs were evaluated ` +
      `first through strict persistent identifiers (exact DOI matching enforced with protective conflict shielding, and exact PubMed PMID validation), ` +
      `followed by Jaro-Winkler string similarity distance thresholding (similarity coefficient ≥ 0.92) on normalized titles. ` +
      `In total, ${stats.duplicatesResolved.toLocaleString()} redundant entries were consolidated, identifying ${stats.overlapTwo.toLocaleString()} ` +
      `records indexed across dual databases and ${stats.overlapThreePlus.toLocaleString()} records present across three or more indexing sources. ` +
      `Field conflict resolution applied priority harvesting to retain maximum citation counts, comprehensive abstract narratives, and unified keyword descriptors, ` +
      `resulting in a clean, deduplicated corpus of ${stats.finalUnique.toLocaleString()} unique publications for subsequent scientometric and topological analysis.`
    );
  }
}
