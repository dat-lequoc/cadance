# Claude Debussy · Clair de lune

Prepared from the Mutopia Project source pair for Suite bergamasque, No. 3.

- Access: **Pieces → Practice Claude Debussy · Clair de lune (Suite bergamasque, No. 3)**
- Score: `public/pieces/debussy-clair-de-lune.pdf` (4 pages, 20 systems)
- MIDI: `public/pieces/debussy-clair-de-lune.mid` (1,468 notes, 72 measures, 384 PPQ, 9/8)
- Plan: `public/plans/debussy-clair-de-lune.md` (134 unlocked checkpoints)
- Source: [Mutopia Project, Music ID 1778](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778), public-domain typesetting based on E. Fromont (1905).

The primary PDF is used in the player. Score following is bar-level and follows the MIDI timeline. Upper/lower MIDI tracks are the initial right/left practice targets; they are source-track assignments, not a claim that every personal hand redistribution is encoded. The plan keeps passages short and adds section reviews without prerequisites.

Regenerate with:

```sh
pnpm exec tsx scripts/debussy-clair-prepare.ts
pnpm exec tsx scripts/debussy-clair-plan.ts
python scripts/prepare-score.py propose public/pieces/debussy-clair-de-lune.pdf /tmp/debussy-clair.cuts.json
python scripts/debussy-clair-review.py /tmp/debussy-clair.cuts.json public/pieces/debussy-clair-de-lune.pdf scripts/scores/debussy-clair-de-lune.cuts.json
python scripts/prepare-score.py render public/pieces/debussy-clair-de-lune.pdf scripts/scores/debussy-clair-de-lune.cuts.json --output public/scores/debussy-clair-de-lune
pnpm exec tsx scripts/align-score.ts src/core/debussy-clair-de-lune.json public/scores/debussy-clair-de-lune/geometry.json /pieces/debussy-clair-de-lune.pdf
```
