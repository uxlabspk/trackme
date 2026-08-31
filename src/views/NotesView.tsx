import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FileTreeList from "../components/FileTreeList";
import MarkdownEditor from "../components/MarkdownEditor";
import Dialog from "../components/Dialog";
import { createFolder, joinPath, listVaultFolder, readFile, trashFile, trashFolder, writeFile } from "../lib/bridge";
import { uniquePath, slugify, sanitizeFolderName, parentRelPath } from "../lib/path";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import { useSidebarTree } from "../hooks/useSidebarTree";
import type { NoteFile, NoteFrontmatter, VaultEntry } from "../lib/types";
import { FolderPlus, Trash2 } from "lucide-react";
import "../styles/milkdown.css";

interface Props {
  vaultPath: string;
  searchTarget?: string | null;
  onSearchHandled?: () => void;
  sidebarSlot: HTMLDivElement | null;
}

export default function NotesView({ vaultPath, searchTarget, onSearchHandled, sidebarSlot }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [currentFolder, setCurrentFolder] = useState("notes");
  const saveTimer = useRef<number | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null);
  const { expandedIds, toggleFolder } = useSidebarTree(vaultPath, "notes", tree, searchTarget);

  const refreshTree = useCallback(async () => {
    const entries = await listVaultFolder(vaultPath, "notes");
    setTree(entries);
  }, [vaultPath]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    setSelected(null);
    setNote(null);
    setCurrentFolder("notes");
  }, [vaultPath]);

  useEffect(() => {
    if (searchTarget) {
      setSelected(searchTarget);
      onSearchHandled?.();
    }
  }, [searchTarget, onSearchHandled]);

  useEffect(() => {
    if (!selected) {
      setNote(null);
      return;
    }
    let cancelled = false;
    readFile(joinPath(vaultPath, selected)).then((raw) => {
      if (cancelled) return;
      const { frontmatter, body } = parseFrontmatter<NoteFrontmatter>(raw);
      setNote({ relPath: selected, frontmatter, body });
      setDirty(false);
      setCurrentFolder(parentRelPath(selected));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, vaultPath]);

  const scheduleSave = useCallback(
    (next: NoteFile) => {
      setDirty(true);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const raw = serializeFrontmatter(
          { ...next.frontmatter, updatedAt: new Date().toISOString() },
          next.body,
        );
        await writeFile(joinPath(vaultPath, next.relPath), raw);
        setDirty(false);
      }, 500);
    },
    [vaultPath],
  );

  async function createNote(title: string, folder: string) {
    const relPath = await uniquePath(vaultPath, `${folder.replace(/\/+$/, "")}/${slugify(title)}.md`);
    const now = new Date().toISOString();
    const raw = serializeFrontmatter(
      { title, createdAt: now, updatedAt: now, tags: [] },
      "",
    );
    await writeFile(joinPath(vaultPath, relPath), raw);
    await refreshTree();
    setSelected(relPath);
  }

  function openNewDialog() {
    setNewTitle("");
    setNewOpen(true);
  }

  async function submitNewNote() {
    const title = newTitle.trim();
    if (!title) return;
    setNewOpen(false);
    await createNote(title, currentFolder);
  }

  function openFolderDialog() {
    setFolderName("");
    setFolderOpen(true);
  }

  async function submitNewFolder() {
    const name = sanitizeFolderName(folderName);
    if (!name) return;
    const relPath = `${currentFolder.replace(/\/+$/, "")}/${name}`;
    setFolderOpen(false);
    await createFolder(joinPath(vaultPath, relPath));
    await refreshTree();
    setCurrentFolder(relPath);
  }

  function handleDeleteFolder(relPath: string) {
    setConfirmDeleteFolder(relPath);
  }

  async function doConfirmDeleteFolder() {
    if (!confirmDeleteFolder) return;
    const relPath = confirmDeleteFolder;
    setConfirmDeleteFolder(null);
    await trashFolder(vaultPath, relPath);
    if (currentFolder === relPath || currentFolder.startsWith(`${relPath}/`)) {
      setCurrentFolder("notes");
    }
    if (selected && (selected === relPath || selected.startsWith(`${relPath}/`))) {
      setSelected(null);
    }
    await refreshTree();
  }

  function handleDelete() {
    if (!note) return;
    setConfirmDeleteNote(true);
  }

  async function doConfirmDeleteNote() {
    if (!note) return;
    setConfirmDeleteNote(false);
    await trashFile(vaultPath, note.relPath);
    setSelected(null);
    await refreshTree();
  }

  const kbdStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 22,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-soft)",
    background: "var(--paper-raised)",
    border: "1px solid var(--hairline-strong)",
    borderRadius: 4,
    padding: "0 6px",
    lineHeight: 1,
  };

  return (
    <div style={{ height: "100%" }}>
      {sidebarSlot && createPortal(
        <div style={{ paddingBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 14px 8px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--ink-soft)" }}>
              NOTES
            </h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={openFolderDialog}
                title="New folder"
                className="note-header-btn"
                style={{
                  border: "1px solid var(--hairline-strong)",
                  background: "var(--paper-raised)",
                  borderRadius: "var(--radius-sm)",
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--moss)",
                }}
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={openNewDialog}
                title="New note"
                className="note-header-btn"
                style={{
                  border: "1px solid var(--hairline-strong)",
                  background: "var(--paper-raised)",
                  borderRadius: "var(--radius-sm)",
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 15,
                  lineHeight: 1,
                  color: "var(--moss)",
                }}
              >
                +
              </button>
            </div>
          </div>
          <FileTreeList
            entries={tree}
            selectedRelPath={selected}
            onSelect={setSelected}
            selectedFolderRelPath={currentFolder}
            onSelectFolder={setCurrentFolder}
            onDeleteFolder={handleDeleteFolder}
            emptyLabel="No notes yet — click + to add one"
            expandedIds={expandedIds}
            onToggleFolder={toggleFolder}
          />
        </div>,
        sidebarSlot
      )}

      <section style={{ height: "100%", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!note ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              position: "relative",
            }}
          >
            <div className="note-empty-state" style={{ fontSize: 14, color: "var(--ink-soft)", animation: "fade-in 0.35s ease" }}>
              Select a note, or create one to get started.
            </div>
            <div className="note-empty-state" style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fade-in 0.45s ease 0.1s both" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                <kbd style={kbdStyle}>⌘K</kbd>
                <span>Search across all notes</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                <kbd style={kbdStyle}>+</kbd>
                <span>Create a new note</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 28px 10px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={note.frontmatter.title ?? ""}
                  onChange={(e) => {
                    const next = {
                      ...note,
                      frontmatter: { ...note.frontmatter, title: e.target.value },
                    };
                    setNote(next);
                    scheduleSave(next);
                  }}
                  placeholder="Untitled"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    fontWeight: 600,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    width: "100%",
                    color: "var(--ink)",
                  }}
                />
                <div
                  className="note-save-status"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  <span className="note-save-dot" data-dirty={dirty} />
                  {note.relPath} · {dirty ? "saving…" : "saved"}
                </div>
              </div>
                <button
                    onClick={handleDelete}
                    className="note-delete-btn"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        background: "var(--danger)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "6px 12px",
                        borderRadius: 6,
                        cursor: "pointer",
                    }}
                >
                    <Trash2 size={14} />
                    Delete
                </button>
            </header>

            <div style={{ flex: 1, overflow: "hidden" }}>
              <MarkdownEditor
                key={note.relPath}
                value={note.body}
                onChange={(body) => {
                  const next = { ...note, body };
                  setNote(next);
                  scheduleSave(next);
                }}
              />
            </div>
          </>
        )}
      </section>

      <Dialog
        open={newOpen}
        title="New note"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button
              onClick={() => setNewOpen(false)}
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
              onClick={submitNewNote}
              disabled={!newTitle.trim()}
              style={{
                border: "none",
                background: "var(--moss)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: newTitle.trim() ? "pointer" : "not-allowed",
                opacity: newTitle.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewNote();
          }}
          placeholder="Note title"
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            padding: "9px 11px",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            boxSizing: "border-box",
            background: "var(--paper-raised)",
            color: "var(--ink)",
          }}
        />
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink-soft)",
          }}
        >
          in /{currentFolder}
        </div>
      </Dialog>

      <Dialog
        open={folderOpen}
        title="New folder"
        onClose={() => setFolderOpen(false)}
        footer={
          <>
            <button
              onClick={() => setFolderOpen(false)}
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
              onClick={submitNewFolder}
              disabled={!folderName.trim()}
              style={{
                border: "none",
                background: "var(--moss)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: folderName.trim() ? "pointer" : "not-allowed",
                opacity: folderName.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewFolder();
          }}
          placeholder="Folder name"
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            padding: "9px 11px",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            boxSizing: "border-box",
            background: "var(--paper-raised)",
            color: "var(--ink)",
          }}
        />
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink-soft)",
          }}
        >
          in /{currentFolder}
        </div>
      </Dialog>

      <Dialog
        open={confirmDeleteNote}
        title="Move to trash?"
        onClose={() => setConfirmDeleteNote(false)}
        footer={
          <>
            <button
              onClick={() => setConfirmDeleteNote(false)}
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
              onClick={doConfirmDeleteNote}
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
              Move to trash
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          &ldquo;{note?.frontmatter.title ?? note?.relPath}&rdquo; will be moved to trash.
        </p>
      </Dialog>

      <Dialog
        open={confirmDeleteFolder !== null}
        title="Move folder to trash?"
        onClose={() => setConfirmDeleteFolder(null)}
        footer={
          <>
            <button
              onClick={() => setConfirmDeleteFolder(null)}
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
              onClick={doConfirmDeleteFolder}
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
              Move to trash
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          &ldquo;{confirmDeleteFolder}&rdquo; and all its notes will be moved to trash.
        </p>
      </Dialog>
    </div>
  );
}
