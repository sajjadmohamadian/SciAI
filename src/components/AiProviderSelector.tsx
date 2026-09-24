import { Cpu, ShieldCheck } from "lucide-react";
import { useAiProvider, type AiProviderChoice } from "../context/AiProviderContext.js";

const PROVIDER_LABELS: Record<AiProviderChoice, string> = {
  default: "Server default",
  gemini: "Gemini",
  claude: "Claude",
  openai: "OpenAI",
};

export function AiProviderSelector() {
  const { selectedProvider, allowFallback, setSelectedProvider, setAllowFallback } = useAiProvider();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 shadow-2xs">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        <label htmlFor="ai-provider" className="text-[11px] font-bold uppercase text-indigo-900">
          AI provider
        </label>
        <select
          id="ai-provider"
          value={selectedProvider}
          onChange={(event) => setSelectedProvider(event.target.value as AiProviderChoice)}
          className="cursor-pointer rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          {(Object.keys(PROVIDER_LABELS) as AiProviderChoice[]).map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={allowFallback}
          onChange={(event) => setAllowFallback(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
        />
        Allow fallback
      </label>
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500" title="Provider keys remain on the server">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Server-managed keys
      </span>
    </div>
  );
}
