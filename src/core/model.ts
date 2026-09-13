export type Hand = "left" | "right" | "accompaniment" | "ignored";
export type Mode = "wait" | "rhythm" | "recital" | "listen" | "free";
export interface Note {
  id: string;
  pitch: number;
  tick: number;
  durationTicks: number;
  time: number;
  duration: number;
  velocity: number;
  track: number;
  channel: number;
  hand: Hand;
  finger?: number;
  role?: "melody" | "harmony";
  hidden?: boolean;
  muted?: boolean;
}
export interface Song {
  version: 1;
  id: string;
  title: string;
  explanation: string;
  ppq: number;
  tempos: { tick: number; bpm: number }[];
  meters: { tick: number; numerator: number; denominator: number }[];
  keys: { tick: number; key: string; scale: string }[];
  notes: Note[];
  duration: number;
  original?: ArrayBuffer;
  lesson?: number;
  composer?: string;
  trackNames?: string[];
  roleSource?: "score" | "suggested";
  scoreUrl?: string;
  studyScore?: { url: string; title: string };
  sourceUrl?: string;
  attribution?: string;
}
export interface InputEvent {
  raw?: number[];
  type: "on" | "off" | "sustain";
  pitch: number;
  velocity: number;
  value: number;
  channel: number;
  port: string;
  time: number;
  source: "hardware" | "simulated" | "playback";
}
export interface Config {
  mode: Mode;
  hand: "both" | "left" | "right";
  focus?: "all" | "melody" | "harmony";
  speed: number;
  transpose: number;
  minPitch: number;
  maxPitch: number;
  earlyMs: number;
  lateMs: number;
  chordMs: number;
  groupingMs: number;
  inputOffsetMs: number;
  restartOnWrong: boolean;
}
export const defaults: Config = {
  mode: "wait",
  hand: "both",
  focus: "all",
  speed: 1,
  transpose: 0,
  minPitch: 21,
  maxPitch: 108,
  earlyMs: 150,
  lateMs: 150,
  chordMs: 1000,
  groupingMs: 0,
  inputOffsetMs: 0,
  restartOnWrong: false,
};
export const noteName = (pitch: number) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
    ((pitch % 12) + 12) % 12
  ] +
  (Math.floor(pitch / 12) - 1);
export const black = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);
export const keyId = (e: InputEvent) => `${e.port}:${e.channel}:${e.pitch}`;
export const pedalId = (e: InputEvent) => `${e.port}:${e.channel}`;
export const scored = (n: Note, c: Config) =>
  n.hand !== "ignored" &&
  n.hand !== "accompaniment" &&
  (c.hand === "both" || c.hand === n.hand) &&
  (!c.focus || c.focus === "all" || n.role === c.focus);
export function prepare(song: Song, c: Config): Note[] {
  return song.notes
    .filter((n) => n.hand !== "ignored")
    .map((n) => ({ ...n, pitch: n.pitch + c.transpose }));
}
export function rangeWarnings(song: Song, c: Config): Note[] {
  return prepare(song, c).filter(
    (n) =>
      n.pitch < 0 ||
      n.pitch > 127 ||
      (scored(n, c) && (n.pitch < c.minPitch || n.pitch > c.maxPitch)),
  );
}
export class TempoMap {
  points: { tick: number; bpm: number; seconds: number }[] = [];
  constructor(
    public ppq: number,
    tempos: { tick: number; bpm: number }[],
  ) {
    if (!Number.isFinite(ppq) || ppq <= 0) throw Error("Invalid PPQ");
    const sorted = [{ tick: 0, bpm: 120 }, ...tempos].sort(
      (a, b) => a.tick - b.tick,
    );
    for (const t of sorted) {
      if (
        !Number.isFinite(t.tick) ||
        t.tick < 0 ||
        !Number.isFinite(t.bpm) ||
        t.bpm <= 0
      )
        throw Error("Invalid tempo");
      const p = this.points.at(-1);
      const seconds = p
        ? p.seconds + (((t.tick - p.tick) / ppq) * 60) / p.bpm
        : 0;
      if (p?.tick === t.tick) this.points.pop();
      this.points.push({ ...t, seconds });
    }
  }
  seconds(tick: number) {
    const p = this.points.findLast((p) => p.tick <= tick) ?? this.points[0];
    return p.seconds + (((tick - p.tick) / this.ppq) * 60) / p.bpm;
  }
  ticks(seconds: number) {
    const p =
      this.points.findLast((p) => p.seconds <= seconds) ?? this.points[0];
    return p.tick + ((seconds - p.seconds) * this.ppq * p.bpm) / 60;
  }
}

export const rhythmMode = (mode: Mode) =>
  mode === "rhythm" || mode === "recital";
export function suggestRoles(notes: Note[]): Note[] {
  // Conservative upper-voice suggestion, not a claim that MIDI identifies melody.
  const byTime = new Map<number, Note[]>();
  for (const n of notes) {
    const group = byTime.get(n.tick) ?? [];
    group.push(n);
    byTime.set(n.tick, group);
  }
  let melodyEnd = -1,
    melodyPitch = -1;
  const melody = new Set<string>();
  for (const group of byTime.values()) {
    const upper = group
      .filter((n) => n.hand === "right")
      .sort(
        (a, b) => b.pitch - a.pitch || b.durationTicks - a.durationTicks,
      )[0];
    if (upper && (upper.tick >= melodyEnd || upper.pitch > melodyPitch)) {
      melody.add(upper.id);
      melodyEnd = upper.tick + upper.durationTicks;
      melodyPitch = upper.pitch;
    }
  }
  return notes.map((n) => ({
    ...n,
    role: melody.has(n.id) ? "melody" : "harmony",
  }));
}
export function keyboardRange(
  song: Song,
  min = 21,
  max = 108,
): [number, number] {
  let low = song.notes.reduce((v, n) => Math.min(v, n.pitch), max),
    high = song.notes.reduce((v, n) => Math.max(v, n.pitch), min);
  low = Math.max(min, 12 * Math.floor(low / 12));
  high = Math.min(max, 12 * Math.ceil(high / 12));
  if (high - low < 24) {
    high = Math.min(max, low + 24);
    low = Math.max(min, high - 24);
  }
  while (black(low) && low > min) low--;
  while (black(high) && high < max) high++;
  return [low, high];
}
