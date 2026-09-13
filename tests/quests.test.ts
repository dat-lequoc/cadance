import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pathetique } from "../src/core/catalogue";
import { fromExercise, type Exercise } from "../src/core/lessons";
import { PracticeEngine, type Result } from "../src/core/engine";
import { normalize } from "../src/core/midi";
import { QuestRunner } from "../src/core/quest-runner";
import {
  creditQuest,
  markQuestComplete,
  resetQuest,
  emptyProgress,
  evaluateQuest,
  questBounds,
  questConfig,
  questGoal,
  questTargets,
  readPracticePlan,
  readQuestProgress,
  songFingerprint,
  unlocked,
  type PracticePlan,
  type QuestProgress,
} from "../src/core/quests";
const exercise: Exercise = {
  version: 1,
  title: "Quest fixture",
  explanation: "Test",
  tempo: 240,
  meter: [1, 4],
  range: [21, 108],
  mode: "wait",
  notes: [
    { pitch: 60, beat: 0, duration: 0.2, hand: "right" },
    { pitch: 62, beat: 1, duration: 0.2, hand: "right" },
  ],
};
const song = fromExercise(exercise);
const markdown = (plan: PracticePlan) =>
  "# Practice\n\n```cadance-plan\n" + JSON.stringify(plan) + "\n```\n";
async function fixture(counting: "total" | "consecutive" = "total") {
  const plan: PracticePlan = {
    version: 1,
    id: "fixture",
    title: "Test route",
    song: { title: song.title, fingerprint: await songFingerprint(song) },
    repetitions: 10,
    counting,
    quests: [1, 2].map((bar) => ({
      id: `bar-${bar}`,
      title: `Bar ${bar}`,
      section: "Opening",
      instruction: "Play cleanly",
      fromBar: bar,
      throughBar: bar,
      hand: "right",
      focus: "all",
      mode: "wait",
      speed: 1,
    })),
  };
  return readPracticePlan(markdown(plan), song);
}
function result(
  quest: PracticePlan["quests"][number],
  patch: Partial<Result> = {},
) {
  const e = new PracticeEngine(song, questConfig(quest));
  e.selectPassage(...questBounds(song, quest));
  for (const n of e.targets) e.hits.add(n.id);
  e.events.push({
    event: normalize([144, e.targets[0].pitch, 100], 0, "test")!,
    elapsedMs: 0,
    position: e.passage[0],
  });
  return { ...e.result(true), ...patch };
}
describe("Markdown practice plans", () => {
  it("loads the real MIDI route, preserves the tied bars, covers the piece and has targets in every quest", async () => {
    const loaded = await readPracticePlan(
      readFileSync("public/plans/pathetique-ii.md", "utf8"),
      pathetique,
    );
    expect(loaded.plan.quests).toHaveLength(161);
    expect(loaded.plan.quests.filter((q) => q.hand === "both")).toHaveLength(
      75,
    );
    const reviews = loaded.plan.quests.filter((q) => q.id.startsWith("review-"));
    expect(reviews.slice(0, 3).map((q) => [q.fromBar, q.throughBar])).toEqual([[1, 4], [1, 6], [1, 8]]);
    expect(reviews[3].fromBar).toBe(9);
    for (const q of reviews) {
      expect(questGoal(loaded.plan, q)).toBe(5);
      expect(q.throughBar - q.fromBar + 1).toBeLessThanOrEqual(10);
      expect(questTargets(pathetique, q).length).toBeGreaterThan(0);
      const i = loaded.plan.quests.indexOf(q);
      expect(loaded.plan.quests[i - 1].throughBar).toBe(q.throughBar);
      expect(loaded.plan.quests[i - 1].hand).toBe("both");
    }
    expect(loaded.plan.quests.some((q) => q.fromBar === 28)).toBe(false);
    expect(
      loaded.plan.quests.some((q) => q.fromBar === 27 && q.throughBar === 28),
    ).toBe(true);
    expect(
      loaded.plan.quests
        .filter((q) => q.hand === "both" && !q.id.startsWith("review-"))
        .reduce((n, q) => n + questTargets(pathetique, q).length, 0),
    ).toBe(new PracticeEngine(pathetique).targets.length);
  });
  it("matches musical content rather than file names and rejects another MIDI or changed parts", async () => {
    const l = await fixture();
    await expect(
      readPracticePlan(l.markdown, { ...song, id: "new", title: "Renamed" }),
    ).resolves.toBeTruthy();
    await expect(
      readPracticePlan(l.markdown, {
        ...song,
        notes: song.notes.map((n) => ({ ...n, pitch: n.pitch + 1 })),
      }),
    ).rejects.toThrow("different MIDI");
    await expect(
      readPracticePlan(l.markdown, {
        ...song,
        notes: song.notes.map((n) => ({ ...n, hand: "left" })),
      }),
    ).rejects.toThrow("different MIDI");
  });
  it("rejects malformed blocks, duplicated IDs, empty targets and invalid intervals", async () => {
    const { plan } = await fixture();
    await expect(readPracticePlan("## no block", song)).rejects.toThrow();
    await expect(
      readPracticePlan(markdown(plan) + markdown(plan), song),
    ).rejects.toThrow();
    for (const patch of [
      { fromBar: 0 },
      { throughBar: 99 },
      { speed: 0 },
      { hand: "left" },
      { id: plan.quests[1].id },
    ]) {
      const invalid = structuredClone(plan);
      Object.assign(invalid.quests[0], patch);
      await expect(readPracticePlan(markdown(invalid), song)).rejects.toThrow();
    }
  });
  it("changing machine-readable rules creates a different progress identity", async () => {
    const l = await fixture();
    const changed = await readPracticePlan(
      markdown({ ...l.plan, repetitions: 5 }),
      song,
    );
    expect(changed.signature).not.toBe(l.signature);
    const prose = await readPracticePlan(
      "An extra explanation.\n" + l.markdown,
      song,
    );
    expect(prose.signature).toBe(l.signature);
  });
});

