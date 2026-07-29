export type CanvasShape = "text" | "circle" | "square" | "triangle";

export interface CanvasNode {
  id: string;
  shape: CanvasShape;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  color: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const COLORS = [
  "#4a5d45",
  "#b0603f",
  "#5b6b78",
  "#d48329",
  "#a3402f",
  "#2c5f7c",
  "#7c5cbf",
  "#c45d48",
];

export const SHAPES: { shape: CanvasShape; label: string }[] = [
  { shape: "text", label: "Text" },
  { shape: "circle", label: "Circle" },
  { shape: "square", label: "Square" },
  { shape: "triangle", label: "Triangle" },
];

export const FONTS: { value: string; label: string; css: string }[] = [
  { value: "serif", label: "Serif", css: '"Newsreader", "Fraunces", Georgia, serif' },
  { value: "sans", label: "Sans", css: '"Inter", "Public Sans", system-ui, sans-serif' },
  { value: "mono", label: "Mono", css: '"JetBrains Mono", "IBM Plex Mono", monospace' },
  { value: "system", label: "System", css: "system-ui, sans-serif" },
];

let _id = 0;
export function nextId(): string {
  return `n${Date.now().toString(36)}${(_id++).toString(36)}`;
}
