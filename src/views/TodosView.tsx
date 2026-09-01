import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FileTreeList from "../components/FileTreeList";
import Dialog from "../components/Dialog";
import { joinPath, listVaultFolder, readFile, trashFile, writeFile } from "../lib/bridge";
import { uniquePath, slugify, flattenFiles } from "../lib/path";
import {
  addTodoItem,
  editTodoItemText,
  parseTodoFile,
  removeTodoItem,
  serializeTodoFile,
  toggleTodoItem,
} from "../lib/todos";
import { useSidebarTree } from "../hooks/useSidebarTree";
import type { TodoFile, VaultEntry } from "../lib/types";
import { Trash2 } from "lucide-react";

interface Props {
  vaultPath: string;
  searchTarget?: string | null;
  onSearchHandled?: () => void;
  sidebarSlot: HTMLDivElement | null;
  triggerCreate?: number;
  onCreateConsumed?: () => void;
}

export default function TodosView({ vaultPath, searchTarget, onSearchHandled, sidebarSlot, triggerCreate, onCreateConsumed }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [todo, setTodo] = useState<TodoFile | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const { expandedIds, toggleFolder } = useSidebarTree(vaultPath, "todos", tree, searchTarget);

  const refreshTree = useCallback(async () => {
    setTree(await listVaultFolder(vaultPath, "todos"));
  }, [vaultPath]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    setSelected(null);
    setTodo(null);
    setNewItemText("");
  }, [vaultPath]);

  useEffect(() => {
    if (searchTarget) {
      setSelected(searchTarget);
      onSearchHandled?.();
    }
  }, [searchTarget, onSearchHandled]);

  useEffect(() => {
    if (triggerCreate && triggerCreate > 0) {
      openNewDialog();
      onCreateConsumed?.();
    }
  }, [triggerCreate, onCreateConsumed]);

  useEffect(() => {
    if (!selected) {
      setTodo(null);
      return;
    }
    let cancelled = false;
    readFile(joinPath(vaultPath, selected)).then((raw) => {
      if (cancelled) return;
      setTodo(parseTodoFile(selected, raw));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, vaultPath]);

  // Default-select todos.md on first load if nothing selected
  useEffect(() => {
    if (!selected && tree.length > 0) {
      const files = flattenFiles(tree);
      if (files.length > 0) setSelected(files[0].rel_path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  async function persist(next: TodoFile) {
    setTodo(next);
    await writeFile(joinPath(vaultPath, next.relPath), serializeTodoFile(next));
  }

  async function createList(name: string) {
    const relPath = await uniquePath(vaultPath, `todos/${slugify(name)}.md`);
    const raw = serializeTodoFileFresh(name);
    await writeFile(joinPath(vaultPath, relPath), raw);
    await refreshTree();
    setSelected(relPath);
  }

  function openNewDialog() {
    setNewName("");
    setNewOpen(true);
  }

  async function submitNewList() {
    const name = newName.trim();
    if (!name) return;
    setNewOpen(false);
    await createList(name);
  }

  function serializeTodoFileFresh(name: string): string {
    return `---\nname: ${name}\n---\n\n`;
  }

  async function handleDeleteList() {
    if (!todo) return;
    if (!window.confirm(`Move "${todo.frontmatter.name ?? todo.relPath}" to trash?`)) return;
    await trashFile(vaultPath, todo.relPath);
    setSelected(null);
    await refreshTree();
  }

  function handleAddItem() {
    if (!todo || !newItemText.trim()) return;
    persist(addTodoItem(todo, newItemText.trim()));
    setNewItemText("");
  }

  const remaining = todo ? todo.items.filter((i) => !i.checked).length : 0;


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
              padding: "0px 14px 8px",
            }}
          >

          </div>
          <FileTreeList
            entries={tree}
            selectedRelPath={selected}
            onSelect={setSelected}
            emptyLabel="No todo lists yet"
            expandedIds={expandedIds}
            onToggleFolder={toggleFolder}
          />
        </div>,
        sidebarSlot
      )}

      <section style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!todo ? (
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

            <svg width="80px" height="80px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="var(--ink-soft)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="var(--ink-soft)" stroke-width="1.5" stroke-linecap="round" />
            </svg>

            <div className="note-empty-state" style={{ fontSize: 14, color: "var(--ink-soft)", animation: "fade-in 0.35s ease" }}>
              Select a todo list, or create one.
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
                <span>Search across all todo's</span>
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
                <span>Create a new todo list</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header
              style={{
                padding: "20px 32px 14px",
                borderBottom: "1px solid var(--hairline)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={todo.frontmatter.name ?? ""}
                  onChange={(e) => {
                    const next = { ...todo, frontmatter: { ...todo.frontmatter, name: e.target.value } };
                    persist(next);
                  }}
                  placeholder="List name"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    fontWeight: 600,
                    border: "none",
                    outline: "none",
                    background: "transparent",
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
                  {todo.relPath} · {remaining} remaining
                </div>
              </div>
              <button
                onClick={handleDeleteList}
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
                Delete List
              </button>
            </header>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 32px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
                {todo.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 6px",
                      borderRadius: "var(--radius-md)",
                    }}
                    className="todo-row"
                  >
                    <button
                      onClick={() => persist(toggleTodoItem(todo, item.id))}
                      aria-label={item.checked ? "Mark incomplete" : "Mark complete"}
                      style={{
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                        borderRadius: "5px",
                        border: `1.5px solid ${item.checked ? "var(--slate)" : "var(--hairline-strong)"}`,
                        background: item.checked ? "var(--slate)" : "var(--paper-raised)",
                        color: item.checked ? "#fff" : "var(--ink)",
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {item.checked ? "✓" : ""}
                    </button>
                    <input
                      value={item.text}
                      onChange={(e) => setTodo(editTodoItemText(todo, item.id, e.target.value))}
                      onBlur={() => persist(todo)}
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: 14.5,
                        color: item.checked ? "var(--ink-soft)" : "var(--ink)",
                        textDecoration: item.checked ? "line-through" : "none",
                        fontFamily: "var(--font-body)",
                      }}
                    />
                    <button
                      onClick={() => persist(removeTodoItem(todo, item.id))}
                      aria-label="Delete item"
                      style={{
                        border: "none",
                        background: "none",
                        color: "var(--ink-soft)",
                        cursor: "pointer",
                        fontSize: 15,
                        opacity: 0.5,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 6px",
                  borderTop: todo.items.length > 0 ? "1px solid var(--hairline)" : "none",
                  paddingTop: todo.items.length > 0 ? 16 : 0,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    borderRadius: "5px",
                    border: "1.5px dashed var(--hairline-strong)",
                  }}
                />
                <input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddItem();
                  }}
                  placeholder="Add a todo…"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 14.5,
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog
        open={newOpen}
        title="New todo list"
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
              onClick={submitNewList}
              disabled={!newName.trim()}
              style={{
                border: "none",
                background: "var(--slate)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: newName.trim() ? "pointer" : "not-allowed",
                opacity: newName.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewList();
          }}
          placeholder="Todo list name"
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
      </Dialog>
    </div>
  );
}
