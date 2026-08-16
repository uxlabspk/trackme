import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { listVaultFolder, readFile, joinPath } from "../lib/bridge";
import { buildGraph, type GraphData } from "../lib/backlinks";
import type { VaultEntry } from "../lib/types";
import { Network, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Props {
  vaultPath: string;
}

function getThemeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function getCachedColor(varName: string): string {
  if (!(window as any).__colorCache) (window as any).__colorCache = {};
  const cache = (window as any).__colorCache as Record<string, string>;
  if (!cache[varName]) cache[varName] = getThemeColor(varName);
  return cache[varName];
}

function color(name: string): string {
  return getCachedColor(`--${name}`);
}

function flattenFiles(entries: VaultEntry[]): VaultEntry[] {
  const out: VaultEntry[] = [];
  for (const e of entries) {
    if (e.is_dir) out.push(...flattenFiles(e.children));
    else out.push(e);
  }
  return out;
}

export default function GraphView({ vaultPath }: Props) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await listVaultFolder(vaultPath, "notes");
      if (cancelled) return;

      const flat = flattenFiles(entries);
      const contents = new Map<string, string>();
      await Promise.all(
        flat.map(async (f) => {
          try {
            contents.set(f.rel_path, await readFile(joinPath(vaultPath, f.rel_path)));
          } catch {}
        }),
      );

      if (!cancelled) {
        setGraph(buildGraph(entries, contents));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vaultPath]);

  const handleNodeClick = useCallback((node: any) => {
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.5, 800);
    }
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      const label = node.name as string;
      const isHovered = node.id === hoveredNode;
      const fontSize = isHovered ? 13 : 11;
      const fontFamily = '"Inter", "Public Sans", sans-serif';

      ctx.font = `${isHovered ? 600 : 500} ${fontSize}px ${fontFamily}`;
      const textWidth = ctx.measureText(label).width;
      const padX = 10;
      const padY = 5;
      const w = textWidth + padX * 2;
      const h = fontSize + padY * 2;
      const x = (node.x ?? 0) - w / 2;
      const y = (node.y ?? 0) - h / 2;
      const r = h / 2;

      // pill shadow
      if (isHovered) {
        const moss = color("moss");
        ctx.shadowColor = `${moss}59`;
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
      }

      // pill background
      ctx.fillStyle = isHovered ? color("moss") : color("paper");
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // pill border
      ctx.strokeStyle = isHovered ? color("moss") : color("hairline");
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();

      // label
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isHovered ? "#fff" : color("ink-soft");
      ctx.fillText(label, (node.x ?? 0), (node.y ?? 0) + 0.5);
    },
    [hoveredNode],
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const sx = link.source.x ?? 0;
      const sy = link.source.y ?? 0;
      const tx = link.target.x ?? 0;
      const ty = link.target.y ?? 0;

      const isHighlighted =
        link.source.id === hoveredNode || link.target.id === hoveredNode;

      ctx.strokeStyle = isHighlighted ? color("moss") : color("hairline");
      ctx.globalAlpha = isHighlighted ? 0.9 : 0.35;
      ctx.lineWidth = isHighlighted ? 1.5 : 0.8;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // arrow at target
      const angle = Math.atan2(ty - sy, tx - sx);
      const arrowLen = isHighlighted ? 6 : 4;
      const ax = tx - Math.cos(angle) * 12;
      const ay = ty - Math.sin(angle) * 12;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle - Math.PI / 6),
        ay - arrowLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle + Math.PI / 6),
        ay - arrowLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fillStyle = isHighlighted ? color("moss") : color("hairline");
      ctx.fill();

      ctx.globalAlpha = 1;
    },
    [hoveredNode],
  );

  const handleZoom = useCallback((factor: number) => {
    if (!fgRef.current) return;
    const zoom = fgRef.current.zoom();
    fgRef.current.zoom(zoom * factor, 400);
  }, []);

  const handleReset = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.zoom(1, 600);
    fgRef.current.centerAt(0, 0, 600);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          color: "var(--ink-soft)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid var(--hairline)",
            borderTopColor: "var(--moss)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
          Scanning notes…
        </span>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          color: "var(--ink-soft)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--moss-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Network size={32} color="var(--moss)" />
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: 6,
            }}
          >
            No links yet
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 320 }}>
            Link notes together using <code style={{ fontFamily: "var(--font-mono)", background: "var(--paper-raised)", border: "1px solid var(--hairline)", borderRadius: 4, padding: "1px 5px" }}>[[note name]]</code> syntax and they&apos;ll appear here as a graph.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--paper)",
          flexShrink: 0,
        }}
      >
        <Network size={15} color="var(--moss)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Graph
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-soft)",
            background: "var(--paper-raised)",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            padding: "2px 7px",
          }}
        >
          {graph.nodes.length} notes · {graph.links.length} links
        </span>
      </div>

      {/* canvas area */}
      <div style={{ flex: 1, position: "relative", background: "var(--paper)" }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graph}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => "replace"}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          cooldownTicks={80}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          warmupTicks={40}
          width={typeof window !== "undefined" ? window.innerWidth - 208 : 800}
          height={typeof window !== "undefined" ? window.innerHeight - 90 : 600}
          backgroundColor={color("paper")}
        />

        {/* zoom controls */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {[
            { icon: <ZoomIn size={14} />, action: () => handleZoom(1.4), title: "Zoom in" },
            { icon: <ZoomOut size={14} />, action: () => handleZoom(0.7), title: "Zoom out" },
            { icon: <Maximize2 size={14} />, action: handleReset, title: "Reset view" },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              title={btn.title}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper-raised)",
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--ink-soft)",
                boxShadow: "var(--shadow-sm)",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--moss)";
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = "var(--moss)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--paper-raised)";
                e.currentTarget.style.color = "var(--ink-soft)";
                e.currentTarget.style.borderColor = "var(--hairline-strong)";
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
