import { describe, expect, it } from "vitest";
import { bothHandsOnly, carryUnchangedProgress, mergeQuests, practiceHandsSeparately, splitQuest } from "../src/core/quest-editor";
import { emptyProgress } from "../src/core/quests";
import type { PracticePlan } from "../src/core/quests";

const plan = (quests: PracticePlan["quests"]): PracticePlan => ({
  version: 1, id: "test", title: "Test", song: { title: "Test", fingerprint: "0".repeat(64) },
  repetitions: 10, counting: "total", quests,
});
const quest = (id: string, fromBar: number, throughBar: number, hand: "left" | "right" | "both") => ({
  id, title: id, section: "Section", instruction: "Play it", fromBar, throughBar,
  hand, focus: "all" as const, mode: "wait" as const, speed: 0.5,
});

describe("personal quest editing", () => {
  it("adds hand practice before a merged passage without changing its earned runs", () => {
    const both = { ...quest("both", 17, 20, "both"), repetitions: 5, speed: 0.8 };
    const original = plan([quest("before", 1, 16, "both"), both, quest("after", 21, 22, "both")]);
    const result = practiceHandsSeparately(original, "both");
    expect(result.plan.quests.map((q) => q.hand)).toEqual(["both", "right", "left", "both", "both"]);
    expect(result.plan.quests[1]).toMatchObject({ id: result.rightId, fromBar: 17, throughBar: 20, repetitions: 5, speed: 0.8 });
    expect(result.plan.quests[3]).toBe(both);
    const progress = emptyProgress();
    progress.passes.both = { attempts: 5, successes: 5, streak: 5, completed: true };
    expect(carryUnchangedProgress(original, result.plan, progress).passes.both).toEqual(progress.passes.both);
    expect(practiceHandsSeparately(result.plan, "both").plan).toEqual(result.plan);
  });
  it("reuses existing single-hand checkpoints and their settings in right-left-both order", () => {
    const right = { ...quest("right", 21, 21, "right"), speed: 0.6 };
    const left = quest("left", 21, 21, "left");
    const both = { ...quest("both", 21, 21, "both"), speed: 0.8 };
    const original = plan([left, quest("other", 22, 22, "both"), both, right]);
    const result = practiceHandsSeparately(original, "both");
    expect(result.plan.quests.map((q) => q.id)).toEqual(["other", "right", "left", "both"]);
    expect(result.plan.quests[1]).toBe(right);
    expect(result.plan.quests[2]).toBe(left);
    const progress = emptyProgress();
    progress.passes.right = { attempts: 4, successes: 4, streak: 4, completed: false };
    expect(carryUnchangedProgress(original, result.plan, progress).passes.right).toEqual(progress.passes.right);
  });
  it("rejects a single-hand source and does not reuse quests from another section", () => {
    const original = plan([{ ...quest("r", 21, 21, "right"), section: "Elsewhere" }, quest("b", 21, 21, "both")]);
    expect(() => practiceHandsSeparately(original, "r")).toThrow("both-hands");
    expect(practiceHandsSeparately(original, "b").plan.quests).toHaveLength(4);
  });
  it("collapses hand stages while retaining a both-hands task", () => {
    const result = bothHandsOnly(plan([quest("r", 1, 2, "right"), quest("l", 1, 2, "left"), quest("b", 1, 2, "both")]));
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].id).toBe("b");
  });
  it("merges touching ranges and splits them back into independent tasks", () => {
    const original = plan([quest("a", 1, 4, "both"), quest("b", 5, 8, "both")]);
    const merged = mergeQuests(original, ["a", "b"]);
    expect(merged.quests).toHaveLength(1);
    expect([merged.quests[0].fromBar, merged.quests[0].throughBar]).toEqual([1, 8]);
    const split = splitQuest(merged, merged.quests[0].id, 4);
    expect(split.quests.map((q) => [q.fromBar, q.throughBar])).toEqual([[1, 4], [5, 8]]);
  });
  it("rejects merging a range with a gap", () => {
    expect(() => mergeQuests(plan([quest("a", 1, 2, "both"), quest("b", 4, 5, "both")]), ["a", "b"])).toThrow("gap");
  });
});
