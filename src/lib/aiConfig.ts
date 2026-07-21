import type { AiConfig, AiProvider } from "./types";

const AI_CONFIG_KEY = "trackme.aiConfig";

const PROVIDER_DEFAULTS: Record<AiProvider, { model: string; baseUrl: string; needsKey: boolean }> = {
  lmstudio: { model: "", baseUrl: "http://localhost:1234/v1", needsKey: false },
  openai: { model: "gpt-4o", baseUrl: "https://api.openai.com/v1", needsKey: true },
  anthropic: { model: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com", needsKey: true },
  ollama: { model: "", baseUrl: "http://localhost:11434/v1", needsKey: false },
  openrouter: { model: "", baseUrl: "https://openrouter.ai/api/v1", needsKey: true },
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  lmstudio: "LM Studio",
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

export function getProviderDefaults(provider: AiProvider) {
  return PROVIDER_DEFAULTS[provider];
}

export function providerNeedsKey(provider: AiProvider): boolean {
  return PROVIDER_DEFAULTS[provider].needsKey;
}

const DEFAULT_CONFIG: AiConfig = {
  provider: "lmstudio",
  model: "",
  apiKey: "",
  baseUrl: "http://localhost:1234/v1",
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function saveAiConfig(config: AiConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function isAiConfigured(config: AiConfig): boolean {
  if (!config.model) return false;
  if (providerNeedsKey(config.provider) && !config.apiKey) return false;
  return true;
}
