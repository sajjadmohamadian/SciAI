import { AiProvenance, AiProviderAttempt, AiProviderId } from "./types.js";

export const AI_GROUNDING_POLICY = `SciAI computes scientometric metrics deterministically. You may only explain, summarize, label, suggest, or document assumptions and limitations. Do not invent metric values, counts, rates, p-values, database coverage, citations, dates, authors, or references. If a requested value is not present in the supplied context, return "unavailable". Distinguish computed facts from interpretive suggestions.`;

export const DEFAULT_AI_LIMITATIONS = [
  "AI output is interpretive and must not be treated as computed metrics.",
  "Unsupported values are marked unavailable.",
];

export function withGroundingPolicy(prompt: string, taskGuidance?: string) {
  return `${AI_GROUNDING_POLICY}\n${taskGuidance ? `\nTask-specific grounding rules:\n${taskGuidance}\n` : ""}\n${prompt}`;
}

export function createUnavailableProvenance(
  attemptedProviders: AiProviderAttempt[] = [],
  limitations: string[] = ["No configured AI provider was available.", ...DEFAULT_AI_LIMITATIONS]
): AiProvenance {
  return {
    provider: "unavailable",
    model: "unavailable",
    attemptedProviders,
    generatedAt: new Date().toISOString(),
    aiRole: "explanation_only",
    limitations,
  };
}

export function createSuccessProvenance(
  provider: AiProviderId,
  model: string,
  attemptedProviders: AiProviderAttempt[],
  limitations: string[] = DEFAULT_AI_LIMITATIONS
): AiProvenance {
  return {
    provider,
    model,
    attemptedProviders,
    generatedAt: new Date().toISOString(),
    aiRole: "explanation_only",
    limitations,
  };
}

export function unavailableText(message = "unavailable") {
  return message;
}
