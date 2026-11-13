import { GoogleGenAI } from "@google/genai";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderError } from "../types.js";
import { getAiProviderConfig } from "../config.js";
import { createSuccessProvenance, createUnavailableProvenance } from "../prompts.js";
import { parseJsonObject } from "../schemas.js";

let client: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

const isTransientProviderError = (err: unknown) => {
  const text = String(err).toLowerCase();
  return ["503", "429", "unavailable", "resourceexhausted", "temporarily unavailable", "high demand", "spikes in demand"].some((needle) => text.includes(needle));
};

export class GeminiProvider implements AiProvider {
  id = "gemini" as const;
  model: string;

  constructor(model = getAiProviderConfig().models.gemini) {
    this.model = model;
  }

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  private getClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;
    if (!client || cachedApiKey !== apiKey) {
      client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "SciAI" } },
      });
      cachedApiKey = apiKey;
    }
    return client;
  }

  async generateText(request: AiCallRequest): Promise<AiCallResult<string>> {
    const genai = this.getClient();
    if (!genai) {
      return {
        status: "unavailable",
        content: null,
        provenance: createUnavailableProvenance([{ provider: this.id, model: this.model, status: "skipped", errorCode: "not_configured" }]),
        warnings: ["Gemini provider is not configured."],
      };
    }

    try {
      const response = await genai.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: {
          temperature: request.temperature,
          ...(request.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
        },
      });
      const text = response.text?.trim() || "";
      if (!text) throw new AiProviderError("Gemini returned an empty response", "empty_response", true);
      const attempts = [{ provider: this.id, model: this.model, status: "success" as const }];
      return {
        status: "available",
        content: text,
        provenance: createSuccessProvenance(this.id, this.model, attempts),
        warnings: [],
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[GeminiProvider] Call failed:", detail);
      throw new AiProviderError(`Gemini provider call failed: ${detail}`, "provider_call_failed", isTransientProviderError(err));
    }
  }

  async generateJson<T>(request: AiCallRequest): Promise<AiCallResult<T>> {
    const textResult = await this.generateText({ ...request, responseFormat: "json" });
    if (textResult.status !== "available" || !textResult.content) return textResult as AiCallResult<T>;
    try {
      return { ...textResult, content: parseJsonObject(textResult.content) as T };
    } catch {
      throw new AiProviderError("Gemini returned malformed JSON", "malformed_json", true);
    }
  }
}