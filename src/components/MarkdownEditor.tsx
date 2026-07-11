import { useRef, useEffect } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/common/style.css";
import { remarkEmojiPlugin } from "@milkdown/plugin-emoji";

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!rootRef.current) return;

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: value,
      features: {
        [CrepeFeature.AI]: false,
        [CrepeFeature.TopBar]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: "Start writing, or press '/' for commands\u2026",
          mode: "doc",
        },
      },
    });

    crepe.editor.use(remarkEmojiPlugin);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) {
          onChangeRef.current(markdown);
        }
      });
    });

    crepe.create();

    return () => {
      crepe.destroy();
    };
  }, []);

  return <div ref={rootRef} className="milkdown-wrapper" />;
}
