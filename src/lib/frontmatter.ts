// ponytail: hand-rolled frontmatter parser, replaces gray-matter + Buffer polyfill

/** Parses a markdown file's YAML frontmatter + body. */
export function parseFrontmatter<T extends Record<string, unknown>>(
  raw: string,
): { frontmatter: T; body: string } {
  if (!raw.startsWith("---")) return { frontmatter: {} as T, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {} as T, body: raw };
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n+/, "");
  const fm: Record<string, unknown> = {};
  let key = "";
  let val: string | undefined = "";
  let inList = false;
  let listKey = "";
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (inList && (trimmed.startsWith("- "))) {
      (fm[listKey] as unknown[]).push(trimmed.slice(2));
      continue;
    }
    inList = false;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    key = trimmed.slice(0, colonIdx).trim();
    val = trimmed.slice(colonIdx + 1).trim();
    if (val === "") {
      fm[key] = undefined;
    } else if (val.startsWith("[")) {
      try { fm[key] = JSON.parse(val); } catch { fm[key] = val; }
    } else if (val === "true") {
      fm[key] = true;
    } else if (val === "false") {
      fm[key] = false;
    } else if (/^\d+$/.test(val)) {
      fm[key] = parseInt(val, 10);
    } else {
      fm[key] = val;
    }
  }
  return { frontmatter: fm as T, body };
}

/** Serializes frontmatter + body back into a markdown file with YAML frontmatter. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else if (typeof v === "string" && (v.includes(":") || v.includes("#"))) {
      lines.push(`${k}: "${v}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + body.trimStart();
}
