import midiPackage from "@tonejs/midi";
import type { Midi as MidiType } from "@tonejs/midi";
const { Midi } = midiPackage;
import { TempoMap, suggestRoles, type Song } from "./model";
export function parseMidi(buffer: ArrayBuffer, title: string): Song {
  if (buffer.byteLength > 5 * 1024 * 1024)
    throw Error("MIDI files must be smaller than 5 MB.");
  const v = new DataView(buffer);
  if (
    buffer.byteLength < 14 ||
    v.getUint32(0) !== 0x4d546864 ||
    v.getUint32(4) !== 6
  )
    throw Error("Invalid MIDI header.");
  const format = v.getUint16(8),
    division = v.getUint16(12);
  if (format > 1)
    throw Error(
      "MIDI type 2 is not supported. Export a type 0 or type 1 file.",
    );
  if (division & 0x8000)
    throw Error("SMPTE timing is not supported. Export with PPQ timing.");
  if (!division) throw Error("Invalid MIDI timing division.");
  const m = new Midi(buffer);
  const tempos = m.header.tempos.map((t) => ({ tick: t.ticks, bpm: t.bpm }));
  const map = new TempoMap(m.header.ppq, tempos);
  const id = crypto.randomUUID();
  let notes = m.tracks
    .flatMap((t, track) =>
      t.notes.map((n, i) => ({
        id: `${id}:${track}:${i}`,
        pitch: n.midi,
        tick: n.ticks,
        durationTicks: n.durationTicks,
        time: map.seconds(n.ticks),
        duration: map.seconds(n.ticks + n.durationTicks) - map.seconds(n.ticks),
        velocity: n.velocity,
        track,
        channel: t.channel + 1,
        hand: (/\b(left|lh|bass)\b|^down:/i.test(t.name)
          ? "left"
          : /\b(right|rh|melody)\b|^up:/i.test(t.name)
            ? "right"
            : n.midi < 60
              ? "left"
              : "right") as "left" | "right",
      })),
    )
    .sort((a, b) => a.time - b.time);
  if (!notes.length) throw Error("This file contains no playable notes.");
  if (notes.length > 50000)
    throw Error("This file exceeds the 50,000-note limit.");
  for (const n of notes)
    if (
      !Number.isFinite(n.time) ||
      !Number.isFinite(n.duration) ||
      n.duration <= 0 ||
      n.time > 86400
    )
      throw Error("Invalid or excessively long MIDI note.");
  return {
    version: 1,
    id,
    title:
      (m.name && !/^(control|tempo) track$/i.test(m.name) ? m.name : "") ||
      title.replace(/\.midi?$/i, ""),
    explanation:
      "Imported MIDI. Named hand parts are recognized; other notes use a suggested C4 split. Review Parts & accompaniment before practicing.",
    ppq: m.header.ppq,
    tempos: tempos.length ? tempos : [{ tick: 0, bpm: 120 }],
    meters: m.header.timeSignatures.map((t) => ({
      tick: t.ticks,
      numerator: t.timeSignature[0],
      denominator: t.timeSignature[1],
    })),
    keys: m.header.keySignatures.map((k) => ({
      tick: k.ticks,
      key: k.key,
      scale: k.scale,
    })),
    notes: suggestRoles(notes).map((n) => {
      const name = m.tracks[n.track].name;
      return /\bmelody\b/i.test(name)
        ? { ...n, role: "melody" as const }
        : /\b(harmony|harmonies|bass|accompaniment)\b/i.test(name)
          ? { ...n, role: "harmony" as const }
          : n;
    }),
    trackNames: m.tracks.map(
      (t) => t.name || `Track ${m.tracks.indexOf(t) + 1}`,
    ),
    roleSource: "suggested",
    duration: notes.reduce((v, n) => Math.max(v, n.time + n.duration), 0) + 0.5,
    original: buffer,
  };
}
