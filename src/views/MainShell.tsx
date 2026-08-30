import { useCallback, useEffect, useState } from "react";
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
  { id: "agenda",   label: "Today",    icon: <Calendar size={15} />,      group: "main" },
  { id: "notes",    label: "Notes",    icon: <FileText size={15} />,      group: "main" },
  { id: "meetings", label: "Meetings", icon: <CalendarDays size={15} />,  group: "main" },
  { id: "todos",    label: "Todos",    icon: <CheckSquare size={15} />,   group: "main" },
  { id: "projects", label: "Projects", icon: <FolderKanban size={15} />,  group: "main" },
  { id: "graph",    label: "Graph",    icon: <Network size={15} />,       group: "tools" },
  { id: "canvas",   label: "Canvas",   icon: <LayoutGrid size={15} />,    group: "tools" },
  { id: "ai",       label: "AI",       icon: <Bot size={15} />,           group: "tools" },
];

export default function MainShell({ vaultPath, onVaultSwitch }: Props) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<{ tab: Tab; relPath: string } | null>(null);
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const vaultName = vaultPath.split(/[/\\]/).filter(Boolean).pop() ?? "Vault";

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

  const mainTabs = TABS.filter((t) => t.group === "main");
  const toolTabs = TABS.filter((t) => t.group === "tools");

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper)" }}>
      {/* ── Sidebar ── */}
      <nav
        style={{
          width: 210,
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
        <div style={{ padding: "0 10px 8px" }}>
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

        {/* Main nav */}
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          {mainTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-item${tab === t.id ? " active" : ""}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Divider + Tools label */}
        <div style={{ margin: "10px 14px 6px", borderTop: "1px solid var(--hairline)" }} />

        {/* Tools nav */}
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              color: "var(--ink-soft)",
              padding: "0 10px 5px",
              textTransform: "uppercase",
              opacity: 0.65,
            }}
          >
            Tools
          </div>
          {toolTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-item${tab === t.id ? " active" : ""}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Utility buttons */}
        <div
          style={{
            padding: "8px 8px 0",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            borderTop: "1px solid var(--hairline)",
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
          />
        )}
        {tab === "graph" && <GraphView vaultPath={vaultPath} />}
        {tab === "canvas" && <CanvasView vaultPath={vaultPath} />}
        {tab === "meetings" && (
          <MeetingsView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "meetings" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
          />
        )}
        {tab === "todos" && (
          <TodosView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "todos" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
          />
        )}
        {tab === "projects" && (
          <ProjectsView
            vaultPath={vaultPath}
            searchTarget={searchTarget?.tab === "projects" ? searchTarget.relPath : null}
            onSearchHandled={clearSearchTarget}
          />
        )}
        {tab === "ai" && <AiChatView vaultPath={vaultPath} />}
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
