import matter from "gray-matter";

/** Parses a markdown file's YAML frontmatter + body. */
export function parseFrontmatter<T extends Record<string, unknown>>(
  raw: string,
): { frontmatter: T; body: string } {
  const { data, content } = matter(raw);
  return { frontmatter: data as T, body: content.replace(/^\n+/, "") };
}

/** Serializes frontmatter + body back into a markdown file with YAML frontmatter. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const cleaned = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined),
  );
  return matter.stringify(body.trimStart(), cleaned);
}
