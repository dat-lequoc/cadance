/** Generate the short human-facing Barton preparation note from source data. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import songData from "../src/core/ballade-1-barton.json";
import { measures } from "../src/core/loops";
import { songFingerprint } from "../src/core/quests";
import type { Song } from "../src/core/model";

const song = songData as unknown as Song;
const bytes = (path: string) => readFileSync(path);
const sha256 = (path: string) => createHash("sha256").update(bytes(path)).digest("hex");
const cuts = JSON.parse(readFileSync("scripts/scores/ballade-1-barton.cuts.json", "utf8"));
const plan = readFileSync("public/plans/ballade-1-barton.md", "utf8").match(/```cadance-plan\n([\s\S]*?)```/)?.[1];
if (!plan) throw Error("The generated Barton plan is missing its cadance-plan block.");
const planData = JSON.parse(plan);
const fingerprint = await songFingerprint(song);
if (planData.song.fingerprint !== fingerprint) throw Error("Barton plan fingerprint is stale.");
if (cuts.expectedBars !== measures(song).length || cuts.systems.length !== 89 || cuts.reviewed !== true)
  throw Error("Barton score cuts are incomplete or unreviewed.");

const pdf = "public/pieces/chopin-ballade-1-barton.pdf";
const midi = "public/pieces/chopin-ballade-1-barton.mid";
const markdown = `# ${song.title}

Generated preparation record. Edit this file only for brief human notes; regenerate it after changing the source data, plan, MIDI, PDF, or score cuts.

## Prepared assets

- MIDI: \`${midi}\` (${song.notes.length.toLocaleString()} notes, ${measures(song).length} MIDI measures)
- Primary score: \`${pdf}\` (22 pages, 89 reviewed systems)
- Reference score: \`${song.studyScore?.url ?? "not specified"}\`
- Practice plan: \`public/plans/ballade-1-barton.md\` (${planData.quests.length} quests, all unlocked)
- Fingerprint: \`${fingerprint}\`

## Alignment note

The player follows the MIDI's 264 measure timeline and the measured system geometry of Barton's scan. The handwritten score uses historical printed-bar labels; the final heading reads “bars 249–262 (end)”. The cadenza and final runs are therefore mapped by MIDI onset and system, not treated as 264 printed bars. Following is bar-level; handwritten redistributions are preserved visually but are not separately transcribed into MIDI hand targets.

## Reproduce

\`\`\`sh
pnpm exec tsx scripts/ballade-barton-prepare.ts
pnpm exec tsx scripts/ballade-barton-plan.ts
python scripts/ballade-barton-cuts.py
python scripts/prepare-score.py render public/pieces/chopin-ballade-1-barton.pdf scripts/scores/ballade-1-barton.cuts.json --output public/scores/ballade-1-barton
pnpm exec tsx scripts/align-score.ts src/core/ballade-1-barton.json public/scores/ballade-1-barton/geometry.json /pieces/chopin-ballade-1-barton.pdf
pnpm exec tsx scripts/ballade-barton-report.ts
\`\`\`

## Asset hashes

| Asset | SHA-256 |
| --- | --- |
| Barton PDF | \`${sha256(pdf)}\` |
| Barton MIDI | \`${sha256(midi)}\` |
| Score cuts PDF source | \`${cuts.pdfSha256}\` |
`;
writeFileSync("docs/ballade-1-barton.md", markdown);
console.log("Generated docs/ballade-1-barton.md");
