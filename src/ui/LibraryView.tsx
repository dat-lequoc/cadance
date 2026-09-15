import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import type { PracticeController } from "./usePracticeController";
import { db } from "../core/storage";
import { Icon, duration } from "./shared";
import { automaticPlanFor, preparedPlanFor } from "../core/plans";
import { readPracticePlan, readQuestProgress, type LoadedPlan } from "../core/quests";

type PieceProgress = { completed: number; quests: number };
type LibraryFilter = "all" | "in-progress" | "not-started" | "complete";
type LibrarySort = "recent" | "title" | "progress";
type LibraryPiece = {
  song: PracticeController["song"];
  latest?: PracticeController["sessions"][number];
  progress?: PieceProgress;
  percent: number;
  status: Exclude<LibraryFilter, "all">;
};

const filterLabels: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All pieces" },
  { value: "in-progress", label: "In progress" },
  { value: "not-started", label: "Not started" },
  { value: "complete", label: "Mastered" },
];

function displayKey(song: PracticeController["song"]) {
  const key = song.keys?.[0];
  if (!key?.key) return null;
  return `${key.key.replaceAll("b", "♭").replaceAll("#", "♯")} ${key.scale}`;
}

function displayMeter(song: PracticeController["song"]) {
  const meter = song.meters?.[0];
  return meter ? `${meter.numerator}/${meter.denominator}` : null;
}

async function planForLibrarySong(song: PracticeController["song"]): Promise<LoadedPlan | null> {
  const saved = await db.settings.get("quest-plan:" + song.id);
  if (typeof saved?.value === "string") {
    try { return await readPracticePlan(saved.value, song); } catch { /* fall through to the bundled/automatic plan */ }
  }
  return await preparedPlanFor(song) ?? await automaticPlanFor(song);
}

