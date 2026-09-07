import { TempoMap, type Song, type Config } from "./model";
export interface Measure {
  number: number;
  start: number;
  end: number;
  tick: number;
  endTick: number;
}
export interface SavedLoop {
  id: string;
  songId: string;
  name: string;
  start: number;
  end: number;
  created: string;
}
export function measures(song: Song): Measure[] {
  const map = new TempoMap(song.ppq, song.tempos),
    meters = [
      ...(song.meters.length
        ? song.meters
        : [{ tick: 0, numerator: 4, denominator: 4 }]),
    ].sort((a, b) => a.tick - b.tick);
  const end = song.notes.reduce(
    (v, n) => Math.max(v, n.tick + n.durationTicks),
    0,
  );
  const result: Measure[] = [];
  let tick = 0;
  while (tick < end && result.length < 20000) {
    const meter = meters.findLast((m) => m.tick <= tick) ?? meters[0];
    const next = meters.find((m) => m.tick > tick)?.tick ?? Infinity;
    const endTick = Math.min(
      end,
      next,
      tick + (song.ppq * meter.numerator * 4) / meter.denominator,
    );
    if (endTick <= tick) break;
    result.push({
      number: result.length + 1,
      start: map.seconds(tick),
      end: map.seconds(endTick),
      tick,
      endTick,
    });
    tick = endTick;
  }
  return result;
}
export function createLoop(
  song: Song,
  name: string,
  start: number,
  end: number,
): SavedLoop {
  if (!name.trim() || name.trim().length > 80)
    throw Error("Give the loop a name (1–80 characters).");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > song.duration + 0.001 ||
    end - start < 0.1
  )
    throw Error("Place B after A, with at least 0.1 seconds between them.");
  return {
    id: crypto.randomUUID(),
    songId: song.id,
    name: name.trim(),
    start,
    end: Math.min(end, song.duration),
    created: new Date().toISOString(),
  };
}
export function validLoops(value: unknown, song: Song): SavedLoop[] {
  return Array.isArray(value)
    ? value.filter(
        (v: SavedLoop) =>
          v &&
          typeof v.id === "string" &&
          v.songId === song.id &&
          typeof v.name === "string" &&
          v.name.length > 0 &&
          v.name.length <= 80 &&
          Number.isFinite(v.start) &&
          Number.isFinite(v.end) &&
          v.start >= 0 &&
          v.end > v.start &&
          v.end <= song.duration,
      )
    : [];
}
