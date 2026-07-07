import { useState } from "react";
import NotesView from "./NotesView";
import MeetingsView from "./MeetingsView";
import TodosView from "./TodosView";
import AgendaView from "./AgendaView";

type Tab = "agenda" | "notes" | "meetings" | "todos";

interface Props {
  vaultPath: string;
  onSwitchVault: () => void;
}

const TABS: { id: Tab; label: string; accent: string }[] = [
  { id: "agenda", label: "Today", accent: "var(--ink)" },
  { id: "notes", label: "Notes", accent: "var(--moss)" },
  { id: "meetings", label: "Meetings", accent: "var(--clay)" },
  { id: "todos", label: "Todos", accent: "var(--slate)" },
];

export default function MainShell({ vaultPath, onSwitchVault }: Props) {
  const [tab, setTab] = useState<Tab>("agenda");
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
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: t.accent,
                  flexShrink: 0,
                }}
              />
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onSwitchVault}
          style={{
            fontSize: 12.5,
            color: "var(--ink-soft)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: "8px 10px",
          }}
        >
          Switch vault…
        </button>
      </nav>

      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {tab === "agenda" && <AgendaView vaultPath={vaultPath} onNavigate={setTab} />}
        {tab === "notes" && <NotesView vaultPath={vaultPath} />}
        {tab === "meetings" && <MeetingsView vaultPath={vaultPath} />}
        {tab === "todos" && <TodosView vaultPath={vaultPath} />}
      </main>
    </div>
  );
}
