import { useEffect, useMemo, useRef, useState } from "react";
import { QuestRunner } from "../core/quest-runner";
import {
  creditQuest,
  markQuestComplete,
  resetQuest,
  readPracticePlan,
  readQuestProgress,
  type LoadedPlan,
  type PracticePlan,
} from "../core/quests";
import { carryUnchangedProgress, planMarkdown } from "../core/quest-editor";
import type { PracticeEngine } from "../core/engine";
import { db } from "../core/storage";
import { automaticPlanFor, defaultPlanFor, preparedPlanFor, previousPreparedPlansFor } from "../core/plans";
// Exact previous bundled plan; custom plans keep their own data and progress.
const previousBundledSignature =
  "ec249e24cf7e9a408965ae57672928fd64798fd7fade19d42da1f7fc19af01d6";
const previousHandsSignature = "980f9dfa06ebef071bfb68bd3bd5f86f09a865401f843c6c4e82c4e7b3160d5f";
const previousContinuousSignature = "fd13c81717c852181335bdfb9c41d160d995d791afc14cae2c9d0338f63621a8";
const previousReviewSignature = "16343507a96b6bae1f177ec8a2d0a668a8227817dbdfc0cc1fa525045764e66c";
export function useQuestPlan(
  engine: PracticeEngine,
  report: (error: unknown) => void,
) {
  const [, redraw] = useState(0),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const runner = useMemo(
    () =>
      new QuestRunner(
        engine,
        async (loaded, song, id, result) => {
          const key = "quest-progress:" + loaded.signature;
          return db.transaction("rw", db.sessions, db.settings, async () => {
            const progress = readQuestProgress(
              (await db.settings.get(key))?.value,
              loaded.plan,
            );
            const outcome = creditQuest(loaded, song, progress, id, result);
            await db.sessions.put(result);
            await db.settings.put({ key, value: outcome.progress });
            return outcome;
          });
        },
        () => redraw((n) => n + 1),
        async (loaded, id, reset) => db.transaction("rw", db.settings, async () => {
          const key = "quest-progress:" + loaded.signature;
          const progress = readQuestProgress((await db.settings.get(key))?.value, loaded.plan);
          const next = reset ? resetQuest(loaded.plan, progress, id) : markQuestComplete(loaded.plan, progress, id);
          await db.settings.put({ key, value: next });
          return next;
        }),
        async (loaded, id) => {
          await db.settings.put({ key: "quest-last:" + loaded.signature, value: id });
        },
      ),
    [engine],
  );
  const song = engine.song;
  const editLock = useRef(false);
  useEffect(() => {
    let alive = true;
    runner.load(null);
    setLoading(true);
    setLoadError("");
    void (async () => {
      const saved = await db.settings.get("quest-plan:" + song.id);
      const prepared = await preparedPlanFor(song);
      let loaded = typeof saved?.value === "string"
        ? await readPracticePlan(saved.value, song)
        : prepared ?? await automaticPlanFor(song);
      if (!loaded) return;
      const revisions = prepared ? await previousPreparedPlansFor(prepared, song) : [];
      // Only an exact archived bundled revision is replaced; custom plans win.
      if (prepared && revisions.some((revision) => revision.signature === loaded?.signature)) {
        loaded = prepared;
        if (saved) await db.settings.put({ key: saved.key, value: prepared.markdown });
      }
      // Legacy progress migration only; discovery above is independent of piece IDs.
      const currentBundled =
        song.id === "beethoven-pathetique-ii"
          ? prepared
          : null;
      if (currentBundled && (loaded.signature === previousReviewSignature || loaded.signature === previousBundledSignature || loaded.signature === previousHandsSignature || loaded.signature === previousContinuousSignature)) {
        loaded = currentBundled;
        if (saved)
          await db.settings.put({ key: saved.key, value: currentBundled.markdown });
      }
      const progressKey = "quest-progress:" + loaded.signature;
      let row = await db.settings.get(progressKey);
      if (!row && prepared && loaded.signature === prepared.signature) {
        for (const revision of revisions) {
          const previous = await db.settings.get("quest-progress:" + revision.signature);
          if (previous) {
            row = { key: progressKey, value: readQuestProgress(previous.value, loaded.plan) };
            await db.settings.put(row);
            break;
          }
        }
      }
      // Keep earned runs; reviews meeting the reduced goal become complete.
      if (!row && currentBundled && loaded.signature === currentBundled.signature) {
        const previous = await db.settings.get("quest-progress:" + previousReviewSignature) ?? await db.settings.get("quest-progress:" + previousContinuousSignature) ?? await db.settings.get("quest-progress:" + previousHandsSignature);
        if (previous) {
          row = { key: progressKey, value: readQuestProgress(previous.value, loaded.plan) };
          await db.settings.put(row);
        }
      }
      const progress = readQuestProgress(row?.value, loaded.plan);
      const last = await db.settings.get("quest-last:" + loaded.signature);
      const lastId = typeof last?.value === "string" ? last.value : null;
      if (alive) runner.load(loaded, progress, lastId);
    })()
      .catch((error) => {
        if (alive)
          setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      runner.leave();
    };
  }, [runner, song.id, song.notes]);
  const importPlan = async (file: File) => {
    if (file.size > 1024 * 1024)
      throw Error("Practice plans must be smaller than 1 MB.");
    if (runner.saving)
      throw Error(
        "Wait for your current run to finish saving before importing another plan.",
      );
    const loaded = await readPracticePlan(await file.text(), song);
    const progress = readQuestProgress(
      (await db.settings.get("quest-progress:" + loaded.signature))?.value,
      loaded.plan,
    );
    await db.settings.bulkPut([
      { key: "quest-plan:" + song.id, value: loaded.markdown },
      { key: "quest-plan-base:" + song.id, value: loaded.markdown },
    ]);
    if (engine.song.id === song.id) {
      engine.pause();
      const last = await db.settings.get("quest-last:" + loaded.signature);
      const lastId = typeof last?.value === "string" ? last.value : null;
      runner.load(loaded, progress, lastId);
      setLoadError("");
    }
  };
  const customize = async (resolve: () => Promise<LoadedPlan>) => {
    if (editLock.current || loading || runner.saving || runner.error || !runner.loaded)
      throw Error("Wait for the current plan or run to finish saving before editing quests.");
    editLock.current = true;
    const previous = runner.loaded;
    const previousId = runner.activeId ?? runner.lastId;
    const wasActive = !!runner.activeId;
    try {
      const loaded = await resolve();
      if (engine.song !== song || runner.loaded !== previous)
        throw Error("The piece changed. Reopen Customize quests for the current piece.");
      engine.pause();
      runner.suspend();
      const result = await db.transaction("rw", db.settings, async () => {
        const oldProgress = readQuestProgress((await db.settings.get("quest-progress:" + previous.signature))?.value, previous.plan);
        const savedProgress = readQuestProgress((await db.settings.get("quest-progress:" + loaded.signature))?.value, loaded.plan);
        const progress = carryUnchangedProgress(previous.plan, loaded.plan, oldProgress, savedProgress);
        const baseKey = "quest-plan-base:" + song.id;
        if (!(await db.settings.get(baseKey))) await db.settings.put({ key: baseKey, value: previous.markdown });
        const lastSaved = (await db.settings.get("quest-last:" + loaded.signature))?.value;
        const oldQuest = previous.plan.quests.find((q) => q.id === previousId);
        const lastId = loaded.plan.quests.find((q) => q.id === previousId)?.id ??
          loaded.plan.quests.find((q) => q.id === lastSaved)?.id ??
          (oldQuest && loaded.plan.quests.find((q) => q.fromBar <= oldQuest.fromBar && q.throughBar >= oldQuest.fromBar)?.id) ??
          loaded.plan.quests[0].id;
        await db.settings.bulkPut([
          { key: "quest-plan-history:" + song.id + ":" + previous.signature, value: previous.markdown },
          { key: "quest-plan:" + song.id, value: loaded.markdown },
          { key: "quest-progress:" + loaded.signature, value: progress },
          { key: "quest-last:" + loaded.signature, value: lastId },
        ]);
        return { progress, lastId };
      });
      if (engine.song === song && runner.loaded === previous) {
        runner.load(loaded, result.progress, result.lastId);
        if (wasActive) { runner.prepare(result.lastId); runner.suspend(); }
        setLoadError("");
      }
    } finally {
      editLock.current = false;
    }
  };
  return {
    runner,
    loading,
    loadError,
    savePlan: (plan: PracticePlan) => customize(() => readPracticePlan(planMarkdown(plan), song)),
    restorePlan: () => customize(async () => {
      const base = await db.settings.get("quest-plan-base:" + song.id);
      const loaded = typeof base?.value === "string" ? await readPracticePlan(base.value, song) : await defaultPlanFor(song);
      if (!loaded) throw Error("No original practice plan is available for this piece.");
      return loaded;
    }),
    importPlan: async (file: File) => {
      try {
        await importPlan(file);
      } catch (error) {
        report(error);
      }
    },
  };
}
