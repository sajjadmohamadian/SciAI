export type AiProviderId = "ollama" | "gemini" | "claude" | "openai";
export type AiProviderStatus = AiProviderId | "unavailable";

export type AiTaskKind =
  | "interpretation"
  | "cluster_labeling"
  | "research_gaps"
  | "manuscript_section"
  | "citation_context"
  | "rag_chat"
  | "prisma_report"
  | "research_gap_matrix";

export interface AiCallRequest {
  task: AiTaskKind;
  prompt: string;
  responseFormat: "text" | "json";
  schemaName?: string;
  maxOutputTokens?: number;
  temperature?: number;
  preferredProvider?: AiProviderId;
  allowFallback?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AiProviderAttempt {
  provider: AiProviderId;
  model: string;
  status: "success" | "failed" | "skipped";
  errorCode?: string;
}

export interface AiProvenance {
  provider: AiProviderStatus;
  model: string | "unavailable";
  attemptedProviders: AiProviderAttempt[];
  generatedAt: string;
  aiRole: "explanation_only";
  limitations: string[];
}

export interface AiCallResult<T = unknown> {
  status: "available" | "unavailable";
  content: T | null;
  provenance: AiProvenance;
  warnings: string[];
}

export interface AiProvider {
  id: AiProviderId;
  model: string;
  isConfigured(): boolean;
  generateText(request: AiCallRequest): Promise<AiCallResult<string>>;
  generateJson<T>(request: AiCallRequest): Promise<AiCallResult<T>>;
}

export class AiProviderError extends Error {
  code: string;
  transient: boolean;

  constructor(message: string, code = "provider_error", transient = false) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.transient = transient;
  }
}
