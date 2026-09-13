/** Normalize a source MIDI without claiming that inferred hands are verified. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import { songFingerprint } from "../src/core/quests";

const [input, output, id, title] = process.argv.slice(2);
if (!input || !output || !id || !title || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
  throw Error("Usage: tsx scripts/prepare-midi.ts SOURCE.mid NEW_SONG.json stable-slug 'Piece title'");
if (existsSync(output)) throw Error("Output exists; use a new path to preserve reviewed assignments.");
const bytes = readFileSync(input);
const original = Uint8Array.from(bytes).buffer;
const song = parseMidi(original, title);
song.id = id;
song.title = title;
const { original: _, ...data } = song;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ ...data, originalBytes: [...bytes] }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({
  output, notes: song.notes.length, bars: measures(song).length,
  fingerprint: await songFingerprint(song), roleSource: song.roleSource,
  warning: "Draft normalization only. Review tracks, hands, voices and target PDF correspondence before bundling.",
}, null, 2));
