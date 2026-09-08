# Piece-practice feature coverage

The interface separates a light piece library and setup from a viewport-filling dark player, with a persistent dock, optional fullscreen, passage/tool drawers, and end-of-session review. Tabs and window changes retain playback.

The current product follows the user's clarified scope: **import a MIDI piece and help play that piece**. Exercise cards and the course-based navigation were removed. No claim of complete commercial Synthesia parity is made.

| Workflow              | Implemented behavior                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Import a piece        | MIDI picker/drag-drop, worker parsing, type 0/1, original data, saved piece library, last selected piece                                                     |
| Listen                | Starts playback immediately, no piano required; all parts or selected hand/part only                                                                         |
| Wait for notes        | Wait-for-notes mode; freezes at full target chords, distinct repeated-note attacks                                                                           |
| Practice rhythm       | Steady timeline, pitch/timing matching, recall, precision, signed timing, misses and extras                                                                  |
| Song recital          | Continuous scored performance with the same tested timing matcher; no waiting                                                                                |
| Hand practice         | Left, right, both; automatic unpracticed-hand accompaniment can be disabled                                                                                  |
| Musical-part practice | All, melody line, harmonies; independent of hand selection                                                                                                   |
| Part editing          | Hand/role assignment, independent visibility and audio mute per track                                                                                        |
| Loops                 | Mark A/B at current time, bracket shortcuts, bar snapping, seconds/bar selection, draggable boundaries, optional named save/edit/delete/reopen, per-piece persistence |
| Loop transport        | Repeats at B, restart returns to A, seek inside keeps boundaries, loop off continues from position                                                           |
| Adaptive loops        | Raises speed after configured consecutive successful scored passes; does not reward listening                                                                |
| Practice quests       | Editable Markdown plans; 43 Pathétique passages × right/left/both plus 32 cumulative reviews, ten completed runs to unlock next, automatic continuation, durable progress and retryable atomic saves |
| Reading and display   | High-contrast controls/roll, key zoom, fit-to-piece, note/finger labels, show/hide other parts, zoomable, bar-synced PDF score above the roll; full source PDF for Pathétique                               |
| MIDI hardware         | Explicit permission and input selection, sustain, device monitor, calibration, disconnect pause, deliberate resume                                           |
| Audio                 | Local synthesis, My piano / Computer routing, saved sound preferences, metronome, count-in, panic                                                                             |
| Practice history      | Genuine attempts, mode/speed/hand/part/passage metadata, actual performance replay and MIDI export                                                           |
| Local/offline         | IndexedDB, backups, deletion, production service-worker cache                                                                                                |

The wait mode is labeled **Wait for notes** to distinguish transport behavior from the independent **Melody line / Harmonies** part filter. Internal mode values and saved results are unchanged. Loop activation does not require saving a name; detailed boundary edits apply explicitly. Display and sound/preparation preferences persist in the existing settings store. Resume preparation holds the exact musical position; wheel preview preserves the checkpoint. Production updates wait for an explicit reload and durable result saves. See [practice polish](practice-polish.md).

Still outside the implemented scope: MIDI hardware output/lighted-key protocols, SoundFont loading and full General MIDI instrument selection, multiple simultaneous learner input devices, native mobile packages, MusicXML import, automatic faithful whole-score notation from arbitrary MIDI, and commercial song-store/catalogue features. A MIDI-derived four-note pitch preview remains a limited optional view; the supplied Pathétique PDF is also prepared as 22 cropped systems with all 73 bars aligned to MIDI, optional zoom and independent browsing. Physical-piano and audible hardware validation remain pending.
