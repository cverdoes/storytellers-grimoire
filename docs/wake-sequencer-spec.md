# Live Wake Sequencer Spec

A live **First Night / Other Night wake sequencer** inside Table Mode: walks the storyteller through the correct wake order for the actual seated Game, showing the same kind of ability reminders as the Setups tab's wizard, with direct access to show a specific Player their prepared shareable note when woken. This document is the assembled output of the [Live Wake Sequencer wayfinder map](../.scratch/wake-sequencer/map.md) — see that file for the decision trail; this document is the thing to actually build from.

This is the item explicitly deferred out of the original Table Mode spec as a "future effort once state-tracking Table mode exists" (see [docs/table-mode-spec.md](table-mode-spec.md)'s own scope section). Table Mode now exists and is shipped, so this is that effort.

Domain vocabulary (Character, Player, Seat, Reminder token, Game, Table) is defined in [`CONTEXT.md`](../CONTEXT.md) at the repo root — read it first. [ADR-0001](adr/0001-uniform-reminder-tokens.md) explains why alive/dead is the only first-class Player field.

## Scope

**In scope**: a First Night / Other Night step-by-step sequencer, driven by the live Game's actual seated Players, reusing the existing `FIRST_NIGHT`/`OTHER_NIGHT` order and `NOTES` guidance text that already power the Setups tab's wizard.

**Hard constraint, carried over from Table Mode and tightened here**: this is an assistive checklist, not a decision-maker. It sequences and reminds; the storyteller drives every skip and every phase change by hand. Concretely (see the map's ticket 01 for the full reasoning):
- No new Game-history tracking (death timing, execution history) is added. Conditional-flag steps (Scarlet Woman "if triggered", Ravenkeeper "if killed tonight", Undertaker "if execution today") are always shown as reminders, never auto-resolved — none of these three is actually inferable from today's schema anyway, since only current `alive` is tracked.
- Dead Players' steps are always shown too, never auto-skipped — dimmed/marked the same way the Live Table seat list already dims dead seats (strikethrough), not hidden.
- The sequencer never mutates `game.phase`. The existing Phase bar's Advance → button stays the sole, deliberate way to move Night → Day, regardless of how far the sequencer has been walked.

**Explicitly out of scope**: everything already out of scope for Table Mode itself (multi-device, script-switching, other scripts besides Trouble Brewing) — see [docs/table-mode-spec.md](table-mode-spec.md)'s own Scope section.

**Deferred, not designed here**: whether the Setups tab could ever seed a Game (already separately resolved as "don't build" — see [table-mode-followups](../.scratch/table-mode-followups/map.md)); curated Reminder-token presets (separately resolved as "build" — see the same map).

## Step model

Not a persisted data structure — steps are computed fresh every time the sequencer opens, from the live Game plus the existing `FIRST_NIGHT`/`OTHER_NIGHT`/`NOTES` arrays. This mirrors the Setups tab's existing `buildWizardSteps(n, phase)`, with one substitution: the roster comes from `game.players` (real seated Characters) instead of `rosterForSetup(n)` (a hypothetical player-count roster).

- **Night selection is automatic**: `game.phase.number === 1 && game.phase.type === "night"` means First Night; any other `type === "night"` means Other Night. No manual toggle — unlike the Setups tab (which has no Game to read phase from and so needs two separate buttons), the live Game always knows which night it is. Opening the sequencer while `game.phase.type === "day"` has nothing to sequence; the entry point is disabled in that state.
- **Step filter**: a step exists for a character only if it (a) has a wake-slot in tonight's `FIRST_NIGHT`/`OTHER_NIGHT` sequence, and (b) is actually assigned to a seat in this Game. Order follows the canonical array order, unchanged.
- **Step content**: each character step carries the same `flag`/`action`/`decision` content the Setups wizard already resolves via `stepDecision`/`resolveNote`, plus the assigned Player's seat and name, plus an alive/dead indicator (dead Players get a visible "Dead" tag, never hidden). Info-only steps carry no Player, **except Demon info**: exactly one Demon exists in Trouble Brewing, so that one step attaches the seated Demon Player — mainly so "Show note to Player" (below) can jump straight to a shareable note the storyteller prepared for them, e.g. their bluffs. Minion info still carries no Player, since it wakes potentially several at once and no single Player fits.
- **Three distinct kinds of "note," never merged**: the script-level `NOTES[name]` guidance (what to do, generically, for this ability) is separate from the Player's own private `storytellerNote` (Game-specific context for that Player, this Game), which is separate again from that Player's `shareableNote` (Game-specific text the storyteller prepared to show *them*). Each step surfaces all three, visually distinct: `storytellerNote` renders in its own box directly beneath the `NOTES[name]` guidance (both visible together — one is the general rule, the other is this specific person, right now), while `shareableNote` stays reachable only via a button that jumps to the existing full-screen presentation view, since showing it is a deliberate, separate action rather than passive on-screen text.

## Position memory

Session-only, not persisted to `localStorage`, no `schemaVersion` change to the Game object.

- Remembers the **current step's character identity** (not a raw step index), resolved back to "whichever step has this character" the next time the sequencer opens. Falls back to step 1 if that character's step no longer exists (e.g. the seat was reassigned away from it while the sequencer was closed) — the step list is rebuilt fresh from `game.players` on every open, so a raw index could otherwise silently point at the wrong character.
- **Scoped per `(phase.type, phase.number)`** — opening the sequencer for a night that hasn't been touched yet always starts at step 1; it never resumes a stale position left over from a different night.
- **Navigation is bidirectional**: a Previous control (reusing the existing wizard's `wizard-prev` pattern — disabled only at step 0) plus an explicit **Restart** action that jumps back to step 1 for the current night. Both simply rewrite the same remembered pointer above — no separate state model for going backward vs. forward. Restart does not require a confirmation step before discarding visible progress.

## UI: the live sequencer

Layout pattern: **full-screen modal, reusing the existing Setups-wizard chrome** (`openWizard`/`renderWizardStep`) rather than building new chrome. Validated against two other structurally different layouts (a non-modal docked side panel, and an inline accordion within the seat list) via a throwaway prototype — the modal won.

1. **Entry point**: a third button in the Live Table view's Phase bar, alongside "New Game…" and "Advance →". Disabled (or hidden) when `game.phase.type === "day"`, since there's no night to sequence.
   - **Known, deliberately accepted trade-off**: at narrow widths (~420px), a third Phase-bar button visibly crowds the existing two and wraps onto a second line — confirmed during prototyping. A banner above the seat list (as used by the two losing variants) did not have this problem. Kept in the Phase bar anyway, for simplicity. Worth remembering if the Phase bar ever gains a fourth action — the crowding will compound.
2. **Modal body**, per step: an eyebrow line ("First Night · Wake Sequence" / "Other Night N · Wake Sequence"), a heading that's the character name alone for a Player-less step or "[Player name] — [character name]" when a Player is attached (a "Dead" tag and any active Reminder tokens, e.g. "| Poisoned", append there too — this is the one place identity and tokens show, not repeated lower in the body), the conditional `flag` (if any) as a small badge, the team badge, the "Do" action text (exactly as the Setups wizard renders it today) with a small circular "!" icon button aligned to its right — the storyteller's-call `decision` text is collapsed behind that button rather than always shown, appearing as a box beneath the action text once tapped. This is the live sequencer's one deliberate divergence from the Setups wizard, made after live-table use showed the always-visible hint made the step body too busy to scan at a glance. On the Demon's own kill step specifically (the non-info step whose `team` is `"demon"` — i.e. the Imp's "choose a player to kill" step on Other Nights, not the first-night "Demon info" step) an accent-bordered "💀 Kill player…" select follows, listing every currently-alive seated Player (the Demon's own seat included, since targeting yourself is a legal choice); picking one immediately sets that seat to dead and re-renders — a live-table-tested shortcut for the step where marking someone dead is the point of the step, replacing the general-purpose "Jump to another player, then flip Alive" detour every other step still uses for an incidental correction. Then, if a Player is attached and their `storytellerNote` is non-empty, a labeled "Your note — private" box directly beneath the hint (omitted entirely, no placeholder, when that Player has no `storytellerNote` set); then — if a Player is attached — a single dashed-divider group holding both ways to show that Player something: a "Show prepared note" button (present only if that seat has a non-empty `shareableNote`; omitted rather than shown disabled/muted if not) directly above a collapsed "Show something on the spot…" opener that expands into a free-form text box (Ravenkeeper-style reveals prepared right at the table, not ahead of time) — typing a note and clicking Next → shows it via the same full-screen presentation view as a prepared shareable note. The two share the same plain button styling and are grouped together since they're the same kind of storyteller action (showing the Player something), one prepared and one improvised.
3. **"Show note to player"** jumps straight to the existing full-screen shareable-note presentation view (Press & Hold to exit, per [docs/table-mode-spec.md](table-mode-spec.md)'s UI flow 3) — not a preview first. Exiting that view returns to the sequencer at the same step, not the plain Live Table view. (This requires `enterPresentation(seat)` to accept an optional `onReturn` callback instead of always calling back into the default Live Table render — a small, backward-compatible extension of existing shared code.)
4. **Footer nav**: Back (disabled at step 0) · step counter ("Step N of M") · Restart · Next → (reads "Done" on the last step; clicking it on the last step closes the sequencer, same as the close button).
5. **Closing** the sequencer (✕, clicking the backdrop, or "Done" on the last step) never touches `game.phase` — it just returns to the normal Live Table view.

Prototype reference: throwaway branch `prototype/wake-sequencer-ux` (three variants explored — full-screen modal, docked side panel, inline seat-list accordion; the modal won). One implementation-relevant bug was found and fixed during the prototype: the modal is appended to `document.body` (outside the Table tab's mount point, matching the existing wizard's own pattern) so that it survives the mount's `innerHTML` reset on every re-render — the first version re-appended a fresh copy on every step without removing the previous one, silently stacking duplicate overlays until an invisible stale copy blocked all further clicks. The fix (unconditionally remove any stale copy before each redraw) should be retested explicitly when this is implemented for real, including the "Show note, then return" round-trip.

## State transitions summary

- **Night phase, sequencer closed** → tap the Phase-bar entry point → **sequencer open**, positioned at the remembered step for this specific `(phase.type, phase.number)` if one exists, else step 1.
- **Sequencer open** → Next/Back → **same step position updated**, remembered pointer rewritten to the new current character.
- **Sequencer open**, any step → Restart → **step 1**, remembered pointer cleared/rewritten to step 1's character.
- **Sequencer open**, any step with a prepared shareable note → "Show note to player" → **full-screen presentation view** → Press & Hold (1s) → **back to the sequencer, same step**.
- **Sequencer open**, last step → Next ("Done") → **sequencer closed**, `game.phase` unchanged.
- **Sequencer open** → ✕ / backdrop click → **sequencer closed** at any point, `game.phase` unchanged, remembered pointer for this night preserved for next time.
- **Day phase** → entry point disabled; nothing to sequence.
- **Page reload** → remembered step position is lost (session-only per the Position memory section); the Game itself still auto-resumes silently, per Table Mode's existing persistence rules.

## Not part of this spec

Two things came up during design that are real but deliberately unresolved here:

- Whether the Phase-bar entry point should move to a banner instead, to fix the confirmed narrow-width crowding — explicitly decided against for now, worth revisiting if the Phase bar gains further actions.
- Auto-detecting whether a conditional-flag step (Scarlet Woman/Ravenkeeper/Undertaker) actually applies, which would require adding death/execution-history tracking to the Game data model — ruled out for this effort, not ruled out forever.

Neither blocks implementing what's above.
