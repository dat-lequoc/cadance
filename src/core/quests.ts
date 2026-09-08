import { defaults, scored, type Config, type Song } from "./model";
import { measures } from "./loops";
import type { Result } from "./engine";

export interface Quest {
  id: string;
  title: string;
  section: string;
  instruction: string;
  fromBar: number;
  throughBar: number;
  hand: Config["hand"];
  focus: NonNullable<Config["focus"]>;
  mode: "wait" | "rhythm";
  speed: number;
  repetitions?: number;
}
export interface PracticePlan {
  version: 1;
  id: string;
  title: string;
  song: { title: string; fingerprint: string };
  repetitions: number;
  counting: "total" | "consecutive";
  quests: Quest[];
}
export interface QuestProgress {
  version: 1;
  unlockedIds?: string[];
  passes: Record<
    string,
    { attempts: number; successes: number; streak: number; completed: boolean; manual?: boolean }
  >;
  processed: string[];
}
export interface LoadedPlan {
  plan: PracticePlan;
  signature: string;
  markdown: string;
}
export const emptyProgress = (): QuestProgress => ({
  version: 1,
  passes: {},
  processed: [],
});
const hash = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
/** Labels and file names can change; timing, pitches and musical-part assignments must match. */
export const songFingerprint = (song: Song) =>
  hash(
    JSON.stringify({
      ppq: song.ppq,
      tempos: song.tempos,
      meters: song.meters,
      notes: song.notes
        .map((n) => [n.tick, n.durationTicks, n.pitch, n.hand, n.role ?? "all"])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    }),
  );
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export async function readPracticePlan(
  markdown: string,
  song: Song,
): Promise<LoadedPlan> {
  if (markdown.length > 1024 * 1024)
    throw Error("Practice plans must be smaller than 1 MB.");
  const blocks = [
    ...markdown.matchAll(/^```cadance-plan\s*\r?\n([\s\S]*?)^```\s*$/gm),
  ];
  if (blocks.length !== 1)
    throw Error(
      "The Markdown file must contain exactly one cadance-plan code block.",
    );
  let plan: PracticePlan;
  try {
    plan = JSON.parse(blocks[0][1]);
  } catch {
    throw Error("The cadance-plan block contains invalid JSON.");
  }
  if (
    !plan ||
    plan.version !== 1 ||
    !text(plan.id, 80) ||
    !text(plan.title) ||
    !plan.song ||
    !text(plan.song.title) ||
    !/^[a-f0-9]{64}$/.test(plan.song.fingerprint) ||
    !Number.isInteger(plan.repetitions) ||
    plan.repetitions < 1 ||
    plan.repetitions > 100 ||
    !["total", "consecutive"].includes(plan.counting) ||
    !Array.isArray(plan.quests) ||
    !plan.quests.length ||
    plan.quests.length > 300
  )
    throw Error(
      "Invalid practice plan. Check its version, song, repetitions and quests.",
    );
  if ((await songFingerprint(song)) !== plan.song.fingerprint)
    throw Error(
      "This plan belongs to a different MIDI or part assignment. Open the matching piece before importing it.",
    );
  const bars = measures(song),
    ids = new Set<string>();
  for (const q of plan.quests) {
    if (
      !q ||
      !text(q.id, 80) ||
      ids.has(q.id) ||
      !text(q.title) ||
      !text(q.section) ||
      !text(q.instruction, 1000) ||
      !Number.isInteger(q.fromBar) ||
      !Number.isInteger(q.throughBar) ||
      q.fromBar < 1 ||
      q.throughBar < q.fromBar ||
      q.throughBar > bars.length ||
      !["both", "left", "right"].includes(q.hand) ||
      !["all", "melody", "harmony"].includes(q.focus) ||
      !["wait", "rhythm"].includes(q.mode) ||
      !Number.isFinite(q.speed) ||
      q.speed < 0.25 ||
      q.speed > 1.5 ||
      (q.repetitions !== undefined && (!Number.isInteger(q.repetitions) || q.repetitions < 1 || q.repetitions > 100))
    )
      throw Error(
        "Invalid quest: IDs must be unique and ranges, parts, modes and speeds must be valid.",
      );
    ids.add(q.id);
    if (!questTargets(song, q).length)
      throw Error(
        `“${q.title}” has no target notes. Change its range or musical part.`,
      );
  }
  return { plan, signature: await hash(JSON.stringify(plan)), markdown };
}
export function questBounds(song: Song, quest: Quest): [number, number] {
  const bars = measures(song);
  return [bars[quest.fromBar - 1].start, bars[quest.throughBar - 1].end];
}
export function questConfig(quest: Quest): Partial<Config> {
  return {
    mode: quest.mode,
    hand: quest.hand,
    focus: quest.focus,
    speed: quest.speed,
    transpose: 0,
    earlyMs: 150,
    lateMs: 150,
    groupingMs: 0,
    chordMs: 1000,
  };
}
export function questTargets(song: Song, quest: Quest) {
  const [start, end] = questBounds(song, quest),
    unique = new Set<string>();
  return song.notes.filter((n) => {
    if (
      n.time < start ||
      n.time >= end ||
      !scored(n, { ...defaults, ...questConfig(quest) })
    )
      return false;
    const key = `${n.pitch}:${n.time}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  });
}
export function unlocked(
  plan: PracticePlan,
  progress: QuestProgress,
  index: number,
) {
  return (
    index >= 0 &&
    index < plan.quests.length &&
    (index === 0 ||
      progress.unlockedIds?.includes(plan.quests[index].id) ||
      !!progress.passes[plan.quests[index].id] ||
      !!progress.passes[plan.quests[index - 1].id]?.completed)
  );
}
export const questGoal = (plan: PracticePlan, quest: Quest) => quest.repetitions ?? plan.repetitions;
export const questCount = (
  plan: PracticePlan,
  progress: QuestProgress,
  quest: Quest,
) => {
  const p = progress.passes[quest.id];
  return Math.min(
    questGoal(plan, quest),
    plan.counting === "consecutive" ? (p?.streak ?? 0) : (p?.successes ?? 0),
  );
};
export function readQuestProgress(
  value: unknown,
  plan: PracticePlan,
): QuestProgress {
  const v = value as QuestProgress;
  if (
    !v ||
    v.version !== 1 ||
    !v.passes ||
    typeof v.passes !== "object" ||
    !Array.isArray(v.processed) ||
    v.processed.length > 50000 ||
    !v.processed.every((id) => typeof id === "string")
  )
    return emptyProgress();
  const result = emptyProgress();
  result.processed = [...v.processed];
  if (Array.isArray(v.unlockedIds)) {
    const ids = new Set(plan.quests.map((q) => q.id));
    result.unlockedIds = [...new Set(v.unlockedIds.filter((id) => typeof id === "string" && ids.has(id)))];
  }
  for (const q of plan.quests) {
    const p = v.passes[q.id];
    if (!p) continue;
    if (
      ![p.attempts, p.successes, p.streak].every(
        (n) => Number.isInteger(n) && n >= 0,
      ) ||
      p.successes > p.attempts ||
      p.streak > p.successes
    )
      break;
    const completed = p.manual === true ||
      (plan.counting === "total" ? p.successes : p.streak) >= questGoal(plan, q);
    result.passes[q.id] = { ...p, completed };

  }
  return result;
}
/** Explicit user override; retain real attempt counts without fabricating runs. */
export function markQuestComplete(plan: PracticePlan, progress: QuestProgress, id: string): QuestProgress {
  const index = plan.quests.findIndex((q) => q.id === id);
  if (!unlocked(plan, progress, index)) throw Error("Complete the earlier checkpoint first.");
  const next = structuredClone(progress);
  next.passes[id] = { ...(next.passes[id] ?? { attempts: 0, successes: 0, streak: 0 }), completed: true, manual: true };
  return next;
}
/** Reset only this checkpoint; keep later results and attempt deduplication. */
export function resetQuest(plan: PracticePlan, progress: QuestProgress, id: string): QuestProgress {
  if (!plan.quests.some((q) => q.id === id)) throw Error("Unknown checkpoint.");
  const next = structuredClone(progress);
  next.unlockedIds = plan.quests.filter((_, index) => unlocked(plan, progress, index)).map((q) => q.id);
  delete next.passes[id];
  return next;
}
export function evaluateQuest(
  song: Song,
  quest: Quest,
  result: Result,
): { success: boolean; reason: string } {
  const [a, b] = questBounds(song, quest),
    expected = questTargets(song, quest).length;
  if (!result.completed)
    return {
      success: false,
      reason: "Finish the whole passage to earn a repetition.",
    };
  if (
    result.songId !== song.id ||
    Math.abs(result.passage[0] - a) > 0.00001 ||
    Math.abs(result.passage[1] - b) > 0.00001 ||
    Object.entries(questConfig(quest)).some(
      ([key, value]) => key !== "speed" && result.config[key as keyof Config] !== value,
    ) ||
    result.targets !== expected || !Number.isFinite(result.config.speed) ||
    result.config.speed < .25 || result.config.speed > 1.5
  )
    return {
      success: false,
      reason:
        "The passage or practice settings changed. Retry with the quest settings.",
    };
  if (
    result.targets < 1 ||
    result.hits !== result.targets ||
    result.misses !== 0 ||
    !result.events.some(
      (e) => e.event.type === "on" && e.event.source !== "playback",
    )
  )
    return {
      success: false,
      reason: `Try again: ${[
        result.extras ? `${result.extras} wrong or too-early note${result.extras === 1 ? "" : "s"}` : "",
        result.misses ? `${result.misses} missed note${result.misses === 1 ? "" : "s"}` : "",
        result.retries ? `${result.retries} chord retr${result.retries === 1 ? "y" : "ies"}` : "",
        result.hits !== result.targets ? `${result.hits}/${result.targets} notes hit` : "",
      ].filter(Boolean).join(" · ") || "no live input recorded"}.`,
    };
  return { success: true, reason: "Run complete!" };
}
export function creditQuest(
  loaded: LoadedPlan,
  song: Song,
  progress: QuestProgress,
  questId: string,
  result: Result,
) {
  const plan = loaded.plan,
    index = plan.quests.findIndex((q) => q.id === questId),
    quest = plan.quests[index];
  if (
    !quest ||
    !unlocked(plan, progress, index) ||
    progress.processed.includes(result.id) ||
    !result.completed
  )
    return {
      progress,
      success: false,
      reason: "This attempt is not eligible.",
    };
  const outcome = evaluateQuest(song, quest, result);
  const previous = progress.passes[quest.id] ?? {
    attempts: 0,
    successes: 0,
    streak: 0,
    completed: false,
  };
  if (previous.completed) return { progress, ...outcome };
  const next = {
    ...previous,
    attempts: previous.attempts + 1,
    successes: previous.successes + Number(outcome.success),
    streak: outcome.success ? previous.streak + 1 : 0,
  };
  next.completed =
    (plan.counting === "total" ? next.successes : next.streak) >=
    questGoal(plan, quest);
  return {
    progress: {
      ...progress,
      version: 1 as const,
      passes: { ...progress.passes, [quest.id]: next },
      processed: [...progress.processed.slice(-49999), result.id],
    },
    ...outcome,
  };
}
