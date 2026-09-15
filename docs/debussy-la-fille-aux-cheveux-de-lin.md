# La fille aux cheveux de lin

Prepared piece: `debussy-la-fille-aux-cheveux-de-lin`.

- 39 bars in 3/4, G-flat major; 584 playable notes on two written-staff tracks.
- Primary score: `/pieces/debussy-la-fille-aux-cheveux-de-lin.pdf` (clean three-page vector export).
- Study reference: `/pieces/debussy-la-fille-aux-cheveux-de-lin-annotated-imslp.pdf` (annotated scan).
- MIDI source: TuneOnMusic; `-source.mid` is preserved and the primary MIDI is a deterministic playable derivative with four zero-duration placeholders removed.
- Score alignment is bar-level from ten reviewed system crops; it does not claim optical note-glyph recognition.

Rebuild with:

```sh
./node_modules/.bin/tsx scripts/debussy-la-fille-prepare.ts
./node_modules/.bin/tsx scripts/debussy-la-fille-plan.ts
python3 scripts/prepare-score.py render \\
  public/pieces/debussy-la-fille-aux-cheveux-de-lin.pdf \\
  scripts/scores/debussy-la-fille-aux-cheveux-de-lin.cuts.json \\
  --output public/scores/debussy-la-fille-aux-cheveux-de-lin --scale 3
./node_modules/.bin/tsx scripts/align-score.ts \\
  src/core/debussy-la-fille-aux-cheveux-de-lin.json \\
  public/scores/debussy-la-fille-aux-cheveux-de-lin/geometry.json \\
  /pieces/debussy-la-fille-aux-cheveux-de-lin.pdf
```
