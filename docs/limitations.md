# Scope and known limitations

The app now follows the clarified MIDI-piece workflow, with Pathétique II preloaded and no exercise course. See `docs/features.md` for the current feature inventory. It does not claim complete Synthesia parity.

- Physical piano, driver, pedal and audible sound verification is pending. Only deterministic/fake MIDI and automated desktop Chromium were exercised. Firefox, Edge, Windows and Linux manual checks remain pending.
- Optional MIDI output/thru is not implemented. Panic controls app-owned software voices; it does not send hardware All Notes Off or change the instrument's settings.
- Computer sound is a simple local synthesizer, not a sampled grand piano. Accompaniment demonstrates note onsets/durations; imported song CC64 and expression automation are not replayed. Actual learner CC64 is recorded, replayed and exported.
- Notation is a first-four-note pitch preview with displayed quarter-note durations. It is not faithful rhythmic transcription, a paginated staff lesson mode, or MusicXML support. No fingering/technique inference is claimed; authored fingering is retained and can be shown through Fingering hints; no automatic fingering is inferred.
- Part assignment supports hand and melody/harmony roles, with independent visibility and mute. Pathétique has score-defined parts; arbitrary MIDI role/hand detection remains an editable suggestion. An arbitrary single-track file may require manual part editing in a MIDI editor for exact voice separation.

- Settings persistence covers matching config and named per-piece loop bookmarks. Sound routing, count-in, visual/audio offsets and visible-key preferences currently reset on reload. Device IDs are saved as a hint but deliberately require fresh selection.
- Session replay is audio plus event monitor, not a synchronized recording piano roll. MIDI export closes notes still held at the recording end. Recordings preserve raw events and transport checkpoints; imported song recordings/CC events are not used for scoring.
- Progress lists genuine attempts and piece practice counts; it does not yet chart normalized per-passage trends. Seek, hand and mode changes end an attempt and reset its scope. Loop repetitions are separate saved results.
- Strict exact-onset grouping is the default. Increasing grouping milliseconds can merge intentional arpeggios; this is an explicit user adjustment. Hold-duration and release-timing grading are not implemented.
- The renderer culls with a prefix end-time index. Extreme files with many simultaneous long notes can still have large visible sets. The included benchmark is CPU parsing/culling, not a universal animation-rate or hardware latency promise.
- Imports allow 5 MB and 50,000 notes, with a five-second worker timeout and a one-day onset bound. There is no separate pre-parse count of all non-note MIDI events; the byte limit and worker termination bound that work. Type 2 and SMPTE files are rejected. Sustain held before starting an attempt cannot be reconstructed in export until an event arrives.
- Count-in uses tempo/meter at passage start; compound-meter subdivision accents, imported pickup-bar semantics, score measure labels and irregular-bar editing are not implemented. A/B controls offer source seconds or tempo/meter-derived bar ranges. Positive audio delay is 0–100 ms to stay inside the scheduler horizon.
- Background tab/focus loss deliberately pauses practice. Musical time does not keep running invisibly. Browser storage is origin-specific and can be evicted; make backups. Offline installation affordances depend on the browser.
- VexFlow's lazy bundle includes embedded fonts (~1.12 MB before gzip), producing a Vite chunk-size warning. It is intentionally cached for offline notation. No remote font/sample service is required.

Microphone detection, transcription, PDF/YouTube import, cloud accounts/sync, LLM coaching, native mobile packaging and multiplayer are intentionally outside scope as requested.
