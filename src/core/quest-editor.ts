import { emptyProgress, questGoal, readQuestProgress, type PracticePlan, type Quest, type QuestProgress } from "./quests";

export const planMarkdown = (plan: PracticePlan) =>
  "# My practice plan\n\nPersonal checkpoints. Choose any passage in any order.\n\n```cadance-plan\n" + JSON.stringify(plan, null, 2) + "\n```\n";

export const newQuestId = () => `custom-${crypto.randomUUID()}`;
export const rangeTitle = (from: number, through: number) => from === through ? `Bar ${from}` : `Bars ${from}–${through}`;

/** Keep existing checkpoints intact, grouping hand practice before the source. */
export function practiceHandsSeparately(plan: PracticePlan, id: string) {
  const source = plan.quests.find((q) => q.id === id);
  if (!source || source.hand !== "both") throw Error("Choose a both-hands quest to practice hands separately.");
  const hands = (["right", "left"] as const).map((hand) =>
    plan.quests.find((q) => q.hand === hand && q.fromBar === source.fromBar &&
      q.throughBar === source.throughBar && q.section === source.section &&
      q.focus === source.focus && q.mode === source.mode) ?? {
      ...source, id: newQuestId(), hand,
      title: `${rangeTitle(source.fromBar, source.throughBar)} · ${hand === "right" ? "Right" : "Left"} hand`,
      instruction: `Play every target note with your ${hand} hand in this passage.`,
    });
  const reused = new Set(hands.map((q) => q.id));
  const quests = plan.quests.flatMap((q) => q.id === id ? [...hands, q] : reused.has(q.id) ? [] : [q]);
  return { plan: { ...plan, quests }, rightId: hands[0].id };
}

/** Labels may change; earned runs must never move to a different task. */
export function sameCheckpoint(a: Quest, aPlan: PracticePlan, b: Quest, bPlan: PracticePlan) {
  return aPlan.song.fingerprint === bPlan.song.fingerprint && aPlan.counting === bPlan.counting &&
    a.fromBar === b.fromBar && a.throughBar === b.throughBar && a.hand === b.hand &&
    a.focus === b.focus && a.mode === b.mode && a.speed === b.speed &&
    questGoal(aPlan, a) === questGoal(bPlan, b);
}

export function carryUnchangedProgress(previous: PracticePlan, next: PracticePlan, progress: QuestProgress, saved = emptyProgress()) {
  const result = readQuestProgress(saved, next);
  result.processed = [...new Set([...result.processed, ...progress.processed])].slice(-50000);
  for (const quest of next.quests) {
    const before = previous.quests.find((q) => q.id === quest.id);
    if (before && sameCheckpoint(before, previous, quest, next) && progress.passes[quest.id] && !result.passes[quest.id])
      result.passes[quest.id] = { ...progress.passes[quest.id] };
  }
  return readQuestProgress(result, next);
}

/** Prefer existing both-hands tasks, converting single-hand-only ranges so no
 * passage disappears (automatic MIDI routes omit duplicate both-hand tasks). */
export function bothHandsOnly(plan: PracticePlan): PracticePlan {
  const key = (q: Quest) => JSON.stringify([q.fromBar, q.throughBar, q.focus, q.mode, q.section]);
  const groups = new Map<string, Quest[]>();
  for (const q of plan.quests) groups.set(key(q), [...(groups.get(key(q)) ?? []), q]);
  return { ...plan, quests: [...groups.values()].map((group) => {
    const both = group.find((q) => q.hand === "both");
    if (both) return both;
    const q = group[0];
    return { ...q, id: newQuestId(), hand: "both", title: `${rangeTitle(q.fromBar, q.throughBar)} · Both hands`, instruction: "Play all target notes in this passage with both hands." };
  }) };
}

/** Merging operates on actual bar ranges, including overlapping reviews, not
 * a fixed number of rows. Gaps require an explicit custom range instead. */
export function mergeQuests(plan: PracticePlan, ids: string[], settings: Partial<Quest> = {}): PracticePlan {
  const selected = plan.quests.filter((q) => ids.includes(q.id));
  if (selected.length < 2) throw Error("Select at least two quests to merge.");
  const ordered = [...selected].sort((a, b) => a.fromBar - b.fromBar);
  let end = ordered[0].throughBar;
  for (const q of ordered.slice(1)) {
    if (q.fromBar > end + 1) throw Error("These quests have a gap. Select the intervening passage too, or add a custom bar range.");
    end = Math.max(end, q.throughBar);
  }
  const from = ordered[0].fromBar;
  const hand = settings.hand ?? (selected.every((q) => q.hand === selected[0].hand) ? selected[0].hand : "both");
  const merged: Quest = {
    ...selected[0], fromBar: from, throughBar: end, hand, focus: "all",
    title: `${rangeTitle(from, end)} · ${hand === "both" ? "Both hands" : hand === "right" ? "Right hand" : "Left hand"}`, instruction: "Connect this whole passage, including the transitions between its parts.",
    ...settings, id: newQuestId(),
  };
  const first = plan.quests.indexOf(selected[0]);
  return { ...plan, quests: plan.quests.flatMap((q, i) => i === first ? [merged] : ids.includes(q.id) ? [] : [q]) };
}

export function splitQuest(plan: PracticePlan, id: string, afterBar: number): PracticePlan {
  const quest = plan.quests.find((q) => q.id === id);
  if (!quest || !Number.isInteger(afterBar) || afterBar < quest.fromBar || afterBar >= quest.throughBar)
    throw Error("Split after a bar inside the selected quest, before its final bar.");
  return { ...plan, quests: plan.quests.flatMap((q) => q.id !== id ? [q] : [
    { ...q, id: newQuestId(), throughBar: afterBar, title: rangeTitle(q.fromBar, afterBar) },
    { ...q, id: newQuestId(), fromBar: afterBar + 1, title: rangeTitle(afterBar + 1, q.throughBar) },
  ]) };
}
