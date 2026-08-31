import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Calendar, FileText, CalendarDays, CheckSquare, FolderKanban,
  Sun, Moon, Trash2, Search, Bot, Network, LayoutGrid, Settings,
} from "lucide-react";
import NotesView from "./NotesView";
import GraphView from "./GraphView";
import CanvasView from "./CanvasView";
import MeetingsView from "./MeetingsView";
import TodosView from "./TodosView";
import AgendaView from "./AgendaView";
import ProjectsView from "./ProjectsView";
import TrashView from "./TrashView";
import AiChatView from "./AiChatView";
import SearchModal from "../components/SearchModal";
import VaultSwitcher from "../components/VaultSwitcher";
import { useTheme } from "../lib/ThemeContext";

type Tab = "agenda" | "notes" | "graph" | "canvas" | "meetings" | "todos" | "projects" | "ai" | "trash";

interface Props {
  vaultPath: string;
  onVaultSwitch: (path: string) => void;
}

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  group: "main" | "tools";
}

const TABS: TabDef[] = [
  { id: "agenda", label: "Today", icon: <Calendar size={15} />, group: "main" },
  { id: "notes", label: "Notes", icon: <FileText size={15} />, group: "main" },
  { id: "meetings", label: "Meetings", icon: <CalendarDays size={15} />, group: "main" },
  { id: "todos", label: "Todos", icon: <CheckSquare size={15} />, group: "main" },
  { id: "projects", label: "Projects", icon: <FolderKanban size={15} />, group: "main" },
  { id: "graph", label: "Graph", icon: <Network size={15} />, group: "tools" },
  { id: "canvas", label: "Canvas", icon: <LayoutGrid size={15} />, group: "tools" },
  { id: "ai", label: "AI", icon: <Bot size={15} />, group: "tools" },
];

