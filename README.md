<div align="center">

# TrackMe

### Your life. Your files. Your vault.

A **local-first** desktop app for notes, meetings, todos, and projects — stored as plain markdown you own forever.

No cloud. No subscription. No lock-in.

<br/>

![Version](https://img.shields.io/badge/version-0.4.0-4a5d45?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Rust](https://img.shields.io/badge/Rust-CE422B?style=flat-square&logo=rust)
![Deno](https://img.shields.io/badge/Deno-000?style=flat-square&logo=deno)
![License](https://img.shields.io/badge/license-MIT-4a5d45?style=flat-square)

</div>

---

## Why TrackMe?

Most note apps are black boxes. Your data lives on their servers, in their format, behind their paywall.

TrackMe is different. Every note, every meeting, every todo is a **`.md` file** in a folder **you choose**. Open it in any editor. Back it up with git. It's yours.

> "The best file format is the one you can still read in 30 years." — That's markdown.

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Notes

WYSIWYG markdown editor powered by **Milkdown**. YAML frontmatter for metadata. Fenced code blocks with syntax highlighting. Folder hierarchy. Everything saves automatically — no Ctrl+S needed.

### Meetings

Recurring meeting series with a full **RRULE-like recurrence engine** (daily, weekly, monthly). See computed occurrences for the next 90 days. Native OS notifications 10 minutes before.

### Todos

Checkboxes that sync bidirectionally with markdown. Toggle `[x]` in the app, the `.md` file updates. Edit the file directly, the app reflects it. No conflict.

</td>
<td width="50%" valign="top">

### Projects

Kanban boards with drag-and-drop. Columns for Backlog, To Do, In Progress, Done. Add, rename, delete — all stored as markdown with YAML frontmatter.

### Graph View

See how your notes connect. Parses `[[wikilinks]]` and renders an interactive **force-directed graph**. Zoom, pan, discover connections you forgot about.

### Canvas

Visual diagramming with shapes, edges, arrows, and 8 color palettes. Drag, resize, pan, zoom. Organize into folders. Great for mind maps and architecture diagrams.

</td>
</tr>
</table>

---

### And more

- **AI Chat** — Multi-provider (LM Studio, OpenAI, Anthropic, Ollama, OpenRouter). 25+ vault tools. Ask your AI to create notes, schedule meetings, manage todos. Speech-to-text via mic.
- **Multi-vault** — Switch between personal, work, project vaults. Last-used vault remembered across sessions.
- **Search** — `Cmd+K` to search across all views. Jump to any file instantly.
- **Trash** — Soft delete with restore. Never lose anything by accident.
- **System tray** — Minimize to tray on close. Stays out of your way.
- **Light & Dark** — Theme toggle. Your eyes decide.
- **Cross-platform** — macOS, Linux, Windows.

---

## Screenshot

![Preview of Track ME](/images/preview_1.png)

---

## Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Deno](https://deno.land)
- [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/)

### Run it

```bash
git clone https://github.com/uxlabspk/trackme.git
cd trackme
deno task tauri dev
```

First launch → **Welcome** → **Get Started** → pick a folder. Done.

### Build it

```bash
deno task tauri build
```

Output: `.app` / `.dmg` / `.deb` / `.rpm` / `.exe` / `.msi` depending on your OS.

---

## How it works

```
Your Vault (plain folder)
├── notes/
│   ├── meeting-notes.md      ← YAML frontmatter + markdown
│   └── project-ideas.md
├── meetings/
│   └── standup.md            ← RRULE recurrence + schedule
├── todos/
│   └── weekly-goals.md       ← - [ ] / - [x] checkboxes
├── projects/
│   └── launch-v2.md          ← Kanban columns in frontmatter
├── canvas/
│   └── architecture.canvas.json
└── .trackme/
    └── trash/                ← soft-deleted files
```

No database. No proprietary format. Just files.

---

## Tech Stack

| Layer    | Tech                                                                      |
| -------- | ------------------------------------------------------------------------- |
| Shell    | **Tauri v2** (Rust) — native window, file I/O, system tray, notifications |
| Frontend | **React 18** + **TypeScript** + **Vite**                                  |
| Runtime  | **Deno** (replaces Node — faster, safer, simpler)                         |
| Editor   | **Milkdown Crepe** — WYSIWYG markdown                                     |
| Graph    | **react-force-graph-2d** — interactive backlink visualization             |
| AI       | Multi-provider streaming SSE + 25+ vault tools + speech-to-text           |
| Fonts    | Newsreader (display) · Inter (body) · IBM Plex Mono (code)                |

---

## Project Structure

```
trackme/
├── src/                        # React frontend
│   ├── views/                  # Welcome, Notes, Meetings, Todos, Projects, Graph, Canvas, AI, Trash
│   ├── components/             # FileTreeList, MarkdownEditor, RecurrenceEditor, SearchModal, Dialog
│   └── lib/                    # bridge.ts (Tauri IPC), types.ts, frontmatter.ts, appConfig.ts
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # Tauri commands (16 total)
│       ├── vault.rs            # Vault bootstrap + file tree
│       ├── recurrence.rs       # RRULE engine (with unit tests)
│       └── notifications.rs    # Background notification scheduler
├── deno.json                   # Deno task runner
├── vite.config.ts
└── package.json
```

---

## Contributing

TrackMe is early. Contributions welcome.

1. Fork it
2. Create a branch (`git checkout -b feat/my-thing`)
3. Commit (`git commit -m 'Add my thing'`)
4. Push (`git push origin feat/my-thing`)
5. Open a PR

---

## License

MIT — do whatever you want with it.

---

<div align="center">

**If TrackMe saves you from yet another subscription, give it a star.**

It helps others find it, and tells me this is worth continuing.

<br/>

[⭐ Star this repo](https://github.com/uxlabspk/trackme/stargazers)

</div>
