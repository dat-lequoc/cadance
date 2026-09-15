/**
 * Rebuild the prepared La fille MIDI and its normalized Cadance manifest.
 *
 * The TuneOnMusic export has two written-staff tracks and four zero-length
 * placeholder notes.  The placeholders are not playable and are removed from
 * the derivative; all remaining events, timing, tempo and meter are retained.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import midiPackage from "@tonejs/midi";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import { songFingerprint } from "../src/core/quests";

const { Midi } = midiPackage;
const id = "debussy-la-fille-aux-cheveux-de-lin";
const sourcePath = "public/pieces/debussy-la-fille-aux-cheveux-de-lin-source.mid";
const outputPath = `public/pieces/${id}.mid`;
const manifestPath = `src/core/${id}.json`;
const source = readFileSync(sourcePath);
const midi = new Midi(source);

if (midi.tracks.length < 2) throw new Error("La fille source must contain upper and lower written-staff tracks.");
midi.name = "Claude Debussy · La fille aux cheveux de lin";
midi.tracks[0].name = "Upper written staff";
midi.tracks[1].name = "Lower written staff";
let removed = 0;
for (const track of midi.tracks) {
  for (let i = track.notes.length - 1; i >= 0; i -= 1) {
    if (track.notes[i].durationTicks <= 0) {
      track.notes.splice(i, 1);
      removed += 1;
    }
  }
}
if (removed !== 4) throw new Error(`Expected 4 invalid placeholder notes, removed ${removed}.`);

const preparedBytes = midi.toArray();
writeFileSync(outputPath, preparedBytes);
const buffer = preparedBytes.buffer.slice(
  preparedBytes.byteOffset,
  preparedBytes.byteOffset + preparedBytes.byteLength,
) as ArrayBuffer;
const song = parseMidi(buffer, "La fille aux cheveux de lin");
song.id = id;
song.title = "Claude Debussy · La fille aux cheveux de lin (Préludes, Book I No. 8)";
song.composer = "Claude Debussy";
song.explanation =
  "A calm G-flat-major prelude in 3/4. The clean vector score sits beside the player; an annotated scan is available as a study reference. Upper/lower MIDI tracks follow the written staves, while hand redistribution remains editable in Parts & accompaniment.";
song.ppq = 480;
song.meters = [{ tick: 0, numerator: 3, denominator: 4 }];
song.keys = [{ tick: 0, key: "Gb", scale: "major" }];
song.trackNames = ["Upper written staff", "Lower written staff"];
song.roleSource = "score";
song.scoreUrl = `/pieces/${id}.pdf`;
song.studyScore = {
  url: `/pieces/${id}-annotated-imslp.pdf`,
  title: "Annotated study scan · IMSLP",
};
song.sourceUrl =
  "https://tuneonmusic.com/fr/music-sheets/classical/claude-debussy/la-fille-aux-cheveux/la-fille-aux-cheveux-advanced/";
song.attribution =
  "TuneOnMusic, The Girl with the Flaxen Hair (MuseScore 4.7.4 export); clean score and MIDI source used as a playable derivative.";
song.notes = song.notes.map((note, index) => ({
  ...note,
  id: `${id}:${index}`,
  hand: note.track === 0 ? ("right" as const) : ("left" as const),
}));

const barCount = measures(song).length;
if (song.notes.length !== 584 || barCount !== 39)
  throw new Error(`Unexpected normalized piece shape: ${song.notes.length} notes / ${barCount} bars.`);
const { original: _original, ...data } = song;
writeFileSync(manifestPath, `${JSON.stringify({ ...data, originalBytes: [...preparedBytes] }, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      id,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      preparedSha256: createHash("sha256").update(preparedBytes).digest("hex"),
      removed,
      notes: song.notes.length,
      bars: barCount,
      duration: song.duration,
      fingerprint: await songFingerprint(song),
    },
    null,
    2,
  ),
);
