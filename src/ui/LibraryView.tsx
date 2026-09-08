import { useState } from "react";
import type { PracticeController } from "./usePracticeController";
import { db } from "../core/storage";
import { Icon, duration } from "./shared";
export default function LibraryView({ c }: { c: PracticeController }) {
  const [editing, setEditing] = useState<string | null>(null),
    [title, setTitle] = useState("");
  const filtered = c.songs.filter((s) =>
    (s.title + " " + (s.composer ?? ""))
      .toLowerCase()
      .includes(c.search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE. YOUR OWN PACE.</span>
          <h1>Your pieces.</h1>
          <p>The music you want to play, all in one place.</p>
        </div>
        <button
          className="primary"
          disabled={c.busy}
          onClick={() => c.fileRef.current?.click()}
        >
          <Icon name="upload" />
          {c.busy ? "Importing…" : "Import MIDI"}
        </button>
      </div>
      {c.songs.some((s) => s.id === c.song.id) && (
        <button className="continue-piece" onClick={() => c.navigate("setup")}>
          <div>
            <span className="eyebrow">CONTINUE PRACTICING</span>
            <strong>{c.song.title}</strong>
            <span>{c.song.composer}</span>
          </div>
          <span className="continue-arrow">↗</span>
        </button>
      )}
      <div className="library-toolbar">
        <h2>
          Your collection <span>{c.songs.length}</span>
        </h2>
        <input
          className="piece-search"
          aria-label="Search pieces"
          placeholder="Search pieces or composers"
          value={c.search}
          onChange={(e) => c.setSearch(e.target.value)}
        />
      </div>
      <div className="piece-list">
        {filtered.map((song, i) => {
          const latest = c.sessions.find((s) => s.songId === song.id);
          return (
            <article className="piece-row" key={song.id}>
              <span className="piece-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="piece-row-title">
                {editing === song.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!title.trim()) return;
                      const next = { ...song, title: title.trim() };
                      void db.songs
                        .put(next)
                        .then(() => {
                          if (c.song.id === song.id) c.engine.song = next;
                          setEditing(null);
                          return c.reload();
                        })
                        .catch(c.report);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Piece title"
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <button className="secondary" type="submit">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <h3>{song.title}</h3>
                    <p>
                      {song.composer || "Imported MIDI"} ·{" "}
                      {duration(song.duration)}
                    </p>
                    <small>
                      {latest
                        ? "Last practiced " +
                          new Date(latest.date).toLocaleDateString()
                        : "Ready for your first practice"}
                    </small>
                  </>
                )}
              </div>
              <div className="piece-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    c.selectSong(song);
                    c.listen();
                  }}
                  aria-label={"Listen to " + song.title}
                >
                  <Icon name="volume" />
                  Listen
                </button>
                <button
                  className="primary"
                  aria-label={"Practice " + song.title}
                  onClick={() => c.selectSong(song)}
                >
                  Practice <Icon name="arrow" />
                </button>
                <details className="item-menu">
                  <summary aria-label={"Options for " + song.title}>⋯</summary>
                  <div>
                    <button
                      onClick={() => {
                        setEditing(song.id);
                        setTitle(song.title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() =>
                        void db.songs
                          .delete(song.id)
                          .then(c.reload)
                          .catch(c.report)
                      }
                    >
                      Delete piece
                    </button>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h2>{c.songs.length ? "No matching pieces" : "Bring your music."}</h2>
          <p>
            {c.songs.length
              ? "Try another title or composer."
              : "Import a MIDI file to get started."}
          </p>
        </div>
      )}
      <button
        className="drop-zone"
        disabled={c.busy}
        onClick={() => c.fileRef.current?.click()}
      >
        <Icon name="upload" />
        <strong>Drop a MIDI file here</strong>
        <span>or click to browse · saved on this device</span>
      </button>
    </>
  );
}
