import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FileTreeList from "../components/FileTreeList";
import RecurrenceEditor from "../components/RecurrenceEditor";
import Dialog from "../components/Dialog";
import {
  computeMeetingOccurrences,
  joinPath,
  listVaultFolder,
  readFile,
  trashFile,
  writeFile,
} from "../lib/bridge";
import { uniquePath, slugify } from "../lib/path";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import { useSidebarTree } from "../hooks/useSidebarTree";
import type { MeetingFile, MeetingFrontmatter, Recurrence, VaultEntry } from "../lib/types";
import { PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";

interface Props {
  vaultPath: string;
  searchTarget?: string | null;
  onSearchHandled?: () => void;
  sidebarSlot: HTMLDivElement | null;
}

function isValidRecurrence(r: unknown): r is Recurrence {
  return (
    r != null &&
    typeof r === "object" &&
    !Array.isArray(r) &&
    "freq" in r &&
    typeof (r as Recurrence).freq === "string" &&
    "days" in r &&
    Array.isArray((r as Recurrence).days)
  );
}

function ensureRecurrence(r: unknown): Recurrence {
  const def = defaultRecurrence();
  if (!isValidRecurrence(r)) return def;
  return { ...def, ...r };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDayOfWeek(d: Date): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(d);
}

function defaultRecurrence(): Recurrence {
  return {
    freq: "weekly",
    days: [],
    interval: 1,
    start_date: formatDate(new Date()),
    end_date: null,
  };
}

export default function MeetingsView({ vaultPath, searchTarget, onSearchHandled, sidebarSlot }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingFile | null>(null);
  const [occurrences, setOccurrences] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [occurrencesOpen, setOccurrencesOpen] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const { expandedIds, toggleFolder } = useSidebarTree(vaultPath, "meetings", tree, searchTarget);

  const refreshTree = useCallback(async () => {
    setTree(await listVaultFolder(vaultPath, "meetings"));
  }, [vaultPath]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    setSelected(null);
    setMeeting(null);
    setOccurrences([]);
  }, [vaultPath]);

  useEffect(() => {
    if (searchTarget) {
      setSelected(searchTarget);
      onSearchHandled?.();
    }
  }, [searchTarget, onSearchHandled]);

  useEffect(() => {
    if (!selected) {
      setMeeting(null);
      return;
    }
    let cancelled = false;
    readFile(joinPath(vaultPath, selected)).then((raw) => {
      if (cancelled) return;
      const { frontmatter, body } = parseFrontmatter<MeetingFrontmatter>(raw);
      setMeeting({
        relPath: selected,
        frontmatter: {
          ...frontmatter,
          recurrence: ensureRecurrence(frontmatter.recurrence),
        },
        body,
      });
      setDirty(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, vaultPath]);

  useEffect(() => {
    if (!meeting?.frontmatter.recurrence) {
      setOccurrences([]);
      return;
    }
    const windowStart = formatDate(new Date());
    const windowEnd = formatDate(addDays(new Date(), 90));
    computeMeetingOccurrences(meeting.frontmatter.recurrence, windowStart, windowEnd)
      .then(setOccurrences)
      .catch(() => setOccurrences([]));
  }, [meeting?.frontmatter.recurrence]);

  function persist(next: MeetingFile) {
    setDirty(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const raw = serializeFrontmatter(next.frontmatter, next.body);
      await writeFile(joinPath(vaultPath, next.relPath), raw);
      setDirty(false);
    }, 500);
  }

  async function createMeeting(title: string) {
    const relPath = await uniquePath(vaultPath, `meetings/${slugify(title)}.md`);
    const frontmatter: MeetingFrontmatter = {
      title,
      time: "09:30",
      duration_minutes: 30,
      recurrence: defaultRecurrence(),
    };
    const raw = serializeFrontmatter(frontmatter, "Agenda / notes for this meeting series go here.\n");
    await writeFile(joinPath(vaultPath, relPath), raw);
    await refreshTree();
    setSelected(relPath);
  }

  function openNewDialog() {
    setNewTitle("");
    setNewOpen(true);
  }

  async function submitNewMeeting() {
    const title = newTitle.trim();
    if (!title) return;
    setNewOpen(false);
    await createMeeting(title);
  }

  function handleDelete() {
    if (!meeting) return;
    setConfirmDeleteOpen(true);
  }

  async function doConfirmDelete() {
    if (!meeting) return;
    setConfirmDeleteOpen(false);
    await trashFile(vaultPath, meeting.relPath);
    setSelected(null);
    await refreshTree();
  }

  function updateField<K extends keyof MeetingFrontmatter>(key: K, val: MeetingFrontmatter[K]) {
    if (!meeting) return;
    const next = { ...meeting, frontmatter: { ...meeting.frontmatter, [key]: val } };
    setMeeting(next);
    persist(next);
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {sidebarSlot && createPortal(
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 14px 8px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--ink-soft)" }}>
              MEETINGS
            </h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
              onClick={openNewDialog}
              title="New meeting series"
              style={{
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper-raised)",
                borderRadius: "var(--radius-sm)",
                width: 24,
                height: 24,
                cursor: "pointer",
                fontSize: 15,
                color: "var(--clay-deep)",
              }}
            >
              +
            </button>
          </div>
          </div>
          <FileTreeList
            entries={tree}
            selectedRelPath={selected}
            onSelect={setSelected}
            emptyLabel="No meeting series yet"
            expandedIds={expandedIds}
            onToggleFolder={toggleFolder}
          />
        </>,
        sidebarSlot
      )}

      <section style={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>
        {!meeting ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-soft)",
              fontSize: 14,
              position: "relative",
            }}
          >
            Select a meeting series, or create one.
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <input
                  value={meeting.frontmatter.title ?? ""}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Meeting title"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    fontWeight: 600,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    width: "100%",
                    color: "var(--ink)",
                  }}
                />
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!occurrencesOpen && (
                  <button
                      onClick={() => setOccurrencesOpen(true)}
                      title="Show upcoming"
                      style={{
                          display: "flex",
                          alignItems: "center",
                          border: "1px solid var(--hairline-strong)",
                          background: "var(--paper-raised)",
                          borderRadius: "var(--radius-sm)",
                          padding: "6px 8px",
                          cursor: "pointer",
                          color: "var(--ink-soft)",
                      }}
                  >
                      <PanelRightOpen size={14} />
                  </button>
                  )}
                  <button
                      onClick={handleDelete}
                      style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          border: "none",
                          background: "#ff3b30",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          padding: "6px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                      }}
                  >
                      <Trash2 size={14} />
                      Remove
                  </button>
                  </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--ink-soft)",
                  marginBottom: 20,
                }}
              >
                {meeting.relPath} · {dirty ? "saving…" : "saved"}
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    TIME
                  </label>
                  <input
                    type="time"
                    value={meeting.frontmatter.time ?? ""}
                    onChange={(e) => updateField("time", e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--hairline-strong)",
                      fontSize: 14,
                      fontFamily: "var(--font-mono)",
                      background: "var(--paper-raised)",
                      color: "var(--ink)",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    DURATION (MIN)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={meeting.frontmatter.duration_minutes ?? 30}
                    onChange={(e) => updateField("duration_minutes", Number(e.target.value))}
                    style={{
                      width: 90,
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--hairline-strong)",
                      fontSize: 14,
                      background: "var(--paper-raised)",
                      color: "var(--ink)",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    MEETING LINK
                  </label>
                  <input
                    type="url"
                    value={meeting.frontmatter.link ?? ""}
                    onChange={(e) => updateField("link", e.target.value)}
                    placeholder="https://meet.google.com/…"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--hairline-strong)",
                      fontSize: 14,
                      fontFamily: "var(--font-mono)",
                      boxSizing: "border-box",
                      background: "var(--paper-raised)",
                      color: "var(--ink)",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--radius-lg)",
                  padding: 20,
                  background: "var(--paper-raised)",
                  marginBottom: 24,
                }}
              >
                <RecurrenceEditor
                  value={meeting.frontmatter.recurrence!}
                  onChange={(rec) => updateField("recurrence", rec)}
                />
              </div>

              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                AGENDA / NOTES
              </label>
              <textarea
                value={meeting.body}
                onChange={(e) => {
                  const next = { ...meeting, body: e.target.value };
                  setMeeting(next);
                  persist(next);
                }}
                rows={8}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--hairline-strong)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  resize: "vertical",
                  background: "var(--paper-raised)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <aside
              style={{
                width: occurrencesOpen ? 260 : 0,
                flexShrink: 0,
                borderLeft: occurrencesOpen ? "1px solid var(--hairline)" : "none",
                padding: occurrencesOpen ? "24px 20px" : 0,
                overflowY: "auto",
                overflowX: "hidden",
                transition: "width 0.15s ease",
              }}
            >
              {occurrencesOpen && (
              <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                NEXT 90 DAYS
              </h3>
              <button
                onClick={() => setOccurrencesOpen(false)}
                title="Hide upcoming"
                style={{
                  border: "1px solid var(--hairline-strong)",
                  background: "var(--paper-raised)",
                  borderRadius: "var(--radius-sm)",
                  width: 22,
                  height: 22,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-soft)",
                }}
              >
                <PanelRightClose size={12} />
              </button>
              </div>
              {occurrences.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic" }}>
                  No occurrences in this window.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {occurrences.map((date) => (
                    <div
                      key={date}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--clay-soft)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12.5,
                          color: "var(--clay-deep)",
                          fontWeight: 600,
                        }}
                      >
                        {formatDayOfWeek(new Date(date + "T00:00:00"))}
                      </span>
                      {meeting.frontmatter.time && (
                        <span style={{ fontSize: 12, color: "var(--clay-deep)", marginLeft: "auto" }}>
                          {meeting.frontmatter.time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </>
              )}
            </aside>
          </>
        )}
      </section>

      <Dialog
        open={newOpen}
        title="New meeting series"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button
              onClick={() => setNewOpen(false)}
              style={{
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper-raised)",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                color: "var(--ink-soft)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitNewMeeting}
              disabled={!newTitle.trim()}
              style={{
                border: "none",
                background: "var(--clay)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: newTitle.trim() ? "pointer" : "not-allowed",
                opacity: newTitle.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewMeeting();
          }}
          placeholder="Meeting series name"
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            padding: "9px 11px",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            boxSizing: "border-box",
            background: "var(--paper-raised)",
            color: "var(--ink)",
          }}
        />
      </Dialog>

      <Dialog
        open={confirmDeleteOpen}
        title="Move to trash?"
        onClose={() => setConfirmDeleteOpen(false)}
        footer={
          <>
            <button
              onClick={() => setConfirmDeleteOpen(false)}
              style={{
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper-raised)",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                color: "var(--ink-soft)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={doConfirmDelete}
              style={{
                border: "none",
                background: "#ff3b30",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Move to trash
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          &ldquo;{meeting?.frontmatter.title ?? meeting?.relPath}&rdquo; will be moved to trash.
        </p>
      </Dialog>
    </div>
  );
}
