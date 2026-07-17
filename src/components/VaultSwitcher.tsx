import { useEffect, useState } from "react";
import { Folder, Plus, Trash2, Check } from "lucide-react";
import Dialog from "./Dialog";
import { pickVaultFolder, bootstrapVault } from "../lib/bridge";
import { getVaults, addVault, removeVault, setLastActiveVault } from "../lib/appConfig";

interface Props {
  open: boolean;
  currentVault: string;
  onClose: () => void;
  onVaultSwitch: (path: string) => void;
}

export default function VaultSwitcher({ open, currentVault, onClose, onVaultSwitch }: Props) {
  const [vaults, setVaults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVaults(getVaults());
      setError(null);
    }
  }, [open]);

  function vaultName(path: string): string {
    return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
  }

  async function handleAddVault() {
    setError(null);
    try {
      const path = await pickVaultFolder();
      if (!path) return;
      setBusy(true);
      await bootstrapVault(path);
      addVault(path);
      setVaults(getVaults());
      setLastActiveVault(path);
      onVaultSwitch(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveVault(path: string) {
    removeVault(path);
    setVaults(getVaults());
  }

  function handleSwitch(path: string) {
    setLastActiveVault(path);
    onVaultSwitch(path);
    onClose();
  }

  return (
    <Dialog open={open} title="Switch Vault" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {vaults.map((v) => {
          const isCurrent = v === currentVault;
          return (
            <div
              key={v}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid",
                borderColor: isCurrent ? "var(--moss)" : "var(--hairline)",
                background: isCurrent ? "var(--moss-soft)" : "var(--paper)",
                cursor: isCurrent ? "default" : "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.borderColor = "var(--hairline-strong)";
                  e.currentTarget.style.background = "var(--paper-raised)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.borderColor = "var(--hairline)";
                  e.currentTarget.style.background = "var(--paper)";
                }
              }}
              onClick={() => !isCurrent && handleSwitch(v)}
            >
              <Folder
                size={16}
                style={{ color: isCurrent ? "var(--moss)" : "var(--ink-soft)", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: isCurrent ? 600 : 500,
                    color: "var(--ink)",
                  }}
                >
                  {vaultName(v)}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink-soft)",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={v}
                >
                  {v}
                </div>
              </div>
              {isCurrent ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--moss)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <Check size={12} /> Current
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveVault(v);
                  }}
                  title="Remove vault"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "color 0.15s ease, background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--danger)";
                    e.currentTarget.style.background = "var(--paper-raised)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--ink-soft)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}

        {vaults.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "var(--ink-soft)",
              fontSize: 13.5,
            }}
          >
            No vaults saved yet. Add one below.
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleAddVault}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          marginTop: 14,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          background: "var(--paper)",
          border: "1px dashed var(--hairline-strong)",
          borderRadius: "var(--radius-md)",
          cursor: busy ? "not-allowed" : "pointer",
          transition: "border-color 0.15s ease, background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!busy) {
            e.currentTarget.style.borderColor = "var(--moss)";
            e.currentTarget.style.background = "var(--moss-soft)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--hairline-strong)";
          e.currentTarget.style.background = "var(--paper)";
        }}
      >
        <Plus size={14} />
        {busy ? "Setting up…" : "Add vault"}
      </button>
    </Dialog>
  );
}
