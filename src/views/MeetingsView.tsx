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
  triggerCreate?: number;
  onCreateConsumed?: () => void;
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

export default function MeetingsView({ vaultPath, searchTarget, onSearchHandled, sidebarSlot, triggerCreate, onCreateConsumed }: Props) {
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
    if (triggerCreate && triggerCreate > 0) {
      openNewDialog();
      onCreateConsumed?.();
    }
  }, [triggerCreate, onCreateConsumed]);

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

  const kbdStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 22,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-soft)",
    background: "var(--paper-raised)",
    border: "1px solid var(--hairline-strong)",
    borderRadius: 4,
    padding: "0 6px",
    lineHeight: 1,
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {sidebarSlot && createPortal(
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0px 14px 8px",
            }}
          >
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
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              position: "relative",
            }}
          >

            <svg width="80px" height="80px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m9 2.25c.41421 0 .75.33579.75.75v1.25h4.5v-1.25c0-.41421.3358-.75.75-.75s.75.33579.75.75v1.25h.45.0321c.8128-.00001 1.4685-.00001 1.9994.04336.5466.04467 1.0267.13902 1.471.36537.7056.35952 1.2792.9332 1.6388 1.63881.2263.44421.3207.92436.3653 1.47099.0434.53091.0434 1.18652.0434 1.99935v.03212 6.4.0321c0 .8129 0 1.4685-.0434 1.9994-.0446.5466-.139 1.0267-.3653 1.471-.3596.7056-.9332 1.2793-1.6388 1.6388-.4443.2263-.9244.3207-1.471.3653-.5309.0434-1.1865.0434-1.9994.0434h-.0321-8.4-.03212c-.81283 0-1.46844 0-1.99935-.0434-.54663-.0446-1.02678-.139-1.47099-.3653-.70561-.3595-1.27929-.9332-1.63881-1.6388-.22634-.4443-.3207-.9244-.36537-1.471-.04337-.5309-.04337-1.1865-.04336-1.9994v-.0321-6.4-.0321-.00002c-.00001-.81283-.00001-1.46844.04336-1.99935.04467-.54663.13903-1.02678.36537-1.47099.35952-.70561.9332-1.27929 1.63881-1.63881.44421-.22635.92436-.3207 1.47099-.36537.53091-.04337 1.18653-.04337 1.99937-.04336h.0321.45v-1.25c0-.41421.33579-.75.75-.75zm5.25 3.5v1.25c0 .41421.3358.75.75.75s.75-.33579.75-.75v-1.25h.45c.8525 0 1.4467.00058 1.9093.03838.4539.03708.7147.10622.9122.20686.4233.21571.7675.55992.9833.98328.1006.19752.1697.45828.2068.91216.0378.46263.0384 1.05687.0384 1.90932v6.4c0 .8525-.0006 1.4467-.0384 1.9093-.0371.4539-.1062.7147-.2068.9122-.2158.4233-.56.7675-.9833.9833-.1975.1006-.4583.1697-.9122.2068-.4626.0378-1.0568.0384-1.9093.0384h-8.4c-.85245 0-1.44669-.0006-1.90932-.0384-.45387-.0371-.71464-.1062-.91216-.2068-.42336-.2158-.76757-.56-.98328-.9833-.10064-.1975-.16977-.4583-.20686-.9122-.0378-.4626-.03838-1.0568-.03838-1.9093v-6.4c0-.85245.00058-1.44669.03838-1.90932.03709-.45388.10622-.71464.20686-.91216.21571-.42336.55992-.76757.98328-.98328.19752-.10064.45829-.16978.91216-.20686.46263-.0378 1.05687-.03838 1.90932-.03838h.45v1.25c0 .41421.33579.75.75.75s.75-.33579.75-.75v-1.25zm-6.25 4.5c-.41421 0-.75.3358-.75.75s.33579.75.75.75h8c.4142 0 .75-.3358.75-.75s-.3358-.75-.75-.75z" fill="var(--ink-soft)" fill-rule="evenodd" /></svg>

            <div className="note-empty-state" style={{ fontSize: 14, color: "var(--ink-soft)", animation: "fade-in 0.35s ease" }}>
              Select a meeting series, or create one.
            </div>

            <div className="note-empty-state" style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fade-in 0.45s ease 0.1s both" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                <kbd style={kbdStyle}>⌘K</kbd>
                <span>Search across all meeting series</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                <kbd style={kbdStyle}>+</kbd>
                <span>Create a new meeting series</span>
              </div>
            </div>
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
