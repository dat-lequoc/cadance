import { writeFileSync } from "node:fs";
import data from "../src/core/ballade-1.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { songFingerprint, questTargets, readPracticePlan, type PracticePlan } from "../src/core/quests";

const song = data as unknown as Song;
const sections: [number, number, string][] = [
  [1,7,"Introduction"], [8,15,"First theme · opening"], [16,23,"First theme · answer"],
  [24,31,"First theme · expansion"], [32,35,"First theme · cadence"],
  [36,43,"First theme · return"], [44,51,"Agitato · opening"], [52,59,"Agitato · arpeggios"],
  [60,66,"Calando · transition"], [67,74,"Second theme · opening"], [75,82,"Second theme · response"],
  [83,90,"Second theme · variation"], [91,93,"Second theme · closing flourish"],
  [94,101,"First theme · mysterious return"], [102,105,"Building to A major"],
  [106,113,"Second theme · A major"], [114,121,"A major · octave response"],
  [122,129,"A major · transition"], [130,137,"Preparing the waltz"],
  [138,145,"Waltz · opening"], [146,153,"Waltz · expansion"],
  [154,161,"Waltz · leggiero"], [162,165,"Descending transition"],
  [166,173,"Second theme · grand return"], [174,181,"Grand return · response"],
  [182,189,"Grand return · winding down"], [190,193,"Return · final flourish"],
  [194,201,"First theme · final return"], [202,207,"Appassionato · coda approach"],
  [208,215,"Coda · opening"], [216,223,"Coda · inner voice"], [224,231,"Coda · rising tension"],
  [232,241,"Coda · accented chords"], [242,249,"Coda · descending cadenza"],
  [250,257,"Coda · ascending cadenzas"], [258,264,"Final cadence"],
];
const bars = measures(song);
const plan: PracticePlan = {
  version: 1, id: "ballade-1-v1", title: "Ballade No. 1 · hands and connected passages",
  song: { title: song.title, fingerprint: await songFingerprint(song) },
  repetitions: 10, counting: "total", quests: [],
};
let table = "| Bars | Section | Source seconds | RH / LH attacks |\n| --- | --- | --- | --- |\n";
for (const [start, end, section] of sections) {
  for (let from = start; from <= end;) {
    const attacks = song.notes.filter(n => n.tick >= bars[from-1].tick && n.tick < bars[from-1].endTick).length;
    // Keep the held introduction/transition and the long unbarred runs intact.
    const joined: Record<number, number> = { 6:7, 64:66, 246:249, 250:251 };
    let through = Math.min(joined[from] ?? (attacks >= 36 || from >= 208 ? from : from+1), end);
    // Do not consume the start of a reviewed joined interval in the previous cut.
    for (const boundary of Object.keys(joined).map(Number)) {
      if (boundary > from && boundary <= through) through = boundary-1;
    }
    const speed = from >= 208 || attacks >= 36 ? .4 : .6;
    const base = { section, fromBar: from, throughBar: through, focus: "all" as const, mode: "wait" as const, speed };
    for (const hand of ["right", "left", "both"] as const) {
      const label = hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand";
      const quest = { ...base, id: `bars-${from}-${through}-${hand}`, title: `Bars ${from}–${through} · ${label}`, hand,
        instruction: `Play every ${hand === "both" ? "target" : hand + "-hand"} note in this passage. Start slowly and follow the score; wait mode lets you find each chord.` };
      if (questTargets(song, quest).length) plan.quests.push(quest);
    }
    if (from > start) plan.quests.push({ ...base, id: `review-${start}-${through}`, title: `Bars ${start}–${through} · ${through === end ? "Section" : "Build-up"} review`,
      fromBar: start, hand: "both", repetitions: 5, instruction: "Connect the passages with both hands, including their transitions. Complete the entire range at a comfortable speed." });
    const a=bars[from-1], b=bars[through-1];
    const notes=song.notes.filter(n => n.tick>=a.tick && n.tick<b.endTick);
    table += `| ${from}–${through} | ${section} | ${a.start.toFixed(3)}–${b.end.toFixed(3)} | ${notes.filter(n=>n.hand==="right").length} / ${notes.filter(n=>n.hand==="left").length} |\n`;
    from=through+1;
  }
}
const markdown = `# Ballade No. 1 practice route\n\nAll checkpoints are available immediately. Choose any passage or follow right hand → left hand → both hands. Ten completed total runs per passage; five for cumulative reviews. Review groups reset within ten bars. There are no prerequisites.\n\nBar numbers follow the 264-bar Mutopia/Klindworth edition used by the MIDI and synchronized score. Paul Barton's annotated PDF is provided separately for study; its final cadenza numbering differs. These one-/two-bar cuts are practice units, not claims of complete musical phrases. Dense bars are isolated; held transitions and long cadenzas stay together. Start at 60% source speed, or 40% for dense runs and the coda; change speed freely.\n\nA completed run requires every target attack and the end of the passage. Corrected mistakes count. Wait mode does not grade rhythm, duration, fingering, pedal or phrasing. Printed ornament realization and some editorial notes differ between the source editions; use the synchronized Mutopia score for MIDI targets. Hand ownership follows the engraving voices, with documented merged-unison exceptions.\n\n${table}\n\n\`\`\`cadance-plan\n${JSON.stringify(plan,null,2)}\n\`\`\`\n`;
await readPracticePlan(markdown,song);
writeFileSync("public/plans/ballade-1.md",markdown);
console.log(`${plan.quests.length} validated quests covering ${bars.length} bars`);
