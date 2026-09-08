# Blood on the Clocktower — Storyteller's Grimoire

## What this is

A self-contained HTML tool for prepping and running games of **Blood on the
Clocktower**, currently scoped to the **Trouble Brewing** script. Built for
Claes to use as a storyteller — first as training material, now growing
toward something usable live at the table.

The whole thing lives in one file: **`grimoire.html`**. No build step, no
dependencies — open it in a browser and it works.

## Status

**We are actively iterating on this. Treat it as a live project, not a
finished deliverable.** The plan is to keep refining it, session over
session, until it's a genuinely reliable tool for running a real game —
not just for studying beforehand. When picking this up again, assume
there's more to build, and ask what the next increment should be if it's
not obvious from context.

## Workflow

**Editing a Character, the Night order, or a Setup** (ability text,
storyteller notes, who-to-name guidance, timing, First Night/Other
Nights sequence, recommended per-player-count lineups, Setup
recommendations): edit the Script's Roster file —
`scripts/trouble-brewing.yaml` today — instead of touching
`grimoire.html`. Format is `docs/roster-spec.md`. Then run `npm run
recompile` to regenerate `grimoire.html`'s
`ROSTER`/`NOTES`/`FIRST_NIGHT`/`OTHER_NIGHT`/`SETUPS` from it before
continuing below. Never hand-edit those arrays directly — they're
generated, one-directionally, from the Roster file
(`docs/adr/0002-roster-file-compiled-one-directionally.md`).

**Editing anything else** (CSS, other tabs, game/wizard logic): edit
`grimoire.html` directly, as before.

1. Make the edit (Roster file + recompile, or `grimoire.html` directly,
   per above).
2. Sanity-check embedded JS before committing:
   `awk '/<script>/{f=1;next}/<\/script>/{f=0}f' grimoire.html > /tmp/check.js && node --check /tmp/check.js`
   For logic-only changes (data arrays, pure functions), it's also worth
   dry-running the relevant function in Node directly against the real data
   before trusting it in the browser — this caught real bugs during
   development (see git log).
3. Commit to git — `grimoire.html`, plus the Roster file if that's what
   you edited (`git add grimoire.html scripts/*.yaml && git commit`). Git
   writes in this sandboxed environment need `dangerouslyDisableSandbox:
   true` on the Bash call — the sandbox blocks writing `.git/index.lock`
   otherwise.

## Structure of grimoire.html

Single HTML file, vanilla JS, no frameworks. Google Fonts (Cinzel /
Libre Franklin / Spectral / JetBrains Mono) for a gothic-grimoire feel;
full light/dark theme support via CSS custom properties.

Three tabs, each rendered from a JS data array at load time, plus a
fourth **Table** tab that renders from live Game state (seats,
characters, reminder tokens, the wake sequencer) held in
`localStorage`, not a static array:

- **Roster** — all 22 Trouble Brewing characters (`ROSTER`), grouped by
  team, with paraphrased ability text, timing, storyteller notes, and
  (for characters that name another character type — Washerwoman,
  Librarian, Investigator, the Imp's bluffs) a "Who to name" guide.
- **Night Order** — the canonical First Night / Other Nights sequences
  (`FIRST_NIGHT`, `OTHER_NIGHT`). The Setups tab's night-order lists and
  the wizard both derive from these two arrays rather than hand-authoring
  their own order, to avoid the two drifting out of sync (this happened
  once already; see git history).
- **Setups** — one recommended lineup per player count, 7-15 (`SETUPS`),
  each independently authored (no add/remove delta between counts — see
  `docs/adr/0002-roster-file-compiled-one-directionally.md`'s sibling
  decision trail, the
  [Setup Recommendations](.scratch/setup-recommendations/map.md)
  wayfinder map). Each setup card shows:
  - the full character token list, with hover/focus previews pulled from
    `ROSTER`; a filled pill marks a Character new at this player count
    versus the previous one (`isNew`, derived at compile time by
    Recompile, not authored or recomputed in the browser);
  - a three-column checklist (`NOTES`) of Setup / Night / Day decisions,
    phrased as the question the storyteller is actually answering.
    Registration-ambiguity reminders (Spy/Recluse) are always shown in
    full, even in a setup that has neither character in play (ADR 0002)
    — don't reintroduce per-setup conditional wording here. Where a
    Setup has a composition-specific **Setup recommendation** (a real
    red-herring target, real Demon bluffs, etc. — distinct from a
    Character's generic `NOTES`), it renders as a second "Hint:" line
    within that Character's `<li>` — voice is a hint, not a directive;
    reasoning leads, the pick (if any) follows;
  - two buttons that launch a modal **wizard** — a click-through,
    step-by-step walkthrough of that setup's actual wake sequence, built
    from `FIRST_NIGHT`/`OTHER_NIGHT`/`NOTES` live (not hand-written per
    setup; deliberately does not surface Setup recommendations — those
    are a Setups-tab-checklist-only concept).

`ROSTER`/`NOTES`/`FIRST_NIGHT`/`OTHER_NIGHT`/`SETUPS` are **generated** — see
"Roster files" below before editing any of them. Everything else (all
render/wizard functions, and the Table tab's game/wake-sequencer logic)
is still hand-authored directly in `grimoire.html`.

Key data objects worth knowing before editing:
- `NOTES[name]` holds `{setup, night, day}` plain static string fields —
  every field is always shown in full, regardless of which characters are
  actually in a given setup.
- `rosterForSetup(n)` is a direct lookup into `SETUPS` (`.find(s=>s.n===n)`)
  returning that Setup's character-name list — this is the one place
  that knows how to do that; reuse it rather than reaching into `SETUPS`
  directly.

## Roster files

`ROSTER`/`NOTES`/`FIRST_NIGHT`/`OTHER_NIGHT`/`SETUPS` are compiled from a
Script's **Roster file** — `scripts/trouble-brewing.yaml` today, one file
per Script — by `recompile-roster.js`, which splices its output into
`grimoire.html` between matching `/* GENERATED:<NAME>:... */` marker
comments (`ROSTER`, `NOTES`, `REMINDER_PRESETS`, `SETUPS`). See Workflow
above for when to edit one.

- Format: `docs/roster-spec.md`.
- **`setups:`** is a top-level Roster-file section (documented in the
  Roster spec's `## Setups`) holding per-player-count recommended
  lineups and Setup recommendations — a flat list of independent,
  self-contained Setups, each optionally carrying
  `recommendations`, a composition-specific hint per Character distinct
  from that Character's generic `notes`. Recompile derives each
  Character's "new since last" flag at compile time by diffing against
  the immediately preceding Setup (by `n`); this is baked into the
  generated `SETUPS`, not recomputed in the browser.

## Agent skills

### Issue tracker

Issues live as GitHub Issues (github.com/cverdoes/storytellers-grimoire). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context (CONTEXT.md + docs/adr/ at repo root). See `docs/agents/domain.md`.
