import { useCallback, useEffect, useMemo, useState } from "react";
import type { VaultEntry } from "../lib/types";

const STORAGE_PREFIX = "trackme_expandedFolders";

function storageKey(vaultPath: string, tab: string): string {
  return `${STORAGE_PREFIX}:${vaultPath}:${tab}`;
}

function loadExpanded(vaultPath: string, tab: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(vaultPath, tab));
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveExpanded(vaultPath: string, tab: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(vaultPath, tab), JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function getAncestorFolderIds(
  entries: VaultEntry[],
  targetRelPath: string,
): string[] {
  const ancestors: string[] = [];

  function walk(list: VaultEntry[]): boolean {
    for (const entry of list) {
      if (!entry.is_dir) {
        if (entry.rel_path === targetRelPath) return true;
        continue;
      }
      if (entry.rel_path === targetRelPath) return true;
      if (walk(entry.children)) {
        ancestors.push(entry.rel_path);
        return true;
      }
    }
    return false;
  }

  walk(entries);
  return ancestors;
}

export function useSidebarTree(
  vaultPath: string,
  tab: string,
  entries: VaultEntry[],
  searchTarget?: string | null,
) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => loadExpanded(vaultPath, tab),
  );

  // Reload from localStorage when vault changes
  useEffect(() => {
    setExpandedIds(loadExpanded(vaultPath, tab));
  }, [vaultPath, tab]);

  // Persist on change
  useEffect(() => {
    saveExpanded(vaultPath, tab, expandedIds);
  }, [vaultPath, tab, expandedIds]);

  const toggleFolder = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Auto-expand ancestors when searchTarget changes
  useEffect(() => {
    if (!searchTarget || entries.length === 0) return;
    const ancestors = getAncestorFolderIds(entries, searchTarget);
    if (ancestors.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of ancestors) next.add(id);
      return next;
    });
  }, [searchTarget, entries]);

  return useMemo(
    () => ({ expandedIds, toggleFolder }),
    [expandedIds, toggleFolder],
  );
}
