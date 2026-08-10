import type { VaultEntry } from "./types";
import { flattenFiles, slugify as sharedSlugify } from "./path";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export interface GraphNode {
  id: string;
  name: string;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function extractWikilinks(body: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(body))) {
    links.push(m[1].trim());
  }
  return links;
}

export function buildGraph(
  noteTree: VaultEntry[],
  contents: Map<string, string>,
): GraphData {
  const files = flattenFiles(noteTree).filter((f) => f.name.endsWith(".md")).map((f) => ({ relPath: f.rel_path, name: f.name }));

  const slugToFile = new Map<string, string>();
  for (const f of files) {
    const slug = sharedSlugify(f.name.replace(/\.md$/, ""));
    slugToFile.set(slug, f.relPath);
  }

  const nodes: GraphNode[] = files.map((f) => ({
    id: f.relPath,
    name: f.name.replace(/\.md$/, ""),
    val: 1,
  }));

  const linkCount = new Map<string, number>();
  const links: GraphLink[] = [];

  for (const f of files) {
    const raw = contents.get(f.relPath) ?? "";
    const targets = extractWikilinks(raw);
    for (const t of targets) {
      const slug = sharedSlugify(t);
      const targetPath = slugToFile.get(slug);
      if (targetPath && targetPath !== f.relPath) {
        links.push({ source: f.relPath, target: targetPath });
        linkCount.set(targetPath, (linkCount.get(targetPath) ?? 0) + 1);
      }
    }
  }

  for (const n of nodes) {
    n.val = 1 + (linkCount.get(n.id) ?? 0);
  }

  return { nodes, links };
}
