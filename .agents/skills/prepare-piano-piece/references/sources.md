# Find a matching MIDI and score

Use this when the user supplies only a piece name or one of the required assets. Reuse supplied files and previously accepted editions when they match the task.

## Identify and select

Identify composer, catalogue number, movement and instrumentation from the request. Prefer the original solo-piano version unless the user asks for an arrangement. Resolve genuinely ambiguous titles or movements before preparing a different piece; routine choices of a readable edition can be made and documented.

Search the web using the title/catalogue/movement with MIDI, PDF, MusicXML or LilyPond. Inspect the actual publisher/engraver source pages and download targets. A pair generated from the same engraving source is preferable to independent files with similar names: voice assignments, repeats and bar numbering are easier to verify. MusicXML/LilyPond source is useful for parts even when the user only needs MIDI and PDF in the app. Prefer vector PDFs with intact grand staves; a readable scan can still support manually reviewed bar alignment.

Record the composition, edition/arranger/editor, publisher/engraver, source-page URL, direct asset URLs, retrieval date and stated reuse terms for each asset in `docs/SLUG.md`. Keep the composition’s status distinct from the MIDI performance, modern engraving and source-file terms. Choose assets whose terms permit the requested repository distribution; attribution alone does not establish that. If an asset cannot be bundled, seek a permitted alternative instead of silently adding it to the public repo.

## Acquire and verify the pair

Download original files into `public/pieces/` with distinct stable names, retaining any useful editable source separately. Confirm the download is the actual MIDI/PDF rather than an HTML error, login page or mismatched attachment. Parse the MIDI with the repository tools and open/render the PDF. Record byte hashes so later regeneration can detect changed sources.

Compare the opening, representative middle passages and final cadence against the MIDI, plus key, meter, pickups, bar count and performed repeat order. Check octave transposition, missing voices, cuts, ornaments and ties: matching filenames or total duration do not establish alignment. A humanized performance may need explicit timing preparation; do not quantize away expression or shift notes simply to force agreement with an unrelated score.

If the sources disagree, first seek a matching edition or the engraving source. When permitted source notation exists, generating a MIDI and/or PDF from it is a valid alternative; label those files as derived and record the renderer/version/command. Keep original downloads unchanged. When generating voice-separated MIDI for hand assignments, match it back to the chosen original event stream and preserve original durations/velocities unless changing them is part of the task.

The current bar-alignment path expects an unfolded, one-to-one sequence of PDF and MIDI bars. Resolve repeat-order/pickup differences before cropping and alignment. If neither a matching pair nor usable editable source can be obtained, state the exact missing piece and continue whatever MIDI/quest preparation is valid. Do not deliver invented PDF timing.

## Continue to a playable result

With the verified pair, follow [MIDI normalization and quests](midi-and-quests.md), then [PDF cuts and timing](pdf-and-timing.md), and [registration and delivery](delivery.md). Deliver source attribution alongside the generated assets; the user should be able to open the prepared piece and start its quests without manually reconstructing the source pairing.
