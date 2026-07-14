import { fileExists, joinPath } from "./bridge";

/**
 * Given a vault root and a relative path (e.g. "notes/foo.md"),
 * if the file already exists on disk, append _1, _2, … until a
 * free name is found. Returns the (possibly new) relative path.
 */
export async function uniquePath(vaultPath: string, relPath: string): Promise<string> {
  const fullPath = joinPath(vaultPath, relPath);
  if (!(await fileExists(fullPath))) return relPath;

  const dotIdx = relPath.lastIndexOf(".");
  const base = dotIdx > 0 ? relPath.slice(0, dotIdx) : relPath;
  const ext = dotIdx > 0 ? relPath.slice(dotIdx) : "";

  let i = 1;
  while (await fileExists(joinPath(vaultPath, `${base}_${i}${ext}`))) i++;
  return `${base}_${i}${ext}`;
}
