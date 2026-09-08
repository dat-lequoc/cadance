import minuteData from "./minute-waltz.json";
import data from "./pathetique.json";
import type { Song } from "./model";
const { originalBytes, ...song } = data;
export const pathetique: Song = {
  ...song,
  original: new Uint8Array(originalBytes).buffer,
} as Song;
const { originalBytes: minuteBytes, ...minuteSong } = minuteData;
export const minuteWaltz = { ...minuteSong, original: new Uint8Array(minuteBytes).buffer } as Song;
export const initialPieces = [pathetique, minuteWaltz];
