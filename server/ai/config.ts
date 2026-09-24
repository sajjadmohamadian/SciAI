import { AiProviderId } from "./types.js";

const PROVIDERS: AiProviderId[] = ["gemini", "claude", "openai"];

const DEFAULT_MODELS: Record<AiProviderId, string> = {
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

export function parseProviderOrder(raw = process.env.SCIAI_AI_PROVIDER_ORDER): AiProviderId[] {
  const parsed = (raw || "gemini,claude,openai")
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
      gemini: process.env.SCIAI_GEMINI_MODEL || DEFAULT_MODELS.gemini,
      claude: process.env.SCIAI_CLAUDE_MODEL || DEFAULT_MODELS.claude,
      openai: process.env.SCIAI_OPENAI_MODEL || DEFAULT_MODELS.openai,
    },
    configured: {
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
      gemini: { configured: config.configured.gemini, model: config.models.gemini },
      claude: { configured: config.configured.claude, model: config.models.claude },
      openai: { configured: config.configured.openai, model: config.models.openai },
    },
  };
}
