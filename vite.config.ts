import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import prismjs from "vite-plugin-prismjs";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    // gray-matter (frontmatter parsing for notes/meetings/todos) expects
    // Node's `Buffer` global at runtime. The Tauri webview has no Node
    // globals, so this plugin polyfills Buffer/process/etc. for the
    // browser build instead of leaving them externalized as no-ops.
    nodePolyfills({
      include: ["buffer"],
      globals: {
        Buffer: true,
        global: false,
        process: false,
      },
    }),
    // Prism's own language loader (prismjs/components.js) uses a runtime
    // `require.resolve(pathToLanguage)` call to lazy-load grammars, which
    // doesn't exist in the browser/webview. This plugin rewrites Prism's
    // language imports at build time instead, so the runtime `require`
    // path is never hit. Add languages here to enable highlighting for
    // more fenced-code blocks.
    prismjs({
      languages: [
        "markup",
        "css",
        "clike",
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "python",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
        "csharp",
        "kotlin",
        "swift",
        "ruby",
        "php",
        "scala",
        "dart",
        "elixir",
        "r",
        "lua",
        "sql",
        "bash",
        "powershell",
        "docker",
        "graphql",
        "json",
        "yaml",
        "toml",
        "ini",
        "diff",
        "http",
        "nginx",
        "makefile",
        "latex",
        "markdown",
      ],
      theme: "okaidia",
      css: true,
    }),
  ],

  // Tauri expects a fixed port, fail if that port is not available
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));