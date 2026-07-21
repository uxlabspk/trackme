import type { AiConfig, AiToolCall, AiToolDefinition, NoteFrontmatter, MeetingFrontmatter, ProjectFrontmatter, Recurrence } from "./types";
import { readFile, writeFile, deleteFile, joinPath, listVaultFolder } from "./bridge";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { parseTodoFile, serializeTodoFile, addTodoItem, toggleTodoItem, removeTodoItem } from "./todos";
import { parseProjectFile, serializeProjectFile, addTask, moveTask, removeTask } from "./projects";

/* ── Tool Definitions ── */

export const VAULT_TOOLS: AiToolDefinition[] = [
  {
    name: "list_notes",
    description: "List all notes in the vault. Returns file paths and titles.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_note",
    description: "Read the full content of a note by its file path.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the note (e.g. notes/my-note.md)" } },
      required: ["path"],
    },
  },
  {
    name: "create_note",
    description: "Create a new note with a title and optional body content.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the note" },
        body: { type: "string", description: "Markdown body content" },
        folder: { type: "string", description: "Subfolder within notes/ (default: notes)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_note",
    description: "Update an existing note's title and/or body.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the note" },
        title: { type: "string", description: "New title (optional)" },
        body: { type: "string", description: "New body content (optional)" },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_note",
    description: "Delete a note by moving it to trash.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the note" } },
      required: ["path"],
    },
  },
  {
    name: "list_meetings",
    description: "List all meetings in the vault.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_meeting",
    description: "Read a meeting's details by file path.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the meeting file" } },
      required: ["path"],
    },
  },
  {
    name: "create_meeting",
    description: "Create a new meeting with title, time, duration, recurrence, and optional link.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Meeting title" },
        time: { type: "string", description: "Time in HH:MM format" },
        duration_minutes: { type: "string", description: "Duration in minutes" },
        link: { type: "string", description: "Meeting link URL" },
        notes: { type: "string", description: "Meeting notes (markdown body)" },
        recurrence: {
          type: "string",
          description: `Recurrence rule as JSON string. Schema: {"freq":"once"|"daily"|"weekly"|"monthly","days":["mon","tue","wed","thu","fri","sat","sun"],"interval":1,"start_date":"YYYY-MM-DD","end_date":null}. For "every day except Sunday" use freq="daily", days=["mon","tue","wed","thu","fri","sat"]. For "every weekday" use freq="daily", days=["mon","tue","wed","thu","fri"]. For "weekly on Monday and Wednesday" use freq="weekly", days=["mon","wed"]. For "every 2 weeks on Friday" use freq="weekly", interval=2, days=["fri"]. For one-time meetings use freq="once".`,
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_meeting",
    description: "Update an existing meeting's fields including recurrence.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the meeting file" },
        title: { type: "string", description: "New title" },
        time: { type: "string", description: "New time" },
        duration_minutes: { type: "string", description: "New duration in minutes" },
        link: { type: "string", description: "New meeting link" },
        notes: { type: "string", description: "New notes body" },
        recurrence: {
          type: "string",
          description: `Recurrence rule as JSON string. Schema: {"freq":"once"|"daily"|"weekly"|"monthly","days":["mon","tue","wed","thu","fri","sat","sun"],"interval":1,"start_date":"YYYY-MM-DD","end_date":null}. Use null to remove recurrence.`,
        },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_meeting",
    description: "Delete a meeting by moving it to trash.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the meeting file" } },
      required: ["path"],
    },
  },
  {
    name: "list_todos",
    description: "List all todo lists in the vault.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_todos",
    description: "Read all items in a todo list.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the todo file" } },
      required: ["path"],
    },
  },
  {
    name: "create_todo_list",
    description: "Create a new todo list with a name.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Name of the todo list" } },
      required: ["name"],
    },
  },
  {
    name: "add_todo_item",
    description: "Add a new item to an existing todo list.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the todo file" },
        text: { type: "string", description: "Todo item text" },
      },
      required: ["path", "text"],
    },
  },
  {
    name: "toggle_todo_item",
    description: "Toggle a todo item's checked status.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the todo file" },
        item_id: { type: "string", description: "ID of the todo item (e.g. line-0)" },
      },
      required: ["path", "item_id"],
    },
  },
  {
    name: "delete_todo_item",
    description: "Remove a todo item from a list.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the todo file" },
        item_id: { type: "string", description: "ID of the todo item" },
      },
      required: ["path", "item_id"],
    },
  },
  {
    name: "delete_todo_list",
    description: "Delete an entire todo list by moving it to trash.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the todo file" } },
      required: ["path"],
    },
  },
  {
    name: "list_projects",
    description: "List all projects in the vault.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_project",
    description: "Read a project's details including all columns and tasks.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the project file" } },
      required: ["path"],
    },
  },
  {
    name: "create_project",
    description: "Create a new Kanban project with default columns.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Short project description" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_project_task",
    description: "Add a task card to a project column.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the project file" },
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        column: { type: "string", description: "Column to add to (default: first column)" },
      },
      required: ["path", "title"],
    },
  },
  {
    name: "move_project_task",
    description: "Move a task to a different column in a project.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the project file" },
        task_id: { type: "string", description: "Task ID" },
        to_column: { type: "string", description: "Target column name" },
      },
      required: ["path", "task_id", "to_column"],
    },
  },
  {
    name: "delete_project_task",
    description: "Delete a task from a project.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path of the project file" },
        task_id: { type: "string", description: "Task ID" },
      },
      required: ["path", "task_id"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project by moving it to trash.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path of the project file" } },
      required: ["path"],
    },
  },
];

