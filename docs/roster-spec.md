# Roster spec

**Status: implemented by Recompile for `characters`/`night_order`.** The
`setups` section below is newly specified (see the [Setup
Recommendations](../.scratch/setup-recommendations/map.md) wayfinder map)
and not yet implemented by Recompile — `grimoire.html`'s `SETUPS` array
remains hand-authored until that map's content and wiring tickets land.

The file-format specification a **Roster file** must conform to. One Roster
file per **Script** (e.g. `scripts/trouble-brewing.yaml`); this spec is
script-agnostic so a second Script could conform later. See `CONTEXT.md`
for the Character / Script / Roster file / Night order vocabulary this
document assumes.

## File shape

A Roster file is a single YAML document with four top-level keys:

```yaml
script: Trouble Brewing
slug: trouble-brewing
characters:
  townsfolk: [ ... ]
  outsiders: [ ... ]
  minions: [ ... ]
  demons: [ ... ]
night_order:
  first_night: [ ... ]
  other_nights: [ ... ]
setups: [ ... ]
```

- `script` — the Script's display name, shown to a storyteller.
- `slug` — machine-safe identifier; by convention matches the Roster
  file's own filename (`scripts/<slug>.yaml`). Reserved for a future
  Script picker — Recompile doesn't need it yet with only one Script, but
  every Roster file declares it now so nothing has to be retrofitted.
- `characters` — every Character in the Script, **grouped by team** under
  four fixed keys: `townsfolk`, `outsiders`, `minions`, `demons`. A
  Character's team is which group it's listed under — there's no
  separate `team` field on the record itself (see below).
- `night_order` — the Script's Night order, split into `first_night` and
  `other_nights` (see below).
- `setups` — the Script's per-player-count recommended Setups (see
  below).

## Character record

One entry per Character, listed under its team's group in `characters`:

```yaml
characters:
  townsfolk:
    - name: Washerwoman
      timing: First night only
      ability: >-
        You're shown two players and told a Townsfolk character. Exactly
        one of those two players is really that character.
      note: >-
        The character you name must be in play. You pick which two
        players to show — one can be a decoy. If the Washerwoman is
        drunk or poisoned, everything you show can be false.
      naming: >-
        Name a Townsfolk whose reveal creates good discussion without
        deflating the game — Empath, Fortune Teller, Undertaker, and
        Monk all work well...
      notes:
        setup: >-
          Which two players do you show, and which Townsfolk do you
          name? Choose deliberately — see the Roster tab for who's worth
          naming. Remember the Spy can stand in as your decoy: it may
          register as a Townsfolk even though it's a Minion.
```

Fields:

