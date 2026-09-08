# Minute Waltz fresh-clone trial

On 2026-09-08, a Codex agent with no inherited conversation history was asked to understand a clean public clone of Cadance and add Chopin’s Minute Waltz, Op. 64 No. 1. It discovered the repository skill itself. It did not read the original checkout or reuse its prepared assets, node_modules or Python environment. Existing host binaries and package download caches were available: this was a fresh-checkout test, not a clean operating-system test.

## Result

The agent delivered the playable piece on local branch `trial/minute-waltz`, commit `dbbd97b134a03465f3f1360cbc18061e34020a48`. The trial branch was subsequently merged into main with all source/prepared assets for fresh-clone use. The observations below describe the original isolated trial. The running trial checkout is `/tmp/cadance-onboarding-minute-waltz`, preview `http://127.0.0.1:4187`. Open Pieces → Practice Chopin · Minute Waltz → Start first quest. The normal app remains on port 4173.

The piece includes the original 1,370 MIDI attacks, 17 source-verified hand corrections, 140 unfolded bars, 25 reviewed score systems and 252 hand/review quests. Sources, scripts and assets are committed on the trial branch. Its `docs/minute-waltz.md` records provenance and regeneration; `ONBOARDING-TRIAL.md` records the agent’s detailed observations.

## Evidence

- Original main baseline: all 48 browser tests passed.
- Trial build and all 71 unit tests passed, including original note-event preservation and complete score/quest validation.
- Initial trial browser regression: 47/49 passed. Two tests assumed port 4173 or a single library item; both passed after test-only corrections. The whole suite was not rerun after those corrections.
- Three final Minute Waltz browser tests passed: a paced simulated input performance earned 1/10 runs; combined/sheet-only views, restart, reload and offline final score image worked; an existing library received the new piece while retaining selection; a half-speed bar-140 loop remained aligned.
- The parent agent inspected first/final score screenshots and confirmed the preview returned HTTP 200. It requested precise coverage reporting and corrected one inaccurate claim about relative links. It supplied no piece-preparation implementation guidance.

## Limits

This demonstrates a usable authoring workflow with agent judgment, not fully automatic PDF recognition. The score follows bars only; individual-note anchors are absent. Melody labels remain suggested. The source MIDI does not realize all printed ornaments. Physical piano/audio, a full ten-run Minute Waltz quest, the full route, later locked quests and piece-specific backup restore were not verified. Host Node was 26, while README recommends 24; a clean Node 24/Windows/Linux installation was not tested.

## Documentation improvements

The main-branch repo-local skill now removes the personal validator path, explains the optional RTK wrapper, and records repeat unfolding, modern/legacy engraving compatibility, double-barline and crop review, cross-staff hand verification, and isolated browser-test coverage. The trial code also fixes new catalogue-piece insertion for returning users and registers its plan without reusing Pathétique migration signatures. Those runtime changes are now included in main.

The workflow is sufficient for a capable fresh agent to deliver a second piece. Fresh-host prerequisite bootstrap, general score recognition and full piece-specific performance verification remain outside what this trial proves.
