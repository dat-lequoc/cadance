import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { initialPieces, recognizePreparedPiece, ballade } from "../src/core/catalogue";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import { TempoMap, type Song } from "../src/core/model";
import { readPracticePlan, questTargets, unlocked, emptyProgress } from "../src/core/quests";
import { preparedScoreFor } from "../src/core/scores";
import { scoreBarAt } from "../src/core/score";
import { preparedPlanFor, previousPreparedPlansFor, sameQuestRequirements } from "../src/core/plans";

const balladeBarton = initialPieces.find((s) => s.id === "chopin-ballade-1-barton")!;

it("preserves every original Ballade MIDI event while establishing distinct Barton edition identity", () => {
  expect(balladeBarton).toBeDefined();
  expect(balladeBarton.id).toBe("chopin-ballade-1-barton");
  expect(balladeBarton.title).toBe("Chopin · Ballade No. 1 (Paul Barton Edition)");
  expect(balladeBarton.scoreUrl).toBe("/pieces/chopin-ballade-1-barton.pdf");

  // Verify distinct original bytes and upload disambiguation
  const origMid = readFileSync("public/pieces/chopin-ballade-1.mid");
  const bartonMid = readFileSync("public/pieces/chopin-ballade-1-barton.mid");
  const origSha = createHash("sha256").update(origMid).digest("hex");
  const bartonSha = createHash("sha256").update(bartonMid).digest("hex");
  expect(origSha).not.toBe(bartonSha);
  // The dedicated MIDI changes metadata only, not performance events.
  expect(bartonMid.subarray(0, 26)).toEqual(origMid.subarray(0, 26));
  expect(bartonMid.subarray(26, 39).toString()).toBe("BartonEdition");
  expect(bartonMid.subarray(39)).toEqual(origMid.subarray(39));

  const mockUploadOrig: Song = {
    ...ballade,
    id: "uploaded-original",
    original: origMid.buffer.slice(origMid.byteOffset, origMid.byteOffset + origMid.byteLength),
  };
  const recognizedOrig = recognizePreparedPiece(mockUploadOrig);
  expect(recognizedOrig.scoreUrl).toBe("/pieces/chopin-ballade-1-mutopia.pdf");

  const mockUploadBarton: Song = {
    ...balladeBarton,
    id: "uploaded-barton",
    original: bartonMid.buffer.slice(bartonMid.byteOffset, bartonMid.byteOffset + bartonMid.byteLength),
  };
  const recognizedBarton = recognizePreparedPiece(mockUploadBarton);
  expect(recognizedBarton.scoreUrl).toBe("/pieces/chopin-ballade-1-barton.pdf");

  // Verify identical musical content (5013 notes, 2865 RH, 2148 LH)
  expect(balladeBarton.notes).toHaveLength(5013);
  expect(balladeBarton.notes.filter((n) => n.hand === "right")).toHaveLength(2865);
  expect(balladeBarton.notes.filter((n) => n.hand === "left")).toHaveLength(2148);

  for (let i = 0; i < ballade.notes.length; i++) {
    const o = ballade.notes[i];
    const b = balladeBarton.notes[i];
    expect(b.pitch).toBe(o.pitch);
    expect(b.tick).toBe(o.tick);
    expect(b.durationTicks).toBe(o.durationTicks);
    expect(b.hand).toBe(o.hand);
    expect(b.channel).toBe(o.channel);
    expect(Math.abs(b.velocity - o.velocity)).toBeLessThan(0.001);
  }

  expect(balladeBarton.tempos).toEqual(ballade.tempos);
  expect(balladeBarton.meters).toEqual(ballade.meters);
});

it("covers 264 bars with freely selectable hand quests and bounded cumulative reviews in Barton's 10 sections", async () => {
  const loaded = await readPracticePlan(
    readFileSync("public/plans/ballade-1-barton.md", "utf8"),
    balladeBarton
  );
  expect(loaded.plan.id).toBe("ballade-1-barton-v2");
  expect(loaded.plan.quests.length).toBeGreaterThan(500);
  const sections = [[1,35],[36,66],[67,93],[94,105],[106,137],[138,165],[166,193],[194,207],[208,249],[250,264]];
  expect(new Set(loaded.plan.quests.map((q) => q.section!.match(/^Section \d+/)![0])).size).toBe(10);

  const covered = new Set<number>();
  for (const [i, q] of loaded.plan.quests.entries()) {
    const section = sections.findIndex(([from, through]) => q.fromBar >= from && q.throughBar <= through);
    expect(section).toBeGreaterThanOrEqual(0);
    expect(q.section).toMatch(new RegExp(`^Section ${section + 1} ·`));
    expect(questTargets(balladeBarton, q).length).toBeGreaterThan(0);
    expect(unlocked(loaded.plan, emptyProgress(), i)).toBe(true);
    if (q.id.startsWith("review-")) {
      expect(q.repetitions).toBe(5);
      expect(q.throughBar - q.fromBar + 1).toBeLessThanOrEqual(10);
    } else {
      expect(q.repetitions ?? loaded.plan.repetitions).toBe(10);
      if (q.hand === "both") {
        for (let b = q.fromBar; b <= q.throughBar; b++) covered.add(b);
      }
    }
  }
  expect([...covered]).toEqual(measures(balladeBarton).map((b) => b.number));
});

