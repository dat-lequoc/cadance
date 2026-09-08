import type { PracticeController } from "./usePracticeController";
import Staff from "./Staff";
export function Speed({ c }: { c: PracticeController }) {
  return (
    <label className="speed">
      Speed
      <select
        aria-label="Playback speed"
        value={Math.round(c.config.speed * 100)}
        onChange={(e) => c.configure({ speed: Number(e.target.value) / 100 })}
      >
        {Array.from({ length: 26 }, (_, i) => 25 + i * 5).map((v) => (
          <option key={v} value={v}>
            {v}%
          </option>
        ))}
      </select>
    </label>
  );
}
export function SoundOptions({ c }: { c: PracticeController }) {
  return (
    <div className="option-fields">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.scheduler.accompaniment}
          onChange={(e) => c.setAccompaniment(e.target.checked)}
        />
        Auto accompaniment
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.scheduler.metronome}
          onChange={(e) => c.setMetronome(e.target.checked)}
        />
        Metronome
      </label>
      <SoundRouting c={c} />
      <button
        className="secondary"
        onClick={() => {
          c.engine.panic();
          c.audio.stopAll();
        }}
      >
        Panic / All Notes Off
      </button>
    </div>
  );
}
export function DisplayOptions({ c }: { c: PracticeController }) {
  return (
    <div className="option-fields">
      <label>
        Keyboard range
        <select
          aria-label="Visible keys"
          value={c.visible}
          onChange={(e) => c.setVisible(e.target.value)}
        >
          <option value="song">Fit this piece</option>
          <option value="88">88 keys</option>
          <option value="49">49 keys · C2–C6</option>
          <option value="25">25 keys · C4–C6</option>
        </select>
      </label>
      <label>
        Labels
        <select
          aria-label="Note labels"
          value={c.labels}
          onChange={(e) => c.setLabels(e.target.value as typeof c.labels)}
        >
          <option value="notes">Note names</option>
          <option value="fingers">Fingering hints</option>
          <option value="none">None</option>
        </select>
      </label>
      <label>
        Note zoom
        <input
          aria-label="Note zoom"
          type="range"
          min="45"
          max="180"
          value={c.zoom}
          onChange={(e) => c.setZoom(Number(e.target.value))}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.showBackground}
          onChange={(e) => c.setShowBackground(e.target.checked)}
        />
        Show other parts
      </label>
    </div>
  );
}
export function MoreOptions({ c }: { c: PracticeController }) {
  return (
    <div className="option-fields">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.countIn}
          onChange={(e) => c.setCountIn(e.target.checked)}
        />
        One-bar count-in
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.engine.adaptive}
          onChange={(e) => {
            c.engine.adaptive = e.target.checked;
            c.redraw((v) => v + 1);
          }}
        />
        Adaptive speed
      </label>
      <div className="field-pair">
        <label>
          Success threshold (%)
          <input
            type="number"
            min="50"
            max="100"
            value={c.engine.adaptiveThreshold * 100}
            onChange={(e) => {
              c.engine.adaptiveThreshold = Math.max(
                0.5,
                Math.min(1, Number(e.target.value) / 100),
              );
              c.redraw((v) => v + 1);
            }}
          />
        </label>
        <label>
          Successful passes
          <input
            type="number"
            min="1"
            max="10"
            value={c.engine.adaptivePasses}
            onChange={(e) => {
              c.engine.adaptivePasses = Math.max(
                1,
                Math.min(10, Number(e.target.value)),
              );
              c.redraw((v) => v + 1);
            }}
          />
        </label>
      </div>
      <small>
        Adaptive speed adds 5% after successful rhythm or recital loops. Wait
        for notes never raises speed automatically.
      </small>
      <button className="secondary" onClick={() => c.navigate("settings")}>
        Range, matching & calibration
      </button>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.notation}
          onChange={(e) => c.setNotation(e.target.checked)}
        />
        Pitch-reading staff
      </label>
      {c.notation && (
        <>
          <small>
            Four-note pitch preview, not a complete synchronized score.
          </small>
          <Staff song={c.song} />
        </>
      )}
    </div>
  );
}

export function SoundRouting({ c }: { c: PracticeController }) {
  return (
    <div className="sound-routing">
      <label>
        Hear my playing through
        <select
          aria-label="Live piano sound"
          value={c.computerSound ? "computer" : "piano"}
          onChange={(e) => c.setComputerSound(e.target.value === "computer")}
        >
          <option value="piano">My piano</option>
          <option value="computer">Computer</option>
        </select>
      </label>
      <small>
        {c.source === "simulated"
          ? "Simulated keys always use computer audio."
          : c.computerSound
            ? "Cadance sounds your keys. Turn your piano’s local sound off if it also plays them."
            : "Your piano sounds your keys. Cadance plays only accompaniment and listening audio."}
      </small>
    </div>
  );
}
