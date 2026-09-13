import { expect, it } from "vitest";
import { initialPieces } from "../src/core/catalogue";
import { measures } from "../src/core/loops";
import { preparedPlanFor } from "../src/core/plans";
import { preparedScoreFor } from "../src/core/scores";
import { emptyProgress, questTargets, unlocked } from "../src/core/quests";
const song = initialPieces.find((piece) => piece.id === "debussy-arabesque-no-1")!;
it("prepares Arabesque No. 1 with its meter transition and reviewed score", async () => {
  expect(song).toBeDefined(); expect(song.notes).toHaveLength(1448); expect(measures(song)).toHaveLength(107);
  expect(song.meters).toEqual([{ tick: 0, numerator: 4, denominator: 4 }, { tick: 142848, numerator: 2, denominator: 4 }, { tick: 143616, numerator: 4, denominator: 4 }]);
  const plan = await preparedPlanFor(song); expect(plan?.plan.id).toBe("debussy-arabesque-no-1-v1"); expect(plan?.plan.quests.length).toBe(208);
  for (const [i, quest] of plan!.plan.quests.entries()) { expect(questTargets(song, quest).length).toBeGreaterThan(0); expect(unlocked(plan!.plan, emptyProgress(), i)).toBe(true); }
  const score = await preparedScoreFor(song); expect(score?.systems).toHaveLength(26); expect(score?.bars).toHaveLength(107); expect(score?.systems.at(-1)?.throughBar).toBe(107);
});