export default function MainShell({ vaultPath, onVaultSwitch }: Props) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<{ tab: Tab; relPath: string } | null>(null);
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [createSignal, setCreateSignal] = useState<Record<"notes" | "meetings" | "todos" | "projects" | "canvas", number>>({
    notes: 0,
    meetings: 0,
    todos: 0,
    projects: 0,
    canvas: 0,
  });
  const [createFolderSignal, setCreateFolderSignal] = useState<Record<"notes" | "canvas", number>>({
    notes: 0,
    canvas: 0,
  });
  const { theme, toggleTheme } = useTheme();
  const vaultName = vaultPath.split(/[/\\]/).filter(Boolean).pop() ?? "Vault";

  // Each tab that has its own list/tree gets a dedicated, always-mounted
  // portal target. The view for that tab renders its list into this node;
  // we just grow/shrink it in place (dropdown/accordion style) depending on
  // whether its tab is the active one.
  const [notesSlot, setNotesSlot] = useState<HTMLDivElement | null>(null);
  const [meetingsSlot, setMeetingsSlot] = useState<HTMLDivElement | null>(null);
  const [todosSlot, setTodosSlot] = useState<HTMLDivElement | null>(null);
  const [projectsSlot, setProjectsSlot] = useState<HTMLDivElement | null>(null);
  const [canvasSlot, setCanvasSlot] = useState<HTMLDivElement | null>(null);
  const [aiSlot, setAiSlot] = useState<HTMLDivElement | null>(null);

  const listSetters: Partial<Record<Tab, (el: HTMLDivElement | null) => void>> = {
    notes: setNotesSlot,
    meetings: setMeetingsSlot,
    todos: setTodosSlot,
    projects: setProjectsSlot,
    canvas: setCanvasSlot,
    ai: setAiSlot,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchNavigate = useCallback(
    (tabName: "notes" | "meetings" | "todos" | "projects", relPath: string) => {
      setTab(tabName);
      setSearchTarget({ tab: tabName, relPath });
    },
    []
  );

  const clearSearchTarget = useCallback(() => setSearchTarget(null), []);

  const fireCreateFor = useCallback((id: "notes" | "meetings" | "todos" | "projects" | "canvas") => {
    setTab(id);
    setCreateSignal((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  }, []);

  const fireFolderCreateFor = useCallback((id: "notes" | "canvas") => {
    setTab(id);
    setCreateFolderSignal((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  }, []);

  const consumeCreateSignal = useCallback((id: "notes" | "meetings" | "todos" | "projects" | "canvas") => {
    setCreateSignal((prev) => ({ ...prev, [id]: 0 }));
  }, []);

  const consumeFolderCreateSignal = useCallback((id: "notes" | "canvas") => {
    setCreateFolderSignal((prev) => ({ ...prev, [id]: 0 }));
  }, []);

  const mainTabs = TABS.filter((t) => t.group === "main");
  const toolTabs = TABS.filter((t) => t.group === "tools");

  const renderNavItem = (t: TabDef) => {
    const setter = listSetters[t.id];
    const active = tab === t.id;
    const canCreate = (t.id === "notes" || t.id === "meetings" || t.id === "todos" || t.id === "projects" || t.id === "canvas");
    const canCreateFolder = (t.id === "notes" || t.id === "canvas");
    return (
      <Fragment key={t.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
          }}
        >
          <button
            onClick={() => setTab(t.id)}
            className={`nav-item${active ? " active" : ""}`}
            style={{ flexShrink: 0, flex: 1 }}
          >
            {t.icon}
            {t.label}
          </button>
          {canCreate && active && (
            <>
              {canCreateFolder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fireFolderCreateFor(t.id as "notes" | "canvas");
                  }}
                  className="nav-inline-action"
                  title={`Create new folder in ${t.label}`}
                  aria-label={`Create new folder in ${t.label}`}
                  style={{ fontSize: 13, lineHeight: 1, padding: "0 8px" }}
                >
                  🗁
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fireCreateFor(t.id as "notes" | "meetings" | "todos" | "projects" | "canvas");
                }}
                className="nav-inline-action"
                title={`Create new ${t.label.toLowerCase().slice(0, -1)}`}
                aria-label={`Create new ${t.label.toLowerCase().slice(0, -1)}`}
              >
                +
              </button>
            </>
          )}
        </div>
        {setter && (
          <div
            ref={setter}
            style={{
              flex: active ? "1 1 auto" : "0 0 0",
              minHeight: 0,
              overflowY: active ? "auto" : "hidden",
              overflowX: "hidden",
              transition: "flex-grow 0.15s ease",
            }}
          />
        )}
      </Fragment>
    );
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper)" }}>
      {/* ── Sidebar ── */}
      <nav
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid var(--hairline)",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
          paddingBottom: 12,
        }}
      >
        {/* App header / vault name */}
        <div
          style={{
            padding: "16px 14px 12px",
            borderBottom: "1px solid var(--hairline)",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            TrackMe
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={vaultPath}
          >
            {vaultName}/
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "0 10px 8px", flexShrink: 0 }}>
          <button
            onClick={() => setSearchOpen(true)}
            className="search-bar"
          >
            <Search size={13} />
            <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
            <kbd
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--hairline)",
                borderRadius: 3,
                padding: "1px 4px",
                lineHeight: "14px",
                opacity: 0.7,
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav + accordion lists (each active tab's list drops down in place) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "0 8px",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            overflow: "hidden",
          }}
        >

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              color: "var(--ink-soft)",
              padding: "0 2px 5px",
              textTransform: "uppercase",
              opacity: 0.65,
              flexShrink: 0,
              marginTop: 15,
              marginBottom: 15,
            }}
          >
            Main
          </div>
          {mainTabs.map(renderNavItem)}

          {/* Divider + Tools label */}
          {/* <div style={{ margin: "10px 6px 6px", borderTop: "1px solid var(--hairline)", flexShrink: 0 }} /> */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              color: "var(--ink-soft)",
              padding: "0 2px 5px",
              textTransform: "uppercase",
              opacity: 0.65,
              flexShrink: 0,
              marginTop: 15,
              marginBottom: 15,
            }}
          >
            Tools
          </div>

          {toolTabs.map(renderNavItem)}
        </div>

        {/* Utility buttons */}
        <div
          style={{
            padding: "8px 8px 0",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            borderTop: "1px solid var(--hairline)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setTab("trash")}
            className={`nav-utility${tab === "trash" ? " nav-item active" : ""}`}
          >
            <Trash2 size={13} />
            Trash
          </button>
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="nav-utility"
          >
            {theme === "light" ? <Moon size={13} /> : <Sun size={13} />}
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
          <button
            onClick={() => setVaultSwitcherOpen(true)}
            className="nav-utility"
          >
            <Settings size={13} />
            Vault Settings
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {tab === "agenda" && <AgendaView vaultPath={vaultPath} onNavigate={setTab} />}
        {tab === "notes" && (
          <NotesView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "notes" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
            sidebarSlot={notesSlot}
            triggerCreate={createSignal.notes}
            triggerFolderCreate={createFolderSignal.notes}
            onCreateConsumed={() => consumeCreateSignal("notes")}
            onFolderCreateConsumed={() => consumeFolderCreateSignal("notes")}
          />
        )}
        {tab === "graph" && <GraphView vaultPath={vaultPath} />}
        {tab === "canvas" && (
          <CanvasView
            vaultPath={vaultPath}
            sidebarSlot={canvasSlot}
            triggerCreate={createSignal.canvas}
            triggerFolderCreate={createFolderSignal.canvas}
            onCreateConsumed={() => consumeCreateSignal("canvas")}
            onFolderCreateConsumed={() => consumeFolderCreateSignal("canvas")}
          />
        )}
        {tab === "meetings" && (
          <MeetingsView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "meetings" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
            sidebarSlot={meetingsSlot}
            triggerCreate={createSignal.meetings}
            onCreateConsumed={() => consumeCreateSignal("meetings")}
          />
        )}
        {tab === "todos" && (
          <TodosView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "todos" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
            sidebarSlot={todosSlot}
            triggerCreate={createSignal.todos}
            onCreateConsumed={() => consumeCreateSignal("todos")}
          />
        )}
        {tab === "projects" && (
          <ProjectsView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "projects" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
            sidebarSlot={projectsSlot}
            triggerCreate={createSignal.projects}
            onCreateConsumed={() => consumeCreateSignal("projects")}
          />
        )}
        {tab === "ai" && <AiChatView vaultPath={vaultPath} sidebarSlot={aiSlot} />}
        {tab === "trash" && <TrashView vaultPath={vaultPath} />}
      </main>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        vaultPath={vaultPath}
        onNavigate={handleSearchNavigate}
      />

      <VaultSwitcher
        open={vaultSwitcherOpen}
        currentVault={vaultPath}
        onClose={() => setVaultSwitcherOpen(false)}
        onVaultSwitch={onVaultSwitch}
      />
    </div>
  );
}
