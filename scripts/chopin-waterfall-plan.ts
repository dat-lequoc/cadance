/** Generate an unlocked, compact practice route for the 79-bar étude. */
import { writeFileSync } from "node:fs";
import data from "../src/core/chopin-waterfall-op-10-no-1.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { questTargets, readPracticePlan, songFingerprint, type PracticePlan } from "../src/core/quests";
const song = data as unknown as Song;
const sections: [number, number, string][] = [[1, 16, "Opening · C major arpeggios"], [17, 32, "First harmonic sequence"], [33, 48, "Development · rising sequences"], [49, 64, "Return · expanding resonance"], [65, 79, "Coda · final ascent and cadence"]];
const plan: PracticePlan = { version: 1, id: "chopin-waterfall-op-10-no-1-v1", title: "Waterfall · open practice route", song: { title: song.title, fingerprint: await songFingerprint(song) }, repetitions: 10, counting: "total", quests: [] };
const label = (h: "right" | "left" | "both") => h === "both" ? "Both hands" : h === "right" ? "Right hand" : "Left hand";
for (const [sectionFrom, sectionTo, section] of sections) {
  for (let from = sectionFrom; from <= sectionTo; from += 2) {
    const through = Math.min(from + 1, sectionTo);
    const base = { section, fromBar: from, throughBar: through, focus: "all" as const, mode: "wait" as const, speed: 0.6, instruction: "Keep the arpeggio motion even and relaxed. The upper/lower targets follow the source staves; personalize redistribution in Parts & accompaniment." };
    for (const hand of ["right", "left", "both"] as const) { const quest = { ...base, id: `bars-${from}-${through}-${hand}`, title: `Bars ${from}–${through} · ${label(hand)}`, hand }; if (questTargets(song, quest).length) plan.quests.push(quest); }
    if (from > sectionFrom && through - sectionFrom + 1 <= 10) { const review = { ...base, id: `review-${sectionFrom}-${through}`, title: `Bars ${sectionFrom}–${through} · Section review`, fromBar: sectionFrom, hand: "both" as const, repetitions: 5 }; if (questTargets(song, review).length) plan.quests.push(review); }
  }
}
const markdown = `# ${song.title} practice route\n\nAll checkpoints are unlocked. Choose any two-bar passage, then connect short reviews when ready.\n\n\`\`\`cadance-plan\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`;
await readPracticePlan(markdown, song);
writeFileSync("public/plans/chopin-waterfall-op-10-no-1.md", markdown);
console.log(`${plan.quests.length} validated quests covering ${measures(song).length} bars`);
