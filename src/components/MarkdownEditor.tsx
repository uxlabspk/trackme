import { useRef } from "react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { prism } from "@milkdown/plugin-prism";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { upload } from "@milkdown/kit/plugin/upload";
import { remarkEmojiPlugin } from "@milkdown/plugin-emoji";
import { Milkdown, useEditor } from "@milkdown/react";

// Prism languages + theme are bundled by vite-plugin-prismjs (see
// vite.config.ts), which rewrites Prism's CJS require.resolve-based
// language loader at build time instead of leaving it to run in the
// browser, where require() doesn't exist.

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
      .use(prism)
      .use(history)
      .use(listener)
      .use(upload)
      .use(remarkEmojiPlugin);
  }, []);

  return (
    <div className="milkdown-wrapper">
      <Milkdown />
    </div>
  );
}
