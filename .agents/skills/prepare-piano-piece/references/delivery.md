# Integrate and check a prepared piece

The player is shared by normal practice, quests and explicitly opened Listen. Sheet music can appear above falling notes or fill the stage via **Sheet only**. Both views use the same engine, quests, preparation, loops and transport. The score stays white. Sheet visibility, view mode, zoom and the default-on Wrong notes toggle are persisted with preferences/backups. Ordinary score panning in the combined view leaves playback running. In sheet-only mode, scrolling/clicking selects a paused Resume here point; Play/P resumes on the selected note onset. Opening Listen alone stays in setup.

Use the current `ScoreStrip.tsx`, `PlayerView.tsx`, `score.ts` and `scores.ts`; do not build a separate quest/score player. The browser cannot import an arbitrary PDF and infer its timing. The optional vector-note extractor supports the bundled Emmentaler PDF; use verified bar following for unsupported fonts/scans rather than claiming universal recognition. Prepared editions are added through the repository workflow; an unmatched MIDI gets no aligned-score toggle action, never a guessed mapping.

## Register the new piece

- Add the prepared `Song` export and entry to `initialPieces` in `src/core/catalogue.ts`. Use a distinct stable song ID, retaining Pathétique and user-imported pieces. Reconstruct `original` from `originalBytes` as the current catalogue does.
- Register its score manifest in `preparedScores` in `src/core/scores.ts`; matching uses the normalized musical fingerprint.
- Register its Markdown plan by song ID in `src/ui/useQuestPlan.ts`. This hook currently has Pathétique-specific fallback/migration branches; extend the default plan lookup to cover the new song without applying Pathétique migration signatures to it. Preserve explicitly imported custom plans and existing progress. Adding a file under `public/plans` alone does not enable it.
- Inspect the existing initial-piece insertion in `usePracticeController.ts`; confirm a returning browser receives the new catalogue piece as well as a fresh browser. Avoid resetting IndexedDB to make registration appear successful.
- Keep reproducible piece-specific preparation scripts/configuration and document direct source/derived asset paths in `docs/SLUG.md`. Original/downloaded MIDI and source-derived hand assignments can have different fingerprints; verify the path actually offered to the user loads the intended prepared version.

## Piece checks

- Verify original vs normalized note-event multisets and reviewed hand/voice counts when changing normalization. Check imported original/parts MIDI behavior and the source PDF's first/last bars and transitions.
- Validate each quest through `readPracticePlan` and each score through `validateScore`. Check all source bars are covered, every image exists and image dimensions match geometry. Test wrong fingerprints, missing bars, tempo changes and exact boundary transitions.
- Read all cropped systems visually. Count agreement alone does not prove a crop is legible or a bar mapping correct.
- Check first bar and final bar, every new system, a dense passage, and any tie across a checkpoint cut. Verify RH → LH → both progression, cumulative review boundaries, automatic continuation, and manual completion through the run counter; wrong notes do not cancel credit when all targets are completed.
- Exercise lead-in, wait-for-notes, pause/resume, restart, speed changes, A/B repeat and a later quest. The highlighted score bar must follow the same source position, not wall-clock elapsed time.
- Scroll the falling notes: Resume here previews without immediately seeking; Play/P starts at the selected note onset with preparation, while Back to playhead cancels it. Test the same flow and direct note selection in sheet-only mode. In the combined view, score-only pan/zoom must leave playback running. Follow returns to the live/preview bar.
- Toggle the sheet-only view, hide the strip, change zoom, reload and restore a backup. Verify the cursor is a vertical line without redundant expected-note rings, and Wrong notes hides/shows red played-note feedback and persists. Check the keyboard and primary transport remain reachable at desktop and smaller sizes. At high zoom, panning may be needed; do not shrink the keyboard away.
- Load the built app once, wait for its service worker, then verify crops work offline. Public assets are picked up by the offline-shell build in `vite.config.ts`; keep image names under the registered public score path. An image failure should offer retry/PDF and leave practice usable.

## Commands

```sh
rtk proxy pnpm exec tsx scripts/inspect-piece.ts src/core/pathetique.json public/plans/pathetique-ii.md
rtk proxy pnpm test
rtk proxy pnpm build
rtk proxy pnpm test:e2e
rtk proxy python3 /Users/nightfury/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/prepare-piano-piece
```

Run targeted checks while developing, then the relevant regression suite after final changes. Existing `tests/score.test.ts` and `e2e/sheet-music.spec.ts` exercise the bundled example. Report physical-piano verification separately from simulated browser input. Do not claim deployment or hardware testing based only on a successful build. Finish with the actual access path, prepared assets/skill location, timing precision and remaining edition-specific limitations.
