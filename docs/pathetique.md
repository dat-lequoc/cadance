# Beethoven — Pathétique, II. Adagio cantabile

The complete second movement of Piano Sonata No. 8, Op. 13 is included as the initial imported piece. Source: [Mutopia edition 295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295), `Mutopia-2011/10/25-295`. Typeset by Chris Sawer, updated by Javier Ruiz-Alma. The source references Berners (1908) and Peters (1910) editions. Both its LilyPond header and RDF metadata declare **Public Domain**.

Preserved source assets in `public/pieces/`:

- `pathetique-2.mid`: unchanged original MIDI.
- `pathetique-2.ly`: unchanged original LilyPond source.
- `pathetique-2.rdf`: unchanged source metadata.
- `pathetique-2.pdf`: full original score.
- `pathetique-2-parts.ly`: version-converted source with its three voices assigned to separate MIDI staffs.
- `pathetique-2-parts.mid`: voice-separated MIDI preserving original event data.

The original file has two hand tracks (`up:VA` and `down:`). The right hand contains both the melody and inner harmonies, including notes below middle C; a pitch threshold would assign these incorrectly.

For accurate part practice, LilyPond 2.26.0 was used once during preparation to render `topmain`, `topsecondary`, and `bottom` into separate MIDI tracks. These source voice assignments were matched back to original events by pitch, onset tick and hand. Original onset, duration and velocity were retained rather than replacing them with the newer LilyPond renderer’s articulation choices.

The resulting piece has 1,629 notes: 331 melody notes, 711 right-hand harmony notes and 587 left-hand bass/accompaniment notes. `tests/piece-practice.test.ts` checks exact equality of sorted pitch/onset/duration/velocity multisets against the original for both the bundled normalized song and the voice-separated MIDI. Unison notes may be deduplicated in practice scoring because one physical attack can play one pitch at a time.

The source meter is 2/4 with 73 bars. MIDI tempo is approximately 36 quarter-note BPM; it is displayed rounded to 36. No automatic speed-up is applied. Playback controls allow slower/faster practice.

LilyPond is **not** an app runtime dependency. The browser uses only the already prepared MIDI/JSON assets, and all of them are included in the offline cache. No PDF transcription service or network conversion is needed.

## Prepared sheet music

The player’s **Sheet music** toggle displays the source score above the falling notes. All five pages were inspected and cut into 22 complete grand-staff systems, preserving ornaments, fingerings, ties and dynamics. The first crop retains the tempo marking; the last retains the final fermata. Every system was checked visually after rendering.

Reviewed PDF-point coordinates and barlines live in `scripts/scores/pathetique-ii.cuts.json`. PyMuPDF 1.28.2 renders at 216 DPI into `public/scores/pathetique-ii/`, including a vector `systems.pdf` with one system per page. `geometry.json` records the source hash and image geometry; `score.json` binds all 73 bar regions to the exact normalized MIDI fingerprint and tempo-map ticks. Original files remain unchanged. Generated score assets total approximately 1.7 MB and are cached for offline playback.

The score follows the current bar during playing, waiting, pause/resume, preparation and repeats; scroll previews show the preview bar without seeking the attempt. Zoom (75–200%), pan and previous/next system controls support reading ahead; **Follow** restores the live or preview bar. The − / + Space controls allocate 20–50% of the window height to the score; falling notes use the remaining space. Fit resets zoom to 100%. Visibility, panel space and zoom persist with practice preferences and backups. The PDF is in the original key; transposing playback shows an explicit notice.

Alignment is accurate to the measure boundary. It does not claim a note-by-note cursor from nonlinear engraved spacing. Other MIDI editions require their own reviewed score mapping. See the repo-local [piece preparation skill](../.agents/skills/prepare-piano-piece/SKILL.md) for the complete MIDI → quests → PDF cuts → timing workflow and reproducible commands.
