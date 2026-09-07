import Dexie, { type Table } from "dexie";
import midiPackage from "@tonejs/midi";
import type { Midi as MidiType } from "@tonejs/midi";
const { Midi } = midiPackage;
import type { Result } from "./engine";
import type { Song } from "./model";
export class PianoDatabase extends Dexie {
  songs!: Table<Song, string>;
  sessions!: Table<Result, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  constructor(name = "cadence-piano") {
    super(name);
    this.version(1).stores({
      songs: "id,title",
      sessions: "id,songId,date",
      settings: "key",
    });
  }
}
export const db = new PianoDatabase();
export async function backup() {
  const songs = await db.songs.toArray();
  return JSON.stringify({
    version: 1,
    songs: songs.map((s) => ({
      ...s,
      original: s.original ? Array.from(new Uint8Array(s.original)) : undefined,
    })),
    sessions: await db.sessions.toArray(),
    settings: await db.settings.toArray(),
  });
}
export async function restore(text: string) {
  if (text.length > 25 * 1024 * 1024) throw Error("Backup exceeds 25 MB.");
  const b = JSON.parse(text);
  if (
    !b ||
    b.version !== 1 ||
    !Array.isArray(b.songs) ||
    !Array.isArray(b.sessions) ||
    !Array.isArray(b.settings) ||
    b.songs.length > 1000 ||
    b.sessions.length > 10000
  )
    throw Error("Invalid version 1 backup.");
  for (const s of b.songs)
    if (
      !s ||
      s.version !== 1 ||
      typeof s.id !== "string" ||
      typeof s.title !== "string" ||
      !Array.isArray(s.notes) ||
      s.notes.length > 50000 ||
      !s.notes.every(
        (n: Record<string, unknown>) =>
          !!n &&
          typeof n.id === "string" &&
          Number.isInteger(n.pitch) &&
          Number(n.pitch) >= 0 &&
          Number(n.pitch) <= 127 &&
          Number.isFinite(n.time) &&
          Number(n.time) >= 0 &&
          Number.isFinite(n.duration) &&
          Number(n.duration) > 0,
      ) ||
      !Array.isArray(s.tempos) ||
      !Array.isArray(s.meters) ||
      !Number.isFinite(s.ppq) ||
      s.ppq <= 0 ||
      !Number.isFinite(s.duration) ||
      s.duration <= 0
    )
      throw Error("Backup contains an invalid song.");
  for (const r of b.sessions)
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.songId !== "string" ||
      typeof r.title !== "string" ||
      typeof r.date !== "string" ||
      !r.config ||
      !["wait", "rhythm", "recital", "free"].includes(r.config.mode) ||
      !Array.isArray(r.events) ||
      !Array.isArray(r.passage) ||
      !Number.isFinite(r.hits) ||
      !Number.isFinite(r.targets)
    )
      throw Error("Backup contains an invalid session.");
  for (const s of b.settings)
    if (!s || typeof s.key !== "string")
      throw Error("Backup contains invalid settings.");
  // Validate all nested data before opening a write transaction.
  const finite = (v: unknown, min: number, max = Infinity) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const configValid = (c: Record<string, unknown>) =>
    !!c &&
    ["wait", "rhythm", "recital", "listen", "free"].includes(String(c.mode)) &&
    ["both", "left", "right"].includes(String(c.hand)) &&
    (c.focus === undefined ||
      ["all", "melody", "harmony"].includes(String(c.focus))) &&
    finite(c.speed, 0.25, 1.5) &&
    finite(c.transpose, -24, 24) &&
    finite(c.minPitch, 0, 127) &&
    finite(c.maxPitch, 0, 127) &&
    finite(c.earlyMs, 10, 3000) &&
    finite(c.lateMs, 10, 3000) &&
    finite(c.chordMs, 10, 3000) &&
    finite(c.groupingMs, 0, 100) &&
    finite(c.inputOffsetMs, -300, 300);
  for (const s of b.songs) {
    if (
      !s.notes.length ||
      !s.tempos.length ||
      typeof s.explanation !== "string" ||
      !s.notes.every(
        (n: Record<string, unknown>, i: number) =>
          finite(n.tick, 0) &&
          finite(n.durationTicks, 0.001) &&
          finite(n.velocity, 0, 1) &&
          finite(n.track, 0, 65535) &&
          Number.isInteger(n.channel) &&
          finite(n.channel, 1, 16) &&
          ["left", "right", "accompaniment", "ignored"].includes(
            String(n.hand),
          ) &&
          (i === 0 || s.notes[i - 1].time <= Number(n.time)),
      ) ||
      !s.tempos.every(
        (t: Record<string, unknown>) =>
          t && finite(t.tick, 0) && finite(t.bpm, 0.01, 10000),
      ) ||
      !s.meters.every(
        (m: Record<string, unknown>) =>
          m &&
          finite(m.tick, 0) &&
          finite(m.numerator, 1, 255) &&
          finite(m.denominator, 1, 256),
      ) ||
      (s.original !== undefined &&
        (!Array.isArray(s.original) ||
          s.original.length > 5 * 1024 * 1024 ||
          !s.original.every(
            (v: unknown) => Number.isInteger(v) && finite(v, 0, 255),
          )))
    )
      throw Error("Backup contains invalid song timing or MIDI data.");
  }
  for (const r of b.sessions) {
    if (
      !configValid(r.config) ||
      r.passage.length !== 2 ||
      !r.passage.every((v: unknown) => finite(v, 0)) ||
      r.passage[1] <= r.passage[0] ||
      !finite(r.hits, 0) ||
      !finite(r.targets, 0) ||
      !finite(r.extras, 0) ||
      !finite(r.misses, 0) ||
      !finite(r.retries, 0) ||
      !finite(r.findingMs, 0) ||
      typeof r.completed !== "boolean" ||
      !["recall", "precision"].every(
        (k) => r[k] === null || finite(r[k], 0, 1),
      ) ||
      (r.timingMs !== null && !finite(r.timingMs, -3000, 3000)) ||
      !Array.isArray(r.checkpoints) ||
      !r.checkpoints.every(
        (p: Record<string, unknown>) =>
          p &&
          finite(p.elapsedMs, 0) &&
          finite(p.position, -1000) &&
          finite(p.speed, 0.25, 1.5) &&
          typeof p.action === "string",
      ) ||
      !r.events.every(
        (
          x: {
            event: Record<string, unknown>;
            elapsedMs: unknown;
            position: unknown;
          },
          i: number,
        ) => {
          const e = x?.event;
          return (
            !!e &&
            finite(x.elapsedMs, 0) &&
            finite(x.position, -1000) &&
            (i === 0 || r.events[i - 1].elapsedMs <= Number(x.elapsedMs)) &&
            ["on", "off", "sustain"].includes(String(e.type)) &&
            ["hardware", "simulated"].includes(String(e.source)) &&
            Number.isInteger(e.pitch) &&
            finite(e.pitch, 0, 127) &&
            Number.isInteger(e.channel) &&
            finite(e.channel, 1, 16) &&
            finite(e.velocity, 0, 1) &&
            finite(e.value, 0, 127) &&
            finite(e.time, 0) &&
            typeof e.port === "string"
          );
        },
      )
    )
      throw Error("Backup contains invalid recording or scoring data.");
  }
  for (const s of b.settings) {
    if (s.key === "config" && !configValid(s.value))
      throw Error("Backup contains invalid configuration.");
    if (
      s.key.startsWith("loop:") &&
      (!Array.isArray(s.value) ||
        s.value.length !== 2 ||
        !s.value.every((v: unknown) => finite(v, 0)) ||
        s.value[1] <= s.value[0])
    )
      throw Error("Backup contains invalid loop bookmarks.");
  }
  await db.transaction("rw", db.songs, db.sessions, db.settings, async () => {
    await db.songs.bulkPut(
      b.songs.map((s: Song & { original?: number[] }) => ({
        ...s,
        original: s.original ? new Uint8Array(s.original).buffer : undefined,
      })),
    );
    await db.sessions.bulkPut(b.sessions);
    await db.settings.bulkPut(b.settings);
  });
}
export function performanceMidi(result: Result): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);
  midi.name = result.title + " — actual performance";
  const tracks = new Map<string, ReturnType<MidiType["addTrack"]>>(),
    held = new Map<
      string,
      {
        time: number;
        velocity: number;
        pitch: number;
        track: ReturnType<MidiType["addTrack"]>;
      }[]
    >();
  const end = result.events.reduce(
    (end, r) => Math.max(end, r.elapsedMs / 1000),
    0,
  );
  for (const r of result.events) {
    const e = r.event,
      t = Math.max(0, r.elapsedMs / 1000),
      channelKey = e.port + ":" + e.channel;
    let track = tracks.get(channelKey);
    if (!track) {
      track = midi.addTrack();
      track.channel = e.channel - 1;
      track.name = channelKey;
      tracks.set(channelKey, track);
    }
    const k = channelKey + ":" + e.pitch;
    if (e.type === "on") {
      held.set(k, [
        ...(held.get(k) ?? []),
        { time: t, velocity: e.velocity, pitch: e.pitch, track },
      ]);
    } else if (e.type === "off") {
      const q = held.get(k),
        n = q?.shift();
      if (n)
        n.track.addNote({
          midi: n.pitch,
          time: n.time,
          duration: Math.max(0.001, t - n.time),
          velocity: n.velocity,
          noteOffVelocity: e.velocity,
        });
    } else track.addCC({ number: 64, time: t, value: e.value / 127 });
  }
  for (const q of held.values())
    for (const n of q)
      n.track.addNote({
        midi: n.pitch,
        time: n.time,
        duration: Math.max(0.001, end - n.time),
        velocity: n.velocity,
      });
  return midi.toArray();
}
