#!/usr/bin/env node
"use strict";

// Recompiles a Roster file (docs/roster-spec.md) into grimoire.html's
// GENERATED:ROSTER / GENERATED:NOTES / GENERATED:REMINDER_PRESETS regions.
// See docs/roster-spec.md and
// docs/adr/0002-roster-file-compiled-one-directionally.md — this is the only
// direction data flows; grimoire.html is never hand-edited for this content.
//
// Usage: node recompile-roster.js <path-to-roster-file.yaml>
//    or: npm run recompile

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const GROUPS = ["townsfolk", "outsiders", "minions", "demons"];
const GROUP_TO_TEAM = { townsfolk: "townsfolk", outsiders: "outsider", minions: "minion", demons: "demon" };
const GRIMOIRE_PATH = path.join(__dirname, "grimoire.html");

function fail(message) {
  console.error(`Recompile failed: ${message}`);
  process.exit(1);
}

function validate(doc, rosterPath) {
  const errors = [];
  if (!doc.script) errors.push("missing top-level `script`");
  if (!doc.slug || !/^[a-z0-9-]+$/.test(doc.slug)) {
    errors.push(`\`slug\` must match /^[a-z0-9-]+$/, got ${JSON.stringify(doc.slug)}`);
  }
  if (!doc.characters) {
    errors.push("missing top-level `characters`");
  } else {
    const extra = Object.keys(doc.characters).filter(k => !GROUPS.includes(k));
    if (extra.length) errors.push(`unexpected characters group(s): ${extra.join(", ")}`);
    for (const g of GROUPS) {
      if (!Array.isArray(doc.characters[g])) {
        errors.push(`characters.${g} must be a list (use an empty list if this Script has none)`);
      }
    }
  }
  if (!doc.night_order || !Array.isArray(doc.night_order.first_night) || !Array.isArray(doc.night_order.other_nights)) {
    errors.push("missing night_order.first_night / night_order.other_nights lists");
  }
  if (errors.length) fail(`${rosterPath}\n  - ${errors.join("\n  - ")}`);

  const names = new Set();
  const allCharacters = [];
  for (const group of GROUPS) {
    for (const c of doc.characters[group]) {
      for (const field of ["name", "timing", "ability", "note"]) {
        if (!c[field]) errors.push(`a Character in characters.${group} is missing \`${field}\` (${c.name ? `name: "${c.name}"` : JSON.stringify(c)})`);
      }
      if (c.name) {
        if (names.has(c.name)) errors.push(`duplicate Character name: "${c.name}"`);
        names.add(c.name);
      }
      if (c.tokens !== undefined) {
        const who = c.name ? `"${c.name}"` : JSON.stringify(c);
        if (!Array.isArray(c.tokens)) {
          errors.push(`${who}'s \`tokens\` must be a list`);
        } else {
          const seen = new Set();
          c.tokens.forEach(token => {
            if (typeof token !== "string" || !token) {
              errors.push(`${who}'s \`tokens\` contains a non-string or empty entry`);
            } else if (seen.has(token)) {
              errors.push(`${who}'s \`tokens\` contains a duplicate entry: "${token}"`);
            } else {
              seen.add(token);
            }
          });
        }
      }
      allCharacters.push(Object.assign({}, c, { team: GROUP_TO_TEAM[group] }));
    }
  }

  const stepLabels = [["night_order.first_night", doc.night_order.first_night], ["night_order.other_nights", doc.night_order.other_nights]];
  for (const [label, steps] of stepLabels) {
    steps.forEach((step, i) => {
      if (!step.name) errors.push(`${label}[${i}] is missing \`name\``);
      if (!step.body) errors.push(`${label}[${i}] "${step.name}" is missing \`body\``);
      if (!step.info && step.name && !names.has(step.name)) {
        errors.push(`${label}[${i}] "${step.name}" does not resolve to any declared Character`);
      }
    });
  }

  if (doc.setups !== undefined) {
    if (!Array.isArray(doc.setups)) {
      errors.push("`setups`, if present, must be a list");
    } else {
      const seenN = new Set();
      doc.setups.forEach((s, i) => {
        const label = `setups[${i}] (n=${s && s.n})`;
        if (typeof s.n !== "number") {
          errors.push(`setups[${i}] is missing a numeric \`n\``);
        } else if (seenN.has(s.n)) {
          errors.push(`${label}: duplicate \`n\`: ${s.n}`);
        } else {
          seenN.add(s.n);
        }
        if (!Array.isArray(s.characters) || s.characters.length === 0) {
          errors.push(`${label} must have a non-empty \`characters\` list`);
        } else {
          const seenChar = new Set();
          s.characters.forEach(name => {
            if (seenChar.has(name)) errors.push(`${label}: duplicate character in \`characters\`: "${name}"`);
            seenChar.add(name);
            if (!names.has(name)) errors.push(`${label}: \`characters\` entry "${name}" does not resolve to any declared Character`);
          });
        }
        if (s.recommendations) {
          for (const key of Object.keys(s.recommendations)) {
            if (!names.has(key)) errors.push(`${label}: \`recommendations\` key "${key}" does not resolve to any declared Character`);
          }
        }
      });
    }
  }

  if (errors.length) fail(`${rosterPath}\n  - ${errors.join("\n  - ")}`);
  return allCharacters;
}