it("retains both editions after renaming or uploading and rejects ambiguous edition identity", async () => {
  for (const song of [ballade, balladeBarton]) {
    const expected = (await preparedPlanFor(song))!;
    for (const renamed of [
      { ...song, title: "My practice" },
      { ...song, id: "upload", title: "My practice" },
      { ...song, id: "upload", title: "My practice", scoreUrl: undefined },
    ]) {
      expect((await preparedPlanFor(renamed))?.signature).toBe(expected.signature);
      expect((await preparedScoreFor(renamed))?.sourcePdf).toBe((await preparedScoreFor(song))?.sourcePdf);
    }
  }
  const unknown = { ...ballade, id: "unknown", title: balladeBarton.title, original: undefined, scoreUrl: undefined };
  expect(await preparedPlanFor(unknown)).toBeNull();
  expect(await preparedScoreFor(unknown)).toBeNull();
});

it("migrates only the exact label-only Barton revision, with unchanged quest requirements", async () => {
  const current = (await preparedPlanFor(balladeBarton))!;
  const revisions = await previousPreparedPlansFor(current, balladeBarton);
  expect(revisions.map((p) => p.signature)).toEqual(["5602b25e39ebcdcfe478eebb153d125584b3e7784c096b3c5400be71a8e4c6ff"]);
  const old = revisions[0].plan;
  expect(sameQuestRequirements(old, current.plan)).toBe(true);
  const changed = structuredClone(current.plan);
  changed.quests[0].throughBar++;
  expect(sameQuestRequirements(old, changed)).toBe(false);
  changed.quests[0] = current.plan.quests[0];
  changed.repetitions++;
  expect(sameQuestRequirements(old, changed)).toBe(false);
  expect(await previousPreparedPlansFor((await preparedPlanFor(ballade))!, ballade)).toEqual([]);
});

it("validates all 89 score images, source identity and exact bar boundaries for Barton's 22-page score", async () => {
  const score = await preparedScoreFor(balladeBarton);
  expect(score).not.toBeNull();
  expect(score!.bars).toHaveLength(264);
  expect(score!.systems).toHaveLength(89);
  expect(score!.sourcePdf).toBe("/pieces/chopin-ballade-1-barton.pdf");

  const pdfBytes = readFileSync("public/pieces/chopin-ballade-1-barton.pdf");
  const actualPdfSha = createHash("sha256").update(pdfBytes).digest("hex");
  expect(score!.pdfSha256).toBe(actualPdfSha);
  // Independently recounted page endings and source section-entry systems.
  const pageEnds = [15,33,43,55,65,82,93,104,116,125,137,149,159,171,184,193,205,213,228,245,257,264];
  expect(pageEnds.map((_, i) => score!.systems.findLast((s) => s.page === i + 1)!.throughBar)).toEqual(pageEnds);
  for (const [bar, page] of [[1,1],[36,3],[67,6],[94,8],[106,9],[138,12],[166,14],[194,17],[208,18],[250,21],[258,22]])
    expect(score!.systems[score!.bars[bar - 1].system].page).toBe(page);
  expect(score!.systems.filter((s) => s.page === 21).map((s) => [s.fromBar, s.throughBar])).toEqual([[246,247],[248,249],[250,254],[255,257]]);
  const cuts = JSON.parse(readFileSync("scripts/scores/ballade-1-barton.cuts.json", "utf8"));
  expect(cuts.systems[0].crop.slice(0, 2)).toEqual([0, 0]);
  expect(cuts.systems[0].barEdges).toEqual([45,224.5,394.8,555.2]);
  expect(cuts.systems[1].barEdges).toEqual([30.8,248.5,404.5,493,541.8]);
  for (let page = 1; page <= 22; page++) {
    const systems = cuts.systems.filter((s: { page: number }) => s.page === page);
    expect(systems[0].crop[1]).toBe(0);
    systems.forEach((s: { crop: number[] }, i: number) => {
      expect(s.crop[0]).toBe(0);
      expect(s.crop[2]).toBeGreaterThan(595);
      if (i) expect(s.crop[1]).toBe(systems[i - 1].crop[3]);
    });
  }

  for (const system of score!.systems) {
    const image = readFileSync(`public${system.image}`);
    expect(image.readUInt32BE(16)).toBe(system.width);
    expect(image.readUInt32BE(20)).toBe(system.height);
  }

  const map = new TempoMap(balladeBarton.ppq, balladeBarton.tempos);
  for (const bar of measures(balladeBarton)) {
    expect(scoreBarAt(score!, map, bar.start).number).toBe(bar.number);
    expect(scoreBarAt(score!, map, bar.end - 0.0001).number).toBe(bar.number);
  }
});

it("leaves existing Ballade piece and assets completely unchanged", async () => {
  expect(ballade.id).toBe("chopin-ballade-1");
  expect(ballade.scoreUrl).toBe("/pieces/chopin-ballade-1-mutopia.pdf");
  const score = await preparedScoreFor(ballade);
  expect(score!.systems).toHaveLength(60);
  expect(score!.sourcePdf).toBe("/pieces/chopin-ballade-1-player.pdf");
});