| Field     | Required | Notes |
|-----------|----------|-------|
| `name`    | yes | must be unique across the whole file (all four groups); this is the string every Night order step and every other Character's `naming` prose refers to |
| `timing`  | yes | free text describing when the Character acts — e.g. "First night only", "Every night", "Once, during the day", "Setup only", "Passive". Purely descriptive: shown verbatim on the Roster card and in the Setups tab's token tooltip, never parsed or branched on by any render logic. Named `timing` rather than `wake` because most of its values (day-only, setup-only, passive) don't involve waking at night at all — `wake` specifically refers to the Night order (see below), a materially different thing this field must also describe |
| `ability` | yes | free text |
| `note`    | yes | storyteller notes, free text |
| `naming`  | no  | who-to-name guidance; present only on Characters that name another Character (Washerwoman, Librarian, Investigator, Imp today) |
| `notes`   | no  | a map with optional `setup` / `night` / `day` string keys — today's `NOTES[name]` object, moved onto the Character record itself instead of a parallel array keyed by name. This is a deliberate shape change from today's grimoire.html (see "Change from today's shape" below) |
| `tokens`  | no  | the Reminder tokens this Character brings to the game (e.g. the Poisoner's `Poisoned`) — a curated list offered as one-click "quick add" buttons in the live Table view's Detail pane. List order is display order. Every entry must be a non-empty string, and no entry may repeat within one Character's list. Most Characters won't have this field at all — it's a curated subset, not a requirement |

**Team is positional, not a field.** Today's `ROSTER` entries each carry
a `team: "townsfolk"` string. The Roster file instead groups Characters
under `characters.townsfolk` / `.outsiders` / `.minions` / `.demons`, so
the group a Character is filed under *is* its team — one less field to
keep consistent, and the YAML visually clusters each team together the
way the Roster tab already displays them. Recompile re-attaches a `team`
field (using the singular form `ROSTER` expects — `townsfolk`→
`townsfolk`, `outsiders`→`outsider`, `minions`→`minion`, `demons`→
`demon`) when it flattens these four groups back into `ROSTER`, so
`renderRoster()` needs no changes.

**Change from today's shape:** grimoire.html keeps `ROSTER` and `NOTES` as
two separate arrays/objects, joined by `name` at render time. The Roster
spec merges them into one record per Character, so everything about
Washerwoman lives in one place in the YAML. This is the kind of drift the
whole move to a Roster file is meant to end (see
`docs/adr/0002-roster-file-compiled-one-directionally.md`) — keeping two
parallel structures in the authored source would just relocate the
problem ADR 0002 is fixing, not solve it. Recompile is responsible for
splitting this back into the `ROSTER` / `NOTES` shape grimoire.html's
render functions already expect, so `renderRoster()` / `renderSetups()`
need no changes.

**`notes.*` are always plain static strings.** Per ADR 0002, the
Spy/Recluse-aware conditional wording (`ctx => ...` functions in today's
`NOTES`) is dropped. Where a note used to omit a caveat when e.g. no
Recluse was in play, the Roster file instead states the caveat
unconditionally, every time. For example, today's Empath night note:

```js
night: ctx => `How many of their two living neighbors are evil? Give the
true count — 0, 1, or 2 — remembering the Spy can register as good and
slip out of the count if it's sitting next to them.${ctx.hasRecluse ? "
The Recluse can do the reverse: register as evil and land in the count
even though it's good." : ""} If the Empath is poisoned, invent the
number freely instead.`
```

becomes, in the Roster file:

```yaml
notes:
  night: >-
    How many of their two living neighbors are evil? Give the true
    count — 0, 1, or 2 — remembering the Spy can register as good and
    slip out of the count if it's sitting next to them. The Recluse can
    do the reverse: register as evil and land in the count even though
    it's good. If the Empath is poisoned, invent the number freely
    instead.
```

— the Recluse clause is now always present, regardless of whether a
Recluse is actually in that setup.

## Night order

`night_order.first_night` and `night_order.other_nights` are each a list
of **steps**, in wake order. A step is one of two shapes:

**Character step** — most steps; wakes a named Character:

```yaml
- name: Poisoner
  body: They choose a player to poison for the night.
```

- `name` — must exactly match a `name` in `characters`. Recompile fails
  loudly (see Validation) if it doesn't.
- `body` — the storyteller script for that step.
- `flag` — optional, a conditional-display caveat shown next to the step
  in the UI (e.g. `if triggered`, `if killed tonight`, `if execution
  today`). This is unrelated to the dropped `ctx =>` note machinery above
  — it's just a short string the UI prints next to the step name so the
  storyteller knows the step might not apply tonight.

  ```yaml
  - name: Scarlet Woman
    flag: if triggered
    body: Only relevant if the Demon has just died with 5+ players alive — she becomes the Demon here.
  ```

**Info step** — a non-Character step like "Minion info" / "Demon info":

```yaml
- info: true
  name: Minion info
  body: Wake all Minions together. Show them who each other are, and who the Demon is.
```

- `info: true` marks it as a non-Character step. Its `name` is display
  text, not a reference into `characters`, and is exempt from the
  name-resolution check below.
- `body` — same as a Character step.

Today's generated JS also gives every info step a literal `flag:"info"`,
which the render code special-cases into rendering nothing (the `info`
CSS class alone gives the row its distinct look — the flag text was
always redundant with it). The Roster file doesn't carry that redundancy:
Recompile synthesizes `flag:"info"` on the generated step whenever it
emits `info:true`, so the generated `FIRST_NIGHT`/`OTHER_NIGHT` output —
and therefore `renderNight()` — is byte-for-byte the same shape as today,
with zero render-code changes. **Flagging this as a decision to confirm**,
since it's the one place this spec diverges from a pure transcription.

## Setups

`setups` is a flat list of **Setup** records, one per recommended player
count, in ascending `n` order. Each Setup is fully independent and
self-contained — it is **not** a delta from the previous entry. This is a
deliberate departure from today's hand-authored `SETUPS` array in
grimoire.html, which folds a nested/additive `add`/`remove` delta forward
across steps; that mechanism is not carried into the Roster file. See the
[Setup Recommendations](../.scratch/setup-recommendations/map.md)
wayfinder map for the decision trail.

```yaml
setups:
  - n: 9
    note: >-
      5 Townsfolk, 2 Outsiders, 1 Minion, 1 Demon — the base ratio for 9
      players.
    characters:
      - Washerwoman
      - Empath
      - Fortune Teller
      - Undertaker
      - Monk
      - Butler
      - Recluse
      - Poisoner
      - Imp
    recommendations:
      Fortune Teller:
        setup: >-
          The Recluse is the standout pick here — it's the one
          character in this lineup already built to register
          ambiguously, so a "yes" on it costs nothing extra in cover
          story.
      Imp:
        setup: >-
          Bluffs just need to be characters nobody's holding, so
          structurally anything outside this lineup works — but favor
          ones that never force a public demonstration. Investigator,
          Chef, and Librarian all resolve privately on night one and
          are never tested again, which is what makes a claim hold up
          under pressure.
```

Fields:

| Field             | Required | Notes |
|-------------------|----------|-------|
| `n`               | yes | player count this Setup recommends for; unique across the list |
| `characters`      | yes | the full recommended lineup for this player count — every Character name, not a delta from any other Setup |
| `note`            | no  | free-text authorial commentary (e.g. "this is a restructure from the 8-player ratio" or "the base ratio for 9 players") — purely descriptive, may or may not describe a difference from an adjacent Setup, entirely at the author's discretion |
| `recommendations` | no  | a map keyed by Character name, each value shaped exactly like a Character's own `notes` field (`{setup?, night?, day?}`, free-text strings) — a **Setup recommendation** (`CONTEXT.md`): a concrete, composition-specific answer (e.g. a real red-herring target, real Demon bluffs) distinct from that Character's generic `notes`, which apply regardless of which Setup it appears in |

**Voice.** A Setup recommendation reads as a hint, not a directive:
reasoning leads, and a specific pick (if there is one) follows as its
natural conclusion rather than a flat "Recommended: X" line. A
character that IS in this Setup's own `characters` list can never be
one of its own bluffs or misdirects — double-check before reusing text
across Setups. Where the reasoning genuinely doesn't land on one clear
answer (e.g. a small lineup with no standout misdirection target), say
that explicitly rather than forcing a pick — see the 7- and 8-player
Fortune Teller entries in `scripts/trouble-brewing.yaml` for an
example of both the confident and the hedged case.

**No inheritance.** Because each Setup is independent, `recommendations`
is also fully self-contained per Setup — nothing carries forward from a
lower `n`. If two Setups both want the same recommendation for a
Character, both author it in full.

**"New since last" is derived, not authored.** Today's rendered Setups
tab visually distinguishes a Character that's new at this player count
from one carried over from the previous count. Since Setups are no
longer authored as deltas, Recompile derives this itself: for each
Setup (after sorting by `n`), a Character counts as new if it's absent
from the immediately preceding Setup's `characters` list (every
Character in the very first Setup counts as new, since there is no
preceding one to compare against). This computation happens once, at
compile time — `grimoire.html`'s render code consumes the precomputed
result rather than diffing lists itself, the same "push work into
Recompile, keep render functions dumb" pattern `characters`/`night_order`
already follow.

