import { describe, expect, it } from "vitest";
import { bothHandsOnly, mergeQuests, splitQuest } from "../src/core/quest-editor";
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
