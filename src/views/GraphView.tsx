import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { listVaultFolder, readFile, joinPath } from "../lib/bridge";
import { buildGraph, type GraphData } from "../lib/backlinks";
import type { VaultEntry } from "../lib/types";
import { Network } from "lucide-react";

interface Props {
  vaultPath: string;
}

export default function GraphView({ vaultPath }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await listVaultFolder(vaultPath, "notes");
      if (cancelled) return;

      const contents = new Map<string, string>();
      const flat = (function walk(es: VaultEntry[]) {
        const out: VaultEntry[] = [];
        for (const e of es) {
          if (e.is_dir) out.push(...walk(e.children));
          else out.push(e);
        }
        return out;
      })(entries);

      await Promise.all(
        flat.map(async (f) => {
          try {
            const raw = await readFile(joinPath(vaultPath, f.rel_path));
            contents.set(f.rel_path, raw);
          } catch {
            // skip unreadable files
          }
        }),
      );

      if (!cancelled) {
        setTree(entries);
        setGraph(buildGraph(entries, contents));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vaultPath]);

  const handleNodeClick = useCallback((node: any) => {
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 1000);
    }
  }, []);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const label = node.name as string;
    const fontSize = 12;
    ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const padding = 2;
    const x = node.x ?? 0;
    const y = node.y ?? 0;

    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.beginPath();
    ctx.roundRect(
      x - textWidth / 2 - padding,
      y - fontSize / 2 - padding,
      textWidth + padding * 2,
      fontSize + padding * 2,
      3,
    );
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(label, x, y);
  }, []);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>
        Loading graph…
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--ink-soft)" }}>
        <Network size={32} />
        <div style={{ fontSize: 14 }}>No notes found. Create some notes with [[links]] to see the graph.</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: "100%" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        nodeRelSize={6}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        linkColor={() => "#999"}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        width={window.innerWidth - 208}
        height={window.innerHeight}
      />
    </div>
  );
}
