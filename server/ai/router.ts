import { getAiProviderConfig, isAiProviderId } from "./config.js";
import { DEFAULT_AI_LIMITATIONS, createSuccessProvenance, createUnavailableProvenance } from "./prompts.js";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderAttempt, AiProviderError, AiProviderId } from "./types.js";
import { GeminiProvider } from "./providers/gemini.js";
import { ClaudeProvider } from "./providers/claude.js";
import { OpenAiProvider } from "./providers/openai.js";

export function createDefaultProviders(): Record<AiProviderId, AiProvider> {
  const config = getAiProviderConfig();
  return {
    gemini: new GeminiProvider(config.models.gemini),
    claude: new ClaudeProvider(config.models.claude),
    openai: new OpenAiProvider(config.models.openai),
  };
}

export function normalizeProviderPreference(value: unknown): AiProviderId | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!isAiProviderId(normalized)) {
    throw new AiProviderError("Invalid AI provider requested", "invalid_provider", false);
  }
  return normalized;
}

function buildProviderOrder(preferredProvider?: AiProviderId, allowFallback = getAiProviderConfig().allowFallback): AiProviderId[] {
  const config = getAiProviderConfig();
  const base = [preferredProvider || config.defaultProvider, ...config.providerOrder];
  const unique = Array.from(new Set(base.filter(Boolean))) as AiProviderId[];
  return allowFallback ? unique : unique.slice(0, 1);
}

function mergeAttemptProvenance<T>(result: AiCallResult<T>, attempts: AiProviderAttempt[]): AiCallResult<T> {
  if (result.status !== "available" || !result.provenance.provider || result.provenance.provider === "unavailable") {
    return result;
  }
  return {
    ...result,
    provenance: createSuccessProvenance(
      result.provenance.provider,
      result.provenance.model,
      attempts,
      result.provenance.limitations.length ? result.provenance.limitations : DEFAULT_AI_LIMITATIONS
    ),
  };
}

export async function callAiText(request: AiCallRequest, providers = createDefaultProviders()): Promise<AiCallResult<string>> {
  return callAi(request, providers, "text");
}

export async function callAiJson<T>(request: AiCallRequest, providers = createDefaultProviders()): Promise<AiCallResult<T>> {
  return callAi<T>(request, providers, "json");
}

async function callAi<T>(
  request: AiCallRequest,
  providers: Record<AiProviderId, AiProvider>,
  mode: "text" | "json"
): Promise<AiCallResult<T>> {
  const config = getAiProviderConfig();
  const allowFallback = request.allowFallback ?? config.allowFallback;
  const providerOrder = buildProviderOrder(request.preferredProvider, allowFallback);
  const attempts: AiProviderAttempt[] = [];
  let lastWarning = "No configured AI provider was available.";

  for (const providerId of providerOrder) {
    const provider = providers[providerId];
    if (!provider || !provider.isConfigured()) {
      attempts.push({ provider: providerId, model: provider?.model || config.models[providerId], status: "skipped", errorCode: "not_configured" });
      continue;
    }

    try {
      const result = mode === "json"
        ? await provider.generateJson<T>({ ...request, responseFormat: "json" })
        : await provider.generateText({ ...request, responseFormat: "text" }) as AiCallResult<T>;

      if (result.status === "available" && result.content !== null) {
        attempts.push({ provider: providerId, model: provider.model, status: "success" });
        return mergeAttemptProvenance(result, attempts);
      }
      attempts.push({ provider: providerId, model: provider.model, status: "failed", errorCode: "unavailable" });
      lastWarning = result.warnings[0] || lastWarning;
    } catch (err) {
      const providerError = err instanceof AiProviderError ? err : new AiProviderError("AI provider failed", "provider_error", false);
      attempts.push({ provider: providerId, model: provider.model, status: "failed", errorCode: providerError.code });
      lastWarning = providerError.message;
      if (!allowFallback || !providerError.transient) break;
    }
  }

  return {
    status: "unavailable",
    content: null,
    provenance: createUnavailableProvenance(attempts),
    warnings: [lastWarning],
  };
}