it("per-quest goals complete at five runs, preserve earned runs and reject invalid overrides", async () => {
  const loaded = await fixture();
  const q = loaded.plan.quests[0];
  q.repetitions = 5;
  expect(questGoal(loaded.plan, loaded.plan.quests[1])).toBe(10);
  let progress = emptyProgress();
  for (let i = 0; i < 5; i++) {
    progress = creditQuest(loaded, song, progress, q.id, result(q, { id: `five-${i}` })).progress;
    expect(progress.passes[q.id].completed).toBe(i === 4);
  }
  progress.passes[q.id].completed = false;
  const restored = readQuestProgress(progress, loaded.plan);
  expect(restored.passes[q.id]).toMatchObject({ successes: 5, completed: true });
  for (const repetitions of [0, 101, 2.5, null]) {
    await expect(readPracticePlan(markdown({ ...loaded.plan, quests: [{ ...q, repetitions } as typeof q] }), song)).rejects.toThrow("Invalid quest");
  }
});
it("starts and credits a later quest without completing earlier quests", async () => {
  const loaded = await fixture();
  const quest = loaded.plan.quests[1];
  const runner = new QuestRunner(new PracticeEngine(song), async () => { throw Error("unused"); }, () => {});
  runner.load(loaded);
  runner.prepare(quest.id);
  expect(runner.activeId).toBe(quest.id);
  const outcome = creditQuest(loaded, song, emptyProgress(), quest.id, result(quest));
  expect(outcome.success).toBe(true);
  expect(outcome.progress.passes[quest.id].successes).toBe(1);
  expect(outcome.progress.passes[loaded.plan.quests[0].id]).toBeUndefined();
  expect(markQuestComplete(loaded.plan, emptyProgress(), quest.id).passes[quest.id].completed).toBe(true);
  expect(() => runner.prepare("missing")).toThrow("Unknown quest");
  expect(unlocked(loaded.plan, emptyProgress(), -1)).toBe(false);
});

