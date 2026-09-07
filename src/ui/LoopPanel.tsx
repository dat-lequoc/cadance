import { useEffect, useMemo, useState, useRef } from "react";
import { PracticeEngine } from "../core/engine";
import {
  createLoop,
  measures,
  validLoops,
  type SavedLoop,
} from "../core/loops";
import { db } from "../core/storage";
const stamp = (n: number) =>
  `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, "0")}`;
export default function LoopPanel({
  engine,
  onError,
}: {
  engine: PracticeEngine;
  onError: (e: unknown) => void;
}) {
  const song = engine.song;
  const bars = useMemo(() => measures(song), [song]);
  const [a, setA] = useState(0),
    [b, setB] = useState(song.duration),
    [name, setName] = useState(""),
    [saved, setSaved] = useState<SavedLoop[]>([]),
    [snap, setSnap] = useState(true),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    let alive = true;
    setA(0);
    setB(song.duration);
    setName("");
    setEditing(null);
    setSaved([]);
    setNotice("");
    db.settings
      .get("loops:" + song.id)
      .then((v) => {
        if (alive) setSaved(validLoops(v?.value, song));
      })
      .catch(onError);
    return () => {
      alive = false;
    };
  }, [song.id]);
  const current = () =>
    Math.max(0, Math.min(song.duration, engine.currentPosition()));
  const markA = () => {
    const pos = current(),
      bar = bars.findLast((m) => m.start <= pos);
    const value = snap && bar ? bar.start : pos;
    setA(value);
    setNotice(
      `A marked at ${stamp(value)}. Move to the end of the passage and mark B.`,
    );
  };
  const markB = () => {
    const pos = current(),
      bar = bars.find((m) => pos >= m.start && pos < m.end);
    const value = snap && bar ? bar.end : pos;
    setB(value);
    setNotice(`B marked at ${stamp(value)}.`);
  };
  const apply = (start: number, end: number) => {
    const resume = ["playing", "waiting"].includes(engine.status);
    engine.selectPassage(start, end, true);
    if (resume) engine.start();
    setNotice(`Loop active · ${stamp(start)}–${stamp(end)}`);
  };
  const save = async () => {
    setSaving(true);
    const revision = generation.current;
    try {
      const loop = createLoop(
        song,
        name || `Passage ${saved.length + 1}`,
        a,
        b,
      );
      const next = editing
        ? saved.map((v) => (v.id === editing ? { ...loop, id: editing } : v))
        : [...saved, loop];
      await db.settings.put({ key: "loops:" + song.id, value: next });
      if (revision !== generation.current) return;
      setSaved(next);
      setName("");
      setEditing(null);
      apply(a, b);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };
  const disable = () => {
    const pos = current(),
      resume = ["playing", "waiting"].includes(engine.status);
    engine.seek(pos, false);
    if (resume) engine.start();
    setNotice("Loop off. Playback continues from the current position.");
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest("input,select,textarea,button") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (e.key === "[") {
        e.preventDefault();
        markA();
      }
      if (e.key === "]") {
        e.preventDefault();
        markB();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const startBar = bars.findLast((m) => m.start <= a)?.number ?? 1,
    endBar = bars.find((m) => m.end >= b - 0.001)?.number ?? bars.length;
  return (
    <section className="loop-panel" aria-label="Passage loops">
      <div className="loop-heading">
        <div>
          <h3>Practice a passage</h3>
          <p>Mark the start and end, then save a loop. Shortcuts: [ and ].</p>
        </div>
        <button
          className={engine.loop ? "loop-state active" : "loop-state"}
          aria-pressed={!!engine.loop}
          onClick={() => {
            try {
              engine.loop ? disable() : apply(a, b);
            } catch (e) {
              onError(e);
            }
          }}
        >
          {engine.loop ? "↻ Loop on · turn off" : "↻ Loop off"}
        </button>
      </div>
      <div className="loop-markers">
        <button className="secondary" onClick={markA}>
          <b>A</b> Mark A
        </button>
        <label>
          Start
          <input
            aria-label="Loop start seconds"
            type="number"
            step="0.1"
            min="0"
            max={song.duration}
            value={Number(a.toFixed(3))}
            onChange={(e) => setA(Number(e.target.value))}
          />
        </label>
        <button className="secondary" onClick={markB}>
          <b>B</b> Mark B
        </button>
        <label>
          End
          <input
            aria-label="Loop end seconds"
            type="number"
            step="0.1"
            min="0"
            max={song.duration}
            value={Number(b.toFixed(3))}
            onChange={(e) => setB(Number(e.target.value))}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
          />
          Snap to bars
        </label>
      </div>
      <div
        className="loop-range"
        style={
          {
            "--a": `${(a / song.duration) * 100}%`,
            "--b": `${(b / song.duration) * 100}%`,
          } as React.CSSProperties
        }
      >
        <div className="loop-selection" />
        <input
          aria-label="Drag loop start"
          type="range"
          min="0"
          max={song.duration}
          step="0.01"
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
        />
        <input
          aria-label="Drag loop end"
          type="range"
          min="0"
          max={song.duration}
          step="0.01"
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
        />
      </div>
      <div className="loop-create">
        <label>
          From bar
          <select
            aria-label="Loop first bar"
            value={startBar}
            onChange={(e) => setA(bars[Number(e.target.value) - 1].start)}
          >
            {bars.map((m) => (
              <option key={m.number}>{m.number}</option>
            ))}
          </select>
        </label>
        <label>
          Through bar
          <select
            aria-label="Loop last bar"
            value={endBar}
            onChange={(e) => setB(bars[Number(e.target.value) - 1].end)}
          >
            {bars.map((m) => (
              <option key={m.number}>{m.number}</option>
            ))}
          </select>
        </label>
        <input
          aria-label="Loop name"
          placeholder="Name this passage…"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="play-button"
          disabled={
            saving ||
            !Number.isFinite(a) ||
            !Number.isFinite(b) ||
            b - a < 0.1 ||
            a < 0 ||
            b > song.duration
          }
          onClick={() => void save()}
        >
          {editing ? "Save loop changes" : "Create loop"}
        </button>
      </div>
      <div className="loop-notice" aria-live="polite">
        {b <= a
          ? "B must come after A."
          : notice || `${stamp(a)}–${stamp(b)} · bars ${startBar}–${endBar}`}
      </div>
      {saved.length > 0 && (
        <div className="saved-loops">
          {saved.map((loop) => (
            <div className="saved-loop" key={loop.id}>
              <button
                onClick={() => {
                  setA(loop.start);
                  setB(loop.end);
                  try {
                    apply(loop.start, loop.end);
                  } catch (e) {
                    onError(e);
                  }
                }}
              >
                <strong>{loop.name}</strong>
                <span>
                  {stamp(loop.start)}–{stamp(loop.end)}
                </span>
              </button>
              <button
                aria-label={"Rename loop " + loop.name}
                title="Rename loop"
                onClick={() => {
                  setEditing(loop.id);
                  setName(loop.name);
                  setA(loop.start);
                  setB(loop.end);
                  setNotice(
                    "Edit this loop’s name or range, then save your changes.",
                  );
                }}
              >
                ✎
              </button>
              <button
                aria-label={"Delete loop " + loop.name}
                title="Delete loop"
                onClick={() => {
                  const next = saved.filter((v) => v.id !== loop.id);
                  db.settings
                    .put({ key: "loops:" + song.id, value: next })
                    .then(() => setSaved(next))
                    .catch(onError);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
