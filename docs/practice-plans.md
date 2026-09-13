# MIDI practice quests

Open a bundled piece in setup and choose **Start first quest**, or select any checkpoint. The app selects the passage, hand, part and speed, then opens the same focused player as ordinary Wait for notes practice, with the full 88-key piano (A0–C8) visible. Tools → Display can change the keyboard range during a run. Each unfinished checkpoint repeats automatically after its result is saved; reaching the goal automatically starts the next unfinished checkpoint with the preparation gap. All checkpoints are available from the start. The header selector groups them by section, and the setup list includes section dividers. Completed checkpoints remain available to replay.

The bundled [editable Markdown plan](../public/plans/pathetique-ii.md) covers all 73 bars in 43 passages, with 129 hand quests and 32 cumulative both-hand reviews. Each short passage has three quests: right hand, left hand, then both hands, always including all notes for the selected hands. The plan was built from the actual 1,629 MIDI events and score-derived part assignments. Most checkpoints span two bars. Busy passages, including bars 42–44, are split into individual bars. Bars 27–28 stay together because the melody sustains across the boundary. The plan includes a source-time and note-count table for reviewing these cuts.

## What earns progress

- Play the complete target passage with every target note and no misses. Wrong notes and chord retries remain feedback and do not cancel a completed run.
- The default is ten successes **in total**. Failed completed attempts retain earned successes. `consecutive` instead resets the streak after a failed completed attempt.
- Listening, playback recordings and unfinished attempts earn no credit. Restarting an unfinished attempt does not reset an earned streak.
- The supplied plan uses wait-for-notes mode: it checks pitches and chord collection, not rhythm, note lengths, fingering, dynamics or pedal technique. Rhythm quests use the engine's timing matcher with a ±150 ms window.
- The shared player keeps its full-song timeline, speed, A/B looping and passage controls. A green timeline band marks the checkpoint interval within the whole piece. Seeking on the timeline, choosing Play from here, changing hand or mode settings or applying a custom loop returns to free practice and preserves earned quest progress. Mouse-wheel scrolling pauses and selects a resume point without moving the practice playhead yet; Back to playhead cancels that selection. Resume starts a fresh attempt at the selected note onset with preparation. Resuming at the active checkpoint start retains quest mode; starting partway through becomes free practice and preserves earlier earned quest progress. Choose **Start checkpoint** or select an unlocked checkpoint in the header to return to a complete scored run.

Progress is saved on this device in IndexedDB and included in the existing backup. Each completed attempt and its progress update save in one transaction. If saving fails, playback stops and **Retry quest save** preserves the pending result without double credit. Leaving the quest prevents an automatic restart while a save finishes. Tab/window changes retain playback.

## Edit and import the plan

Choose **Download plan**, edit the `.md` file, and choose **Import plan .md** for the matching piece. The app reads exactly one fenced `cadance-plan` block containing JSON; surrounding Markdown is for humans and is not rendered as executable HTML.

```json
{
  "version": 1,
  "id": "my-piece-plan",
  "title": "My piece practice route",
  "song": { "title": "My piece", "fingerprint": "SHA-256 from songFingerprint(song)" },
  "repetitions": 10,
  "counting": "total",
  "quests": [{
    "id": "bars-1-2-left",
    "title": "Bars 1–2 · Left hand",
    "section": "Opening theme",
    "instruction": "Play the left-hand notes.",
    "fromBar": 1,
    "throughBar": 2,
    "hand": "left",
    "focus": "all",
    "mode": "wait",
    "speed": 0.8
  }]
}
```

Wrap that JSON in a fence labeled `cadance-plan` in the actual Markdown file. The fingerprint above is a placeholder, not an importable value; start by editing the bundled file to retain its valid fingerprint.

| Field | Accepted values |
| --- | --- |
| `repetitions` | Integer 1–100, shared by the plan |
| `counting` | `total` or `consecutive` |
| `quests` | 1–1,000 quests in suggested practice order; unique IDs; no prerequisites |
| `fromBar`, `throughBar` | Inclusive, one-based bar numbers in this MIDI |
| `hand` | `right`, `left`, `both` |
| `focus` | `melody`, `harmony`, `all` |
| `mode` | `wait` or `rhythm` |
| `speed` | 0.25–1.5, where 1 is original MIDI tempo |

The app rejects malformed plans, empty target selections and plans belonging to different MIDI content or part assignments. A filename/title change is allowed. Editing prose preserves progress; changing machine-readable plan data creates a separate progress record. Reimporting the old plan restores its earlier record. Imported MIDI needs appropriate melody/harmony assignments before using those filters.

MIDI files uploaded through the web interface receive an automatic practice plan immediately. It groups bars into two-bar passages and eight-bar sessions (larger groups for very long files), with available-hand quests and both-hand session reviews. All checkpoints are unlocked. These are mechanical practice suggestions, not inferred musical phrases; check the suggested hand assignments. Custom imported plans take priority. Plans and progress survive reload through the local library, and generated plan identity remains stable when a file is renamed.

Prepared songs in `src/core/*.json`, plans in `public/plans/*.md`, and reviewed scores in `public/scores/*/score.json` are discovered at build time without adding application imports or piece-ID branches. Frontend uploads are available immediately without a rebuild. An exact original MIDI byte match reuses a prepared song's verified assignments and reference metadata; plans and scores then match by musical fingerprint. Arbitrary MIDI uploads do not generate annotated PDF alignment.

