import { useCallback, useEffect, useState } from "react";
import Dialog from "../components/Dialog";
import {
  listTrash,
  permanentDeleteTrash,
  restoreTrash,
} from "../lib/bridge";
import type { TrashEntry } from "../lib/types";
import { RotateCcw, Trash2, FileText, Folder } from "lucide-react";

interface Props {
  vaultPath: string;
}

export default function TrashView({ vaultPath }: Props) {
  const [items, setItems] = useState<TrashEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<TrashEntry | null>(null);

  const refresh = useCallback(async () => {
    const entries = await listTrash(vaultPath);
    // Sort by deleted_at descending (most recent first)
    entries.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    setItems(entries);
  }, [vaultPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRestore(item: TrashEntry) {
    await restoreTrash(vaultPath, item.trash_path);
    await refresh();
  }

  async function handlePermanentDelete(item: TrashEntry) {
    await permanentDeleteTrash(vaultPath, item.trash_path);
    setConfirmDelete(null);
    await refresh();
  }

  function formatDeletedAt(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function originLabel(originalPath: string): string {
    const parts = originalPath.split("/");
    return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header
        style={{
          padding: "16px 28px 12px",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Trash
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            {items.length === 0
              ? "Trash is empty"
              : `${items.length} item${items.length === 1 ? "" : "s"} — items are permanently deleted on app close`}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 28px" }}>
        {items.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--ink-soft)",
              fontSize: 14,
              gap: 8,
            }}
          >
            <Trash2 size={32} style={{ opacity: 0.3 }} />
            <span>Nothing in the trash</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((item) => (
              <div
                key={item.trash_path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  transition: "background 0.15s ease",
                }}
                className="trash-row"
              >
                <div
                  style={{
                    color: "var(--ink-soft)",
                    flexShrink: 0,
                  }}
                >
                  {item.is_dir ? <Folder size={16} /> : <FileText size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11.5,
                      color: "var(--ink-soft)",
                      marginTop: 1,
                    }}
                  >
                    {originLabel(item.original_path)} · deleted {formatDeletedAt(item.deleted_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(item)}
                  title="Restore to original location"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid var(--hairline-strong)",
                    background: "var(--paper-raised)",
                    borderRadius: "var(--radius-sm)",
                    padding: "5px 10px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
                <button
                  onClick={() => setConfirmDelete(item)}
                  title="Permanently delete"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "none",
                    background: "none",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                    padding: 4,
                    opacity: 0.5,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={confirmDelete !== null}
        title="Permanently delete?"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <button
              onClick={() => setConfirmDelete(null)}
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
              onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)}
              style={{
                border: "none",
                background: "#ff3b30",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Delete forever
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          &ldquo;{confirmDelete?.name}&rdquo; will be permanently removed. This cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}
