import { ChevronRight, ChevronDown, FileText, Folder, Trash2 } from "lucide-react";
import { useState } from "react";
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
  expandedIds?: Set<string>;
  onToggleFolder?: (relPath: string) => void;
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
  expandedIds,
  onToggleFolder,
}: Props) {
  if (entries.length === 0 && depth === 0) {
    return (
      <div
        className="ft-empty"
        style={{
          padding: "8px 12px 0",
          fontSize: 12.5,
          color: "var(--ink-soft)",
          lineHeight: 1.4,
          textAlign: "left",
          whiteSpace: "normal",
          maxWidth: "100%",
          width: "fit-content",
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {entries.map((entry) => (
        <div key={entry.rel_path}>
          {entry.is_dir ? (
            <FolderRow
              entry={entry}
              selectedRelPath={selectedRelPath}
              selectedFolderRelPath={selectedFolderRelPath}
              onSelect={onSelect}
              onSelectFolder={onSelectFolder}
              onDeleteFolder={onDeleteFolder}
              depth={depth}
              expandedIds={expandedIds}
              onToggleFolder={onToggleFolder}
            />
          ) : (
            <button
              onClick={() => onSelect(entry.rel_path)}
              className={`ft-file-btn${selectedRelPath === entry.rel_path ? " ft-file-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                textAlign: "left",
                padding: `7px 10px 7px ${12 + depth * 12}px`,
                border: "none",
                background:
                  selectedRelPath === entry.rel_path ? "var(--moss-soft)" : "transparent",
                borderLeft:
                  selectedRelPath === entry.rel_path
                    ? "2px solid var(--moss)"
                    : "2px solid transparent",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12.5,
                color: selectedRelPath === entry.rel_path ? "var(--moss-deep)" : "var(--ink)",
                fontWeight: selectedRelPath === entry.rel_path ? 600 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "background 0.10s ease, color 0.10s ease",
              }}
              title={entry.rel_path}
            >
              <FileText
                size={12}
                style={{
                  flexShrink: 0,
                  color: selectedRelPath === entry.rel_path ? "var(--moss)" : "var(--ink-soft)",
                  opacity: 0.7,
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {entry.name.replace(/\.(md|canvas\.json)$/, "")}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function FolderRow({
  entry,
  selectedRelPath,
  selectedFolderRelPath,
  onSelect,
  onSelectFolder,
  onDeleteFolder,
  depth,
  expandedIds,
  onToggleFolder,
}: {
  entry: VaultEntry;
  selectedRelPath: string | null;
  selectedFolderRelPath: string | null | undefined;
  onSelect: (p: string) => void;
  onSelectFolder?: (p: string) => void;
  onDeleteFolder?: (p: string) => void;
  depth: number;
  expandedIds?: Set<string>;
  onToggleFolder?: (relPath: string) => void;
}) {
  const isControlled = expandedIds !== undefined;
  const [localOpen, setLocalOpen] = useState(true);
  const open = isControlled ? expandedIds.has(entry.rel_path) : localOpen;

  const toggle = () => {
    if (isControlled) onToggleFolder?.(entry.rel_path);
    else setLocalOpen((o) => !o);
  };

  const isSelected = selectedFolderRelPath === entry.rel_path;

  const handleFolderSelect = () => {
    onSelectFolder?.(entry.rel_path);
    if (onToggleFolder && !open) {
      onToggleFolder(entry.rel_path);
    }
  };

  return (
    <>
      <div
        className="ft-folder-row"
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: `${12 + depth * 12}px`,
          paddingRight: 6,
          borderLeft: isSelected ? "2px solid var(--moss)" : "2px solid transparent",
          background: isSelected ? "var(--paper-raised)" : "transparent",
          borderRadius: 6,
          minHeight: 28,
        }}
      >
        <button
          onClick={toggle}
          style={{
            border: "none",
            background: "transparent",
            padding: "2px 4px 2px 0",
            cursor: "pointer",
            color: isSelected ? "var(--moss-deep)" : "var(--ink-soft)",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <button
          onClick={handleFolderSelect}
          className="ft-folder-btn"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 5,
            textAlign: "left",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: isSelected ? "var(--moss-deep)" : "var(--ink-soft)",
            padding: "7px 4px 7px 0",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            border: "none",
            background: "transparent",
            cursor: onSelectFolder ? "pointer" : "default",
            fontWeight: isSelected ? 700 : 500,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={entry.rel_path}
        >
          <Folder size={11} style={{ flexShrink: 0 }} />
          {entry.name}
        </button>
        {onDeleteFolder && (
          <button
            onClick={() => onDeleteFolder(entry.rel_path)}
            title="Delete folder"
            className="ft-delete-btn"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--ink-soft)",
              cursor: "pointer",
              padding: "4px 4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {open && (
        <FileTreeList
          entries={entry.children}
          selectedRelPath={selectedRelPath}
          onSelect={onSelect}
          selectedFolderRelPath={selectedFolderRelPath}
          onSelectFolder={onSelectFolder}
          onDeleteFolder={onDeleteFolder}
          depth={depth + 1}
          expandedIds={expandedIds}
          onToggleFolder={onToggleFolder}
        />
      )}
    </>
  );
}
