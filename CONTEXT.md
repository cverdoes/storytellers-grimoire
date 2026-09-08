# Blood on the Clocktower — Storyteller's Grimoire

A storyteller-facing tool for prepping and running games of Blood on the Clocktower, Trouble Brewing script. Single-file, no-backend, browser-only (`grimoire.html`).

## Language

**Character**:
A role from a Script (e.g. Washerwoman, Imp), with a team (townsfolk/outsider/minion/demon), ability text, and storyteller notes. Authored in that Script's Roster file; compiled into grimoire.html's embedded data at build time. Exists independently of any specific game; the same Character can be assigned to different Players across different Games.
_Avoid_: Role (ambiguous with "team")

**Script**:
A named collection of Characters designed to be played together (e.g. Trouble Brewing, Bad Moon Rising). This tool currently supports only Trouble Brewing, but the Roster file format is script-agnostic by design.
_Avoid_: Using "script" for the recompile tooling — that ambiguity is exactly why the tooling is called the Recompile step, never "the script."

**Roster file**:
The authored source of truth for one Script: every Character's full record (team, ability, storyteller notes, who-to-name guidance, setup/night/day notes) plus that Script's Night order and Setup progression, hand-edited by the storyteller outside grimoire.html. Conforms to the Roster spec. Distinct from the Roster *tab* in grimoire.html, which displays the compiled result of this file, and from `ROSTER`, the generated in-file variable name — neither is where a storyteller edits Character data going forward.

**Roster spec**:
The checked-in file-format specification a Roster file must conform to: script-agnostic, defining the shape of a Character record and a Night order. One spec, potentially many Roster files (one per Script).

**Night order**:
The canonical sequence of wake steps for First Night and Other Nights, referencing Characters by name (plus non-character steps like "Minion info"/"Demon info"). Part of a Script's Roster file — the single source of truth for wake order, compiled into grimoire.html's embedded data rather than hand-authored there.
_Avoid_: Wake order (used loosely elsewhere) as a competing term once a Roster file exists — prefer Night order in anything referencing the spec.

**Recompile**:
The one-directional action of regenerating grimoire.html's embedded data from a Roster file that conforms to the Roster spec. grimoire.html is never hand-edited for Character or Night order content afterward — only the Roster file is.
_Avoid_: "Build," "compile" alone, or "the script" for this action — reserve those for describing the recompile tooling's implementation, not for the domain action a storyteller performs after editing a Roster file.

**Player**:
A person seated at the table for a specific Game: a name, a Seat, an assigned Character, alive/dead status, a Vote status, and (once dead) whether their ghost vote is still available.
_Avoid_: Seat (a Player occupies a Seat, they aren't one), Participant

**Vote status**:
A Player's role in the current nomination, if any: Nominator, Nominated, or About to be Executed — mutually exclusive, since only one Player can really hold each at a time, not independent booleans. `null`/none the rest of the time. Set from either the Table view's Detail pane or the Town Square quick-access menu (click a Player's card); both mutate the same field, so the two can't drift.
_Avoid_: Nominated, About to be executed as standalone terms once this exists — they're options within Vote status now, not separate fields.

**Seat**:
A fixed circular position (1..n) a Player occupies for the duration of a Game. Adjacency between Players (used by abilities like Empath's "living neighbours") is computed from seat order plus current alive status, not stored separately.
_Avoid_: Slot. Position is a related but distinct term (see below) — don't conflate the two.

**Position**:
A per-Player, purely cosmetic `{x, y}` coordinate on the Circular Grimoire view's canvas, set by dragging that Player's card. Exists only to visually match the room's actual seating; never affects Seat order or ability-adjacency. Unset until the storyteller drags that Player, rendering at the auto-arranged circle spot until then.
_Avoid_: Seat (fixed, adjacency-bearing, assigned once at Game start), Coordinates, Layout

**Reminder token**:
A freely-labeled marker attached to a Player, noting a status caused by an ability — poisoned, drunk, protected, red herring, etc. This is the one uniform mechanism for all such statuses; nothing else gets a bespoke field. Matches the physical game's own term.
_Avoid_: Status marker, effect, flag

**Game**:
An in-progress instance of play: its Players (seating, Character assignments, alive/dead), all active Reminder tokens, and current phase. Persisted across reloads. Distinct from a Setup (see below), which is a static reference plan, not a live instance.
_Avoid_: Session, run

**Setup**:
A static, non-live reference plan in the Setups tab — a player-count-scoped character list plus setup/night/day checklist notes. Not a live Game. Checklist notes may include a Setup recommendation (see below) as well as generic per-Character guidance. May eventually seed a new Game's initial character selection, but as of this writing remains purely a reference artifact, unchanged by the live-game work.
_Avoid_: Using "setup" to mean configuring a live Game — that's just "starting a Game."

**Setup recommendation**:
A concrete, composition-specific answer to a storyteller decision — e.g. which player to make the red herring, which three Characters to give the Demon as bluffs — tailored to one particular Setup's exact character lineup. Distinct from a Character's generic setup/night/day notes (part of the Character record itself), which give guidance that holds regardless of which Setup that Character appears in; a Setup recommendation only makes sense for the one Setup it's attached to.
_Avoid_: Note, tip, suggestion — "note" collides with the existing generic per-Character notes this is deliberately distinct from.

**Table**:
The name of the new tab/mode where a Storyteller runs a live Game (start a Game, view/edit seating and Reminder tokens, use the shareable note view). Deliberately distinct from "Setups" to avoid the two being confused.

**Town Square**:
A read-only-as-a-layout circular view within the Table tab, alongside the Master-Detail Table view and the Grimoire view. Shows only what someone standing at the actual town square would know about each seated Player — name, alive/dead, Vote status, and (once dead) ghost-vote availability — deliberately omitting Character, team, and Reminder tokens, which are storyteller-only. Shares the Grimoire view's circular layout and persisted Position, since it's the same physical seating, but dragging only happens from the Grimoire view; clicking a Player's card here instead opens a quick-access menu for toggling Vote status/ghost vote.
_Avoid_: Grimoire view (team-colored, shows Character — the opposite of what Town Square deliberately hides)
