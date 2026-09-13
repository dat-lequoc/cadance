import type { Song } from "./model";

// New prepared pieces are data files, not application-code registrations.
const files = import.meta.glob<Song & { originalBytes?: number[] }>("./*.json", {
  eager: true, import: "default",
});
export const initialPieces: Song[] = Object.values(files).map(({ originalBytes, ...song }) => ({
  ...song,
  original: originalBytes ? new Uint8Array(originalBytes).buffer : undefined,
}));
// Compatibility for existing fixtures and the initial landing piece only.
export const pathetique = initialPieces.find((song) => song.id === "beethoven-pathetique-ii")!;
export const minuteWaltz = initialPieces.find((song) => song.id === "chopin-minute-waltz")!;
export const ballade = initialPieces.find((song) => song.id === "chopin-ballade-1")!;

/** Resolve an edition using durable library/source identity, never its editable title. */
export function preparedEditionFor(song: Song) {
  const entries = Object.entries(files);
  const found = entries.find(([, data]) => data.id === song.id) ??
    entries.find(([, data]) => song.scoreUrl && data.scoreUrl === song.scoreUrl) ??
    entries.find(([, data]) => {
      if (!song.original || !data.originalBytes || song.original.byteLength !== data.originalBytes.length) return false;
      const bytes = new Uint8Array(song.original);
      return data.originalBytes.every((byte, index) => byte === bytes[index]);
    });
  return found ? { slug: found[0].slice(2, -5), song: found[1] } : null;
}

/** An exact source-file match can safely reuse reviewed hands and score metadata. */
export function recognizePreparedPiece(imported: Song): Song {
  if (!imported.original) return imported;
  const bytes = new Uint8Array(imported.original);
  const prepared = initialPieces.find((song) => {
    if (!song.original || song.original.byteLength !== bytes.length) return false;
    return new Uint8Array(song.original).every((byte, index) => byte === bytes[index]);
  });
  return prepared ? { ...structuredClone(prepared), id: imported.id } : imported;
}
