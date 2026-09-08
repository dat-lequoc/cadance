import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { measures } from "../src/core/loops";
import { songFingerprint } from "../src/core/quests";
import { validateScore, type PreparedScore } from "../src/core/score";
import type { Song } from "../src/core/model";

const [songPath, geometryPath, sourcePdf] = process.argv.slice(2);
if (!songPath || !geometryPath || !sourcePdf)
  throw Error(
    "Usage: tsx scripts/align-score.ts NORMALIZED_SONG.json public/scores/SLUG/geometry.json /pieces/SOURCE.pdf",
  );
const song = JSON.parse(readFileSync(songPath, "utf8")) as Song;
const geometry = JSON.parse(readFileSync(geometryPath, "utf8")) as {
  pdfSha256: string;
  systems: {
    image: string;
    width: number;
    height: number;
    page: number;
    fromBar: number;
    throughBar: number;
    barEdges: number[];
  }[];
};
const directory = dirname(resolve(geometryPath));
if (dirname(directory) !== resolve("public/scores"))
  throw Error("Place geometry in public/scores/SLUG so assets work offline.");
const prefix = `/scores/${basename(directory)}/`;
const bars = measures(song);
let nextBar = 1;
for (const system of geometry.systems) {
  if (
    system.fromBar !== nextBar ||
    system.throughBar < nextBar ||
    system.barEdges.length !== system.throughBar - system.fromBar + 2
  )
    throw Error(
      "Score systems must cover all measures exactly once, in order.",
    );
  nextBar = system.throughBar + 1;
}
if (nextBar !== bars.length + 1)
  throw Error(
    "PDF and MIDI bar counts disagree; inspect pickups/repeats/editions before alignment.",
  );
const score: PreparedScore = {
  version: 1,
  fingerprint: await songFingerprint(song),
  sourcePdf,
  pdfSha256: geometry.pdfSha256,
  systems: geometry.systems.map(({ barEdges: _, ...system }) => ({
    ...system,
    image: prefix + system.image,
  })),
  bars: bars.map((bar) => {
    const system = geometry.systems.findIndex(
      (s) => bar.number >= s.fromBar && bar.number <= s.throughBar,
    );
    const crop = geometry.systems[system],
      index = bar.number - crop.fromBar;
    return {
      number: bar.number,
      tick: bar.tick,
      endTick: bar.endTick,
      system,
      left: crop.barEdges[index],
      right: crop.barEdges[index + 1],
    };
  }),
};
await validateScore(score, song);
writeFileSync(
  join(directory, "score.json"),
  JSON.stringify(score, null, 2) + "\n",
);
console.log(
  `Aligned ${score.bars.length} MIDI bars to ${score.systems.length} PDF systems.`,
);
