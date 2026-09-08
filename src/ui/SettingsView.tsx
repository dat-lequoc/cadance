import { SoundRouting } from "./PracticeOptions";
import { Icon } from "./shared";
import type { PracticeController } from "./usePracticeController";
import { db, backup, restore } from "../core/storage";
import { download } from "../core/files";
import { pathetique } from "../core/catalogue";
import DebugControls from "./DebugControls";
export default function SettingsView({ c }: { c: PracticeController }) {
  const {
    engine,
    stopReplay,
    setModal,
    config,
    configure,
    visualOffset,
    setVisualOffset,
    scheduler,
    redraw,
    report,
    reload,
    selectSong,
  } = c;
  return (
    <>
      {" "}
      {true && (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR WORKSPACE</div>
              <h1>Settings</h1>
              <p>Piano connection, sound, and local data.</p>
            </div>
          </div>
          <div className="settings-grid">
            <section className="settings-card"><h2>MIDI diagnostics</h2><DebugControls c={c} /></section>
            <section className="settings-card">
              <h2>Appearance</h2>
              <label>
                Dashboard theme
                <select
                  value={c.dashboardDark ? "dark" : "light"}
                  onChange={(e) =>
                    c.setDashboardDark(e.target.value === "dark")
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <p>
                Applies to your pieces, setup, history and settings. Your choice
                is saved on this device.
              </p>
            </section>
            <section className="settings-card">
              <h2>Piano connection</h2>
              <p>
                Connect your instrument with USB MIDI (usually USB TO HOST), or
                a MIDI interface. A headphone jack carries audio, not MIDI. USB
                TO DEVICE is usually for storage.
              </p>
              <button className="secondary" onClick={() => setModal(true)}>
                <Icon name="plug" />
                Set up piano
              </button>
              <p>
                Use HTTPS or localhost. Desktop Chrome and Edge are the first
                targets. Firefox may ask for additional permissions. Safari/iOS
                is not an initial MIDI target; availability is checked in your
                browser.
              </p>
              <h3>Sound routing</h3>
              <SoundRouting c={c} />
              <button
                className="secondary"
                onClick={() => {
                  engine.panic();
                  stopReplay();
                }}
              >
                Panic / All Notes Off
              </button>
            </section>
            <section className="settings-card">
              <h2>Range & matching</h2>
              <div className="settings-fields">
                {(
                  [
                    ["minPitch", "Lowest MIDI key", 0, 127],
                    ["maxPitch", "Highest MIDI key", 0, 127],
                    ["transpose", "Transpose (semitones)", -24, 24],
                    ["chordMs", "Chord collection (ms)", 100, 3000],
                    ["earlyMs", "Early window (ms)", 20, 500],
                    ["lateMs", "Late window (ms)", 20, 500],
                    ["groupingMs", "Onset grouping (ms)", 0, 100],
                    ["inputOffsetMs", "Input timing offset (ms)", -300, 300],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={config[key]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v))
                          configure({
                            [key]: Math.max(min, Math.min(max, v)),
                          });
                      }}
                    />
                  </label>
                ))}
                <label>
                  Visual offset (ms)
                  <input
                    type="number"
                    min="-300"
                    max="300"
                    value={visualOffset}
                    onChange={(e) => setVisualOffset(Number(e.target.value))}
                  />
                </label>
                <label>
                  Audio offset (ms)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scheduler.audioOffsetMs}
                    onChange={(e) => c.setAudioOffset(Number(e.target.value))}
                  />
                </label>
              </div>
              <p>
                Input offset subtracts from attack timestamps for scoring.
                Positive visual offset draws notes further ahead. Positive audio
                offset delays scheduled sound. These are manual adjustments, not
                a measured end-to-end latency.
              </p>
            </section>
            <section className="settings-card">
              <h2>Your local data</h2>
              <p>
                Songs, recordings and progress stay in this browser. Browser
                storage can be cleared or evicted; export a backup to keep a
                copy.
              </p>
              <div className="data-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    backup()
                      .then((v) => download("cadence-backup.json", v))
                      .catch(report)
                  }
                >
                  Export backup
                </button>
                <label className="secondary file-label">
                  Import backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (file) {
                          await restore(await file.text());
                          await reload();
                          await c.restorePreferences(true);
                        }
                      } catch (err) {
                        report(err);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <details>
                <summary>Delete all local data</summary>
                <p>
                  This removes imported songs, attempts and settings from this
                  browser.
                </p>
                <button
                  className="danger"
                  onClick={() => {
                    engine.stop();
                    stopReplay();
                    db.transaction(
                      "rw",
                      db.songs,
                      db.sessions,
                      db.settings,
                      async () => {
                        await db.songs.clear();
                        await db.sessions.clear();
                        await db.settings.clear();
                      },
                    )
                      .then(() => {
                        engine.lastResult = null;
                        selectSong(pathetique);
                        return reload().then(() => c.restorePreferences(true));
                      })
                      .catch(report);
                  }}
                >
                  Delete all songs, sessions and settings
                </button>
              </details>
              <h3>Offline practice</h3>
              <p>
                The production app caches its core and your included piece after
                the first load. Reopen this same address offline. Imported files
                and MIDI input need no server. Notation is a simple pitch
                preview; advanced score reading and MIDI output are future work.
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
