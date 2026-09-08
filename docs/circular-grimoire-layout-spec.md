# Circular Grimoire Layout Spec

A free-position, drag-and-drop spatial seat layout that **replaces** the
Grimoire view's read-only card-grid rendering (`docs/grimoire-view` /
`renderGrimoireView`) — letting the storyteller drag Player cards around a
circle to visually match their room's actual seating, persisted per Game.
This document is the assembled output of the
[Circular Grimoire Layout wayfinder map](../.scratch/circular-grimoire-layout/map.md)
— see that file for the decision trail; this document is the thing to
actually build from.

Domain vocabulary (Character, Player, Seat, Game, Table, and the new
**Position** term this effort added) is defined in
[`CONTEXT.md`](../CONTEXT.md) at the repo root — read it first. The
existing Grimoire view (`.scratch/grimoire-view/spec.md`) and Table Mode
(`docs/table-mode-spec.md`) specs are prerequisite reading: this document
only covers what changes.

## Scope

**In scope**: replacing the Grimoire view's card-grid rendering with a
draggable circular layout. Purely cosmetic — dragging never touches real
Seat order or ability-relevant adjacency (Seat stays the fixed 1..n
concept; Position is the new, separate, free-floating one — see
`CONTEXT.md`).

**Hard constraints inherited from Table Mode / Grimoire View** (still
apply, unchanged): single-device, single-file/no-backend/Artifact-
publishable, Trouble Brewing only, no live rules computation. Seat order
is fixed at Start Game. Not optimized for narrow/phone widths, matching
the Master-Detail Table view's existing precedent.

**Explicitly out of scope** (see the map's Out of scope section for full
reasoning):
- Real Seat reordering via drag — dragging is cosmetic-only.
- Master-Detail Table view and Setup Flow spatial layouts — this is
  Grimoire-view-only.
- Narrow/phone-width optimization.
- Everything already ruled out of Table Mode and the Grimoire view
  themselves (multi-device, live wake-sequencer integration beyond what
  already exists, script-switching, a player-facing presentation mode,
  persisting the *view-mode* choice, any new filter/search).

## Data model

Extends the existing Game object (`docs/table-mode-spec.md`'s Data
model) with one new optional field per Player:

```json
{
  "schemaVersion": 1,
  "players": [
    {
      "seat": 1,
      "name": "Alex",
      "character": "Washerwoman",
      "alive": true,
      "reminderTokens": [],
      "storytellerNote": "",
      "shareableNote": "",
      "position": null
    }
  ]
}
```

- **`position`**: `{x, y} | null`. Absolute pixel coordinates of that
  Player's card, relative to the circular canvas's own origin — **not**
  percentage-relative-to-container, and not the same concept as `seat`
  (see the **Position** entry in `CONTEXT.md`). `null` means "not yet
  dragged — render at the auto-arranged circle spot computed from `seat`
  order"; the storyteller dragging a card writes a concrete `{x, y}` here.
  Computed positions are never persisted for undragged seats — only an
  explicit drag writes this field, since seat count (and therefore the
  auto-arranged layout) is fixed for the life of a Game and recomputing
  it is always cheap.
- **No `schemaVersion` bump.** Purely additive/optional: a Game persisted
  before this feature existed simply has every Player's `position`
  absent, and rendering code treats that identically to an explicit
  `null`.
- **Reset semantics.** The Grimoire view's persistent "↺ Reset" control
  sets every Player's `position` back to `null` — it does not write
  freshly computed coordinates, it un-writes the field entirely.

## Layout & interaction

Replaces `renderGrimoireView(game)`'s card-grid rendering. Still consumes
the same `buildSeatDisplays(game)` data source as the existing Grimoire
view and the Table view's seat list (per-Seat `{seat, name, character,
team, alive, reminderTokens}`, no `storytellerNote`/`shareableNote`) —
this feature only changes *how* that data is arranged and interacted
with, not where it comes from.

- **Default arrangement.** Seats evenly spaced around a circle in seat
  order, starting at 12 o'clock and proceeding clockwise. Radius scales
  with seat count so **card size stays constant** rather than shrinking
  to fit.
- **Card content & sizing.** A round, team-colored circle (reusing the
  existing `--tf`/`--out`/`--min`/`--dem` team-color tokens) containing
  the **Player's name** — no role letter, no seat-number badge; team is
  legible via circle color alone. Long names clamp to 2 lines with an
  ellipsis fallback. Character name sits below the circle; Reminder
  tokens are listed **fully spelled out, one per line**, below the
  character name. A dead seat's card dims and strikes through the name,
  matching the existing Table/Grimoire-view treatment (same CSS classes
  reused, not reimplemented).
- **Overflow at high seat counts.** At 15 seats the circle is taller than
  the visible area — **scroll is fine**, card size stays constant at
  every seat count. Implementation should add a subtle scroll-affordance
  hint (e.g. a faint edge shadow) so it doesn't read as a layout bug.
- **Drag behavior: always draggable, free-form.** No mode gate — dragging
  is live any time the Grimoire view is open (no separate "Arrange Mode"
  toggle). Dragging is cosmetic-only and writes `position` on drop.
- **Overlap handling: none.** Cards can be dragged on top of each other
  with no collision avoidance or snapping — left entirely to the
  storyteller's judgment, consistent with how the app already leaves
  team-ratio validation to them.
- **Reset affordance.** A persistent "↺ Reset" control, always visible
  (e.g. bottom-right of the canvas), resets every seat's `position` to
  `null` (see Data model above).

**Open flag for implementation, not re-litigated here:** with the role
letter removed, team color is the *only* at-a-glance role signal. During
prototyping the Minion (rust-brown) and Demon (deep red) circle colors
read fairly close to each other, especially in dark mode — worth a
contrast check when this is built.

Prototype reference: branch `prototype/circular-grimoire-layout`
(`.scratch/circular-grimoire-layout/prototype.html?variant=A&seats=N`).

## State transitions

- **Toggling into the Grimoire view** (existing toggle button, unchanged)
  now renders this circular layout instead of the card grid; the phase
  bar above it (New Game…, Wake Sequence, Advance →) is unaffected.
- **Dragging a card** writes that Player's `position` and persists
  immediately — no separate "save" step, consistent with every other
  Table-mode mutation.
- **Any Game-state change made elsewhere** (Reassign, Alive/Dead toggle,
  Reminder-token add/remove, Phase advance) re-renders the circle with
  the same `position` values untouched — none of those actions affect
  `position`.
- **Starting a new Game** has no existing Players to carry `position`
  forward from, so it simply begins with every seat's `position` absent
  (`null`), same as any other freshly started Game.

## Not part of this spec

Everything listed under Scope's "Explicitly out of scope" above. These
were consciously ruled out while charting the destination, not merely
deferred — see the map's Out of scope section for the reasoning behind
each.
