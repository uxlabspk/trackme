import { $remark, $nodeSchema } from "@milkdown/kit/utils";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function remarkWikilink() {
  return (tree: any) => {
    const stack = [tree];
    while (stack.length) {
      const node = stack.pop()!;
      if (!("children" in node)) continue;
      const children = node.children;
      const next: any[] = [];
      for (const child of children) {
        if (child.type !== "text" || !child.value?.includes("[[")) {
          next.push(child);
          if ("children" in child) stack.push(child);
          continue;
        }
        WIKILINK_RE.lastIndex = 0;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = WIKILINK_RE.exec(child.value))) {
          if (m.index > last) {
            next.push({ type: "text", value: child.value.slice(last, m.index) });
          }
          next.push({ type: "wikilink", value: m[1] });
          last = m.index + m[0].length;
        }
        if (last < child.value.length) {
          next.push({ type: "text", value: child.value.slice(last) });
        }
      }
      node.children = next;
    }
  };
}

export const wikilinkRemark = $remark("remarkWikilink", () => remarkWikilink);

export const wikilinkSchema = $nodeSchema("wikilink", () => ({
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  attrs: { value: { default: "" } },
  parseDOM: [
    {
      tag: 'span[data-type="wikilink"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? "" }),
    },
  ],
  toDOM: (node) => {
    const span = document.createElement("span");
    span.dataset.type = "wikilink";
    span.dataset.value = node.attrs.value;
    span.style.fontWeight = "600";
    span.style.color = "var(--moss)";
    span.style.cursor = "pointer";
    span.style.textDecoration = "underline";
    span.style.textDecorationColor = "var(--moss-soft)";
    span.style.textUnderlineOffset = "2px";
    span.textContent = node.attrs.value;
    return span;
  },
  parseMarkdown: {
    match: (node: any) => node.type === "wikilink",
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { value: node.value });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === "wikilink",
    runner: (state: any, node: any) => {
      state.addNode("text", undefined, `[[${node.attrs.value}]]`);
    },
  },
}));
