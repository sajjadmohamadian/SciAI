import OpenAI from "openai";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderError } from "../types.js";
import { getAiProviderConfig } from "../config.js";
import { createSuccessProvenance, createUnavailableProvenance } from "../prompts.js";
import { parseJsonObject } from "../schemas.js";

let client: OpenAI | null = null;
let cachedSignature: string | null = null;

const isTransientProviderError = (err: unknown) => {
  const text = String(err).toLowerCase();
  return ["429", "500", "502", "503", "504", "rate", "timeout", "temporarily"].some((needle) => text.includes(needle));
};

export class OpenAiProvider implements AiProvider {
  id = "openai" as const;
  model: string;

  constructor(model = getAiProviderConfig().models.openai) {
    this.model = model;
  }

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private getClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    const baseURL = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "").trim() || undefined;
    const signature = `${apiKey}::${baseURL || "default"}`;

    if (!client || cachedSignature !== signature) {
      client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "SciAI Research Intelligence",
        },
      });
      cachedSignature = signature;
    }
    return client;
  }

  async generateText(request: AiCallRequest): Promise<AiCallResult<string>> {
    const openai = this.getClient();
    if (!openai) {
      return {
        status: "unavailable",
        content: null,
        provenance: createUnavailableProvenance([{ provider: this.id, model: this.model, status: "skipped", errorCode: "not_configured" }]),
        warnings: ["OpenAI provider is not configured."],
      };
    }

    try {
      const isReasoningModel = /^(o1|o3|o4|gpt-5)/i.test(this.model.trim());
      const tokenBudget = Math.max(request.maxOutputTokens || 2048, isReasoningModel ? 8192 : 4096);

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: request.prompt }],
        ...(isReasoningModel ? {} : { temperature: request.temperature }),
        max_completion_tokens: tokenBudget,
      });

      const choice = response.choices?.[0];
      const text = choice?.message?.content?.trim() || "";
      if (!text) {
        const reason = choice?.finish_reason || "unknown";
        const refusal = (choice?.message as any)?.refusal || "";
        throw new AiProviderError(
          `OpenAI returned an empty response (model=${this.model}, finish_reason=${reason}${refusal ? `, refusal=${refusal}` : ""})`,
          "empty_response",
          true
        );
      }
      const attempts = [{ provider: this.id, model: this.model, status: "success" as const }];
      return {
        status: "available",
        content: text,
        provenance: createSuccessProvenance(this.id, this.model, attempts),
        warnings: [],
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[OpenAiProvider] Call failed:", detail);
      throw new AiProviderError(`OpenAI provider call failed: ${detail}`, "provider_call_failed", isTransientProviderError(err));
    }
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
      throw new AiProviderError("OpenAI returned malformed JSON", "malformed_json", true);
    }
  }
}