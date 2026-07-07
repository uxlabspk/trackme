import { Trash2 } from "lucide-react";
import type { VaultEntry } from "../lib/types";

interface Props {
  entries: VaultEntry[];
  selectedRelPath: string | null;
  onSelect: (relPath: string) => void;
  emptyLabel?: string;
  depth?: number;
  selectedFolderRelPath?: string | null;
  onSelectFolder?: (relPath: string) => void;
  onDeleteFolder?: (relPath: string) => void;
}

export default function FileTreeList({
  entries,
  selectedRelPath,
  onSelect,
  emptyLabel = "No files yet",
  depth = 0,
  selectedFolderRelPath = null,
  onSelectFolder,
  onDeleteFolder,
}: Props) {
  if (entries.length === 0 && depth === 0) {
    return (
      <div
        style={{
          padding: "16px 14px",
          fontSize: 13,
          color: "var(--ink-soft)",
          fontStyle: "italic",
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.rel_path}>
          {entry.is_dir ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: `${14 + depth * 12}px`,
                  borderLeft:
                    selectedFolderRelPath === entry.rel_path
                      ? "2px solid var(--moss)"
                      : "2px solid transparent",
                  background:
                    selectedFolderRelPath === entry.rel_path
                      ? "var(--paper-raised)"
                      : "transparent",
                }}
              >
                <button
                  onClick={() => onSelectFolder?.(entry.rel_path)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink-soft)",
                    padding: "8px 6px 4px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    border: "none",
                    background: "transparent",
                    cursor: onSelectFolder ? "pointer" : "default",
                    fontWeight: selectedFolderRelPath === entry.rel_path ? 700 : 400,
                  }}
                  title={entry.rel_path}
                >
                  {entry.name}/
                </button>
                {onDeleteFolder && (
                  <button
                    onClick={() => onDeleteFolder(entry.rel_path)}
                    title="Delete folder"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                      padding: "4px 8px 4px 4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <FileTreeList
                entries={entry.children}
                selectedRelPath={selectedRelPath}
                onSelect={onSelect}
                selectedFolderRelPath={selectedFolderRelPath}
                onSelectFolder={onSelectFolder}
                onDeleteFolder={onDeleteFolder}
                depth={depth + 1}
              />
            </>
          ) : (
            <button
              onClick={() => onSelect(entry.rel_path)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: `8px 14px 8px ${14 + depth * 12}px`,
                border: "none",
                background:
                  selectedRelPath === entry.rel_path ? "var(--paper-raised)" : "transparent",
                borderLeft:
                  selectedRelPath === entry.rel_path
                    ? "2px solid var(--moss)"
                    : "2px solid transparent",
                cursor: "pointer",
                fontSize: 13.5,
                color: "var(--ink)",
                fontWeight: selectedRelPath === entry.rel_path ? 600 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={entry.rel_path}
            >
              {entry.name.replace(/\.md$/, "")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
