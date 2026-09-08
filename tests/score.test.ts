import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathetique } from "../src/core/catalogue";
import { measures } from "../src/core/loops";
import { TempoMap } from "../src/core/model";
import { readPracticePreferences } from "../src/core/preferences";
import {
  scoreBarAt,
  scoreAnchorAt,
  playedScorePosition,
  scorePitch,
  validateScore,
  type PreparedScore,
} from "../src/core/score";
import data from "../public/scores/pathetique-ii/score.json";

const score = data as PreparedScore;
describe("prepared score", () => {
  it("covers all 73 measures with real cropped images from the unchanged PDF", async () => {
    expect(await validateScore(score, pathetique)).toBe(score);
    expect(score.bars).toHaveLength(73);
    expect(score.systems).toHaveLength(22);
    expect(
      createHash("sha256")
        .update(readFileSync(`public${score.sourcePdf}`))
        .digest("hex"),
    ).toBe(score.pdfSha256);
    for (const system of score.systems) {
      const image = readFileSync(`public${system.image}`);
      expect(image.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
      expect(image.readUInt32BE(16)).toBe(system.width);
      expect(image.readUInt32BE(20)).toBe(system.height);
    }
    const map = new TempoMap(pathetique.ppq, pathetique.tempos);
    for (const bar of measures(pathetique)) {
      expect(scoreBarAt(score, map, bar.start).number).toBe(bar.number);
      expect(scoreBarAt(score, map, bar.end - 0.0001).number).toBe(bar.number);
    }
    expect(scoreBarAt(score, map, -3).number).toBe(1);
    expect(scoreBarAt(score, map, pathetique.duration).number).toBe(73);
  });
  it("rejects a wrong edition, missing measures and out-of-image bounds", async () => {
    await expect(
      validateScore(score, { ...pathetique, ppq: 480 }),
    ).rejects.toThrow("different MIDI");
    await expect(
      validateScore({ ...score, bars: score.bars.slice(1) }, pathetique),
    ).rejects.toThrow("every MIDI measure");
    const changed = structuredClone(score);
    changed.bars[20].right = 1.1;
    await expect(validateScore(changed, pathetique)).rejects.toThrow("bar 21");
  });
  it("follows source ticks across tempo changes, backward seeks and repeats", () => {
    const map = new TempoMap(384, [
      { tick: 0, bpm: 60 },
      { tick: 768, bpm: 120 },
    ]);
    expect(scoreBarAt(score, map, 1.999).number).toBe(1);
    expect(scoreBarAt(score, map, 2).number).toBe(2);
    expect(scoreBarAt(score, map, 3).number).toBe(3);
    expect(scoreBarAt(score, map, 15).number).toBe(15);
    expect(scoreBarAt(score, map, 2).number).toBe(2);
  });
  it("migrates old preferences with score hidden and clamps invalid zoom", () => {
    expect(readPracticePreferences({ version: 1 }).sheetMusic).toBe(false);
    expect(readPracticePreferences({ version: 1 }).sheetWrongNotes).toBe(true);
    expect(readPracticePreferences({ version: 1, sheetWrongNotes: false }).sheetWrongNotes).toBe(false);
    expect(readPracticePreferences({ version: 1 }).sheetZoom).toBe(1);
    expect(
      readPracticePreferences({ version: 1, sheetMusic: true, sheetZoom: 9 }),
    ).toMatchObject({ sheetMusic: true, sheetZoom: 2 });
    expect(
      readPracticePreferences({ version: 1, sheetZoom: NaN }).sheetZoom,
    ).toBe(1);
  });
});

it("note anchors cover exact MIDI onset groups and cursor follows seeks without interpolating engraving", async () => {
  const map = new TempoMap(pathetique.ppq, pathetique.tempos);
  expect(score.bars.filter((b) => b.anchors)).toHaveLength(58);
  const first = score.bars[0];
  expect(first.anchors![0].notes.map((n) => n.pitch).sort()).toEqual([44, 56, 60]);
  expect(scoreAnchorAt(first, map, 0)?.tick).toBe(0);
  expect(scoreAnchorAt(first, map, .2)?.tick).toBe(0);
  expect(scoreAnchorAt(first, map, map.seconds(96))?.tick).toBe(96);
  expect(scoreAnchorAt(first, map, 0)?.tick).toBe(0);
  expect(scoreAnchorAt(score.bars[20], map, map.seconds(score.bars[20].tick))).toBeNull();
  const invalid = structuredClone(score);
  invalid.bars[0].anchors![0].notes[0].pitch = 1;
  await expect(validateScore(invalid, pathetique)).rejects.toThrow("Invalid note anchor");
  expect(readPracticePreferences({ version: 1, sheetOnly: true }).sheetOnly).toBe(true);
});

it("places an unprinted wrong pitch using the score clef and renders its accidental", async () => {
  const system = score.systems[0], anchor = score.bars[0].anchors![0];
  const c4 = anchor.notes.find((n) => n.pitch === 60)!;
  const wrong = playedScorePosition(system, anchor, 61, [44, 56, 60], true)!;
  expect(wrong.label).toBe("D♭4");
  // Glyph coordinates are rounded during extraction; compare within a tenth of a source pixel.
  expect(Math.abs(wrong.y - (c4.y - system.staves![0].step)) * system.height).toBeLessThan(.1);
  expect(wrong.accidental).toBe("♭");
  expect(scorePitch(60).label).toBe("C4");
  expect(playedScorePosition({ ...system, staves: undefined }, anchor, 61, [60])).toBeNull();
  const invalid = structuredClone(score);
  invalid.systems[0].staves![0].step = 0;
  await expect(validateScore(invalid, pathetique)).rejects.toThrow("staff geometry");
});
