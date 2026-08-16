import { useState, useEffect, useCallback } from "react";
import type { AiConfig, AiProvider } from "../lib/types";
import { PROVIDER_LABELS, providerNeedsKey, getProviderDefaults, getAllDefaultModels } from "../lib/aiConfig";
import Dialog from "./Dialog";
import { listModels, installModel, setActiveModel, removeModel, onDownloadProgress, type WhisperModelInfo, type DownloadProgressEvent } from "tauri-plugin-stt-api";

interface Props {
  open: boolean;
  config: AiConfig;
  onClose: () => void;
  onSave: (config: AiConfig) => void;
}

const PROVIDERS: AiProvider[] = ["lmstudio", "ollama", "llamacpp", "openai", "anthropic", "openrouter"];

export default function AiSettingsModal({ open, config, onClose, onSave }: Props) {
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);

  // Whisper model manager state
  const [whisperModels, setWhisperModels] = useState<WhisperModelInfo[]>([]);
  const [activeWhisperModel, setActiveWhisperModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const refreshModels = useCallback(async () => {
    try {
      const resp = await listModels();
      setWhisperModels(resp.models.filter(m => !m.advanced));
      setActiveWhisperModel(resp.active ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) refreshModels();
  }, [open, refreshModels]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onDownloadProgress((ev: DownloadProgressEvent) => {
      if (ev.status === "downloading" && ev.progress != null) {
        setDownloadProgress(ev.progress);
      }
      if (ev.status === "complete" || ev.status === "error") {
        setDownloading(null);
        setDownloadProgress(0);
        refreshModels();
      }
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [refreshModels]);

  function handleProviderChange(p: AiProvider) {
    setProvider(p);
    const defaults = getProviderDefaults(p);
    setBaseUrl(defaults.baseUrl);
    if (p === "lmstudio" || p === "ollama" || p === "llamacpp") {
      setApiKey("");
    }
    // Reset model if it was a default from the previous provider
    if (!model || getAllDefaultModels().includes(model)) {
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
            {provider === "llamacpp" && "llama.cpp server exposes OpenAI-compatible API. Load a model with --model first."}
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

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <label style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>
            Voice Model (Whisper)
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {whisperModels.map(m => {
              const isActive = m.id === activeWhisperModel;
              const isDownloading = downloading === m.id;
              return (
                <div key={m.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${isActive ? "var(--accent-info)" : "var(--hairline)"}`,
                  background: isActive ? "var(--accent-info-bg, rgba(59,130,246,0.06))" : "var(--paper)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: "var(--ink)" }}>
                      {m.displayName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>
                      {m.sizeMb} MB · {m.tier}
                    </div>
                  </div>
                  {isDownloading ? (
                    <div style={{ fontSize: 11, color: "var(--accent-info)", fontFamily: "var(--font-mono)" }}>
                      {downloadProgress}%
                    </div>
                  ) : m.installed ? (
                    isActive ? (
                      <span style={{ fontSize: 11, color: "var(--moss-deep)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={async () => { await setActiveModel(m.id); refreshModels(); }}
                        style={modelBtnStyle}
                      >
                        Select
                      </button>
                    )
                  ) : (
                    <button
                      onClick={async () => {
                        setDownloading(m.id);
                        setDownloadProgress(0);
                        await installModel(m.id);
                      }}
                      disabled={!!downloading}
                      style={{ ...modelBtnStyle, opacity: downloading ? 0.5 : 1 }}
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

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

const modelBtnStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--paper-raised)",
  color: "var(--ink)",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.1s",
};