/* ── Vault Context Builder ── */

export async function buildVaultContext(vaultPath: string): Promise<string> {
  const sections: string[] = [];

  try {
    const notes = await listVaultFolder(vaultPath, "notes");
    if (notes.length > 0) {
      const flat = flattenEntries(notes).filter((e) => !e.is_dir);
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<NoteFrontmatter>(raw);
          items.push(`- ${frontmatter.title ?? entry.name} (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      if (items.length > 0) sections.push(`NOTES:\n${items.join("\n")}`);
    }
  } catch { /* no notes */ }

  try {
    const meetings = await listVaultFolder(vaultPath, "meetings");
    if (meetings.length > 0) {
      const flat = flattenEntries(meetings).filter((e) => !e.is_dir);
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<MeetingFrontmatter>(raw);
          const time = frontmatter.time ? ` at ${frontmatter.time}` : "";
          const dur = frontmatter.duration_minutes ? ` (${frontmatter.duration_minutes}min)` : "";
          items.push(`- ${frontmatter.title ?? entry.name}${time}${dur} (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      if (items.length > 0) sections.push(`MEETINGS:\n${items.join("\n")}`);
    }
  } catch { /* no meetings */ }

  try {
    const todos = await listVaultFolder(vaultPath, "todos");
    if (todos.length > 0) {
      const flat = flattenEntries(todos).filter((e) => !e.is_dir);
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const todo = parseTodoFile(entry.rel_path, raw);
          const open = todo.items.filter((i) => !i.checked).length;
          const total = todo.items.length;
          items.push(`- ${todo.frontmatter.name ?? entry.name} (${open}/${total} open) (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      if (items.length > 0) sections.push(`TODO LISTS:\n${items.join("\n")}`);
    }
  } catch { /* no todos */ }

  try {
    const projects = await listVaultFolder(vaultPath, "projects");
    if (projects.length > 0) {
      const flat = flattenEntries(projects).filter((e) => !e.is_dir);
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<ProjectFrontmatter>(raw);
          const tasks = frontmatter.tasks ?? [];
          const cols = frontmatter.columns ?? [];
          const colSummary = cols.map((c) => `${c}: ${tasks.filter((t) => t.status === c).length}`).join(", ");
          items.push(`- ${frontmatter.name ?? entry.name} [${colSummary}] (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      if (items.length > 0) sections.push(`PROJECTS:\n${items.join("\n")}`);
    }
  } catch { /* no projects */ }

  if (sections.length === 0) return "The vault is empty. No notes, meetings, todos, or projects exist yet.";

  return sections.join("\n\n");
}

function flattenEntries(entries: { name: string; rel_path: string; is_dir: boolean; children: unknown[] }[]): { name: string; rel_path: string; is_dir: boolean }[] {
  return entries.flatMap((e) =>
    e.is_dir ? flattenEntries(e.children as { name: string; rel_path: string; is_dir: boolean; children: unknown[] }[]) : [{ name: e.name, rel_path: e.rel_path, is_dir: e.is_dir }]
  );
}

/* ── Tool Executor ── */

export async function executeTool(name: string, args: Record<string, unknown>, vaultPath: string): Promise<string> {
  switch (name) {
    case "list_notes": {
      const tree = await listVaultFolder(vaultPath, "notes");
      const flat = flattenEntries(tree).filter((e) => !e.is_dir);
      if (flat.length === 0) return "No notes found.";
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<NoteFrontmatter>(raw);
          items.push(`- ${frontmatter.title ?? entry.name} (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      return items.join("\n");
    }

    case "read_note": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const { frontmatter, body } = parseFrontmatter<NoteFrontmatter>(raw);
      return `Title: ${frontmatter.title ?? "Untitled"}\nCreated: ${frontmatter.createdAt ?? "unknown"}\nTags: ${(frontmatter.tags ?? []).join(", ") || "none"}\n\n${body || "(empty)"}`;
    }

    case "create_note": {
      const title = args.title as string;
      const folder = (args.folder as string) || "notes";
      const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled";
      const relPath = `${folder}/${slug}.md`;
      const now = new Date().toISOString();
      const raw = serializeFrontmatter({ title, createdAt: now, updatedAt: now, tags: [] }, (args.body as string) || "");
      await writeFile(joinPath(vaultPath, relPath), raw);
      return `Created note "${title}" at ${relPath}`;
    }

    case "update_note": {
      const path = args.path as string;
      const raw = await readFile(joinPath(vaultPath, path));
      const { frontmatter, body } = parseFrontmatter<NoteFrontmatter>(raw);
      const updated = {
        ...frontmatter,
        ...(args.title !== undefined ? { title: args.title as string } : {}),
        updatedAt: new Date().toISOString(),
      };
      const newBody = args.body !== undefined ? (args.body as string) : body;
      await writeFile(joinPath(vaultPath, path), serializeFrontmatter(updated, newBody));
      return `Updated note at ${path}`;
    }

    case "delete_note": {
      const delPath = args.path as string;
      await deleteFile(joinPath(vaultPath, delPath));
      return `Deleted note at ${delPath}`;
    }

    case "list_meetings": {
      const tree = await listVaultFolder(vaultPath, "meetings");
      const flat = flattenEntries(tree).filter((e) => !e.is_dir);
      if (flat.length === 0) return "No meetings found.";
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<MeetingFrontmatter>(raw);
          items.push(`- ${frontmatter.title ?? entry.name} (${frontmatter.time ?? "no time"}) (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      return items.join("\n");
    }

    case "read_meeting": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const { frontmatter, body } = parseFrontmatter<MeetingFrontmatter>(raw);
      return `Title: ${frontmatter.title ?? "Untitled"}\nTime: ${frontmatter.time ?? "not set"}\nDuration: ${frontmatter.duration_minutes ?? "?"} min\nLink: ${frontmatter.link ?? "none"}\n\n${body || "(no notes)"}`;
    }

    case "create_meeting": {
      const title = args.title as string;
      const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "meeting";
      const relPath = `meetings/${slug}.md`;
      const fm: MeetingFrontmatter = {
        title,
        time: (args.time as string) || undefined,
        duration_minutes: args.duration_minutes ? parseInt(args.duration_minutes as string, 10) : undefined,
        link: (args.link as string) || undefined,
      };
      if (args.recurrence) {
        try {
          fm.recurrence = JSON.parse(args.recurrence as string) as Recurrence;
        } catch { /* ignore bad JSON */ }
      }
      await writeFile(joinPath(vaultPath, relPath), serializeFrontmatter(fm, (args.notes as string) || ""));
      return `Created meeting "${title}" at ${relPath}`;
    }

    case "update_meeting": {
      const path = args.path as string;
      const raw = await readFile(joinPath(vaultPath, path));
      const { frontmatter, body } = parseFrontmatter<MeetingFrontmatter>(raw);
      const updated = { ...frontmatter };
      if (args.title !== undefined) updated.title = args.title as string;
      if (args.time !== undefined) updated.time = args.time as string;
      if (args.duration_minutes !== undefined) updated.duration_minutes = parseInt(args.duration_minutes as string, 10);
      if (args.link !== undefined) updated.link = args.link as string;
      if (args.recurrence !== undefined) {
        if (args.recurrence === null || args.recurrence === "null" || args.recurrence === "") {
          delete updated.recurrence;
        } else {
          try {
            updated.recurrence = JSON.parse(args.recurrence as string) as Recurrence;
          } catch { /* ignore bad JSON */ }
        }
      }
      const newBody = args.notes !== undefined ? (args.notes as string) : body;
      await writeFile(joinPath(vaultPath, path), serializeFrontmatter(updated, newBody));
      return `Updated meeting at ${path}`;
    }

    case "delete_meeting": {
      await deleteFile(joinPath(vaultPath, args.path as string));
      return `Deleted meeting at ${args.path}`;
    }

    case "list_todos": {
      const tree = await listVaultFolder(vaultPath, "todos");
      const flat = flattenEntries(tree).filter((e) => !e.is_dir);
      if (flat.length === 0) return "No todo lists found.";
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const todo = parseTodoFile(entry.rel_path, raw);
          const open = todo.items.filter((i) => !i.checked).length;
          items.push(`- ${todo.frontmatter.name ?? entry.name} (${open} open) (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      return items.join("\n");
    }

    case "read_todos": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const todo = parseTodoFile(args.path as string, raw);
      const items = todo.items.map((i) => `- [${i.checked ? "x" : " "}] ${i.text} (${i.id})`).join("\n");
      return `List: ${todo.frontmatter.name ?? "Untitled"}\n\n${items || "(empty)"}`;
    }

    case "create_todo_list": {
      const name = args.name as string;
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "list";
      const relPath = `todos/${slug}.md`;
      const raw = serializeFrontmatter({ name }, "");
      await writeFile(joinPath(vaultPath, relPath), raw);
      return `Created todo list "${name}" at ${relPath}`;
    }

    case "add_todo_item": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const todo = parseTodoFile(args.path as string, raw);
      const updated = addTodoItem(todo, args.text as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeTodoFile(updated));
      return `Added "${args.text}" to ${todo.frontmatter.name ?? args.path}`;
    }

    case "toggle_todo_item": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const todo = parseTodoFile(args.path as string, raw);
      const updated = toggleTodoItem(todo, args.item_id as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeTodoFile(updated));
      const item = updated.items.find((i) => i.id === args.item_id);
      return `Toggled "${item?.text ?? args.item_id}" to ${item?.checked ? "done" : "open"}`;
    }

    case "delete_todo_item": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const todo = parseTodoFile(args.path as string, raw);
      const item = todo.items.find((i) => i.id === args.item_id);
      const updated = removeTodoItem(todo, args.item_id as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeTodoFile(updated));
      return `Removed "${item?.text ?? args.item_id}" from ${todo.frontmatter.name ?? args.path}`;
    }

    case "delete_todo_list": {
      await deleteFile(joinPath(vaultPath, args.path as string));
      return `Deleted todo list at ${args.path}`;
    }

    case "list_projects": {
      const tree = await listVaultFolder(vaultPath, "projects");
      const flat = flattenEntries(tree).filter((e) => !e.is_dir);
      if (flat.length === 0) return "No projects found.";
      const items: string[] = [];
      for (const entry of flat) {
        try {
          const raw = await readFile(joinPath(vaultPath, entry.rel_path));
          const { frontmatter } = parseFrontmatter<ProjectFrontmatter>(raw);
          const tasks = frontmatter.tasks ?? [];
          items.push(`- ${frontmatter.name ?? entry.name} (${tasks.length} tasks) (${entry.rel_path})`);
        } catch {
          items.push(`- ${entry.name} (${entry.rel_path})`);
        }
      }
      return items.join("\n");
    }

    case "read_project": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const project = parseProjectFile(args.path as string, raw);
      const cols = project.frontmatter.columns ?? [];
      const tasks = project.frontmatter.tasks ?? [];
      const lines = [`Project: ${project.frontmatter.name ?? "Untitled"}`, `Description: ${project.frontmatter.description ?? "none"}`, ""];
      for (const col of cols) {
        const colTasks = tasks.filter((t) => t.status === col);
        lines.push(`[${col}] (${colTasks.length}):`);
        for (const t of colTasks) {
          lines.push(`  - ${t.title}${t.description ? `: ${t.description}` : ""}`);
        }
      }
      return lines.join("\n");
    }

    case "create_project": {
      const name = args.name as string;
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";
      const relPath = `projects/${slug}.md`;
      const project = serializeProjectFile({
        relPath,
        frontmatter: { name, description: (args.description as string) || "", columns: ["Backlog", "To Do", "In Progress", "Done"], tasks: [] },
        body: "",
      });
      await writeFile(joinPath(vaultPath, relPath), project);
      return `Created project "${name}" at ${relPath}`;
    }

    case "add_project_task": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const project = parseProjectFile(args.path as string, raw);
      const col = (args.column as string) ?? (project.frontmatter.columns?.[0] ?? "Backlog");
      const updated = addTask(project, col, args.title as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeProjectFile(updated));
      return `Added task "${args.title}" to column "${col}" in ${(project.frontmatter.name ?? args.path)}`;
    }

    case "move_project_task": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const project = parseProjectFile(args.path as string, raw);
      const updated = moveTask(project, args.task_id as string, args.to_column as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeProjectFile(updated));
      return `Moved task ${args.task_id} to "${args.to_column}"`;
    }

    case "delete_project_task": {
      const raw = await readFile(joinPath(vaultPath, args.path as string));
      const project = parseProjectFile(args.path as string, raw);
      const updated = removeTask(project, args.task_id as string);
      await writeFile(joinPath(vaultPath, args.path as string), serializeProjectFile(updated));
      return `Deleted task ${args.task_id} from ${(project.frontmatter.name ?? args.path)}`;
    }

    case "delete_project": {
      await deleteFile(joinPath(vaultPath, args.path as string));
      return `Deleted project at ${args.path}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/* ── API Client (OpenAI-compatible) ── */

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
}

function buildHeaders(config: AiConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    if (config.provider === "anthropic") {
      headers["x-api-key"] = config.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
  }
  return headers;
}

function getEndpoint(config: AiConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  if (config.provider === "anthropic") return `${base}/v1/messages`;
  return `${base}/chat/completions`;
}

function formatToolsForApi(tools: AiToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function sendChatMessage(
  config: AiConfig,
  messages: ChatCompletionMessage[],
  tools: AiToolDefinition[],
  vaultPath: string,
): Promise<{ content: string; toolCalls: AiToolCall[] }> {
  const endpoint = getEndpoint(config);
  const headers = buildHeaders(config);

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    tools: formatToolsForApi(tools),
    tool_choice: "auto",
  };

  if (config.provider === "anthropic") {
    return sendAnthropicRequest(endpoint, headers, config, messages, tools, vaultPath);
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown error");
    throw new Error(`AI request failed (${resp.status}): ${errText}`);
  }

  const data: ChatCompletionResponse = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("No response from AI model");

  const assistantMsg = choice.message;
  const toolCalls: AiToolCall[] = [];

  if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
    let currentMessages: ChatCompletionMessage[] = [...messages, { role: "assistant", content: assistantMsg.content, tool_calls: assistantMsg.tool_calls }];

    for (const tc of assistantMsg.tool_calls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      const result = await executeTool(tc.function.name, args, vaultPath);
      toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args, result });

      currentMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    const followUp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, messages: currentMessages, tools: formatToolsForApi(tools), tool_choice: "auto" }),
    });

    if (!followUp.ok) {
      const errText = await followUp.text().catch(() => "unknown error");
      throw new Error(`AI follow-up failed (${followUp.status}): ${errText}`);
    }

    const followData: ChatCompletionResponse = await followUp.json();
    const followChoice = followData.choices?.[0];
    return { content: followChoice?.message?.content ?? "", toolCalls };
  }

  return { content: assistantMsg.content ?? "", toolCalls };
}

async function sendAnthropicRequest(
  endpoint: string,
  headers: Record<string, string>,
  config: AiConfig,
  messages: ChatCompletionMessage[],
  tools: AiToolDefinition[],
  _vaultPath: string,
): Promise<{ content: string; toolCalls: AiToolCall[] }> {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    system: systemMsg?.content ?? "",
    messages: nonSystem.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    })),
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown error");
    throw new Error(`Anthropic request failed (${resp.status}): ${errText}`);
  }

  const data = await resp.json() as {
    content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>;
  };

  const toolCalls: AiToolCall[] = [];
  const textParts: string[] = [];

  for (const block of data.content ?? []) {
    if (block.type === "text") textParts.push(block.text ?? "");
    if (block.type === "tool_use") {
      const result = await executeTool(block.name!, block.input ?? {}, _vaultPath);
      toolCalls.push({ id: block.id!, name: block.name!, arguments: block.input ?? {}, result });
    }
  }

  return { content: textParts.join("\n"), toolCalls };
}

