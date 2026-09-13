import { describe, expect, it } from "vitest";
import { initialPieces } from "../src/core/catalogue";
import { pieceNoteFor } from "../src/core/piece-notes";

describe("piece teaching notes", () => {
  it("resolves notes for every prepared score edition", () => {
    for (const song of initialPieces) expect(pieceNoteFor(song), song.id).not.toBeNull();
  });

  it("keeps the Pathétique movement's key distinct from the sonata title", () => {
    const song = initialPieces.find((item) => item.id === "beethoven-pathetique-ii")!;
    expect(pieceNoteFor(song)?.key).toBe("A♭ major");
    expect(pieceNoteFor(song)?.explanation).toContain("C minor");
  });

  it("does not guess a note for an unknown upload", () => {
    const song = { ...initialPieces[0], id: "unknown-piece", scoreUrl: undefined, original: undefined };
    expect(pieceNoteFor(song)).toBeNull();
  });
});
