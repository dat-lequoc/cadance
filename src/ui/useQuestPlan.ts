import { useEffect, useMemo, useState } from "react";
import { QuestRunner } from "../core/quest-runner";
import {
  creditQuest,
  markQuestComplete,
  resetQuest,
  readPracticePlan,
  readQuestProgress,
} from "../core/quests";
import type { PracticeEngine } from "../core/engine";
import { db } from "../core/storage";
import bundledPlan from "../../public/plans/pathetique-ii.md?raw";
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
      ),
    [engine],
  );
  const song = engine.song;
  useEffect(() => {
    let alive = true;
    runner.load(null);
    setLoading(true);
    setLoadError("");
    void (async () => {
      const saved = await db.settings.get("quest-plan:" + song.id);
      const markdown =
        typeof saved?.value === "string"
          ? saved.value
          : song.id === "beethoven-pathetique-ii"
            ? bundledPlan
            : null;
      if (!markdown) return;
      let loaded = await readPracticePlan(markdown, song);
      const currentBundled =
        song.id === "beethoven-pathetique-ii"
          ? await readPracticePlan(bundledPlan, song)
          : null;
      if (currentBundled && (loaded.signature === previousReviewSignature || loaded.signature === previousBundledSignature || loaded.signature === previousHandsSignature || loaded.signature === previousContinuousSignature)) {
        loaded = currentBundled;
        if (saved)
          await db.settings.put({ key: saved.key, value: bundledPlan });
      }
      const progressKey = "quest-progress:" + loaded.signature;
      let row = await db.settings.get(progressKey);
      // Keep earned runs; reviews meeting the reduced goal become complete.
      if (!row && currentBundled && loaded.signature === currentBundled.signature) {
        const previous = await db.settings.get("quest-progress:" + previousReviewSignature) ?? await db.settings.get("quest-progress:" + previousContinuousSignature) ?? await db.settings.get("quest-progress:" + previousHandsSignature);
        if (previous) {
          row = { key: progressKey, value: readQuestProgress(previous.value, loaded.plan) };
          await db.settings.put(row);
        }
      }
      const progress = readQuestProgress(row?.value, loaded.plan);
      if (alive) runner.load(loaded, progress);
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
    await db.settings.put({
      key: "quest-plan:" + song.id,
      value: loaded.markdown,
    });
    if (engine.song.id === song.id) {
      engine.pause();
      runner.load(loaded, progress);
      setLoadError("");
    }
  };
  return {
    runner,
    loading,
    loadError,
    importPlan: async (file: File) => {
      try {
        await importPlan(file);
      } catch (error) {
        report(error);
      }
    },
  };
}
