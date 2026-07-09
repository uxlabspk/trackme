import { useCallback, useEffect, useRef, useState } from "react";
import FileTreeList from "../components/FileTreeList";
import Dialog from "../components/Dialog";
import { deleteFile, joinPath, listVaultFolder, readFile, writeFile } from "../lib/bridge";
import {
  addColumn,
  addTask,
  DEFAULT_COLUMNS,
  lastColumn,
  moveTask,
  parseProjectFile,
  removeColumn,
  removeTask,
  renameColumn,
  serializeProjectFile,
  updateTaskDescription,
  updateTaskTitle,
} from "../lib/projects";
import type { ProjectFile, ProjectTask, VaultEntry } from "../lib/types";
import { GripVertical, Plus, Trash2, X } from "lucide-react";

interface Props {
  vaultPath: string;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "project"
  );
}

function flatten(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap((e) => (e.is_dir ? flatten(e.children) : [e]));
}

export default function ProjectsView({ vaultPath }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectFile | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [draftTask, setDraftTask] = useState("");

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const dragMoved = useRef(false);

  const refreshTree = useCallback(async () => {
    setTree(await listVaultFolder(vaultPath, "projects"));
  }, [vaultPath]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    if (!selected) {
      setProject(null);
      return;
    }
    let cancelled = false;
    readFile(joinPath(vaultPath, selected)).then((raw) => {
      if (cancelled) return;
      setProject(parseProjectFile(selected, raw));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, vaultPath]);

  useEffect(() => {
    if (!selected && tree.length > 0) {
      const files = flatten(tree);
      if (files.length > 0) setSelected(files[0].rel_path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  async function persist(next: ProjectFile) {
    setProject(next);
    await writeFile(joinPath(vaultPath, next.relPath), serializeProjectFile(next));
  }

  async function createProject(name: string) {
    const relPath = `projects/${slugify(name)}.md`;
    const raw = serializeProjectFile({
      relPath,
      frontmatter: { name, columns: [...DEFAULT_COLUMNS], tasks: [] },
      body: "",
    });
    await writeFile(joinPath(vaultPath, relPath), raw);
    await refreshTree();
    setSelected(relPath);
  }

  function openNewDialog() {
    setNewName("");
    setNewOpen(true);
  }

  async function submitNewProject() {
    const name = newName.trim();
    if (!name) return;
    setNewOpen(false);
    await createProject(name);
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!window.confirm(`Delete project "${project.frontmatter.name ?? project.relPath}"?`)) return;
    await deleteFile(joinPath(vaultPath, project.relPath));
    setSelected(null);
    await refreshTree();
  }

  function handleAddTask(status: string) {
    if (!project || !draftTask.trim()) return;
    persist(addTask(project, status, draftTask));
    setDraftTask("");
  }

  function handleDropOnColumn(col: string, insertBeforeId?: string) {
    if (!project || !dragId) return;
    persist(moveTask(project, dragId, col, insertBeforeId));
    setDragId(null);
    setDragOverCol(null);
  }

  function openCard(task: ProjectTask) {
    setEditing(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
  }

  function saveCard() {
    if (!project || !editing) return;
    let next = project;
    next = updateTaskTitle(next, editing.id, editTitle);
    next = updateTaskDescription(next, editing.id, editDesc);
    setEditing(null);
    persist(next);
  }

  function deleteCard() {
    if (!project || !editing) return;
    const next = removeTask(project, editing.id);
    setEditing(null);
    persist(next);
  }

  function moveCardTo(col: string) {
    if (!project || !editing) return;
    persist(moveTask(project, editing.id, col));
  }

  function commitRename(col: string) {
    if (project) persist(renameColumn(project, col, renameValue));
    setRenamingCol(null);
  }

  function handleDeleteColumn(col: string) {
    if (!project) return;
    const count = (project.frontmatter.tasks ?? []).filter((t) => t.status === col).length;
    if (
      !window.confirm(
        `Delete column "${col}"? Its ${count} card${count === 1 ? "" : "s"} will move to "${
          (project.frontmatter.columns ?? DEFAULT_COLUMNS)[0]
        }".`,
      )
    )
      return;
    persist(removeColumn(project, col));
  }

  const columns = project?.frontmatter.columns ?? DEFAULT_COLUMNS;
  const tasks = project?.frontmatter.tasks ?? [];

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
            PROJECTS
          </h2>
          <button
            onClick={openNewDialog}
            title="New project"
            style={{
              border: "1px solid var(--hairline-strong)",
              background: "var(--paper-raised)",
              borderRadius: "var(--radius-sm)",
              width: 24,
              height: 24,
              cursor: "pointer",
              fontSize: 15,
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
          emptyLabel="No projects yet"
        />
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!project ? (
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
            Select a project, or create one to start a board.
          </div>
        ) : (
          <>
            <header
              style={{
                padding: "18px 28px 14px",
                borderBottom: "1px solid var(--hairline)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <input
                  value={project.frontmatter.name ?? ""}
                  onChange={(e) =>
                    persist({
                      ...project,
                      frontmatter: { ...project.frontmatter, name: e.target.value },
                    })
                  }
                  placeholder="Project name"
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
                <input
                  value={project.frontmatter.description ?? ""}
                  onChange={(e) =>
                    persist({
                      ...project,
                      frontmatter: { ...project.frontmatter, description: e.target.value },
                    })
                  }
                  placeholder="Short description…"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    width: "100%",
                    marginTop: 2,
                  }}
                />
              </div>
              <button
                onClick={handleDeleteProject}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: "none",
                  background: "none",
                  color: "var(--danger)",
                  fontSize: 13,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </header>

            <div
              style={{
                flex: 1,
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                overflowX: "auto",
                overflowY: "hidden",
                padding: "20px 28px",
              }}
            >
              {columns.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col);
                const isDone = col === lastColumn(project);
                return (
                  <div
                    key={col}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragId) setDragOverCol(col);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnColumn(col);
                    }}
                    style={{
                      width: 288,
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      maxHeight: "100%",
                      background: dragOverCol === col ? "var(--moss-soft)" : "var(--paper-raised)",
                      border:
                        dragOverCol === col
                          ? "1px solid var(--moss)"
                          : "1px solid var(--hairline)",
                      borderRadius: "var(--radius-md)",
                      transition: "background 120ms, border-color 120ms",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--hairline)",
                      }}
                    >
                      {renamingCol === col ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(col)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(col);
                            if (e.key === "Escape") setRenamingCol(null);
                          }}
                          style={{
                            flex: 1,
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            border: "1px solid var(--hairline-strong)",
                            borderRadius: "var(--radius-sm)",
                            padding: "3px 6px",
                            outline: "none",
                            background: "var(--paper-raised)",
                            color: "var(--ink)",
                          }}
                        />
                      ) : (
                        <button
                          onDoubleClick={() => {
                            setRenamingCol(col);
                            setRenameValue(col);
                          }}
                          title="Double-click to rename"
                          style={{
                            flex: 1,
                            textAlign: "left",
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: isDone ? "var(--moss-deep)" : "var(--ink)",
                            border: "none",
                            background: "transparent",
                            cursor: "text",
                            padding: 0,
                          }}
                        >
                          {col} <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>{colTasks.length}</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteColumn(col)}
                        title="Delete column"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--ink-soft)",
                          cursor: "pointer",
                          padding: 2,
                          display: "flex",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            setDragId(task.id);
                            dragMoved.current = true;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", task.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOverCol(null);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDropOnColumn(col, task.id);
                          }}
                          onClick={() => {
                            if (dragMoved.current) {
                              dragMoved.current = false;
                              return;
                            }
                            openCard(task);
                          }}
                          style={{
                            background: "var(--paper-raised)",
                            border: "1px solid var(--hairline)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 12px",
                            cursor: "grab",
                            boxShadow: "var(--shadow-sm)",
                            opacity: dragId === task.id ? 0.4 : 1,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <GripVertical
                              size={14}
                              style={{ color: "var(--ink-soft)", flexShrink: 0, marginTop: 2, opacity: 0.5 }}
                            />
                            <span
                              style={{
                                fontSize: 14,
                                lineHeight: 1.35,
                                color: isDone ? "var(--ink-soft)" : "var(--ink)",
                                textDecoration: isDone ? "line-through" : "none",
                                flex: 1,
                              }}
                            >
                              {task.title}
                            </span>
                          </div>
                          {task.description?.trim() && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--ink-soft)",
                                marginTop: 6,
                                paddingLeft: 20,
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {task.description}
                            </div>
                          )}
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ink-soft)",
                            textAlign: "center",
                            padding: "12px 0",
                            fontStyle: "italic",
                          }}
                        >
                          Drop or add a card
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px 10px",
                        borderTop: "1px solid var(--hairline)",
                      }}
                    >
                      <Plus size={14} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                      <input
                        value={draftTask}
                        onChange={(e) => setDraftTask(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTask(col);
                        }}
                        placeholder="Add a card…"
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 13.5,
                          fontFamily: "var(--font-body)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => {
                  const name = window.prompt("New column name");
                  if (name && project) persist(addColumn(project, name));
                }}
                title="Add column"
                style={{
                  width: 44,
                  flexShrink: 0,
                  alignSelf: "stretch",
                  border: "1px dashed var(--hairline-strong)",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                +
              </button>
            </div>
          </>
        )}
      </section>

      <Dialog
        open={newOpen}
        title="New project"
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
              onClick={submitNewProject}
              disabled={!newName.trim()}
              style={{
                border: "none",
                background: "var(--moss)",
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
            if (e.key === "Enter") submitNewProject();
          }}
          placeholder="Project name"
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

      <Dialog
        open={editing !== null}
        title="Card"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button
              onClick={deleteCard}
              style={{
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper-raised)",
                color: "var(--danger)",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setEditing(null)}
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
              onClick={saveCard}
              style={{
                border: "none",
                background: "var(--moss)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Card title"
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
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Notes / description…"
            rows={4}
            style={{
              width: "100%",
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              padding: "9px 11px",
              border: "1px solid var(--hairline-strong)",
              borderRadius: "var(--radius-sm)",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              background: "var(--paper-raised)",
              color: "var(--ink)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Column:</span>
            <select
              value={editing?.status ?? ""}
              onChange={(e) => moveCardTo(e.target.value)}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid var(--hairline-strong)",
                borderRadius: "var(--radius-sm)",
                outline: "none",
                background: "var(--paper-raised)",
                color: "var(--ink)",
              }}
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