// Setups are independent, self-contained lineups (Ticket 01's Answer: no
// add/remove delta), but the rendered Setups tab still distinguishes a
// Character that's new at this player count from one carried over from the
// previous one. That "new since last" flag is derived here, once, at compile
// time, rather than authored or recomputed in the browser — see
// .scratch/setup-recommendations/issues/01-format-shape.md.
function compileSetups(doc) {
  if (!doc.setups) return [];
  const sorted = doc.setups.slice().sort((a, b) => a.n - b.n);
  let prevChars = null;
  return sorted.map(s => {
    const prevSet = prevChars ? new Set(prevChars) : null;
    const characters = s.characters.map(name => ({ name, isNew: prevSet ? !prevSet.has(name) : true }));
    prevChars = s.characters;
    const out = { n: s.n, characters };
    if (s.note) out.note = s.note;
    if (s.recommendations) out.recommendations = s.recommendations;
    return out;
  });
}

function compile(doc, allCharacters) {
  const ROSTER = allCharacters.map(c => {
    const out = { team: c.team, name: c.name, wake: c.timing, ability: c.ability, note: c.note };
    if (c.naming) out.naming = c.naming;
    return out;
  });

  const NOTES = {};
  allCharacters.forEach(c => { if (c.notes) NOTES[c.name] = c.notes; });

  const REMINDER_PRESETS = {};
  allCharacters.forEach(c => { if (c.tokens) REMINDER_PRESETS[c.name] = c.tokens; });

  const compileSteps = steps => steps.map(s => {
    if (s.info) return { info: true, name: s.name, flag: "info", body: s.body };
    if (s.flag) return { name: s.name, flag: s.flag, body: s.body };
    return { name: s.name, body: s.body };
  });

  return {
    ROSTER,
    NOTES,
    REMINDER_PRESETS,
    FIRST_NIGHT: compileSteps(doc.night_order.first_night),
    OTHER_NIGHT: compileSteps(doc.night_order.other_nights),
    SETUPS: compileSetups(doc),
  };
}

function renderConst(varName, value) {
  return `const ${varName} = ${JSON.stringify(value, null, 2)};`;
}

function splice(html, markerName, generatedBody) {
  const startMarker = `/* GENERATED:${markerName}:START */`;
  const endMarker = `/* GENERATED:${markerName}:END */`;
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    fail(`grimoire.html is missing matching ${startMarker} / ${endMarker} markers`);
  }
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  return `${before}\n${generatedBody}\n${after}`;
}

function main() {
  const rosterPath = process.argv[2];
  if (!rosterPath) fail("usage: node recompile-roster.js <path-to-roster-file.yaml>");

  const doc = yaml.load(fs.readFileSync(rosterPath, "utf8"));
  const allCharacters = validate(doc, rosterPath);
  const { ROSTER, NOTES, REMINDER_PRESETS, FIRST_NIGHT, OTHER_NIGHT, SETUPS } = compile(doc, allCharacters);

  let html = fs.readFileSync(GRIMOIRE_PATH, "utf8");
  html = splice(html, "ROSTER", [
    renderConst("ROSTER", ROSTER),
    "",
    renderConst("FIRST_NIGHT", FIRST_NIGHT),
    "",
    renderConst("OTHER_NIGHT", OTHER_NIGHT),
  ].join("\n"));
  html = splice(html, "NOTES", renderConst("NOTES", NOTES));
  html = splice(html, "REMINDER_PRESETS", renderConst("REMINDER_PRESETS", REMINDER_PRESETS));
  html = splice(html, "SETUPS", renderConst("SETUPS", SETUPS));
  fs.writeFileSync(GRIMOIRE_PATH, html);

  console.log(`Recompiled ${rosterPath} -> grimoire.html: ${ROSTER.length} Characters, ${FIRST_NIGHT.length} First Night steps, ${OTHER_NIGHT.length} Other Nights steps, ${SETUPS.length} Setups.`);
}

main();
