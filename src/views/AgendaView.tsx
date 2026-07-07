import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  computeMeetingOccurrences,
  joinPath,
  listVaultFolder,
  readFile,
  writeFile,
} from "../lib/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import { parseTodoFile, serializeTodoFile, toggleTodoItem } from "../lib/todos";
import type { MeetingFrontmatter, TodoFile, VaultEntry } from "../lib/types";
import { Copy, CopyCheck, CopyIcon } from "lucide-react";

interface Props {
  vaultPath: string;
  onNavigate: (tab: "notes" | "meetings" | "todos") => void;
}

interface TodayMeeting {
  title: string;
  time?: string;
  durationMinutes?: number;
  link?: string;
  relPath: string;
}

interface OpenTodo {
  listName: string;
  text: string;
  relPath: string;
  itemId: string;
}

function flatten(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap((e) => (e.is_dir ? flatten(e.children) : [e]));
}

export default function AgendaView({ vaultPath, onNavigate }: Props) {
  const [meetings, setMeetings] = useState<TodayMeeting[] | null>(null);
  const [todoFiles, setTodoFiles] = useState<Record<string, TodoFile> | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const loadMeetings = useCallback(async () => {
    const entries = flatten(await listVaultFolder(vaultPath, "meetings"));
    const results: TodayMeeting[] = [];
    for (const entry of entries) {
      const raw = await readFile(joinPath(vaultPath, entry.rel_path));
      const { frontmatter } = parseFrontmatter<MeetingFrontmatter>(raw);
      if (!frontmatter.recurrence) continue;
      const occ = await computeMeetingOccurrences(frontmatter.recurrence, today, today);
      if (occ.length > 0) {
        results.push({
          title: frontmatter.title ?? entry.name,
          time: frontmatter.time,
          durationMinutes: frontmatter.duration_minutes,
          link: frontmatter.link,
          relPath: entry.rel_path,
        });
      }
    }
    results.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    return results;
  }, [vaultPath, today]);

  const loadTodoFiles = useCallback(async () => {
    const entries = flatten(await listVaultFolder(vaultPath, "todos"));
    const files: Record<string, TodoFile> = {};
    for (const entry of entries) {
      const raw = await readFile(joinPath(vaultPath, entry.rel_path));
      files[entry.rel_path] = parseTodoFile(entry.rel_path, raw);
    }
    return files;
  }, [vaultPath]);

  useEffect(() => {
    let cancelled = false;
    loadMeetings().then((results) => {
      if (!cancelled) setMeetings(results);
    });
    loadTodoFiles().then((files) => {
      if (!cancelled) setTodoFiles(files);
    });
    return () => {
      cancelled = true;
    };
  }, [loadMeetings, loadTodoFiles]);

  async function handleToggleTodo(relPath: string, itemId: string) {
    if (!todoFiles) return;
    const current = todoFiles[relPath];
    if (!current) return;
    const next = toggleTodoItem(current, itemId);
    // Update UI immediately, then persist to disk.
    setTodoFiles({ ...todoFiles, [relPath]: next });
    await writeFile(joinPath(vaultPath, relPath), serializeTodoFile(next));
  }

  const todos: OpenTodo[] | null = todoFiles
    ? Object.values(todoFiles).flatMap((file) =>
      file.items
        .filter((item) => !item.checked)
        .map((item) => ({
          listName: file.frontmatter.name ?? file.relPath,
          text: item.text,
          relPath: file.relPath,
          itemId: item.id,
        })),
    )
    : null;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "36px 40px" }}>
      <div style={{ maxWidth: 640 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--ink-soft)",
            marginBottom: 4,
          }}
        >
          {format(new Date(), "EEEE, MMMM d")}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 600,
            margin: "0 0 32px",
          }}
        >
          Today
        </h1>

        <section style={{ marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--clay-deep)",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              MEETINGS
            </h2>
            <button
              onClick={() => onNavigate("meetings")}
              style={{ border: "none", background: "none", fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer" }}
            >
              View all →
            </button>
          </div>

          {meetings === null ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</p>
          ) : meetings.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 14, fontStyle: "italic" }}>
              Nothing on the calendar today.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {meetings.map((m) => (
                <div
                  key={m.relPath}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--clay-soft)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--clay-deep)",
                      minWidth: 56,
                    }}
                  >
                    {m.time ?? "—"}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>{m.title}</span>

                  <div style={{ flex: 1 }} />

                  {/* {m.durationMinutes && (
                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--clay-deep)" }}>
                      {m.durationMinutes} min
                    </span>
                  )} */}
                  {m.link?.trim() && (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(m.link!.trim());
                          // Optional: Show a toast or feedback that the link was copied
                          console.log("Link copied to clipboard!");
                        } catch (err) {
                          console.error("Failed to copy link:", err);
                        }
                      }}
                      style={{
                        marginLeft: m.durationMinutes ? 12 : "auto",
                        border: "none",
                        background: "var(--clay)",
                        color: "#fff",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 12px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <CopyIcon size={14} />
                      Copy Link
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--slate-deep)",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              OPEN TODOS
            </h2>
            <button
              onClick={() => onNavigate("todos")}
              style={{ border: "none", background: "none", fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer" }}
            >
              View all →
            </button>
          </div>

          {todos === null ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</p>
          ) : todos.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 14, fontStyle: "italic" }}>
              Everything's checked off.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todos.slice(0, 12).map((t, i) => (
                <div
                  key={`${t.relPath}-${t.itemId}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--slate-soft)",
                  }}
                >
                  <button
                    onClick={() => handleToggleTodo(t.relPath, t.itemId)}
                    aria-label="Mark complete"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: "1.5px solid var(--slate)",
                      background: "none",
                      flexShrink: 0,
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                  <span style={{ fontSize: 14 }}>{t.text}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11.5,
                      color: "var(--slate-deep)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {t.listName}
                  </span>
                </div>
              ))}
              {todos.length > 12 && (
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                  +{todos.length - 12} more
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}