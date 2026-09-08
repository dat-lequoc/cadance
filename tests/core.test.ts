import { describe, it, expect } from "vitest";
import { PracticeEngine } from "../src/core/engine";
import {
  SimulatedInput,
  HardwareInput,
  InputState,
  normalize,
  type Port,
  type Access,
} from "../src/core/midi";
import { fromExercise, lessons, validateExercise } from "../src/core/lessons";
import { TempoMap, defaults, rangeWarnings, prepare } from "../src/core/model";
import { parseMidi } from "../src/core/import";
import { performanceMidi, restore } from "../src/core/storage";
import { Midi } from "@tonejs/midi";
function setup(
  pitches: (number | number[])[] = [60, [60, 64, 67], 60, 60],
  mode: "wait" | "rhythm" = "wait",
) {
  let now = 0;
  const song = fromExercise({
    version: 1,
    title: "Test",
    explanation: "Test fixture",
    tempo: 60,
    meter: [4, 4],
    range: [0, 127],
    mode,
    notes: pitches.flatMap((p, i) =>
      (Array.isArray(p) ? p : [p]).map((pitch) => ({
        pitch,
        beat: i,
        duration: 0.5,
        hand: "right" as const,
      })),
    ),
  });
  const engine = new PracticeEngine(song, { mode }, () => now);
  const input = new SimulatedInput(() => now);
  engine.attach(input);
  return {
    engine,
    input,
    song,
    on: (p: number) => input.send([144, p, 100]),
    off: (p: number) => input.send([128, p, 0]),
    at: (v: number) => {
      now = v;
      engine.tick();
    },
  };
}
describe("MIDI adapter boundary", () => {
  it("normalizes note-on zero, channels, timestamps and raw pedal", () => {
    expect(normalize([0x9f, 127, 0], 42, "port")).toMatchObject({
      type: "off",
      pitch: 127,
      channel: 16,
      time: 42,
      port: "port",
    });
    expect(normalize([0xb0, 64, 63], 1, "p")).toMatchObject({
      type: "sustain",
      value: 63,
    });
    expect(normalize([0xc0, 1], 0, "p")).toBeNull();
  });
  it("keeps physical hold separate from pedal sound and other channels", () => {
    const s = new InputState();
    const apply = (d: number[]) => s.apply(normalize(d, 0, "p")!);
    apply([144, 60, 100]);
    apply([176, 64, 127]);
    apply([128, 60, 0]);
    expect(s.held.size).toBe(0);
    expect(s.sounding.size).toBe(1);
    apply([145, 60, 100]);
    apply([176, 64, 0]);
    expect(s.sounding.size).toBe(1);
    apply([129, 60, 0]);
    expect(s.sounding.size).toBe(0);
  });
  it("selects exactly one fake production port, detaches on switch/loss and reconnects the selected port", async () => {
    const a: Port = {
        id: "a",
        name: "Piano",
        state: "connected",
        onmidimessage: null,
      },
      b: Port = { ...a, id: "b" };
    const access: Access = {
      inputs: new Map([
        ["a", a],
        ["b", b],
      ]),
      onstatechange: null,
    };
    let lost = 0,
      received = 0,
      requests = 0;
    const h = new HardwareInput(
      () => {},
      () => lost++,
      async () => {
        requests++;
        return access;
      },
    );
    h.subscribe(() => received++);
    await h.connect();
    await h.connect();
    expect(requests).toBe(1);
    h.select("a");
    a.onmidimessage?.({ data: new Uint8Array([144, 60, 100]), timeStamp: 1 });
    expect(received).toBe(1);
    h.select("b");
    expect(a.onmidimessage).toBeNull();
    b.state = "disconnected";
    access.onstatechange?.();
    expect(h.connected).toBe(false);
    expect(lost).toBe(2);
    b.state = "connected";
    access.onstatechange?.();
    expect(h.connected).toBe(true);
    h.select("b");
    expect(h.connected).toBe(true);
    h.dispose();
    expect(b.onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();
  });
  it("reports permission rejection without pretending to connect", async () => {
    const h = new HardwareInput(
      () => {},
      () => {},
      async () => {
        throw Error("Permission denied");
      },
    );
    await expect(h.connect()).rejects.toThrow("Permission denied");
    expect(h.connected).toBe(false);
  });
});
describe("defining wait scenario through simulated adapter", () => {
  it("blocks a wrong key, collects CEG, and requires distinct repeated C attacks", () => {
    const t = setup();
    t.engine.start();
    expect(t.engine.status).toBe("waiting");
    t.on(61);
    expect(t.engine.hits.size).toBe(0);
    t.off(61);
    t.on(60);
    expect(t.engine.hits.size).toBe(1);
    t.off(60);
    t.at(1000);
    t.on(60);
    t.on(64);
    expect(t.engine.status).toBe("waiting");
    t.on(67);
    expect(t.engine.hits.size).toBe(4);
    t.at(2000);
    t.on(60);
    expect(t.engine.status).toBe("waiting");
    t.off(60);
    t.on(60);
    expect(t.engine.hits.size).toBe(5);
    t.at(3000);
    expect(t.engine.status).toBe("waiting");
    t.off(60);
    t.on(60);
    expect(t.engine.hits.size).toBe(6);
    t.at(4500);
    expect(t.engine.status).toBe("finished");
    expect(t.engine.lastResult?.extras).toBe(1);
    t.engine.stop();
    expect(t.engine.lastResult?.hits).toBe(6);
  });
  it("released partial chords and expired collection cannot accumulate", () => {
    const t = setup([[60, 64, 67]]);
    t.engine.start();
    t.on(60);
    t.off(60);
    t.on(64);
    t.on(67);
    expect(t.engine.status).toBe("waiting");
    t.at(1500);
    expect(t.engine.partial.size).toBe(0);
    expect(t.engine.retries).toBe(1);
    t.on(60);
    expect(t.engine.status).toBe("waiting");
  });
  it("deduplicates unison, preserves arpeggios and ignores playback credit", () => {
    const t = setup([[60, 60], 64]);
    t.engine.start();
    t.engine.receive({
      ...normalize([144, 60, 100], 0, "auto")!,
      source: "playback",
    });
    expect(t.engine.hits.size).toBe(0);
    t.on(60);
    expect(t.engine.hits.size).toBe(1);
    expect(t.engine.targets.length).toBe(2);
    expect(t.engine.groups.length).toBe(2);
  });
  it("30 second wait does not advance timeline and cannot create catch-up time", () => {
    const t = setup();
    t.engine.start();
    t.at(30000);
    expect(t.engine.position).toBe(0);
    t.on(60);
    t.at(30500);
    expect(t.engine.position).toBe(0.5);
    expect(t.engine.result().findingMs).toBe(30000);
  });
  it("sustain does not complete repeated targets", () => {
    const t = setup([60, 60]);
    t.engine.start();
    t.on(60);
    t.input.send([176, 64, 127]);
    t.at(1000);
    expect(t.engine.hits.size).toBe(1);
    t.off(60);
    expect(t.engine.input.sounding.size).toBe(1);
    expect(t.engine.status).toBe("waiting");
    t.on(60);
    expect(t.engine.hits.size).toBe(2);
  });
});
describe("rhythm, transport and scope", () => {
  it("matches closest onset once, applies signed real-time tolerance at half speed and closes misses by onset", () => {
    const t = setup([60, 60, 62], "rhythm");
    t.engine.setSpeed(0.5);
    t.engine.start();
    t.at(100);
    t.on(60);
    expect(t.engine.timings[0]).toBeCloseTo(100);
    t.off(60);
    t.at(200);
    t.on(60);
    expect(t.engine.extras).toBe(1);
    t.at(2200);
    expect(t.engine.misses.size).toBe(1);
    t.at(4151);
    expect(t.engine.misses.size).toBe(2);
  });
  it("accepts early attacks and rejects outside windows", () => {
    const t = setup([60, 62], "rhythm");
    t.engine.start();
    t.at(850);
    t.on(62);
    expect(t.engine.timings[0]).toBeCloseTo(-150);
    t.off(62);
    t.on(62);
    expect(t.engine.extras).toBe(1);
  });
  it("preserves position on speed change, pauses on disconnect, and invalidates audio on seek", () => {
    const t = setup([60, 62], "rhythm");
    t.engine.start();
    t.at(400);
    t.engine.setSpeed(0.5);
    expect(t.engine.position).toBe(0.4);
    t.at(600);
    expect(t.engine.position).toBe(0.5);
    t.engine.deviceLost();
    const misses = t.engine.misses.size;
    t.at(10000);
    expect(t.engine.position).toBe(0.5);
    expect(t.engine.misses.size).toBe(misses);
    expect(t.engine.status).toBe("paused");
    const epoch = t.engine.epoch;
    t.engine.seek(0.2);
    expect(t.engine.epoch).toBeGreaterThan(epoch);
    expect(t.engine.hits.size).toBe(0);
  });
  it("panic does not claim physical keys released", () => {
    const t = setup();
    t.on(60);
    t.engine.panic();
    expect(t.engine.input.held.size).toBe(1);
  });
  it("filters hands, excludes accompaniment and transposes without clamping", () => {
    const t = setup([60, 127]);
    t.song.notes[0].hand = "left";
    t.song.notes[1].hand = "accompaniment";
    const engine = new PracticeEngine(t.song, { hand: "right" });
    expect(engine.targets.length).toBe(0);
    expect(rangeWarnings(t.song, { ...defaults, transpose: 12 }).length).toBe(
      1,
    );
    expect(prepare(t.song, { ...defaults, transpose: 12 })[1].pitch).toBe(139);
  });
  it("blocks out-of-range learn sessions, but permits explicit range adjustment", () => {
    const t = setup([60]);
    t.engine.configure({ maxPitch: 59 });
    expect(() => t.engine.start()).toThrow("range");
    t.engine.configure({ maxPitch: 60 });
    expect(() => t.engine.start()).not.toThrow();
  });
  it("raises adaptive speed only after the configured successful rhythm loops", () => {
    const t = setup([60], "rhythm");
    t.engine.selectPassage(0, 1, true);
    t.engine.adaptive = true;
    t.engine.start();
    for (let i = 0; i < 3; i++) {
      t.on(60);
      t.off(60);
      t.at((i + 1) * 1000);
    }
    expect(t.engine.config.speed).toBe(1.05);
    t.at(5000);
    expect(t.engine.config.speed).toBe(1.05);
  });
  it("uses null metrics for empty results and never saves listening as progress", () => {
    const t = setup();
    expect(t.engine.result().precision).toBeNull();
    t.engine.configure({ mode: "listen" });
    t.engine.start();
    t.at(9000);
    expect(t.engine.lastResult).toBeNull();
    expect(t.engine.result().recall).toBeNull();
  });
});
describe("songs and actual performance", () => {
  it("converts changing tempos in both directions", () => {
    const map = new TempoMap(480, [
      { tick: 0, bpm: 120 },
      { tick: 960, bpm: 60 },
    ]);
    expect(map.seconds(1440)).toBe(2);
    expect(map.ticks(2)).toBe(1440);
    expect(map.seconds(480)).toBe(0.5);
  });
  it("parses a type-1 tempo fixture, rejects type 2, SMPTE, empty and malformed files", () => {
    const midi = new Midi();
    midi.header.tempos = [
      { ticks: 0, bpm: 120 },
      { ticks: 960, bpm: 60 },
    ];
    midi.header.update();
    midi
      .addTrack()
      .addNote({ midi: 60, ticks: 1440, durationTicks: 480, velocity: 0.8 });
    const buf = midi.toArray().buffer as ArrayBuffer;
    const s = parseMidi(buf, "test.mid");
    expect(s.notes[0].time).toBeCloseTo(2);
    expect(s.notes[0].duration).toBeCloseTo(1);
    const bad = buf.slice(0);
    new DataView(bad).setUint16(8, 2);
    expect(() => parseMidi(bad, "x")).toThrow("type 2");
    new DataView(bad).setUint16(8, 1);
    new DataView(bad).setUint16(12, 0x8001);
    expect(() => parseMidi(bad, "x")).toThrow("SMPTE");
    expect(() => parseMidi(new ArrayBuffer(0), "x")).toThrow();
    expect(() =>
      parseMidi(new Midi().toArray().buffer as ArrayBuffer, "x"),
    ).toThrow("no playable");
  });
  it("validates real lessons and rejects executable or invalid exercise payloads", () => {
    expect(lessons.length).toBeGreaterThanOrEqual(10);
    expect(lessons.every((l) => l.notes.length > 0)).toBe(true);
    expect(() =>
      validateExercise({ version: 1, title: "bad", notes: [] }),
    ).toThrow();
  });
  it("exports performed releases, raw sustain and channel rather than targets", () => {
    const t = setup();
    t.engine.start();
    t.on(61);
    t.at(100);
    t.input.send([176, 64, 100]);
    t.at(250);
    t.off(61);
    t.at(500);
    t.input.send([176, 64, 0]);
    const midi = new Midi(performanceMidi(t.engine.result()));
    expect(midi.tracks[0].notes[0].midi).toBe(61);
    expect(midi.tracks[0].notes[0].duration).toBeCloseTo(0.25, 2);
    expect(midi.tracks[0].controlChanges[64][0].value).toBeCloseTo(100 / 127);
  });
});

describe("backup validation before mutation", () => {
  it("rejects null and malformed recording payloads before opening IndexedDB", async () => {
    await expect(restore("null")).rejects.toThrow("Invalid version 1 backup");
    const t = setup();
    t.engine.start();
    t.on(60);
    const r = t.engine.result();
    const bad = {
      version: 1,
      songs: [],
      settings: [],
      sessions: [
        {
          ...r,
          events: [{ event: { pitch: 999 }, elapsedMs: 0, position: 0 }],
        },
      ],
    };
    await expect(restore(JSON.stringify(bad))).rejects.toThrow(
      "invalid recording",
    );
  });
  it("rejects invalid song tempo and persisted matching config", async () => {
    const t = setup();
    await expect(
      restore(
        JSON.stringify({
          version: 1,
          songs: [{ ...t.song, tempos: [{ tick: 0, bpm: 0 }] }],
          sessions: [],
          settings: [],
        }),
      ),
    ).rejects.toThrow("invalid song timing");
    await expect(
      restore(
        JSON.stringify({
          version: 1,
          songs: [],
          sessions: [],
          settings: [{ key: "config", value: { ...defaults, speed: 0 } }],
        }),
      ),
    ).rejects.toThrow("invalid configuration");
  });
});
