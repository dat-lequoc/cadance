import { SoundRouting } from "./PracticeOptions";
import { Icon } from "./shared";
import type { PracticeController } from "./usePracticeController";
import { db } from "../core/storage";
import { noteName } from "../core/model";
export default function ConnectionDialog({ c }: { c: PracticeController }) {
  const {
    modal,
    closeConnection,
    connect,
    busy,
    error,
    hardware,
    engine,
    sourceRef,
    setSource,
    setCalibrated,
    report,
    source,
    calibrated,
    monitor,
    useSimulated,
  } = c;
  return (
    <>
      {" "}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConnection();
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") closeConnection();
            }}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close piano setup"
              onClick={() => closeConnection()}
            >
              <Icon name="close" />
            </button>
            <span className="modal-icon">
              <Icon name="plug" size={28} />
            </span>
            <div className="eyebrow">LET’S GET CONNECTED</div>
            <h2 id="connect-title">Connect your piano</h2>
            <p>
              Plug your piano’s USB MIDI port into your computer. Then give
              Cadance permission to listen.
            </p>
            <button
              className="play-button wide"
              onClick={() => void connect()}
              disabled={busy}
            >
              {busy ? "Connecting…" : "Connect MIDI piano"}
              <Icon name="plug" />
            </button>
            {error && (
              <p role="alert" className="warning">
                {error}
              </p>
            )}
            {hardware.access && (
              <div className="port-list">
                {hardware.ports().length === 0 ? (
                  <p>
                    No MIDI inputs found. Connect a USB MIDI instrument and try
                    again.
                  </p>
                ) : (
                  <label>
                    MIDI input
                    <select
                      aria-label="MIDI input"
                      value={hardware.connected ? hardware.selected : ""}
                      onChange={(e) => {
                        engine.deviceLost();
                        sourceRef.current = "hardware";
                        setSource("hardware");
                        hardware.select(e.target.value);
                        setCalibrated(false);
                        db.settings
                          .put({ key: "lastDevice", value: e.target.value })
                          .catch(report);
                      }}
                    >
                      <option value="">Choose your piano…</option>
                      {hardware.ports().map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name ?? p.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            {source === "hardware" && hardware.connected && (
              <div className="calibration">
                <strong>
                  {calibrated
                    ? "✓ Middle C received"
                    : "Press middle C (C4 / MIDI 60)"}
                </strong>
                <p>
                  {calibrated
                    ? "Check that C4 lights up on the piano view. Your connection is ready."
                    : "Confirm the indicated key matches your physical piano."}
                </p>
                <SoundRouting c={c} />
                <button className="secondary" onClick={() => closeConnection()}>
                  Return to practice
                </button>
              </div>
            )}
            <div className="monitor">
              <span className="eyebrow">LIVE EVENT MONITOR</span>
              {monitor.length ? (
                monitor.slice(0, 4).map((e, i) => (
                  <div key={i}>
                    <span>
                      {e.type === "sustain"
                        ? "Pedal " + e.value
                        : noteName(e.pitch) + " · " + e.pitch}
                    </span>
                    <span>
                      ch {e.channel} ·{" "}
                      {e.type === "on"
                        ? "down"
                        : e.type === "off"
                          ? "up"
                          : e.value >= 64
                            ? "on"
                            : "off"}{" "}
                      · vel {Math.round(e.velocity * 127)}
                    </span>
                  </div>
                ))
              ) : (
                <p>Play a key to see note, velocity and pedal events here.</p>
              )}
            </div>
            <div className="modal-divider">
              <span>NO PIANO NEARBY?</span>
            </div>
            <button className="secondary wide" onClick={useSimulated}>
              Use simulated input <Icon name="arrow" />
            </button>
            <small>
              Try the on-screen keys or your computer keyboard. Simulated input
              is labeled separately from hardware.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
