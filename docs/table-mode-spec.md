# Table Mode Spec

A new **Table** tab in `grimoire.html` for running a live game of Blood on the Clocktower (Trouble Brewing), sitting alongside the existing Roster / Night Order / Ruling Drills / Setups / Quiz tabs, which are unchanged. This document is the assembled output of the [Table Mode Spec wayfinder map](../.scratch/table-mode/map.md) — see that file for the decision trail; this document is the thing to actually build from.

Domain vocabulary (Character, Player, Seat, Reminder token, Game, Table) is defined in [`CONTEXT.md`](../CONTEXT.md) at the repo root — read it first. [ADR-0001](adr/0001-uniform-reminder-tokens.md) explains why alive/dead is the only first-class Player field.

## Scope

**In scope**: single-device use (the storyteller's own device), Trouble Brewing only, no live rules computation (Table mode is a passive board — it stores and displays state, it never interprets game rules), localStorage persistence, staying a single-file/no-backend/Artifact-publishable page.

**Explicitly out of scope** (see the map for the full reasoning):
- A live wake-sequencer / night-order integration (e.g. "wake the Poisoner now" prompts driven by actual Game state) — a natural follow-on effort once Table mode exists, not part of this one.
- Multi-device / players having their own screens.
- Other scripts besides Trouble Brewing (the data model is kept reasonably script-shaped, but there's no script-switching UI).

**Deferred, not designed here** (may resurface as a future effort):
- Whether/how the Setups tab's per-player-count character lists could seed a new Game's initial character selection.
- Curated per-character Reminder token presets (e.g. Fortune Teller → one-click "Red Herring") as an alternative to freeform token text.

## Data model

The entire live Game state is one object, persisted under the localStorage key **`botc-grimoire-game`**. Absent or `null` means no Game is active.

```json
{
  "schemaVersion": 1,
  "phase": { "type": "night", "number": 1 },
  "players": [
    {
      "seat": 1,
      "name": "Alex",
      "character": "Washerwoman",
      "alive": true,
      "reminderTokens": [
        { "id": "rt-1699999999999-0", "text": "Red Herring" }
      ],
      "storytellerNote": "",
      "shareableNote": ""
    }
  ]
}
```

Field notes:

- **Player identity is `seat`** (an integer, 1..n) — not a generated id. Seat order is assigned once at Game start and is immutable for the life of the Game; it's already unique, so nothing else is needed to key a Player. `name` is a display string only — duplicate names across Players are fine and expected to be handled gracefully (no uniqueness constraint).
- **`character`** stores the Character's `name` string directly (e.g. `"Washerwoman"`), matching how the existing `ROSTER` array and `charByName()` helper already key characters. No separate character-id scheme.
- **`reminderTokens`** is the *only* mechanism for every non-death status — poisoned, drunk, protected, red herring, anything else an ability produces. Each entry is freeform `text` plus a generated `id` (e.g. `` `rt-${Date.now()}-${counter}` ``) so the UI can remove exactly the token clicked, even when two tokens share identical text. See ADR-0001 for why this is uniform rather than having bespoke fields per status.
- **`storytellerNote`** is private, per-Player, freeform text for the storyteller's own bookkeeping (e.g. "claimed Empath, seems credible"). Never shown to anyone; never appears in the display-only shareable-note view.
- **`shareableNote`** is also per-Player, freeform text — but this one the storyteller *intends* to show that Player by handing them the device. Distinct field, distinct purpose, distinct UI surface (see the Live Table View section below).
- **`alive`** is the only first-class boolean status field on Player. Nothing else gets a dedicated field (see ADR-0001).
- **`phase`**: `{type: "night"|"day", number}`. A quality-of-life label only — e.g. rendered as "🌙 Night 2" — manually advanced by the storyteller via a button. No rules logic is attached to it; it does not drive a wake sequence or gate any other behavior.

### Persistence rules

- **Versioning**: `schemaVersion` exists, but on a mismatch the app wipes and starts fresh — no migration code. This is a hobby tool, not a system of record, so migration machinery isn't worth building.
- **Page load**: an in-progress Game auto-resumes **silently** — the Table tab just shows it, no "resume?" confirmation dialog.
- **One active Game slot**: there is never more than one Game in storage. Starting a new Game while one is active must go through the overwrite-confirmation flow described below — silently reopening the tab is not what triggers confirmation, only deliberately starting a *new* Game is.

## UI flow 1: Setup (starting a new Game)

Layout pattern: **Live Board** — a growing list on the left, a Character-assignment panel on the right, no wizard/step modal.

1. The storyteller types a player name into a persistent input and presses Enter/Add. Each submission appends a new seat to the bottom of a running list on the left — this *is* the seating order, assigned as names are added. A live counter reads `N/15 seated`; below 5 seats it explicitly reads `need at least 5 to start`.
2. Clicking any row in the left-hand list makes it the "active" seat. The right-hand panel shows the full 22-character Trouble Brewing roster, grouped by team (Townsfolk / Outsider / Minion / Demon). Clicking a Character assigns it to the active seat.
   - A Character already assigned to a different seat is greyed out and disabled in the picker — **duplicate Character assignment is hard-blocked**. (This surfaced as an obvious correctness rule during prototyping rather than a separate decision round — flagging it here explicitly in case it needs sign-off, but it should be uncontroversial: the physical game never has two players holding the same character token.)
   - Assigning a Character auto-advances the active seat to the next seat that still needs one, so a storyteller can walk the whole roster with one click per seat.
3. There is **no separate review step** — the left-hand list *is* the live review at all times. A seat is either fully specified (name + Character) or visibly not.
4. Seats can be removed via an inline "×" on their row, any time before the Game starts.
5. **No player-count-entry step and no team-ratio validation.** The storyteller isn't walked through "how many players" as its own step (it falls out of how many names they've typed), and the tool never checks Townsfolk/Outsider/Minion/Demon ratios against the official table — that's left entirely to the storyteller's judgment (they may be deliberately deviating, e.g. Baron).
6. A persistent bottom bar holds **Start Game**, enabled only once every seated Player has both a name and a Character *and* the seat count is ≥ 5. The disabled state explicitly states which condition is unmet (below 5 seated, or "N seats still need a Character").
7. **Overwrite confirmation**: if a Game is already active, starting a new one shows a modal: *"A Game is already in progress (Night N, N players). Starting a new one replaces it — the current Game cannot be recovered."* with Cancel / "End it, start new" actions. Only on confirmation does the new Game replace the old one in storage.

Prototype reference: throwaway branch `prototype/table-setup-flow` (three variants explored — Flat Form, Wizard Modal, Live Board; Live Board won).

## UI flow 2: the live Table view

Layout pattern: **Master-Detail** — a compact seat list on the left, a full detail pane on the right for whichever seat is selected. This deliberately echoes the setup flow's list+panel interaction for consistency across the two screens. Not optimized for narrow/phone widths — that was an explicit call, not an oversight.

A persistent **Phase bar** sits above the split: a label ("🌙 Night 2" / "☀️ Day 2") plus a manual "Advance →" button that cycles Night → Day → Night, incrementing the number each time it returns to Night. No rules logic is attached — it's a label the storyteller updates themselves.

### Seat list (left)

One entry per seat, two lines:

- **Line 1**: seat number → a small solid-color **role badge** (single letter, T/O/M/D for Townsfolk/Outsider/Minion/Demon, colored blue/purple/orange/red respectively) → the Player's name → the Character name, right-aligned. The row's background stays the app's normal surface color — only the badge itself carries the team color (an earlier full-row-tint version was tried and rejected as visually messy).
- **Line 2** (present only when non-empty): all of that seat's Reminder tokens, rendered as small chips.
- A dead seat's row dims (reduced opacity) and its name gets a strikethrough — this overrides the role badge's color emphasis, i.e. death reads as more important than team at a glance.
- The currently-selected seat gets an accent-colored left edge plus a slightly raised background.

Clicking any row selects that seat and populates the detail pane.

### Detail pane (right)

For the selected seat:

- Seat number + Player name as a heading.
- Character name, with an inline **Reassign** button that opens the same grouped-by-team roster-grid picker used during setup (duplicate-character assignment blocked the same way). This is how mid-game Character changes happen (e.g. Scarlet Woman → Imp) — reassignment is allowed at any point; adding or removing Players is not (seat count and seat order are both fixed once the Game starts).
- An **Alive/Dead** toggle pill.
- **Reminder tokens**: the full list for this seat, each removable individually, plus a freeform-text input to add a new one. No curated per-character presets in this version — just a text field.
- A **Storyteller note** textarea — private, per-Player, per the data model above.
- A **shareable-note editing textarea**, bound to `shareableNote`, plus a **"Show note to player →"** button. See UI flow 3 for what that button does.

Prototype reference: throwaway branch `prototype/table-live-view` (three variants explored — Accordion List, Card Grid, Master-Detail; Master-Detail won, refined through feedback on the badge/token/background treatment above).

## UI flow 3: the shareable note (display-only view)

Purpose: the storyteller has typed something for one specific Player (a red-herring reveal, "you are the Empath," a private ruling) into that seat's `shareableNote` field (edited directly in the detail pane above — there's no separate editing screen). They then hand the physical device to that Player to read.

