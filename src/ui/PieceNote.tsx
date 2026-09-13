import type { PieceNote as PieceNoteData } from "../core/piece-notes";

export default function PieceNote({ note, id }: { note: PieceNoteData; id: string }) {
  return (
    <aside id={id} className="piece-note" aria-label="Piece note">
      <div className="piece-note-content">
        <p className="piece-note-heading">Piece note</p>
        <p className="piece-note-key">{note.key}</p>
        <p>{note.explanation}</p>
        <p className="piece-note-listen"><span>Listen for</span>{note.listenFor}</p>
      </div>
    </aside>
  );
}
