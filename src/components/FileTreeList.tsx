import type { VaultEntry } from "../lib/types";

interface Props {
  entries: VaultEntry[];
  selectedRelPath: string | null;
  onSelect: (relPath: string) => void;
  emptyLabel?: string;
  depth?: number;
}

export default function FileTreeList({
  entries,
  selectedRelPath,
  onSelect,
  emptyLabel = "No files yet",
  depth = 0,
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
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-soft)",
                  padding: `8px 14px 4px ${14 + depth * 12}px`,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {entry.name}/
              </div>
              <FileTreeList
                entries={entry.children}
                selectedRelPath={selectedRelPath}
                onSelect={onSelect}
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