export function getSystemPrompt(vaultContext: string): string {
  return `You are an AI assistant for TrackMe, a personal productivity app. You have access to the user's vault of notes, meetings, todos, and projects.

CURRENT VAULT CONTENTS:
${vaultContext}

CAPABILITIES:
You can read, create, update, and delete items in the vault. Use the available tools to perform CRUD operations. When the user asks you to do something with their vault items, use the appropriate tools.

GUIDELINES:
- When creating items, use clear, descriptive names
- When listing items, summarize concisely
- When the user asks to modify something, confirm what you'll do before making changes
- If an item path is ambiguous, list items first to find the correct one
- Dates should be in ISO format (YYYY-MM-DDTHH:MM:SS)
- For todo items, use the checkbox syntax: "- [ ] task" for open, "- [x] task" for done

RECURRENCE RULES (for meetings):
When a user asks for a recurring meeting, you MUST set the recurrence parameter as a JSON string with this exact schema:
{"freq":"daily"|"weekly"|"monthly"|"once","days":["mon","tue","wed","thu","fri","sat","sun"],"interval":1,"start_date":null,"end_date":null}

freq: Use "daily" for day-based patterns, "weekly" for week-based, "monthly" for month-based, "once" for no repeat.
days: Array of 3-letter day abbreviations (mon, tue, wed, thu, fri, sat, sun). For daily freq, list the specific days the meeting occurs. For weekly freq, list which days of the week.
interval: Repeat every N freq units (1 = every, 2 = every other, etc.)

EXAMPLES:
- "every day" → {"freq":"daily","days":["mon","tue","wed","thu","fri","sat","sun"],"interval":1}
- "every day except Sunday" → {"freq":"daily","days":["mon","tue","wed","thu","fri","sat"],"interval":1}
- "every weekday" → {"freq":"daily","days":["mon","tue","wed","thu","fri"],"interval":1}
- "every Monday and Wednesday" → {"freq":"weekly","days":["mon","wed"],"interval":1}
- "every 2 weeks on Friday" → {"freq":"weekly","days":["fri"],"interval":2}
- "first Monday of every month" → {"freq":"monthly","days":["mon"],"interval":1}
- "no recurrence" → {"freq":"once","days":[],"interval":1}

IMPORTANT: Do NOT use freq="weekly" for daily patterns. If the user says "every day" or "daily", use freq="daily". freq="weekly" means once per week.

Be helpful, concise, and proactive about organizing the user's data.`;
}

