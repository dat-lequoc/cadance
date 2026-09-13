# Chopin · Minute Waltz, Op. 64 No. 1

Open Pieces → Practice Chopin · Minute Waltz (Op. 64 No. 1) → Start first quest. Sheet music offers both the combined view and Sheet only.

## Sources and edition

Original solo-piano work (1847), Edition Peters, engraved by Magnus Lewis-Smith. Mutopia record 483, revision 2015/01/17, declares the engraving and source public domain: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483 . Retrieved 2026-09-08.

Direct downloads under https://www.mutopiaproject.org/ftp/ChopinFF/O64/chopin_valse_op64_no1/ :
- `chopin_valse_op64_no1.mid` → `public/pieces/minute-waltz.mid`
- `chopin_valse_op64_no1-a4.pdf` → `public/pieces/minute-waltz.pdf`
- `chopin_valse_op64_no1-lys.zip` → `public/pieces/minute-waltz-source.zip` and extracted source directory.

Original downloads remain unchanged. SHA-256 hashes are in `public/pieces/minute-waltz-sha256.txt`. Derived engraving sources are in `scripts/minute-waltz/`. LilyPond 2.26.0 generated the unfolded PDF; replace the original legacy `\applyMusic #unfold-repeats` with `\unfoldRepeats`, and unfold the layout score too. The printed original has 125 bars; MIDI order is printed 1–36, 21–35, 37–125 (140 performed bars). The unfolded PDF prints the performed numbering. Compare the repeated entries at 21/37, sostenuto at 53, rotation return at 89, and final cadence at 140.

## Notes and parts

PPQ 384, 3/4, constant quarter approximately 280 (MIDI integer tempo precision), 1,370 attacks, original note end 89.785415 seconds. Original tracks `rh:` / `lh:` contain 753 / 617 notes. Cross-staff engraving transfers 17 left-hand source notes into the right-staff MIDI track. `hand-check.ly` disables staff-change commands for a source-voice render; the preparation script matches every original onset/pitch to that render and consumes every event. Verified source hand totals are RH 736, LH 634. Original onset, duration and velocity are retained, including distinct unisons. Melody/harmony labels remain suggestions (`roleSource: suggested`), not a claim of verified voice separation.

The source MIDI does not realize all engraved ornaments: the printed trill bridge at performed bars 85–88 is a held MIDI note. Preserve that passage as one checkpoint; do not advertise ornamental technique scoring. The score is not re-engraved when transposing or filtering hands.

## Preparation

All shell commands in this trial used `rtk proxy`.

```sh
rtk proxy lilypond -o public/pieces/minute-waltz-unfolded scripts/minute-waltz/chopin_valse_op64_no1.ly
rtk proxy lilypond -dno-print-pages -o public/pieces/minute-waltz-hands scripts/minute-waltz/hand-check.ly
rtk proxy pnpm exec tsx scripts/minute-waltz-prepare.ts
rtk proxy pnpm exec tsx scripts/minute-waltz-plan.ts
rtk proxy .venv-score/bin/python scripts/prepare-score.py render public/pieces/minute-waltz-unfolded.pdf scripts/scores/minute-waltz-unfolded.cuts.json --output public/scores/minute-waltz
rtk proxy pnpm exec tsx scripts/align-score.ts src/core/minute-waltz.json public/scores/minute-waltz/geometry.json /pieces/minute-waltz-unfolded.pdf
```

The reviewed cuts cover 25 grand-staff systems. Proposal counted the final double barline twice; removed its inner edge. Reviewed every source page and crop contact sheet, retained tempo, slurs, ornaments, cross-staff notation and final flourish. Corrected previous-system pedal fragments in page-one crops. Page labels are intentionally retained in page-opening crops instead of clipping them. Original-score proposal is retained as unreviewed diagnostic evidence; it is not registered.

Alignment is **bar precision only**, from actual MIDI tempo-map ticks and reviewed PDF barlines. No guessed equal-time note sweep or unverified note anchors. The long 24-note coda figure remains across bars 137–139. The generated plan has 10 validated quests: one both-hands checkpoint for each merged musical section, with ten total runs per checkpoint. Edit `scripts/minute-waltz-plan.ts` to merge or split ranges, then regenerate; the script validates the MIDI fingerprint and rejects empty ranges.

The original imported MIDI has different hand assignments/fingerprint and will not automatically acquire this prepared score/plan. Use the bundled piece. A prepared MIDI importer pathway is not supplied; internal normalized JSON is not an app import format.

## Validation

Production build and 71 unit tests pass. Three dedicated browser checks pass: one played opening quest run via simulated keys (1/10), both score views, pause/restart, reload, offline final crop, returning-user insertion without losing selection, and final-bar half-speed loop. Full existing browser regression first passed 47/49; the two failures were old test assumptions (single piece and fixed origin), corrected and rerun successfully. No physical instrument, ten-run Minute Waltz checkpoint clearing, full-route performance or Minute Waltz backup restore was verified. See `ONBOARDING-TRIAL.md` for exact evidence and gaps.
