# Chopin · Ballade No. 1, Op. 23

Open **Pieces → Practice Chopin · Ballade No. 1 (Op. 23)**. Choose any of the 596 checkpoints or Listen. Sheet music supports the combined view and Sheet only. The setup page also links the copied Paul Barton study PDF. Existing songs, settings and progress remain intact; returning workspaces receive the new bundle once.

## Sources and edition

- User-supplied source: `Downloads/Chopin Ballade No.1 - hand-notated score by P. Barton.pdf`, copied unchanged to `public/pieces/chopin-ballade-1-barton.pdf` on 2026-09-11. This is a 22-page raster scan of an annotated study score. Its final-section heading says bars 249–262; cadenza divisions and some editorial notes differ from the player edition. It is a reference PDF, not a synchronized score. Paul Barton links his study score from his [Ballade tutorial post](https://www.patreon.com/paulbarton/posts/chopin-ballade-1-15337238). The user supplied the actual bytes; no separate redistribution license is assumed.
- Player source: [Mutopia-2014/07/19-1959](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959), Frédéric Chopin, Première Ballade, Op. 23. Klindworth / Bote & Bock, n.d. [1880], typeset by Javier Ruiz-Alma. The engraving/source and MIDI are CC BY-SA 4.0, distinct from the historical composition's public-domain status. Retrieved 2026-09-11.
- Original [MIDI](https://www.mutopiaproject.org/ftp/ChopinFF/O23/chopin-op23-ballade-1/chopin-op23-ballade-1.mid), [PDF](https://www.mutopiaproject.org/ftp/ChopinFF/O23/chopin-op23-ballade-1/chopin-op23-ballade-1-a4.pdf), and [LilyPond source ZIP](https://www.mutopiaproject.org/ftp/ChopinFF/O23/chopin-op23-ballade-1/chopin-op23-ballade-1-lys.zip) are retained in `public/pieces/`.

The source PDF has ten pages with tightly spaced systems. A separate 17-page player engraving was made from the same source using LilyPond 2.26.0, with more space between systems. The 60 original system groupings and 264 printed measures are retained. The MIDI remains the downloaded performance, not a fresh renderer's performance. Modern LilyPond's `convert-ly` conversion and layout changes affect the derived PDF only. Both source PDFs remain unchanged.

## MIDI and hands

The MIDI contains 5,013 note events at 384 PPQ, 264 bars, and approximately 11:35 at source speed. It begins in 4/4, changes to 6/4 at bar 8, and returns to 4/4 at bar 208. All source tempo changes, original onsets, durations, velocities, track/channel identities and bytes are preserved.

The original tracks are named `upper:` and `lower:`, which the generic importer would split by pitch. A diagnostic source render disables staff changes while retaining voice ownership. Every original onset/pitch is matched to a diagnostic event. This corrects 975 hand labels, including the low opening right-hand C, yielding 2,865 right-hand and 2,148 left-hand attacks. Melody/harmony labels remain suggestions; `roleSource` is not promoted to `score`.

Four source cross-staff unisons are merged in the original renderer but emitted twice by the diagnostic render. Their tick:pitch keys are `148608:65`, `207744:74`, `374784:34`, and `536064:31`. The first two use the upper voice; the last two use the lower voice because the duplicated upper notes are hidden continuation notation. No duplicate attacks are added to the original MIDI. These are explicit source-voice conventions, not a claim that all pianists must use the same fingering/redistribution.

Some printed ornaments are not fully realized by the MIDI. The engraving also contains `printed` versus `played` alternatives, notably around bars 112–114. Use the falling-note targets to see the actual MIDI attacks. Wait mode checks target pitches and passage completion, not articulation, pedal, fingering, duration or musical expression.

## Quests and score following

`public/plans/ballade-1.md` contains the editable route, fingerprint, source-time and attack-count table. It uses right hand → left hand → both hands, ten completed total runs per new passage, and five for cumulative reviews. All quests are available immediately. There are 36 named review groups, each at most ten bars. Dense passages and coda bars are isolated; held transitions and the long cadenzas are joined. Most other passages span two bars. These are practice-sized cuts rather than an assertion of complete phrase boundaries. Starting speed is 60%, or 40% in dense passages and the coda; it is freely adjustable.

The plan-size ceiling was raised from 300 to 1,000 so the complete Ballade can use short passages without truncating the piece. The existing 1 MB import limit remains.

The score is **bar-aligned**, not note-aligned. Every printed system start and bar boundary was compared with the source numbering. Two dashed cadenza boundaries require explicit coordinates: the end of bar 246 at x=552.3 and the start of bar 249 at x=380.39 in the derived PDF. The two strokes of the final barline count as one boundary. The large slur over bars 247–249 requires extra top padding. Four crops retain intact page numbers to preserve high slurs/tempo text at the same height. All 60 crop previews were reviewed, including opening, dense/cross-staff passages and final cadence.

Timing uses exact MIDI measure ticks and the full tempo map. There is no equal-width note interpolation and no guessed alignment to the Barton scan. Bar-only clicking/scroll preview selects bar starts. Original key/notation is retained in PDF images even if practice settings change.

## Reproduce

Use the normal README setup. Python/PyMuPDF and LilyPond are preparation dependencies only. The contact-sheet reviewer also uses Pillow; `python -m pip install pillow` in the preparation environment supplies it.

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/ballade-hand-source.py
rtk proxy convert-ly -e /tmp/cadance-ballade-hands/chopin-op23-ballade-1.ly /tmp/cadance-ballade-hands/chopin-op23-ballade-1-defs.ly
rtk proxy lilypond -dno-print-pages -o /tmp/cadance-ballade-hands/hands /tmp/cadance-ballade-hands/chopin-op23-ballade-1.ly
rtk proxy pnpm exec tsx scripts/ballade-prepare.ts
rtk proxy pnpm exec tsx scripts/ballade-plan.ts
rtk proxy /tmp/cadance-score-tools/bin/python scripts/ballade-layout-source.py
rtk proxy convert-ly -e /tmp/cadance-ballade-layout/chopin-op23-ballade-1.ly /tmp/cadance-ballade-layout/chopin-op23-ballade-1-defs.ly
rtk proxy lilypond -o /tmp/cadance-ballade-layout/score /tmp/cadance-ballade-layout/chopin-op23-ballade-1.ly
```

The committed `chopin-ballade-1-player.pdf` is the resulting `score.pdf`. A fresh render can change PDF metadata/hash; explicitly review and update cuts if replacing it. To rebuild the PNGs and timing from the committed PDF:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/prepare-score.py render public/pieces/chopin-ballade-1-player.pdf scripts/scores/ballade-1.cuts.json --output public/scores/ballade-1
rtk proxy pnpm exec tsx scripts/align-score.ts src/core/ballade-1.json public/scores/ballade-1/geometry.json /pieces/chopin-ballade-1-player.pdf
rtk proxy pnpm exec tsx scripts/inspect-piece.ts src/core/ballade-1.json public/plans/ballade-1.md
rtk proxy pnpm test
rtk proxy pnpm build
rtk proxy env CADANCE_TEST_PORT=4192 pnpm exec playwright test e2e/ballade.spec.ts
```

For a new proposal, `prepare-score.py propose` needs `--min-staff-width .25` because some staff lines are broken into shorter segments. Its default remains unchanged for other scores. Save the proposal as `/tmp/cadance-ballade-review/player-cuts.json`; `ballade-refine-cuts.py` applies the recorded corrections to the cuts file and intentionally leaves it unreviewed. Run `ballade-score-review.py`, review the outputs, and set `reviewed: true` before rendering.

## Original asset hashes (SHA-256)

| Asset | Hash |
| --- | --- |
| Barton PDF | `c08b514b3532189f5e2d9f053009c1064c2a768ceab721926979b65830347415` |
| Mutopia PDF | `0868d41f99abe3943e14767057dfb0443a156f643457f1ad4a236795304d953d` |
| Player PDF | `f1547b45e8cfb71a9cb1cf6fa6b5de31da2bb07065a4d233181e36a697c371ed` |
| Source ZIP | `12ea065f8ff94ca362909d613cda7cd2fc2a253c81babcc005a22caf0447ec8a` |
| Original MIDI | `b8f93fa0fb1c3a61a4ba13fdc287282d8efe3d3ec76b575ac8f186016e55007f` |

Physical-piano and audible musical interpretation have not been verified. Automated checks cover original event preservation, hand counts, all quest/score data, image dimensions, tempo boundaries and simulated browser interaction; see the associated tests for exact coverage.

Validation on 2026-09-11: 76 unit tests and all three Ballade browser tests passed. The existing-piece regression selection passed 20 of 21 tests. `sheet-music.spec.ts`'s scrolling/resume test expects "Get ready" in sheet-only mode, while the pre-existing workspace change in `usePracticeController.ts` deliberately sets preparation to zero in that view. That unrelated behavior/test mismatch was left intact. Production build succeeds with the existing large-bundle warning. The current preview at port 4173 serves the new bundle.
