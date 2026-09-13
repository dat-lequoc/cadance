import { describe, expect, it } from "vitest";
import { fromExercise } from "../src/core/lessons";
import { initialPieces, ballade, recognizePreparedPiece } from "../src/core/catalogue";
import { automaticPlanFor, defaultPlanFor, preparedPlanFor } from "../src/core/plans";
import { preparedScoreFor } from "../src/core/scores";
import { emptyProgress, questTargets, unlocked } from "../src/core/quests";

function fixture(count = 12) {
  return fromExercise({
    version: 1, title: "New upload", explanation: "Test", tempo: 120,
    meter: [4, 4], range: [21, 108], mode: "wait",
    notes: Array.from({ length: count }, (_, index) => ({
      pitch: index % 2 ? 60 : 48, beat: index * 4, duration: 1,
      hand: index % 2 ? "right" : "left",
    })),
  });
}

describe("data-driven pieces", () => {
  it("discovers every bundled song's plan and matching score without using its ID", async () => {
    for (const song of initialPieces) {
      const renamed = { ...song, id: "uploaded-id", title: "Renamed.mid" };
      expect(await preparedPlanFor(renamed)).not.toBeNull();
      expect(await preparedScoreFor(renamed)).not.toBeNull();
    }
  });
  it("recognizes exact uploaded source bytes, retains new identity and does not alias notes", () => {
    const imported = { ...fixture(), original: ballade.original!.slice(0) };
    const recognized = recognizePreparedPiece(imported);
    expect(recognized.id).toBe(imported.id);
    expect(recognized.notes).toEqual(ballade.notes);
    expect(recognized.notes).not.toBe(ballade.notes);
    new Uint8Array(imported.original)[0] ^= 1;
    expect(recognizePreparedPiece(imported)).toBe(imported);
  });
  it("generates unlocked sessions and reviews for unknown music with stable progress identity", async () => {
    const song = fixture();
    const loaded = (await defaultPlanFor(song))!;
    expect(await preparedScoreFor(song)).toBeNull();
    expect(new Set(loaded.plan.quests.map((q) => q.section)).size).toBe(2);
    expect(loaded.plan.quests.some((q) => q.id.startsWith("review"))).toBe(true);
    for (const [index, quest] of loaded.plan.quests.entries()) {
      expect(unlocked(loaded.plan, emptyProgress(), index)).toBe(true);
      expect(questTargets(song, quest).length).toBeGreaterThan(0);
    }
    for (const note of song.notes)
      expect(loaded.plan.quests.some((quest) => questTargets(song, quest).includes(note))).toBe(true);
    expect((await automaticPlanFor({ ...song, title: "Renamed", id: "another-id" }))!.signature).toBe(loaded.signature);
    const changed = { ...song, notes: song.notes.map((note) => ({ ...note, hand: "right" as const })) };
    expect((await automaticPlanFor(changed))!.signature).not.toBe(loaded.signature);
  });
  it("skips silent hands and supports pieces with no playable targets", async () => {
    const song = fixture(1);
    const loaded = (await automaticPlanFor(song))!;
    expect(loaded.plan.quests.filter((q) => q.id.startsWith("passage")).map((q) => q.hand)).toEqual(["left"]);
    expect(await automaticPlanFor({ ...song, notes: song.notes.map((n) => ({ ...n, hand: "ignored" })) })).toBeNull();
  });
  it("bounds long plans while retaining their final bar", async () => {
    const loaded = (await automaticPlanFor(fixture(1601)))!;
    expect(loaded.plan.quests.length).toBeLessThanOrEqual(1000);
    expect(Math.max(...loaded.plan.quests.map((q) => q.throughBar))).toBe(1601);
  });
});
