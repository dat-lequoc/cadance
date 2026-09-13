import { readFileSync, writeFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import ballade1 from "../src/core/ballade-1.json";

// 1. Create distinct MIDI file for Barton edition
const origBytes = readFileSync("public/pieces/chopin-ballade-1.mid");
if (createHash("sha256").update(origBytes).digest("hex") !== "b8f93fa0fb1c3a61a4ba13fdc287282d8efe3d3ec76b575ac8f186016e55007f")
  throw Error("Source MIDI changed; review the edition before regenerating it.");
const bartonBytes = Buffer.from(origBytes);

// Replace track 0 name "control track" (13 bytes) with "BartonEdition" (13 bytes)
const searchStr = Buffer.from("control track");
const replaceStr = Buffer.from("BartonEdition");
const pos = bartonBytes.indexOf(searchStr);
if (pos !== 26 || searchStr.length !== replaceStr.length || bartonBytes[pos - 2] !== 3 || bartonBytes[pos - 1] !== 13)
  throw new Error("Unexpected MIDI track-name event");
replaceStr.copy(bartonBytes, pos);

// 2. Parse both to verify note-for-note identity
const parsedBarton = parseMidi(
  bartonBytes.buffer.slice(bartonBytes.byteOffset, bartonBytes.byteOffset + bartonBytes.byteLength),
  "Chopin · Ballade No. 1 (Paul Barton Edition)"
);
const parsedOriginal = parseMidi(origBytes.buffer.slice(origBytes.byteOffset, origBytes.byteOffset + origBytes.byteLength), "Original");
const musicalNotes = (song: typeof parsedBarton) => song.notes.map(({ id: _, ...note }) => note);
deepStrictEqual(musicalNotes(parsedBarton), musicalNotes(parsedOriginal));
for (const field of ["ppq", "tempos", "meters", "keys", "duration"] as const)
  deepStrictEqual(parsedBarton[field], parsedOriginal[field]);
deepStrictEqual(bartonBytes.subarray(0, pos), origBytes.subarray(0, pos));
deepStrictEqual(bartonBytes.subarray(pos + 13), origBytes.subarray(pos + 13));

if (parsedBarton.notes.length !== ballade1.notes.length) {
  throw new Error(`Note count mismatch: ${parsedBarton.notes.length} vs ${ballade1.notes.length}`);
}

// 3. Inherit Mutopia voice assignments; Barton's handwritten redistributions
// have not been transcribed into the note targets.
const notes = ballade1.notes.map((n, i) => ({
  ...n,
  id: `chopin-ballade-1-barton:${i}`,
}));

const song = {
  version: 1,
  id: "chopin-ballade-1-barton",
  title: "Chopin · Ballade No. 1 (Paul Barton Edition)",
  explanation:
    "Paul Barton's 22-page annotated study score with bar-level following. MIDI timing and hand targets are inherited from the Mutopia preparation, not a transcription of Barton's handwritten redistributions.",
  ppq: ballade1.ppq,
  tempos: ballade1.tempos,
  meters: ballade1.meters,
  keys: ballade1.keys,
  notes,
  trackNames: ["Upper written staff", "Lower written staff"],
  roleSource: ballade1.roleSource,
  duration: ballade1.duration,
  scoreUrl: "/pieces/chopin-ballade-1-barton.pdf",
  studyScore: {
    url: "/pieces/chopin-ballade-1-mutopia.pdf",
    title: "Mutopia engraving reference",
  },
  composer: "Frédéric Chopin",
  sourceUrl: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959",
  attribution:
    "Annotated score by Paul Barton; performance MIDI by Javier Ruiz-Alma / Mutopia (CC BY-SA 4.0).",
  originalBytes: Array.from(bartonBytes),
};

writeFileSync("public/pieces/chopin-ballade-1-barton.mid", bartonBytes);
writeFileSync(
  "src/core/ballade-1-barton.json",
  JSON.stringify(song, null, 2) + "\n"
);
console.log("Wrote src/core/ballade-1-barton.json");
console.log({
  notes: song.notes.length,
  bars: measures(song as any).length,
  right: song.notes.filter((n) => n.hand === "right").length,
  left: song.notes.filter((n) => n.hand === "left").length,
  duration: song.duration,
});
