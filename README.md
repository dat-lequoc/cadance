# Cadence

A local-first MIDI piece-practice app. Import the piece you want to play, select a hand or musical part, and practice difficult passages with your real piano. The workspace opens with Beethoven’s **Pathétique, second movement (Adagio cantabile)** already imported. There is no exercise course or lesson catalogue in the product. No account, backend, analytics, paid API or sample download is required.

## Run

Use Node 24 (`nvm use`) and pnpm 11.5.3. Direct dependency versions and the dependency graph are locked.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open http://127.0.0.1:5173. Choose **Connect your piano**, grant permission and explicitly select an input. Without hardware, choose **Use simulated input**, then use the screen keys or A W S E D F T G Y H U J K for C4–C5; space controls sustain. Click outside form controls before using computer keys.

```sh
pnpm test                         # deterministic engine / adapter / scheduler tests
pnpm fixtures                     # regenerate original MIDI and JSON fixtures
pnpm benchmark                    # 10,000-note parse and culling measurement
pnpm build                        # TypeScript check + production bundle
pnpm exec playwright install chromium
pnpm test:e2e                     # Chromium against the production preview
pnpm preview                      # http://127.0.0.1:4173
```

Offline caching runs in the production build. Load the production address once online, then reopen that same address offline. Deploy `dist/` to an HTTPS static host; localhost is valid for development. No deployment was performed.

## Included

- Explicit Web MIDI permission and input selection, hotplug handling, live monitor, calibration, and separately labeled simulated input.
- Learn mode with chord collection, wrong-note blocking and fresh attacks for repeated notes. Rhythm mode reports recall, precision and signed timing separately. Listen and Free Play do not earn lesson credit.
- Piece library and MIDI type 0/1 import; tempo maps, explicit hand/part assignments, transposition and playable-range checks. Pathétique includes the complete 1,629-note movement, separated into score-defined melody, right-hand inner harmony and left-hand bass/accompaniment.
- High-contrast light controls and a high-contrast piano roll; fit-to-piece/88-key/zoomed views, labels, pause/seek/speed, count-in and metronome.
- Visible **Mark A / Mark B / Create loop**, bar snapping, editable seconds/bar ranges, draggable boundaries, and named saved loops with rename/delete/reopen. Restart retains the active loop; seeking within it retains the original boundaries.
- Listen, Practice melody (wait mode), Practice rhythm, Song recital, and Free play. Hand and melody/harmony selection are independent, with automatic playback of unpracticed parts. Tracks can be independently hidden or muted.
- Local synthesis, piano-own-sound routing, sustain, panic, input/visual/audio offset settings.
- IndexedDB songs, attempts and settings; actual-performance MIDI export, audio replay, versioned backup and deletion controls.
- Optional VexFlow pitch-reading preview and a precached production shell.

See [architecture](docs/architecture.md), [hardware setup](docs/hardware.md), [extension tutorial](docs/extensions.md), [test/acceptance report](docs/acceptance.md), and [known limitations](docs/limitations.md). The larger goal includes features beyond this first usable release; their status is explicit in the acceptance report. Real hardware and audible output have not been verified with an instrument.

## Practice your piece

1. **Import MIDI** or drag a file into the page. Your selected piece and imported files are stored locally.
2. Choose **Listen** to hear it immediately. Choose **Right hand**, **Left hand**, or **Both hands** and **All notes**, **Melody line**, or **Harmonies**. Turn off **Play the other parts for me** to listen to only the selected part.
3. **Practice melody** waits for your notes (the Synthesia-style name for wait mode). **Practice rhythm** and **Song recital** advance at the selected speed and score timing. Hand/part selection works in each mode.
4. Seek to the start of a passage and **Mark A**; seek to its end and **Mark B**. Optionally snap to bars. Name it and **Create loop**. Saved loops belong to that piece and persist after reload.
5. Adjust imported part assignments in **Parts & accompaniment**. MIDI does not inherently identify hands or melody. Pathétique uses the source score’s actual voices; arbitrary MIDI uses track-name hints and an editable upper-voice suggestion.

The full public-domain Pathétique score PDF is available through **Full sheet music**. See [piece provenance](docs/pathetique.md) and [feature coverage](docs/features.md). The TypeScript API and JSON-format helpers remain available for developers in `examples/` and `docs/extensions.md`; they do not populate the user’s piece library with exercises.

MIT for original code. Pathétique source assets are public domain as declared by the Mutopia edition. Preserve [third-party notices](THIRD_PARTY_NOTICES.md) and `public/licenses/` when distributing. Your imported MIDI files retain their original ownership.
