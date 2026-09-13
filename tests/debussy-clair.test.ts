import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { initialPieces } from "../src/core/catalogue";
import { measures } from "../src/core/loops";
import { preparedPlanFor } from "../src/core/plans";
import { preparedScoreFor } from "../src/core/scores";
import { readPracticePlan, emptyProgress, questTargets, unlocked } from "../src/core/quests";

const song = initialPieces.find((piece) => piece.id === "debussy-clair-de-lune")!;

it("prepares Clair de lune from the Mutopia source pair", async () => {
  expect(song).toBeDefined();
  expect(song.title).toContain("Clair de lune");
  expect(song.notes).toHaveLength(1468);
  expect(measures(song)).toHaveLength(72);
  expect(song.trackNames).toEqual(["Lower written staff", "Upper written staff"]);
  expect(song.scoreUrl).toBe("/pieces/debussy-clair-de-lune.pdf");
  expect(createHash("sha256").update(readFileSync("public/pieces/debussy-clair-de-lune.pdf")).digest("hex")).toBe("6f8ab460228af0f86663c9eba64e508e1af408bb635dcd593a037241d19b6cc3");
  const plan = await preparedPlanFor(song);
  expect(plan?.plan.id).toBe("debussy-clair-de-lune-v1");
  expect(plan?.plan.quests.length).toBe(134);
  for (const [index, quest] of plan!.plan.quests.entries()) {
    expect(questTargets(song, quest).length).toBeGreaterThan(0);
    expect(unlocked(plan!.plan, emptyProgress(), index)).toBe(true);
  }
  const score = await preparedScoreFor(song);
  expect(score?.systems).toHaveLength(20);
  expect(score?.bars).toHaveLength(72);
  expect(score?.sourcePdf).toBe("/pieces/debussy-clair-de-lune.pdf");
  expect(score?.pdfSha256).toBe("6f8ab460228af0f86663c9eba64e508e1af408bb635dcd593a037241d19b6cc3");
  expect(score?.systems.at(-1)?.throughBar).toBe(72);
});
