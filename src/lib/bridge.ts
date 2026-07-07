import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Recurrence, VaultEntry } from "./types";

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

export async function writeFile(path: string, contents: string): Promise<void> {
  await invoke("write_file", { path, contents });
}

export async function deleteFile(path: string): Promise<void> {
  await invoke("delete_file", { path });
}

export async function createFolder(path: string): Promise<void> {
  await invoke("create_folder", { path });
}

export async function deleteFolder(path: string): Promise<void> {
  await invoke("delete_folder", { path });
}

export async function renameFile(from: string, to: string): Promise<void> {
  await invoke("rename_file", { from, to });
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

export function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  return [root.replace(/[/\\]+$/, ""), ...parts].join(sep);
}
