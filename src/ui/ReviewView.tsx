import type { PracticeController } from "./usePracticeController";
import type { Result } from "../core/engine";
import { backup, db, performanceMidi } from "../core/storage";
import { download } from "../core/files";
import { duration, modeName, pct } from "./shared";
function Metrics({ r }: { r: Result }) {
  if (r.config.mode === "free" || r.config.mode === "listen") return null;
  return (
    <div className="review-metrics">
      {(r.config.mode === "wait"
        ? [
            [`${r.hits}/${r.targets}`, "Notes found"],
            [String(r.extras), "Extra notes"],
            [`${Math.round(r.findingMs / 1000)}s`, "Finding time"],
          ]
        : [
            [pct(r.recall), "Note recall"],
            [pct(r.precision), "Input precision"],
            [
              r.timingMs === null ? "—" : `${Math.round(r.timingMs)}ms`,
              "Signed timing",
            ],
          ]
      ).map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function RecordingActions({ c, r }: { c: PracticeController; r: Result }) {
  return (
    <div className="recording-actions">
      <button
        className="secondary"
        disabled={!r.events.length}
        onClick={() => void c.replay(r).catch(c.report)}
      >
        Replay recording
      </button>
      <button
        className="secondary"
        disabled={!r.events.length}
        onClick={() =>
          download(
            "cadance-performance.mid",
            performanceMidi(r) as BlobPart,
            "audio/midi",
          )
        }
      >
        Export MIDI
      </button>
      {c.replaying && (
        <button className="secondary" onClick={c.stopReplay}>
          Stop replay
        </button>
      )}
    </div>
  );
}
export default function ReviewView({ c }: { c: PracticeController }) {
  const r = c.review;
  if (!r)
    return <button onClick={() => c.navigate("setup")}>Back to setup</button>;
  const listen = r.config.mode === "listen";
  return (
    <section className="session-review">
      <div className="review-symbol">{listen ? "♫" : "✓"}</div>
      <span className="eyebrow">
        {listen
          ? "LISTENING"
          : r.completed
            ? "PASSAGE COMPLETE"
            : "PRACTICE RETAINED"}
      </span>
      <h1>{listen ? "Take it to the keys." : "A little closer."}</h1>
      <h2>{r.title}</h2>
      <p>
        {modeName(r.config.mode)} ·{" "}
        {r.config.hand === "both" ? "Both hands" : r.config.hand + " hand"} ·{" "}
        {r.config.focus === "harmony"
          ? "Harmonies"
          : r.config.focus === "melody"
            ? "Melody"
            : "All notes"}{" "}
        · {Math.round(r.config.speed * 100)}%<br />
        {duration(r.passage[0])}–{duration(r.passage[1])}
      </p>
      <Metrics r={r} />
      {!listen && <RecordingActions c={c} r={r} />}
      <div className="review-actions">
        <button
          className="primary"
          onClick={() => {
            c.stopReplay();
            c.engine.restart();
            void c.play();
          }}
        >
          Practice again
        </button>
        <button className="secondary" onClick={() => c.navigate("setup")}>
          Change setup
        </button>
        <button onClick={() => c.navigate("library")}>Your pieces →</button>
      </div>
      {!listen && (
        <small>
          {c.pendingSave?.id === r.id
            ? "Saving this attempt…"
            : c.sessions.some((s) => s.id === r.id)
              ? "Saved on this device"
              : "No played notes to save yet."}
        </small>
      )}
    </section>
  );
}
export function HistoryView({ c }: { c: PracticeController }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ONE SESSION AT A TIME</span>
          <h1>Your practice history.</h1>
          <p>Real attempts and recordings, saved on this device.</p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            void backup()
              .then((v) => download("cadance-backup.json", v))
              .catch(c.report)
          }
        >
          Export backup
        </button>
      </div>
      <div className="history-summary">
        <span>
          <strong>{c.sessions.length}</strong> saved attempts
        </span>
        <span>
          <strong>{c.completed.length}</strong> completed
        </span>
        <span>
          <strong>{c.completedIds.size}</strong> pieces practiced
        </span>
      </div>
      {!c.sessions.length ? (
        <div className="empty-state">
          <h2>Your first session starts at the keys.</h2>
          <p>Practice a piece or record some free play.</p>
          <button className="primary" onClick={() => c.navigate("setup")}>
            Go to practice
          </button>
        </div>
      ) : (
        <div className="history">
          {c.sessions.map((r) => (
            <article key={r.id}>
              <details>
                <summary>
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {new Date(r.date).toLocaleString()} ·{" "}
                      {modeName(r.config.mode)} ·{" "}
                      {Math.round(r.config.speed * 100)}%
                    </p>
                  </div>
                  <span>
                    {r.completed ? "Completed" : "Stopped early"} <b>⌄</b>
                  </span>
                </summary>
                <p>
                  {r.config.hand} hands ·{" "}
                  {r.config.focus === "harmony"
                    ? "Harmonies"
                    : r.config.focus === "melody"
                      ? "Melody"
                      : "All notes"}{" "}
                  · {duration(r.passage[0])}–{duration(r.passage[1])}
                </p>
                <Metrics r={r} />
                <RecordingActions c={c} r={r} />
                <button
                  className="text-button"
                  onClick={() =>
                    void db.sessions.delete(r.id).then(c.reload).catch(c.report)
                  }
                >
                  Delete attempt
                </button>
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
