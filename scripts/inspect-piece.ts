import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import { readPracticePlan, songFingerprint } from "../src/core/quests";
import type { Song } from "../src/core/model";

const [path, planPath] = process.argv.slice(2);
if (!path)
  throw Error(
    "Usage: tsx scripts/inspect-piece.ts SONG.mid|NORMALIZED.json [PLAN.md]",
  );
const bytes = readFileSync(path);
const song = /\.midi?$/i.test(path)
  ? parseMidi(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      basename(path),
    )
  : (JSON.parse(bytes.toString()) as Song);
const bars = measures(song);
const report = {
  title: song.title,
  fingerprint: await songFingerprint(song),
  ppq: song.ppq,
  tempos: song.tempos,
  meters: song.meters,
  duration: song.duration,
  notes: song.notes.length,
  roleSource: song.roleSource ?? "unverified",
  tracks: [...new Set(song.notes.map((n) => n.track))].map((track) => ({
    track,
    name: song.trackNames?.[track],
    notes: song.notes.filter((n) => n.track === track).length,
  })),
  bars: bars.map((bar) => {
    const notes = song.notes.filter(
      (n) => n.tick >= bar.tick && n.tick < bar.endTick,
    );
    const crossing = song.notes.filter(
      (n) => n.tick < bar.tick && n.tick + n.durationTicks > bar.tick,
    );
    return {
      ...bar,
      notes: notes.length,
      melody: notes.filter((n) => n.role === "melody").length,
      rightHarmony: notes.filter(
        (n) => n.hand === "right" && n.role === "harmony",
      ).length,
      left: notes.filter((n) => n.hand === "left").length,
      heldAcrossStart: crossing.map((n) => ({
        pitch: n.pitch,
        hand: n.hand,
        role: n.role,
      })),
    };
  }),
};
if (planPath) {
  const loaded = await readPracticePlan(readFileSync(planPath, "utf8"), song);
  console.error(
    `Valid plan: ${loaded.plan.quests.length} quests; signature ${loaded.signature}`,
  );
}
console.log(JSON.stringify(report, null, 2));
