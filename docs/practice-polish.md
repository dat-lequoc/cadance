# Practice session polish

The ordinary 88-key player remains the practice surface. Quests stay in the header, and the falling roll retains its vertical section bracket.

## Sound and preferences

**Hear my playing through → My piano** is the hardware default: the instrument supplies live sound, while Cadance can play accompaniment and Listen. **Computer** enables live software monitoring for a silent MIDI controller. Simulated input always uses computer audio. Switching routes releases app voices without changing quest progress. Repeated note-on messages while a key is held do not create extra software voices; note-off followed by note-on still articulates repeated notes.

Sound route, accompaniment, metronome, count-in, preparation time and audio/visual offsets persist in `practice-preferences-v1` in the existing settings table. Missing or invalid values use validated defaults. Existing `preparation-seconds` and display preferences remain readable. A synchronous local preference cache protects changes made immediately before refresh; version timestamps select the newest snapshot at startup, which is then written to IndexedDB. Backup restore explicitly replaces that cache and reapplies practice preferences without requiring a reload. Device selection remains explicit each time the page loads.

## Transport and preparation

Fresh starts and repeats use the selected preparation duration. Resuming after playing adds preparation at the exact paused position, holding the score and musical clock until it finishes. Pausing during preparation freezes the remaining countdown; resuming continues it. Preparation input updates held-key feedback but is not scored or recorded. Resume preparation does not schedule accompaniment. Listen and Free play start immediately. A one-bar count-in, when enabled, replaces the fixed duration for starts, repeats and resumes using the local tempo/meter and speed.

Buttons and keyboard shortcuts share controller actions. Restart returns to the active section start and waits for Play. Wheel scrolling pauses and previews without changing the playhead or checkpoint. Back to playhead restores the view; Play resumes with preparation; Play from here deliberately starts free practice at the preview position. Keyboard Restart also clears preview. Navigation, disconnect, and subsequent transport actions invalidate pending audio-start promises. Recording replay is canceled when leaving as well. Tab/window changes continue playing.

## Updates

A production service worker installs a new build in the background and waits. **Update available** offers **Update and reload**. Choosing it stops playback and saves the current attempt, waits for session/quest saves and preferences, then activates the worker and reloads. Failed session saves keep the old page open with its Retry saving action. Playback cannot restart while that update is pending. Merely finding an update never pauses or reloads the page. Other open tabs are not automatically reloaded; old cached assets remain available while multiple tabs may use them.

For the first transition from the older app (which had no update prompt), close all Cadance tabs once and reopen the same address after the new worker finishes installing. This allows the waiting worker to activate. Later updates use the prompt. Local songs and progress remain in the same IndexedDB database.

## Verification

Automated checks cover frozen resume timing and scores, ignored positioning notes, paused countdowns, immediate Listen, one-bar preparation, duplicate held-note audio, persisted preferences and backup restore, shared keyboard/preview behavior, and delayed-start cancellation. A local HTTP test server serves two real service-worker versions and injects a failed session write to verify update consent and durable-save ordering.

Physical instrument verification remains pending. On the user's piano/headphones: connect and select the input; choose My piano; confirm one audible live note, correct key highlights and pedal release; complete ten quest repetitions; scroll and return; pause/resume; unplug/reconnect with explicit resume; reload and confirm saved preferences/progress. Record instrument, browser and observed result before claiming hardware validation.
