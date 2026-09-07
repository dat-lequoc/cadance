# Piece-practice feature coverage

The current product follows the user's clarified scope: **import a MIDI piece and help play that piece**. Exercise cards and the course-based navigation were removed. No claim of complete commercial Synthesia parity is made.

| Workflow              | Implemented behavior                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Import a piece        | MIDI picker/drag-drop, worker parsing, type 0/1, original data, saved piece library, last selected piece                                                     |
| Listen                | Starts playback immediately, no piano required; all parts or selected hand/part only                                                                         |
| Practice melody       | Wait-for-notes mode; freezes at full target chords, distinct repeated-note attacks                                                                           |
| Practice rhythm       | Steady timeline, pitch/timing matching, recall, precision, signed timing, misses and extras                                                                  |
| Song recital          | Continuous scored performance with the same tested timing matcher; no waiting                                                                                |
| Hand practice         | Left, right, both; automatic unpracticed-hand accompaniment can be disabled                                                                                  |
| Musical-part practice | All, melody line, harmonies; independent of hand selection                                                                                                   |
| Part editing          | Hand/role assignment, independent visibility and audio mute per track                                                                                        |
| Loops                 | Mark A/B at current time, bracket shortcuts, bar snapping, seconds/bar selection, draggable boundaries, named save/edit/delete/reopen, per-piece persistence |
| Loop transport        | Repeats at B, restart returns to A, seek inside keeps boundaries, loop off continues from position                                                           |
| Adaptive loops        | Raises speed after configured consecutive successful scored passes; does not reward listening                                                                |
| Reading and display   | High-contrast controls/roll, key zoom, fit-to-piece, note/finger labels, show/hide other parts, full source PDF for Pathétique                               |
| MIDI hardware         | Explicit permission and input selection, sustain, device monitor, calibration, disconnect pause, deliberate resume                                           |
| Audio                 | Local synthesis, piano-own-sound routing, monitoring, metronome, count-in, panic                                                                             |
| Practice history      | Genuine attempts, mode/speed/hand/part/passage metadata, actual performance replay and MIDI export                                                           |
| Local/offline         | IndexedDB, backups, deletion, production service-worker cache                                                                                                |

Synthesia's own [melody-practice explanation](https://synthesiagame.com/) describes waiting for correct notes; it does not mean isolating the highest musical voice. This app exposes **Practice melody** as that transport mode and **Melody line / Harmonies** as separate musical-role selections.

Still outside the implemented scope: MIDI hardware output/lighted-key protocols, SoundFont loading and full General MIDI instrument selection, multiple simultaneous learner input devices, native mobile packages, MusicXML import, automatic faithful whole-score notation from arbitrary MIDI, and commercial song-store/catalogue features. A MIDI-derived four-note pitch preview remains a limited optional view; the supplied Pathétique PDF is the full actual score. Physical-piano and audible hardware validation remain pending.
