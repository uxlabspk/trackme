import { useEffect, useRef, useState } from "react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { prism } from "@milkdown/plugin-prism";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, useEditor } from "@milkdown/react";
import Prism from "prismjs";
// Milkdown's prism plugin drives highlighting itself, node by node, inside
// the editor. Without this, raw Prism auto-scans the whole document for
// `.language-*` elements on DOMContentLoaded, which is unnecessary here and
// could run before the editor's own DOM even exists.
Prism.manual = true;
// @ts-expect-error -- prismjs ships no types for this CJS-style entry point
import loadLanguages from "prismjs/components/index.js";

// Dark theme matching our editor's code-block background (see milkdown.css).
import "prismjs/themes/prism-okaidia.css";

const LANGUAGES = [
  "markup",
  "css",
  "clike",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "rust",
  "bash",
  "json",
  "yaml",
  "markdown",
];

// Registers language grammars onto Prism.languages using Prism's own
// dependency-aware loader, run once per app load. This avoids the
// `ReferenceError: Can't find variable: Prism` that happens when Prism's
// individual `prismjs/components/prism-x` files are imported directly as
// ES modules — those files assume a global `Prism` already exists (classic
// <script>-tag semantics), which plain `import` statements don't provide.
// `loadLanguages` runs against the already-imported `Prism` instance above
// and handles per-language dependency order internally.
let languagesLoaded = false;
function ensureLanguagesLoaded() {
  if (languagesLoaded) return;
  loadLanguages(LANGUAGES);
  languagesLoaded = true;
}

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [languagesReady, setLanguagesReady] = useState(languagesLoaded);

  useEffect(() => {
    ensureLanguagesLoaded();
    setLanguagesReady(true);
  }, []);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(prism);
  }, [languagesReady]);

  return (
    <div className="milkdown-wrapper">
      <Milkdown />
    </div>
  );
}