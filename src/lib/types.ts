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
  recurrence?: Recurrence;
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
