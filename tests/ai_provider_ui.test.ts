import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildAiRequestOptions } from "../src/context/AiProviderContext.tsx";

describe("AI provider UI request options", () => {
  test("delegates to the server default without an explicit provider", () => {
    assert.deepEqual(buildAiRequestOptions("default", true), { fallback: true });
  });

  test("serializes the selected provider and fallback preference", () => {
    assert.deepEqual(buildAiRequestOptions("claude", false), {
      provider: "claude",
      fallback: false,
    });
    assert.deepEqual(buildAiRequestOptions("openai", true), {
      provider: "openai",
      fallback: true,
    });
  });
});
