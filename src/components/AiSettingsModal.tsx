import { useState } from "react";
import type { AiConfig, AiProvider } from "../lib/types";
import { PROVIDER_LABELS, providerNeedsKey, getProviderDefaults } from "../lib/aiConfig";
import Dialog from "./Dialog";

interface Props {
  open: boolean;
  config: AiConfig;
  onClose: () => void;
  onSave: (config: AiConfig) => void;
}

const PROVIDERS: AiProvider[] = ["lmstudio", "ollama", "openai", "anthropic", "openrouter"];

export default function AiSettingsModal({ open, config, onClose, onSave }: Props) {
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);

  function handleProviderChange(p: AiProvider) {
    setProvider(p);
    const defaults = getProviderDefaults(p);
    setBaseUrl(defaults.baseUrl);
    if (p === "lmstudio" || p === "ollama") {
      setApiKey("");
    }
    if (!model || PROVIDER_DEFAULTS_HAVE.includes(model)) {
      setModel(defaults.model);
    }
  }

  function handleSave() {
    onSave({ provider, model, apiKey, baseUrl });
    onClose();
  }

  const needsKey = providerNeedsKey(provider);

  return (
    <Dialog
      open={open}
      title="AI Settings"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--hairline-strong)",
              background: "var(--paper-raised)",
              borderRadius: "var(--radius-sm)",
              padding: "7px 14px",
              fontSize: 13,
              cursor: "pointer",
              color: "var(--ink-soft)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!model.trim()}
            style={{
              border: "none",
              background: "var(--slate)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              padding: "7px 14px",
              fontSize: 13,
              cursor: model.trim() ? "pointer" : "not-allowed",
              opacity: model.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Provider</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            style={selectStyle}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Model</label>
          <input
            autoFocus
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={getProviderDefaults(provider).model || "e.g. local-model"}
            style={inputStyle}
          />
          <div style={hintStyle}>
            {provider === "lmstudio" && "LM Studio uses OpenAI-compatible API. Load a model in LM Studio first."}
            {provider === "ollama" && "Ollama exposes an OpenAI-compatible API. Pull a model with 'ollama pull' first."}
            {provider === "openai" && "e.g. gpt-4o, gpt-4o-mini, gpt-3.5-turbo"}
            {provider === "anthropic" && "e.g. claude-sonnet-4-20250514, claude-3-haiku-20240307"}
            {provider === "openrouter" && "Browse models at openrouter.ai/models"}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={getProviderDefaults(provider).baseUrl}
            style={inputStyle}
          />
        </div>

        {needsKey && (
          <div>
            <label style={labelStyle}>API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="sk-..."
              style={inputStyle}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}

const PROVIDER_DEFAULTS_HAVE = ["gpt-4o", "claude-sonnet-4-20250514", ""];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--ink-soft)",
  marginBottom: 5,
  fontFamily: "var(--font-body)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  padding: "8px 10px",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--radius-sm)",
  outline: "none",
  boxSizing: "border-box",
  background: "var(--paper-raised)",
  color: "var(--ink)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  padding: "8px 10px",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--radius-sm)",
  outline: "none",
  background: "var(--paper-raised)",
  color: "var(--ink)",
};

const hintStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11.5,
  color: "var(--ink-soft)",
  fontFamily: "var(--font-mono)",
};
