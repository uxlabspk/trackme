import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Recurrence, TrashEntry, VaultEntry } from "./types";

export async function pickVaultFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose or create your TrackMe vault folder",
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] : selected;
}

export async function bootstrapVault(root: string): Promise<void> {
  await invoke("bootstrap_vault", { root });
}

export async function listVaultFolder(root: string, sub: string): Promise<VaultEntry[]> {
  return invoke("list_vault_folder", { root, sub });
}

export async function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke("file_exists", { path });
}

export async function writeFile(path: string, contents: string): Promise<void> {
  await invoke("write_file", { path, contents });
}

export async function deleteFile(path: string): Promise<void> {
  await invoke("delete_file", { path });
}

export async function createFolder(path: string): Promise<void> {
  await invoke("create_folder", { path });
}

export async function computeMeetingOccurrences(
  rule: Recurrence,
  windowStart: string,
  windowEnd: string,
): Promise<string[]> {
  return invoke("compute_meeting_occurrences", {
    ruleJson: JSON.stringify(rule),
    windowStart,
    windowEnd,
  });
}

export async function trashFile(vaultRoot: string, relPath: string): Promise<void> {
  await invoke("trash_file", { vaultRoot, relPath });
}

export async function trashFolder(vaultRoot: string, relPath: string): Promise<void> {
  await invoke("trash_folder", { vaultRoot, relPath });
}

export async function listTrash(vaultRoot: string): Promise<TrashEntry[]> {
  return invoke("list_trash", { vaultRoot });
}

export async function restoreTrash(vaultRoot: string, trashPath: string): Promise<void> {
  await invoke("restore_trash", { vaultRoot, trashPath });
}

export async function permanentDeleteTrash(vaultRoot: string, trashPath: string): Promise<void> {
  await invoke("permanent_delete_trash", { vaultRoot, trashPath });
}

export function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  return [root.replace(/[/\\]+$/, ""), ...parts].join(sep);
}

export async function setVaultPath(path: string): Promise<void> {
  await invoke("set_vault_path", { path });
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("web_search", { query });
}

export interface PaperResult {
  title: string;
  authors: string;
  year?: number;
  url: string;
  doi?: string;
  abstract_text: string;
  cited_by_count: number;
}

export async function researchPapers(query: string): Promise<PaperResult[]> {
  return invoke<PaperResult[]>("research_papers", { query });
}