describe("earned quest progression", () => {
  it("completes after ten full completed runs, deduplicates results and retains successes across failures", async () => {
    const l = await fixture();
    let progress = emptyProgress();
    const q = l.plan.quests[0];
    expect(unlocked(l.plan, progress, 1)).toBe(true);
    const first = result(q);
    progress = creditQuest(l, song, progress, q.id, first).progress;
    progress = creditQuest(l, song, progress, q.id, first).progress;
    expect(progress.passes[q.id].successes).toBe(1);
    progress = creditQuest(
      l,
      song,
      progress,
      q.id,
      result(q, { extras: 1 }),
    ).progress;
    expect(progress.passes[q.id].successes).toBe(2);
    for (let i = 2; i < 9; i++)
      progress = creditQuest(l, song, progress, q.id, result(q)).progress;
    expect(progress.passes[q.id].completed).toBe(false);
    progress = creditQuest(l, song, progress, q.id, result(q)).progress;
    expect(unlocked(l.plan, progress, 1)).toBe(true);
    expect(progress.passes[q.id].successes).toBe(10);
    expect(progress.passes[q.id].completed).toBe(true);
  });
  it("resets consecutive success streaks while retaining attempt history", async () => {
    const l = await fixture("consecutive");
    let p = emptyProgress();
    const q = l.plan.quests[0];
    for (let i = 0; i < 3; i++)
      p = creditQuest(l, song, p, q.id, result(q)).progress;
    p = creditQuest(l, song, p, q.id, result(q, { hits: 0, misses: 1 })).progress;
    expect(p.passes[q.id]).toMatchObject({
      successes: 3,
      streak: 0,
      attempts: 4,
      completed: false,
    });
  });
  it("does not credit incomplete, listening, shifted, skipped, changed-setting runs", async () => {
    const l = await fixture(),
      q = l.plan.quests[0],
      base = result(q);
    for (const patch of [
      { completed: false },
      { config: { ...base.config, mode: "listen" as const } },
      { passage: [0.1, 0.25] as [number, number] },
      { hits: 0 },
      { config: { ...base.config, hand: "left" as const } },
      { config: { ...base.config, speed: 0 } },
    ])
      expect(evaluateQuest(song, q, { ...base, ...patch }).success).toBe(false);
    expect(evaluateQuest(song, q, { ...base, config: { ...base.config, speed: .5 }, checkpoints: [{ elapsedMs: 20, position: .1, speed: .5, action: "speed" }] }).success).toBe(true);
    expect(evaluateQuest(song, q, { ...base, extras: 2, retries: 1 }).success).toBe(true);
  });
  it("restores progress without trusting unsupported completion flags", async () => {
    const l = await fixture();
    expect(
      readQuestProgress(
        {
          version: 1,
          processed: [],
          passes: {
            "bar-1": { attempts: 1, successes: 1, streak: 1, completed: true },
          },
        },
        l.plan,
      ).passes["bar-1"].completed,
    ).toBe(false);
    expect(
      readQuestProgress(
        {
          version: 1,
          processed: [],
          passes: {
            "bar-1": {
              attempts: 0,
              successes: 10,
              streak: 10,
              completed: true,
            },
          },
        },
        l.plan,
      ),
    ).toEqual(emptyProgress());
  });
});
describe("quest runner with actual MIDI matching", () => {
  it("repeats after durable credit and automatically starts the next checkpoint", async () => {
    const loaded = await fixture();
    let now = 0,
      p = emptyProgress();
    const e = new PracticeEngine(song, {}, () => now);
    const runner = new QuestRunner(
      e,
      async (l, s, id, r) => {
        const out = creditQuest(l, s, p, id, r);
        p = out.progress;
        return out;
      },
      () => {},
    );
    e.onResult = (r) => {
      runner.handleResult(r);
    };
    runner.load(loaded, p);
    runner.prepare("bar-1");
    e.start();
    for (let i = 0; i < 10; i++) {
      expect(e.status).toBe("waiting");
      e.receive(normalize([144, 60, 100], now, "p")!);
      e.receive(normalize([128, 60, 0], now, "p")!);
      now += 300;
      e.tick();
      await Promise.resolve();
      expect(runner.progress.passes["bar-1"].successes).toBe(i + 1);
    }
    expect(e.status).toBe("waiting");
    expect(runner.activeId).toBe("bar-2");
    expect(runner.count).toBe(0);
    expect(runner.lastRun?.complete).toBe(true);
    expect(e.passage).toEqual(questBounds(song, loaded.plan.quests[1]));
  });
  it("does not auto-resume after leaving during storage, and retries failed credit once", async () => {
    const loaded = await fixture();
    let now = 0,
      p = emptyProgress(),
      fail = true;
    const e = new PracticeEngine(song, {}, () => now);
    const runner = new QuestRunner(
      e,
      async (l, s, id, r) => {
        if (fail) throw Error("Storage failed");
        const out = creditQuest(l, s, p, id, r);
        p = out.progress;
        return out;
      },
      () => {},
    );
    e.onResult = (r) => {
      runner.handleResult(r);
    };
    runner.load(loaded, p);
    runner.prepare("bar-1");
    e.start();
    e.receive(normalize([144, 60, 100], now, "p")!);
    e.receive(normalize([128, 60, 0], now, "p")!);
    now = 300;
    e.tick();
    await Promise.resolve();
    expect(runner.error).toBe("Storage failed");
    expect(runner.count).toBe(0);
    runner.leave();
    fail = false;
    await runner.retry();
    expect(p.passes["bar-1"].successes).toBe(1);
    expect(e.status).toBe("finished");
    expect(runner.active).toBeNull();
  });
});

