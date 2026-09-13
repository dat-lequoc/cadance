# Cadance

A local-first MIDI piece-practice app. Import the piece you want to play, select a hand or musical part, and practice difficult passages with your real piano. The workspace opens with Beethoven’s **Pathétique, second movement (Adagio cantabile)** already imported. There is no exercise course or lesson catalogue in the product. No account, backend, analytics, paid API or sample download is required.

## Run

Use Node 24 (`nvm use`) and pnpm 11.5.3. Direct dependency versions and the dependency graph are locked.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open http://127.0.0.1:5173. Choose **Connect your piano**, grant permission and explicitly select an input. Without hardware, choose **Use simulated input**, then use the screen keys or A W S E D F T G Y H U J K for C4–C5; Shift controls sustain; Space plays/pauses. Click outside form controls before using computer keys.

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

## Clone onto another computer

Install Git, Node.js 24 or newer, and pnpm 11.5.3, then run:

```sh
git clone https://github.com/dat-lequoc/cadance.git
cd cadance
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm preview
```

Open **http://127.0.0.1:4173** and choose **Pieces**. Pathétique II and Chopin’s Minute Waltz are bundled: source MIDI/PDFs, normalized song data, cropped sheet images/PDFs, timing manifests, quests, attribution and the repo-local preparation skill are all tracked in Git. There is no separate asset download or score-generation step. Python and LilyPond are only needed if you want to regenerate scores, not to run or practice these pieces.

Your personal progress, imported pieces and settings live in your browser, not Git. To move those too, export a backup in **Settings** on the old computer and restore it on the new one. MIDI access must be granted on the new computer.

Browser tests default to port 4173. For an isolated checkout, set `CADANCE_TEST_PORT` to a free port (for example 4191) before running `pnpm test:e2e`; the test runner starts that checkout’s preview and refuses to reuse an existing server on that port.

## Included

- Explicit Web MIDI permission and input selection, hotplug handling, live monitor, calibration, and separately labeled simulated input.
- Wait-for-notes mode with chord collection, wrong-note blocking and fresh attacks for repeated notes. Rhythm mode reports recall, precision and signed timing separately. Listen and Free Play do not earn practice scores.
- Piece library and MIDI type 0/1 import; tempo maps, explicit hand/part assignments, transposition and playable-range checks. Pathétique includes the complete 1,629-note movement, separated into score-defined melody, right-hand inner harmony and left-hand bass/accompaniment.
- Light piece library and setup, followed by a dedicated dark player. The roll and keyboard occupy over 75% of desktop height; transport stays visible, with optional browser fullscreen. Display preferences persist.
- Visible **A / B / Loop**, timeline handles, bar snapping, exact seconds/bar inputs, and optional named saved passages. Draft edits apply deliberately. Restart retains the active loop; seeking within it retains the original boundaries.
- Markdown practice quests: Pathétique has 43 short passages progressing through right hand, left hand and both hands, plus 32 cumulative section reviews. Ten completed runs for new passages or five for cumulative reviews unlock the next quest; repetitions, counting rules, ranges and parts are editable. Progress persists locally.
- Listen, Wait for notes, Practice rhythm, Recital, and Free play. Hand and melody/harmony selection are independent, with automatic playback of unpracticed parts. Tracks can be independently hidden or muted.
- Local synthesis, explicit My piano / Computer live-sound routing, sustain, panic, and persisted sound/preparation/offset preferences. Resume includes preparation without rewinding the musical position.
- End-of-session review and expandable history. IndexedDB songs, attempts and settings; actual-performance MIDI export, audio replay, versioned backup and deletion controls.
- Music continues when switching tabs or windows. Opening player tools pauses deliberately; MIDI disconnection still pauses practice.
- Optional VexFlow pitch-reading preview and a precached production shell.

See [architecture](docs/architecture.md), [hardware setup](docs/hardware.md), [extension tutorial](docs/extensions.md), [test/acceptance report](docs/acceptance.md), and [known limitations](docs/limitations.md). The larger goal includes features beyond this first usable release; their status is explicit in the acceptance report. Real hardware and audible output have not been verified with an instrument.

## Practice your piece

