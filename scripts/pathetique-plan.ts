import { mkdirSync, writeFileSync } from "node:fs";
import data from "../src/core/pathetique.json";
import type { Song } from "../src/core/model";
const song = data as Song;
import { measures } from "../src/core/loops";
import {
  songFingerprint,
  questTargets,
  type PracticePlan,
} from "../src/core/quests";
const bars = measures(song);
const sections: [number, number, string][] = [
  [1, 8, "Opening theme"],
  [9, 16, "Theme in the upper register"],
  [17, 22, "Moving melody"],
  [23, 28, "Transition and held cadence"],
  [29, 36, "Opening material returns"],
  [37, 41, "Contrasting figures"],
  [42, 44, "Dense runs and chords"],
  [45, 50, "Return transition"],
  [51, 58, "Theme with new accompaniment"],
  [59, 66, "Upper-register return"],
  [67, 73, "Closing gestures"],
];
const short = new Set([21, 22, 42, 43, 44, 48, 49, 50, 67, 69]);
const passages: { from: number; through: number; section: string }[] = [];
for (const [first, last, section] of sections)
  for (let from = first; from <= last;) {
    const through =
      short.has(from) || short.has(from + 1) ? from : Math.min(last, from + 1);
    passages.push({ from, through, section });
    from = through + 1;
  }
