# Hardware setup and verification

**Hardware verification: PENDING.** No physical instrument, USB interface, pedal, MIDI driver or audible output was tested. Automated verification used fake ports in headless Chromium 153.0.8010.12 on macOS arm64. Do not interpret that as a real-piano pass.

1. Connect the instrument's USB TO HOST / USB MIDI port to the computer. USB TO DEVICE normally serves storage. A headphone/audio connection cannot send MIDI. Older five-pin MIDI instruments need a USB MIDI interface; drivers depend on the model. An acoustic piano needs MIDI sensors and is outside this version.
2. Open the localhost app in desktop Chrome or Edge. For a hosted app, use HTTPS. Runtime feature detection is authoritative. Firefox supports Web MIDI with permission considerations; Safari/iOS is not an initial supported target. Bluetooth is usable only if the OS exposes it as a MIDI input; Bluetooth audio is not MIDI.
3. Click **Connect your piano → Connect MIDI piano**, grant permission, then explicitly select your input. No SysEx is requested. Stale selections are not silently restored; choose the connected device again.
4. Play middle C (MIDI 60 / C4 in this app). Check calibration and the key highlight. Some piano displays use a different octave-number convention. The integer MIDI pitch is the identity.
5. Leave Computer sound off to hear your piano's own sound. For a silent controller, enable monitoring. Avoid doubling by muting the piano if you monitor through the computer. The fallback timbre is a triangle synthesizer, not sampled grand piano audio.
6. Start “The checkpoint.” Play a wrong key at the first C: it must remain blocked. Play C and release. At C–E–G, hold each key as you add the others within one second. Later repeated C notes must require separate releases and attacks.
7. Hold the pedal, release a key and verify held versus sustained highlighting. Release the pedal and confirm the sustained state clears. Verify raw pedal values in the monitor.
8. Unplug during Rhythm practice. Confirm pause with no further misses. Replug, open setup, select the piano again, and deliberately resume. Switch between two input ports if available; only the selected one should affect practice.
9. Test pause, seek, loop, speed changes and Panic while sound is active. Confirm no stale accompaniment or stuck app sound. Test repeated notes and overlapping notes. App Panic does not control your piano's internal sound engine.
10. Export a performed MIDI recording and compare note releases and sustain in your preferred MIDI editor. Replay must not create another attempt.

Record actual results here when hardware is available:

| Instrument / firmware | Interface / driver | OS      | Browser version | Notes/chords/pedal | Disconnect/reconnect | Sound routing |
| --------------------- | ------------------ | ------- | --------------- | ------------------ | -------------------- | ------------- |
| Pending               | Pending            | Pending | Pending         | Not tested         | Not tested           | Not tested    |

Input offset compensates a known attack timestamp bias for scoring; visual/audio offsets adjust their respective outputs. No measured end-to-end key-to-sound latency is claimed. Manual feel-based adjustment is not a hardware latency measurement.
