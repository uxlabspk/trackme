import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  computeMeetingOccurrences,
  joinPath,
  listVaultFolder,
  readFile,
} from "../lib/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import { parseTodoFile } from "../lib/todos";
import type { MeetingFrontmatter, VaultEntry } from "../lib/types";

interface Props {
  vaultPath: string;
  onNavigate: (tab: "notes" | "meetings" | "todos") => void;
}

interface TodayMeeting {
  title: string;
  time?: string;
  durationMinutes?: number;
  relPath: string;
}

interface OpenTodo {
  listName: string;
  text: string;
  relPath: string;
}

function flatten(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap((e) => (e.is_dir ? flatten(e.children) : [e]));
}

export default function AgendaView({ vaultPath, onNavigate }: Props) {
  const [meetings, setMeetings] = useState<TodayMeeting[] | null>(null);
  const [todos, setTodos] = useState<OpenTodo[] | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;

    async function loadMeetings() {
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
            relPath: entry.rel_path,
          });
        }
      }
      results.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
      if (!cancelled) setMeetings(results);
    }

    async function loadTodos() {
      const entries = flatten(await listVaultFolder(vaultPath, "todos"));
      const results: OpenTodo[] = [];
      for (const entry of entries) {
        const raw = await readFile(joinPath(vaultPath, entry.rel_path));
        const parsed = parseTodoFile(entry.rel_path, raw);
        for (const item of parsed.items) {
          if (!item.checked) {
            results.push({
              listName: parsed.frontmatter.name ?? entry.name,
              text: item.text,
              relPath: entry.rel_path,
            });
          }
        }
      }
      if (!cancelled) setTodos(results);
    }

    loadMeetings();
    loadTodos();
    return () => {
      cancelled = true;
    };
  }, [vaultPath, today]);

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
                  {m.durationMinutes && (
                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--clay-deep)" }}>
                      {m.durationMinutes} min
                    </span>
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
                  key={`${t.relPath}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--slate-soft)",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: "1.5px solid var(--slate)",
                      flexShrink: 0,
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