1. **Import MIDI** or drop a file into the page. **Pieces** contains your searchable library; selecting Practice opens setup. Uploaded pieces automatically receive unlocked bar-based sessions, hand quests, and session reviews. Matching prepared MIDI files reuse their reviewed plans and scores; custom plans override automatic suggestions. Everything stays in your local browser library.
2. Choose **Wait for notes**, **Practice rhythm**, or **Recital**, then choose a hand and All notes / Melody line / Harmonies independently. Choose speed, accompaniment and a whole piece or saved passage.
3. **Start practice** enters the focused player. If no piano is selected, connect one or choose simulated input; the original start action continues automatically. **Listen** opens the same player immediately, with falling notes, sheet music, sheet-only mode, zoom, transport and loops. No MIDI hardware is required; browser fullscreen remains optional.
4. The player fills the window. Use **⛶** for browser fullscreen; the keyboard remains visible above a slim transport dock. **Space** or **P** plays/pauses, **R** restarts, and **Escape** closes a panel or pauses. Simulated note keys stay available; hold **Shift** for sustain.
5. Mark **A** and **B** at the playhead, or press **[** and **]**. **Loop** / **L** repeats the range without requiring a name. **Passages** opens exact range editing and optional saving. Editing boundaries does not change an active loop until **Apply loop**; arrow keys move handles by bars when snapping is enabled.
6. **Tools** opens Display and Sound controls and pauses. Close the panel, then resume deliberately. **Setup** returns to configuration without ending an unchanged attempt. Changing hand/part/mode begins a new attempt.
7. **Finish** opens the review. Loop passes are saved without interrupting playback. **History** contains recordings and MIDI export; **Settings** contains calibration, matching, backup and local-data controls.

Tab/window changes and fullscreen toggles keep music playing. Simulated held keys are released on focus loss to prevent stuck notes. Audio scheduling uses a longer background lookahead; a browser or operating system that suspends the entire page can still interrupt playback.

See [practice session polish](docs/practice-polish.md) for preparation, sound, preview and update behavior. See [redesign behavior and architecture](docs/redesign.md) for screen transitions and compatibility details.

For guided repetition, choose **Start first quest** on Pathétique setup. See the [editable practice plan](public/plans/pathetique-ii.md) and [plan format and scoring rules](docs/practice-plans.md). Quest playback repeats until the goal, then continues automatically to the next checkpoint; Listen uses the same player and earns no quest credit.

In the player, turn on **Sheet music** to show the actual Pathétique score above the falling notes, or choose **Sheet only** for a full score view. Zoom, pan, browse systems, or use **Follow** to track the current MIDI bar, including loops and scroll previews. The full public-domain PDF remains available through **Full sheet music**. Prepare more pieces with the repo-local [prepare-piano-piece skill](.agents/skills/prepare-piano-piece/SKILL.md), covering source MIDI/PDF discovery, verified parts, quests and cumulative reviews, PDF cuts, bar/note alignment, integration and verification. See [piece provenance](docs/pathetique.md) and [feature coverage](docs/features.md). The TypeScript API and JSON-format helpers remain available for developers in `examples/` and `docs/extensions.md`; they do not populate the user’s piece library with exercises.

MIT for original code. Pathétique source assets are public domain as declared by the Mutopia edition. Preserve [third-party notices](THIRD_PARTY_NOTICES.md) and `public/licenses/` when distributing. Your imported MIDI files retain their original ownership.

Dashboard appearance defaults to dark. Use the **Dark / Light** button in the top navigation or **Settings → Appearance** to change it; the choice survives reloads and backups. Sheet music always uses white paper with dark notation for readability.

To ask an agent to prepare another piece, use: “Use $prepare-piano-piece to add [composer, title, movement] to Cadance from A to Z, including finding a matching MIDI and sheet.” The skill lives in this repository under `.agents/skills/prepare-piano-piece/`.

Minute Waltz (Chopin Op. 64 No. 1) is also bundled: Pieces → Practice Chopin · Minute Waltz → Start first quest. Its 140 performed bars have 252 quests and an unfolded score in both player views. See [edition, preparation and limitations](docs/minute-waltz.md). This onboarding clone uses preview port 4187 for Playwright.

Chopin's Ballade No. 1 (Op. 23) is available under **Pieces → Practice Chopin · Ballade No. 1 (Op. 23)**, with all 264 bars, 596 freely selectable hand/review quests, and 60 synchronized score systems in both player views. The supplied Paul Barton annotated PDF is copied into the project and linked separately from setup; playback uses a spacious engraving from the matching Mutopia MIDI source. See [sources, preparation and edition differences](docs/ballade-1.md). Mutopia Ballade assets and derivatives use CC BY-SA 4.0; the supplied Barton PDF retains its separate ownership.
