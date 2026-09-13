# Reusable preparation toolkit

Run from the repository root. The tools assist visual and musical review; they do not infer trustworthy fingerings, recognize arbitrary notation, fix edition differences, or approve their own results. No paid service, backend, or OMR installation is required for manual scan preparation.

## Set up and inspect

Use an existing preparation environment or create one at a new path. Install the pinned `scripts/score-requirements.txt`; Node/pnpm setup is in the root README.

```sh
rtk proxy python3 -m venv /tmp/cadance-score-tools
rtk proxy /tmp/cadance-score-tools/bin/python -m pip --isolated install --no-user -r scripts/score-requirements.txt
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py doctor
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py inspect public/pieces/TARGET.pdf
rtk proxy pnpm exec tsx scripts/inspect-piece.ts public/pieces/SOURCE.mid
```

`inspect` reports the source hash, page sizes, rotations, image/vector/text counts and PDF annotation-object counts. Zero annotation objects does not mean no handwriting: scans have flattened marks in the image. Vector detection failure is a reason to use manual markup, not change the target PDF. Rotated pages need a separately normalized derivative with provenance before measuring coordinates; the tools reject them rather than guessing coordinate transforms.

To create an editable normalized MIDI draft:

```sh
rtk proxy pnpm exec tsx scripts/prepare-midi.ts public/pieces/SOURCE.mid /tmp/PIECE-draft.json piece-slug 'Composer - Piece'
```

It retains original bytes, timing and events, refuses existing output paths, and leaves assignments suggested. Review and correct hands/voices before copying final normalized data to the discovered `src/core/SLUG.json` location. Use `inspect-piece.ts` again after corrections; regenerate fingerprint-dependent plans and scores.

## Mark systems on the supplied PDF

For supported vector scores, start with `prepare-score.py propose` as described in [PDF cuts and timing](pdf-and-timing.md). For scans, use the offline workbench or write the identical JSON directly from reviewed page coordinates:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py workbench public/pieces/TARGET.pdf --output /tmp/PIECE-workbench
```

Open `/tmp/PIECE-workbench/index.html` locally. It includes rendered page PNGs, an inspection report, a PDF-point cursor, crop/bar-edge tools, JSON editing/import, and download. No server/network is required. Choose two crop corners, then the first/intermediate/final bar edges; enter inclusive MIDI bar indices and add each system in performed order. Preserve the complete grand staff and handwritten material. Export downloads a draft cuts JSON with `reviewed: false`. Download before closing: there is no hidden autosave. Existing workbench directories are never overwritten.

To reopen an existing draft, add `--cuts scripts/scores/PIECE.cuts.json` and choose a new output directory, or use the workbench's file input. Source-hash checks prevent loading another PDF's coordinates. Advanced agents can instead start an empty schema file:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py init public/pieces/TARGET.pdf --bars 123 --output /tmp/PIECE.cuts.json
```

Replace `123` with the verified MIDI measure count. No systems or equal-width edges are fabricated. Keep a printed-to-MIDI correspondence table in the piece notes when printed labels differ. Stop at unexplained mismatches; changing `expectedBars` is not a musical reconciliation.

## Review, approve and align

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py check public/pieces/TARGET.pdf scripts/scores/PIECE.cuts.json
rtk proxy /tmp/cadance-score-tools/bin/python scripts/score-workbench.py review public/pieces/TARGET.pdf scripts/scores/PIECE.cuts.json --output /tmp/PIECE-review
```

`check` verifies hash, finite coordinates, page bounds and continuous bar coverage, even before approval. `review` creates clean system PNGs, labeled full-page PNGs, `review.pdf`, a JSON inventory and an HTML contact sheet. Blue boxes show crops; red lines/`M` labels show MIDI bar boundaries, not independently verified printed bar labels. This PDF is a QA derivative, not newly authored musical advice. Compare clean crops with source-page context and inspect every system, especially marginal handwriting and double barlines. The review tool never changes the input cuts or source PDF, never sets `reviewed: true`, and refuses an existing output directory.

After visual and MIDI correspondence review, explicitly set `reviewed: true` in the cuts file, then:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/prepare-score.py render public/pieces/TARGET.pdf scripts/scores/PIECE.cuts.json --output public/scores/PIECE
rtk proxy pnpm exec tsx scripts/align-score.ts src/core/PIECE.json public/scores/PIECE/geometry.json /pieces/TARGET.pdf
rtk proxy pnpm exec tsx scripts/inspect-piece.ts src/core/PIECE.json public/plans/PIECE.md
```

Rendering regenerates assets in the chosen piece directory; use only that piece's destination. It validates all geometry before writing. For supported vector fonts, optionally run `align-score-notes.py` per the PDF reference. Scans keep verified bar following unless note positions have been independently established and validated using the existing anchor schema. Do not run the vector extractor on a raster score and describe the result as exact recognition.

Use `pathetique-plan.ts` as a plan-authoring example, the real `readPracticePlan`/`validateScore` functions for validation, and the [delivery checks](delivery.md) for automatic discovery, browser input, progress and offline verification. Prepared assets are build-time data; arbitrary frontend MIDI imports are runtime library additions, not an in-browser PDF-preparation service.

## Toolkit regression checks

```sh
rtk proxy /tmp/cadance-score-tools/bin/python -m unittest discover -s scripts -p test_score_tools.py
rtk proxy node scripts/test-score-workbench.mjs /tmp/PIECE-workbench/index.html
rtk proxy pnpm test
rtk proxy pnpm build
```

The browser smoke test needs an initially empty workbench and installed Playwright Chromium. It checks scaled coordinates, JSON export, page switching and source-hash rejection without saving changes to the workbench. It writes a screenshot there for visual review. Python tests use isolated temporary PDFs and test source preservation, unreviewed rejection, invalid geometry, annotation retention and rendered coordinate alignment.
