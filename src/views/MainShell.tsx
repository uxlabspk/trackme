import {useCallback, useEffect, useState} from "react";
import {Calendar, FileText, CalendarDays, CheckSquare, Settings, FolderKanban, Sun, Moon, Trash2, Search} from "lucide-react";
import NotesView from "./NotesView";
import MeetingsView from "./MeetingsView";
import TodosView from "./TodosView";
import AgendaView from "./AgendaView";
import ProjectsView from "./ProjectsView";
import TrashView from "./TrashView";
import SearchModal from "../components/SearchModal";
import {useTheme} from "../lib/ThemeContext";

type Tab = "agenda" | "notes" | "meetings" | "todos" | "projects" | "trash";

interface Props {
    vaultPath: string;
    onSwitchVault: () => void;
}

const TABS: { id: Tab; label: string; accent: string; icon: React.ReactNode }[] = [
    {
        id: "agenda",
        label: "Today",
        accent: "var(--ink)",
        icon: <Calendar size={14}/>,
    },
    {
        id: "notes",
        label: "Notes",
        accent: "var(--moss)",
        icon: <FileText size={14}/>,
    },
    {
        id: "meetings",
        label: "Meetings",
        accent: "var(--clay)",
        icon: <CalendarDays size={14}/>,
    },
    {
        id: "todos",
        label: "Todos",
        accent: "var(--slate)",
        icon: <CheckSquare size={14}/>,
    },
    {
        id: "projects",
        label: "Projects",
        accent: "var(--moss)",
        icon: <FolderKanban size={14}/>,
    }
];

export default function MainShell({vaultPath, onSwitchVault}: Props) {
    const [tab, setTab] = useState<Tab>("agenda");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTarget, setSearchTarget] = useState<{ tab: Tab; relPath: string } | null>(null);
    const {theme, toggleTheme} = useTheme();
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

    const handleSearchNavigate = useCallback((tabName: "notes" | "meetings" | "todos" | "projects", relPath: string) => {
        setTab(tabName);
        setSearchTarget({ tab: tabName, relPath });
    }, []);

    const clearSearchTarget = useCallback(() => setSearchTarget(null), []);

    return (
        <div style={{display: "flex", height: "100%", background: "var(--paper)"}}>
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

                <button
                    onClick={() => setSearchOpen(true)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12.5,
                        color: "var(--ink-soft)",
                        background: "var(--paper-raised)",
                        border: "1px solid var(--hairline-strong)",
                        cursor: "pointer",
                        padding: "7px 10px",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: 12,
                        width: "100%",
                        transition: "background 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--paper)";
                        e.currentTarget.style.color = "var(--ink)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--paper-raised)";
                        e.currentTarget.style.color = "var(--ink-soft)";
                    }}
                >
                    <Search size={14}/>
                    <span style={{flex: 1, textAlign: "left"}}>Search…</span>
                    <kbd style={{fontSize: 10, fontFamily: "var(--font-mono)", border: "1px solid var(--hairline)", borderRadius: 3, padding: "1px 4px", lineHeight: "14px"}}>⌘K</kbd>
                </button>

                <div style={{display: "flex", flexDirection: "column", gap: 2}}>
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
                                background: tab === t.id ? "#b0603f" : "transparent",
                                boxShadow: tab === t.id ? "var(--shadow-sm)" : "none",
                                cursor: "pointer",
                                fontSize: 14,
                                fontWeight: tab === t.id ? 600 : 500,
                                color: tab === t.id ? "#ffffff" : "var(--ink)",
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

                <div style={{flex: 1}}/>

                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                    <button
                        onClick={() => setTab('trash')}
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
                        <Trash2 size={14}/>
                        View Trash
                    </button>

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
                        {theme === "light" ? <><Moon size={14}/>Lights Off</> : <><Sun size={14}/>Lights On</>}
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
                        <Settings size={14}/>
                        Switch vault
                    </button>
                </div>
            </nav>

            <main style={{flex: 1, minWidth: 0, overflow: "hidden"}}>
                {tab === "agenda" && <AgendaView vaultPath={vaultPath} onNavigate={setTab}/>}
                {tab === "notes" && <NotesView vaultPath={vaultPath} searchTarget={searchTarget?.tab === "notes" ? searchTarget.relPath : null} onSearchHandled={clearSearchTarget}/>}
                {tab === "meetings" && <MeetingsView vaultPath={vaultPath} searchTarget={searchTarget?.tab === "meetings" ? searchTarget.relPath : null} onSearchHandled={clearSearchTarget}/>}
                {tab === "todos" && <TodosView vaultPath={vaultPath} searchTarget={searchTarget?.tab === "todos" ? searchTarget.relPath : null} onSearchHandled={clearSearchTarget}/>}
                {tab === "projects" && <ProjectsView vaultPath={vaultPath} searchTarget={searchTarget?.tab === "projects" ? searchTarget.relPath : null} onSearchHandled={clearSearchTarget}/>}
                {tab === "trash" && <TrashView vaultPath={vaultPath}/>}
            </main>

            <SearchModal
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                vaultPath={vaultPath}
                onNavigate={handleSearchNavigate}
            />
        </div>
    );
}
