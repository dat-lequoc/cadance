import { MidiDebugLog } from "../src/core/midi-debug";
import { expect, it } from "vitest";
import { noteStartAt, PracticeEngine } from "../src/core/engine";
import { fromExercise } from "../src/core/lessons";
import { normalize } from "../src/core/midi";
import { AudioScheduler, PianoAudio } from "../src/core/audio";
import { readPracticePreferences } from "../src/core/preferences";
const song = fromExercise({
  version: 1,
  title: "Resume",
  explanation: "Fixture",
  tempo: 60,
  meter: [4, 4],
  range: [21, 108],
  mode: "rhythm",
  notes: [
    { pitch: 60, beat: 0, duration: 0.5, hand: "right" },
    { pitch: 62, beat: 2, duration: 0.5, hand: "right" },
    { pitch: 48, beat: 2, duration: 0.5, hand: "left" },
  ],
});
it("wait mode accepts a chord 150 ms early in real time and still requires every pitch", () => {
  let now = 0;
  const e = new PracticeEngine(song, { mode: "wait", hand: "both", speed: .5 }, () => now);
  e.start();
  e.receive(normalize([144, 60, 100], now, "p")!);
  e.receive(normalize([128, 60, 0], now, "p")!);
  now = 3850;
  e.receive(normalize([144, 62, 100], now, "p")!);
  expect(e.extras).toBe(0);
  expect(e.status).toBe("waiting");
  expect(e.partial.size).toBe(1);
  expect(e.hits.size).toBe(1);
  e.receive(normalize([144, 48, 100], now, "p")!);
  expect(e.hits.size).toBe(3);
  expect(e.status).toBe("playing");
});
it("wait tolerance rejects early wrong pitches and too-early targets without carrying a stale red key into the next prompt", () => {
  let now = 0;
  const e = new PracticeEngine(song, { mode: "wait", hand: "right" }, () => now);
  e.start();
  e.receive(normalize([144, 60, 100], now, "p")!);
  e.receive(normalize([128, 60, 0], now, "p")!);
  now = 1800;
  e.receive(normalize([144, 62, 100], now, "p")!);
  expect(e.extras).toBe(1);
  expect(e.feedback).toContain("early");
  expect(e.hits.size).toBe(1);
  e.receive(normalize([128, 62, 0], now, "p")!);
  now = 1900;
  e.receive(normalize([144, 61, 100], now, "p")!);
  expect(e.extras).toBe(2);
  expect(e.hits.size).toBe(1);
  now = 2000;
  e.tick();
  expect(e.lastWrong).toBeNull();
  expect(e.status).toBe("waiting");
  e.receive(normalize([144, 62, 100], now, "p")!);
  expect(e.hits.size).toBe(2);
});
it("resume freezes musical time and scoring, preserves hits, and freezes when paused again", () => {
  let now = 0;
  const e = new PracticeEngine(
    song,
    { mode: "rhythm", hand: "right" },
    () => now,
  );
  e.start();
  e.receive(normalize([144, 60, 100], now, "p")!);
  e.receive(normalize([128, 60, 0], now, "p")!);
  now = 1000;
  e.pause();
  e.preparationSeconds = 3;
  e.start();
  now = 2000;
  e.tick();
  expect(e.position).toBe(1);
  expect(e.hits.size).toBe(1);
  e.receive(normalize([144, 61, 100], now, "p")!);
  expect(e.extras).toBe(0);
  e.pause();
  const remaining = e.preparationRemaining;
  now = 12000;
  expect(e.preparationRemaining).toBe(remaining);
  e.start();
  now = 14000;
  e.tick();
  expect(e.position).toBe(1);
  expect(e.misses.size).toBe(0);
  now = 15000;
  e.tick();
  e.receive(normalize([144, 62, 100], now, "p")!);
  expect(e.hits.size).toBe(2);
  expect(e.timings).toEqual([0, 0]);
});
it("resume schedules no accompaniment until its countdown finishes", () => {
  let now = 0;
  const calls: number[] = [];
  const e = new PracticeEngine(
    song,
    { mode: "rhythm", hand: "right" },
    () => now,
  );
  const fake = {
    context: {},
    get time() {
      return now / 1000;
    },
    stopScheduled() {},
    stopAll() {},
    tone(p: number) {
      calls.push(p);
    },
    click() {},
  } as unknown as PianoAudio;
  const scheduler = new AudioScheduler(e, fake);
  scheduler.lookaheadSeconds = 2;
  e.start();
  now = 1000;
  e.pause();
  e.preparationSeconds = 3;
  e.start();
  scheduler.pump();
  now = 3000;
  scheduler.pump();
  expect(calls).toEqual([]);
  now = 4000;
  scheduler.pump();
  expect(calls).toEqual([48]);
});
it("restart cancels a resume countdown and listening never waits", () => {
  let now = 0;
  const e = new PracticeEngine(song, {}, () => now);
  e.start();
  now = 500;
  e.pause();
  e.preparationSeconds = 3;
  e.start();
  expect(e.resuming).toBe(true);
  e.restart();
  expect(e.resuming).toBe(false);
  e.start();
  expect(e.preparationRemaining).toBe(3);
  e.configure({ mode: "listen" });
  e.start();
  expect(e.preparationRemaining).toBe(0);
});
it("one-bar preparation follows speed and is used for automatic repeat starts", () => {
  const e = new PracticeEngine(song, { speed: 0.5 });
  e.countIn = true;
  expect(e.preparationDuration).toBe(8);
  e.start();
  expect(e.preparationRemaining).toBeCloseTo(8, 1);
});
it("preferences preserve legacy preparation while rejecting invalid values", () => {
  expect(readPracticePreferences(undefined, 5)).toMatchObject({
    soundSource: "piano",
    preparationSeconds: 5,
  });
  expect(
    readPracticePreferences({
      version: 1,
      soundSource: "computer",
      accompaniment: false,
      countIn: true,
      visualOffset: 999,
      audioOffset: -10,
      preparationSeconds: 8,
    }),
  ).toMatchObject({
    soundSource: "computer",
    accompaniment: false,
    countIn: true,
    visualOffset: 300,
    audioOffset: 0,
    preparationSeconds: 1,
  });
});
it("duplicate held note-on messages create only one live voice", () => {
  const a = new PianoAudio();
  let calls = 0;
  a.tone = () => {
    calls++;
    return {} as any;
  };
  a.release = () => {};
  const down = normalize([144, 60, 100], 0, "p")!,
    up = normalize([128, 60, 0], 0, "p")!;
  a.receive(down);
  a.receive(down);
  expect(calls).toBe(1);
  a.receive(up);
  a.receive(down);
  expect(calls).toBe(2);
});

