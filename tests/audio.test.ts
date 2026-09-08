import { it, expect } from "vitest";
import { AudioScheduler, PianoAudio } from "../src/core/audio";
import { PracticeEngine } from "../src/core/engine";
import { fromExercise } from "../src/core/lessons";
import { normalize } from "../src/core/midi";
import { NoteIndex } from "../src/core/render-index";
it("gates audio at unresolved onset, cancels on seek, and never bursts after a long wait", () => {
  let now = 0;
  const song = fromExercise({
    version: 1,
    title: "Audio gate",
    explanation: "Fixture",
    tempo: 60,
    meter: [4, 4],
    range: [0, 127],
    mode: "wait",
    notes: [
      { pitch: 60, beat: 0, duration: 0.5, hand: "right" },
      { pitch: 48, beat: 1, duration: 0.5, hand: "left" },
      { pitch: 62, beat: 2, duration: 0.5, hand: "right" },
    ],
  });
  const engine = new PracticeEngine(song, { hand: "right" }, () => now);
  const calls: { pitch: number; at: number }[] = [];
  let canceled = 0;
  const fake = {
    context: {},
    get time() {
      return now / 1000;
    },
    stopScheduled() {
      canceled++;
    },
    stopAll() {},
    tone(pitch: number, _v: number, at: number) {
      calls.push({ pitch, at });
      return null;
    },
    click() {},
  } as unknown as PianoAudio;
  const scheduler = new AudioScheduler(engine, fake);
  engine.start();
  scheduler.pump();
  now = 30000;
  scheduler.pump();
  expect(calls).toEqual([]);
  engine.receive(normalize([144, 60, 100], now, "p")!);
  now = 30950;
  scheduler.pump();
  expect(calls).toHaveLength(1);
  expect(calls[0].pitch).toBe(48);
  expect(calls[0].at).toBeCloseTo(31);
  scheduler.pump();
  expect(calls).toHaveLength(1);
  engine.seek(2);
  scheduler.pump();
  expect(canceled).toBeGreaterThan(1);
  expect(calls).toHaveLength(1);
});
it("culling retains a long overlapping note while dropping completed notes", () => {
  const song = fromExercise({
    version: 1,
    title: "Overlap",
    explanation: "Fixture",
    tempo: 60,
    meter: [4, 4],
    range: [0, 127],
    mode: "wait",
    notes: [
      { pitch: 48, beat: 0, duration: 100, hand: "left" },
      { pitch: 60, beat: 1, duration: 1, hand: "right" },
      { pitch: 62, beat: 50, duration: 1, hand: "right" },
    ],
  });
  expect(new NoteIndex(song.notes).visible(49, 51).map((n) => n.pitch)).toEqual(
    [48, 62],
  );
});
it("background lookahead supplies future notes without crossing a practice gate", () => {
  let now = 0;
  const song = fromExercise({
    version: 1,
    title: "Background",
    explanation: "Fixture",
    tempo: 60,
    meter: [4, 4],
    range: [0, 127],
    mode: "wait",
    notes: [
      { pitch: 48, beat: 0, duration: 0.2, hand: "left" },
      { pitch: 50, beat: 1, duration: 0.2, hand: "left" },
      { pitch: 60, beat: 1.5, duration: 0.2, hand: "right" },
      { pitch: 52, beat: 2, duration: 0.2, hand: "left" },
    ],
  });
  const calls: number[] = [];
  const fake = {
    context: {},
    get time() {
      return now / 1000;
    },
    stopScheduled() {},
    stopAll() {},
    tone(pitch: number) {
      calls.push(pitch);
      return null;
    },
    click() {},
  } as unknown as PianoAudio;
  const engine = new PracticeEngine(song, { mode: "listen" }, () => now),
    scheduler = new AudioScheduler(engine, fake);
  scheduler.lookaheadSeconds = 2;
  engine.start();
  scheduler.pump();
  expect(calls).toEqual([48, 50, 60, 52]);
  scheduler.pump();
  expect(calls).toHaveLength(4);
  calls.length = 0;
  engine.configure({ mode: "wait", hand: "right" });
  engine.start();
  scheduler.pump();
  expect(calls).toEqual([48, 50]);
  now = 2000;
  scheduler.pump();
  expect(engine.status).toBe("waiting");
  expect(calls).toEqual([48, 50]);
});
