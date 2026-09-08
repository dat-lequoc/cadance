import type { LoopState } from "./useLoops";
import type { PracticeEngine } from "../core/engine";
import { duration } from "./shared";
export default function LoopPanel({
  loops: l,
  engine,
}: {
  loops: LoopState;
  engine: PracticeEngine;
}) {
  const startBar = l.bars.findLast((bar) => bar.start <= l.a)?.number ?? 1;
  const endBar =
    l.bars.find((bar) => bar.end >= l.b - 0.001)?.number ?? l.bars.length;
  return (
    <section className="loop-panel" aria-label="Passage loops">
      <p>Isolate a phrase. Repeat it until it feels natural.</p>
      <div className="field-pair">
        <label>
          Start · A
          <input
            aria-label="Loop start seconds"
            type="number"
            step="0.1"
            min="0"
            max={engine.song.duration}
            value={Number(l.a.toFixed(3))}
            onChange={(e) => l.editA(Number(e.target.value))}
            onBlur={(e) => l.editA(Number(e.target.value))}
          />
        </label>
        <label>
          End · B
          <input
            aria-label="Loop end seconds"
            type="number"
            step="0.1"
            min="0"
            max={engine.song.duration}
            value={Number(l.b.toFixed(3))}
            onChange={(e) => l.editB(Number(e.target.value))}
            onBlur={(e) => l.editB(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="field-pair">
        <label>
          From bar
          <select
            aria-label="Loop first bar"
            value={startBar}
            onChange={(e) => l.editA(l.bars[Number(e.target.value) - 1].start)}
          >
            {l.bars.map((bar) => (
              <option key={bar.number}>{bar.number}</option>
            ))}
          </select>
        </label>
        <label>
          Through bar
          <select
            aria-label="Loop last bar"
            value={endBar}
            onChange={(e) => l.editB(l.bars[Number(e.target.value) - 1].end)}
          >
            {l.bars.map((bar) => (
              <option key={bar.number}>{bar.number}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={l.snap}
          onChange={(e) => l.setSnap(e.target.checked)}
        />
        Snap to bars
      </label>
      <button
        className="secondary wide"
        disabled={!l.valid}
        onClick={() => l.apply()}
      >
        Apply loop
      </button>
      {engine.loop && (
        <button className="secondary wide" onClick={l.toggle}>
          Turn loop off
        </button>
      )}
      <div className="loop-notice" role="status">
        {l.b <= l.a
          ? "B must come after A."
          : l.notice || "Set both A and B to create a passage."}
      </div>
      <label>
        Passage name
        <input
          aria-label="Loop name"
          placeholder="Opening phrase…"
          maxLength={80}
          value={l.name}
          onChange={(e) => l.setName(e.target.value)}
        />
      </label>
      <button
        className="primary wide"
        disabled={!l.valid || l.saving}
        onClick={() => void l.save()}
      >
        {l.saving ? "Saving…" : l.editing ? "Save loop changes" : "Create loop"}
      </button>
      <div className="saved-loops">
        <h3>Saved passages</h3>
        {!l.saved.length && <p>No saved passages yet.</p>}
        {l.saved.map((loop) => (
          <div className="saved-loop" key={loop.id}>
            <button className="saved-loop-main" onClick={() => l.open(loop)}>
              <strong>{loop.name}</strong>
              <small>
                {duration(loop.start)}–{duration(loop.end)}
              </small>
            </button>
            <button
              aria-label={`Rename loop ${loop.name}`}
              onClick={() => l.rename(loop)}
            >
              Edit
            </button>
            <button
              aria-label={`Delete loop ${loop.name}`}
              onClick={() => void l.remove(loop.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
