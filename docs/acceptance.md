# Current redesign and quest verification

Verified on 2026-09-07 with macOS arm64 / Apple M5, Node 26.0.0, pnpm 11.5.3 and headless Playwright Chromium. Node 24 remains the `.nvmrc` target; it was not independently exercised in this session.

## Automated results

| Check | Result |
| --- | --- |
| TypeScript and production build | Pass; existing large-bundle advisory for bundled piece data and lazy VexFlow |
| Unit suite | 54 tests across 5 files |
| Browser suite | 33 tests across 7 files |
| MIDI stress benchmark | 10,000 notes parsed in 24.83ms; 10,000 indexed culling queries in 11.66ms; maximum 163 visible notes in sampled windows |
| Desktop player geometry | 79.4% stage at 1366×768; 82.4% at 1440×900; no page scrolling |

Benchmark timings are one local CPU run alongside verification, not guarantees of GPU rendering or hardware latency.

Body, muted, primary-button, stage-label and transport text contrast was calculated at 13.21:1, 5.32:1, 8.01:1, 12.56:1 and 12.35:1 respectively. A 720×450 viewport (the CSS viewport equivalent of 200% zoom at 1440×900) retained all player controls without page overflow; actual browser zoom and complete assistive-technology coverage remain manual checks.

## Coverage

- MIDI/JSON import, worker validation, malformed rejection, native permission errors and no-device state.
- Fake hardware connection, middle-C monitor, disconnect pause and pending-start continuation.
- Wait-for-notes wrong-note blocking and chord collection, genuine history after reload, retained review.
- Exact preservation of all 1,629 Pathétique source notes, score-defined hand/role selection, 73-bar mapping and scheduled listening audio.
- A/B marking, optional naming, loop activation before saving, rename/delete/reopen, per-piece persistence and restart/seek behavior.
- Pointer-drag and keyboard edits of loop handles, draft boundaries independent of active loops and explicit application.
- Loop repetitions remain in the player; natural listening completion has no fabricated score.
- Panel pause/resume and setup transitions preserve unchanged attempts; changed scoring selections retain the previous attempt once.
- Listen opens the shared player from setup or the library, with sheet/roll views, pause/resume/seek and loops; it never automatically enters browser fullscreen or asks for MIDI input.
- Fullscreen entry, exit with playback continuity, and nonfatal rejected-fullscreen fallback.
- Tab/window changes retain musical progress and schedule audio; background lookahead remains bounded by practice gates.
- White/black pointer keys after resize, playback colors, sustained-key coloring, release/blur cleanup and persisted display preferences.
- Library search/rename, dialog focus trap/restore, mobile overflow and large MIDI playback.
- Free-play recording, backup/import/deletion, notation, actual-performance MIDI export and local-only requests.
- Failed session storage stays retryable and does not create duplicate results after retry.
- Bundled Markdown plan covers all 73 bars in 43 passages / 129 hand quests plus 32 cumulative reviews, with MIDI fingerprint validation and preserved tied-note passage boundaries.
- Ten clean simulated-input runs unlock the next quest; failures retain total successes, reload retains progress, and listening earns no credit.
- Consecutive counting, invalid ranges/parts, altered plan identity, incomplete attempts and duplicate result rejection are covered by unit tests.
- Quest attempt and progress writes are atomic; injected storage failure rolls back, retry earns one credit and History updates immediately.
- Production offline reload/import/playback through the service worker.

Screenshots generated in `test-results/`: `piece-desktop.png`, `piece-mobile.png`, `player-desktop.png`, `player-mobile.png`, `player-tablet.png`, `library-desktop.png`, `history-desktop.png`, and `settings-desktop.png`.

Quest screenshots: `quest-setup.png`, `quest-complete.png` and `quest-shared-player.png`. Shared-header checkpoint selection, full-piece range highlighting, mouse-wheel seeking and speed changes are verified in the browser. See [practice plans](practice-plans.md) for the editable format and the limits of clean-run grading.

## Practical limits

Physical piano, audible human listening, drivers, real pedal behavior, OS-level suspension, native tablet hardware and the complete browser/OS matrix remain manual checks. Automated scheduling and fake MIDI are not evidence of a real-instrument test. Fullscreen support varies by browser; the viewport-filling player remains available without it.

The original MIDI/engine fixture helpers remain for development, but no exercise catalogue appears in the app. Remaining product gaps are documented in [limitations](limitations.md); redesign behavior and compatibility are documented in [redesign](redesign.md).

Preparation verification: default two-second starts and repeats, pause/resume of the countdown, ignored positioning input, immediate Listen, configurable lead-in, disconnect feedback, and falling-roll A/B section markers. `preparation-section.png` captures the shared player during a paused lead-in.

Practice-polish verification: exact-position resume preparation, shared keyboard/pointer transport and preview, saved sound/count-in/offset preferences through immediate reload and backup restore, canceled delayed audio starts, one software voice per held MIDI note, and real service-worker update consent with a failed-save retry all pass. The fast-refresh preference scenario also passed five consecutive runs. See [practice polish](practice-polish.md); physical-instrument verification remains pending.

## Prepared score checks

- All 73 MIDI measures match reviewed score regions across 22 systems; PNG dimensions and original PDF hash are verified. Wrong fingerprints, missing coverage and out-of-image bounds are rejected.
- Exact boundaries and tempo changes use source ticks; negative lead-in and the final tail clamp correctly.
- Browser checks cover a later quest during lead-in/wait/resume/restart, a sped-up one-bar loop, roll preview without seeking, score browsing/panning without stopping Listen, saved visibility/zoom, and offline image loading.
- All generated crops were visually reviewed, including initial tempo text, dense passages and final fermata. This is bar-level alignment, not note-level score tracking.
