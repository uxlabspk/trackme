import type { AiMessage, AiSession, AiToolCall } from "./types";
import { readFile, writeFile, deleteFile, joinPath, listVaultFolder, createFolder } from "./bridge";

const HISTORY_DIR = ".history";
const LAST_SESSION_KEY = "trackme.aiLastSession";

function historyDir(vaultPath: string): string {
  return joinPath(vaultPath, HISTORY_DIR);
}

function sessionPath(vaultPath: string, sessionId: string): string {
  return joinPath(vaultPath, HISTORY_DIR, `${sessionId}.md`);
}

export function generateSessionId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${ts}-${rand}`;
}

export function getLastSessionId(): string | null {
  return localStorage.getItem(LAST_SESSION_KEY);
}

export function setLastSessionId(sessionId: string | null): void {
  if (sessionId) {
    localStorage.setItem(LAST_SESSION_KEY, sessionId);
  } else {
    localStorage.removeItem(LAST_SESSION_KEY);
  }
}

/* ── Serialization ── */

function serializeSession(session: AiSession): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`id: ${session.id}`);
  lines.push(`created: ${new Date(session.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(session.updatedAt).toISOString()}`);
  lines.push(`title: "${session.title.replace(/"/g, '\\"')}"`);
  lines.push("---");
  lines.push("");

  for (const msg of session.messages) {
    lines.push(`## ${msg.role}`);
    lines.push(msg.content);
    lines.push("");

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push("### tool_calls");
      for (const tc of msg.toolCalls) {
        const argsStr = JSON.stringify(tc.arguments);
        const resultStr = tc.result ?? "(pending)";
        lines.push(`- ${tc.name}: ${argsStr} → ${resultStr}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function parseSession(raw: string, fallbackId: string): AiSession {
  const lines = raw.split("\n");
  let id = fallbackId;
  let createdAt = 0;
  let updatedAt = 0;
  let title = "";
  const messages: AiMessage[] = [];

  // Parse frontmatter
  let i = 0;
  if (lines[0]?.trim() === "---") {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") {
      const line = lines[i];
      const idMatch = line.match(/^id:\s*(.+)$/);
      const createdMatch = line.match(/^created:\s*(.+)$/);
      const updatedMatch = line.match(/^updated:\s*(.+)$/);
      const titleMatch = line.match(/^title:\s*"?(.+?)"?\s*$/);
      if (idMatch) id = idMatch[1].trim();
      if (createdMatch) createdAt = new Date(createdMatch[1].trim()).getTime();
      if (updatedMatch) updatedAt = new Date(updatedMatch[1].trim()).getTime();
      if (titleMatch) title = titleMatch[1].replace(/\\"/g, '"');
      i++;
    }
    i++; // skip closing ---
  }

  // Parse messages
  let currentRole: AiMessage["role"] | null = null;
  let contentLines: string[] = [];
  let currentToolCalls: AiToolCall[] = [];
  let inToolCalls = false;

  function flushMessage() {
    if (currentRole) {
      messages.push({
        id: `${id}-${messages.length}`,
        role: currentRole,
        content: contentLines.join("\n").trim(),
        toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
        timestamp: createdAt + messages.length * 1000,
      });
    }
    contentLines = [];
    currentToolCalls = [];
    inToolCalls = false;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const roleMatch = line.match(/^## (user|assistant|system)$/);

    if (roleMatch) {
      flushMessage();
      currentRole = roleMatch[1] as AiMessage["role"];
      continue;
    }

    if (line.trim() === "### tool_calls") {
      inToolCalls = true;
      continue;
    }

    if (inToolCalls && line.startsWith("- ")) {
      // Parse: - tool_name: {args} → result
      const tcMatch = line.match(/^- (\w+):\s*(.+?)\s*→\s*(.+)$/);
      if (tcMatch) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tcMatch[2]);
        } catch {
          args = { raw: tcMatch[2] };
        }
        currentToolCalls.push({
          id: `${id}-tc-${currentToolCalls.length}`,
          name: tcMatch[1],
          arguments: args,
          result: tcMatch[3],
        });
      }
      continue;
    }

    contentLines.push(line);
  }
  flushMessage();

  // Derive title from first user message if empty
  if (!title) {
    const firstUser = messages.find((m) => m.role === "user");
    title = firstUser?.content.slice(0, 60) || "New chat";
  }

  return {
    id,
    title,
    createdAt: createdAt || Date.now(),
    updatedAt: updatedAt || createdAt || Date.now(),
    messages,
  };
}

/* ── CRUD ── */

export async function saveSessionTo(vaultPath: string, session: AiSession): Promise<void> {
  await createFolder(historyDir(vaultPath)).catch(() => {});
  const raw = serializeSession(session);
  await writeFile(sessionPath(vaultPath, session.id), raw);
}

export async function loadSession(vaultPath: string, sessionId: string): Promise<AiSession | null> {
  try {
    const raw = await readFile(sessionPath(vaultPath, sessionId));
    return parseSession(raw, sessionId);
  } catch {
    return null;
  }
}

export async function listSessions(vaultPath: string): Promise<AiSession[]> {
  try {
    const entries = await listVaultFolder(vaultPath, HISTORY_DIR);
    const files = entries.filter((e) => !e.is_dir && e.name.endsWith(".md"));

    const sessions: AiSession[] = [];
    for (const file of files) {
      try {
        const raw = await readFile(joinPath(vaultPath, file.rel_path));
        const sessionId = file.name.replace(/\.md$/, "");
        const session = parseSession(raw, sessionId);
        sessions.push(session);
      } catch {
        // skip corrupted files
      }
    }

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;
  } catch {
    return [];
  }
}

export async function deleteSession(vaultPath: string, sessionId: string): Promise<void> {
  try {
    await deleteFile(sessionPath(vaultPath, sessionId));
  } catch {
    // ignore
  }
}

export function deriveSessionTitle(firstUserMessage: string): string {
  return firstUserMessage.slice(0, 60).replace(/\n/g, " ") || "New chat";
}
