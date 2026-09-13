import { readFileSync, writeFileSync } from "node:fs";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";

const read = (path: string) => {
  const bytes = readFileSync(path);
  return parseMidi(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), path);
};
const song = read("public/pieces/chopin-ballade-1.mid");
const hands = read("/tmp/cadance-ballade-hands/hands.midi");
const buckets = new Map<string, typeof hands.notes>();
for (const note of hands.notes) {
  const key = `${note.tick}:${note.pitch}`;
  buckets.set(key, [...(buckets.get(key) ?? []), note]);
}
let corrected = 0;
for (const [i, note] of song.notes.entries()) {
  const match = buckets.get(`${note.tick}:${note.pitch}`)?.shift();
  if (!match) throw Error(`Unmatched original event ${note.tick}:${note.pitch}`);
  const track = hands.trackNames?.[match.track] ?? "";
  if (!/^(upper|lower):/.test(track)) throw Error(`Unknown source staff ${track}`);
  const hiddenUpperUnison = ["374784:34", "536064:31"].includes(`${note.tick}:${note.pitch}`);
  const hand = hiddenUpperUnison ? "left" : track.startsWith("upper:") ? "right" : "left";
  if (note.hand !== hand) corrected++;
  note.hand = hand;
  note.id = `chopin-ballade-1:${i}`;
}
const extra = [...buckets.values()].flat();
// The original renderer merges these four cross-staff unisons. The diagnostic
// isolates voices and emits both; preserve the original single attacks.
const mergedUnisons = ["148608:65", "207744:74", "374784:34", "536064:31"];
if (extra.length !== mergedUnisons.length || extra.some(n => !mergedUnisons.includes(`${n.tick}:${n.pitch}`)))
  throw Error("Unexpected extra diagnostic notes");
song.id = "chopin-ballade-1";
song.title = "Chopin · Ballade No. 1 (Op. 23)";
song.explanation = "Complete Mutopia/Klindworth edition. Hands follow source voice ownership through staff crossings; melody labels remain suggestions. Source MIDI ornaments and editorial notes can differ from Paul Barton's annotated study score.";
song.trackNames = ["Upper written staff", "Lower written staff"];
song.scoreUrl = "/pieces/chopin-ballade-1-mutopia.pdf";
song.studyScore = { url: "/pieces/chopin-ballade-1-barton.pdf", title: "Paul Barton’s annotated study score" };
song.composer = "Frédéric Chopin";
song.sourceUrl = "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959";
song.attribution = "Mutopia / Javier Ruiz-Alma, Klindworth edition, CC BY-SA 4.0. Original MIDI timing preserved.";
const { original, ...data } = song;
writeFileSync("src/core/ballade-1.json", JSON.stringify({ ...data, originalBytes: [...new Uint8Array(original!)] }, null, 2) + "\n");
console.log({ notes: song.notes.length, bars: measures(song).length, corrected, right: song.notes.filter(n => n.hand === "right").length, left: song.notes.filter(n => n.hand === "left").length });
