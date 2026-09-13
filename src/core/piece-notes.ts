import type { Song } from "./model";
import { preparedEditionFor } from "./catalogue";

export interface PieceNote {
  pieceIds: string[];
  key: string;
  explanation: string;
  listenFor: string;
}

const files = import.meta.glob<PieceNote>("./piece-notes/*.json", {
  eager: true,
  import: "default",
});

const notes = Object.values(files);

/** Resolve a short, hand-written teaching note without changing a song manifest. */
export function pieceNoteFor(song: Song): PieceNote | null {
  const prepared = preparedEditionFor(song)?.song;
  const ids = new Set([song.id, prepared?.id].filter((id): id is string => Boolean(id)));
  return notes.find((note) => note.pieceIds.some((id) => ids.has(id))) ?? null;
}