const plan: PracticePlan = {
  version: 1,
  id: "pathetique-ii-reviews-v4",
  title: "Pathétique II · one passage at a time",
  song: { title: song.title, fingerprint: await songFingerprint(song) },
  repetitions: 10,
  counting: "total",
  quests: [],
};
for (const p of passages) {
  const label =
    p.from === p.through ? `Bar ${p.from}` : `Bars ${p.from}–${p.through}`;
  const stages = [
    {
      id: "right",
      title: "Right hand",
      hand: "right" as const,
      focus: "all" as const,
      instruction:
        "Play every right-hand note, including melody and inner harmonies. Hold chord notes together; the app waits for every required note. The left hand accompanies you.",
    },
    {
      id: "left",
      title: "Left hand",
      hand: "left" as const,
      focus: "all" as const,
      instruction:
        "Play the left-hand part alone while the right hand accompanies you. Release and press repeated notes again.",
    },
    {
      id: "together",
      title: "Both hands",
      hand: "both" as const,
      focus: "all" as const,
      instruction:
        "Combine melody, inner harmonies and left hand. Keep chord notes held as you add the others. A complete run earns one repetition, even if you corrected mistakes along the way.",
    },
  ];
  for (const stage of stages) {
    const q = {
      id: `bars-${p.from}-${p.through}-${stage.id}`,
      title: `${label} · ${stage.title}`,
      section: p.section,
      instruction: stage.instruction,
      fromBar: p.from,
      throughBar: p.through,
      hand: stage.hand,
      focus: stage.focus,
      mode: "wait" as const,
      speed: short.has(p.from) ? 0.6 : 0.8,
    };
    if (questTargets(song, q).length) plan.quests.push(q);
  }
  const [sectionStart, sectionEnd] = sections.find(([, , name]) => name === p.section)!;
  if (sectionEnd - sectionStart + 1 > 10) throw Error("Review section exceeds ten bars");
  // First passage is already practiced together; connect each subsequent cut.
  if (p.from > sectionStart) {
    const q = {
      id: `review-${sectionStart}-${p.through}`,
      repetitions: 5,
      title: `Bars ${sectionStart}–${p.through} · ${p.through === sectionEnd ? "Section review" : "Build-up review"}`,
      section: p.section,
      instruction: `Join bars ${sectionStart}–${p.through} with both hands. Practice the transitions between the short passages. This review stays inside the current musical section.`,
      fromBar: sectionStart, throughBar: p.through,
      hand: "both" as const, focus: "all" as const, mode: "wait" as const,
      speed: passages.some((cut) => cut.section === p.section && cut.from <= p.through && short.has(cut.from)) ? 0.6 : 0.8,
    };
    if (questTargets(song, q).length) plan.quests.push(q);
  }
}
const stamp = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const rows = passages.map((p) => {
  const a = bars[p.from - 1],
    b = bars[p.through - 1],
    notes = song.notes.filter((n) => n.time >= a.start && n.time < b.end);
  return `| ${p.from}–${p.through} | ${stamp(a.start)}–${stamp(b.end)} | ${notes.filter((n) => n.role === "melody").length} | ${notes.filter((n) => n.hand === "left").length} | ${notes.length} | ${p.section} |`;
});
const markdown = `# Pathétique II: one passage at a time

This is a playable practice plan for the included, voice-separated MIDI of Beethoven's Pathétique second movement. Import this Markdown file into Cadance, or use its bundled Practice quests card. It does not replace the MIDI.

## What the MIDI shows

- 73 bars in 2/4, 1,629 note events, about 4:03 at the source tempo (36 quarter-note BPM).
- 331 melody notes, 711 right-hand inner-harmony notes and 587 left-hand notes. Parts come from the supplied score voices, not a middle-C guess.
- Most checkpoints are two bars (about 6.7 source seconds). Busy passages at bars 21–22, 42–44, 48–50, 67 and 69 are isolated into single bars.
- Bars 27–28 stay together: two melody pitches sustain across that boundary, and bar 28 has no new melody or left-hand attacks.
- These are practice-sized cuts informed by note density and the supplied score, not a claim that every cut is a complete musical phrase. Passage times follow this MIDI's tempo map, not a recording.

## Quest rules

Each passage has three quests: right hand, left hand, then both hands. Every stage includes all notes for its selected hand or hands, including the inner harmonies. Earn **10 completed runs in total** for new passages, or **5 completed runs** for cumulative reviews, to complete a checkpoint. Every quest is available from the start; jump to any passage whenever you like. Unfinished runs do not count. Correcting mistakes and finishing does count. The file can change counting to consecutive if you want a streak challenge.

A completed run means finishing the entire passage and hitting every target note. Wrong notes and chord retries are recorded for feedback but do not cancel the repetition. These quests use Wait for notes: timing, hold duration, phrasing, fingering and pedal artistry are not graded. Use ordinary Rhythm practice when you want timing feedback.

The player repeats the current quest automatically until its goal is reached. It then automatically starts the next checkpoint with preparation time and a brief header toast. Click the completed-run counter and confirm **Mark complete & next** to advance manually; this does not fabricate played runs. Listening, stopped runs, skipped passages and altered hand/mode settings do not earn successes. Progress is local, survives reload, and is included in backups.

Default speed is 80%, or 60% in the isolated busy bars. Slow enough to find the notes is the aim; this is not the final performance tempo. You can review completed quests and leave quest mode for unrestricted practice at any time.

## Cumulative reviews

After bars 3–4, play bars 1–4 together; after bars 5–6, play 1–6; after 7–8, play the whole 1–8 section. Then reset the review start to bar 9. Every later section follows the same pattern, including single-bar cuts in dense passages. Reviews use both hands and a five-run goal, with manual completion available. Existing musical section boundaries keep reviews at eight bars or fewer, below the ten-bar cap. Selected playback speed is remembered.

## Checkpoint map

| Bars | Source time | Melody attacks | Left-hand attacks | All note events | Area |
| --- | --- | ---: | ---: | ---: | --- |
${rows.join("\n")}

## Editable app data

The app reads the single cadance-plan block below. Titles and instructions are plain text; no Markdown or scripts are executed. The fingerprint binds this plan to the MIDI's timing, pitches and hand/part assignments. Changing the plan data starts a separate progress record, so changing a goal cannot silently claim earlier mastery.

\`\`\`cadance-plan
${JSON.stringify(plan, null, 2)}
\`\`\`
`;
mkdirSync("public/plans", { recursive: true });
writeFileSync("public/plans/pathetique-ii.md", markdown);
console.log(
  JSON.stringify({
    passages: passages.length,
    quests: plan.quests.length,
    fingerprint: plan.song.fingerprint,
    path: "public/plans/pathetique-ii.md",
  }),
);
