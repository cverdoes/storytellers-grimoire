# Storyteller's Grimoire

A self-contained HTML tool for prepping and running games of **Blood on
the Clocktower**, currently scoped to the **Trouble Brewing** script.

The whole app is one file: `grimoire.html`. No build step — open it
directly in a browser, or use the recompile script below after editing
character/night-order/setup content.

For the fuller picture (project goals, structure, editing conventions),
see `CLAUDE.md` and `CONTEXT.md`.

This is an unofficial fan-made tool, not affiliated with or endorsed by
The Pandemonium Institute. *Blood on the Clocktower* is their trademark;
character/ability text here is paraphrased in the storyteller's own
voice rather than copied from official cards. Code in this repository
is available under the [MIT license](LICENSE).

## Prerequisites

- Node.js (any reasonably recent version) and npm.
- Run once, from the repo root:

  ```
  npm install
  ```

  This installs `js-yaml` (used by the recompile script) and
  `playwright` (used only by the `run-botc-grimoire` dev-tooling skill,
  not by the app itself).

## Regenerating grimoire.html from the Roster file

Character data, ability text, the Night order, and the Setups tab's
recommended lineups all live in `scripts/trouble-brewing.yaml` (the
**Roster file** — format documented in `docs/roster-spec.md`), not in
`grimoire.html` directly. Edit the YAML, then run:

```
npm run recompile
```

This runs `node recompile-roster.js scripts/trouble-brewing.yaml`,
which:

1. Validates the Roster file (missing fields, duplicate names, dangling
   references — fails loudly with a specific error if anything's
   wrong).
2. Compiles it into `ROSTER`, `NOTES`, `REMINDER_PRESETS`, `FIRST_NIGHT`,
   `OTHER_NIGHT`, and `SETUPS`.
3. Splices each of those back into `grimoire.html`, in place, between
   matching `/* GENERATED:<NAME>:START/END */` marker comments.

`grimoire.html` is modified in place. The generated regions are never
hand-edited directly — see
`docs/adr/0002-roster-file-compiled-one-directionally.md` for why the
flow only goes one direction.

Everything else in `grimoire.html` (CSS, the Table/Game logic, Ruling
Drills, the Quiz) is hand-authored directly in the file and untouched
by this script.

### After recompiling

Sanity-check the embedded JS before trusting the result:

```
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' grimoire.html > /tmp/check.js && node --check /tmp/check.js
```

Then open `grimoire.html` in a browser (`file://` works fine — no
server needed) to confirm it looks right, and commit both
`grimoire.html` and the Roster file together.

## Running the app

Just open `grimoire.html` in a browser — double-click it, or
`open grimoire.html`. No server, no build.

For automated/scripted driving (screenshots, exercising the Table mode
UI, etc.), see the `run-botc-grimoire` Claude Code skill under
`.claude/skills/run-botc-grimoire/`.
