/** Generate the short, unlocked practice route for La fille aux cheveux de lin. */
import { writeFileSync } from "node:fs";
import data from "../src/core/debussy-la-fille-aux-cheveux-de-lin.json";
import type { Song } from "../src/core/model";
import { measures } from "../src/core/loops";
import {
  questTargets,
  readPracticePlan,
  songFingerprint,
  type PracticePlan,
} from "../src/core/quests";

const song = data as unknown as Song;
const sections: [number, number, string][] = [
  [1, 8, "Opening · Très calme"],
  [9, 18, "Cédez · returning line"],
  [19, 26, "Un peu animé · rising middle"],
  [27, 34, "Très doux · return"],
  [35, 39, "Murmuré · coda"],
];
const plan: PracticePlan = {
  version: 1,
  id: "debussy-la-fille-aux-cheveux-de-lin-v1",
  title: "La fille aux cheveux de lin · open practice route",
  song: { title: song.title, fingerprint: await songFingerprint(song) },
  repetitions: 10,
  counting: "total",
  quests: [],
};
const label = (hand: "right" | "left" | "both") =>
  hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand";

for (const [sectionFrom, sectionTo, section] of sections) {
  for (let from = sectionFrom; from <= sectionTo; from += 2) {
    const through = Math.min(from + 1, sectionTo);
    const base = {
      section,
      fromBar: from,
      throughBar: through,
      focus: "all" as const,
      mode: "wait" as const,
      speed: 0.6,
      instruction:
        "Play the written texture with a relaxed, singing tone. The upper/lower targets follow the source staves; adjust redistribution in Parts & accompaniment when useful.",
    };
    for (const hand of ["right", "left", "both"] as const) {
      const quest = {
        ...base,
        id: `bars-${from}-${through}-${hand}`,
        title: `Bars ${from}–${through} · ${label(hand)}`,
        hand,
      };
      if (questTargets(song, quest).length) plan.quests.push(quest);
    }
    if (from > sectionFrom && through - sectionFrom + 1 <= 10) {
      const review = {
        ...base,
        id: `review-${sectionFrom}-${through}`,
        title: `Bars ${sectionFrom}–${through} · Section review`,
        fromBar: sectionFrom,
        hand: "both" as const,
        repetitions: 5,
      };
      if (questTargets(song, review).length) plan.quests.push(review);
    }
  }
}

const markdown = `# ${song.title} practice route\n\nAll checkpoints are unlocked. Choose any two-bar passage, or connect a short section review when you want to bring the hands together. Ten total runs are used for passages and five for reviews; no review exceeds ten bars.\n\n\`\`\`cadance-plan\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`;
await readPracticePlan(markdown, song);
writeFileSync("public/plans/debussy-la-fille-aux-cheveux-de-lin.md", markdown);
console.log(`${plan.quests.length} validated quests covering ${measures(song).length} bars`);
