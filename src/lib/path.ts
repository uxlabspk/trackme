import { fileExists, joinPath } from "./bridge";
import type { VaultEntry } from "./types";

/**
 * Given a vault root and a relative path (e.g. "notes/foo.md"),
 * if the file already exists on disk, append _1, _2, … until a
 * free name is found. Returns the (possibly new) relative path.
 */
export async function uniquePath(vaultPath: string, relPath: string): Promise<string> {
  const fullPath = joinPath(vaultPath, relPath);
  if (!(await fileExists(fullPath))) return relPath;

  const dotIdx = relPath.lastIndexOf(".");
  const base = dotIdx > 0 ? relPath.slice(0, dotIdx) : relPath;
  const ext = dotIdx > 0 ? relPath.slice(dotIdx) : "";

  let i = 1;
  while (await fileExists(joinPath(vaultPath, `${base}_${i}${ext}`))) i++;
  return `${base}_${i}${ext}`;
}

// ponytail: single slugify, replaces 7 copies across views/backlinks/aiChat
export function slugify(title: string, fallback = "untitled"): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback
  );
}

// ponytail: single flattenFiles, replaces 6 copies
export function flattenFiles(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap((e) => (e.is_dir ? flattenFiles(e.children) : [e]));
}

// ponytail: single sanitizeFolderName, replaces 2 copies
export function sanitizeFolderName(name: string): string {
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

// ponytail: single parentRelPath, replaces 2 copies
export function parentRelPath(relPath: string, fallbackDir = "notes"): string {
  const idx = relPath.lastIndexOf("/");
  return idx <= 0 ? fallbackDir : relPath.slice(0, idx);
}
