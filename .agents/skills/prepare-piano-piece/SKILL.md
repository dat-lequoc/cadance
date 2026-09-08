---
name: prepare-piano-piece
description: Add a piano piece to Cadance from a title, links, or supplied files. Find a matching MIDI and score, verify parts, author quests and cumulative reviews, crop and align sheet music, then integrate and test the playable piece. Also use to revise a piece’s practice plan or score alignment.
---

# Prepare a piano piece

Deliver a playable piece in the existing player, an editable quest Markdown file, reviewed score crops with MIDI alignment, and reproducible preparation instructions. Start from the user’s piece name, source links, or supplied files; obtain missing assets as part of the task. Preserve original files and attribution.

Paths below are relative to the repository root (three levels above this skill). Use the installed project tools; shell commands in this workspace start with `rtk`.

## Workflow

0. **Find the source pair.** If either asset is missing, search for a matching MIDI and sheet PDF, preferably with MusicXML/LilyPond engraving source. Check movement, edition, repeat order and reuse terms before choosing. Follow [finding MIDI and sheet music](references/sources.md). Do not stop at a list of links when the request is to add a playable piece.
1. **Inspect and identify.** Record the edition, source/license, MIDI tracks, PPQ, tempo/meter changes, note counts and bar count. Run `rtk proxy pnpm exec tsx scripts/inspect-piece.ts PATH`. For normalization, hand/voice matching, pickups and repeats, read [MIDI and quests](references/midi-and-quests.md). A middle-C split or highest-note heuristic is a suggestion, not verified score voice data.
2. **Build the practice route.** Choose short, playable intervals from density, ties and musical context. For this repository, use right hand → left hand → both hands with all notes and ten completed runs unless the user specifies otherwise. The user removed melody-only quests; do not reintroduce them into the bundled route. Add cumulative both-hand reviews after each additional short passage (3–4 → 1–4, 5–6 → 1–6), restarting at musical section boundaries capped at ten bars. The app reads one `cadance-plan` JSON fence in Markdown. Validate it against the final normalized piece; do not copy a fingerprint from another edition. See [MIDI and quests](references/midi-and-quests.md).
3. **Prepare the sheet music.** Cut complete grand-staff systems from the PDF, retaining clefs, key/time signatures, dynamics, ties, fingerings and ornaments. Inspect the crops visually; staff/barline detection only proposes coordinates. Read [PDF cuts and alignment](references/pdf-and-timing.md) for the actual tools, formats and worked Pathétique commands.
4. **Align to source time.** Map each printed bar to the correct MIDI measure and its tempo-map ticks. Never divide a page width or a recording duration evenly into notes. The app always follows verified bars and can additionally use conservative, validated note anchors extracted from supported vector PDF glyphs; ambiguous bars retain bar following. See the optional note-anchor workflow in the PDF reference. PDF/MIDI count mismatches require resolving pickups, repeats or edition differences before registration.
5. **Integrate and verify.** Register the prepared score in `src/core/scores.ts`; add a bundled song to `src/core/catalogue.ts` and its plan to `src/ui/useQuestPlan.ts` if bundling is requested. Imported plans already work with matching imported songs. Follow [delivery checks](references/delivery.md), including loops, lead-in, preview, zoom and offline use. Support both the combined player and sheet-only mode; keep quests in the shared player. Preserve the user’s current preferences and earned progress.

## Completion and handoff

A request to “add a piece from A to Z” means acquire, prepare, integrate and verify it locally, not just create a plan. Use musical judgment for routine choices. If no matching source pair can be obtained, report the specific missing asset or edition mismatch and retain the useful work already completed. Do not claim note-level alignment where only bar timing was verified.

Finish with the piece’s actual app access path, source attribution, prepared-file paths, verification results and remaining alignment limitations. Build the app and verify the existing preview if available. Public pushes or publishing follow the user’s authorization for that task; they are not implied by loading this skill.

Example request: “Use $prepare-piano-piece to add [composer, title, movement] to Cadance from A to Z. Find a matching MIDI and sheet, prepare hand quests and cumulative reviews, crop and align the score, and verify both player views.”

## Deliverables

- Original source assets and provenance in `public/pieces/`.
- Normalized piece data with reviewed parts; never silently replace source note timing with a renderer's different articulation.
- Human-readable checkpoint map plus validated `public/plans/PIECE.md`.
- Reviewed `scripts/scores/PIECE.cuts.json`, generated images, cut-system PDF and timing manifest in `public/scores/PIECE/`.
- Piece-specific documentation recording corrections, assumptions, timing precision and validation results.

Pathétique II is the complete worked example: [piece notes](../../../docs/pathetique.md), [quest plan](../../../public/plans/pathetique-ii.md), [reviewed cuts](../../../scripts/scores/pathetique-ii.cuts.json). Its 73 bars and particular checkpoint boundaries are edition-specific, not defaults for another piece.
