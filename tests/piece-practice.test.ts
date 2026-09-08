import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import midiPackage from "@tonejs/midi";
import { pathetique } from "../src/core/catalogue";
import { PracticeEngine } from "../src/core/engine";
import { AudioScheduler, PianoAudio } from "../src/core/audio";
import { measures, createLoop, validLoops } from "../src/core/loops";
import { normalize } from "../src/core/midi";
import { defaults, scored } from "../src/core/model";
const { Midi } = midiPackage;
describe("real Pathétique practice", () => {
  it("waits for the complete opening chord in both-hands mode and rejects a wrong note in left-hand mode", () => {
    const e = new PracticeEngine(
      pathetique,
      { mode: "wait", hand: "both", focus: "all" },
      () => 0,
    );
    e.start();
    expect(e.group?.notes.map((n) => n.pitch).sort()).toEqual([44, 56, 60]);
    e.receive(normalize([144, 60, 100], 0, "p")!);
    expect(e.status).toBe("waiting");
    expect(e.hits.size).toBe(0);
    e.receive(normalize([144, 56, 100], 0, "p")!);
    expect(e.status).toBe("waiting");
    e.receive(normalize([144, 44, 100], 0, "p")!);
    expect(e.hits.size).toBe(3);
    const left = new PracticeEngine(
      pathetique,
      { mode: "wait", hand: "left", focus: "all" },
      () => 0,
    );
    left.start();
    left.receive(normalize([144, 60, 100], 0, "p")!);
    expect(left.status).toBe("waiting");
    expect(left.hits.size).toBe(0);
    left.receive(normalize([144, 44, 100], 0, "p")!);
    expect(left.hits.size).toBe(1);
  });
  it("retains all original note pitches, onsets, releases and velocities when separating voices", () => {
    const original = new Midi(readFileSync("public/pieces/pathetique-2.mid"));
    const expected = original.tracks
      .flatMap((t) =>
        t.notes.map((n) =>
          [n.midi, n.ticks, n.durationTicks, n.velocity].join(":"),
        ),
      )
      .sort();
    expect(
      pathetique.notes
        .map((n) => [n.pitch, n.tick, n.durationTicks, n.velocity].join(":"))
        .sort(),
    ).toEqual(expected);
    expect(pathetique.notes.length).toBe(1629);
    expect(pathetique.notes.filter((n) => n.role === "melody").length).toBe(
      331,
    );
    expect(pathetique.notes.filter((n) => n.hand === "left").length).toBe(587);
    const split = new Midi(
      readFileSync("public/pieces/pathetique-2-parts.mid"),
    );
    expect(
      split.tracks
        .flatMap((t) =>
          t.notes.map((n) =>
            [n.midi, n.ticks, n.durationTicks, n.velocity].join(":"),
          ),
        )
        .sort(),
    ).toEqual(expected);
  });
  it("scores a real melody independently from inner harmony and bass", () => {
    let now = 0;
    const e = new PracticeEngine(
      pathetique,
      { mode: "wait", focus: "melody", hand: "right" },
      () => now,
    );
    expect(e.targets.length).toBe(331);
    e.start();
    expect(e.group?.notes.map((n) => n.pitch)).toEqual([60]);
    e.receive(normalize([144, 56, 100], now, "p")!);
    expect(e.hits.size).toBe(0);
    e.receive(normalize([144, 60, 100], now, "p")!);
    expect(e.hits.size).toBe(1);
    expect(e.targets.every((n) => n.role === "melody")).toBe(true);
  });
  it("selects real right hand harmonies and low right hand notes without a pitch split", () => {
    const e = new PracticeEngine(pathetique, {
      focus: "harmony",
      hand: "right",
    });
    expect(e.targets.length).toBe(711);
    expect(e.targets[0].pitch).toBe(56);
    expect(e.targets.every((n) => n.hand === "right")).toBe(true);
    e.configure({ hand: "left", focus: "all" });
    expect(e.targets.length).toBe(587);
  });
  it("listens to a solo selected part or all parts with independent mute", () => {
    const e = new PracticeEngine(
      pathetique,
      { mode: "listen", hand: "right", focus: "melody" },
      () => 0,
    );
    const played: number[] = [];
    const audio = {
      context: {},
      time: 0,
      tone: (p: number) => {
        played.push(p);
        return null;
      },
      stopScheduled: () => {},
      stopAll: () => {},
      click: () => {},
    } as unknown as PianoAudio;
    const s = new AudioScheduler(e, audio);
    s.accompaniment = false;
    e.start();
    s.pump();
    expect(played).toEqual([60]);
    played.length = 0;
    s.accompaniment = true;
    e.epoch++;
    s.pump();
    expect(played.sort()).toEqual([44, 56, 60]);
    e.song = {
      ...pathetique,
      notes: pathetique.notes.map((n) => ({ ...n, muted: n.track === 2 })),
    };
    e.configure({ mode: "listen" });
    played.length = 0;
    e.start();
    s.pump();
    expect(played.sort()).toEqual([56, 60]);
  });
  it("recital advances and records misses while listen never saves practice", () => {
    let now = 0;
    const e = new PracticeEngine(
      pathetique,
      { mode: "recital", focus: "melody" },
      () => now,
    );
    e.start();
    now = 500;
    e.tick();
    expect(e.status).toBe("playing");
    expect(e.misses.size).toBe(1);
    e.stop();
    expect(e.lastResult?.config.mode).toBe("recital");
  });
});
describe("marked and named passage loops", () => {
  it("derives 73 bars from actual PPQ and 2/4 meter", () => {
    const bars = measures(pathetique);
    expect(bars.length).toBe(73);
    expect(bars[0].end).toBeCloseTo(10 / 3, 4);
    expect(bars[72].end).toBeCloseTo(243.333, 2);
  });
  it("validates named ranges and ignores invalid or other-song bookmarks", () => {
    const loop = createLoop(pathetique, "Opening", 0, 10);
    expect(
      validLoops(
        [loop, { ...loop, songId: "other" }, { ...loop, end: 999 }],
        pathetique,
      ),
    ).toEqual([loop]);
    expect(() => createLoop(pathetique, "Bad", 10, 2)).toThrow();
    expect(() => createLoop(pathetique, "", 0, 2)).toThrow();
  });
  it("wraps at B and restart retains the active A/B passage", () => {
    let now = 0;
    const e = new PracticeEngine(pathetique, { mode: "listen" }, () => now);
    e.selectPassage(3, 4, true);
    e.start();
    now = 1100;
    e.tick();
    expect(e.position).toBe(3);
    expect(e.loop).toEqual([3, 4]);
    expect(e.status).toBe("playing");
    now = 1500;
    e.tick();
    e.restart();
    expect(e.position).toBe(3);
    expect(e.loop).toEqual([3, 4]);
    expect(e.passage).toEqual([3, 4]);
  });
  it("resetting part selection removes old chord credit and never counts accompaniment", () => {
    const e = new PracticeEngine(
      pathetique,
      { focus: "melody", hand: "right" },
      () => 0,
    );
    e.start();
    e.receive(normalize([144, 60, 100], 0, "p")!);
    e.configure({ focus: "harmony" });
    expect(e.hits.size).toBe(0);
    expect(e.targets.every((n) => scored(n, e.config))).toBe(true);
    expect(e.config.focus).toBe("harmony");
  });
});

it("seeking within a loop retains B and the next repetition returns to original A", () => {
  let now = 0;
  const e = new PracticeEngine(pathetique, { mode: "listen" }, () => now);
  e.selectPassage(3, 5, true);
  e.seek(4);
  expect(e.loop).toEqual([3, 5]);
  expect(e.position).toBe(4);
  e.start();
  now = 1100;
  e.tick();
  expect(e.position).toBe(3);
  expect(e.passage).toEqual([3, 5]);
  e.seek(4, false);
  expect(e.loop).toBeNull();
});