For developers, `songFingerprint(song)` in `src/core/quests.ts` generates the content identity from a normalized `Song`. `scripts/pathetique-plan.ts` is a complete authoring example; run `pnpm plan:pathetique` to regenerate the bundled Markdown. Automatic plans are versioned in `src/core/plans.ts`; change the generator version deliberately when changing progression semantics.

## Preparation and section markers

Fresh practice starts, checkpoint switches and automatic repeats include a three-second preparation gap. The first target keys are indicated while the notes approach the strike line. Positioning notes during the gap are not graded or recorded as attempts; release and play a fresh attack when the passage begins. Pause freezes the remaining countdown, and resume continues it. Resuming after playing gives preparation at the exact paused musical position without rewinding or clearing earned results. Restart returns to the passage start; Play starts a fresh lead-in. Listen and Free play start immediately. Tools → Getting ready offers Off, 2, 3 or 5 seconds and saves your choice locally. The one-bar count-in can override the lead-in length for starts, repeats and resumes.

The falling-note view uses a bright vertical bracket along its left edge, with START / END labels and arrows for offscreen boundaries, and dims the region outside the current section. A fixed label identifies the checkpoint, active loop or current passage even when its boundaries are offscreen. Draft A/B marks are dashed and labeled as unapplied; active boundaries are solid. Scrolling keeps the section visible in the roll and the full-piece timeline.

## Run feedback

The player header shows a segmented repetition track and a thin current-run note progress bar. A newly saved completed run lights the next segment and briefly displays **+1 run completed!**. Reaching the target turns the track gold and shows **Checkpoint cleared!**, while the next checkpoint starts automatically in the same player. Failed or unsaved runs earn no segment; reloading saved progress does not replay a celebration. Reduced-motion preferences disable the pulse animation. Feedback stays in the header and never overlays the keyboard.

Playback speed is remembered across checkpoints and reloads. Adjusting speed keeps the quest active and does not disqualify a run.

## Manual completion and cumulative reviews

Click the completed-run counter in the player header, then choose **Mark complete & next** in the confirmation. This saves an explicit manual completion and starts the next checkpoint with preparation. It preserves actual attempt/run counts and does not create a performed session. If saving fails, retry before advancing.

After each additional short passage in a musical section, practice from the section start through that passage with both hands: 3–4 → 1–4, 5–6 → 1–6, 7–8 → 1–8. Reviews reset at the next section, starting at bar 9 in this edition. The 11 existing musical sections are at most eight bars, below the ten-bar cap. Each review has the same ten-run goal and can be marked complete manually. Previous passage results survive the bundled plan upgrade; newly inserted reviews begin unfinished.

The player header includes a whole-piece journey bar above the checkpoint selector: one segment per musical section, a cleared-checkpoint count, and overall progress including partial repetitions. The current section is outlined; completed sections turn gold. Manual completions advance the journey without creating played attempts. It occupies the existing header space.

Checkpoint changes show a four-second New quest cue with bars and selected hands in the existing header. Successful repetitions show Continue with the upcoming run number. Both cues dismiss automatically; preparation and playback continue without a click. Reduced-motion users receive the same text without animation.

## Sheet-only practice

In the player, enable **Sheet music**, then **Sheet only** in the score toolbar. The score takes the available practice area and scrolls through full grand-staff systems; the roll and virtual keyboard are hidden. The same quests, MIDI matching, speed, preparation and transport continue. Toggle Sheet only off to restore the combined view. Zoom and view choices persist; the score stays white.

Pathétique has note-position anchors in 58 of 73 bars. A blue cursor marks the current MIDI onset on the PDF; the vertical line alone guides reading, without rings over printed noteheads. Wait mode requires the entire chord before progressing. Other bars show the current bar and say Following bar. Note positions come from PDF vector glyphs checked against MIDI onset order and staff pitch, rather than a linear sweep across a bar. See the [preparation method](../.agents/skills/prepare-piano-piece/references/pdf-and-timing.md) and [alignment report](../public/scores/pathetique-ii/note-alignment-report.json). This is prepared alignment for the bundled edition, not arbitrary-PDF recognition.

In sheet-only mode, wheel scrolling selects the printed note under the pointer after the scroll; clicking a note selects it directly. Arrows select the first bar of the previous/next system. The Resume here marker identifies the pending position. Resume uses that note onset, while unmatched PDF bars select their bar start. Ordinary pause/resume without browsing retains the paused position.

Wrong pressed notes are shown in red on the sheet, with accidentals and a Played label. Staff geometry and active clefs position pitches that are absent from the PDF at the current onset. The vertical cursor identifies the expected chord, and the status reports how many keys are held. Each wrong marker disappears on that key’s release (including velocity-zero note-off), restart or disconnect. Multiple wrong keys stay visible when another correct key is added. Bar-only alignment, transposed scores and out-of-crop pitches use a red note-name label without inventing a staff position. Mistakes still do not cancel a fully completed run.

The score toolbar’s **Wrong notes** toggle controls the red pressed-note markers and their Played label. It defaults on and remembers the setting across reloads. Turning it off leaves expected-note highlighting and MIDI scoring active.

Each quest can optionally set `repetitions` (1–100), overriding the plan default. New passages use ten completed runs; cumulative and full-section reviews use five. The bundled upgrade preserves existing runs and manual completions; reviews with at least five earned runs become complete.

To undo completion, select the completed checkpoint in the header, click its run counter, and confirm **Reset quest**. Its completed bar displays full even for a manual skip. Reset clears only that quest’s run tally and completion; later results and session history remain saved, and previously unlocked checkpoints stay available after reset and reload.
