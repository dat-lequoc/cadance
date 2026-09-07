import { mkdirSync, writeFileSync } from "node:fs";
import midiPackage from "@tonejs/midi";
import type { Midi as MidiType } from "@tonejs/midi";
const { Midi } = midiPackage;
import { exercises } from "../src/core/lessons";
mkdirSync("public/fixtures", { recursive: true });
const m = new Midi();
m.header.tempos = [
  { ticks: 0, bpm: 80 },
  { ticks: 3840, bpm: 100 },
];
m.header.update();
const t = m.addTrack();
for (const n of exercises[11].notes)
  t.addNote({
    midi: n.pitch,
    ticks: n.beat * 480,
    durationTicks: n.duration * 480,
    velocity: 0.75,
  });
writeFileSync("public/fixtures/checkpoint.mid", m.toArray());
writeFileSync(
  "public/fixtures/c-major.json",
  JSON.stringify(exercises[2], null, 2),
);
const stress = new Midi();
stress.header.setTempo(120);
const s = stress.addTrack();
for (let i = 0; i < 10000; i++)
  s.addNote({
    midi: 48 + (i % 36),
    time: i * 0.04,
    duration: 0.5,
    velocity: 0.7,
  });
writeFileSync("public/fixtures/stress-10000.mid", stress.toArray());
