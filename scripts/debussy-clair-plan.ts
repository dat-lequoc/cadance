import { writeFileSync, readFileSync } from "node:fs";
import data from "../src/core/debussy-clair-de-lune.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { questTargets, readPracticePlan, songFingerprint, type PracticePlan } from "../src/core/quests";

const song = data as unknown as Song;
const bars = measures(song);
const sections: [number, number, string][] = [[1, 18, "Opening · Andante très expressif"], [19, 36, "Un poco mosso"], [37, 50, "En animant"], [51, 60, "A tempo"], [61, 72, "Coda · morendo"]];
const plan: PracticePlan = { version: 1, id: "debussy-clair-de-lune-v1", title: "Clair de lune · source-track practice", song: { title: song.title, fingerprint: await songFingerprint(song) }, repetitions: 10, counting: "total", quests: [] };
for (const [sectionStart, sectionEnd, section] of sections) {
  for (let start = sectionStart; start <= sectionEnd; start += 2) {
    const end = Math.min(start + 1, sectionEnd);
    const base = { section, fromBar: start, throughBar: end, focus: "all" as const, mode: "wait" as const, speed: end - start > 0 ? 0.6 : 0.5 };
    for (const hand of ["right", "left", "both"] as const) {
      const q = { ...base, id: `bars-${start}-${end}-${hand}`, title: `Bars ${start}–${end} · ${hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand"}`, hand, instruction: "Play the complete written texture from the source score; source-track hand targets are suggestions for practice." };
      if (questTargets(song, q).length) plan.quests.push(q);
    }
    if (start > sectionStart) plan.quests.push({ ...base, id: `review-${sectionStart}-${end}`, title: `Bars ${sectionStart}–${end} · Section review`, fromBar: sectionStart, hand: "both", repetitions: 5, instruction: "Connect this section with both hands; listen for balance, voicing, pedal and the written dynamics." });
  }
}
const markdown = `# ${song.title} practice route\n\nAll checkpoints are unlocked. Choose any two-bar passage, or use the short section reviews. The PDF is the primary score; the MIDI's upper/lower tracks provide initial hand targets and should be adapted to your own redistribution.\n\n\`\`\`cadance-plan\n${JSON.stringify(plan)}\n\`\`\`\n`;
await readPracticePlan(markdown, song);
writeFileSync("public/plans/debussy-clair-de-lune.md", markdown);
console.log(`${plan.quests.length} validated quests covering ${bars.length} bars`);
