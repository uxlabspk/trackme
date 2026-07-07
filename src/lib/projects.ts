import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import type { ProjectFile, ProjectFrontmatter, ProjectTask } from "./types";

export const DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Done"];

export function lastColumn(project: ProjectFile): string {
  const cols = project.frontmatter.columns ?? DEFAULT_COLUMNS;
  return cols[cols.length - 1];
}

export function parseProjectFile(relPath: string, raw: string): ProjectFile {
  const { frontmatter, body } = parseFrontmatter<ProjectFrontmatter>(raw);
  const columns =
    Array.isArray(frontmatter.columns) && frontmatter.columns.length > 0
      ? frontmatter.columns
      : [...DEFAULT_COLUMNS];
  const tasks = Array.isArray(frontmatter.tasks) ? frontmatter.tasks : [];
  return {
    relPath,
    frontmatter: { ...frontmatter, columns, tasks },
    body,
  };
}

export function serializeProjectFile(project: ProjectFile): string {
  return serializeFrontmatter(project.frontmatter, project.body);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addTask(project: ProjectFile, status: string, title: string): ProjectFile {
  const trimmed = title.trim();
  if (!trimmed) return project;
  const now = new Date().toISOString();
  const task: ProjectTask = {
    id: newId(),
    title: trimmed,
    status,
    createdAt: now,
    doneAt: status === lastColumn(project) ? now : null,
  };
  return {
    ...project,
    frontmatter: { ...project.frontmatter, tasks: [...(project.frontmatter.tasks ?? []), task] },
  };
}

export function updateTaskTitle(project: ProjectFile, id: string, title: string): ProjectFile {
  const tasks = (project.frontmatter.tasks ?? []).map((t) =>
    t.id === id ? { ...t, title } : t,
  );
  return { ...project, frontmatter: { ...project.frontmatter, tasks } };
}

export function updateTaskDescription(
  project: ProjectFile,
  id: string,
  description: string,
): ProjectFile {
  const tasks = (project.frontmatter.tasks ?? []).map((t) =>
    t.id === id ? { ...t, description } : t,
  );
  return { ...project, frontmatter: { ...project.frontmatter, tasks } };
}

export function removeTask(project: ProjectFile, id: string): ProjectFile {
  const tasks = (project.frontmatter.tasks ?? []).filter((t) => t.id !== id);
  return { ...project, frontmatter: { ...project.frontmatter, tasks } };
}

/**
 * Moves a task to `toStatus`. When `insertBeforeId` is provided the task is
 * placed directly before that task (reordering within or across columns);
 * otherwise it is appended to the end of the target column.
 */
export function moveTask(
  project: ProjectFile,
  taskId: string,
  toStatus: string,
  insertBeforeId?: string,
): ProjectFile {
  const tasks = project.frontmatter.tasks ?? [];
  const dragged = tasks.find((t) => t.id === taskId);
  if (!dragged) return project;

  const without = tasks.filter((t) => t.id !== taskId);
  const doneCol = lastColumn(project);
  const moved: ProjectTask = {
    ...dragged,
    status: toStatus,
    doneAt: toStatus === doneCol ? dragged.doneAt ?? new Date().toISOString() : null,
  };

  const next = [...without];
  if (insertBeforeId == null) {
    let lastIdx = -1;
    without.forEach((t, i) => {
      if (t.status === toStatus) lastIdx = i;
    });
    if (lastIdx === -1) next.push(moved);
    else next.splice(lastIdx + 1, 0, moved);
  } else {
    const idx = without.findIndex((t) => t.id === insertBeforeId);
    if (idx === -1) next.push(moved);
    else next.splice(idx, 0, moved);
  }

  return { ...project, frontmatter: { ...project.frontmatter, tasks: next } };
}

export function addColumn(project: ProjectFile, name: string): ProjectFile {
  const col = name.trim();
  if (!col) return project;
  const cols = project.frontmatter.columns ?? DEFAULT_COLUMNS;
  if (cols.includes(col)) return project;
  return { ...project, frontmatter: { ...project.frontmatter, columns: [...cols, col] } };
}

export function renameColumn(
  project: ProjectFile,
  oldName: string,
  newName: string,
): ProjectFile {
  const col = newName.trim();
  if (!col || col === oldName) return project;
  const cols = (project.frontmatter.columns ?? DEFAULT_COLUMNS).map((c) =>
    c === oldName ? col : c,
  );
  const tasks = (project.frontmatter.tasks ?? []).map((t) =>
    t.status === oldName ? { ...t, status: col } : t,
  );
  return { ...project, frontmatter: { ...project.frontmatter, columns: cols, tasks } };
}

export function removeColumn(project: ProjectFile, name: string): ProjectFile {
  const cols = (project.frontmatter.columns ?? DEFAULT_COLUMNS).filter((c) => c !== name);
  if (cols.length === 0) return project;
  const fallback = cols[0];
  const tasks = (project.frontmatter.tasks ?? []).map((t) =>
    t.status === name ? { ...t, status: fallback } : t,
  );
  return { ...project, frontmatter: { ...project.frontmatter, columns: cols, tasks } };
}