it("preparation ignores positioning notes, pauses its clock and requires a fresh attack", () => {
  let now = 0;
  const e = new PracticeEngine(song, {}, () => now);
  e.preparationSeconds = 3;
  e.start();
  expect(e.preparationRemaining).toBe(3);
  e.receive(normalize([144, 61, 100], now, "p")!);
  expect(e.extras).toBe(0);
  expect(e.events).toHaveLength(0);
  now = 1000;
  e.pause();
  now = 11000;
  expect(e.preparationRemaining).toBe(2);
  e.start();
  now = 13000;
  e.tick();
  expect(e.status).toBe("waiting");
  expect(e.preparationRemaining).toBe(0);
  e.receive(normalize([128, 61, 0], now, "p")!);
  e.receive(normalize([144, 60, 100], now, "p")!);
  expect(e.hits.size).toBe(1);
  e.restart();
  e.start();
  expect(e.preparationRemaining).toBe(3);
  e.configure({ mode: "listen" });
  e.start();
  expect(e.preparationRemaining).toBe(0);
});
it("quest repetition restarts immediately without preparation", async () => {
  let now = 0,
    p = emptyProgress();
  const e = new PracticeEngine(song, {}, () => now);
  const runner = new QuestRunner(
    e,
    async (l, s, id, r) => {
      const outcome = creditQuest(l, s, p, id, r);
      p = outcome.progress;
      return outcome;
    },
    () => {},
  );
  e.onResult = (r) => {
    runner.handleResult(r);
  };
  runner.load(await fixture());
  runner.prepare("bar-1");
  e.preparationSeconds = 3;
  e.start();
  now = 3000;
  e.tick();
  e.receive(normalize([144, 60, 100], now, "p")!);
  e.receive(normalize([128, 60, 0], now, "p")!);
  now += 300;
  e.tick();
  await Promise.resolve();
  expect(runner.count).toBe(1);
  expect(e.preparationRemaining).toBe(0);
  expect(e.hits.size).toBe(0);
});

it("manual completion saves separately from real runs, restores and advances after retry", async () => {
  const loaded = await fixture();
  let progress = emptyProgress(), fail = true;
  const e = new PracticeEngine(song);
  const runner = new QuestRunner(e, async () => { throw Error("Must not invent results"); }, () => {}, async (l, id) => {
    if (fail) throw Error("Disk full");
    progress = markQuestComplete(l.plan, progress, id);
    return progress;
  });
  runner.load(loaded);
  runner.prepare("bar-1");
  e.start();
  await runner.markComplete();
  expect(runner.error).toBe("Disk full");
  expect(runner.activeId).toBe("bar-1");
  expect(progress.passes).toEqual({});
  fail = false;
  await runner.retry();
  expect(runner.activeId).toBe("bar-2");
  expect(progress.passes["bar-1"]).toMatchObject({ completed: true, manual: true, attempts: 0, successes: 0 });
  const restored = readQuestProgress(progress, loaded.plan);
  expect(unlocked(loaded.plan, restored, 1)).toBe(true);
  expect(restored.processed).toHaveLength(0);
});
it("inserted reviews retain access to previously earned passage checkpoints", async () => {
  const { plan } = await fixture();
  let progress = markQuestComplete(plan, emptyProgress(), "bar-1");
  progress = markQuestComplete(plan, progress, "bar-2");
  const expanded = { ...plan, quests: [plan.quests[0], { ...plan.quests[0], id: "review" }, plan.quests[1]] };
  const restored = readQuestProgress(progress, expanded);
  expect(restored.passes["bar-2"].completed).toBe(true);
  expect(restored.passes.review).toBeUndefined();
  expect(unlocked(expanded, restored, 2)).toBe(true);
});

it("reset retains previously unlocked access after reload and new run credit", async () => {
  const loaded = await fixture();
  let progress = markQuestComplete(loaded.plan, emptyProgress(), "bar-1");
  progress = resetQuest(loaded.plan, progress, "bar-1");
  expect(progress.passes["bar-1"]).toBeUndefined();
  progress = readQuestProgress(progress, loaded.plan);
  expect(unlocked(loaded.plan, progress, 1)).toBe(true);
  progress = creditQuest(loaded, song, progress, "bar-1", result(loaded.plan.quests[0])).progress;
  expect(unlocked(loaded.plan, readQuestProgress(progress, loaded.plan), 1)).toBe(true);
});
