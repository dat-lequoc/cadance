import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { initialPieces } from "../src/core/catalogue";
import { measures } from "../src/core/loops";
import { preparedPlanFor } from "../src/core/plans";
import { preparedScoreFor } from "../src/core/scores";
import { emptyProgress, questTargets, readPracticePlan, unlocked } from "../src/core/quests";

const song = initialPieces.find((piece) => piece.id === "debussy-la-fille-aux-cheveux-de-lin")!;

it("loads La fille aux cheveux de lin as a dynamic prepared piece", async () => {
  expect(song).toBeDefined();
  expect(song.title).toContain("La fille aux cheveux de lin");
  expect(song.notes).toHaveLength(584);
  expect(song.trackNames).toEqual(["Upper written staff", "Lower written staff"]);
  expect(song.notes.filter((note) => note.hand === "right")).toHaveLength(359);
  expect(song.notes.filter((note) => note.hand === "left")).toHaveLength(225);
  expect(measures(song)).toHaveLength(39);
  expect(song.meters).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
  expect(song.keys).toEqual([{ tick: 0, key: "Gb", scale: "major" }]);
  expect(song.roleSource).toBe("score");
  expect(song.scoreUrl).toBe("/pieces/debussy-la-fille-aux-cheveux-de-lin.pdf");
  expect(song.studyScore?.url).toBe("/pieces/debussy-la-fille-aux-cheveux-de-lin-annotated-imslp.pdf");
  expect(createHash("sha256").update(readFileSync("public/pieces/debussy-la-fille-aux-cheveux-de-lin.pdf")).digest("hex")).toBe("c1c01999f75167c3c3780891a49c545f884399c8f7796909fb12322ec2bfc02c");
  expect(createHash("sha256").update(readFileSync("public/pieces/debussy-la-fille-aux-cheveux-de-lin.mid")).digest("hex")).toBe("33fc622dbdcb938905b54fccd2d78ae2efce482c5921e6f3cf4707360a199dd0");
});

it("provides an unlocked hand route and reviewed ten-system score", async () => {
  const plan = await preparedPlanFor(song);
  expect(plan?.plan.id).toBe("debussy-la-fille-aux-cheveux-de-lin-v1");
  expect(plan?.plan.quests).toHaveLength(72);
  expect(plan?.plan.quests.some((quest) => quest.hand === "right")).toBe(true);
  expect(plan?.plan.quests.some((quest) => quest.hand === "left")).toBe(true);
  expect(plan?.plan.quests.some((quest) => quest.hand === "both")).toBe(true);
  for (const [index, quest] of plan!.plan.quests.entries()) {
    expect(questTargets(song, quest).length).toBeGreaterThan(0);
    expect(unlocked(plan!.plan, emptyProgress(), index)).toBe(true);
    if (quest.id.startsWith("review-")) {
      expect(quest.repetitions).toBe(5);
      expect(quest.throughBar - quest.fromBar + 1).toBeLessThanOrEqual(10);
    } else expect(quest.repetitions).toBeUndefined();
  }
  const loaded = await readPracticePlan(readFileSync("public/plans/debussy-la-fille-aux-cheveux-de-lin.md", "utf8"), song);
  expect(loaded.plan).toEqual(plan!.plan);
  const score = await preparedScoreFor(song);
  expect(score?.systems).toHaveLength(10);
  expect(score?.bars).toHaveLength(39);
  expect(score?.sourcePdf).toBe("/pieces/debussy-la-fille-aux-cheveux-de-lin.pdf");
  expect(score?.pdfSha256).toBe("c1c01999f75167c3c3780891a49c545f884399c8f7796909fb12322ec2bfc02c");
  expect(score?.systems.at(-1)?.throughBar).toBe(39);
});
