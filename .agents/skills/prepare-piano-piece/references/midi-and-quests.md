# MIDI and quest authoring

## Establish the exact piece

`src/core/model.ts` defines normalized `Song`; `src/core/import.ts` exports `parseMidi`. The CLI inspector accepts raw `.mid`/`.midi` or a **normalized Song JSON**, not the app's simplified lesson JSON format:

```sh
rtk proxy pnpm exec tsx scripts/inspect-piece.ts src/core/pathetique.json
rtk proxy pnpm exec tsx scripts/inspect-piece.ts src/core/pathetique.json public/plans/pathetique-ii.md
```

It reports the fingerprint, tracks, meters/tempos and per-bar source seconds/ticks, melody/RH harmony/LH attack counts, and notes held across each start. Its optional second argument validates a finished quest Markdown file through the real app parser. Redirect stdout to a local report if useful.

The app’s ordinary JSON file picker accepts the simplified legacy format, not normalized Song JSON. Bundle normalized data through `catalogue.ts`, or import a prepared MIDI whose track names/parts reproduce the same fingerprint. Do not tell users to load an internal normalized JSON through that picker.

For a new raw MIDI, call `parseMidi` on the exact file bytes. Persist the `Song` fields and original bytes separately (the bundled JSON convention is `originalBytes: number[]`; the in-memory model uses `original: ArrayBuffer`). Review named tracks, crossovers and polyphonic voices before freezing the piece. Do not serialize an ArrayBuffer as `{}` and claim the original is retained. Preserve PPQ, tempo changes, meters, note onset/duration/velocity and distinct unisons. Inspect events outside the selected piano range and non-piano parts rather than silently dropping them.

MIDI generally does not identify melody. Prefer source voice labels or a matching MusicXML/LilyPond score. For Pathétique, the original `up:VA` track contains both melody and RH harmony, including RH notes below C4. The source voices `topmain`, `topsecondary`, `bottom` were rendered separately and matched to original events by onset, pitch and hand. **Original** duration/velocity were retained: a newer LilyPond renderer changed articulation. `tests/piece-practice.test.ts` checks original event multiset equality. Only label `roleSource: "score"` after verifying the voice assignment; otherwise keep `"suggested"` and explain uncertainty.

`measures(song)` starts bar 1 at tick zero and follows meter changes to the final note end. It does not infer a pickup from empty space or expand printed repeats. For an anacrusis or a different repeat order, explicitly reconcile the MIDI measure numbering with the score before using the ordinary generator. Do not shift a PDF visually until it merely looks plausible. If the current measure model cannot represent the edition, extend it with tests or choose a matching, explicitly unfolded score.

The fingerprint from `songFingerprint` covers PPQ, tempo/meter arrays, note ticks/durations/pitches and hand/role assignments. Titles and IDs can change. Recompute the plan and score manifests after correcting parts or timing.

## Choose intervals a person can practice

Use the inspector's counts and held-across-start lists alongside the score. Start with one or two bars; shorten dense runs or awkward transitions and join a bar containing only sustained notes to its preceding attack. An isolated held note is not a new attack quest. Do not automatically split every two bars and claim those are musical phrases.

Pathétique's route uses 43 short passages, 129 hand quests and 32 cumulative reviews (161 total), mostly two-bar cuts; busy bars 21–22, 42–44, 48–50, 67 and 69 are isolated. Bars 27–28 stay together because the melody is tied over and bar 28 has no melody/LH attacks. These are reviewed practice cuts for this edition.

The bundled route uses right hand, left hand, then both hands, always with all notes for the selected hands. Melody-only stages were explicitly removed by the user; offer those only for a future request that asks for melody isolation. For each passage, choose stages with nonempty `questTargets(song, quest)`:

| Goal | hand | focus |
| --- | --- | --- |
| Melody | right (or the actual melody hand) | melody |
| Left-hand foundation | left | all |
| Inner RH harmonies | right | harmony |
| Complete right hand | right | all |
| Together | both | all |

Avoid mechanically adding every stage to every interval; the user wants progress on the piece, not a separate exercise library. Wait mode checks pitch/chord collection. Rhythm mode also checks timing. Neither grades phrasing, fingering, pedal artistry or note lengths. State what a successful run actually measures.

## Author the Markdown

Use `scripts/pathetique-plan.ts` as an executable authoring example; change the song import, section boundaries, short-bar list, stages, output path, title and ID for a new piece. For a simple plan, write a small TS script importing `PracticePlan`, `songFingerprint`, `questTargets`, `readPracticePlan` from `src/core/quests.ts` and `measures` from `src/core/loops.ts`.

Set `version: 1`, unique plan `id`, `title`, `song: { title, fingerprint }`, `repetitions` (1–100), `counting` (`total` or `consecutive`), and `quests` in unlock order (1–300). Every quest needs unique `id`, `title`, `section`, `instruction`, inclusive `fromBar`/`throughBar`, `hand`, `focus`, `mode` (`wait`/`rhythm`), and `speed` (0.25–1.5).

Generate a concise explanation and a table of bars, source-time bounds and note counts, then exactly one fenced `cadance-plan` block containing `JSON.stringify(plan, null, 2)`. See [the app schema](../../../../docs/practice-plans.md) and the bundled real file. Use `readPracticePlan(markdown, song)` before writing or validate the output with the inspector. Never substitute a placeholder fingerprint in a delivered file.

Default to ten completed total runs for new passages and five for cumulative/full-section reviews. A quest can override the plan default with `repetitions` (integer 1–100); set review quests to `repetitions: 5`. In this workflow, failed runs retain earned repetitions; a consecutive plan requires a streak. The runner repeats the active quest after a completed attempt, adds preparation, and automatically starts the next quest at the goal with a brief header toast. Listening, skipped passages, incomplete attempts or altered hand/mode settings do not earn progress. Machine-data changes create a distinct progress record; prose-only changes do not. Do not modify stored progress to make a new plan appear completed.

A completed run must play every required note and finish the passage. Extra wrong notes and chord retries do not cancel credit. Speed changes remain eligible, persist across reloads, and carry into the next checkpoint.

Include cumulative both-hand reviews after each additional short passage within a larger musical section: after 3–4, review 1–4; after 5–6, review 1–6. Reset at section boundaries and cap the larger section at ten bars, preferring musically sensible shorter boundaries. Do not duplicate the first passage as a review. Label build-up and full-section reviews clearly. The user may click the completed-run counter and confirm Mark complete & next; record a manual completion separately from played runs. Preserve existing passage results when inserting reviews; new reviews start unfinished.
