---
status: accepted
---

# Only alive/dead is a first-class Player field; everything else is a Reminder token

Poisoned, drunk, protected, red herring, and every other in-game status could each have been modeled as a dedicated boolean/field on Player, matching how the request described "marking players as dead, poisoned etc." as if they were similar first-class marks. We instead gave only alive/dead a dedicated field, and modeled everything else — poison, drunk, protection, red herring, and any future status — as instances of one generic Reminder token mechanism (a freely-labeled marker attached to a Player). This mirrors the physical game exactly (death tips the character token itself; everything else is a literal reminder token) and avoids a Player schema that grows a new field every time a character introduces a new status. The cost is that consumers can't rely on a typed field for any specific status (e.g. "is this player poisoned") — that becomes a lookup by token label instead.
