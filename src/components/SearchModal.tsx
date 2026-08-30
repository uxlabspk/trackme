import { useEffect, useRef, useState, useCallback } from "react";
import { Search, FileText, CalendarDays, CheckSquare, FolderKanban, X } from "lucide-react";
import { joinPath, listVaultFolder, readFile } from "../lib/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import { flattenFiles } from "../lib/path";
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

function tabForPath(relPath: string): "notes" | "meetings" | "todos" | "projects" | null {
  if (relPath.startsWith("notes/")) return "notes";
  if (relPath.startsWith("meetings/")) return "meetings";
  if (relPath.startsWith("todos/")) return "todos";
  if (relPath.startsWith("projects/")) return "projects";
  return null;
}

function highlightMatch(text: string, query: string): { text: string; highlighted: boolean }[] {
  if (!query) return [{ text, highlighted: false }];
  const lower = text.toLowerCase(), qLower = query.toLowerCase();
  const parts: { text: string; highlighted: boolean }[] = [];
  let lastIdx = 0, idx = lower.indexOf(qLower, lastIdx);
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
  const lower = body.toLowerCase(), qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return body.slice(0, maxLen);
  const start = Math.max(0, idx - 40), end = Math.min(body.length, idx + query.length + 80);
  let snippet = body.slice(start, end).replace(/\n+/g, " ");
  if (start > 0) snippet = "…" + snippet;
  if (end < body.length) snippet = snippet + "…";
  return snippet;
}

const TAB_COLORS: Record<string, string> = {
  notes: "var(--moss)",
  meetings: "var(--clay)",
  todos: "var(--slate)",
  projects: "var(--moss-deep)",
};

const TAB_LABELS: Record<string, string> = {
  notes: "Note",
  meetings: "Meeting",
  todos: "Todo",
  projects: "Project",
};

export default function SearchModal({ open, onClose, vaultPath, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); setActiveIdx(0); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const subdirs = ["notes", "meetings", "todos", "projects"];
    const allResults: SearchResult[] = [];
    const seen = new Set<string>();

    for (const sub of subdirs) {
      let tree: VaultEntry[];
      try { tree = await listVaultFolder(vaultPath, sub); } catch { continue; }
      const files = flattenFiles(tree).filter((f) => f.name.endsWith(".md"));
      for (const file of files) {
        if (seen.has(file.rel_path)) continue;
        seen.add(file.rel_path);
        let raw: string;
        try { raw = await readFile(joinPath(vaultPath, file.rel_path)); } catch { continue; }
        if (!raw.toLowerCase().includes(q.toLowerCase())) continue;
        const tab = tabForPath(file.rel_path);
        if (!tab) continue;
        let title = file.name.replace(/\.md$/, ""), body = raw;
        try {
          const parsed = parseFrontmatter(raw);
          if (parsed.frontmatter.title) title = parsed.frontmatter.title as string;
          if (parsed.frontmatter.name) title = parsed.frontmatter.name as string;
          body = parsed.body;
        } catch {}
        allResults.push({ relPath: file.rel_path, title, snippet: extractSnippet(body, q), tab });
      }
    }
    setResults(allResults);
    setActiveIdx(0);
    setLoading(false);
  }, [vaultPath]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) { onNavigate(result.tab, result.relPath); onClose(); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[activeIdx]) { handleSelect(results[activeIdx]); }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
    notes: <FileText size={12} />,
    meetings: <CalendarDays size={12} />,
    todos: <CheckSquare size={12} />,
    projects: <FolderKanban size={12} />,
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 18, 15, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "fade-in-fast 0.1s ease",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper-raised)",
          borderRadius: "var(--radius-lg)",
          width: "min(580px, calc(100vw - 32px))",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--hairline)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "65vh",
          animation: "scale-in 0.12s ease",
        }}
      >
        {/* Search input */}
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
              fontFamily: "var(--font-body)",
              color: "var(--ink)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                border: "none",
                background: "var(--paper)",
                borderRadius: "50%",
                width: 20,
                height: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-soft)",
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
          <kbd
            style={{
              fontSize: 10.5,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-soft)",
              border: "1px solid var(--hairline-strong)",
              borderRadius: 4,
              padding: "2px 6px",
              lineHeight: "16px",
              flexShrink: 0,
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
              Searching…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: "24px 16px", color: "var(--ink-soft)", fontSize: 13.5, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              No results for "{query}"
            </div>
          )}
          {!loading && !query.trim() && (
            <div style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
              Start typing to search across all your content
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
                    gap: 12,
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 16px",
                    border: "none",
                    background: i === activeIdx ? "var(--paper)" : "transparent",
                    cursor: "pointer",
                    transition: "background 0.08s",
                    borderBottom: i < results.length - 1 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  {/* Tab badge */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      marginTop: 2,
                      flexShrink: 0,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: TAB_COLORS[r.tab] ?? "var(--ink-soft)",
                      background: "var(--paper-raised)",
                      border: `1px solid var(--hairline)`,
                      borderRadius: 100,
                      padding: "2px 7px",
                      fontFamily: "var(--font-body)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {tabIcons[r.tab]}
                    {TAB_LABELS[r.tab]}
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
                        marginBottom: 2,
                      }}
                    >
                      {titleParts.map((p, j) =>
                        p.highlighted ? (
                          <mark key={j} style={{ background: "rgba(168, 91, 56, 0.2)", color: "var(--clay-deep)", borderRadius: 2, padding: "0 2px" }}>
                            {p.text}
                          </mark>
                        ) : (
                          <span key={j}>{p.text}</span>
                        )
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-soft)",
                        fontFamily: "var(--font-mono)",
                        marginBottom: r.snippet ? 4 : 0,
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
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {snippetParts.map((p, j) =>
                          p.highlighted ? (
                            <mark key={j} style={{ background: "rgba(168, 91, 56, 0.15)", color: "inherit", borderRadius: 2, padding: "0 2px" }}>
                              {p.text}
                            </mark>
                          ) : (
                            <span key={j}>{p.text}</span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--hairline)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 11.5,
              color: "var(--ink-soft)",
              fontFamily: "var(--font-mono)",
              background: "var(--paper)",
            }}
          >
            <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <span style={{ opacity: 0.6 }}>↑↓ navigate · enter select · esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
