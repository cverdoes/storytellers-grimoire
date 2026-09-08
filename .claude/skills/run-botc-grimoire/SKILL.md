---
name: run-botc-grimoire
description: Build, run, and drive the Storyteller's Grimoire (grimoire.html) — a single-file, no-build Blood on the Clocktower tool. Use when asked to run the app, screenshot the Table/Grimoire view, seat a Game, exercise the Circular Grimoire Layout drag-and-drop, or otherwise interact with its UI.
---

`grimoire.html` is a single dependency-free static HTML file (fonts
come from Google Fonts over the network; everything else is inline).
There is no dev server and no build step for the app itself. Drive it
via the Playwright REPL at
`.claude/skills/run-botc-grimoire/driver.mjs`, which serves the repo
root over a tiny built-in static server (so `localStorage` behaves
like a real origin) and launches a normal `chromium.launch()` page —
this is a plain web page, not Electron, so there's no window/webContents
layer to navigate.

All paths below are relative to the repo root.

## Prerequisites

Playwright's Chromium needs its shared libs; installed once via:

```bash
npx playwright install --with-deps chromium
```

(No extra apt packages were needed beyond what `--with-deps` pulls in.)

## Setup

```bash
npm install   # installs playwright (devDependency) + js-yaml
```

## Run (agent path)

```bash
node .claude/skills/run-botc-grimoire/driver.mjs
```

Wrap in tmux for interactive use — poll for the `driver>` / marker
strings rather than sleeping a fixed amount:

```bash
tmux new-session -d -s botc -x 200 -y 50
tmux send-keys -t botc 'node .claude/skills/run-botc-grimoire/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t botc -p | grep -q "driver>"; do sleep 0.2; done'
tmux send-keys -t botc 'launch' Enter
timeout 20 bash -c 'until tmux capture-pane -t botc -p | grep -q "launched\."; do sleep 0.2; done'
tmux send-keys -t botc 'ss landing' Enter
timeout 10 bash -c 'until tmux capture-pane -t botc -p | grep -q "screenshot:"; do sleep 0.2; done'
tmux capture-pane -t botc -p
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`).

### A full walkthrough (Table mode → Circular Grimoire Layout)

```
launch
clear-game
new-game Alex,Bri,Cass,Deja,Emrys,Finn
assign-char Washerwoman
assign-char Librarian
assign-char Butler
assign-char Poisoner
assign-char Imp
assign-char Chef
start-game
toggle-view
ss circular
drag-seat 4 200 -150
reset-positions
quit
```

### Commands

Generic (work on any page this app renders):

| command | what it does |
|---|---|
| `launch [path]` | launch Chromium, serve the repo, navigate to `path` (default `grimoire.html`) |
| `nav <path>` | navigate to another served path, e.g. `.scratch/circular-grimoire-layout/prototype.html?variant=A&seats=15` |
| `ss [name]` | screenshot → `/tmp/shots/<name>.png` |
| `click <css-sel>` | click element |
| `click-text <text>` | click a button/link/tab whose text matches |
| `fill <css-sel> <value>` | fill an input |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait up to 10s for an element |
| `eval <js>` | evaluate JS in the page, print JSON |
| `text [css-sel]` | print innerText (body if no selector) |
| `theme dark\|light` | `emulateMedia` colorScheme — the app has no in-page toggle, only `prefers-color-scheme` |
| `quit` | close the browser and static server, exit |

App-specific (Table mode / Circular Grimoire Layout — see
`docs/table-mode-spec.md` and `docs/circular-grimoire-layout-spec.md`):

| command | what it does |
|---|---|
| `new-game <names-csv>` | open the Table tab, start the setup flow, seat one Player per name |
| `assign-char <CharacterName>` | assign one specific Character (by `data-char`) to the active seat |
| `assign-next [n]` | click the first enabled character-picker button `n` times (assigning auto-advances seats) |
| `start-game` | click Start Game, wait for the live Table view |
| `toggle-view` | cycle Table view → Grimoire view → Town Square view → Table view |
| `set-view table\|grimoire\|town` | jump straight to one of the three views |
| `kill-seat <n>` | select seat `n` and flip it dead |
| `drag-seat <n> <dx> <dy>` | drag Circular-Grimoire-Layout seat `n`'s card by pixel offset; writes `Position` on drop |
| `reset-positions` | click the Grimoire view's "↺ Reset" button |
| `clear-game` | wipe the `botc-grimoire-game` localStorage key (start clean) |

## Run (human path)

Open `grimoire.html` directly in a browser (`file://` works fine — the
app has no server dependency at all). No build, no install.

## Test

No automated test framework exists in this repo (`node --check` on the
extracted `<script>` block, plus Node dry-runs of pure functions, is
the established convention — see `CLAUDE.md`'s Workflow section). This
driver is the browser-level complement to that: use it to exercise a
change visually before calling it done, per `CLAUDE.md`'s standing
instruction for UI changes.

## Gotchas

- **Don't serve the file with `python -m http.server`.** It omits
  `charset=utf-8` on its `Content-Type` header, so Chromium mis-decodes
  the file's embedded emoji (🌙, 🔮) and em-dashes as Latin-1 —
  everything renders as mojibake (`ðŸŒ™`, `â€"`). The driver's built-in
  static server sets `text/html; charset=utf-8` explicitly to avoid
  this; if you ever swap in a different server, make sure it does too.
- **`tableViewMode` (Table view vs. Grimoire view) is in-memory only,
  never persisted.** A `page.reload()` or a fresh `launch` always lands
  back on the Table view even if you'd toggled to Grimoire view and the
  Game itself is unchanged. Call `toggle-view` again after a reload if
  you need to get back to it. (Player `Position` data, unlike the view
  mode, IS persisted — that's the actual thing worth checking after a
  reload.)
- **No in-page theme toggle exists.** Dark mode is driven purely by
  `prefers-color-scheme`; use the `theme` command (Playwright
  `emulateMedia`), not a button click.
- **Setup's character picker has no per-team selector shortcut** other
  than `data-char="<Name>"` on each `.picker-btn` — use `assign-char`
  with an exact Character name (see `ROSTER` in `grimoire.html`, or the
  Roster tab) when you need a specific team represented, not
  `assign-next`, which just walks the picker in DOM order (townsfolk
  first).
