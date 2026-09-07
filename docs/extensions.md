# Program your own practice

The engine has no React, DOM, MIDI permission or audio dependencies. Provide a `Song`, an optional `Config` patch and optionally `now: () => monotonicMilliseconds`. Drive `tick()` from a short interval, attach an adapter, and observe the engine. A deterministic clock makes exercises reproducibly testable.

```ts
const engine = new PracticeEngine(song, { mode: "wait", chordMs: 1000 });
engine.attach(inputAdapter); // MidiInputAdapter.subscribe(normalizedEvent)
const unsubscribe = engine.subscribe(() => updateYourUI(engine));
engine.onResult = (result) => storeYourResult(result);
engine.selectPassage(0, song.duration, false);
engine.start();
// Regularly call engine.tick(); rendering reads engine.currentPosition().
engine.pause();
engine.setSpeed(0.75);
engine.start(); // deliberate resume
const result = engine.result();
engine.stop(); // preserves lastResult, emits a stopped attempt when meaningful
unsubscribe();
engine.dispose();
```

Other entry points: `loadLesson(song)`, `configure(patch)`, `seek(seconds)`, `deviceLost(port)`, `panic()`, `receive(normalizedEvent)`. `InputEvent.source` distinguishes hardware/simulated/playback; playback is never eligible for learner credit. `HardwareInput` has injected access for testing. `SimulatedInput.send([status, data1, data2])` passes through the same MIDI normalizer. Channels in normalized events are 1–16.

`examples/c-major.ts` is a real browser hardware example: invoke its exported function from a button click and provide a port picker callback. It generates a lesson, connects the selected piano, subscribes to raw normalized input, and evaluates practice. Its returned cleanup closes listeners and the interval. This example is typechecked by `pnpm build`; actual hardware operation remains pending.

## Version 1 exercise JSON

Copy `public/fixtures/c-major.json`. Fields:

| Field               | Meaning                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| version             | Must be 1                                                                           |
| title / explanation | Plain display text; not HTML or executable code                                     |
| tempo               | 20–300 BPM                                                                          |
| meter               | `[numerator, denominator]`; denominator 1/2/4/8/16                                  |
| range               | Inclusive `[lowestMidiPitch, highestMidiPitch]`                                     |
| mode                | wait, rhythm, listen, free                                                          |
| scoring             | Optional earlyMs, lateMs, chordMs; validated settings                               |
| notes               | 1–50,000 objects: pitch 0–127, beat, duration, left/right hand, optional finger 1–5 |

Beat and duration units are quarter-note beats even in other meters. Notes may share onsets for chords; add different beats for arpeggios. Integer MIDI pitch is authoritative. Imported files retain original pitch/tick data; practice transposition is applied to a derived view and never clamps notes. Authored finger numbers are suggestions only and do not reveal what the player physically used.

`validateExercise()` rejects invalid values; `fromExercise()` returns a normalized Song. The UI currently uses its chosen practice mode and matching settings when loading an imported exercise; mode/scoring metadata are available to custom callers, rather than silently overriding the user's active preferences. To make a permanent built-in lesson, add it in `src/core/lessons.ts`.

## Recording and progress

`Result.events` has input events, elapsed monotonic milliseconds, and source-song position. `Result.checkpoints` records transport changes and speed. Replay/export use actual elapsed performance time, including pauses and waits; score time remains separate. `performanceMidi(result)` exports NoteOn/Off and raw CC64 normalized to MIDI values. Never score that exported playback as learner input.

A stable song ID plus config and passage metadata identifies comparable attempts. Apps built on this API should compare only equivalent modes, hands, transpositions, ranges and tolerance settings. Baseline UI lists these attempts without inventing aggregate mastery scores.
