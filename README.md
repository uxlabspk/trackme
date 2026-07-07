# TrackMe

A personal, local-first productivity desktop app. Notes, recurring meetings,
and todos — all stored as plain markdown files in a folder you choose (the
**vault**), so nothing is ever locked away.

Built with **Tauri** (Rust shell) + **React** (frontend, built/served with
**Deno** instead of Node).

## Prerequisites

You'll need these installed locally (this was built in a sandbox with no
Rust toolchain, so it hasn't been compiled — but every file is complete,
real source):

1. **Rust** — https://www.rust-lang.org/tools/install
   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Deno** — https://deno.land
   ```
   curl -fsSL https://deno.land/install.sh | sh
   ```
3. **Tauri system dependencies** for your OS — see
   https://v2.tauri.app/start/prerequisites/ (on macOS this is just Xcode
   command line tools; on Linux you need `webkit2gtk`, `libayatana-appindicator3`,
   etc.; on Windows you need the WebView2 runtime, which ships with Windows 11).

## Running it

```bash
cd trackme

# Install JS deps (Deno reads package.json/deno.json and manages this)
deno install

# Launch the app in dev mode (hot-reloads the frontend, opens a native window)
deno task tauri dev
```

First launch shows the **Welcome** screen → **Get Started** → pick or create
a vault folder. TrackMe creates `notes/`, `meetings/`, `todos/`, and
`.trackme/` inside it if they don't exist yet.

## Building a distributable app

```bash
deno task tauri build
```

Output lands in `src-tauri/target/release/bundle/` (a `.app`/`.dmg` on
macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux).

## Project layout

```
trackme/
  src/                    # React frontend
    views/                # Welcome, VaultPicker, MainShell, NotesView,
                           # MeetingsView, TodosView, AgendaView
    components/           # FileTreeList, MarkdownEditor (Milkdown),
                           # RecurrenceEditor
    lib/                  # bridge.ts (Tauri invoke wrappers), types.ts,
                           # frontmatter.ts, todos.ts, appConfig.ts
  src-tauri/              # Rust backend
    src/
      lib.rs              # Tauri commands (read/write/delete/rename files,
                           # bootstrap vault, compute recurrence)
      vault.rs            # vault bootstrap + file-tree listing
      recurrence.rs        # RRULE-like recurrence engine (+ unit tests)
    capabilities/main.json # Tauri v2 permission grants
    tauri.conf.json
```

## What's implemented (v1 scope from the design doc)

- [x] Welcome screen
- [x] Vault picker + folder bootstrap (`notes/`, `meetings/`, `todos/`, `.trackme/`)
- [x] Main app shell/navigation (sidebar: Today / Notes / Meetings / Todos)
- [x] Notes: create/edit/delete, WYSIWYG markdown editing (Milkdown),
      syntax-highlighted fenced code blocks (Shiki), YAML frontmatter
      (title/createdAt/updatedAt/tags)
- [x] Meetings: create a recurring series, edit an RRULE-like recurrence
      (freq/interval/days/start/end), see computed occurrences for the next
      90 days
- [x] Todos: create lists, add/check/uncheck/edit/delete items, persisted
      bidirectionally to `- [ ]` / `- [x]` markdown task syntax
- [x] Agenda / Today view: today's meeting occurrences + all open todos
      across every list

## Notes on implementation choices

- **Recurrence engine** (`src-tauri/src/recurrence.rs`) is hand-written
  Rust, not a wrapper around a full iCal library, per the design doc's v1
  scope decision. It supports `once`, `daily`, `weekly` (with a day-of-week
  set and an N-week interval), and `monthly` (same day-of-month, clamped to
  the last day when the month is short, e.g. Jan 31 → Feb 28). Two unit
  tests are included; run them with `cargo test` inside `src-tauri/`.
- **Todos round-trip exactly**: editing a checkbox in the UI rewrites only
  that line's `[ ]`/`[x]`; any other markdown content in the file (notes
  above the task list) is preserved as `preambleBody` and written back
  untouched.
- **Frontmatter** uses `gray-matter` on the frontend for parsing/serializing
  YAML, keeping the Rust side purely about file I/O and recurrence math.
- File writes are debounced (500ms) in Notes/Meetings so typing doesn't
  hammer the disk, but every field commits to the actual `.md` file — there's
  no separate "save" step, matching the vault philosophy of the design doc.

## Known gaps / next steps (flagged as v2 in the design doc)

- No search across notes yet.
- No multi-vault switching UI beyond "switch vault" (which re-runs the picker).
- No tags/backlinks between notes.
- No OS-level notifications for upcoming meetings (agenda view is pull-based).
