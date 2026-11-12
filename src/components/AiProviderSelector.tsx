import { Cpu, ShieldCheck } from "lucide-react";
import {
  useAiProvider,
  type AiProviderChoice,
} from "../context/AiProviderContext.js";

const PROVIDER_LABELS: Record<AiProviderChoice, string> = {
  default: "Server default",
  ollama: "Ollama (local)",
  gemini: "Gemini",
  claude: "Claude",
  openai: "OpenAI",
};

export function AiProviderSelector() {
  const {
    selectedProvider,
    allowFallback,
    setSelectedProvider,
    setAllowFallback,
  } = useAiProvider();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 shadow-card">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-brand-500" aria-hidden="true" />
        <label
          htmlFor="ai-provider"
          className="sciai-kicker text-[11px]! text-brand-700!"
        >
          AI provider
        </label>
        <select
          id="ai-provider"
          value={selectedProvider}
          onChange={(event) =>
            setSelectedProvider(event.target.value as AiProviderChoice)
          }
          className="cursor-pointer rounded-lg border border-border-default bg-surface-canvas px-2 py-1 text-xs font-bold text-ink-primary focus:border-brand-500 focus:outline-none"
        >
          {(Object.keys(PROVIDER_LABELS) as AiProviderChoice[]).map(
            (provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider]}
              </option>
            )
          )}
        </select>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
        <input
          type="checkbox"
          checked={allowFallback}
          onChange={(event) => setAllowFallback(event.target.checked)}
          className="h-3.5 w-3.5 rounded accent-brand-500"
        />
        Allow fallback
      </label>
      <span
        className="inline-flex items-center gap-1 text-[10px] text-ink-muted"
        title="Ollama configuration and optional cloud keys remain on the server"
      >
        <ShieldCheck
          className="h-3.5 w-3.5 text-status-success-text"
          aria-hidden="true"
        />
        Server-managed configuration
      </span>
    </div>
  );
}