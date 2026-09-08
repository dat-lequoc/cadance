import type { PracticeController } from "./usePracticeController";
import { Icon, duration } from "./shared";
import {
  DisplayOptions,
  MoreOptions,
  SoundOptions,
  Speed,
} from "./PracticeOptions";
import PartsPanel from "./PartsPanel";
import QuestPanel from "./QuestPanel";
import { type Config } from "../core/model";
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="segmented">
        {options.map(([id, text]) => (
          <button
            key={id}
            className={id === value ? "selected" : ""}
            aria-pressed={id === value}
            onClick={() => onChange(id)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export default function SetupView({ c }: { c: PracticeController }) {
  const { song, config, engine, loops } = c;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR NEXT PRACTICE</div>
          <h1>{song.title}</h1>
          <p>{song.composer || "Your imported piece"}</p>
        </div>
        <button
          className="secondary"
          disabled={c.busy}
          onClick={() => c.fileRef.current?.click()}
        >
          <Icon name="upload" />
          Import MIDI
        </button>
      </div>
      <div className="setup-layout">
        <section className="setup-card" aria-label="Practice setup">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Make it your practice.</h2>
              <p>Choose what to play. We’ll follow your pace.</p>
            </div>
          </div>
          <fieldset>
            <legend>How do you want to practice?</legend>
            <div className="mode-choices">
              {(
                [
                  [
                    "wait",
                    "Wait for notes",
                    "The piece waits until you find each note.",
                  ],
                  [
                    "rhythm",
                    "Practice rhythm",
                    "Keep time with the moving notes.",
                  ],
                  [
                    "recital",
                    "Recital",
                    "Play through and review your performance.",
                  ],
                ] as const
              ).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  aria-pressed={
                    (config.mode === "listen"
                      ? c.practiceMode
                      : config.mode) === mode
                  }
                  className={
                    (config.mode === "listen"
                      ? c.practiceMode
                      : config.mode) === mode
                      ? "selected"
                      : ""
                  }
                  onClick={() => c.selectMode(mode)}
                >
                  <span className="choice-dot" />
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="selection-grid">
            <Choice
              label="Hand"
              value={config.hand}
              options={[
                ["both", "Both hands"],
                ["left", "Left hand"],
                ["right", "Right hand"],
              ]}
              onChange={(hand) => c.configure({ hand })}
            />
            <Choice
              label="Part"
              value={config.focus ?? "all"}
              options={[
                ["all", "All notes"],
                ["melody", "Melody line"],
                ["harmony", "Harmonies"],
              ]}
              onChange={(focus) => c.configure({ focus } as Partial<Config>)}
            />
          </div>
          <div className="setup-tempo">
            <Speed c={c} />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.scheduler.accompaniment}
                onChange={(e) => {
                  c.scheduler.accompaniment = e.target.checked;
                  engine.epoch++;
                  c.redraw((v) => v + 1);
                }}
              />
              Play the other parts for me
            </label>
          </div>
          <label>
            Passage
            <select
              aria-label="Practice passage"
              value={
                loops.saved.find(
                  (l) =>
                    engine.loop?.[0] === l.start && engine.loop?.[1] === l.end,
                )?.id ?? (engine.loop ? "custom" : "whole")
              }
              onChange={(e) => {
                const loop = loops.saved.find((l) => l.id === e.target.value);
                if (loop) loops.open(loop);
                else engine.selectPassage(0, song.duration);
              }}
            >
              <option value="whole">Whole piece</option>
              {engine.loop && (
                <option value="custom">
                  Current loop · {duration(engine.loop[0])}–
                  {duration(engine.loop[1])}
                </option>
              )}
              {loops.saved.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {duration(l.start)}–{duration(l.end)}
                </option>
              ))}
            </select>
          </label>
          <div className="readiness">
            <span
              className={
                c.source === "none" ? "connection-dot" : "connection-dot online"
              }
            />
            <span>
              {c.source === "none"
                ? "Connect a piano when you start"
                : c.source === "simulated"
                  ? "Simulated input · computer sound"
                  : c.hardware.connected
                    ? "MIDI piano ready"
                    : "Piano disconnected"}
            </span>
            <button onClick={() => c.setModal(true)}>Change</button>
          </div>
          <p className="target-count">
            {engine.targets.length} target notes ·{" "}
            {config.hand === "both" ? "both hands" : config.hand + " hand"} ·{" "}
            {config.focus === "harmony"
              ? "harmonies"
              : config.focus === "melody"
                ? "melody"
                : "all notes"}
          </p>
          {c.warnings.length > 0 && (
            <p className="warning">
              {c.warnings.length} notes are outside your piano range. Adjust
              Range & matching in Settings.
            </p>
          )}
          {!engine.targets.length &&
            !["listen", "free"].includes(config.mode) && (
              <p className="warning">
                No notes in this selection. Choose another hand or part.
              </p>
            )}
          <button
            className="primary start-button"
            aria-label="Start practice"
            disabled={
              !engine.targets.length &&
              !["listen", "free"].includes(config.mode)
            }
            onClick={c.startPractice}
          >
            <Icon name="play" />
            {engine.status === "paused" && config.mode !== "listen"
              ? "Resume practice"
              : config.mode === "listen"
                ? "Start practice"
                : config.mode === "free"
                  ? "Start free play"
                  : "Start practice"}
            <span>Enter your focus space →</span>
          </button>
        </section>
        <aside className="piece-preview">
          <div className="score-preview" aria-label="Piece preview">
            <div className="preview-heading">
              <span>THE MUSIC, FRONT AND CENTER</span>
              <span>01 / {loops.bars.length}</span>
            </div>
            <svg
              viewBox="0 0 480 270"
              aria-hidden="true"
              preserveAspectRatio="xMidYMid slice"
            >
              {Array.from({ length: 16 }, (_, i) => (
                <line
                  key={i}
                  x1={i * 32}
                  x2={i * 32}
                  y1="0"
                  y2="270"
                  stroke="#263c51"
                />
              ))}
              {song.notes
                .filter((n) => n.time < 8)
                .slice(0, 65)
                .map((n, i) => (
                  <rect
                    key={i}
                    x={((n.pitch - 36) / 48) * 480}
                    y={240 - n.time * 28 - n.duration * 28}
                    width="18"
                    height={Math.max(6, n.duration * 28 - 2)}
                    rx="3"
                    fill={n.hand === "left" ? "#59b3ff" : "#ffc15a"}
                  />
                ))}
              <line x1="0" x2="480" y1="250" y2="250" stroke="#c6d6e7" />
            </svg>
            <div className="preview-legend">
              <span>
                <i className="left-dot" />
                Left hand
              </span>
              <span>
                <i className="right-dot" />
                Right hand
              </span>
            </div>
          </div>
          <div className="piece-info">
            <span>{duration(song.duration)} duration</span>
            <span>{Math.round(song.tempos[0]?.bpm ?? 120)} BPM</span>
            <span>{loops.bars.length} bars</span>
          </div>
          <button
            aria-label={
              config.mode === "listen" && c.active
                ? "Pause listening"
                : "Listen"
            }
            className="secondary wide listen-button"
            onClick={c.listen}
          >
            <Icon name="volume" />
            {config.mode === "listen" && c.active
              ? "Pause listening"
              : "Listen"}
            <span>Hear your selected parts</span>
          </button>
          {song.scoreUrl && (
            <a
              className="score-link"
              href={song.scoreUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="book" />
              Full sheet music ↗
            </a>
          )}
          <QuestPanel c={c} />
          <div className="setup-tools">
            <PartsPanel song={song} onChange={c.saveParts} />
            <details>
              <summary>
                Display <span>Keys, labels & note size</span>
              </summary>
              <DisplayOptions c={c} />
            </details>
            <details>
              <summary>
                Sound <span>Metronome & monitoring</span>
              </summary>
              <SoundOptions c={c} />
            </details>
            <details>
              <summary>
                More practice settings{" "}
                <span>Count-in, adaptive speed & notation</span>
              </summary>
              <MoreOptions c={c} />
            </details>
          </div>
          <button
            aria-label="Free play"
            className="free-play-link"
            onClick={() => {
              c.selectMode("free");
              void c.play();
            }}
          >
            Free play <span>Just you and the keys →</span>
          </button>
        </aside>
      </div>
    </>
  );
}
