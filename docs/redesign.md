# Cadance interface redesign

## Screens

**Pieces → Setup → Player → Review** is the primary flow. History and Settings are available in the light workspace header. The last selected piece opens in setup on reload. Import replaces the selected piece after successful parsing and storage; failures retain the current workspace.

The desktop setup pairs hand/part/mode/speed/passage choices with a static source-note preview. Wait for notes replaces the ambiguous visible label Practice melody; its saved mode remains `wait`. Listen plays inline on setup with pause, seek and stop; opening the player is an explicit optional action. scored practice requests a MIDI or simulated source and automatically continues the pending start once connected.

The focused player fills `100dvh`, with a 48px header, flexible canvas, and 110px transport dock on desktop. At 1366×768, the stage occupies 610px (79.4%); at 1440×900 it occupies 742px (82.4%). Mobile uses two control rows, and landscape is suggested without blocking use. Browser fullscreen is optional and its failure is nonfatal. Fullscreen toggles, tab changes and window changes preserve playback; leaving the player exits fullscreen.

Tools and Passages are focus-trapped panels. They pause the engine without ending an attempt and require deliberate resume. Setup return likewise pauses; unchanged setup can resume. Changing a scoring selection uses the existing engine's new-attempt behavior. Natural non-loop completion and Finish open a review. Loop completion saves each pass while staying in the player. Listening never receives fabricated scores; Free play exposes recording actions.

## Practice controls

- P: play/pause. R: restart. Escape: close panel, otherwise pause.
- A/B buttons or [ / ]: mark the current position. L toggles a valid loop.
- Space remains simulated sustain; A W S E D F T G Y H U J K remain the simulated note keys.
- Shortcuts do not consume text-field input or dialog interactions. Blur releases simulated notes and pedal without pausing music.
- Timeline scrubbing previews locally and commits once, avoiding many saved attempts per drag. Seeking inside an active loop retains its original boundaries; seeking outside disables it.
- Loop drafts remain independent of the active engine passage. Two marks enable quick Loop activation without naming. Passages accepts exact seconds or derived bar numbers; Apply loop commits edits. Saving/renaming is independent of activation.
- Handle arrows step between bar boundaries with snapping enabled. Unsnapped handles retain fine range-input keyboard steps. Pointer edits snap on release.

## Architecture and compatibility

`usePracticeController` owns the engine and IO above all views. `useLoops` is the single draft/saved passage state shared by the timeline and drawer. `Roll` uses the same dynamic keyboard height and key geometry for drawing and pointer hit testing. Canvas animation and audio scheduling remain independent of React's UI refresh.

Canvas colors and CSS share stage tokens. Notes preserve left/right identity after successful input with a small success accent. Pressed, wrong and sustained key states remain distinct. Feedback is available as DOM status text as well as color. Dialog focus is trapped and restored; player background controls are inert while a drawer is open.

No IndexedDB schema upgrade or destructive migration is performed. The `cadence-piano` database, Song/Result structures, configuration key, `loops:<songId>` records and version-1 backups are retained. `display-v1` adds validated keyboard-range, label, zoom and background-visibility preferences. The product name is Cadance while storage identity stays stable.

AudioScheduler uses its existing 100ms foreground horizon and a 2-second background horizon, bounded by unresolved practice notes and active passages. No tab/window handler calls pause. Device loss, explicit pause, navigation and tools still pause. OS/browser page suspension remains beyond application control.

## Verification

The browser suite checks input/connection continuation, import rejection, offline operation, backup round trip, player dimensions, panel/selection session transitions, fullscreen success/failure, actual background progress and scheduled tones, loop dragging and keyboard controls, loop repetition, natural completion, source colors and pointer geometry after resizing, sustain cleanup, display persistence and the 10,000-note fixture. Screenshots cover setup, player, tablet/mobile, library, history and settings.

No new runtime dependency, backend, remote font, or external image service is required. This remains a MIDI practice app; full-score generation, sampled piano sound and hardware output are separate work.
