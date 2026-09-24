import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AiProviderChoice = "default" | "gemini" | "claude" | "openai";

export interface AiRequestOptions {
  provider?: Exclude<AiProviderChoice, "default">;
  fallback: boolean;
}

interface AiProviderContextValue {
  selectedProvider: AiProviderChoice;
  allowFallback: boolean;
  setSelectedProvider: (provider: AiProviderChoice) => void;
  setAllowFallback: (allow: boolean) => void;
  getAiRequestOptions: () => AiRequestOptions;
}

const AiProviderContext = createContext<AiProviderContextValue | null>(null);

export function AiProviderProvider({ children }: { children: ReactNode }) {
  const [selectedProvider, setSelectedProvider] = useState<AiProviderChoice>("default");
  const [allowFallback, setAllowFallback] = useState(true);

  const value = useMemo<AiProviderContextValue>(
    () => ({
      selectedProvider,
      allowFallback,
      setSelectedProvider,
      setAllowFallback,
      getAiRequestOptions: () => ({
        ...(selectedProvider === "default" ? {} : { provider: selectedProvider }),
        fallback: allowFallback,
      }),
    }),
    [selectedProvider, allowFallback]
  );

  return <AiProviderContext.Provider value={value}>{children}</AiProviderContext.Provider>;
}

export function useAiProvider() {
  const context = useContext(AiProviderContext);
  if (!context) {
    throw new Error("useAiProvider must be used inside AiProviderProvider");
  }
  return context;
}

export function buildAiRequestOptions(
  selectedProvider: AiProviderChoice,
  allowFallback: boolean
): AiRequestOptions {
  return {
    ...(selectedProvider === "default" ? {} : { provider: selectedProvider }),
    fallback: allowFallback,
  };
}