it("MIDI diagnostics preserve raw input and before/after matching state across restore", () => {
  const e = new PracticeEngine(song, { mode: "wait", hand: "right" }, () => 0);
  const log = new MidiDebugLog();
  e.start();
  const wrong = normalize([144, 61, 100], 0, "p")!;
  log.capture(e, wrong, "checkpoint", () => e.receive(wrong));
  expect(log.entries[0].input.raw).toEqual([144, 61, 100]);
  expect(log.entries[0].before.expected[0].pitch).toBe(60);
  expect(log.entries[0].before.extras).toBe(0);
  expect(log.entries[0].after.extras).toBe(1);
  const restored = new MidiDebugLog();
  restored.restore(structuredClone(log.data()));
  expect(restored.entries).toEqual(log.entries);
  restored.enabled = false;
  const correct = normalize([144, 60, 100], 0, "p")!;
  restored.capture(e, correct, "checkpoint", () => e.receive(correct));
  expect(e.hits.size).toBe(1);
  expect(restored.entries).toHaveLength(1);
  restored.clear();
  expect(restored.entries).toHaveLength(0);
});

it("resuming a browsed position snaps back to the beginning of the target chord", () => {
  const e = new PracticeEngine(song, { hand: "both" });
  expect(noteStartAt(song, e.config, 1.75)).toBe(0);
  expect(noteStartAt(song, e.config, 2.3)).toBe(2);
  expect(noteStartAt(song, e.config, 2)).toBe(2);
  expect(noteStartAt(song, e.config, -1)).toBe(0);
});

it("wrong held notes persist through another correct key and clear on release, disconnect and restart", () => {
  const e = new PracticeEngine(song, { mode: "wait", hand: "right" }, () => 0);
  e.start();
  const send = (data: number[], port = "p") => e.receive(normalize(data, 0, port)!);
  send([144, 61, 100]);
  send([144, 62, 100], "second");
  expect(e.wrongHeld.size).toBe(2);
  send([144, 60, 100]);
  expect(e.wrongHeld.size).toBe(2);
  send([176, 64, 127]);
  send([144, 61, 0]);
  expect([...e.wrongHeld.values()].map((v) => v.event.pitch)).toEqual([62]);
  e.deviceLost("second");
  expect(e.wrongHeld.size).toBe(0);
  e.restart(); e.start();
  send([144, 63, 100]);
  expect(e.wrongHeld.size).toBe(1);
  e.restart();
  expect(e.wrongHeld.size).toBe(0);
});
