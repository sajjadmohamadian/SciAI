import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { getAiProviderConfig, getAiProviderPublicStatus, parseProviderOrder } from "../server/ai/config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("AI provider configuration", () => {
  test("parses provider order and filters invalid entries", () => {
    assert.deepEqual(parseProviderOrder("openai,invalid,claude,openai,gemini"), ["openai", "claude", "gemini"]);
    assert.deepEqual(parseProviderOrder("invalid"), ["ollama", "gemini", "claude", "openai"]);
  });

  test("reports unconfigured providers without exposing secret values", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const config = getAiProviderConfig();
    assert.equal(config.configured.gemini, false);
    assert.equal(config.configured.claude, false);
    assert.equal(config.configured.openai, false);

    const publicStatus = getAiProviderPublicStatus();
    const serialized = JSON.stringify(publicStatus);
    assert(!serialized.includes("GEMINI_API_KEY"));
    assert(!serialized.includes("ANTHROPIC_API_KEY"));
    assert(!serialized.includes("OPENAI_API_KEY"));
  });

  test("uses configured default provider and model overrides", () => {
    process.env.SCIAI_AI_DEFAULT_PROVIDER = "openai";
    process.env.SCIAI_OPENAI_MODEL = "custom-openai-model";
    process.env.OPENAI_API_KEY = "secret-openai-key";

    const config = getAiProviderConfig();
    assert.equal(config.defaultProvider, "openai");
    assert.equal(config.models.openai, "custom-openai-model");
    assert.equal(config.configured.openai, true);

    const serialized = JSON.stringify(getAiProviderPublicStatus());
    assert(!serialized.includes("secret-openai-key"));
  });
});
