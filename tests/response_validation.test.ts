import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateDashboardResponse,
  validateCapabilitiesResponse,
  validateAnalysisRunResponse,
  validateSingleAnalysis,
  validateVersionsList,
  validateDatasetHealth,
  validateDocumentsList,
  validateGnnResponse,
  validatePredictSimulatorResponse,
  validateRagChatResponse,
  validateResearchGapsResponse,
  validateManuscriptSectionResponse,
  validateCitationContextResponse,
  validateResearchGapMatrixResponse,
  validateCorpusDiscrepancyResponse,
  validateAiInterpretationResponse,
  validateChartRecords,
  validateHistCiteResponse,
  validateRpysResponse,
  validateThematicEvolutionResponse,
} from "../src/utils/responseValidation.js";

describe("Frontend Defensive Response Validation Suite", () => {
  // 1. Dashboard and Project validation
  describe("Dashboard & Project Validation", () => {
    test("rejects null or non-object dashboard payload", () => {
      assert.equal(validateDashboardResponse(null).success, false);
      assert.equal(validateDashboardResponse("invalid").success, false);
      assert.equal(validateDashboardResponse([]).success, false);
    });

    test("rejects dashboard payload missing project object", () => {
      const res = validateDashboardResponse({ datasets: [], analyses: [] });
      assert.equal(res.success, false);
      assert.match(res.error || "", /missing valid project/i);
    });

    test("accepts valid dashboard payload and extracts safe arrays", () => {
      const payload = {
        project: { id: "proj-1", name: "Test Project", description: "Desc" },
        datasets: [{ id: "ds-1", name: "Dataset 1", source: "WOS" }, null, {}],
        analyses: [{ id: "ana-1", dataset_id: "ds-1", analysis_type: "publication.year_distribution" }],
      };
      const res = validateDashboardResponse(payload);
      assert.equal(res.success, true);
      assert.equal(res.data?.project.id, "proj-1");
      assert.equal(res.data?.datasets.length, 1);
      assert.equal(res.data?.analyses.length, 1);
    });
  });

  // 2. Capabilities validation
  describe("Capabilities Validation", () => {
    test("filters out non-objects and missing name/category", () => {
      const raw = [
        null,
        "not-a-capability",
        { name: "valid.cap", category: "bibliometric", description: "Valid Cap" },
        { category: "missing-name" },
      ];
      const valid = validateCapabilitiesResponse(raw);
      assert.equal(valid.length, 1);
      assert.equal(valid[0].name, "valid.cap");
    });
  });

  // 3. Analysis Execution validation
  describe("Analysis Execution & Records Validation", () => {
    test("rejects malformed analysis execution response", () => {
      assert.equal(validateAnalysisRunResponse(null).success, false);
      assert.equal(validateAnalysisRunResponse({}).success, false);
      assert.equal(validateAnalysisRunResponse({ analysis: null }).success, false);
    });

    test("validates analysis records and skips null/non-objects", () => {
      const valid = validateSingleAnalysis({
        id: "ana-1",
        result: {
          records: [{ year: 2021, documents: 42 }, null, "bad"],
        },
      });
      assert.notEqual(valid, null);
      assert.equal(valid?.result.records.length, 1);
      assert.equal(valid?.result.records[0].year, 2021);

      assert.equal(validateSingleAnalysis(null), null);
      assert.equal(validateSingleAnalysis("string-record"), null);
      assert.equal(validateSingleAnalysis({}), null);
    });
  });

  // 4. Machine Learning & GNN Validation
  describe("GNN & Machine Learning Studio Validation", () => {
    test("rejects null or non-object GNN response", () => {
      const res = validateGnnResponse(null);
      assert.equal(res.success, false);
      assert.equal(res.data, null);
    });

    test("rejects GNN response with missing trainingMetrics", () => {
      const res = validateGnnResponse({ architecture: "RGCN" });
      assert.equal(res.success, false);
      assert.match(res.error || "", /trainingMetrics/i);
    });

    test("accepts valid GNN response and parses metrics safely", () => {
      const payload = {
        architecture: "Hierarchical-GNN",
        hyperparameters: { epochs: 20, hiddenDim: 64, learningRate: 0.01, dropout: 0.2, optimizer: "Adam", activation: "ReLU" },
        trainingMetrics: { finalLoss: 0.24, rocAuc: 0.92, averagePrecision: 0.88, meanReciprocalRank: 0.81, convergenceEpoch: 18 },
        nodeEmbeddings: [{ id: "n1", name: "Node 1", type: "author", x: 1, y: 2, communityGNN: 0, communityLouvain: 0, disruptionScore: 0.5, citations: 10 }],
        predictedLinks: [],
        attentionPairs: [],
      };
      const res = validateGnnResponse(payload);
      assert.equal(res.success, true);
      assert.equal(res.data?.trainingMetrics.rocAuc, 0.92);
      assert.equal(res.data?.nodeEmbeddings.length, 1);
    });

    test("rejects malformed Simulator response", () => {
      assert.equal(validatePredictSimulatorResponse(null).success, false);
      assert.equal(validatePredictSimulatorResponse({ status: "success" }).success, false);
    });
  });

  // 5. AI Intelligence Validation (Incomplete vs Authoritative)
  describe("AI Intelligence Response Validation", () => {
    test("identifies incomplete or partial RAG chat response as non-authoritative", () => {
      const completeRes = validateRagChatResponse({ answer: "Comprehensive explanation with evidence.", sources: ["p1"] });
      assert.equal(completeRes.success, true);
      assert.equal(completeRes.isComplete, true);

      const partialRes = validateRagChatResponse({ answer: "Short [partial]...", partial: true });
      assert.equal(partialRes.isPartial, true);

      const emptyRes = validateRagChatResponse({ answer: "" });
      assert.equal(emptyRes.success, false);
    });

    test("identifies empty or missing research gaps as incomplete/partial", () => {
      const invalidRes = validateResearchGapsResponse({});
      assert.equal(invalidRes.isComplete, false);
      assert.equal(invalidRes.isPartial, true);

      const validRes = validateResearchGapsResponse({
        gaps: [
          {
            id: "gap-1",
            title: "Novel mechanism",
            description: "Unexplored pathway",
            feasibility: "high",
            suggestedMethodology: "Wet-lab",
            priorityScore: 85,
          },
        ],
      });
      assert.equal(validRes.success, true);
      assert.equal(validRes.data?.gaps.length, 1);
    });

    test("validates AI Interpretation with partial truncation detection", () => {
      const valid = validateAiInterpretationResponse({ interpretation: "Key scientometric patterns indicate growth." });
      assert.equal(valid.success, true);
      assert.equal(valid.isPartial, false);

      const partial = validateAiInterpretationResponse({ interpretation: "Beginning of thought but... [truncated]" });
      assert.equal(partial.success, true);
      assert.equal(partial.isPartial, true);

      const empty = validateAiInterpretationResponse({ interpretation: "   " });
      assert.equal(empty.success, false);
    });

    test("validates Research Gap Matrix and rejects missing proposals", () => {
      assert.equal(validateResearchGapMatrixResponse(null).success, false);
      assert.equal(validateResearchGapMatrixResponse({ proposals: "not-array" }).success, false);

      const unavailable = validateResearchGapMatrixResponse({
        status: "unavailable",
        proposals: [],
        matrixSummary: { totalIdentifiedGaps: 0 },
        ai_provenance: { provider: "unavailable" },
      });
      assert.equal(unavailable.success, true);
      assert.equal(unavailable.isComplete, false);
      assert.equal(unavailable.isPartial, true);
    });
  });

  // 6. Chart Data Validation (Empty vs Malformed vs Valid)
  describe("Chart Data & Visualizer Validation", () => {
    test("detects null, empty, or non-array records", () => {
      const nullCheck = validateChartRecords("publication.year_distribution", null);
      assert.equal(nullCheck.hasValidData, false);

      const emptyCheck = validateChartRecords("publication.year_distribution", []);
      assert.equal(emptyCheck.hasValidData, false);
    });

    test("detects array of empty objects as invalid records", () => {
      const check = validateChartRecords("publication.year_distribution", [{}, {}, {}] as any);
      assert.equal(check.hasValidData, false);
    });

    test("validates publication.year_distribution records correctly", () => {
      const check = validateChartRecords("publication.year_distribution", [
        { year: "2020", documents: 15 },
        { year: "2021", documents: 32 },
      ]);
      assert.equal(check.hasValidData, true);
      assert.equal(check.validRecordCount, 2);
    });
  });

  // 7. Historical & Thematic Evolution Validation
  describe("HistCite, RPYS, & Thematic Evolution Validation", () => {
    test("validates HistCite output and sanitizes node lists", () => {
      const raw = {
        dataset_id: "ds-1",
        nodes: [
          { id: "doc-1", title: "Paper 1", firstAuthor: "Smith", year: 2018, lcs: 5 },
          null, // malformed entry
        ],
        links: [{ source: "doc-1", target: "doc-2", weight: 1 }],
      };
      const res = validateHistCiteResponse(raw);
      assert.equal(res.success, true);
      assert.equal(res.data?.nodes.length, 1);
      assert.equal(res.data?.links.length, 1);
    });

    test("rejects malformed RPYS payload", () => {
      assert.equal(validateRpysResponse(null).success, false);
      assert.equal(validateRpysResponse("bad-payload").success, false);
    });

    test("validates Thematic Evolution output and provides defaults", () => {
      const raw = {
        periods: [{ periodIndex: 0, label: "2010-2015", yearSpan: "2010-2015", docCount: 100 }],
        nodes: [{ id: "n1", name: "CRISPR", periodIndex: 0, docCount: 20 }],
        links: [],
      };
      const res = validateThematicEvolutionResponse(raw);
      assert.equal(res.success, true);
      assert.equal(res.data?.periods.length, 1);
      assert.equal(res.data?.nodes.length, 1);
      assert.notEqual(res.data?.summary, undefined);
    });
  });
});
