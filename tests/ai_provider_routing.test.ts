import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { callAiJson, callAiText, normalizeProviderPreference } from "../server/ai/router.js";
import { AiCallRequest, AiCallResult, AiProvider, AiProviderError, AiProviderId } from "../server/ai/types.js";
import { createSuccessProvenance } from "../server/ai/prompts.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

class MockProvider implements AiProvider {
  id: AiProviderId;
  model: string;
  configured: boolean;
  result: string;
  shouldThrow: AiProviderError | null;

  constructor(id: AiProviderId, options: { configured?: boolean; result?: string; shouldThrow?: AiProviderError | null } = {}) {
    this.id = id;
    this.model = `${id}-model`;
    this.configured = options.configured ?? true;
    this.result = options.result ?? `${id} result`;
    this.shouldThrow = options.shouldThrow ?? null;
  }

  isConfigured() {
    return this.configured;
  }

  async generateText(_request: AiCallRequest): Promise<AiCallResult<string>> {
    if (this.shouldThrow) throw this.shouldThrow;
    return {
      status: "available",
      content: this.result,
      provenance: createSuccessProvenance(this.id, this.model, [{ provider: this.id, model: this.model, status: "success" }]),
      warnings: [],
    };
  }

  async generateJson<T>(_request: AiCallRequest): Promise<AiCallResult<T>> {
    if (this.shouldThrow) throw this.shouldThrow;
    return {
      status: "available",
      content: JSON.parse(this.result) as T,
      provenance: createSuccessProvenance(this.id, this.model, [{ provider: this.id, model: this.model, status: "success" }]),
      warnings: [],
    };
  }
}

const makeProviders = (overrides: Partial<Record<AiProviderId, AiProvider>> = {}): Record<AiProviderId, AiProvider> => ({
  ollama: new MockProvider("ollama", { configured: false }),
  gemini: new MockProvider("gemini", { configured: false }),
  claude: new MockProvider("claude", { configured: false }),
  openai: new MockProvider("openai", { configured: false }),
  ...overrides,
});

describe("AI provider routing", () => {
  test("rejects invalid provider preference", () => {
    assert.throws(() => normalizeProviderPreference("bad-provider"), /Invalid AI provider/);
  });

  test("selects explicit configured provider", async () => {
    process.env.SCIAI_AI_ALLOW_FALLBACK = "true";
    const result = await callAiText(
      { task: "rag_chat", prompt: "hello", responseFormat: "text", preferredProvider: "claude" },
      makeProviders({ claude: new MockProvider("claude", { result: "claude ok" }) })
    );
    assert.equal(result.status, "available");
    assert.equal(result.content, "claude ok");
    assert.equal(result.provenance.provider, "claude");
  });

  test("falls back after transient provider failure", async () => {
    process.env.SCIAI_AI_PROVIDER_ORDER = "gemini,claude,openai";
    process.env.SCIAI_AI_ALLOW_FALLBACK = "true";
    const result = await callAiText(
      { task: "rag_chat", prompt: "hello", responseFormat: "text" },
      makeProviders({
        gemini: new MockProvider("gemini", { shouldThrow: new AiProviderError("rate limited", "rate_limited", true) }),
        claude: new MockProvider("claude", { result: "fallback ok" }),
      })
    );
    assert.equal(result.status, "available");
    assert.equal(result.content, "fallback ok");
    assert.equal(result.provenance.provider, "claude");
    assert.equal(result.provenance.attemptedProviders[0].status, "failed");
  });

  test("does not fallback when fallback is disabled", async () => {
    const result = await callAiText(
      { task: "rag_chat", prompt: "hello", responseFormat: "text", preferredProvider: "gemini", allowFallback: false },
      makeProviders({
        gemini: new MockProvider("gemini", { shouldThrow: new AiProviderError("rate limited", "rate_limited", true) }),
        claude: new MockProvider("claude", { result: "should not run" }),
      })
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.provenance.provider, "unavailable");
    assert.equal(result.provenance.attemptedProviders.length, 1);
  });

  test("returns unavailable when no providers are configured", async () => {
    const result = await callAiText(
      { task: "interpretation", prompt: "x", responseFormat: "text" },
      makeProviders()
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.content, null);
    assert(result.provenance.attemptedProviders.every((attempt) => attempt.status === "skipped"));
  });

  test("JSON calls return parsed provider content", async () => {
    const result = await callAiJson<{ ok: boolean }>(
      { task: "prisma_report", prompt: "x", responseFormat: "json", preferredProvider: "openai" },
      makeProviders({ openai: new MockProvider("openai", { result: '{"ok":true}' }) })
    );
    assert.equal(result.status, "available");
    assert.equal(result.content?.ok, true);
  });
});
