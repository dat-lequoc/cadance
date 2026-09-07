import type { Song, Hand } from "../core/model";
export default function PartsPanel({
  song,
  onChange,
}: {
  song: Song;
  onChange: (s: Song) => void;
}) {
  const tracks = [...new Set(song.notes.map((n) => n.track))];
  const update = (track: number, patch: Record<string, unknown>) =>
    onChange({
      ...song,
      notes: song.notes.map((n) =>
        n.track === track ? { ...n, ...patch } : n,
      ),
    });
  return (
    <details className="parts-panel">
      <summary>
        Parts & accompaniment{" "}
        <span>Assign hands, melody, harmony, sound and visibility</span>
      </summary>
      <p>
        {song.roleSource === "score"
          ? "Parts are separated from the source score’s voices."
          : "Melody is a suggested upper voice. MIDI does not reliably identify melody; review and adjust each part here."}
      </p>
      <div className="parts-table">
        <div className="parts-table-head">
          <span>Part</span>
          <span>Hand</span>
          <span>Practice role</span>
          <span>Visible</span>
          <span>Sound</span>
        </div>
        {tracks.map((track) => {
          const ns = song.notes.filter((n) => n.track === track),
            first = ns[0],
            hand = ns.every((n) => n.hand === first.hand)
              ? first.hand
              : "split",
            role = ns.every((n) => n.role === first.role)
              ? first.role
              : "mixed";
          return (
            <div className="part-row" key={track}>
              <div>
                <strong>
                  {song.trackNames?.[track] || `Track ${track + 1}`}
                </strong>
                <small>
                  {ns.length} notes · channel {first.channel}
                </small>
              </div>
              <select
                aria-label={`Hand for track ${track + 1}`}
                value={hand}
                onChange={(e) => {
                  const h = e.target.value;
                  onChange({
                    ...song,
                    notes: song.notes.map((n) =>
                      n.track === track
                        ? {
                            ...n,
                            hand: (h === "split"
                              ? n.pitch < 60
                                ? "left"
                                : "right"
                              : h) as Hand,
                          }
                        : n,
                    ),
                  });
                }}
              >
                <option value="split">Split at C4</option>
                <option value="left">Left hand</option>
                <option value="right">Right hand</option>
                <option value="accompaniment">Background</option>
                <option value="ignored">Ignore</option>
              </select>
              <select
                aria-label={`Role for track ${track + 1}`}
                value={role ?? "mixed"}
                onChange={(e) => update(track, { role: e.target.value })}
              >
                <option value="mixed" disabled>
                  Suggested voices
                </option>
                <option value="melody">Melody</option>
                <option value="harmony">Harmony</option>
              </select>
              <input
                aria-label={`Show track ${track + 1}`}
                type="checkbox"
                checked={!first.hidden}
                onChange={(e) => update(track, { hidden: !e.target.checked })}
              />
              <input
                aria-label={`Sound track ${track + 1}`}
                type="checkbox"
                checked={!first.muted}
                onChange={(e) => update(track, { muted: !e.target.checked })}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}