/* ── Streaming API Client ── */

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onToolCallStart: (id: string, name: string) => void;
  onToolCallArgs: (id: string, argsDelta: string) => void;
  onToolCallEnd: (id: string, name: string, args: Record<string, unknown>, result: string) => void;
  onDone: (fullContent: string, toolCalls: AiToolCall[]) => void;
  onError: (error: Error) => void;
}

interface StreamToolCallState {
  id: string;
  name: string;
  argsJson: string;
}

function parseSSELine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) return null;
  const data = trimmed.slice(6);
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getEndpointStreaming(config: AiConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  if (config.provider === "anthropic") return `${base}/v1/messages`;
  return `${base}/chat/completions`;
}

export async function sendChatMessageStream(
  config: AiConfig,
  messages: ChatCompletionMessage[],
  tools: AiToolDefinition[],
  vaultPath: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  if (config.provider === "anthropic") {
    return sendAnthropicStream(config, messages, tools, vaultPath, callbacks);
  }

  const endpoint = getEndpointStreaming(config);
  const headers = buildHeaders(config);
  const streamTools = formatToolsForApi(tools);

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    tools: streamTools,
    tool_choice: "auto",
    stream: true,
  };

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown error");
    callbacks.onError(new Error(`AI request failed (${resp.status}): ${errText}`));
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("Response body is not readable"));
    return;
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  const toolCallMap = new Map<string, StreamToolCallState>();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const data = parseSSELine(line);
        if (!data) continue;

        const choices = data.choices as Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string }> | undefined;
        const choice = choices?.[0];
        if (!choice?.delta) continue;

        // Text content
        if (choice.delta.content) {
          fullContent += choice.delta.content;
          callbacks.onToken(choice.delta.content);
        }

        // Tool calls (streamed incrementally)
        if (choice.delta.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = String(tc.index);
            if (!toolCallMap.has(idx)) {
              const id = tc.id ?? `tc-${idx}`;
              const name = tc.function?.name ?? "";
              toolCallMap.set(idx, { id, name, argsJson: "" });
              if (name) callbacks.onToolCallStart(id, name);
            }
            const state = toolCallMap.get(idx)!;
            if (tc.id) state.id = tc.id;
            if (tc.function?.name) {
              state.name = tc.function.name;
              callbacks.onToolCallStart(state.id, state.name);
            }
            if (tc.function?.arguments) {
              state.argsJson += tc.function.arguments;
              callbacks.onToolCallArgs(state.id, tc.function.arguments);
            }
          }
        }

        // Stream finished
        if (choice.finish_reason === "stop" || choice.finish_reason === "tool_calls") {
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Execute tool calls
  const toolCalls: AiToolCall[] = [];
  if (toolCallMap.size > 0) {
    let currentMessages: ChatCompletionMessage[] = [
      ...messages,
      { role: "assistant", content: fullContent || null, tool_calls: Array.from(toolCallMap.values()).map((s) => ({ id: s.id, type: "function" as const, function: { name: s.name, arguments: s.argsJson } })) },
    ];

    for (const [, state] of toolCallMap) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(state.argsJson);
      } catch {
        args = { raw: state.argsJson };
      }
      const result = await executeTool(state.name, args, vaultPath);
      const tc: AiToolCall = { id: state.id, name: state.name, arguments: args, result };
      toolCalls.push(tc);
      callbacks.onToolCallEnd(state.id, state.name, args, result);

      currentMessages.push({ role: "tool", tool_call_id: state.id, content: result });
    }

    // Follow-up request to get AI response after tool execution
    try {
      const followUpResp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: config.model, messages: currentMessages, tools: streamTools, tool_choice: "auto" }),
      });

      if (followUpResp.ok) {
        // If follow-up also streams, we could stream it too, but for simplicity use non-streaming for follow-up
        const followUpData = await followUpResp.json() as ChatCompletionResponse;
        const followChoice = followUpData.choices?.[0];
        const followContent = followChoice?.message?.content ?? "";
        if (followContent) {
          fullContent += (fullContent ? "\n\n" : "") + followContent;
          // Send the follow-up content as tokens
          callbacks.onToken(followContent);
        }
      }
    } catch {
      // If follow-up fails, just return what we have
    }
  }

  callbacks.onDone(fullContent, toolCalls);
}

