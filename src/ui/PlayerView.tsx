import { useEffect, useState, type CSSProperties } from "react";
import type { PracticeController } from "./usePracticeController";
import Roll from "./Roll";
import ScoreStrip from "./ScoreStrip";
import { preparedScoreFor } from "../core/scores";
import type { PreparedScore } from "../core/score";
import { noteName } from "../core/model";
import DebugControls from "./DebugControls";
import Dialog from "./Dialog";
import LoopPanel from "./LoopPanel";
import { QuestStatus } from "./QuestPanel";
import { DisplayOptions, SoundOptions, Speed } from "./PracticeOptions";
import { questBounds } from "../core/quests";
import { Icon, duration, modeName } from "./shared";

function Timeline({
  c,
  position,
  onSeek,
}: {
  c: PracticeController;
  position?: number | null;
  onSeek: () => void;
}) {
  const [seek, setSeek] = useState<number | null>(null);
  const l = c.loops,
    total = c.song.duration;
  const quest = c.quests.runner.active ?? c.quests.runner.next;
  const range = quest ? questBounds(c.song, quest) : null;
  const commit = () => {
    if (seek !== null) {
      onSeek();
      c.seek(seek);
      setSeek(null);
    }
  };
  return (
    <div className="player-timeline">
      <span className="time-stamp">
        {duration(Math.max(0, seek ?? position ?? c.engine.position))}
      </span>
      <div
        className="timeline-track"
        style={
          {
            "--loop-a": `${(l.a / total) * 100}%`,
            "--loop-b": `${(l.b / total) * 100}%`,
            "--playhead": `${(Math.max(0, seek ?? position ?? c.engine.position) / total) * 100}%`,
          } as CSSProperties
        }
      >
        <div className="timeline-base" />
        {range && (
          <div
            className="quest-range"
            aria-label={`Checkpoint bars ${quest!.fromBar}–${quest!.throughBar}`}
            style={{
              left: `${(range[0] / total) * 100}%`,
              width: `${((range[1] - range[0]) / total) * 100}%`,
            }}
          />
        )}
        {l.marked.a && l.marked.b && (
          <div
            className={"timeline-selection" + (c.engine.loop ? " enabled" : "")}
          />
        )}
        <div className="bar-ticks">
          {l.bars
            .filter(
              (_, i) => i % Math.max(1, Math.ceil(l.bars.length / 12)) === 0,
            )
            .map((bar) => (
              <span
                key={bar.number}
                style={{ left: `${(bar.start / total) * 100}%` }}
              >
                {bar.number}
              </span>
            ))}
        </div>
        <input
          className="seek-input"
          aria-label="Song position"
          type="range"
          min="0"
          max={total}
          step=".01"
          value={seek ?? Math.max(0, position ?? c.engine.position)}
          onPointerDown={c.pause}
          onChange={(e) => setSeek(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        {(["a", "b"] as const).map(
          (edge) =>
            l.marked[edge] && (
              <div key={edge} className="loop-handle-wrap">
                <span
                  className="marker-label"
                  style={{ left: `${(l[edge] / total) * 100}%` }}
                >
                  {edge.toUpperCase()}
                </span>
                <input
                  aria-label={
                    edge === "a" ? "Drag loop start" : "Drag loop end"
                  }
                  className="loop-handle"
                  type="range"
                  min="0"
                  max={total}
                  step=".01"
                  value={l[edge]}
                  onPointerDown={c.pause}
                  onChange={(e) =>
                    (edge === "a" ? l.editA : l.editB)(Number(e.target.value))
                  }
                  onPointerUp={(e) =>
                    (edge === "a" ? l.editA : l.editB)(
                      l.snapValue(Number(e.currentTarget.value), edge),
                    )
                  }
                  onKeyDown={(e) => {
                    if (!e.key.startsWith("Arrow") || !l.snap) return;
                    e.preventDefault();
                    c.pause();
                    const forward =
                      e.key === "ArrowRight" || e.key === "ArrowUp";
                    const boundaries =
                      edge === "a"
                        ? l.bars.map((bar) => bar.start)
                        : l.bars.map((bar) => bar.end);
                    const next = forward
                      ? boundaries.find((value) => value > l[edge] + 0.02)
                      : boundaries.findLast((value) => value < l[edge] - 0.02);
                    if (next !== undefined)
                      (edge === "a" ? l.editA : l.editB)(next);
                  }}
                />
              </div>
            ),
        )}
      </div>
      <span className="time-stamp">{duration(total)}</span>
    </div>
  );
}
export default function PlayerView({ c }: { c: PracticeController }) {
  const { browsePosition, scroll } = c;
  const [scoreState, setScoreState] = useState<{
    song: typeof c.song;
    score: PreparedScore;
  } | null>(null);
  const score = scoreState?.song === c.song ? scoreState.score : null;
  useEffect(() => {
    let cancelled = false;
    void preparedScoreFor(c.song)
      .then((score) => {
        if (!cancelled) setScoreState(score ? { song: c.song, score } : null);
      })
      .catch(() => {
        if (!cancelled) setScoreState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [c.song]);
  const [full, setFull] = useState(!!document.fullscreenElement);
  const [fullNotice, setFullNotice] = useState("");
  const [landscape, setLandscape] = useState(true);
  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else
        await document.querySelector<HTMLElement>(".app")!.requestFullscreen();
      setFullNotice("");
    } catch {
      setFullNotice(
        "Fullscreen is unavailable. You can keep playing in this window.",
      );
    }
  };
  const back = () => {
    c.navigate("setup");
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  };
  const quest = c.quests.runner.active;
  const section = c.engine.loop
    ? {
        start: c.engine.loop[0],
        end: c.engine.loop[1],
        label: "Active loop",
        draft: false,
      }
    : quest
      ? {
          start: c.engine.passage[0],
          end: c.engine.passage[1],
          label: `Checkpoint · bars ${quest.fromBar}–${quest.throughBar}`,
          draft: false,
        }
      : (c.loops.marked.a || c.loops.marked.b) &&
          (!c.loops.marked.a || !c.loops.marked.b || c.loops.valid)
        ? {
            start: c.loops.marked.a ? c.loops.a : 0,
            end: c.loops.marked.b ? c.loops.b : c.song.duration,
            startMarked: c.loops.marked.a,
            endMarked: c.loops.marked.b,
            label:
              c.loops.marked.a && c.loops.marked.b
                ? "Marked A–B · not applied"
                : c.loops.marked.a
                  ? "A marked · choose B"
                  : "B marked · choose A",
            draft: true,
          }
        : c.engine.passage[0] > 0 || c.engine.passage[1] < c.song.duration
          ? {
              start: c.engine.passage[0],
              end: c.engine.passage[1],
              label: "Current passage",
              draft: false,
            }
          : null;
  const sheetOnly = !!score && c.sheetMusic && c.sheetOnly && c.config.mode !== "free";
  const preparing = c.engine.preparationRemaining;
  const feedback =
    preparing > 0
      ? `${c.engine.status === "paused" ? c.engine.feedback : c.quests.runner.active && c.quests.runner.message === "Run complete!" ? "Run complete ✓ · Get ready" : c.quests.runner.active && c.quests.runner.message.startsWith("Try again") ? `${c.quests.runner.message} Get ready` : "Get ready"} · ${Math.ceil(preparing)} — place your hands, then follow the notes.`
      : c.engine.status === "waiting"
        ? c.engine.lastWrong !== null
          ? c.engine.feedback
          : `Your turn — play the highlighted notes. Required: ${[...new Set(c.engine.group?.notes.map((n) => noteName(n.pitch)) ?? [])].join(" + ")}.${c.engine.partial.size ? ` ${c.engine.partial.size} of ${c.engine.group?.notes.length} keys held` : ""}`
        : c.engine.status === "paused"
          ? c.engine.feedback
          : c.engine.lastWrong !== null
            ? c.engine.feedback
            : c.engine.status === "ready"
              ? "Ready when you are. Press P to begin."
              : "";
  return (
    <div className="player" data-testid="focused-player">
      <header className="player-header" inert={!!c.panel || undefined}>
        <button className="back-button" onClick={back}>
          ← <span>Setup</span>
        </button>
        <div className="player-title">
          <strong>{c.song.title}</strong>
          <span>
            {modeName(c.config.mode)} ·{" "}
            {c.config.hand === "both" ? "Both hands" : c.config.hand + " hand"}{" "}
            ·{" "}
            {c.config.focus === "harmony"
              ? "Harmonies"
              : c.config.focus === "melody"
                ? "Melody"
                : "All notes"}
          </span>
        </div>
        <span
          className={`hand-badge hand-${c.config.hand}`}
          aria-label={`Active hand: ${c.config.hand === "both" ? "Both hands" : c.config.hand === "right" ? "Right hand" : "Left hand"}`}
          title={c.config.hand === "both" ? "Both hands active" : `${c.config.hand === "right" ? "Right" : "Left"} hand active`}
        >
          {c.config.hand === "both" ? "↔ Both" : c.config.hand === "right" ? "R Right" : "L Left"}
        </span>
        <QuestStatus c={c} />
        {c.config.mode !== "free" && (
          <button
            className="sheet-toggle"
            aria-pressed={!!score && c.sheetMusic}
            disabled={!score}
            title={
              score
                ? "Show aligned sheet music"
                : "No aligned sheet music prepared for this MIDI"
            }
            onClick={() => c.setSheetMusic(!c.sheetMusic)}
          >
            Sheet music
          </button>
        )}
        <button
          className="player-device"
          aria-label="Connect your piano"
          onClick={() => c.setModal(true)}
        >
          <i
            className={
              c.source === "none" ? "connection-dot" : "connection-dot online"
            }
          />
          <span>
            {c.source === "simulated"
              ? "Simulated"
              : c.hardware.connected
                ? "Piano connected"
                : "Connect piano"}
          </span>
        </button>
        <button
          className="fullscreen-button"
          aria-label={full ? "Exit fullscreen" : "Enter fullscreen"}
          title={full ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={() => void fullscreen()}
        >
          {full ? "↙" : "⛶"}
        </button>
      </header>
      {score && c.sheetMusic && c.config.mode !== "free" && (
        <ScoreStrip key={score.fingerprint} c={c} score={score} />
      )}
      {!sheetOnly && <div className="stage" inert={!!c.panel || undefined}>
        <Roll
          engine={c.engine}
          min={c.viewMin}
          max={c.viewMax}
          press={c.press}
          release={c.release}
          visualOffset={c.visualOffset}
          labels={c.labels}
          showBackground={c.showBackground}
          zoom={c.zoom}
          accompaniment={c.scheduler.accompaniment}
          section={section}
          viewPosition={browsePosition}
          scroll={scroll}
        />
        {section && (
          <div className="stage-section" aria-label="Falling notes section">
            <strong>{section.label}</strong>
            <span>
              A {duration(section.start)} → B {duration(section.end)}
            </span>
          </div>
        )}
        <div className="stage-legend">
          <span>
            <i className="left-dot" />
            Left hand
          </span>
          <span>
            <i className="right-dot" />
            Right hand
          </span>
          {c.config.mode === "wait" && <span>● Play · ○ Accompaniment</span>}
        </div>
        {c.config.mode === "free" && (
          <span className="free-recording">
            {c.active ? "● Recording" : "Free play"} · A W S E D F T G Y H U J K
          </span>
        )}
        {fullNotice && (
          <div className="stage-notice" role="status">
            {fullNotice}
            <button
              aria-label="Dismiss fullscreen notice"
              onClick={() => setFullNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {landscape && (
          <div className="landscape-tip">
            More room in landscape
            <button
              aria-label="Dismiss landscape suggestion"
              onClick={() => setLandscape(false)}
            >
              ×
            </button>
          </div>
        )}
      </div>}
      <div className="player-dock" inert={!!c.panel || undefined}>
        {browsePosition !== null && (
          <div className="roll-preview" role="status">
            <span>Resume here · {duration(c.resumePosition ?? 0)}</span>
            <button onClick={() => c.backToPlayhead()}>Back to playhead</button>
            <button
              onClick={() => {
                c.playFromPreview();
              }}
            >
              Play from here
            </button>
          </div>
        )}
        {c.config.mode !== "free" && (
          <Timeline
            c={c}
            position={browsePosition}
            onSeek={() => c.backToPlayhead()}
          />
        )}
        <div className="dock-controls">
          <div className="transport-main">
            <button
              title="Restart (R)"
              aria-label="Restart"
              onClick={() => {
                c.restart();
              }}
            >
              <Icon name="back" />
            </button>
            <button
              className="primary transport-play"
              data-state={c.active ? "playing" : c.engine.status === "paused" ? "paused" : "ready"}
              disabled={
                c.updating ||
                c.quests.runner.saving ||
                !!c.quests.runner.error ||
                (c.quests.runner.completed && c.engine.status === "finished")
              }
              title={c.active ? "Playing — pause (Space / P)" : c.engine.status === "paused" ? "Paused — resume (Space / P)" : "Start playing (Space / P)"}
              aria-label={c.active ? "Pause practice" : "Start practice"}
              onClick={() => void c.play()}
            >
              <Icon name={c.active ? "pause" : "play"} />
              {c.active
                ? "Pause"
                : c.engine.status === "paused"
                  ? "Resume"
                  : "Play"}
            </button>
            <button aria-label="Listen forward from here" onClick={() => void c.listenSection()} disabled={c.active || c.quests.runner.saving}>
              ♫ Listen forward
            </button>
            <button aria-label="Finish practice" onClick={c.finish}>
              Finish
            </button>
          </div>
          <div className="dock-options">
            {feedback && browsePosition === null && (
              <div
                className={
                  "stage-feedback" +
                  (c.engine.lastWrong !== null ? " wrong" : "")
                }
                role="status"
              >
                {feedback}
              </div>
            )}
            {c.config.mode !== "free" && (
              <>
                <Speed c={c} />
                <div className="quick-loops">
                  <button
                    title="Mark A ([)"
                    aria-label="Mark A"
                    aria-pressed={c.loops.marked.a}
                    onClick={c.loops.markA}
                  >
                    A
                  </button>
                  <button
                    title="Mark B (])"
                    aria-label="Mark B"
                    aria-pressed={c.loops.marked.b}
                    onClick={c.loops.markB}
                  >
                    B
                  </button>
                  <button
                    title="Toggle loop (L)"
                    aria-label="Toggle loop"
                    aria-pressed={!!c.engine.loop}
                    disabled={!c.loops.valid && !c.engine.loop}
                    onClick={c.loops.toggle}
                  >
                    <Icon name="loop" />
                    <span>Loop</span>
                  </button>
                </div>
                <button onClick={() => c.openPanel("passages")}>
                  Passages
                </button>
              </>
            )}
            <button onClick={() => c.openPanel("tools")}>
              <Icon name="settings" />
              <span>Tools</span>
            </button>
          </div>
        </div>
      </div>
      {c.panel && (
        <Dialog
          title={c.panel === "tools" ? "Player tools" : "Passages"}
          onClose={() => c.setPanel(null)}
        >
          {c.panel === "passages" ? (
            <LoopPanel loops={c.loops} engine={c.engine} />
          ) : (
            <>
              <h3>Getting ready</h3>
              <label className="preparation-setting">
                Preparation before starts and repeats
                <select
                  aria-label="Preparation time"
                  value={c.engine.preparationSeconds}
                  onChange={(e) => c.setPreparation(Number(e.target.value))}
                >
                  <option value="0">Off</option>
                  <option value="2">2 seconds</option>
                  <option value="3">3 seconds</option>
                  <option value="5">5 seconds</option>
                </select>
              </label>
              <p className="preparation-help">
                P pauses preparation. Restart returns to the passage start; Play
                gives you a fresh lead-in. Listening starts immediately.
              </p>
              <h3>Display</h3>
              <DisplayOptions c={c} />
              <h3>Sound</h3>
              <SoundOptions c={c} />
              <h3>MIDI diagnostics</h3>
              <DebugControls c={c} />
              <details className="shortcut-help">
                <summary>Keyboard shortcuts</summary>
                <p>
                  Space / P · Play/pause
                  <br />R · Restart
                  <br />[ / ] · Mark A/B
                  <br />L · Loop
                  <br />
                  Escape · Close panel or pause
                  <br />
                  Shift · Sustain with simulated input
                </p>
                <p>Music keeps playing when you switch tabs or windows.</p>
              </details>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
