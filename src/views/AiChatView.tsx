import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Settings, Send, Loader2, Wrench, ChevronDown, ChevronRight, RefreshCw, Plus, Trash2, MessageSquare, Square, BookOpen, Sparkles, NotebookPen, CalendarDays, CheckSquare, FolderKanban, Lightbulb, type LucideIcon, Pencil, Copy, CopyCheck } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { AiConfig, AiMessage, AiSession, AiToolCall } from "../lib/types";
import { loadAiConfig, saveAiConfig, isAiConfigured } from "../lib/aiConfig";
import { sendChatMessageStream, buildVaultContext, getSystemPrompt, VAULT_TOOLS, type StreamCallbacks } from "../lib/aiChat";
import { generateSessionId, getLastSessionId, setLastSessionId, saveSessionTo, loadSession, listSessions, deleteSession, deriveSessionTitle } from "../lib/aiHistory";
import AiSettingsModal from "../components/AiSettingsModal";
import Dialog from "../components/Dialog";

interface Props {
  vaultPath: string;
  sidebarSlot: HTMLDivElement | null;
}

export default function AiChatView({ vaultPath, sidebarSlot }: Props) {
  const [config, setConfig] = useState<AiConfig>(loadAiConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<AiToolCall[]>([]);
  const [vaultContext, setVaultContext] = useState<string>("");
  const [contextLoading, setContextLoading] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load session list
  const refreshSessions = useCallback(async () => {
    const list = await listSessions(vaultPath);
    setSessions(list);
  }, [vaultPath]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Restore last session on mount
  useEffect(() => {
    const lastId = getLastSessionId();
    if (lastId) {
      loadSession(vaultPath, lastId).then((s) => {
        if (s) {
          setCurrentSessionId(s.id);
          setMessages(s.messages);
        }
      });
    }
  }, [vaultPath]);

  // Refresh vault context
  const refreshContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const ctx = await buildVaultContext(vaultPath);
      setVaultContext(ctx);
    } catch {
      setVaultContext("(unable to load vault context)");
    }
    setContextLoading(false);
  }, [vaultPath]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // Persist session to disk
  const persistSession = useCallback(async (sessionId: string, msgs: AiMessage[]) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const title = deriveSessionTitle(msgs.find((m) => m.role === "user")?.content ?? "");
      const session: AiSession = {
        id: sessionId,
        title,
        createdAt: msgs[0]?.timestamp ?? Date.now(),
        updatedAt: Date.now(),
        messages: msgs,
      };
      await saveSessionTo(vaultPath, session);
      refreshSessions();
    }, 300);
  }, [vaultPath, refreshSessions]);

  // Start new chat
  function handleNewChat() {
    const id = generateSessionId();
    setCurrentSessionId(id);
    setMessages([]);
    setLastSessionId(id);
  }

  // Load a session
  async function handleLoadSession(sessionId: string) {
    const s = await loadSession(vaultPath, sessionId);
    if (s) {
      setCurrentSessionId(s.id);
      setMessages(s.messages);
      setLastSessionId(s.id);
    }
  }

  // Delete a session
  function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDeleteSession(sessionId);
  }

  async function doConfirmDeleteSession() {
    if (!confirmDeleteSession) return;
    await deleteSession(vaultPath, confirmDeleteSession);
    if (currentSessionId === confirmDeleteSession) {
      setCurrentSessionId(null);
      setMessages([]);
      setLastSessionId(null);
    }
    setConfirmDeleteSession(null);
    refreshSessions();
  }

  // Send message with streaming
  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    if (!isAiConfigured(config)) {
      setSettingsOpen(true);
      return;
    }

    // Ensure we have a session
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
      setLastSessionId(sessionId);
    }

    const userMsg: AiMessage = { id: genId(), role: "user", content: text, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setStreamingToolCalls([]);

    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    // Persist after user message
    persistSession(sessionId, nextMessages);

    let finalContent = "";
    let finalToolCalls: AiToolCall[] = [];

    try {
      const ctx = vaultContext || await buildVaultContext(vaultPath);
      const systemPrompt = getSystemPrompt(ctx);

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: text },
      ];

      const callbacks: StreamCallbacks = {
        onToken: (token) => {
          finalContent += token;
          setStreamingContent(finalContent);
        },
        onToolCallStart: (_id, _name) => {
          // Tool call starting - we'll show it in the streaming area
        },
        onToolCallArgs: (_id, _argsDelta) => {
          // Args streaming - could show partial args but we'll wait for completion
        },
        onToolCallEnd: (_id, name, args, result) => {
          const tc: AiToolCall = { id: _id, name, arguments: args, result };
          finalToolCalls = [...finalToolCalls, tc];
          setStreamingToolCalls([...finalToolCalls]);
        },
        onDone: (content, toolCalls) => {
          finalContent = content;
          finalToolCalls = toolCalls;
        },
        onError: (err) => {
          const errMsg: AiMessage = {
            id: genId(),
            role: "system",
            content: `Error: ${err.message}`,
            timestamp: Date.now(),
          };
          const finalMessages = [...nextMessages, errMsg];
          setMessages(finalMessages);
          persistSession(sessionId!, finalMessages);
          setLoading(false);
          setStreamingContent("");
          setStreamingToolCalls([]);
        },
      };

      await sendChatMessageStream(config, apiMessages, VAULT_TOOLS, vaultPath, callbacks, abortCtrl.signal);

      // Finalize the message
      const assistantMsg: AiMessage = {
        id: genId(),
        role: "assistant",
        content: finalContent,
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        timestamp: Date.now(),
      };
      const allMessages = [...nextMessages, assistantMsg];
      setMessages(allMessages);
      setStreamingContent("");
      setStreamingToolCalls([]);

      persistSession(sessionId, allMessages);

      if (finalToolCalls.length > 0) {
        refreshContext();
      }
    } catch (err) {
      if (abortCtrl.signal.aborted) {
        // User stopped — save whatever was generated
        if (finalContent) {
          const assistantMsg: AiMessage = {
            id: genId(),
            role: "assistant",
            content: finalContent,
            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
            timestamp: Date.now(),
          };
          const finalMessages = [...nextMessages, assistantMsg];
          setMessages(finalMessages);
          persistSession(sessionId!, finalMessages);
        }
      } else {
        const errMsg: AiMessage = {
          id: genId(),
          role: "system",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: Date.now(),
        };
        const finalMessages = [...nextMessages, errMsg];
        setMessages(finalMessages);
        persistSession(sessionId!, finalMessages);
      }
    } finally {
      setLoading(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function handleEditSubmit() {
    const text = editingContent.trim();
    if (!text || loading || !editingMessageId) return;
    if (!isAiConfigured(config)) {
      setSettingsOpen(true);
      return;
    }

    const editIndex = messages.findIndex((m) => m.id === editingMessageId);
    if (editIndex < 0) return;

    // Truncate at the edited message and replace with new content
    const truncated = messages.slice(0, editIndex);
    const editedMsg: AiMessage = { ...messages[editIndex], content: text, timestamp: Date.now() };
    const nextMessages = [...truncated, editedMsg];

    setMessages(nextMessages);
    setEditingMessageId(null);
    setEditingContent("");
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setStreamingToolCalls([]);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
      setLastSessionId(sessionId);
    }

    persistSession(sessionId, nextMessages);

    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    let finalContent = "";
    let finalToolCalls: AiToolCall[] = [];

    try {
      const ctx = vaultContext || await buildVaultContext(vaultPath);
      const systemPrompt = getSystemPrompt(ctx);

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...nextMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const callbacks: StreamCallbacks = {
        onToken: (token) => {
          finalContent += token;
          setStreamingContent(finalContent);
        },
        onToolCallStart: () => { },
        onToolCallArgs: () => { },
        onToolCallEnd: (_id, name, args, result) => {
          const tc: AiToolCall = { id: _id, name, arguments: args, result };
          finalToolCalls = [...finalToolCalls, tc];
          setStreamingToolCalls([...finalToolCalls]);
        },
        onDone: (content, toolCalls) => {
          finalContent = content;
          finalToolCalls = toolCalls;
        },
        onError: (err) => {
          const errMsg: AiMessage = { id: genId(), role: "system", content: `Error: ${err.message}`, timestamp: Date.now() };
          const allMsgs = [...nextMessages, errMsg];
          setMessages(allMsgs);
          persistSession(sessionId!, allMsgs);
          setLoading(false);
          setStreamingContent("");
          setStreamingToolCalls([]);
        },
      };

      await sendChatMessageStream(config, apiMessages, VAULT_TOOLS, vaultPath, callbacks, abortCtrl.signal);

      const assistantMsg: AiMessage = {
        id: genId(),
        role: "assistant",
        content: finalContent,
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        timestamp: Date.now(),
      };
      const allMessages = [...nextMessages, assistantMsg];
      setMessages(allMessages);
      setStreamingContent("");
      setStreamingToolCalls([]);
      persistSession(sessionId, allMessages);

      if (finalToolCalls.length > 0) refreshContext();
    } catch (err) {
      if (abortCtrl.signal.aborted) {
        if (finalContent) {
          const assistantMsg: AiMessage = {
            id: genId(), role: "assistant", content: finalContent,
            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
            timestamp: Date.now(),
          };
          const allMsgs = [...nextMessages, assistantMsg];
          setMessages(allMsgs);
          persistSession(sessionId!, allMsgs);
        }
      } else {
        const errMsg: AiMessage = {
          id: genId(), role: "system",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: Date.now(),
        };
        const allMsgs = [...nextMessages, errMsg];
        setMessages(allMsgs);
        persistSession(sessionId!, allMsgs);
      }
    } finally {
      setLoading(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
      abortRef.current = null;
    }
  }

  function handleSaveConfig(newConfig: AiConfig) {
    setConfig(newConfig);
    saveAiConfig(newConfig);
  }

  const configured = isAiConfigured(config);

  return (
    <div style={{ height: "100%" }}>
      {sidebarSlot && createPortal(
        <>
          <div style={{ padding: "0px 12px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>


          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 12px" }}>
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "12px 6px", fontStyle: "italic" }}>
                No chat history yet
              </div>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleLoadSession(s.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: currentSessionId === s.id ? "var(--accent-info)" : "transparent",
                  color: currentSessionId === s.id ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontFamily: "var(--font-body)",
                  lineHeight: 1.4,
                  marginBottom: 2,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (currentSessionId !== s.id) e.currentTarget.style.background = "var(--paper-raised)";
                }}
                onMouseLeave={(e) => {
                  if (currentSessionId !== s.id) e.currentTarget.style.background = "transparent";
                }}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                <span
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  title="Delete chat"
                  style={{
                    flexShrink: 0,
                    opacity: 0.4,
                    cursor: "pointer",
                    padding: 2,
                    display: "flex",
                  }}
                >
                  <Trash2 size={11} />
                </span>
              </button>
            ))}
          </div>
        </>,
        sidebarSlot
      )}

      {/* Main chat area */}
      <div style={{ height: "100%", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* <Bot size={18} style={{ color: "var(--accent-info)" }} /> */}
            <svg width="28px" height="28px" viewBox="0 -19.5 164 164" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.2329 89.0831C17.3341 89.4211 15.7432 89.7559 14.1371 89.9817C7.06966 90.976 1.51901 86.5687 0.48068 79.5288C-1.0289 69.307 6.73229 58.1139 14.141 55.0389C16.6482 53.9986 19.5794 53.9795 23.0364 53.3665C32.2494 32.1615 49.7618 21.7934 73.5423 20.3488C73.8921 16.4462 74.238 12.5935 74.6022 8.54059C73.5751 8.11988 72.3431 7.95977 71.6796 7.26077C70.7134 6.24344 69.5996 4.84016 69.5957 3.59771C69.5918 2.53116 70.9221 0.709891 71.8974 0.535306C74.597 0.0535535 77.542 -0.276629 80.1608 0.325233C83.5048 1.0938 83.9852 3.75262 81.8548 6.48561C81.4171 6.9389 81.1341 7.51899 81.0462 8.14288C81.224 11.6156 81.5273 15.081 81.7616 18.179C88.0211 18.7375 94.0055 19.0381 99.9211 19.8421C119.273 22.472 132.088 33.3508 139.077 51.3896C139.194 51.6909 139.333 51.9849 139.478 52.2744C139.549 52.3747 139.633 52.4656 139.727 52.5448C142.943 52.5448 146.247 52.1103 149.393 52.6347C156.138 53.7583 161.178 57.4004 162.853 64.3477C164.528 71.2951 161.862 77.0616 156.759 81.6435C151.742 86.1493 145.621 87.389 138.993 86.5404C138.746 86.7453 138.532 86.987 138.359 87.2571C130.949 104.691 117.203 114.915 99.7662 120.658C84.6227 125.684 68.3154 126.026 52.9746 121.639C36.0424 116.958 23.8017 107.182 19.2329 89.0831ZM74.3653 116.033C77.9548 115.728 81.5686 115.59 85.1292 115.09C99.4118 113.083 112.05 107.628 121.744 96.6153C138.759 77.2881 134.524 42.1123 104.846 32.3558C93.8566 28.746 82.3857 26.5243 70.7233 27.2725C57.6687 28.1106 46.2832 33.0968 37.8617 43.4256C30.0513 53.0022 26.6062 64.3694 26.3233 76.5471C25.9125 94.2223 34.5276 106.232 51.1808 112.095C58.6448 114.649 66.4731 115.979 74.362 116.032L74.3653 116.033ZM20.0205 60.3756C19.7421 60.3376 19.4597 60.3412 19.1824 60.3861C12.7641 62.2757 6.45466 73.2929 8.09026 79.6823C8.58579 81.6199 9.81316 82.7712 11.7592 82.8092C13.8765 82.8512 16.0005 82.5894 17.5501 82.4949C18.4092 74.7881 19.2099 67.6156 20.0185 60.3742L20.0205 60.3756ZM141.736 77.21C145.278 77.15 148.678 75.8064 151.305 73.4289C154.874 70.1905 155.296 65.2817 152.224 62.4522C149.242 59.7061 145.667 58.9152 141.736 59.7146V77.21Z" fill="var(--accent-info)" />
              <path d="M84.8075 82.0252C86.4018 82.3193 88.1725 82.2825 89.5331 83.0097C90.1516 83.3495 90.6946 83.8115 91.129 84.3676C91.5634 84.9238 91.8802 85.5624 92.06 86.2448C92.3344 88.1095 90.7172 89.0671 88.9411 89.2994C88.0814 89.4143 87.2076 89.3635 86.367 89.1498C84.8505 88.6937 83.2428 88.6309 81.6954 88.9674C80.148 89.304 78.7116 90.0287 77.5215 91.0734C76.1714 92.182 74.5896 93.0209 73.233 91.3781C72.0319 89.9236 72.5832 88.2348 73.7817 86.9346C75.1549 85.3673 76.8518 84.1166 78.7554 83.269C80.659 82.4214 82.7239 81.9971 84.8075 82.0252Z" fill="var(--accent-info)" />
              <path d="M57.7186 52.5112C61.4295 52.6392 63.7503 55.2876 63.5495 59.1645C63.3893 62.2533 60.9084 64.7434 58.1203 64.6154C54.9698 64.4703 52.4724 61.3206 52.607 57.6582C52.7442 53.9453 54.2853 52.3924 57.7186 52.5112Z" fill="var(--accent-info)" />
              <path d="M93.575 57.3327C93.5684 54.2361 94.7564 52.8328 97.4244 52.7856C100.873 52.7245 103.039 54.689 102.96 57.8066C102.891 60.4916 100.78 62.7678 98.3 62.8282C95.4672 62.8971 93.5822 60.7024 93.575 57.3327Z" fill="var(--accent-info)" />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
              AI Assistant
            </span>
            {!configured && (
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-warning)", background: "var(--clay-soft)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                Not configured
              </span>
            )}
            {configured && (
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-soft)", background: "var(--paper-raised)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--hairline)" }}>
                {config.provider} · {config.model}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleNewChat} title="New chat" style={headerBtnStyle}>
              <Plus size={14} />
            </button>
            <button onClick={refreshContext} disabled={contextLoading} title="Refresh vault context" style={headerBtnStyle}>
              <RefreshCw size={14} style={contextLoading ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
            <button onClick={() => setSettingsOpen(true)} title="AI Settings" style={headerBtnStyle}>
              <Settings size={14} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>

              <svg width="80px" height="80px" viewBox="0 -19.5 164 164" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.2329 89.0831C17.3341 89.4211 15.7432 89.7559 14.1371 89.9817C7.06966 90.976 1.51901 86.5687 0.48068 79.5288C-1.0289 69.307 6.73229 58.1139 14.141 55.0389C16.6482 53.9986 19.5794 53.9795 23.0364 53.3665C32.2494 32.1615 49.7618 21.7934 73.5423 20.3488C73.8921 16.4462 74.238 12.5935 74.6022 8.54059C73.5751 8.11988 72.3431 7.95977 71.6796 7.26077C70.7134 6.24344 69.5996 4.84016 69.5957 3.59771C69.5918 2.53116 70.9221 0.709891 71.8974 0.535306C74.597 0.0535535 77.542 -0.276629 80.1608 0.325233C83.5048 1.0938 83.9852 3.75262 81.8548 6.48561C81.4171 6.9389 81.1341 7.51899 81.0462 8.14288C81.224 11.6156 81.5273 15.081 81.7616 18.179C88.0211 18.7375 94.0055 19.0381 99.9211 19.8421C119.273 22.472 132.088 33.3508 139.077 51.3896C139.194 51.6909 139.333 51.9849 139.478 52.2744C139.549 52.3747 139.633 52.4656 139.727 52.5448C142.943 52.5448 146.247 52.1103 149.393 52.6347C156.138 53.7583 161.178 57.4004 162.853 64.3477C164.528 71.2951 161.862 77.0616 156.759 81.6435C151.742 86.1493 145.621 87.389 138.993 86.5404C138.746 86.7453 138.532 86.987 138.359 87.2571C130.949 104.691 117.203 114.915 99.7662 120.658C84.6227 125.684 68.3154 126.026 52.9746 121.639C36.0424 116.958 23.8017 107.182 19.2329 89.0831ZM74.3653 116.033C77.9548 115.728 81.5686 115.59 85.1292 115.09C99.4118 113.083 112.05 107.628 121.744 96.6153C138.759 77.2881 134.524 42.1123 104.846 32.3558C93.8566 28.746 82.3857 26.5243 70.7233 27.2725C57.6687 28.1106 46.2832 33.0968 37.8617 43.4256C30.0513 53.0022 26.6062 64.3694 26.3233 76.5471C25.9125 94.2223 34.5276 106.232 51.1808 112.095C58.6448 114.649 66.4731 115.979 74.362 116.032L74.3653 116.033ZM20.0205 60.3756C19.7421 60.3376 19.4597 60.3412 19.1824 60.3861C12.7641 62.2757 6.45466 73.2929 8.09026 79.6823C8.58579 81.6199 9.81316 82.7712 11.7592 82.8092C13.8765 82.8512 16.0005 82.5894 17.5501 82.4949C18.4092 74.7881 19.2099 67.6156 20.0185 60.3742L20.0205 60.3756ZM141.736 77.21C145.278 77.15 148.678 75.8064 151.305 73.4289C154.874 70.1905 155.296 65.2817 152.224 62.4522C149.242 59.7061 145.667 58.9152 141.736 59.7146V77.21Z" fill="var(--ink-soft)" />
                <path d="M84.8075 82.0252C86.4018 82.3193 88.1725 82.2825 89.5331 83.0097C90.1516 83.3495 90.6946 83.8115 91.129 84.3676C91.5634 84.9238 91.8802 85.5624 92.06 86.2448C92.3344 88.1095 90.7172 89.0671 88.9411 89.2994C88.0814 89.4143 87.2076 89.3635 86.367 89.1498C84.8505 88.6937 83.2428 88.6309 81.6954 88.9674C80.148 89.304 78.7116 90.0287 77.5215 91.0734C76.1714 92.182 74.5896 93.0209 73.233 91.3781C72.0319 89.9236 72.5832 88.2348 73.7817 86.9346C75.1549 85.3673 76.8518 84.1166 78.7554 83.269C80.659 82.4214 82.7239 81.9971 84.8075 82.0252Z" fill="var(--ink-soft)" />
                <path d="M57.7186 52.5112C61.4295 52.6392 63.7503 55.2876 63.5495 59.1645C63.3893 62.2533 60.9084 64.7434 58.1203 64.6154C54.9698 64.4703 52.4724 61.3206 52.607 57.6582C52.7442 53.9453 54.2853 52.3924 57.7186 52.5112Z" fill="var(--ink-soft)" />
                <path d="M93.575 57.3327C93.5684 54.2361 94.7564 52.8328 97.4244 52.7856C100.873 52.7245 103.039 54.689 102.96 57.8066C102.891 60.4916 100.78 62.7678 98.3 62.8282C95.4672 62.8971 93.5822 60.7024 93.575 57.3327Z" fill="var(--ink-soft)" />
              </svg>

              <div className="note-empty-state" style={{
                fontSize: 14,
                textAlign: 'center',
                maxWidth: '500px',
                color: "var(--ink-soft)",
                animation: "fade-in 0.35s ease"

              }}>
                What's on you mind today! <br />
                here are few options to get started.
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500 }}>
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      onClick={() => { setInput(s.label); textareaRef.current?.focus(); }}
                      style={suggestionStyle}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Icon size={13} />
                        <span>{s.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isEditing={editingMessageId === msg.id}
                editingContent={editingMessageId === msg.id ? editingContent : ""}
                onEditStart={(id, content) => { setEditingMessageId(id); setEditingContent(content); }}
                onEditChange={setEditingContent}
                onEditSubmit={handleEditSubmit}
                onEditCancel={() => { setEditingMessageId(null); setEditingContent(""); }}
                disabled={loading}
              />
            );
          })}

          {loading && streamingContent && (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingContent,
                toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
                timestamp: Date.now(),
              }}
            />
          )}

          {loading && !streamingContent && (
            <div style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "center" }}>
              <div style={{ ...avatarStyle, background: "var(--accent-info)", color: "#fff" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", padding: "10px 14px", fontStyle: "italic" }}>
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 24px 16px", borderTop: "1px solid var(--hairline)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--paper-raised)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={configured ? "Ask me anything — vault tasks, writing, ideas..." : "Configure AI settings first..."}
              rows={1}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                fontFamily: "var(--font-body)",
                color: "var(--ink)",
                resize: "none",
                lineHeight: 1.5,
                minHeight: 21,
                maxHeight: 160,
                display: "block",
                padding: 0,
                margin: 0,
              }}
            />
            {loading ? (
              <button
                onClick={handleStop}
                title="Stop generating"
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                title="Send message"
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: input.trim() ? "var(--accent-info)" : "var(--hairline)",
                  color: input.trim() ? "#fff" : "var(--ink-soft)",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <div style={{
            fontSize: 11,
            color: "var(--ink-soft)",
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            textAlign: "center",
          }}>
            Enter to send · Shift+Enter for newline
          </div>
        </div>
      </div>

      <AiSettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveConfig}
      />

      <Dialog
        open={confirmDeleteSession !== null}
        title="Delete chat history?"
        onClose={() => setConfirmDeleteSession(null)}
        footer={
          <>
            <button
              onClick={() => setConfirmDeleteSession(null)}
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
              onClick={doConfirmDeleteSession}
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
              Delete
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          This chat history will be permanently deleted.
        </p>
      </Dialog>
    </div>
  );
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function MessageBubble({ message, isEditing, editingContent, onEditStart, onEditChange, onEditSubmit, onEditCancel, disabled }: {
  message: AiMessage;
  isEditing: boolean;
  editingContent: string;
  onEditStart: (id: string, content: string) => void;
  onEditChange: (v: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  disabled: boolean;
}) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === "user";
  const isError = message.role === "system";

  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "flex-start" }}>
      {!isUser ? (
        <div style={{
          ...avatarStyle,
          background: isError ? "var(--danger)" : "var(--accent-info)",
          color: "#fff",
          padding: "5px"
        }}>
          {
            isError
              ?
              "!"
              :
              <svg width="80px" height="80px" viewBox="0 -19.5 164 164" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.2329 89.0831C17.3341 89.4211 15.7432 89.7559 14.1371 89.9817C7.06966 90.976 1.51901 86.5687 0.48068 79.5288C-1.0289 69.307 6.73229 58.1139 14.141 55.0389C16.6482 53.9986 19.5794 53.9795 23.0364 53.3665C32.2494 32.1615 49.7618 21.7934 73.5423 20.3488C73.8921 16.4462 74.238 12.5935 74.6022 8.54059C73.5751 8.11988 72.3431 7.95977 71.6796 7.26077C70.7134 6.24344 69.5996 4.84016 69.5957 3.59771C69.5918 2.53116 70.9221 0.709891 71.8974 0.535306C74.597 0.0535535 77.542 -0.276629 80.1608 0.325233C83.5048 1.0938 83.9852 3.75262 81.8548 6.48561C81.4171 6.9389 81.1341 7.51899 81.0462 8.14288C81.224 11.6156 81.5273 15.081 81.7616 18.179C88.0211 18.7375 94.0055 19.0381 99.9211 19.8421C119.273 22.472 132.088 33.3508 139.077 51.3896C139.194 51.6909 139.333 51.9849 139.478 52.2744C139.549 52.3747 139.633 52.4656 139.727 52.5448C142.943 52.5448 146.247 52.1103 149.393 52.6347C156.138 53.7583 161.178 57.4004 162.853 64.3477C164.528 71.2951 161.862 77.0616 156.759 81.6435C151.742 86.1493 145.621 87.389 138.993 86.5404C138.746 86.7453 138.532 86.987 138.359 87.2571C130.949 104.691 117.203 114.915 99.7662 120.658C84.6227 125.684 68.3154 126.026 52.9746 121.639C36.0424 116.958 23.8017 107.182 19.2329 89.0831ZM74.3653 116.033C77.9548 115.728 81.5686 115.59 85.1292 115.09C99.4118 113.083 112.05 107.628 121.744 96.6153C138.759 77.2881 134.524 42.1123 104.846 32.3558C93.8566 28.746 82.3857 26.5243 70.7233 27.2725C57.6687 28.1106 46.2832 33.0968 37.8617 43.4256C30.0513 53.0022 26.6062 64.3694 26.3233 76.5471C25.9125 94.2223 34.5276 106.232 51.1808 112.095C58.6448 114.649 66.4731 115.979 74.362 116.032L74.3653 116.033ZM20.0205 60.3756C19.7421 60.3376 19.4597 60.3412 19.1824 60.3861C12.7641 62.2757 6.45466 73.2929 8.09026 79.6823C8.58579 81.6199 9.81316 82.7712 11.7592 82.8092C13.8765 82.8512 16.0005 82.5894 17.5501 82.4949C18.4092 74.7881 19.2099 67.6156 20.0185 60.3742L20.0205 60.3756ZM141.736 77.21C145.278 77.15 148.678 75.8064 151.305 73.4289C154.874 70.1905 155.296 65.2817 152.224 62.4522C149.242 59.7061 145.667 58.9152 141.736 59.7146V77.21Z" fill="#ffffff" />
                <path d="M84.8075 82.0252C86.4018 82.3193 88.1725 82.2825 89.5331 83.0097C90.1516 83.3495 90.6946 83.8115 91.129 84.3676C91.5634 84.9238 91.8802 85.5624 92.06 86.2448C92.3344 88.1095 90.7172 89.0671 88.9411 89.2994C88.0814 89.4143 87.2076 89.3635 86.367 89.1498C84.8505 88.6937 83.2428 88.6309 81.6954 88.9674C80.148 89.304 78.7116 90.0287 77.5215 91.0734C76.1714 92.182 74.5896 93.0209 73.233 91.3781C72.0319 89.9236 72.5832 88.2348 73.7817 86.9346C75.1549 85.3673 76.8518 84.1166 78.7554 83.269C80.659 82.4214 82.7239 81.9971 84.8075 82.0252Z" fill="#ffffff" />
                <path d="M57.7186 52.5112C61.4295 52.6392 63.7503 55.2876 63.5495 59.1645C63.3893 62.2533 60.9084 64.7434 58.1203 64.6154C54.9698 64.4703 52.4724 61.3206 52.607 57.6582C52.7442 53.9453 54.2853 52.3924 57.7186 52.5112Z" fill="#ffffff" />
                <path d="M93.575 57.3327C93.5684 54.2361 94.7564 52.8328 97.4244 52.7856C100.873 52.7245 103.039 54.689 102.96 57.8066C102.891 60.4916 100.78 62.7678 98.3 62.8282C95.4672 62.8971 93.5822 60.7024 93.575 57.3327Z" fill="#ffffff" />
              </svg>
          }
        </div>
      ) : (
        <div style={{ ...avatarStyle, background: "var(--moss)", color: "#fff" }}>
          U
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isUser || isError ? (
          isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                ref={editRef}
                value={editingContent}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit(); }
                  if (e.key === "Escape") onEditCancel();
                }}
                autoFocus
                rows={2}
                style={{
                  width: "100%",
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "var(--font-body)",
                  color: "var(--ink)",
                  background: "var(--paper-raised)",
                  border: "1px solid var(--accent-info)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={onEditSubmit} disabled={!editingContent.trim()} style={{ ...actionBtnStyle, color: editingContent.trim() ? "var(--accent-info)" : "var(--ink-soft)", cursor: editingContent.trim() ? "pointer" : "not-allowed" }}>
                  Send
                </button>
                <button onClick={onEditCancel} style={actionBtnStyle}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: isError ? "var(--danger)" : "var(--ink)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {message.content}
            </div>
          )
        ) : (
          <div className="ai-markdown" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", wordBreak: "break-word" }}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</Markdown>
          </div>
        )}

        {message.toolCalls?.some((toolCall) => toolCall.name === "research_papers" && toolCall.result) && (
          <ResearchCitations toolCalls={message.toolCalls} />
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
                background: "var(--paper-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              <Wrench size={12} />
              {message.toolCalls.length} tool call{message.toolCalls.length > 1 ? "s" : ""}
              {toolsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {toolsExpanded && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {message.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}
          </div>
        )}

        {!isUser && !isError && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 6, opacity: 0.5, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.5"}>
            <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4, fontFamily: "var(--font-mono)", opacity: 0.6 }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            <div>
              <button
                onClick={() => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={actionBtnStyle}
                title="Copy"
              >
                {/* {copied ? <span style={{ fontSize: 11, color: "var(--moss-deep)" }}>Copied</span> : "Copy"} */}
                {
                  copied
                    ?
                    <CopyCheck width={13} />
                    :
                    <Copy width={13} />
                }
              </button>
            </div>
          </div>
        )}

        {isUser && !isError && !isEditing && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: 'space-between', gap: 4, marginTop: 6, opacity: 0.5, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.5"}>
            <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4, fontFamily: "var(--font-mono)", opacity: 0.6 }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            <div style={{ display: "flex", gap: 4 }}>

              {!disabled && (
                <button
                  onClick={() => onEditStart(message.id, message.content)}
                  style={actionBtnStyle}
                  title="Edit & resend"
                >
                  <Pencil width={13} />
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={actionBtnStyle}
                title="Copy"
              >
                {
                  copied
                    ?
                    <CopyCheck width={13} />
                    :
                    <Copy width={13} />
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ResearchCitations({ toolCalls }: { toolCalls: AiToolCall[] }) {
  type ResearchPaper = { id: string; title: string; year: string | undefined; authors?: string; url: string };

  const papers: ResearchPaper[] = toolCalls
    .filter((toolCall) => toolCall.name === "research_papers" && toolCall.result)
    .flatMap((toolCall) => (toolCall.result ?? "").split("\n\n"))
    .map((paper) => {
      const lines = paper.split("\n");
      const match = lines[0]?.match(/^\[P(\d+)\] \*\*(.+?)\*\*(?: \((\d{4})\))?$/);
      const url = lines.find((line) => line.startsWith("URL: "))?.slice(5).trim();
      if (!match || !url) return null;
      return {
        id: match[1],
        title: match[2],
        year: match[3],
        authors: lines.find((line) => line.startsWith("Authors: "))?.slice(9).trim(),
        url,
      } as ResearchPaper;
    })
    .filter((paper): paper is ResearchPaper => paper !== null);

  if (papers.length === 0) return null;

  return (
    <section style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-soft)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <BookOpen size={13} /> References
      </div>
      <ol style={{ margin: "7px 0 0", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 5 }}>
        {papers.map((paper) => (
          <li key={`${paper.id}-${paper.url}`} style={{ paddingLeft: 3, fontSize: 12, lineHeight: 1.45 }}>
            <a href={paper.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-info)", fontWeight: 600 }}>{`[P${paper.id}] ${paper.title}`}</a>
            {(paper.authors || paper.year) && <span style={{ color: "var(--ink-soft)" }}>{` — ${paper.authors ?? ""}${paper.authors && paper.year ? ", " : ""}${paper.year ?? ""}`}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ToolCallCard({ toolCall }: { toolCall: AiToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "var(--paper)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-sm)",
      padding: "6px 10px",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: "var(--accent-info)",
          padding: 0,
          width: "100%",
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ fontWeight: 600 }}>{toolCall.name}</span>
        <span style={{ color: "var(--ink-soft)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {Object.entries(toolCall.arguments).map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v).slice(0, 20)}`).join(", ")}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <span style={{ color: "var(--ink-soft)" }}>Args: </span>
            <span style={{ color: "var(--ink)" }}>{JSON.stringify(toolCall.arguments, null, 2)}</span>
          </div>
          {toolCall.result && (
            <div>
              <span style={{ color: "var(--ink-soft)" }}>Result: </span>
              <div className="ai-markdown" style={{ display: "inline", color: "var(--moss-deep)" }}>
                <Markdown remarkPlugins={[remarkGfm]}>{toolCall.result}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS: { label: string; icon: LucideIcon }[] = [
  { label: "Draft a short story about a traveler", icon: Sparkles },
  { label: "Create a note called 'Meeting Prep'", icon: NotebookPen },
  { label: "What meetings do I have today?", icon: CalendarDays },
  { label: "Add a todo item to my list", icon: CheckSquare },
  { label: "Show my projects and their status", icon: FolderKanban },
  { label: "Help me brainstorm app ideas", icon: Lightbulb },
];

const avatarStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "var(--radius-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "var(--font-body)",
};

const headerBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  border: "1px solid var(--hairline)",
  background: "var(--paper-raised)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  color: "var(--ink-soft)",
};

const actionBtnStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--ink-soft)",
  background: "transparent",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius-sm)",
  padding: "2px 8px",
  cursor: "pointer",
  transition: "background 0.1s",
};

const suggestionStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontFamily: "var(--font-body)",
  padding: "6px 12px",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--radius-md)",
  background: "var(--paper-raised)",
  color: "var(--ink-soft)",
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};