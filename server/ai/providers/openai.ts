import OpenAI from "openai";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderError } from "../types.js";
import { getAiProviderConfig } from "../config.js";
import { createSuccessProvenance, createUnavailableProvenance } from "../prompts.js";
import { parseJsonObject } from "../schemas.js";

let client: OpenAI | null = null;

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
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private getClient() {
    if (!this.isConfigured()) return null;
    if (!client) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
      const response = await openai.responses.create({
        model: this.model,
        input: request.prompt,
        temperature: request.temperature,
        max_output_tokens: request.maxOutputTokens || 2048,
      });
      const text = response.output_text?.trim() || "";
      if (!text) throw new AiProviderError("OpenAI returned an empty response", "empty_response", true);
      const attempts = [{ provider: this.id, model: this.model, status: "success" as const }];
      return {
        status: "available",
        content: text,
        provenance: createSuccessProvenance(this.id, this.model, attempts),
        warnings: [],
      };
    } catch (err) {
      throw new AiProviderError("OpenAI provider call failed", "provider_call_failed", isTransientProviderError(err));
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
