import Anthropic from "@anthropic-ai/sdk";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderError } from "../types.js";
import { getAiProviderConfig } from "../config.js";
import { createSuccessProvenance, createUnavailableProvenance } from "../prompts.js";
import { parseJsonObject } from "../schemas.js";

let client: Anthropic | null = null;

const isTransientProviderError = (err: unknown) => {
  const text = String(err).toLowerCase();
  return ["429", "500", "502", "503", "504", "rate", "overloaded", "timeout", "temporarily"].some((needle) => text.includes(needle));
};

export class ClaudeProvider implements AiProvider {
  id = "claude" as const;
  model: string;

  constructor(model = getAiProviderConfig().models.claude) {
    this.model = model;
  }

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient() {
    if (!this.isConfigured()) return null;
    if (!client) {
      client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return client;
  }

  async generateText(request: AiCallRequest): Promise<AiCallResult<string>> {
    const anthropic = this.getClient();
    if (!anthropic) {
      return {
        status: "unavailable",
        content: null,
        provenance: createUnavailableProvenance([{ provider: this.id, model: this.model, status: "skipped", errorCode: "not_configured" }]),
        warnings: ["Claude provider is not configured."],
      };
    }

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: request.maxOutputTokens || 2048,
        temperature: request.temperature,
        messages: [{ role: "user", content: request.prompt }],
      });
      const text = response.content
        .map((block: any) => (block?.type === "text" ? block.text : ""))
        .join("\n")
        .trim();
      if (!text) throw new AiProviderError("Claude returned an empty response", "empty_response", true);
      const attempts = [{ provider: this.id, model: this.model, status: "success" as const }];
      return {
        status: "available",
        content: text,
        provenance: createSuccessProvenance(this.id, this.model, attempts),
        warnings: [],
      };
    } catch (err) {
      throw new AiProviderError("Claude provider call failed", "provider_call_failed", isTransientProviderError(err));
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
      throw new AiProviderError("Claude returned malformed JSON", "malformed_json", true);
    }
  }
}
