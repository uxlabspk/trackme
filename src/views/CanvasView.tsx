import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FileTreeList from "../components/FileTreeList";
import Dialog from "../components/Dialog";
import { COLORS, FONTS, SHAPES, nextId, type CanvasData, type CanvasNode, type CanvasShape } from "../lib/canvas";
import { createFolder, joinPath, listVaultFolder, readFile, trashFile, trashFolder, writeFile } from "../lib/bridge";
import { uniquePath, slugify, sanitizeFolderName, parentRelPath } from "../lib/path";
import { useSidebarTree } from "../hooks/useSidebarTree";
import type { VaultEntry } from "../lib/types";
import { Circle, Square, Triangle, Type, Trash2, MousePointer, Link, FolderPlus } from "lucide-react";

interface Props {
  vaultPath: string;
  sidebarSlot: HTMLDivElement | null;
  triggerCreate?: number;
  onCreateConsumed?: () => void;
}

const CANVAS_DIR = "canvas";
const CANVAS_EXT = ".canvas.json";

function nodeCenter(n: CanvasNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function hitNode(nodes: CanvasNode[], pt: { x: number; y: number }) {
  return [...nodes].reverse().find((n) => pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h);
}

function fontCss(n: CanvasNode): string {
  return FONTS.find((f) => f.value === (n.fontFamily ?? (n.shape === "text" ? "serif" : "sans")))?.css ?? FONTS[0].css;
}

function fontDefault(shape: CanvasShape): string { return shape === "text" ? "serif" : "sans"; }

const SHAPE_ICONS: Record<string, React.ReactNode> = { text: <Type size={14} />, circle: <Circle size={14} />, square: <Square size={14} />, triangle: <Triangle size={14} /> };
type Handle = "nw" | "ne" | "sw" | "se";
const HANDLE = 8;

export default function CanvasView({ vaultPath, sidebarSlot, triggerCreate, onCreateConsumed }: Props) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasData, setCanvasData] = useState<CanvasData>({ nodes: [], edges: [] });
  const [canvasTitle, setCanvasTitle] = useState("");
  const [selNodeId, setSelNodeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "connect" | CanvasShape>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [currentFolder, setCurrentFolder] = useState(CANVAS_DIR);
  const [newOpen, setNewOpen] = useState(false);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ id: string; handle: Handle; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimer = useRef<number | null>(null);
  const { expandedIds, toggleFolder } = useSidebarTree(vaultPath, "canvas", tree);

  const refreshTree = useCallback(async () => {
    const entries = await listVaultFolder(vaultPath, CANVAS_DIR);
    setTree(entries);
  }, [vaultPath]);

  useEffect(() => { refreshTree(); }, [refreshTree]);
  useEffect(() => { setSelected(null); setCanvasData({ nodes: [], edges: [] }); setSelNodeId(null); setCurrentFolder(CANVAS_DIR); }, [vaultPath]);
  useEffect(() => {
    if (triggerCreate && triggerCreate > 0) {
      setNewOpen(true);
      onCreateConsumed?.();
    }
  }, [triggerCreate, onCreateConsumed]);

  useEffect(() => {
    if (!selected) { setCanvasData({ nodes: [], edges: [] }); return; }
    let off = false;
    readFile(joinPath(vaultPath, selected)).then((raw) => {
      if (off) return;
      try { setCanvasData(JSON.parse(raw)); } catch { setCanvasData({ nodes: [], edges: [] }); }
    }).catch(() => setCanvasData({ nodes: [], edges: [] }));
    return () => { off = true; };
  }, [selected, vaultPath]);

  const scheduleSave = useCallback((next: CanvasData) => {
    setCanvasData(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (selected) writeFile(joinPath(vaultPath, selected), JSON.stringify(next, null, 2));
    }, 500);
  }, [selected, vaultPath]);

  const toSvg = useCallback((cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  }, [pan, zoom]);

  const selectedNode = canvasData.nodes.find((n) => n.id === selNodeId);

  async function createCanvas(title: string, folder: string) {
    const relPath = await uniquePath(vaultPath, `${folder.replace(/\/+$/, "")}/${slugify(title)}${CANVAS_EXT}`);
    await writeFile(joinPath(vaultPath, relPath), JSON.stringify({ nodes: [], edges: [] }, null, 2));
    await refreshTree();
    setSelected(relPath);
  }

  async function submitNew() {
    const t = newTitle.trim();
    if (!t) return;
    setNewOpen(false);
    await createCanvas(t, currentFolder);
  }

  async function submitNewFolder() {
    const name = sanitizeFolderName(folderName);
    if (!name) return;
    const relPath = `${currentFolder.replace(/\/+$/, "")}/${name}`;
    setFolderOpen(false);
    await createFolder(joinPath(vaultPath, relPath));
    await refreshTree();
    setCurrentFolder(relPath);
  }

  function handleDeleteFolder(relPath: string) {
    setConfirmDeleteFolder(relPath);
  }

  async function doConfirmDeleteFolder() {
    if (!confirmDeleteFolder) return;
    const relPath = confirmDeleteFolder;
    setConfirmDeleteFolder(null);
    await trashFolder(vaultPath, relPath);
    if (currentFolder === relPath || currentFolder.startsWith(`${relPath}/`)) setCurrentFolder(CANVAS_DIR);
    if (selected && (selected === relPath || selected.startsWith(`${relPath}/`))) setSelected(null);
    await refreshTree();
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const pt = toSvg(e.clientX, e.clientY);
    if (tool === "select" || tool === "connect") {
      const hit = hitNode(canvasData.nodes, pt);
      if (tool === "connect" && hit) {
        if (connectFrom && connectFrom !== hit.id) {
          const dup = canvasData.edges.some((ed) => (ed.from === connectFrom && ed.to === hit.id) || (ed.from === hit.id && ed.to === connectFrom));
          if (!dup) scheduleSave({ ...canvasData, edges: [...canvasData.edges, { id: nextId(), from: connectFrom, to: hit.id, color }] });
          setConnectFrom(null);
        } else { setConnectFrom(hit.id); }
        return;
      }
      if (hit) { setSelNodeId(hit.id); setEditing(null); if (tool === "select") { dragRef.current = { id: hit.id, ox: pt.x - hit.x, oy: pt.y - hit.y }; (e.target as Element).setPointerCapture(e.pointerId); } }
      else { setSelNodeId(null); setEditing(null); }
    } else {
      const w = tool === "text" ? 180 : 100, h = tool === "text" ? 60 : 100;
      const node: CanvasNode = { id: nextId(), shape: tool, x: pt.x - w / 2, y: pt.y - h / 2, w, h, color, text: tool === "text" ? "Text" : "" };
      scheduleSave({ ...canvasData, nodes: [...canvasData.nodes, node] });
      setSelNodeId(node.id);
      setTool("select");
    }
  }, [canvasData, tool, color, connectFrom, pan, zoom, toSvg, scheduleSave]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panRef.current) { const p = panRef.current; setPan({ x: p.px + (e.clientX - p.sx), y: p.py + (e.clientY - p.sy) }); return; }
    if (resizeRef.current) {
      const pt = toSvg(e.clientX, e.clientY);
      const r = resizeRef.current;
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh;
      const dx = pt.x - r.sx, dy = pt.y - r.sy;
      if (r.handle === "se") { nw = Math.max(40, r.ow + dx); nh = Math.max(30, r.oh + dy); }
      else if (r.handle === "sw") { nx = r.ox + dx; nw = Math.max(40, r.ow - dx); nh = Math.max(30, r.oh + dy); }
      else if (r.handle === "ne") { nw = Math.max(40, r.ow + dx); ny = r.oy + dy; nh = Math.max(30, r.oh - dy); }
      else if (r.handle === "nw") { nx = r.ox + dx; ny = r.oy + dy; nw = Math.max(40, r.ow - dx); nh = Math.max(30, r.oh - dy); }
      setCanvasData((prev) => ({ ...prev, nodes: prev.nodes.map((n) => n.id === r.id ? { ...n, x: nx, y: ny, w: nw, h: nh } : n) }));
      return;
    }
    if (!dragRef.current) return;
    const pt = toSvg(e.clientX, e.clientY);
    const d = dragRef.current;
    setCanvasData((prev) => ({ ...prev, nodes: prev.nodes.map((n) => n.id === d.id ? { ...n, x: pt.x - d.ox, y: pt.y - d.oy } : n) }));
  }, [toSvg]);

  const onPointerUp = useCallback(() => {
    if (resizeRef.current) { resizeRef.current = null; return; }
    if (panRef.current) { panRef.current = null; return; }
    if (dragRef.current) { scheduleSave(canvasData); dragRef.current = null; }
  }, [canvasData, scheduleSave]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    const nz = Math.min(5, Math.max(0.1, zoom * f));
    const ratio = nz / zoom;
    setPan({ x: mx - (mx - pan.x) * ratio, y: my - (my - pan.y) * ratio });
    setZoom(nz);
  }, [zoom, pan]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (tool !== "select") return;
    const pt = toSvg(e.clientX, e.clientY);
    const hit = hitNode(canvasData.nodes, pt);
    if (hit) { setSelNodeId(hit.id); setEditing(hit.id); }
  }, [canvasData, tool, toSvg]);

  function deleteSelectedNode() {
    if (!selNodeId) return;
    scheduleSave({ nodes: canvasData.nodes.filter((n) => n.id !== selNodeId), edges: canvasData.edges.filter((e) => e.from !== selNodeId && e.to !== selNodeId) });
    setSelNodeId(null);
  }

  function updateColor(c: string) {
    setColor(c);
    if (selNodeId) scheduleSave({ ...canvasData, nodes: canvasData.nodes.map((n) => n.id === selNodeId ? { ...n, color: c } : n) });
  }

  function updateNodePatch(patch: Partial<CanvasNode>) {
    if (!selNodeId) return;
    scheduleSave({ ...canvasData, nodes: canvasData.nodes.map((n) => n.id === selNodeId ? { ...n, ...patch } : n) });
  }

  function startResize(e: React.PointerEvent, id: string, handle: Handle) {
    e.stopPropagation();
    const pt = toSvg(e.clientX, e.clientY);
    const node = canvasData.nodes.find((n) => n.id === id);
    if (!node) return;
    resizeRef.current = { id, handle, sx: pt.x, sy: pt.y, ox: node.x, oy: node.y, ow: node.w, oh: node.h };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function renderShape(n: CanvasNode) {
    const sel = n.id === selNodeId;
    const sw = sel ? 2.5 : 1.5, fill = n.color + "22";
    if (n.shape === "circle") return <ellipse cx={n.x + n.w / 2} cy={n.y + n.h / 2} rx={n.w / 2} ry={n.h / 2} fill={fill} stroke={n.color} strokeWidth={sw} />;
    if (n.shape === "square") return <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} fill={fill} stroke={n.color} strokeWidth={sw} />;
    if (n.shape === "triangle") return <polygon points={`${n.x + n.w / 2},${n.y} ${n.x + n.w},${n.y + n.h} ${n.x},${n.y + n.h}`} fill={fill} stroke={n.color} strokeWidth={sw} />;
    return <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} fill={n.color + "18"} stroke={n.color} strokeWidth={sw} />;
  }

  function renderLabel(n: CanvasNode) {
    const fs = n.fontSize ?? (n.shape === "text" ? 16 : 12);
    const ff = fontCss(n), fw = n.shape === "text" ? 600 : 500;
    if (editing === n.id) {
      return (
        <foreignObject x={n.x} y={n.y} width={n.w} height={n.h}>
          <textarea autoFocus value={n.text}
            onChange={(e) => setCanvasData((p) => ({ ...p, nodes: p.nodes.map((nn) => nn.id === n.id ? { ...nn, text: e.target.value } : nn) }))}
            onBlur={() => { scheduleSave(canvasData); setEditing(null); }}
            style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", resize: "none", textAlign: "center", fontFamily: ff, fontSize: fs, fontWeight: fw, color: n.color, padding: "8px 6px", boxSizing: "border-box" as const, lineHeight: "1.3" }} />
        </foreignObject>
      );
    }
    if (!n.text) return null;
    return (
      <foreignObject x={n.x} y={n.y} width={n.w} height={n.h}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: ff, fontSize: fs, fontWeight: fw, color: n.color, padding: "8px 6px", lineHeight: "1.3", pointerEvents: "none" }}>{n.text}</div>
      </foreignObject>
    );
  }

  function renderHandles(n: CanvasNode) {
    if (n.id !== selNodeId) return null;
    const hs: { handle: Handle; x: number; y: number }[] = [
      { handle: "nw", x: n.x, y: n.y }, { handle: "ne", x: n.x + n.w, y: n.y },
      { handle: "sw", x: n.x, y: n.y + n.h }, { handle: "se", x: n.x + n.w, y: n.y + n.h },
    ];
    return hs.map((h) => (
      <rect key={h.handle} x={h.x - HANDLE / 2} y={h.y - HANDLE / 2} width={HANDLE} height={HANDLE} rx={2}
        fill="var(--paper-raised)" stroke="var(--moss)" strokeWidth={1.5}
        style={{ cursor: h.handle === "nw" || h.handle === "se" ? "nwse-resize" : "nesw-resize" }}
        onPointerDown={(e) => startResize(e, n.id, h.handle)} />
    ));
  }

  function renderEdge(e: { id: string; from: string; to: string; color: string }) {
    const fn = canvasData.nodes.find((n) => n.id === e.from), tn = canvasData.nodes.find((n) => n.id === e.to);
    if (!fn || !tn) return null;
    const fc = nodeCenter(fn), tc = nodeCenter(tn);
    const dx = tc.x - fc.x, dy = tc.y - fc.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = fc.x + ux * (Math.max(fn.w, fn.h) / 2), sy = fc.y + uy * (Math.max(fn.w, fn.h) / 2);
    const ex = tc.x - ux * (Math.max(tn.w, tn.h) / 2), ey = tc.y - uy * (Math.max(tn.w, tn.h) / 2);
    const mid = `arrow-${e.id}`;
    return (
      <g key={e.id}>
        <defs><marker id={mid} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto"><polygon points="0 0, 8 3, 0 6" fill={e.color} /></marker></defs>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={e.color} strokeWidth={2} markerEnd={`url(#${mid})`} style={{ cursor: "pointer" }} onClick={() => scheduleSave({ ...canvasData, edges: canvasData.edges.filter((ed) => ed.id !== e.id) })} />
      </g>
    );
  }

  const btnBase: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", cursor: "pointer", color: "var(--ink-soft)", transition: "all 0.15s" };
  const btnActive: React.CSSProperties = { ...btnBase, background: "var(--moss)", color: "#fff", borderColor: "var(--moss)" };
  const selectBase: React.CSSProperties = { height: 28, borderRadius: 4, border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", color: "var(--ink)", fontSize: 12, fontFamily: "var(--font-mono)", padding: "0 6px", cursor: "pointer", outline: "none" };

  return (
    <div style={{ height: "100%" }}>
      {sidebarSlot && createPortal(
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 8px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--ink-soft)" }}>CANVAS</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setFolderName(""); setFolderOpen(true); }} title="New folder" style={{ border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", borderRadius: "var(--radius-sm)", width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--moss)" }}><FolderPlus size={14} /></button>
              <button onClick={() => { setNewTitle(""); setNewOpen(true); }} title="New canvas" style={{ border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", borderRadius: "var(--radius-sm)", width: 24, height: 24, cursor: "pointer", fontSize: 15, lineHeight: 1, color: "var(--moss)" }}>+</button>
            </div>
          </div>
          <FileTreeList entries={tree} selectedRelPath={selected} onSelect={setSelected} selectedFolderRelPath={currentFolder} onSelectFolder={setCurrentFolder} onDeleteFolder={handleDeleteFolder} emptyLabel="No canvases yet — click + to add one" expandedIds={expandedIds} onToggleFolder={toggleFolder} />
        </>,
        sidebarSlot
      )}

      {/* main */}
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, position: "relative" }}>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>Select a canvas, or create one to get started.</div>
          </div>
        ) : (<>
          {/* canvas toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderBottom: "1px solid var(--hairline)", background: "var(--paper)", flexShrink: 0, flexWrap: "wrap" }}>
            <input value={canvasTitle} onChange={(e) => setCanvasTitle(e.target.value)} placeholder="Untitled"
              onBlur={async () => { if (!canvasTitle.trim() || !selected) return; const slug = slugify(canvasTitle.trim()); const dir = parentRelPath(selected, CANVAS_DIR); const newPath = await uniquePath(vaultPath, `${dir}/${slug}${CANVAS_EXT}`); if (newPath !== selected) { await writeFile(joinPath(vaultPath, newPath), JSON.stringify(canvasData, null, 2)); await trashFile(vaultPath, selected); await refreshTree(); setSelected(newPath); } }}
              style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, border: "none", outline: "none", background: "transparent", width: 160, color: "var(--ink)" }} />
            <div style={{ width: 1, height: 20, background: "var(--hairline)", margin: "0 4px" }} />
            {[{ id: "select" as const, icon: <MousePointer size={14} />, tip: "Select" }, { id: "connect" as const, icon: <Link size={14} />, tip: "Connect" }].map((t) => (
              <button key={t.id} title={t.tip} style={tool === t.id ? btnActive : btnBase} onClick={() => { setTool(t.id); setConnectFrom(null); }}
                onMouseEnter={(e) => { if (tool !== t.id) e.currentTarget.style.background = "var(--hairline)"; }}
                onMouseLeave={(e) => { if (tool !== t.id) e.currentTarget.style.background = "var(--paper-raised)"; }}>{t.icon}</button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--hairline)", margin: "0 4px" }} />
            {SHAPES.map((s) => (
              <button key={s.shape} title={s.label} style={tool === s.shape ? btnActive : btnBase} onClick={() => setTool(s.shape)}
                onMouseEnter={(e) => { if (tool !== s.shape) e.currentTarget.style.background = "var(--hairline)"; }}
                onMouseLeave={(e) => { if (tool !== s.shape) e.currentTarget.style.background = "var(--paper-raised)"; }}>{SHAPE_ICONS[s.shape]}</button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--hairline)", margin: "0 4px" }} />
            {COLORS.map((c) => (
              <button key={c} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? "2px solid var(--ink)" : "2px solid var(--hairline)", cursor: "pointer", padding: 0 }} onClick={() => updateColor(c)} />
            ))}
            {selectedNode && (<>
              <div style={{ width: 1, height: 20, background: "var(--hairline)", margin: "0 4px" }} />
              <select value={selectedNode.fontFamily ?? fontDefault(selectedNode.shape)} onChange={(e) => updateNodePatch({ fontFamily: e.target.value })} style={selectBase}>
                {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <input type="number" min={8} max={96} value={selectedNode.fontSize ?? (selectedNode.shape === "text" ? 16 : 12)}
                onChange={(e) => updateNodePatch({ fontSize: Math.max(8, Math.min(96, Number(e.target.value) || 12)) })}
                style={{ ...selectBase, width: 50, textAlign: "center" }} />
            </>)}
            <div style={{ flex: 1 }} />
            {selNodeId && (
              <button title="Delete shape" style={{ ...btnBase, borderColor: "#a3402f", color: "#a3402f" }} onClick={deleteSelectedNode}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#a3402f"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--paper-raised)"; e.currentTarget.style.color = "#a3402f"; }}><Trash2 size={14} /></button>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)" }}>{Math.round(zoom * 100)}%</span>
          </div>

          {/* canvas */}
          <div style={{ flex: 1, overflow: "hidden", cursor: tool === "select" ? "default" : tool === "connect" ? "crosshair" : "copy" }}>
            <svg ref={svgRef} width="100%" height="100%" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel} onDoubleClick={onDoubleClick}
              style={{ background: "var(--paper)", touchAction: "none" }}>
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse"><circle cx={20} cy={20} r={0.8} fill="var(--hairline)" /></pattern>
                <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />
                {canvasData.edges.map(renderEdge)}
                {canvasData.nodes.map((n) => (<g key={n.id}>{renderShape(n)}{renderLabel(n)}{renderHandles(n)}</g>))}
                {connectFrom && (() => { const fn = canvasData.nodes.find((n) => n.id === connectFrom); return fn ? <circle cx={nodeCenter(fn).x} cy={nodeCenter(fn).y} r={6} fill="var(--moss)" opacity={0.6} /> : null; })()}
              </g>
            </svg>
          </div>
        </>)}
      </div>

      {/* new canvas dialog */}
      <Dialog open={newOpen} title="New canvas" onClose={() => setNewOpen(false)} footer={<>
        <button onClick={() => setNewOpen(false)} style={{ border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>Cancel</button>
        <button onClick={submitNew} disabled={!newTitle.trim()} style={{ border: "none", background: "var(--moss)", color: "#fff", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, cursor: newTitle.trim() ? "pointer" : "not-allowed", opacity: newTitle.trim() ? 1 : 0.5 }}>Create</button>
      </>}>
        <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }} placeholder="Canvas title"
          style={{ width: "100%", fontFamily: "var(--font-display)", fontSize: 15, padding: "9px 11px", border: "1px solid var(--hairline-strong)", borderRadius: "var(--radius-sm)", outline: "none", boxSizing: "border-box", background: "var(--paper-raised)", color: "var(--ink)" }} />
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-soft)" }}>in /{currentFolder}</div>
      </Dialog>

      {/* new folder dialog */}
      <Dialog open={folderOpen} title="New folder" onClose={() => setFolderOpen(false)} footer={<>
        <button onClick={() => setFolderOpen(false)} style={{ border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>Cancel</button>
        <button onClick={submitNewFolder} disabled={!folderName.trim()} style={{ border: "none", background: "var(--moss)", color: "#fff", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, cursor: folderName.trim() ? "pointer" : "not-allowed", opacity: folderName.trim() ? 1 : 0.5 }}>Create</button>
      </>}>
        <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitNewFolder(); }} placeholder="Folder name"
          style={{ width: "100%", fontFamily: "var(--font-display)", fontSize: 15, padding: "9px 11px", border: "1px solid var(--hairline-strong)", borderRadius: "var(--radius-sm)", outline: "none", boxSizing: "border-box", background: "var(--paper-raised)", color: "var(--ink)" }} />
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-soft)" }}>in /{currentFolder}</div>
      </Dialog>

      {/* delete folder confirm */}
      <Dialog
        open={confirmDeleteFolder !== null}
        title="Move folder to trash?"
        onClose={() => setConfirmDeleteFolder(null)}
        footer={<>
          <button onClick={() => setConfirmDeleteFolder(null)} style={{ border: "1px solid var(--hairline-strong)", background: "var(--paper-raised)", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>Cancel</button>
          <button onClick={doConfirmDeleteFolder} style={{ border: "none", background: "#ff3b30", color: "#fff", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Move to trash</button>
        </>}
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
          &ldquo;{confirmDeleteFolder}&rdquo; and all its canvases will be moved to trash.
        </p>
      </Dialog>
    </div>
  );
}
