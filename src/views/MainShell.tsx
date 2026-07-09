import { useState } from "react";
import { Calendar, FileText, CalendarDays, CheckSquare, Settings, FolderKanban, Sun, Moon } from "lucide-react";
import NotesView from "./NotesView";
import MeetingsView from "./MeetingsView";
import TodosView from "./TodosView";
import AgendaView from "./AgendaView";
import ProjectsView from "./ProjectsView";
import { useTheme } from "../lib/ThemeContext";

type Tab = "agenda" | "notes" | "meetings" | "todos" | "projects";

interface Props {
  vaultPath: string;
  onSwitchVault: () => void;
}

const TABS: { id: Tab; label: string; accent: string; icon: React.ReactNode }[] = [
  {
    id: "agenda",
    label: "Today",
    accent: "var(--ink)",
    icon: <Calendar size={14} />,
  },
  {
    id: "notes",
    label: "Notes",
    accent: "var(--moss)",
    icon: <FileText size={14} />,
  },
  {
    id: "meetings",
    label: "Meetings",
    accent: "var(--clay)",
    icon: <CalendarDays size={14} />,
  },
  {
    id: "todos",
    label: "Todos",
    accent: "var(--slate)",
    icon: <CheckSquare size={14} />,
  },
  {
    id: "projects",
    label: "Projects",
    accent: "var(--moss)",
    icon: <FolderKanban size={14} />,
  },
];

export default function MainShell({ vaultPath, onSwitchVault }: Props) {
  const [tab, setTab] = useState<Tab>("agenda");
  const { theme, toggleTheme } = useTheme();
  const vaultName = vaultPath.split(/[/\\]/).filter(Boolean).pop() ?? "Vault";

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper)" }}>
      <nav
        style={{
          width: 208,
          flexShrink: 0,
          borderRight: "1px solid var(--hairline)",
          display: "flex",
          flexDirection: "column",
          padding: "18px 12px",
          background: "var(--paper)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink-soft)",
            padding: "4px 8px 16px",
            wordBreak: "break-all",
            letterSpacing: "0.02em",
          }}
          title={vaultPath}
        >
          {vaultName}/
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                padding: "9px 10px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: tab === t.id ? "var(--paper-raised)" : "transparent",
                boxShadow: tab === t.id ? "var(--shadow-sm)" : "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === t.id ? 600 : 500,
                color: "var(--ink)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (tab !== t.id) {
                  e.currentTarget.style.background = "var(--paper-raised)";
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== t.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "var(--ink-soft)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--paper-raised)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-soft)";
            }}
          >
            {theme === "light" ? <><Moon size={14} />Lights Off</> : <><Sun size={14} />Lights On</>}
          </button>
          <button
            onClick={onSwitchVault}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "var(--ink-soft)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--paper-raised)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-soft)";
            }}
          >
            <Settings size={14} />
            Switch vault
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {tab === "agenda" && <AgendaView vaultPath={vaultPath} onNavigate={setTab} />}
        {tab === "notes" && <NotesView vaultPath={vaultPath} />}
        {tab === "meetings" && <MeetingsView vaultPath={vaultPath} />}
        {tab === "todos" && <TodosView vaultPath={vaultPath} />}
        {tab === "projects" && <ProjectsView vaultPath={vaultPath} />}
      </main>
    </div>
  );
}
