import { useState } from "react";
import { pickVaultFolder, bootstrapVault } from "../lib/bridge";
import { setLastVaultPath } from "../lib/appConfig";

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
        background: "var(--paper)",
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 600,
            margin: "0 0 10px",
          }}
        >
          Choose your vault
        </h1>
        <p style={{ color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 28 }}>
          Pick a folder on disk. TrackMe will create{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            notes/, meetings/, todos/
          </code>{" "}
          inside it if they don't already exist. Nothing outside this folder is
          touched.
        </p>

        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-lg)",
            background: "var(--paper-raised)",
            padding: 24,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <button
            onClick={handleChoose}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              background: "#fff",
              border: "1px solid var(--hairline-strong)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
          >
            {chosenPath ? "Choose a different folder" : "Select folder…"}
          </button>

          {chosenPath && (
            <div
              style={{
                marginTop: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                color: "var(--moss-deep)",
                background: "var(--moss-soft)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                wordBreak: "break-all",
              }}
            >
              {chosenPath}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, color: "var(--danger)", fontSize: 13.5 }}>
              Couldn't set up that folder: {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!chosenPath || busy}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: !chosenPath || busy ? "var(--hairline-strong)" : "var(--moss)",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: !chosenPath || busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Setting up…" : "Use this vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
