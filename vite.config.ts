import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

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