/* ── Anthropic Streaming ── */

async function sendAnthropicStream(
  config: AiConfig,
  messages: ChatCompletionMessage[],
  tools: AiToolDefinition[],
  vaultPath: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const endpoint = getEndpointStreaming(config);
  const headers = buildHeaders(config);
  headers["anthropic-version"] = "2023-06-01";

  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    system: systemMsg?.content ?? "",
    messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    stream: true,
  };

  let resp: Response;
  try {
    resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown error");
    callbacks.onError(new Error(`Anthropic request failed (${resp.status}): ${errText}`));
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("Response body is not readable"));
    return;
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";
  const toolCallStates: Array<{ id: string; name: string; argsJson: string }> = [];
  let currentToolIdx = -1;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataStr);
        } catch {
          continue;
        }

        const type = data.type as string;

        if (type === "content_block_start") {
          const block = data.content_block as { type?: string; name?: string; id?: string } | undefined;
          if (block?.type === "tool_use") {
            currentToolIdx = toolCallStates.length;
            toolCallStates.push({ id: block.id ?? `tc-${currentToolIdx}`, name: block.name ?? "", argsJson: "" });
            callbacks.onToolCallStart(block.id ?? `tc-${currentToolIdx}`, block.name ?? "");
          }
        } else if (type === "content_block_delta") {
          const delta = data.delta as { type?: string; text?: string; partial_json?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            fullContent += delta.text;
            callbacks.onToken(delta.text);
          }
          if (delta?.type === "input_json_delta" && delta.partial_json && currentToolIdx >= 0) {
            toolCallStates[currentToolIdx].argsJson += delta.partial_json;
            callbacks.onToolCallArgs(toolCallStates[currentToolIdx].id, delta.partial_json);
          }
        } else if (type === "content_block_stop") {
          currentToolIdx = -1;
        } else if (type === "message_stop") {
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Execute tool calls
  const toolCalls: AiToolCall[] = [];
  if (toolCallStates.length > 0) {
    for (const state of toolCallStates) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(state.argsJson);
      } catch {
        args = { raw: state.argsJson };
      }
      const result = await executeTool(state.name, args, vaultPath);
      const tc: AiToolCall = { id: state.id, name: state.name, arguments: args, result };
      toolCalls.push(tc);
      callbacks.onToolCallEnd(state.id, state.name, args, result);
    }
  }

  callbacks.onDone(fullContent, toolCalls);
}
