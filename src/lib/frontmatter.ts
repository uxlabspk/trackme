// ponytail: hand-rolled frontmatter parser, replaces gray-matter + Buffer polyfill

function parseYamlValue(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null" || val === "~") return null;
  if (val.startsWith("[")) {
    try { return JSON.parse(val); } catch { /* fall through */ }
  }
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

/**
 * Parses a markdown file's YAML frontmatter + body.
 *
 * Handles nested objects (e.g. recurrence: { freq, days, interval })
 * and YAML lists (e.g. days: [mon, wed, fri], completedDates: [...]).
 *
 * ponytail: hand-rolled because gray-matter needs a Buffer polyfill for Deno.
 */
export function parseFrontmatter<T extends Record<string, unknown>>(
  raw: string,
): { frontmatter: T; body: string } {
  if (!raw.startsWith("---")) return { frontmatter: {} as T, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {} as T, body: raw };
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n+/, "");
  const fm: Record<string, unknown> = {};

  // Stack: each entry is { obj, parent, key, indent }
  // obj is the nested block being filled, parent+key are how to reach it
  const stack: { obj: Record<string, unknown>; parent: Record<string, unknown>; key: string; indent: number }[] = [];

  function currentObj(): Record<string, unknown> {
    return stack.length > 0 ? stack[stack.length - 1].obj : fm;
  }

  function parentObj(): Record<string, unknown> {
    return stack.length > 0 ? stack[stack.length - 1].parent : fm;
  }

  function parentKey(): string {
    return stack.length > 0 ? stack[stack.length - 1].key : "";
  }

  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.search(/\S/);
    if (indent === -1) continue;
    const trimmed = line.trim();

    // ── List item ──────────────────────────────────────────────────────
    if (trimmed.startsWith("- ")) {
      // Pop back to the nesting level of the array container
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const pObj = parentObj();
      const k = parentKey();
      if (k && pObj[k] !== undefined) {
        const val = parseYamlValue(trimmed.slice(2).trim());
        if (Array.isArray(pObj[k])) {
          (pObj[k] as unknown[]).push(val);
        } else if (
          pObj[k] && typeof pObj[k] === "object" &&
          Object.keys(pObj[k] as Record<string, unknown>).length === 0
        ) {
          // Convert empty object to array on first list item
          pObj[k] = [val];
        }
      }
      continue;
    }

    // ── Key-value pair ─────────────────────────────────────────────────
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    // Pop back to the correct nesting level
    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const obj = currentObj();

    if (val === "") {
      // Start a nested block (object or list)
      obj[key] = {};
      stack.push({ obj: obj[key] as Record<string, unknown>, parent: obj, key, indent });
    } else {
      obj[key] = parseYamlValue(val);
    }
  }

  return { frontmatter: fm as T, body };
}

function serializeValue(v: unknown, indent: string): string[] {
  if (v === null || v === undefined) return [];
  if (typeof v === "boolean") return [`${v}`];
  if (typeof v === "number") return [`${v}`];
  if (typeof v === "string") {
    if (v.includes(":") || v.includes("#") || v.startsWith("[") || v === "") {
      return [`"${v}"`];
    }
    return [v];
  }
  if (Array.isArray(v)) {
    return v.map((item) => {
      if (typeof item === "object" && item !== null) {
        const entries = Object.entries(item as Record<string, unknown>)
          .filter(([, val]) => val !== undefined)
          .map(([k2, v2]) => `${indent}  ${k2}: ${serializeValue(v2, indent + "  ").join(", ")}`)
          .join("\n");
        return `{\n${entries}\n${indent}}`;
      }
      return `${item}`;
    });
  }
  if (typeof v === "object") {
    const lines: string[] = [];
    for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
      if (v2 === undefined) continue;
      if (Array.isArray(v2)) {
        lines.push(`${indent}  ${k2}:`);
        for (const item of v2) {
          lines.push(`${indent}    - ${item}`);
        }
      } else if (typeof v2 === "object" && v2 !== null) {
        lines.push(`${indent}  ${k2}:`);
        lines.push(...serializeValue(v2, indent + "  ").map((l) => `${indent}  ${l}`));
      } else {
        const rendered = serializeValue(v2, indent + "  ")[0] ?? `${v2}`;
        lines.push(`${indent}  ${k2}: ${rendered}`);
      }
    }
    return lines;
  }
  return [`${v}`];
}

/** Serializes frontmatter + body back into a markdown file with YAML frontmatter. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else if (typeof v === "object" && v !== null) {
      lines.push(`${k}:`);
      lines.push(...serializeValue(v, ""));
    } else if (typeof v === "string" && (v.includes(":") || v.includes("#"))) {
      lines.push(`${k}: "${v}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + body.trimStart();
}
