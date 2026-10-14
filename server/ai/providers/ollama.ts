import { AiCallRequest, AiCallResult, AiProvider, AiProviderError } from "../types.js";
import { getAiProviderConfig, getOllamaTimeoutMs, getOllamaUrl, isOllamaEnabled } from "../config.js";
import { createSuccessProvenance, createUnavailableProvenance } from "../prompts.js";
import { parseJsonObject } from "../schemas.js";

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

export class OllamaProvider implements AiProvider {
  id = "ollama" as const;
  model: string;

  constructor(model = getAiProviderConfig().models.ollama) {
    this.model = model;
  }

  isConfigured() {
    return isOllamaEnabled();
  }

  async generateText(request: AiCallRequest): Promise<AiCallResult<string>> {
    const baseUrl = this.isConfigured() ? getOllamaUrl() : null;
    if (!baseUrl) {
      return {
        status: "unavailable",
        content: null,
        provenance: createUnavailableProvenance([{ provider: this.id, model: this.model, status: "skipped", errorCode: "not_configured" }]),
        warnings: ["Ollama provider is disabled or SCIAI_OLLAMA_URL is not a local loopback address."],
      };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          stream: false,
          ...(request.responseFormat === "json" ? { format: "json" } : {}),
          options: {
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            num_predict: request.maxOutputTokens || 2048,
          },
        }),
        signal: AbortSignal.timeout(getOllamaTimeoutMs()),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new AiProviderError(
        timedOut
          ? `Ollama did not respond before the timeout. The local model "${this.model}" may be too slow for this request.`
          : `Ollama is not reachable at ${baseUrl}. Start Ollama and try again.`,
        timedOut ? "timeout" : "ollama_unreachable",
        true
      );
    }

    let body: OllamaGenerateResponse = {};
    try {
      body = (await response.json()) as OllamaGenerateResponse;
    } catch {
      // Leave body empty; handled below.
    }

    if (!response.ok) {
      if (response.status === 404 && /not found/i.test(body.error || "")) {
        throw new AiProviderError(
          `Ollama model "${this.model}" is not installed. Run: ollama pull ${this.model}`,
          "ollama_model_missing",
          true
        );
      }
      throw new AiProviderError("Ollama provider call failed", "provider_call_failed", response.status >= 500);
    }

    const text = body.response?.trim() || "";
    if (!text) throw new AiProviderError("Ollama returned an empty response", "empty_response", true);
    const attempts = [{ provider: this.id, model: this.model, status: "success" as const }];
    return {
      status: "available",
      content: text,
      provenance: createSuccessProvenance(this.id, this.model, attempts),
      warnings: [],
    };
  }

  async generateJson<T>(request: AiCallRequest): Promise<AiCallResult<T>> {
    const textResult = await this.generateText({
      ...request,
      prompt: `${request.prompt}\n\nReturn only valid JSON. Do not wrap it in markdown.`,
      responseFormat: "json",
    });
    if (textResult.status !== "available" || !textResult.content) return textResult as AiCallResult<T>;
    try {
      return { ...textResult, content: parseJsonObject(textResult.content) as T };
    } catch {
      throw new AiProviderError("Ollama returned malformed JSON", "malformed_json", true);
    }
  }
}
