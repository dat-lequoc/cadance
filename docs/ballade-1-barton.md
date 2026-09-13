# Chopin · Ballade No. 1 (Paul Barton Edition)

Generated preparation record. Edit this file only for brief human notes; regenerate it after changing the source data, plan, MIDI, PDF, or score cuts.

## Prepared assets

- MIDI: `public/pieces/chopin-ballade-1-barton.mid` (5,013 notes, 264 MIDI measures)
- Primary score: `public/pieces/chopin-ballade-1-barton.pdf` (22 pages, 89 reviewed systems)
- Reference score: `/pieces/chopin-ballade-1-mutopia.pdf`
- Practice plan: `public/plans/ballade-1-barton.md` (595 quests, all unlocked)
- Fingerprint: `826ecb3b517849a3e6071caeb6dab14054f5e767f6efd2d5622efeeaee925db4`

## Alignment note

The player follows the MIDI's 264 measure timeline and the measured system geometry of Barton's scan. The handwritten score uses historical printed-bar labels; the final heading reads “bars 249–262 (end)”. The cadenza and final runs are therefore mapped by MIDI onset and system, not treated as 264 printed bars. Following is bar-level; handwritten redistributions are preserved visually but are not separately transcribed into MIDI hand targets.

## Reproduce

```sh
pnpm exec tsx scripts/ballade-barton-prepare.ts
pnpm exec tsx scripts/ballade-barton-plan.ts
python scripts/ballade-barton-cuts.py
python scripts/prepare-score.py render public/pieces/chopin-ballade-1-barton.pdf scripts/scores/ballade-1-barton.cuts.json --output public/scores/ballade-1-barton
pnpm exec tsx scripts/align-score.ts src/core/ballade-1-barton.json public/scores/ballade-1-barton/geometry.json /pieces/chopin-ballade-1-barton.pdf
pnpm exec tsx scripts/ballade-barton-report.ts
```

## Asset hashes

| Asset | SHA-256 |
| --- | --- |
| Barton PDF | `c08b514b3532189f5e2d9f053009c1064c2a768ceab721926979b65830347415` |
| Barton MIDI | `892cbb1866c24d5e2462ca01b54a79936237c52ef0adbd535b313fd83922c22b` |
| Score cuts PDF source | `c08b514b3532189f5e2d9f053009c1064c2a768ceab721926979b65830347415` |
