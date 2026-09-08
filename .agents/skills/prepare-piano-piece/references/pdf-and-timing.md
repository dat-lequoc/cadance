# PDF preparation and timing

## Tools and reproducible worked example

Browser playback uses prepared PNGs and a JSON manifest; it needs no PDF renderer or server. Python/PyMuPDF is a **preparation-only** dependency. Use a temporary environment so the repo stays clean:

```sh
rtk proxy python3 -m venv /tmp/cadance-score-tools
rtk proxy /tmp/cadance-score-tools/bin/pip --isolated install --no-user -r scripts/score-requirements.txt
```

For the already reviewed Pathétique cuts, regenerate without overwriting the original PDF:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/prepare-score.py render public/pieces/pathetique-2.pdf scripts/scores/pathetique-ii.cuts.json --output public/scores/pathetique-ii
rtk proxy pnpm score:pathetique
```

For a new vector grand-staff score:

```sh
rtk proxy /tmp/cadance-score-tools/bin/python scripts/prepare-score.py propose public/pieces/PIECE.pdf scripts/scores/PIECE.cuts.json
```

The proposal detects evenly spaced five-line staves, pairs upper/lower staves and finds barlines present on both staves. It refuses to replace an existing cuts file. This is a starting point for vector piano scores, not general optical music recognition. A scan, unusual layout, ossia staff or hidden barline may need a manually authored cuts file. Even a plausible total count can conceal two compensating detection errors.

## Review coordinates and make the cuts

Cuts JSON:

- `version: 1`, `reviewed: false` initially, `pdfSha256` of the original bytes, `expectedBars`.
- `systems`: ordered objects with one-based PDF `page`, inclusive MIDI `fromBar` and `throughBar`, `crop: [x0, y0, x1, y1]`, and `barEdges: [x0, ... , xN]` containing one more edge than bars.
- Coordinates are PDF points, top-left origin, **not pixels**. Use the PDF page's coordinate space; normalize rotated pages deliberately before measuring and retain the original too.

Render and inspect every source page. For each system, check the printed start-bar number, the number of enclosed measures and where the staves begin. Keep the entire grand staff and the left-side clef/signature context, not independent measure fragments that lose accidentals or continuing slurs. Include high ledger lines, ornaments, fingering above notes and ties/pedal marks below. Crop away page numbers, title blocks and large margins; retain the initial tempo marking and full attribution in the original linked PDF. Do not cut through text merely to make the strip shorter.

Pathétique required two edits to the automatic padding: the first crop starts at y=73 to retain the full tempo/composer text; the page-1 final crop stops at y=808 to exclude its footer. The last crop stops at y=768, retaining the final fermata while excluding the publication box. These are PDF-specific corrections.

After inspecting proposed coordinates, set `reviewed: true` and render. Inspect **every resulting PNG** in contact sheets, and open dense/final systems at reading resolution. Adjust the reviewed cuts and rerender when anything is clipped. `reviewed` is an author assertion, not an automated quality score. Render rejects a changed PDF hash, gaps/overlaps in measure coverage, invalid rectangles or invalid edge counts/order.

Output in `public/scores/PIECE/`:

- `system-01.png` etc at default 3 pixels/point (216 DPI).
- `systems.pdf`: one cropped system per page, retaining vector score content for inspection/export.
- `geometry.json`: image dimensions, page/bar ranges, normalized horizontal bar edges, PDF hash, renderer version and scale.

The script accounts for raster clip rounding when converting PDF x coordinates to normalized image positions. Avoid manually dividing by a guessed screen width. Increasing resolution changes pixels, not the alignment coordinates or MIDI timing.

## Bind geometry to the MIDI

```sh
rtk proxy pnpm exec tsx scripts/align-score.ts NORMALIZED_SONG.json public/scores/PIECE/geometry.json /pieces/PIECE.pdf
```

The generator writes `score.json`. Each bar records `number`, `tick`, `endTick`, zero-based `system`, normalized `left` and `right`. It requires all MIDI measures exactly once and compares geometry coverage with `measures(song)`; inspect disagreements instead of forcing `expectedBars`. This v1 preparation path assumes an unfolded, one-to-one bar sequence. Printed repeats/pickups that disagree with MIDI need a matching unfolded edition or a tested model extension, not invented timestamps.

Import the generated manifest in `src/core/scores.ts` and add it to `preparedScores`. The runtime selects it by full musical fingerprint and validates every interval. It converts the engine's source seconds through `TempoMap.ticks`; playback speed is already included in engine position, so do not apply speed a second time. Bar intervals are start-inclusive/end-exclusive. Lead-in holds the starting bar; pause/wait holds the playhead; resume preserves the exact position; loops/quests jump to their current start. Falling-note preview supplies a separate display position without seeking the attempt.

Engraved spacing is nonlinear: a whole-bar highlight is accurate at bar precision; a sweeping line across equal width would imply unverified note timing. For note/beat highlighting, prepare and review explicit note/beat x anchors from engraving data, then extend the manifest and tests. Do not claim that ordinary PDF barlines provide that information.

Keep the original PDF URL, source/license and hash in the delivered piece notes. Crops remain in the original key and show both staves even when practice filters or transpose change; the UI must communicate this rather than imply the PDF was re-engraved.

## Optional note anchors and sheet-only practice

The player supports **Sheet music → Sheet only**: a scrollable white score replaces the roll/keyboard while retaining the normal practice engine, quests, preparation and transport. Sheet + notes remains available. The selected view persists.

For this Emmentaler vector PDF, run after bar alignment:

```sh
rtk proxy /tmp/cadance-score-tools/bin/pip --isolated install --no-user -r scripts/score-requirements.txt
rtk proxy /tmp/cadance-score-tools/bin/python scripts/align-score-notes.py public/pieces/pathetique-2.pdf scripts/scores/pathetique-ii.cuts.json src/core/pathetique.json public/scores/pathetique-ii/score.json
```

The extractor uses PyMuPDF glyph IDs/origins and embedded CFF glyph names, identifies noteheads and G/F clefs (including changes), then groups notehead x positions within each reviewed bar. Only bars with matching MIDI onset counts and unambiguous staff-position candidates for every MIDI pitch receive anchors. Staff positions accept chromatic alterations of one semitone; this is a pitch/order cross-check, not full accidental, rhythm, tie or optical recognition. It currently prepares 58/73 bars; the other 15 intentionally retain bar following. Do not label these anchors as universally exact PDF recognition. Scans, different fonts, displaced chord heads, tied continuations and ornaments need another extractor or reviewed overrides.

Each optional `ScoreBar.anchors` item contains exact MIDI `tick`, normalized `x`, and `notes: [{pitch, x, y}]`. Runtime validation requires every onset and pitch in an anchored bar, monotonic x, and in-image coordinates. No time-to-page-width interpolation is used. `note-alignment-report.json` lists every fallback and reason. Always regenerate anchors after regenerating bar alignment; the latter intentionally produces bar-only data.

Visually inspect first chords, later systems and clef changes at reading size. Test partial chords: the status reports held keys while the vertical cursor stays on that onset until the full chord is matched. Expected-note rings are deliberately omitted. Test tempo/speed, wait, lead-in, loop restart, scrolling and a fallback bar. All runtime assets remain local/offline. Documentation for the extraction primitives: [PyMuPDF text traces](https://pymupdf.readthedocs.io/en/latest/functions.html#Page.get_texttrace), [fontTools CFF](https://fonttools.readthedocs.io/en/latest/cffLib/index.html).

Sheet-only browsing now selects a resume point: wheel scrolling selects the note near the pointer, clicking selects an exact printed onset, and arrows select the system start. Test Resume here → Play/P: seek to the note onset with preparation, not the previous playhead or an interpolated midpoint. Back to playhead cancels the selection. Unmatched bars select their bar start. A complete checkpoint restart can retain quest mode; partial passage seeks preserve earned progress but use free practice.

For live mismatch overlays, `align-score-notes.py` also emits optional `ScoreSystem.staves`: normalized diatonic step size and x/y/pitch references for each G/F clef (including mid-system changes). This places unprinted played pitches on the appropriate staff using nearby required notes; accidentals are explicit. Validate staff metadata before registration. Verify wrong notes above/below the expected pitch, multiple held wrong keys, partial correct chords, release with sustain, and bar-only fallback. Unknown geometry/transpose uses a note-name badge instead of a guessed head position.

## Lessons from the Minute Waltz fresh-clone trial

When layout repeats differ from MIDI playback, make a separate unfolded PDF from the permitted engraving source and keep the original PDF unchanged. With modern LilyPond, use `\unfoldRepeats` in the layout expression as well as the MIDI expression. Legacy `\applyMusic #unfold-repeats` may require conversion for the installed renderer. Record the renderer version and the exact printed-to-performed bar sequence, then compare the first repeat return, new section entries and final cadence visually. LilyPond is an additional preparation dependency only when rebuilding engraving; it is not needed to run the app.

Treat close double/repeat barlines as one musical boundary when reviewing proposed cuts. Count agreement is not sufficient: inspect source pages and every crop for stray pedal marks from neighboring systems, clipped page labels, and the final barline. Do not automatically discard thin lines without checking the notation.

MIDI staff-track names can change when a voice crosses staves. Where source voice ownership is available, a separate diagnostic render with staff changes disabled can identify the playing hand. Match every source event by onset and pitch, consume duplicates, retain original duration/velocity, and leave melody assignments suggested unless independently verified. Never replace original performance data merely because a diagnostic render aligns more conveniently.
