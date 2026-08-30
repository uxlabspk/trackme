import { useCallback, useEffect, useState } from "react";
import { flattenFiles } from "../lib/path";
import {
  computeMeetingOccurrences,
  joinPath,
  listVaultFolder,
  readFile,
  writeFile,
} from "../lib/bridge";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import { parseTodoFile, serializeTodoFile, toggleTodoItem } from "../lib/todos";
import type { MeetingFrontmatter, TodoFile } from "../lib/types";
import { CopyIcon, Check, CalendarDays, CheckSquare, Clock } from "lucide-react";

interface Props {
  vaultPath: string;
  onNavigate: (tab: "notes" | "meetings" | "todos") => void;
}

interface TodayMeeting {
  title: string;
  time?: string;
  durationMinutes?: number;
  link?: string;
  completed: boolean;
  relPath: string;
}

interface OpenTodo {
  listName: string;
  text: string;
  relPath: string;
  itemId: string;
}

export default function AgendaView({ vaultPath, onNavigate }: Props) {
  const [meetings, setMeetings] = useState<TodayMeeting[] | null>(null);
  const [todoFiles, setTodoFiles] = useState<Record<string, TodoFile> | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat("sv-SE").format(new Date());

  const loadMeetings = useCallback(async () => {
    const entries = flattenFiles(await listVaultFolder(vaultPath, "meetings"));
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
          completed: (frontmatter.completedDates ?? []).includes(today),
          relPath: entry.rel_path,
        });
      }
    }
    results.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    return results;
  }, [vaultPath, today]);

  const loadTodoFiles = useCallback(async () => {
    const entries = flattenFiles(await listVaultFolder(vaultPath, "todos"));
    const files: Record<string, TodoFile> = {};
    for (const entry of entries) {
      const raw = await readFile(joinPath(vaultPath, entry.rel_path));
      files[entry.rel_path] = parseTodoFile(entry.rel_path, raw);
    }
    return files;
  }, [vaultPath]);

  useEffect(() => {
    let cancelled = false;
    loadMeetings().then((r) => { if (!cancelled) setMeetings(r); });
    loadTodoFiles().then((f) => { if (!cancelled) setTodoFiles(f); });
    return () => { cancelled = true; };
  }, [loadMeetings, loadTodoFiles]);

  async function handleToggleMeeting(relPath: string) {
    if (!meetings) return;
    const raw = await readFile(joinPath(vaultPath, relPath));
    const { frontmatter, body } = parseFrontmatter<MeetingFrontmatter>(raw);
    const dates = frontmatter.completedDates ?? [];
    const completed = dates.includes(today);
    const nextDates = completed ? dates.filter((d) => d !== today) : [...dates, today];
    await writeFile(joinPath(vaultPath, relPath), serializeFrontmatter({ ...frontmatter, completedDates: nextDates }, body));
    setMeetings(meetings.map((m) => m.relPath === relPath ? { ...m, completed: !completed } : m));
  }

  async function handleToggleTodo(relPath: string, itemId: string) {
    if (!todoFiles) return;
    const current = todoFiles[relPath];
    if (!current) return;
    const next = toggleTodoItem(current, itemId);
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
          }))
      )
    : null;

  const dateStr = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 680, padding: "36px 44px 60px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink-soft)",
              marginBottom: 6,
              letterSpacing: "0.04em",
            }}
          >
            {dateStr}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 34,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Today
          </h1>
        </div>

        {/* Meetings */}
        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <CalendarDays size={14} style={{ color: "var(--clay)" }} />
              <h2
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--clay-deep)",
                  letterSpacing: "0.07em",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                Meetings
              </h2>
            </div>
            <button
              onClick={() => onNavigate("meetings")}
              style={{
                border: "none",
                background: "none",
                fontSize: 12,
                color: "var(--ink-soft)",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.background = "var(--paper-raised)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-soft)"; e.currentTarget.style.background = "transparent"; }}
            >
              All meetings →
            </button>
          </div>

          {meetings === null ? (
            <Spinner color="var(--clay)" />
          ) : meetings.length === 0 ? (
            <EmptyState icon={<CalendarDays size={20} style={{ opacity: 0.35 }} />} text="No meetings scheduled today." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {meetings.map((m) => (
                <div
                  key={m.relPath}
                  className="agenda-card"
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid",
                    borderColor: m.completed ? "var(--hairline)" : "var(--clay-soft)",
                    background: m.completed ? "var(--paper-raised)" : "var(--clay-soft)",
                    overflow: "hidden",
                    opacity: m.completed ? 0.65 : 1,
                    boxShadow: m.completed ? "none" : "var(--shadow-sm)",
                  }}
                >
                  {/* Left accent stripe */}
                  <div
                    style={{
                      width: 4,
                      flexShrink: 0,
                      background: m.completed ? "var(--hairline-strong)" : "var(--clay)",
                      borderRadius: "4px 0 0 4px",
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 16px",
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleMeeting(m.relPath)}
                      aria-label={m.completed ? "Mark as not conducted" : "Mark as conducted"}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: m.completed ? "none" : "1.5px solid var(--clay)",
                        background: m.completed ? "var(--clay)" : "transparent",
                        color: "#fff",
                        flexShrink: 0,
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      {m.completed && <Check size={12} strokeWidth={3} />}
                    </button>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14.5,
                          fontWeight: 600,
                          color: m.completed ? "var(--ink-soft)" : "var(--ink)",
                          textDecoration: m.completed ? "line-through" : "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.title}
                      </div>
                      {m.durationMinutes && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 3,
                            fontSize: 12,
                            color: "var(--clay-deep)",
                          }}
                        >
                          <Clock size={11} />
                          {m.durationMinutes} min
                        </div>
                      )}
                    </div>

                    {/* Time + copy link */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      {m.time && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: m.completed ? "var(--ink-soft)" : "var(--clay-deep)",
                          }}
                        >
                          {m.time}
                        </span>
                      )}
                      {m.link?.trim() && (
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.link!.trim());
                              setCopiedLink(m.relPath);
                              setTimeout(() => setCopiedLink(null), 1600);
                            } catch {}
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            border: "none",
                            background: copiedLink === m.relPath ? "var(--moss)" : "var(--clay)",
                            color: "#fff",
                            borderRadius: "var(--radius-sm)",
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          {copiedLink === m.relPath ? <><Check size={12} /> Copied</> : <><CopyIcon size={12} /> Link</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Open Todos */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <CheckSquare size={14} style={{ color: "var(--slate)" }} />
              <h2
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--slate-deep)",
                  letterSpacing: "0.07em",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                Open Todos
              </h2>
            </div>
            <button
              onClick={() => onNavigate("todos")}
              style={{
                border: "none",
                background: "none",
                fontSize: 12,
                color: "var(--ink-soft)",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.background = "var(--paper-raised)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-soft)"; e.currentTarget.style.background = "transparent"; }}
            >
              All todos →
            </button>
          </div>

          {todos === null ? (
            <Spinner color="var(--slate)" />
          ) : todos.length === 0 ? (
            <EmptyState icon={<CheckSquare size={20} style={{ opacity: 0.35 }} />} text="Everything's checked off. Great work!" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todos.slice(0, 12).map((t, i) => (
                <div
                  key={`${t.relPath}-${t.itemId}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "9px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--paper-raised)",
                    border: "1px solid var(--hairline)",
                    transition: "box-shadow 0.12s, transform 0.12s",
                  }}
                  className="agenda-card"
                >
                  <button
                    onClick={() => handleToggleTodo(t.relPath, t.itemId)}
                    aria-label="Mark complete"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: "1.5px solid var(--slate)",
                      background: "transparent",
                      flexShrink: 0,
                      padding: 0,
                      cursor: "pointer",
                      transition: "background 0.12s, border-color 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--slate-soft)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  />
                  <span style={{ fontSize: 13.5, flex: 1, color: "var(--ink)" }}>{t.text}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-mono)",
                      background: "var(--paper)",
                      border: "1px solid var(--hairline)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 6px",
                      flexShrink: 0,
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.listName}
                  </span>
                </div>
              ))}
              {todos.length > 12 && (
                <button
                  onClick={() => onNavigate("todos")}
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "4px 2px",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  +{todos.length - 12} more — view all todos →
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-soft)", fontSize: 13, padding: "6px 0" }}>
      <div
        style={{
          width: 16,
          height: 16,
          border: `2px solid var(--hairline)`,
          borderTopColor: color,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      Loading…
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--paper-raised)",
        border: "1px solid var(--hairline)",
        color: "var(--ink-soft)",
        fontSize: 13.5,
        fontStyle: "italic",
        animation: "fade-in 0.3s ease",
      }}
    >
      {icon}
      {text}
    </div>
  );
}