## Validation

Recompile validates a Roster file before generating anything, and
**fails loudly** (throws, stops the Recompile, prints the offending file
+ Character/step name) rather than warning and continuing — this is a
single-author tool, so a silently-skipped bad entry is worse than a
blocked Recompile.

Rules:

- `script` and `slug` are present and non-empty; `slug` matches
  `/^[a-z0-9-]+$/.
- `characters` has exactly the four keys `townsfolk`, `outsiders`,
  `minions`, `demons` (each a list; a list may be empty for a Script that
  genuinely has none of that team, though no real Script does today).
- Every Character entry, in every group, has `name`, `timing`, `ability`,
  `note`.
- Every `name` is unique across all four groups.
- Every non-info step's `name` (in both `first_night` and
  `other_nights`) resolves to some Character's `name` in any group.
- Every step has a `body`.
- If present, a Character's `tokens` is a list; every entry is a
  non-empty string; no entry repeats within that Character's own list.
- If present, every Setup in `setups` has a unique `n` and a non-empty
  `characters` list with no duplicate Character names within that one
  Setup.
- Every name in a Setup's `characters` list, and every Character-name key
  in its `recommendations` map, resolves to some declared Character's
  `name` in any group. Recompile does **not** validate that a Setup's
  `characters` list matches the official team ratio for that `n`, or
  that a `recommendations` key is actually present in that same Setup's
  `characters` list — both are left to the author's judgment, consistent
  with Recompile checking structure, not domain correctness.

## Example

A 3-Character illustrative excerpt (not a full, valid Roster file — a
real file needs every Night order name to resolve, and this excerpt
references a few it doesn't declare, e.g. Scarlet Woman):

```yaml
script: Trouble Brewing
slug: trouble-brewing

