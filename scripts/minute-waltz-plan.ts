import { writeFileSync } from "node:fs";
import data from "../src/core/minute-waltz.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { questTargets, readPracticePlan, songFingerprint, type PracticePlan } from "../src/core/quests";

const song = data as Song;

// Each entry is one merged both-hands checkpoint. Edit this list to merge or
// split sections for another route, then regenerate and validate below.
const sections: [number, number, string][] = [
  [1, 16, "Opening theme and answer"],
  [17, 28, "Opening cadence and repeat"],
  [29, 44, "First ending and return"],
  [45, 60, "Second ending and sostenuto opening"],
  [61, 76, "Singing response and variation"],
  [77, 88, "Sostenuto close and held-trill bridge"],
  [89, 104, "Rotation and upper-answer returns"],
  [105, 124, "Return cadence and closing theme"],
  [125, 132, "Final theme"],
  [133, 140, "Coda and final flourish"],
];

const plan: PracticePlan = {
  version: 1,
  id: "minute-waltz-v2",
  title: "Minute Waltz · merged both-hands sections",
  song: { title: song.title, fingerprint: await songFingerprint(song) },
  repetitions: 10,
  counting: "total",
  quests: [],
};

const bars = measures(song);
let table = "| Bars | Source seconds | RH / LH attacks |\n| --- | --- | --- |\n";
for (const [fromBar, throughBar, section] of sections) {
  const quest = {
    section,
    instruction:
      "Play the whole section with both hands. Ten completed runs are required; wait mode checks target attacks and the ending, not articulation, pedal, ornament realization or phrasing.",
    fromBar,
    throughBar,
    focus: "all" as const,
    mode: "wait" as const,
    speed: 0.5,
    id: `section-${fromBar}-${throughBar}`,
    title: `Bars ${fromBar}–${throughBar} · ${section}`,
    hand: "both" as const,
  };
  if (!questTargets(song, quest).length)
    throw Error(`Merged section ${fromBar}–${throughBar} has no target notes`);
  plan.quests.push(quest);

  const a = bars[fromBar - 1], b = bars[throughBar - 1];
  const notes = song.notes.filter((n) => n.tick >= a.tick && n.tick < b.endTick);
  table += `| ${fromBar}–${throughBar} | ${a.start.toFixed(3)}–${b.end.toFixed(3)} | ${notes.filter((n) => n.hand === "right").length} / ${notes.filter((n) => n.hand === "left").length} |\n`;
}

const markdown = `# Minute Waltz practice route\n\nThis self-directed route has ten merged checkpoints. Every checkpoint covers a complete musical section with both hands; there are no separate right- or left-hand quests. Choose any section in any order, or use the list as a progressive path. Ten completed runs are required per checkpoint. Start at half source tempo (quarter = 140) and raise it when the section is secure. The held trill bridge and final flourish stay inside their surrounding sections. Source MIDI does not realize every printed trill/prall; rehearse ornament technique separately.\n\n${table}\n\n\`\`\`cadance-plan\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`;

await readPracticePlan(markdown, song);
writeFileSync("public/plans/minute-waltz.md", markdown);
console.log(`${plan.quests.length} validated quests`);
