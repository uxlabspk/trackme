export interface VaultEntry {
  name: string;
  rel_path: string;
  is_dir: boolean;
  children: VaultEntry[];
}

export type Freq = "once" | "daily" | "weekly" | "monthly";

export interface Recurrence {
  freq: Freq;
  days: string[]; // "mon".."sun"
  interval: number;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;
}

export interface NoteFrontmatter {
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface NoteFile {
  relPath: string;
  frontmatter: NoteFrontmatter;
  body: string;
}

export interface MeetingFrontmatter {
  title?: string;
  time?: string;
  duration_minutes?: number;
  link?: string;
  recurrence?: Recurrence;
  completedDates?: string[];
  [key: string]: unknown;
}

export interface MeetingFile {
  relPath: string;
  frontmatter: MeetingFrontmatter;
  body: string;
}

export interface TodoItem {
  id: string; // stable-ish id derived from line index at load time
  text: string;
  checked: boolean;
  line: number;
}

export interface TodoFrontmatter {
  name?: string;
  [key: string]: unknown;
}

export interface TodoFile {
  relPath: string;
  frontmatter: TodoFrontmatter;
  items: TodoItem[];
  /** any non-checkbox markdown content, preserved on save */
  preambleBody: string;
}

export interface MeetingOccurrence {
  date: string; // YYYY-MM-DD
  relPath: string;
  title: string;
  time?: string;
  durationMinutes?: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: string; // column name
  createdAt?: string | null;
  doneAt?: string | null;
}

export interface ProjectFrontmatter {
  name?: string;
  description?: string;
  columns?: string[];
  tasks?: ProjectTask[];
  [key: string]: unknown;
}

export interface ProjectFile {
  relPath: string;
  frontmatter: ProjectFrontmatter;
  body: string; // freeform markdown notes, preserved on save
}

export interface TrashEntry {
  trash_path: string;
  original_path: string;
  name: string;
  is_dir: boolean;
  deleted_at: string;
}

/* ── AI Chat types ── */

export type AiProvider = "lmstudio" | "openai" | "anthropic" | "ollama" | "openrouter";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: AiToolCall[];
  timestamp: number;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface AiSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiMessage[];
}
