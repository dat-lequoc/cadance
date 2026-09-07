# Architecture and foundation decision

**Current product:** MIDI-piece practice; see `docs/features.md`. The old exercise-led UI was removed after user clarification. `catalogue.ts` loads the prepared Pathétique piece; `LoopPanel.tsx` / `loops.ts` provide named per-piece A/B loops, and `PartsPanel.tsx` provides independent hand, musical-role, visibility and audio controls. Historical exercise helpers remain only for developer examples and tests.

## Bounded upstream evaluation — 2026-09-07

Inspected shallow source snapshots and manifests without installing or executing either upstream app:

| Candidate                                                   | Exact commit                               | Snapshot date | Decision                                        |
| ----------------------------------------------------------- | ------------------------------------------ | ------------- | ----------------------------------------------- |
| [Bach to Basics](https://github.com/gigliof/bach-to-basics) | `8b6db270f36e1be1b9d2a86ebb1f59adeb1e7091` | 2026-06-23    | MIT; first candidate, not adopted               |
| [Noterain](https://github.com/0xsimsch/noterain)            | `56de6896df3b186c5ec543b235d7cef7e850f78a` | 2026-02-14    | GPL-3.0 declared; second candidate, not adopted |

Bach to Basics `frontend/src/engine/SyncEngine.ts` checks one `waitingNote()` in `onMidiInput`, increments the scheduling cursor while queuing five seconds of audio, and clamps transposition to 21–108. Its `AccuracyTracker.ts` registers misses on note-off and resets on stopped state. `MidiClock.ts` uses 125 ms transport callbacks; tempo-map-aware scheduling, group matching and retained attempts would require coordinated replacement across these modules and their event consumers. Its importer uses @tonejs/midi in a worker, which is a useful library choice, but the surrounding product includes conversion services, AlphaTab and remote sampled instruments beyond this task's core.

Noterain `client/src/lib/midi/parser.ts` explicitly uses the first tempo in tick conversion and leaves multi-tempo support as TODO. `hooks/usePlayback.ts` advances a ref-based timeline in animation frames with React store integration. `hooks/useMidiInput.ts` automatically requests MIDI during mount, attempts device auto-selection and leaves global listeners installed. A fork would require replacing timing/input lifecycle and adding independently testable matching and storage, as well as preserving GPL terms. GPL itself is not the rejection reason.

A focused implementation was chosen because correctness-sensitive timing, matching and session ownership all needed replacement in both candidates. No upstream implementation was copied. Current published dependency versions were checked with the package registry; installed versions are exact in package.json and pnpm-lock.yaml. Upstream feature claims were not treated as verified behavior. This is a source review, not an assertion that every upstream path is broken.

## Modules

- `model.ts`: stable MIDI pitch identity, typed song/input/config, hand/range policy, reversible piecewise tempo map.
- `midi.ts`: injected native Web MIDI boundary and deterministic simulated adapter; no SysEx. Raw native API is used instead of adding WebMidi.js for this small boundary.
- `import.ts`, `import.worker.ts`, `files.ts`: header preflight, @tonejs/midi parse, stable IDs, original bytes; worker timeout protects UI responsiveness.
- `engine.ts`: injected monotonic clock, target groups, transport, scores, recordings, retained results, loops and checkpoints. No DOM/audio dependency.
- `audio.ts`: Web Audio synthesis and 25 ms scheduler, 100 ms lookahead, AudioContext start/stop timestamps. No CDN, sample fetch, independent musical counter or frame-driven audio scheduling. A separate Tone.js transport is unnecessary here.
- `render-index.ts`, `Roll.tsx`: prefix-maximum end-time index, culled canvas notes, one rAF drawing loop. React receives controls/status at 10 Hz, never frame-by-frame note positions.
- `storage.ts`: Dexie IndexedDB persistence, versioned backup, actual-input MIDI export. Target score and input recording remain distinct.
- `lessons.ts`: legacy exercise-format API and test fixtures; not a user-facing course.
- `Staff.tsx`: lazy VexFlow pitch preview, explicitly labeled as a preview rather than faithful MIDI notation.

## Clock and cancellation contract

The engine owns source-song seconds. While running, position = anchor song position + (monotonic now − anchor time) × speed. `TempoMap` converts PPQ ticks to source seconds and back. Audio start times map that same position into AudioContext time with offsets; there is no separate accumulated audio playhead. Visual offset affects drawing only. Input offset subtracts from input timestamps only. Speed preserves musical position and invalidates scheduled sound.

Each pause, seek, waiting transition, restart or speed change increments an epoch. The scheduler cancels app-owned scheduled oscillator nodes and rebuilds from the current position. It does not schedule an onset at or beyond the next unresolved wait boundary. Learner monitoring voices are separate from scheduled accompaniment. Panic stops all app sound but the engine retains known physically held keys until release. Device loss invalidates knowledge from that port and pauses immediately; reselection and deliberate resume are required.

Count-in uses the active tempo and time signature at passage start. Metronome ticks use PPQ, tempo map and active meter denominator. Complex meter semantics and compound-meter accent groupings are not inferred.

## Matching policy

Internal channels are **1–16**. Source ports, original channels, monotonic timestamps, velocity, raw CC64 and event source survive normalization. NoteOn-zero becomes NoteOff. Sustain >=64 is on. Physical holds are distinct from pedal-sounding pitches. Audio voices have instance identity; overlapping song notes release independently.

Only selected left/right targets enter the denominator. Accompaniment and ignored tracks cannot earn or cost learner points. Simulated attacks can score only when simulated mode is selected. Automatic playback is rejected at the input-credit boundary. Unison targets at the exact same onset are deduplicated by pitch. Default grouping is exact onset; an explicit millisecond setting may group loosely aligned imports, independently of learner timing tolerances.

Learn collects fresh attacks for the next group. Each partial target must remain physically held, and all attacks must fit the configured collection window. Release removes that partial; expiry clears the partial chord and adds a retry. A wrong attack adds an extra and does not advance. Held keys from earlier groups, pedal state, or duplicate NoteOn without release cannot satisfy a repeated target. Group completion resets the wall-clock anchor, so a 30-second wait cannot create catch-up audio.

Rhythm selects the closest eligible unmatched target of the same pitch (earlier target breaks ties). Early/late windows are real milliseconds, divided correctly by playback speed. Each attack matches once. Misses close after the late onset window; a long target duration does not postpone them. Recall = hits / selected passage targets; precision = hits / (hits + extra attacks). Zero denominators return null. Timing = mean signed real-millisecond onset error of matched attacks only. Learn exposes pitch completion, extras, retries and finding time, never a rhythm grade.

Passage selection/seek/mode/hand/transposition changes stop the current attempt and start a fresh scoring scope. Loops save independent attempts. Adaptive speed operates only on completed scored Rhythm loops after the configured number of consecutive threshold passes; failure clears the streak. Listen is never stored as practice; free input may be recorded without a score.

## Storage and offline

Dexie schema 1 stores songs, sessions and key/value settings. Session comparison metadata includes source ID, mode, hand, speed, passage, range/transposition and matching windows. Recordings retain wall time plus musical-position checkpoints across waits, pauses, loops and speed changes. MIDI export follows actual elapsed performance time, not the target arrangement; still-held notes close at recording end. Replay routes audio only and never enters the learner matcher.

Production build generates an explicit asset cache and service worker. Document navigations, including query strings, resolve to the cached index. The same-origin precache ignores response Vary headers because preview servers return `Vary: Origin` even for immutable same-origin JS/CSS; browser integration tests cover offline reload and worker import. Core has no remote requests. Storage is local to the origin and may be evicted. Backups are recommended; changing dev/preview ports uses a different database origin.
