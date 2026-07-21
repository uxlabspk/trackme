import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Settings, Send, Loader2, Wrench, ChevronDown, ChevronRight, RefreshCw, Plus, Trash2, MessageSquare } from "lucide-react";
import type { AiConfig, AiMessage, AiSession, AiToolCall } from "../lib/types";
import { loadAiConfig, saveAiConfig, isAiConfigured } from "../lib/aiConfig";
import { sendChatMessageStream, buildVaultContext, getSystemPrompt, VAULT_TOOLS, type StreamCallbacks } from "../lib/aiChat";
import { generateSessionId, getLastSessionId, setLastSessionId, saveSessionTo, loadSession, listSessions, deleteSession, deriveSessionTitle } from "../lib/aiHistory";
import AiSettingsModal from "../components/AiSettingsModal";

interface Props {
  vaultPath: string;
}

export default function AiChatView({ vaultPath }: Props) {
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
  const [historyOpen, setHistoryOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);

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
  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat history?")) return;
    await deleteSession(vaultPath, sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      setLastSessionId(null);
    }
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

    // Persist after user message
    persistSession(sessionId, nextMessages);

    try {
      const ctx = vaultContext || await buildVaultContext(vaultPath);
      const systemPrompt = getSystemPrompt(ctx);

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: text },
      ];

      let finalContent = "";
      let finalToolCalls: AiToolCall[] = [];

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

      await sendChatMessageStream(config, apiMessages, VAULT_TOOLS, vaultPath, callbacks);

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
      const errMsg: AiMessage = {
        id: genId(),
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      const finalMessages = [...nextMessages, errMsg];
      setMessages(finalMessages);
      persistSession(sessionId, finalMessages);
    } finally {
      setLoading(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSaveConfig(newConfig: AiConfig) {
    setConfig(newConfig);
    saveAiConfig(newConfig);
  }

  const configured = isAiConfigured(config);

  return (
      <div style={{ display: "flex", height: "100%" }}>
        {/* History sidebar */}
        <aside
            style={{
              width: historyOpen ? 220 : 0,
              flexShrink: 0,
              borderRight: historyOpen ? "1px solid var(--hairline)" : "none",
              overflowY: "auto",
              overflowX: "hidden",
              transition: "width 0.15s ease",
              display: "flex",
              flexDirection: "column",
            }}
        >
          {historyOpen && (
              <>
                <div style={{ padding: "14px 12px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: "var(--ink-soft)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    History
                  </h2>
                  <button
                      onClick={handleNewChat}
                      title="New chat"
                      style={{
                        border: "1px solid var(--hairline-strong)",
                        background: "var(--paper-raised)",
                        borderRadius: "var(--radius-sm)",
                        width: 22,
                        height: 22,
                        cursor: "pointer",
                        fontSize: 14,
                        color: "var(--accent-info)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                  >
                    <Plus size={12} />
                  </button>
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
              </>
          )}
        </aside>

        {/* Main chat area */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
              <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  title={historyOpen ? "Hide history" : "Show history"}
                  style={headerBtnStyle}
              >
                <MessageSquare size={14} />
              </button>
              <Bot size={18} style={{ color: "var(--accent-info)" }} />
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
                  <Bot size={48} style={{ color: "var(--hairline-strong)", opacity: 0.5 }} />
                  <div style={{ fontSize: 15, color: "var(--ink-soft)", textAlign: "center", maxWidth: 400 }}>
                    Chat with AI to manage your vault. Ask me to create, read, update, or delete notes, meetings, todos, and projects.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500 }}>
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                            style={suggestionStyle}
                        >
                          {s}
                        </button>
                    ))}
                  </div>
                </div>
            )}

            {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
            ))}

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
                placeholder={configured ? "Ask me anything about your vault..." : "Configure AI settings first..."}
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
              <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  title="Send message"
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: input.trim() && !loading ? "var(--accent-info)" : "var(--hairline)",
                    color: input.trim() && !loading ? "#fff" : "var(--ink-soft)",
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s",
                  }}
              >
                <Send size={14} />
              </button>
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

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
  );
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function MessageBubble({ message }: { message: AiMessage }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const isUser = message.role === "user";
  const isError = message.role === "system";

  return (
      <div style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "flex-start" }}>
        {!isUser ? (
            <div style={{
              ...avatarStyle,
              background: isError ? "var(--danger)" : "var(--accent-info)",
              color: "#fff",
            }}>
              {isError ? "!" : <Bot size={14} />}
            </div>
        ) : (
            <div style={{ ...avatarStyle, background: "var(--moss)", color: "#fff" }}>
              U
            </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: isError ? "var(--danger)" : "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {message.content}
          </div>

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

          <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4, fontFamily: "var(--font-mono)", opacity: 0.6 }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
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
                    <span style={{ color: "var(--moss-deep)" }}>{toolCall.result}</span>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}

const SUGGESTIONS = [
  "Show me all my notes",
  "Create a new note called 'Meeting Prep'",
  "What meetings do I have?",
  "Add a todo item to my list",
  "Show my projects and their status",
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