characters:
  townsfolk:
    - name: Washerwoman
      timing: First night only
      ability: >-
        You're shown two players and told a Townsfolk character. Exactly
        one of those two players is really that character.
      note: >-
        The character you name must be in play. You pick which two
        players to show — one can be a decoy. If the Washerwoman is
        drunk or poisoned, everything you show can be false.
      naming: >-
        Name a Townsfolk whose reveal creates good discussion without
        deflating the game — Empath, Fortune Teller, Undertaker, and
        Monk all work well, since even partly outed they keep acting and
        their claims stay checkable. Avoid naming the Virgin or Slayer:
        both rely on nobody being sure who holds them, and an early
        reveal strips away exactly the tension that makes them fun.
      notes:
        setup: >-
          Which two players do you show, and which Townsfolk do you
          name? Choose deliberately — see the Roster tab for who's worth
          naming. Remember the Spy can stand in as your decoy: it may
          register as a Townsfolk even though it's a Minion.

    - name: Empath
      timing: Every night
      ability: >-
        Each night, you're told how many of your two living neighbours
        (the nearest alive player each direction) are evil — 0, 1, or 2.
      note: >-
        Neighbours change as players die and seats close up. Recalculate
        who's actually adjacent each night before answering.
      notes:
        night: >-
          How many of their two living neighbors are evil? Give the
          true count — 0, 1, or 2 — remembering the Spy can register as
          good and slip out of the count if it's sitting next to them.
          The Recluse can do the reverse: register as evil and land in
          the count even though it's good. If the Empath is poisoned,
          invent the number freely instead.

  demons:
    - name: Imp
      timing: Every night except the first
      ability: >-
        Each night, you choose a player, who dies. If you choose
        yourself, you die instead and a living Minion becomes the new
        Imp.
      note: >-
        A replacement Imp does not get to kill that same night — their
        first kill is the following night.
      naming: >-
        On night one you also hand the Imp three bluff characters not in
        this game, for them to claim if pressed. Favor quiet info
        Townsfolk (Empath, Undertaker, Fortune Teller-style roles) whose
        claims are hard to disprove and never require a public
        demonstration. Steer clear of Slayer or Virgin as bluffs — both
        eventually force a visible, hard-to-fake moment that can unravel
        the whole claim.

night_order:
  first_night:
    - info: true
      name: Minion info
      body: Wake all Minions together. Show them who each other are, and who the Demon is.
    - info: true
      name: Demon info
      body: >-
        Wake the Demon. Show them their Minions, plus three 'bluff'
        characters not in this game, to claim if pressed.
    - name: Washerwoman
      body: Show two players and a Townsfolk character in play.
    - name: Empath
      body: Tell them how many of their two neighbours are evil.

  other_nights:
    - name: Scarlet Woman
      flag: if triggered
      body: >-
        Only relevant if the Demon has just died with 5+ players alive —
        she becomes the Demon here.
    - name: Imp
      body: They choose a player to kill, or themselves to pass the role on.
    - name: Empath
      body: Tell them how many of their current two neighbours are evil.
```

## Open questions for the user

1. Does merging `NOTES` into each Character's `notes` map (rather than
   keeping a parallel structure) look right, or is there a reason to keep
   them separate?
2. Is dropping the redundant `flag:"info"` from the *authored* YAML (while
   Recompile still emits it in the generated JS) the right call, or should
   the YAML just carry it explicitly for a more literal transcription?
3. Is "fail loudly, no warn mode" the right default for Recompile
   validation, given this is a single-author tool?

Resolved during this round of prototyping: Characters are grouped by
team under `characters.{townsfolk,outsiders,minions,demons}` rather than
carrying a `team` field (per-team grouping reads better in the source
file and matches how the Roster tab already displays them); the old
`wake` field is renamed `timing` and stays free text — it's purely
display text (Roster card badge, Setups tab token tooltip), never parsed
by any render logic, and `wake` was the wrong name since most of its
values (day-only, setup-only, passive) don't involve night-waking at all.
