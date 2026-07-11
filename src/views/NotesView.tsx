import { useCallback, useEffect, useRef, useState } from "react";
import FileTreeList from "../components/FileTreeList";
import MarkdownEditor from "../components/MarkdownEditor";
import Dialog from "../components/Dialog";
import { createFolder, deleteFile, deleteFolder, joinPath, listVaultFolder, readFile, writeFile } from "../lib/bridge";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import type { NoteFile, NoteFrontmatter, VaultEntry } from "../lib/types";
import { FolderPlus, Trash2 } from "lucide-react";
import "../styles/milkdown.css";

interface Props {
  vaultPath: string;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "untitled"
  );
}

function sanitizeFolderName(name: string): string {
  return (
    name
      .trim()
      .replace(/[\\/]+/g, "-")
      .replace(/\.+/g, "")
      .replace(/^\.+/, "")
      .replace(/[^\p{L}\p{N} _-]+/gu, "")
      .replace(/^-+|-+$/g, "")
      .trim() || "untitled"
  );
}

function parentRelPath(relPath: string): string {
  const idx = relPath.lastIndexOf("/");
  return idx <= 0 ? "notes" : relPath.slice(0, idx);
}

export default function NotesView({ vaultPath }: Props) {
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

  const refreshTree = useCallback(async () => {
    const entries = await listVaultFolder(vaultPath, "notes");
    setTree(entries);
  }, [vaultPath]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

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
    const relPath = `${folder.replace(/\/+$/, "")}/${slugify(title)}.md`;
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

  async function handleDeleteFolder(relPath: string) {
    if (
      !window.confirm(
        `Delete folder "${relPath}" and all its notes? This can't be undone.`,
      )
    )
      return;
    await deleteFolder(joinPath(vaultPath, relPath));
    if (currentFolder === relPath || currentFolder.startsWith(`${relPath}/`)) {
      setCurrentFolder("notes");
    }
    if (selected && (selected === relPath || selected.startsWith(`${relPath}/`))) {
      setSelected(null);
    }
    await refreshTree();
  }

  async function handleDelete() {
    if (!note) return;
    if (!window.confirm(`Delete "${note.frontmatter.title ?? note.relPath}"? This can't be undone.`))
      return;
    await deleteFile(joinPath(vaultPath, note.relPath));
    setSelected(null);
    await refreshTree();
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid var(--hairline)",
          overflowY: "auto",
          paddingBottom: 12,
        }}
      >
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
        />
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!note ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-soft)",
              fontSize: 14,
            }}
          >
            Select a note, or create one to get started.
          </div>
        ) : (
          <>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 28px 10px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div>
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
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {note.relPath} · {dirty ? "saving…" : "saved"}
                </div>
              </div>
                <button
                    onClick={handleDelete}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        background: "#ff3b30",
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
    </div>
  );
}
