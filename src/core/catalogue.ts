import data from "./pathetique.json";
import type { Song } from "./model";
const { originalBytes, ...song } = data;
export const pathetique: Song = {
  ...song,
  original: new Uint8Array(originalBytes).buffer,
} as Song;
export const initialPieces = [pathetique];
