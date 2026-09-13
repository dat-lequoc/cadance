import { writeFileSync } from "node:fs";
import data from "../src/core/debussy-arabesque-no-1.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { questTargets, readPracticePlan, songFingerprint, type PracticePlan } from "../src/core/quests";
const song = data as unknown as Song; const bars = measures(song);
const sections: [number, number, string][] = [[1, 24, "A · Andantino con moto"], [25, 48, "A′ · flowing continuation"], [49, 72, "B · animé"], [73, 94, "A′ · return"], [95, 107, "Coda · final cadence"]];
const plan: PracticePlan = { version: 1, id: "debussy-arabesque-no-1-v1", title: "Arabesque No. 1 · source-track practice", song: { title: song.title, fingerprint: await songFingerprint(song) }, repetitions: 10, counting: "total", quests: [] };
for (const [fromSection, toSection, section] of sections) for (let from = fromSection; from <= toSection; from += 2) {
  const through = Math.min(from + 1, toSection), base = { section, fromBar: from, throughBar: through, focus: "all" as const, mode: "wait" as const, speed: 0.6 };
  for (const hand of ["right", "left", "both"] as const) { const q = { ...base, id: `bars-${from}-${through}-${hand}`, title: `Bars ${from}–${through} · ${hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand"}`, hand, instruction: "Play the written texture from the source score; source-track hand targets are suggestions." }; if (questTargets(song, q).length) plan.quests.push(q); }
  if (from > fromSection) plan.quests.push({ ...base, id: `review-${fromSection}-${through}`, title: `Bars ${fromSection}–${through} · Section review`, fromBar: fromSection, hand: "both", repetitions: 5, instruction: "Connect the section with both hands, observing the written dynamics and pedal." });
}
const markdown = `# ${song.title} practice route\n\nAll checkpoints are unlocked. Choose any two-bar passage or a short section review. Upper/lower MIDI tracks provide initial hand targets; adapt them to your own redistribution.\n\n\`\`\`cadance-plan\n${JSON.stringify(plan)}\n\`\`\`\n`;
await readPracticePlan(markdown, song); writeFileSync("public/plans/debussy-arabesque-no-1.md", markdown); console.log(`${plan.quests.length} validated quests covering ${bars.length} bars`);
