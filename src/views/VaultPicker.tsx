import { useState } from "react";
import { pickVaultFolder, bootstrapVault } from "../lib/bridge";
import { setLastVaultPath } from "../lib/appConfig";
import { Folder, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  onVaultReady: (path: string) => void;
}

export default function VaultPicker({ onVaultReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenPath, setChosenPath] = useState<string | null>(null);

  async function handleChoose() {
    setError(null);
    try {
      const path = await pickVaultFolder();
      if (!path) return;
      setChosenPath(path);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleConfirm() {
    if (!chosenPath) return;
    setBusy(true);
    setError(null);
    try {
      await bootstrapVault(chosenPath);
      setLastVaultPath(chosenPath);
      onVaultReady(chosenPath);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 800px 400px at 50% -10%, var(--moss-soft), transparent 60%), var(--paper)",
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 500, width: "100%" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "var(--moss)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Folder size={22} color="#fff" />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 600,
              margin: "0 0 8px",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Choose your vault
          </h1>
          <p
            style={{
              color: "var(--ink-soft)",
              lineHeight: 1.55,
              margin: 0,
              fontSize: 14.5,
            }}
          >
            Pick a folder on disk. TrackMe will create{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                background: "var(--paper-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              notes/
            </code>
            {", "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                background: "var(--paper-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              meetings/
            </code>
            {", "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                background: "var(--paper-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              todos/
            </code>{" "}
            inside it.
          </p>
        </div>

        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-lg)",
            background: "var(--paper-raised)",
            padding: "24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <button
            onClick={handleChoose}
            style={{
              width: "100%",
              padding: "11px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--paper-raised)",
              border: "1px solid var(--hairline-strong)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              transition: "background 0.12s, border-color 0.12s",
              fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--paper)";
              e.currentTarget.style.borderColor = "var(--hairline)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--paper-raised)";
              e.currentTarget.style.borderColor = "var(--hairline-strong)";
            }}
          >
            <Folder size={15} />
            {chosenPath ? "Choose a different folder" : "Select folder…"}
          </button>

          {chosenPath && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--moss-deep)",
                background: "var(--moss-soft)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                border: "1px solid var(--moss-soft)",
                animation: "fade-in 0.2s ease",
              }}
            >
              <CheckCircle size={14} style={{ flexShrink: 0, color: "var(--moss)" }} />
              <span style={{ wordBreak: "break-all" }}>{chosenPath}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                color: "var(--danger)",
                fontSize: 13,
                background: "var(--clay-soft)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                border: "1px solid var(--clay-soft)",
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!chosenPath || busy}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: !chosenPath || busy ? "var(--hairline-strong)" : "var(--moss)",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: !chosenPath || busy ? "not-allowed" : "pointer",
              transition: "background 0.12s, transform 0.12s",
              fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => {
              if (chosenPath && !busy) {
                e.currentTarget.style.background = "var(--moss-deep)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !chosenPath || busy ? "var(--hairline-strong)" : "var(--moss)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {busy ? "Setting up…" : "Use this vault →"}
          </button>
        </div>
      </div>
    </div>
  );
}