1. Tapping **"Show note to player →"** in the detail pane goes full-screen. The screen shows *only* the note's text — large, centered, serif ("Spectral," matching the app's existing gothic-note styling) — nothing else of the grimoire is visible: no seat list, no other Characters, no other notes, no navigation chrome. If the note is empty, it shows an explicit placeholder ("nothing prepared for this player yet") rather than a blank screen.
2. **Exit gesture**: a small icon, bottom-right, with a visible circular fill ring. Holding it for **1 second** returns to the normal Table view (the previously-selected seat's detail pane); releasing before 1 second cancels and the fill resets instantly, with no partial effect.
   - This was chosen over two rejected alternatives: a drag-reveal drawer (two-step: drag a handle to reveal a confirm bar, then tap it) and a fully hidden triple-tap corner zone (no visible affordance at all). Press & Hold is deliberately *visible* — a Player glancing at the screen can tell there's a way back — but can't trigger it with a stray tap, which was judged the right balance between safety and not feeling like a trick being played on whoever is holding the device.

Prototype reference: throwaway branch `prototype/table-shareable-note` (three exit-gesture variants explored — Press & Hold, Drag-Reveal Drawer, Secret Tap Pattern; Press & Hold won, tuned to 1 second).

## State transitions summary

- **No active Game** → Setup flow → **Active Game** (on Start Game).
- **Active Game** + "start a new Game" → overwrite-confirmation modal → either back to the same Active Game (Cancel) or **Active Game replaced** (confirm; the old one is not recoverable).
- **Active Game**, ongoing play: Character reassignment, alive/dead toggles, Reminder token add/remove, Storyteller-note edits, shareable-note edits, and Phase advances all mutate the one Game object in place and persist immediately (no separate "save" step implied anywhere above).
- **Active Game** → detail pane's "Show note to player" → full-screen presentation mode → Press & Hold (1s) → back to the Table view, same selected seat.
- **Page reload**, Active Game present → same Active Game auto-resumes silently, in whatever state it was last saved.

## Not part of this spec

Two things came up during design that are real but deliberately unresolved here:

- Whether the Setups tab could someday feed a starting character selection into the setup flow (today the two are fully independent).
- Curated per-character Reminder token presets, as a faster alternative to always typing freeform text.

Both would extend this spec without contradicting it — worth a future ticket/effort if they turn out to matter in practice, not a blocker to implementing what's above.
