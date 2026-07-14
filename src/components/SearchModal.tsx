import { useEffect, useRef, useState, useCallback } from "react";
import { Search, FileText, CalendarDays, CheckSquare, FolderKanban } from "lucide-react";
import { joinPath, listVaultFolder, readFile } from "../lib/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import type { VaultEntry } from "../lib/types";

interface SearchResult {
  relPath: string;
  title: string;
  snippet: string;
  tab: "notes" | "meetings" | "todos" | "projects";
}

interface Props {
  open: boolean;
  onClose: () => void;
  vaultPath: string;
  onNavigate: (tab: "notes" | "meetings" | "todos" | "projects", relPath: string) => void;
}

function flattenFiles(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap((e) => (e.is_dir ? flattenFiles(e.children) : [e]));
}

function tabForPath(relPath: string): "notes" | "meetings" | "todos" | "projects" | null {
  if (relPath.startsWith("notes/")) return "notes";
  if (relPath.startsWith("meetings/")) return "meetings";
  if (relPath.startsWith("todos/")) return "todos";
  if (relPath.startsWith("projects/")) return "projects";
  return null;
}

function highlightMatch(text: string, query: string): { text: string; highlighted: boolean }[] {
  if (!query) return [{ text, highlighted: false }];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const parts: { text: string; highlighted: boolean }[] = [];
  let lastIdx = 0;
  let idx = lower.indexOf(qLower, lastIdx);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), highlighted: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlighted: true });
    lastIdx = idx + query.length;
    idx = lower.indexOf(qLower, lastIdx);
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), highlighted: false });
  return parts;
}

function extractSnippet(body: string, query: string, maxLen = 120): string {
  if (!body.trim()) return "";
  const lower = body.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return body.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  const end = Math.min(body.length, idx + query.length + 80);
  let snippet = body.slice(start, end).replace(/\n+/g, " ");
  if (start > 0) snippet = "…" + snippet;
  if (end < body.length) snippet = snippet + "…";
  return snippet;
}

export default function SearchModal({ open, onClose, vaultPath, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const subdirs = ["notes", "meetings", "todos", "projects"];
      const allResults: SearchResult[] = [];
      const seen = new Set<string>();

      for (const sub of subdirs) {
        let tree: VaultEntry[];
        try {
          tree = await listVaultFolder(vaultPath, sub);
        } catch {
          continue;
        }
        const files = flattenFiles(tree).filter((f) => f.name.endsWith(".md"));

        for (const file of files) {
          if (seen.has(file.rel_path)) continue;
          seen.add(file.rel_path);

          let raw: string;
          try {
            raw = await readFile(joinPath(vaultPath, file.rel_path));
          } catch {
            continue;
          }

          const rawLower = raw.toLowerCase();
          const qLower = q.toLowerCase();
          if (!rawLower.includes(qLower)) continue;

          const tab = tabForPath(file.rel_path);
          if (!tab) continue;

          let title = file.name.replace(/\.md$/, "");
          let body = raw;
          try {
            const parsed = parseFrontmatter(raw);
            if (parsed.frontmatter.title) title = parsed.frontmatter.title as string;
            if (parsed.frontmatter.name) title = parsed.frontmatter.name as string;
            body = parsed.body;
          } catch {
            // use raw
          }

          allResults.push({
            relPath: file.rel_path,
            title,
            snippet: extractSnippet(body, q),
            tab,
          });
        }
      }

      setResults(allResults);
      setActiveIdx(0);
      setLoading(false);
    },
    [vaultPath],
  );

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) {
    onNavigate(result.tab, result.relPath);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      handleSelect(results[activeIdx]);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const item = listRef.current.children[activeIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, results.length]);

  if (!open) return null;

  const tabIcons: Record<string, React.ReactNode> = {
    notes: <FileText size={13} />,
    meetings: <CalendarDays size={13} />,
    todos: <CheckSquare size={13} />,
    projects: <FolderKanban size={13} />,
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 24, 20, 0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 1000,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper-raised)",
          borderRadius: "var(--radius-lg)",
          width: "min(560px, calc(100vw - 32px))",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.3)",
          border: "1px solid var(--hairline)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "60vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <Search size={16} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, meetings, todos, projects…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-soft)",
              border: "1px solid var(--hairline-strong)",
              borderRadius: 4,
              padding: "2px 6px",
              lineHeight: "16px",
            }}
          >
            esc
          </kbd>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: 13, textAlign: "center" }}>
              Searching…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: 13, textAlign: "center" }}>
              No results found.
            </div>
          )}
          {!loading &&
            results.map((r, i) => {
              const titleParts = highlightMatch(r.title, query);
              const snippetParts = highlightMatch(r.snippet, query);
              return (
                <button
                  key={r.relPath}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 16px",
                    border: "none",
                    background: i === activeIdx ? "var(--paper)" : "transparent",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                >
                  <span style={{ marginTop: 2, color: "var(--ink-soft)", flexShrink: 0 }}>
                    {tabIcons[r.tab]}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {titleParts.map((p, j) =>
                        p.highlighted ? (
                          <mark key={j} style={{ background: "rgba(176, 96, 63, 0.25)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
                            {p.text}
                          </mark>
                        ) : (
                          <span key={j}>{p.text}</span>
                        ),
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        fontFamily: "var(--font-mono)",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.relPath}
                    </div>
                    {r.snippet && (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-soft)",
                          marginTop: 3,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {snippetParts.map((p, j) =>
                          p.highlighted ? (
                            <mark key={j} style={{ background: "rgba(176, 96, 63, 0.2)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
                              {p.text}
                            </mark>
                          ) : (
                            <span key={j}>{p.text}</span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
