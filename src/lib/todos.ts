import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import type { TodoFile, TodoFrontmatter, TodoItem } from "./types";

const TASK_LINE = /^(\s*)-\s\[( |x|X)\]\s?(.*)$/;

export function parseTodoFile(relPath: string, raw: string): TodoFile {
  const { frontmatter, body } = parseFrontmatter<TodoFrontmatter>(raw);
  const lines = body.split("\n");
  const items: TodoItem[] = [];
  const preambleLines: string[] = [];

  lines.forEach((line, idx) => {
    const m = line.match(TASK_LINE);
    if (m) {
      items.push({
        id: `line-${idx}`,
        text: m[3],
        checked: m[2].toLowerCase() === "x",
        line: idx,
      });
    } else if (line.trim() !== "" || preambleLines.length > 0) {
      preambleLines.push(line);
    }
  });

  return {
    relPath,
    frontmatter,
    items,
    preambleBody: preambleLines.join("\n").trim(),
  };
}

export function serializeTodoFile(todo: TodoFile): string {
  const preamble = todo.preambleBody ? `${todo.preambleBody}\n\n` : "";
  const taskLines = todo.items
    .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
    .join("\n");
  return serializeFrontmatter(todo.frontmatter, `${preamble}${taskLines}\n`);
}

export function addTodoItem(todo: TodoFile, text: string): TodoFile {
  const nextLine = todo.items.length ? Math.max(...todo.items.map((i) => i.line)) + 1 : 0;
  return {
    ...todo,
    items: [...todo.items, { id: `new-${Date.now()}`, text, checked: false, line: nextLine }],
  };
}

export function toggleTodoItem(todo: TodoFile, id: string): TodoFile {
  return {
    ...todo,
    items: todo.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
  };
}

export function removeTodoItem(todo: TodoFile, id: string): TodoFile {
  return { ...todo, items: todo.items.filter((i) => i.id !== id) };
}

export function editTodoItemText(todo: TodoFile, id: string, text: string): TodoFile {
  return {
    ...todo,
    items: todo.items.map((i) => (i.id === id ? { ...i, text } : i)),
  };
}
