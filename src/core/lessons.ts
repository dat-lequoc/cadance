import { type Song, type Mode, TempoMap } from "./model";
export interface Exercise {
  version: 1;
  title: string;
  explanation: string;
  tempo: number;
  meter: [number, number];
  range: [number, number];
  mode: Mode;
  scoring?: { earlyMs?: number; lateMs?: number; chordMs?: number };
  notes: {
    pitch: number;
    beat: number;
    duration: number;
    hand: "left" | "right";
    finger?: number;
  }[];
}
export function validateExercise(value: unknown): Exercise {
  const e = value as Exercise;
  const finite = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (
    !e ||
    e.version !== 1 ||
    typeof e.title !== "string" ||
    !e.title.trim() ||
    e.title.length > 120 ||
    typeof e.explanation !== "string" ||
    e.explanation.length > 4000 ||
    !finite(e.tempo, 20, 300) ||
    !Array.isArray(e.meter) ||
    e.meter.length !== 2 ||
    !Number.isInteger(e.meter[0]) ||
    !finite(e.meter[0], 1, 32) ||
    ![1, 2, 4, 8, 16].includes(e.meter[1]) ||
    !Array.isArray(e.range) ||
    e.range.length !== 2 ||
    e.range.some((p) => !Number.isInteger(p) || !finite(p, 0, 127)) ||
    e.range[0] > e.range[1] ||
    !["wait", "rhythm", "listen", "free"].includes(e.mode) ||
    !Array.isArray(e.notes) ||
    !e.notes.length ||
    e.notes.length > 50000
  )
    throw Error(
      "Invalid version 1 exercise. Check title, tempo, meter, range and notes.",
    );
  for (const n of e.notes)
    if (
      !n ||
      !Number.isInteger(n.pitch) ||
      !finite(n.pitch, e.range[0], e.range[1]) ||
      !finite(n.beat, 0, 100000) ||
      !finite(n.duration, 0.01, 1000) ||
      !["left", "right"].includes(n.hand) ||
      (n.finger !== undefined &&
        (!Number.isInteger(n.finger) || !finite(n.finger, 1, 5)))
    )
      throw Error("Invalid exercise note.");
  if (e.scoring)
    for (const [key, v] of Object.entries(e.scoring))
      if (
        !["earlyMs", "lateMs", "chordMs"].includes(key) ||
        !finite(v, 10, 3000)
      )
        throw Error("Invalid scoring options.");
  return e;
}
export function fromExercise(
  e: Exercise,
  id: string = crypto.randomUUID(),
): Song {
  validateExercise(e);
  const ppq = 480,
    tempos = [{ tick: 0, bpm: e.tempo }],
    map = new TempoMap(ppq, tempos);
  const notes = e.notes
    .map((n, i) => ({
      id: id + ":" + i,
      pitch: n.pitch,
      tick: n.beat * ppq,
      durationTicks: n.duration * ppq,
      time: map.seconds(n.beat * ppq),
      duration: (n.duration * 60) / e.tempo,
      velocity: 0.72,
      track: n.hand === "left" ? 0 : 1,
      channel: 1,
      hand: n.hand,
      finger: n.finger,
    }))
    .sort((a, b) => a.time - b.time);
  return {
    version: 1,
    id,
    title: e.title,
    explanation: e.explanation,
    ppq,
    tempos,
    meters: [{ tick: 0, numerator: e.meter[0], denominator: e.meter[1] }],
    keys: [],
    notes,
    duration: Math.max(...notes.map((n) => n.time + n.duration)) + 0.5,
  };
}
const sequences: {
  title: string;
  goal: string;
  pitches: (number | number[])[];
  hand?: "left" | "right";
  step?: number;
}[] = [
  {
    title: "Meet middle C",
    goal: "Find C4: the white key just to the left of two black keys. Release between each note.",
    pitches: [60, 60, 60, 60],
  },
  {
    title: "A little higher",
    goal: "Move from C to D to E. Use fingers 1, 2 and 3 on your right hand.",
    pitches: [60, 62, 64, 62, 60],
  },
  {
    title: "Five-finger walk",
    goal: "Keep your hand relaxed over C–G. Walk up, then find your way home.",
    pitches: [60, 62, 64, 65, 67, 65, 64, 62, 60],
  },
  {
    title: "Same key, fresh start",
    goal: "Give every C a fresh press. Holding the key or pedal will not play the next note.",
    pitches: [60, 60, 62, 62, 60, 60, 60],
    step: 0.5,
  },
  {
    title: "A steady heartbeat",
    goal: "Try Rhythm mode. Match a steady quarter-note pulse; accuracy matters more than speed.",
    pitches: [60, 62, 64, 60, 60, 62, 64, 60],
  },
  {
    title: "Small steps, big skips",
    goal: "Listen to the space between two notes. Alternate seconds and thirds.",
    pitches: [60, 62, 60, 64, 62, 65, 64, 67],
  },
  {
    title: "Two notes together",
    goal: "Play both notes together. Keep the first key held while adding the second.",
    pitches: [
      [60, 64],
      [62, 65],
      [64, 67],
      [60, 64],
    ],
    step: 2,
  },
  {
    title: "Your first chords",
    goal: "Build C major with C, E and G. Collect all three keys within one second, then release.",
    pitches: [
      [60, 64, 67],
      [60, 65, 69],
      [59, 62, 67],
      [60, 64, 67],
    ],
    step: 2,
  },
  {
    title: "Left hand, your turn",
    goal: "Place your left hand over C3–G3 and give the lower notes a voice.",
    pitches: [48, 50, 52, 53, 55, 53, 52, 50, 48],
    hand: "left",
  },
  {
    title: "Hands in conversation",
    goal: "Answer a low note with a high note. Let one hand rest while the other plays.",
    pitches: [48, 60, 50, 62, 52, 64, 55, 67],
  },
  {
    title: "A small beginning",
    goal: "Bring both hands together. Hold the bass gently while your right hand plays the melody.",
    pitches: [
      [48, 60],
      62,
      64,
      67,
      [53, 65],
      64,
      62,
      60,
      [55, 59],
      62,
      65,
      62,
      [48, 60, 64, 67],
    ],
  },
  {
    title: "The checkpoint",
    goal: "Find C4, build C–E–G, then play C4 twice with fresh attacks. A complete wait-mode workout.",
    pitches: [60, [60, 64, 67], 60, 60],
    step: 2,
  },
];
export const exercises: Exercise[] = sequences.map((s) => ({
  version: 1,
  title: s.title,
  explanation: s.goal,
  tempo: 80,
  meter: [4, 4],
  range: [21, 108],
  mode: "wait",
  notes: s.pitches.flatMap((p, i) =>
    (Array.isArray(p) ? p : [p]).map((pitch) => ({
      pitch,
      beat: 2 + i * (s.step ?? 1),
      duration: (s.step ?? 1) * 0.75,
      hand: s.hand ?? (pitch < 60 ? "left" : "right"),
      finger:
        pitch >= 60 && pitch <= 67
          ? [1, 0, 2, 0, 3, 4, 0, 5][pitch - 60] || undefined
          : undefined,
    })),
  ),
}));
export const lessons = exercises.map((e, i) => ({
  ...fromExercise(e, "lesson-" + i),
  lesson: i + 1,
}));
