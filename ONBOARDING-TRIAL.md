# Fresh-clone Minute Waltz onboarding trial

Worked only in `/tmp/cadance-onboarding-minute-waltz`, a public repository clone. Did not consult the original checkout or reuse its prepared assets, node_modules or Python environment. No push or deployment. Preview/test port: **4187**.

## Prerequisites and actual commands

- Host Node 26.0.0 (README recommends 24; package engine accepts >=24), pnpm 11.5.3, Python 3.14, LilyPond 2.26.0, curl/unzip, rtk. Existing binaries were allowed. Package managers reused their ordinary download caches; environments and node_modules were installed into this clone.
- `rtk proxy pnpm install --frozen-lockfile --ignore-scripts`
- `rtk proxy python3 -m venv .venv-score`
- `rtk proxy .venv-score/bin/pip --isolated install --no-user -r scripts/score-requirements.txt`
- Downloaded three original Mutopia assets with `rtk proxy curl -fL URL -o PATH`; extracted the source with unzip. Exact source URLs and regeneration commands: `docs/minute-waltz.md`.
- `rtk proxy pnpm exec playwright install chromium`
- `rtk proxy pnpm build`, `rtk proxy pnpm test`, `rtk proxy pnpm test:e2e` (config changed to 4187).

## Documentation gaps and inferred workarounds

1. README setup assumes Node/pnpm already installed; gives no fresh-host installation/bootstrap instructions. Host had compatible Node 26 rather than recommended 24; this trial does not establish Node 24 compatibility.
2. Repo-local preparation skill is discoverable from README and contains useful detailed commands. Its relative documentation links resolve correctly. Delivery reference includes an absolute `/Users/nightfury/.codex/.../quick_validate.py` command unavailable on an ordinary PC; not used.
3. Skill correctly warns about repeats but gives no executable unfold example. Original legacy LilyPond `applyMusic #unfold-repeats` fails with 2.26 (wrong argument count); replaced with modern `unfoldRepeats`, then applied it to layout as well.
4. Crop proposal counts close double/repeat barlines as measures. Original proposal yielded 128 vs 125 printed bars; unfolded proposal 141 vs 140. Visual review resolved it. Crop padding can include clipped pedal marks from the previous system or clipped page numbers; manual edits were required.
5. Named MIDI staff tracks are not reliable hand voices in cross-staff notation. A second source render with staff changes disabled matched all events and corrected 17 hands without replacing original performance timing.
6. Catalogue registration alone is insufficient: startup only inserted Pathétique. Added per-piece insertion markers, preserving existing song edits, saved selection, preferences/progress, and later explicit deletion.
7. Playwright hardcodes 4173 with reuseExistingServer, which could silently test an unrelated checkout. Changed this trial to 4187.
8. Bundled-plan fallback is Pathétique-specific; extended it for the new ID without reusing its migration signatures. Melody/harmony remains explicitly suggested rather than pretending hand verification validates melody.

## Evidence and limitations

See final validation entries below. No physical piano/audio listening, public hosting or full ornament performance verification. Bar following only; printed source ornaments are not all rendered by original MIDI. No arbitrary PDF import or normalized-JSON file-picker support is implied.

### Final validation

- Production build passes; 71/71 unit tests pass, including exact original note-event multiset preservation, verified LH count, 140 score bars, 252 quests, review bounds and image existence.
- First full browser regression: 47/49 passed. Two failures were test assumptions: external-request test hardcoded 4173, library rename expected one options menu. Updated both; targeted reruns passed. Did not rerun the entire three-minute suite after these test-only fixes.
- Three final Minute Waltz browser tests pass against the final built app on 4187: library/start quest; paced simulated keyboard plays all 11 opening RH attacks and earns **1/10** completed runs; combined score → sheet-only; pause/restart; reload/selection; offline final-image fetch; returning pre-existing workspace gets newly bundled piece while retaining Pathétique selection; half-speed A/B loop on bar 140 stays aligned through repeat and final system appears in sheet-only.
- Initial automated key sequence was too fast for source-time progression and failed to earn credit; pacing attacks at 500 ms passed. No engine changes were made for that test.
- Existing regression coverage passes for quest auto-continuation/manual completion, preparation, wrong notes, preview, zoom, backup, and persistence using Pathétique/test fixtures. **Minute Waltz-specific ten-run quest clearing, later locked-quest navigation, full-route playthrough, backup restoration and note-level anchors were not tested.** Final-section navigation was tested through its actual bar-140 loop, not a later quest.
- Reviewed all 25 crop systems in contact sheets and first/final systems at full reading resolution. Corrected page-one overlap fragments, retained complete page numbers on page starts. Bar manifest validated against the original MIDI tempo map. No note anchors claimed.
- `git diff --check` clean. Build warns about large JS chunks; no new build error. Assets and per-piece docs remain local; original repository untouched.
- Screenshots: `test-results/minute-waltz-sheet-only.png`, `test-results/minute-waltz-final-loop.png` (ignored local validation artifacts). Preview can be started with `rtk proxy pnpm preview --port 4187`.
