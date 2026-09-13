import { writeFileSync } from "node:fs";
import data from "../src/core/ballade-1-barton.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import { songFingerprint, questTargets, readPracticePlan, type PracticePlan } from "../src/core/quests";

const song = data as unknown as Song;
const sections: [number, number, string][] = [
  // Barton Section 1: Bars 1–35 (Introduction & Theme 1)
  [1, 7, "Section 1 · Introduction"],
  [8, 15, "Section 1 · First theme · opening"],
  [16, 23, "Section 1 · First theme · answer"],
  [24, 31, "Section 1 · First theme · expansion"],
  [32, 35, "Section 1 · First theme · cadence"],

  // Barton Section 2: Bars 36–66 (Agitato & Calando transition)
  [36, 43, "Section 2 · Agitato · opening"],
  [44, 51, "Section 2 · Agitato · continuation"],
  [52, 59, "Section 2 · Agitato · arpeggios"],
  [60, 66, "Section 2 · Calando · transition"],

  // Barton Section 3: Bars 67–93 (Second theme in E-flat major)
  [67, 74, "Section 3 · Second theme · opening"],
  [75, 82, "Section 3 · Second theme · response"],
  [83, 90, "Section 3 · Second theme · variation"],
  [91, 93, "Section 3 · Second theme · closing flourish"],

  // Barton Section 4: Bars 94–105 (Theme 1 return & transition)
  [94, 101, "Section 4 · First theme · mysterious return"],
  [102, 105, "Section 4 · Building to A major"],

  // Barton Section 5 includes the transition at 126–137.
  [106, 113, "Section 5 · Second theme · A major"],
  [114, 121, "Section 5 · A major · octave response"],
  [122, 125, "Section 5 · A major · transition"],

  [126, 131, "Section 5 · Transition towards waltz"],
  [132, 137, "Section 5 · Preparing the waltz"],

  // Barton Section 6: Bars 138–165 (Waltz / Scherzando)
  [138, 145, "Section 6 · Waltz · opening"],
  [146, 153, "Section 6 · Waltz · expansion"],
  [154, 161, "Section 6 · Waltz · leggiero"],
  [162, 165, "Section 6 · Descending transition"],

  // Barton Section 7: Bars 166–193 (Second theme grand return)
  [166, 173, "Section 7 · Second theme · grand return"],
  [174, 181, "Section 7 · Grand return · response"],
  [182, 189, "Section 7 · Grand return · winding down"],
  [190, 193, "Section 7 · Return · final flourish"],

  // Barton Section 8: Bars 194–207 (Theme 1 final return & coda approach)
  [194, 201, "Section 8 · First theme · final return"],
  [202, 207, "Section 8 · Appassionato · coda approach"],

  // Barton Section 9; app bar numbers are MIDI measures, not the scan's labels.
  [208, 215, "Section 9 · Coda · opening"],
  [216, 223, "Section 9 · Coda · inner voice"],
  [224, 231, "Section 9 · Coda · rising tension"],
  [232, 241, "Section 9 · Coda · accented chords"],
  [242, 249, "Section 9 · Coda · descending cadenza"],
  // Section 10 begins with the low G and ascending run on PDF page 21.
  [250, 257, "Section 10 · Coda · ascending cadenzas"],
  [258, 264, "Section 10 · Final cadence"],
];

const bars = measures(song);
const plan: PracticePlan = {
  version: 1,
  id: "ballade-1-barton-v2",
  title: "Ballade No. 1 (Paul Barton Edition) · hands and connected passages",
  song: { title: song.title, fingerprint: await songFingerprint(song) },
  repetitions: 10,
  counting: "total",
  quests: [],
};

for (const [start, end, section] of sections) {
  for (let from = start; from <= end;) {
    const attacks = song.notes.filter(
      (n) => n.tick >= bars[from - 1].tick && n.tick < bars[from - 1].endTick
    ).length;
    // Keep held introduction/transition and the long unbarred runs intact.
    const joined: Record<number, number> = { 6: 7, 64: 66, 246: 249, 250: 251 };
    let through = Math.min(
      joined[from] ?? (attacks >= 36 || from >= 208 ? from : from + 1),
      end
    );
    for (const boundary of Object.keys(joined).map(Number)) {
      if (boundary > from && boundary <= through) through = boundary - 1;
    }
    const speed = from >= 208 || attacks >= 36 ? 0.4 : 0.6;
    const base = {
      section,
      fromBar: from,
      throughBar: through,
      focus: "all" as const,
      mode: "wait" as const,
      speed,
    };
    for (const hand of ["right", "left", "both"] as const) {
      const label =
        hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand";
      const quest = {
        ...base,
        id: `bars-${from}-${through}-${hand}`,
        title: `Bars ${from}–${through} · ${label}`,
        hand,
        instruction: `Play every ${
          hand === "both" ? "target" : hand + "-hand"
        } note in this passage. Start slowly and follow Paul Barton's annotated score; wait mode lets you find each chord and fingering.`,
      };
      if (questTargets(song, quest).length) plan.quests.push(quest);
    }
    if (from > start) {
      plan.quests.push({
        ...base,
        id: `review-${start}-${through}`,
        title: `Bars ${start}–${through} · ${
          through === end ? "Section" : "Build-up"
        } review`,
        fromBar: start,
        hand: "both",
        repetitions: 5,
        instruction:
          "Connect the passages with both hands, including their transitions. Complete the entire range at a comfortable speed.",
      });
    }
    from = through + 1;
  }
}

const markdown = `# Ballade No. 1 (Paul Barton Edition) practice route

All checkpoints are available immediately. Choose any passage or follow right hand → left hand → both hands. Ten completed total runs per passage; five for cumulative reviews. Review groups reset within ten bars. There are no prerequisites.

Bar numbers are the performance MIDI's 264 measures, not a transcription of the handwritten numbering. The ten section labels follow Barton's headings. His sections 2/3 overlap at printed bar 67 and 3/4 at 94; the route assigns each checkpoint once. Section 10 begins at MIDI measure 250 (the low G and ascending run), under the handwritten heading “bars 249–262”. Dense bars are isolated; held transitions and long cadenzas stay together. Start at 60% source speed, or 40% for dense runs and the coda; change speed freely.

A completed run requires every target attack and the end of the passage. Corrected mistakes count. Wait mode does not grade rhythm, duration, fingering, pedal or phrasing. Hand assignments are inherited from the Mutopia voice-separated preparation, not a transcription of Barton's handwritten redistributions. Use both hands when following a different redistribution.

\`\`\`cadance-plan
${JSON.stringify(plan)}
\`\`\`
`;

await readPracticePlan(markdown, song);
writeFileSync("public/plans/ballade-1-barton.md", markdown);
console.log(`${plan.quests.length} validated quests covering ${bars.length} bars`);
