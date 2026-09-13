import { defaults, scored, type Song } from "./model";
import { measures } from "./loops";
import { preparedEditionFor } from "./catalogue";
import { readPracticePlan, songFingerprint, type LoadedPlan, type PracticePlan, type Quest } from "./quests";

const preparedPlans = Object.values(import.meta.glob<string>("../../public/plans/*.md", {
  eager: true, query: "?raw", import: "default",
}));

const planHistory = Object.values(import.meta.glob<string>("../../public/plans/history/*.md", {
  eager: true, query: "?raw", import: "default",
}));

/** Only wording/section-label revisions may share earned progress. */
export function sameQuestRequirements(previous: PracticePlan, current: PracticePlan) {
  const requirements = (plan: PracticePlan) => plan.quests.map(({ title: _title, section: _section, instruction: _instruction, ...quest }) => ({
    ...quest, repetitions: quest.repetitions ?? plan.repetitions, counting: plan.counting,
  }));
  return previous.song.fingerprint === current.song.fingerprint && previous.song.title === current.song.title &&
    JSON.stringify(requirements(previous)) === JSON.stringify(requirements(current));
}

export async function previousPreparedPlansFor(current: LoadedPlan, song: Song) {
  const previous = [];
  for (const markdown of planHistory) {
    const block = markdown.match(/^```cadance-plan\s*\r?\n([\s\S]*?)^```\s*$/m);
    if (block && sameQuestRequirements(JSON.parse(block[1]), current.plan))
      previous.push(await readPracticePlan(markdown, song));
  }
  return previous;
}

export async function preparedPlanFor(song: Song) {
  const fingerprint = await songFingerprint(song);
  const edition = preparedEditionFor(song);
  const matching: string[] = [];
  for (const markdown of preparedPlans) {
    const block = markdown.match(/^```cadance-plan\s*\r?\n([\s\S]*?)^```\s*$/m);
    if (block) {
      const plan = JSON.parse(block[1]);
      if (plan.song?.fingerprint === fingerprint) {
        if (edition && plan.song?.title === edition.song.title) return readPracticePlan(markdown, song);
        matching.push(markdown);
      }
    }
  }
  // An unidentified MIDI with multiple editions must not inherit an arbitrary plan.
  return matching.length === 1 ? readPracticePlan(matching[0], song) : null;
}

/** Mechanical practice suggestions, not inferred musical phrases or score alignment. */
export async function automaticPlanFor(song: Song) {
  const bars = measures(song);
  const targets = song.notes.filter((note) => scored(note, defaults));
  if (!bars.length || !targets.length) return null;
  const fingerprint = await songFingerprint(song);
  const plan: PracticePlan = {
    version: 1, id: `auto-v1-${fingerprint.slice(0, 32)}`,
    title: "Automatic practice plan",
    song: { title: "Imported piece", fingerprint },
    repetitions: 5, counting: "total", quests: [],
  };
  // Four passages per session; at most 200 passages keeps even long MIDI files
  // below the plan's 1,000-quest limit without dropping the ending.
  const passageSize = Math.max(2, Math.ceil(bars.length / 200));
  const sessionSize = passageSize * 4;
  const add = (fromBar: number, throughBar: number, section: string, hand: Quest["hand"], review = false) => {
    const notes = targets.filter((note) => note.time >= bars[fromBar - 1].start && note.time < bars[throughBar - 1].end);
    if (!notes.some((note) => hand === "both" || note.hand === hand)) return;
    // A one-handed passage needs one quest, not a duplicate "both hands" quest.
    if (!review && hand === "both" && !(["left", "right"] as const).every((part) => notes.some((note) => note.hand === part))) return;
    plan.quests.push({
      id: `${review ? "review" : "passage"}-${fromBar}-${throughBar}-${hand}`,
      title: `Bars ${fromBar}–${throughBar} · ${review ? "Session review" : hand === "both" ? "Both hands" : hand === "left" ? "Left hand" : "Right hand"}`,
      section, fromBar, throughBar, hand, focus: "all", mode: "wait", speed: 0.5,
      repetitions: review ? 3 : 5,
      instruction: "Automatically grouped from MIDI bars, not musical phrasing. Check the suggested hand assignments. Jump to any passage; combine this session in its review.",
    });
  };
  for (let start = 1; start <= bars.length; start += sessionSize) {
    const end = Math.min(start + sessionSize - 1, bars.length);
    const section = `Session ${Math.floor((start - 1) / sessionSize) + 1} · Bars ${start}–${end}`;
    for (let from = start; from <= end; from += passageSize)
      for (const hand of ["right", "left", "both"] as const)
        add(from, Math.min(from + passageSize - 1, end), section, hand);
    add(start, end, section, "both", true);
  }
  if (!plan.quests.length) return null;
  return readPracticePlan("# Automatic practice plan\n\n```cadance-plan\n" + JSON.stringify(plan) + "\n```\n", song);
}

export async function defaultPlanFor(song: Song) {
  return await preparedPlanFor(song) ?? await automaticPlanFor(song);
}
