import { useCallback, useEffect, useRef, useState } from "react";
import { MilkdownProvider } from "@milkdown/react";
import FileTreeList from "../components/FileTreeList";
import MarkdownEditor from "../components/MarkdownEditor";
import { deleteFile, joinPath, listVaultFolder, readFile, writeFile } from "../lib/bridge";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import type { NoteFile, NoteFrontmatter, VaultEntry } from "../lib/types";
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

export default function NotesView({ vaultPath }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteFile | null>(null);
  const [dirty, setDirty] = useState(false);
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

  async function handleNewNote() {
    const title = window.prompt("Note title?");
    if (!title) return;
    const relPath = `notes/${slugify(title)}.md`;
    const now = new Date().toISOString();
    const raw = serializeFrontmatter(
      { title, createdAt: now, updatedAt: now, tags: [] },
      "",
    );
    await writeFile(joinPath(vaultPath, relPath), raw);
    await refreshTree();
    setSelected(relPath);
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
          <button
            onClick={handleNewNote}
            title="New note"
            style={{
              border: "1px solid var(--hairline-strong)",
              background: "#fff",
              borderRadius: "var(--radius-sm)",
              width: 24,
              height: 24,
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              color: "var(--moss-deep)",
            }}
          >
            +
          </button>
        </div>
        <FileTreeList
          entries={tree}
          selectedRelPath={selected}
          onSelect={setSelected}
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
                  border: "none",
                  background: "none",
                  color: "var(--danger)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </header>

            <div style={{ flex: 1, overflow: "hidden", padding: "0 28px" }}>
              <MilkdownProvider>
                <MarkdownEditor
                  key={note.relPath}
                  value={note.body}
                  onChange={(body) => {
                    const next = { ...note, body };
                    setNote(next);
                    scheduleSave(next);
                  }}
                />
              </MilkdownProvider>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
