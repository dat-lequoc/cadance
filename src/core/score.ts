import { measures } from "./loops";
import { TempoMap, type Song } from "./model";
import { songFingerprint } from "./quests";

export interface ScoreStaff {
  step: number;
  clefs: { x: number; y: number; pitch: 53 | 67 }[];
}
export interface ScoreSystem {
  image: string;
  width: number;
  height: number;
  page: number;
  fromBar: number;
  throughBar: number;
  staves?: ScoreStaff[];
}
export interface ScoreAnchor {
  tick: number;
  x: number;
  notes: { pitch: number; x: number; y: number }[];
}
export interface ScoreBar {
  number: number;
  tick: number;
  endTick: number;
  system: number;
  left: number;
  right: number;
  anchors?: ScoreAnchor[];
}
export interface PreparedScore {
  version: 1;
  fingerprint: string;
  sourcePdf: string;
  pdfSha256: string;
  systems: ScoreSystem[];
  bars: ScoreBar[];
}

// Both generation and registration use this check: a similarly named edition
// must never silently display a plausible but incorrectly aligned score.
export async function validateScore(score: PreparedScore, song: Song) {
  if (
    score.version !== 1 ||
    score.fingerprint !== (await songFingerprint(song))
  )
    throw Error(
      "The prepared score belongs to a different MIDI or part assignment.",
    );
  const bars = measures(song);
  if (
    !bars.length ||
    score.bars.length !== bars.length ||
    !score.systems.length
  )
    throw Error("The score must cover every MIDI measure.");
  for (const system of score.systems) {
    if (
      !/^\/scores\/[a-z0-9/_-]+\.png$/.test(system.image) ||
      !Number.isFinite(system.width) ||
      system.width <= 0 ||
      !Number.isFinite(system.height) ||
      system.height <= 0 ||
      !Number.isInteger(system.page) ||
      system.page < 1
    )
      throw Error("Invalid score image or dimensions.");
    if (system.staves !== undefined && (!Array.isArray(system.staves) || system.staves.length !== 2 || system.staves.some((staff) =>
      !Number.isFinite(staff.step) || staff.step <= 0 || staff.step >= .1 || !Array.isArray(staff.clefs) || !staff.clefs.length ||
      staff.clefs.some((clef, i) => ![53, 67].includes(clef.pitch) || !Number.isFinite(clef.x) || !Number.isFinite(clef.y) ||
        clef.x < 0 || clef.x > 1 || clef.y < 0 || clef.y > 1 || (i > 0 && clef.x < staff.clefs[i - 1].x)))))
      throw Error("Invalid score staff geometry.");
  }
  score.bars.forEach((bar, i) => {
    const expected = bars[i],
      system = score.systems[bar.system];
    if (
      bar.number !== expected.number ||
      bar.tick !== expected.tick ||
      bar.endTick !== expected.endTick ||
      !Number.isInteger(bar.system) ||
      !system ||
      bar.number < system.fromBar ||
      bar.number > system.throughBar ||
      !Number.isFinite(bar.left) ||
      !Number.isFinite(bar.right) ||
      bar.left < 0 ||
      bar.right > 1 ||
      bar.right <= bar.left
    )
      throw Error(`Invalid score alignment at bar ${i + 1}.`);
    if (bar.anchors !== undefined) {
      const notes = song.notes.filter((n) => n.tick >= bar.tick && n.tick < bar.endTick);
      const ticks = [...new Set(notes.map((n) => n.tick))].sort((a, b) => a - b);
      if (!Array.isArray(bar.anchors) || bar.anchors.length !== ticks.length || !ticks.length)
        throw Error(`Incomplete note anchors at bar ${bar.number}.`);
      bar.anchors.forEach((anchor, j) => {
        const pitches = new Set(notes.filter((n) => n.tick === ticks[j]).map((n) => n.pitch));
        if (anchor.tick !== ticks[j] || !Number.isFinite(anchor.x) || anchor.x < bar.left || anchor.x > bar.right ||
          (j > 0 && anchor.x <= bar.anchors![j - 1].x) || !Array.isArray(anchor.notes) || anchor.notes.length !== pitches.size ||
          new Set(anchor.notes.map((n) => n.pitch)).size !== pitches.size ||
          anchor.notes.some((n) => !pitches.has(n.pitch) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || n.x < bar.left || n.x > bar.right || n.y < 0 || n.y > 1))
          throw Error(`Invalid note anchor at bar ${bar.number}.`);
      });
    }
  });
  return score;
}

export function scoreBarAt(
  score: PreparedScore,
  map: TempoMap,
  seconds: number,
) {
  // Engine time is already in source seconds, including tempo changes and speed.
  // Half-open intervals switch exactly at a barline; lead-in/tail clamp to score.
  const tick = map.ticks(Number.isFinite(seconds) ? seconds : 0);
  return score.bars.findLast((bar) => bar.tick <= tick + 1e-7) ?? score.bars[0];
}

export function scoreAnchorAt(bar: ScoreBar, map: TempoMap, seconds: number) {
  const tick = map.ticks(Number.isFinite(seconds) ? seconds : 0);
  return bar.anchors?.findLast((anchor) => anchor.tick <= tick + 1e-7) ?? null;
}

/** Name and diatonic staff position for an actual MIDI pitch, including accidentals. */
export function scorePitch(pitch: number, flats = false) {
  const names = flats ? ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"] :
    ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const name = names[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return { label: `${name}${octave}`, step: octave * 7 + "CDEFGAB".indexOf(name[0]), accidental: name.slice(1) || "♮" };
}

/** Project a played pitch on the clef currently printed at the cursor. */
export function playedScorePosition(system: ScoreSystem, anchor: ScoreAnchor, pitch: number, expected: number[], flats = false) {
  if (!system.staves) return null;
  const candidates = anchor.notes.filter((n) => expected.includes(n.pitch));
  const nearby = (candidates.length ? candidates : anchor.notes).reduce((best, n) => Math.abs(n.pitch - pitch) < Math.abs(best.pitch - pitch) ? n : best);
  const staffs = system.staves.map((staff) => {
    const clef = staff.clefs.findLast((c) => c.x <= anchor.x) ?? staff.clefs[0];
    const top = clef.y - (clef.pitch === 67 ? 6 : 2) * staff.step;
    const bottom = top + 8 * staff.step;
    return { ...staff, clef, top, bottom };
  });
  const staff = staffs.reduce((best, item) => {
    const distance = (s: typeof item) => Math.max(s.top - nearby.y, 0, nearby.y - s.bottom);
    return distance(item) < distance(best) ? item : best;
  });
  const spelled = scorePitch(pitch, flats);
  const y = staff.clef.y - (spelled.step - scorePitch(staff.clef.pitch).step) * staff.step;
  const ledgers: number[] = [];
  if (y >= 0 && y <= 1) {
    for (let line = staff.top - 2 * staff.step; line >= y - staff.step / 4 && ledgers.length < 16; line -= 2 * staff.step) ledgers.push(line);
    for (let line = staff.bottom + 2 * staff.step; line <= y + staff.step / 4 && ledgers.length < 16; line += 2 * staff.step) ledgers.push(line);
  }
  return { y, ledgers, ...spelled };
}
