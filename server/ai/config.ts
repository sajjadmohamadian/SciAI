import { AiProviderId } from "./types.js";

const PROVIDERS: AiProviderId[] = ["ollama", "gemini", "claude", "openai"];

const DEFAULT_MODELS: Record<AiProviderId, string> = {
  ollama: "qwen2.5:7b-instruct",
  gemini: "gemini-flash-latest",
  claude: "claude-opus-5",
  openai: "gpt-4.1-mini",
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === "") return fallback;
  return value === "true";
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export function getOllamaUrl(): string | null {
  try {
    const url = new URL(process.env.SCIAI_OLLAMA_URL || DEFAULT_OLLAMA_URL);
    if (url.protocol !== "http:" || url.username || url.password ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Ollama needs no API key; it is used whenever it is not disabled and its URL is a local loopback address.
export function isOllamaEnabled(): boolean {
  return parseBoolean(process.env.SCIAI_OLLAMA_ENABLED, true) && getOllamaUrl() !== null;
}

export function getOllamaTimeoutMs(): number {
  return parsePositiveInteger(process.env.SCIAI_OLLAMA_TIMEOUT_MS, 300000);
}

export function parseProviderOrder(raw = process.env.SCIAI_AI_PROVIDER_ORDER): AiProviderId[] {
  const parsed = (raw || "ollama,gemini,claude,openai")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is AiProviderId => isAiProviderId(entry));

  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique : [...PROVIDERS];
}

export interface AiProviderConfig {
  defaultProvider: AiProviderId;
  providerOrder: AiProviderId[];
  allowFallback: boolean;
  timeoutMs: number;
  maxRetries: number;
  logPrompts: boolean;
  models: Record<AiProviderId, string>;
  configured: Record<AiProviderId, boolean>;
}

export function getAiProviderConfig(): AiProviderConfig {
  const providerOrder = parseProviderOrder();
  const defaultProvider = isAiProviderId((process.env.SCIAI_AI_DEFAULT_PROVIDER || "").toLowerCase())
    ? (process.env.SCIAI_AI_DEFAULT_PROVIDER!.toLowerCase() as AiProviderId)
    : providerOrder[0];

  return {
    defaultProvider,
    providerOrder,
    allowFallback: parseBoolean(process.env.SCIAI_AI_ALLOW_FALLBACK, true),
    timeoutMs: parsePositiveInteger(process.env.SCIAI_AI_TIMEOUT_MS, 30000),
    maxRetries: parsePositiveInteger(process.env.SCIAI_AI_MAX_RETRIES, 2),
    logPrompts: parseBoolean(process.env.SCIAI_AI_LOG_PROMPTS, false),
    models: {
      ollama: process.env.SCIAI_OLLAMA_MODEL || DEFAULT_MODELS.ollama,
      gemini: process.env.SCIAI_GEMINI_MODEL || DEFAULT_MODELS.gemini,
      claude: process.env.SCIAI_CLAUDE_MODEL || DEFAULT_MODELS.claude,
      openai: process.env.SCIAI_OPENAI_MODEL || DEFAULT_MODELS.openai,
    },
    configured: {
      ollama: isOllamaEnabled(),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
  };
}

export function getAiProviderPublicStatus() {
  const config = getAiProviderConfig();
  return {
    defaultProvider: config.defaultProvider,
    providerOrder: config.providerOrder,
    allowFallback: config.allowFallback,
    providers: {
      ollama: { configured: config.configured.ollama, model: config.models.ollama },
      gemini: { configured: config.configured.gemini, model: config.models.gemini },
      claude: { configured: config.configured.claude, model: config.models.claude },
      openai: { configured: config.configured.openai, model: config.models.openai },
    },
  };
}