async function progressForSong(song: PracticeController["song"], settings: Map<string, unknown>): Promise<PieceProgress | null> {
  const loaded = await planForLibrarySong(song);
  if (!loaded) return null;
  const { plan } = loaded;
  const progress = readQuestProgress(settings.get("quest-progress:" + loaded.signature), plan);
  const completed = plan.quests.filter((quest) => progress.passes[quest.id]?.completed).length;
  return { completed, quests: plan.quests.length };
}
export default function LibraryView({ c }: { c: PracticeController }) {
  const [editing, setEditing] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [progress, setProgress] = useState<Record<string, PieceProgress>>({}),
    [filter, setFilter] = useState<LibraryFilter>("all"),
    [sort, setSort] = useState<LibrarySort>("recent");
  useEffect(() => {
    let alive = true;
    const load = (rows: { key: string; value: unknown }[]) => {
      const settings = new Map(rows.map((row) => [row.key, row.value]));
      void Promise.all(c.songs.map(async (song) => [song.id, await progressForSong(song, settings)] as const))
        .then((entries) => {
          if (!alive) return;
          setProgress(Object.fromEntries(entries.filter((entry): entry is [string, PieceProgress] => entry[1] !== null)));
        });
    };
    const subscription = liveQuery(() => db.settings
      .filter((row) => row.key.startsWith("quest-progress:") || row.key.startsWith("quest-plan:"))
      .toArray()
    ).subscribe({ next: load, error: (error) => console.error("Could not load piece progress", error) });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [c.songs]);
  const pieces = useMemo<LibraryPiece[]>(
    () =>
      c.songs.map((song) => {
        const latest = c.sessions
          .filter((session) => session.songId === song.id)
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
        const pieceProgress = progress[song.id];
        const percent = pieceProgress
          ? Math.round((pieceProgress.completed / Math.max(1, pieceProgress.quests)) * 100)
          : 0;
        return {
          song,
          latest,
          progress: pieceProgress,
          percent,
          status: percent >= 100
            ? "complete"
            : pieceProgress?.completed
              ? "in-progress"
              : "not-started",
        };
      }),
    [c.songs, c.sessions, progress],
  );
  const counts = useMemo(
    () => ({
      all: pieces.length,
      "in-progress": pieces.filter((piece) => piece.status === "in-progress").length,
      "not-started": pieces.filter((piece) => piece.status === "not-started").length,
      complete: pieces.filter((piece) => piece.status === "complete").length,
    }),
    [pieces],
  );
  const filtered = useMemo(() => {
    const query = c.search.trim().toLocaleLowerCase();
    return pieces
      .filter((piece) => {
        const matchesSearch = !query ||
          `${piece.song.title} ${piece.song.composer ?? ""}`.toLocaleLowerCase().includes(query);
        return matchesSearch && (filter === "all" || piece.status === filter);
      })
      .sort((a, b) => {
        if (sort === "title") return a.song.title.localeCompare(b.song.title);
        if (sort === "progress") return b.percent - a.percent || a.song.title.localeCompare(b.song.title);
        const recent = (b.latest ? Date.parse(b.latest.date) : 0) - (a.latest ? Date.parse(a.latest.date) : 0);
        return recent || a.song.title.localeCompare(b.song.title);
      });
  }, [c.search, filter, pieces, sort]);
  const current = pieces.find((piece) => piece.song.id === c.song.id);
  const practicedCount = counts.all - counts["not-started"];
  return (
    <>
      <div className="page-heading library-heading">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE. YOUR OWN PACE.</span>
          <h1>Your pieces.</h1>
          <p>The music you want to play, all in one place.</p>
        </div>
        <div className="library-summary" aria-label="Library summary">
          <div><strong>{counts.all}</strong><span>pieces</span></div>
          <div><strong>{practicedCount}</strong><span>in motion</span></div>
          <div><strong>{counts.complete}</strong><span>mastered</span></div>
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
          <div className="continue-piece-copy">
            <span className="eyebrow">CONTINUE PRACTICING</span>
            <strong>{c.song.title}</strong>
            <span className="continue-composer">{c.song.composer || "Imported MIDI"}</span>
            <span className="continue-piece-meta">
              <span>{current?.percent ?? 0}% complete</span>
              <span>{duration(c.song.duration)}</span>
            </span>
            <progress
              value={current?.progress?.completed ?? 0}
              max={current?.progress?.quests ?? 1}
              aria-label={`${c.song.title} practice progress`}
            />
          </div>
          <span className="continue-arrow"><Icon name="arrow" size={22} /></span>
        </button>
      )}
      <section className="library-browser" aria-label="Piece library">
        <div className="library-toolbar">
          <div className="library-toolbar-heading">
            <h2>Browse your music <span>{filtered.length}/{counts.all}</span></h2>
            <p>Find a piece by title or composer, then jump straight into practice.</p>
          </div>
          <div className="library-controls">
            <label className="piece-search-wrap">
              <Icon name="search" size={17} />
              <input
                className="piece-search"
                type="search"
                aria-label="Search pieces"
                placeholder="Search title or composer"
                value={c.search}
                onChange={(e) => c.setSearch(e.target.value)}
              />
              {c.search && <button type="button" aria-label="Clear piece search" onClick={() => c.setSearch("")}>×</button>}
            </label>
            <label className="piece-sort">
              <span>Sort</span>
              <select aria-label="Sort pieces" value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)}>
                <option value="recent">Recently played</option>
                <option value="title">Title A–Z</option>
                <option value="progress">Progress</option>
              </select>
            </label>
          </div>
        </div>
        <div className="library-filter-row">
          <div className="library-filters" aria-label="Filter pieces">
            {filterLabels.map((option) => (
              <button
                key={option.value}
                type="button"
                className={filter === option.value ? "selected" : ""}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}<span>{counts[option.value]}</span>
              </button>
            ))}
          </div>
          <span className="library-results" aria-live="polite">
            {filtered.length === counts.all ? "Showing everything" : `${filtered.length} shown`}
          </span>
        </div>
      </section>
      <div className="piece-list">
        {filtered.map((piece, i) => {
          const { song, latest, pieceProgress, percent, status } = {
            song: piece.song,
            latest: piece.latest,
            pieceProgress: piece.progress,
            percent: piece.percent,
            status: piece.status,
          };
          const statusLabel = status === "complete" ? "Mastered" : status === "in-progress" ? "In progress" : "Not started";
          const key = displayKey(song);
          const meter = displayMeter(song);
          return (
            <article className={`piece-row piece-status-${status}`} key={song.id}>
              <div className="piece-card-top">
                <div className="piece-identity">
                  <span className="piece-number">{String(i + 1).padStart(2, "0")}</span>
                  <span className={`piece-mark piece-mark-${status}`} aria-hidden="true">
                    <Icon name={status === "complete" ? "check" : "book"} size={18} />
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
                        <button className="secondary" type="submit">Save</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <div className="piece-title-line">
                          <h3 title={song.title}>{song.title}</h3>
                          {song.id === c.song.id && <span className="current-piece-badge">Open</span>}
                        </div>
                        <p>{song.composer || "Imported MIDI"}</p>
                      </>
                    )}
                  </div>
                </div>
                <span className={`piece-status-label piece-status-label-${status}`}>{statusLabel}</span>
              </div>
              <div className="piece-card-meta">
                <span>{duration(song.duration)}</span>
                {key && <span>{key}</span>}
                {meter && <span>{meter}</span>}
              </div>
              <div className="piece-progress" aria-label={`${song.title} practice progress`}>
                <div className="piece-progress-heading">
                  <span>{percent >= 100 ? "Piece mastered ✓" : `${percent}% complete`}</span>
                  <span>{percent >= 100 ? "All set" : pieceProgress?.completed ? "Keep building" : "Ready when you are"}</span>
                </div>
                <progress value={pieceProgress?.completed ?? 0} max={pieceProgress?.quests ?? 1} />
              </div>
              <div className="piece-card-footer">
                <small>
                  {latest
                    ? "Last practiced " + new Date(latest.date).toLocaleDateString()
                    : "Ready for your first practice"}
                </small>
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
