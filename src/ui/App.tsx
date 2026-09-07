import { useEffect, useMemo, useRef, useState } from "react";
import { PracticeEngine, type Result } from "../core/engine";
import { HardwareInput, SimulatedInput } from "../core/midi";
import { pathetique, initialPieces } from "../core/catalogue";
import LoopPanel from "./LoopPanel";
import PartsPanel from "./PartsPanel";
import { keyboardRange, rhythmMode } from "../core/model";
import {
  defaults,
  noteName,
  rangeWarnings,
  TempoMap,
  type Config,
  type InputEvent,
  type Song,
  type Hand,
} from "../core/model";
import { AudioScheduler, PianoAudio } from "../core/audio";
import { db, backup, restore, performanceMidi } from "../core/storage";
import { importFile, download } from "../core/files";
import Roll from "./Roll";
import Staff from "./Staff";
const paths: Record<string, string> = {
  piano: "M4 4h16v16H4z M9 4v16 M15 4v16 M8 4v8 M14 4v8",
  grid: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  chart: "M4 19V5 M4 19h16 M8 15l4-5 4 2 4-7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  play: "M8 5l11 7-11 7z",
  pause: "M8 5v14 M16 5v14",
  back: "M5 5v14 M19 5L8 12l11 7z",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  plug: "M8 3v5 M16 3v5 M6 8h12v4a6 6 0 0 1-12 0z M12 18v4",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12l4 4L19 6",
  loop: "M5 8h12l-3-3 M19 16H7l3 3 M19 8v4 M5 16v-4",
  volume: "M4 9h4l5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8",
  book: "M12 6C8 3 5 4 3 5v14c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-1-6-2-9 1z M12 6v13",
  stop: "M6 6h12v12H6z",
};
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.piano} />
    </svg>
  );
}
const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export default function App() {
  const engine = useMemo(() => new PracticeEngine(pathetique), []);
  const audio = useMemo(() => new PianoAudio(), []);
  const scheduler = useMemo(
    () => new AudioScheduler(engine, audio),
    [engine, audio],
  );
  const simulated = useMemo(() => new SimulatedInput(), []);
  const [revision, redraw] = useState(0),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("practice"),
    [modal, setModal] = useState(false),
    [source, setSource] = useState<"none" | "hardware" | "simulated">("none"),
    [deviceVersion, setDeviceVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [monitor, setMonitor] = useState<InputEvent[]>([]),
    [songs, setSongs] = useState<Song[]>(initialPieces),
    [sessions, setSessions] = useState<Result[]>([]),
    [computerSound, setComputerSound] = useState(false),
    [visible, setVisible] = useState("song"),
    [notation, setNotation] = useState(false),
    [visualOffset, setVisualOffset] = useState(0),
    [countIn, setCountIn] = useState(false),
    [replaying, setReplaying] = useState(false),
    [calibrated, setCalibrated] = useState(false),
    [search, setSearch] = useState(""),
    [labels, setLabels] = useState<"notes" | "fingers" | "none">("notes"),
    [showBackground, setShowBackground] = useState(true),
    [zoom, setZoom] = useState(90);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const soundRef = useRef(computerSound);
  soundRef.current = computerSound;
  const fileRef = useRef<HTMLInputElement>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardware = useMemo(
    () =>
      new HardwareInput(
        () => setDeviceVersion((v) => v + 1),
        (port) => {
          engine.deviceLost(port);
          audio.stopAll();
        },
      ),
    [engine, audio],
  );
  const report = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const reload = async () => {
    setSongs(await db.songs.toArray());
    setSessions(
      (await db.sessions.toArray()).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    );
  };
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      if (!(await db.settings.get("piece-workspace-v2"))) {
        await db.songs.put(pathetique);
        await db.settings.put({ key: "piece-workspace-v2", value: true });
        await db.settings.put({ key: "lastPiece", value: pathetique.id });
      }
      await reload();
      const selected = await db.settings.get("lastPiece");
      if (typeof selected?.value === "string") {
        const existing = await db.songs.get(selected.value);
        if (existing && !disposed) engine.loadLesson(existing);
      }
    };
    const configLoad = db.settings
      .get("config")
      .then((s) => {
        if (s?.value && typeof s.value === "object") {
          const v = s.value as Config;
          if (
            ["wait", "rhythm", "recital", "listen", "free"].includes(v.mode) &&
            ["both", "left", "right"].includes(v.hand) &&
            Object.keys(defaults).every(
              (k) =>
                typeof defaults[k as keyof Config] !== "number" ||
                (typeof v[k as keyof Config] === "number" &&
                  Number.isFinite(v[k as keyof Config])),
            )
          )
            engine.configure({
              ...v,
              speed: Math.max(0.25, Math.min(1.5, v.speed)),
            });
        }
      })
      .catch(report);
    Promise.all([init(), configLoad])
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((e) => {
        report(e);
        if (!disposed) setReady(true);
      });
    const receive = (e: InputEvent) => {
      if (
        (e.source === "hardware" && sourceRef.current !== "hardware") ||
        (e.source === "simulated" && sourceRef.current !== "simulated")
      )
        return;
      engine.receive(e);
      if (soundRef.current || e.source === "simulated") audio.receive(e);
      setMonitor((v) => [e, ...v].slice(0, 8));
      if (e.type === "on" && e.pitch === 60) setCalibrated(true);
    };
    const off1 = simulated.subscribe(receive),
      off2 = hardware.subscribe(receive),
      off3 = engine.subscribe(() => redraw((v) => v + 1));
    engine.onResult = (r) => {
      db.sessions.put(r).then(reload).catch(report);
    };
    scheduler.start();
    const timer = setInterval(() => redraw((v) => v + 1), 100);
    const hidden = () => {
      if (document.hidden) {
        engine.pause("Tab hidden — practice paused. Resume when you return.");
        audio.stopAll();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true;
      off1();
      off2();
      off3();
      clearInterval(timer);
      scheduler.dispose();
      hardware.dispose();
      engine.pause();
      engine.onResult = undefined;
      document.removeEventListener("visibilitychange", hidden);
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, [engine, audio, hardware, simulated, scheduler]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select,input,a[href]",
        ),
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusable(),
        first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      prior?.focus();
    };
  }, [modal]);
  const stopReplay = () => {
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = null;
    setReplaying(false);
    audio.stopAll();
  };
  const press = (p: number) => {
    if (sourceRef.current !== "simulated") return;
    void audio.unlock().catch(report);
    simulated.send([0x90, p, 96]);
  };
  const release = (p: number) => {
    if (sourceRef.current === "simulated") simulated.send([0x80, p, 0]);
  };
  useEffect(() => {
    const map: Record<string, number> = {
      a: 60,
      w: 61,
      s: 62,
      e: 63,
      d: 64,
      f: 65,
      t: 66,
      g: 67,
      y: 68,
      h: 69,
      u: 70,
      j: 71,
      k: 72,
    };
    const pressed = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest("input,select,textarea,button") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      if (map[k] !== undefined) {
        pressed.add(k);
        press(map[k]);
      }
      if (k === " " && sourceRef.current === "simulated") {
        e.preventDefault();
        simulated.send([0xb0, 64, 127]);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (pressed.delete(k)) release(map[k]);
      if (k === " " && sourceRef.current === "simulated")
        simulated.send([0xb0, 64, 0]);
    };
    const blur = () => {
      for (const k of pressed) release(map[k]);
      pressed.clear();
      simulated.send([0xb0, 64, 0]);
      engine.pause("Focus lost — resume when ready.");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [engine, simulated]);
  const selectSong = (song: Song) => {
    stopReplay();
    engine.loadLesson(song);
    db.settings.put({ key: "lastPiece", value: song.id }).catch(report);
    setPage("practice");
  };
  const configure = (patch: Partial<Config>) => {
    stopReplay();
    engine.configure(patch);
    db.settings.put({ key: "config", value: engine.config }).catch(report);
  };
  const importSong = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const song = await importFile(file);
      await db.songs.put(song);
      await reload();
      selectSong(song);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await hardware.connect();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const useSimulated = () => {
    engine.deviceLost();
    hardware.select("");
    sourceRef.current = "simulated";
    setSource("simulated");
    setCalibrated(false);
    setModal(false);
  };
  const play = async () => {
    setError("");
    stopReplay();
    try {
      if (engine.status === "playing" || engine.status === "waiting") {
        engine.pause();
        audio.stopAll();
        return;
      }
      if (
        !["listen"].includes(engine.config.mode) &&
        (source === "none" || (source === "hardware" && !hardware.connected))
      ) {
        setModal(true);
        return;
      }
      await audio.unlock();
      const map = new TempoMap(engine.song.ppq, engine.song.tempos);
      const tick = map.ticks(engine.passage[0]),
        meter = engine.song.meters.findLast((m) => m.tick <= tick) ?? {
          numerator: 4,
          denominator: 4,
        };
      const bpm =
        engine.song.tempos.findLast((t) => t.tick <= tick)?.bpm ?? 120;
      engine.start(
        countIn
          ? (((meter.numerator * 4) / meter.denominator) * 60) /
              bpm /
              engine.config.speed
          : 0,
      );
    } catch (e) {
      report(e);
    }
  };
  const selectMode = (mode: Config["mode"]) => {
    configure({ mode });
    if (mode === "listen")
      audio
        .unlock()
        .then(() => engine.start())
        .catch(report);
  };
  const saveParts = (updated: Song) => {
    stopReplay();
    engine.loadLesson(updated);
    db.songs.put(updated).then(reload).catch(report);
  };
  const replay = async (r: Result) => {
    stopReplay();
    engine.pause();
    await audio.unlock();
    const started = performance.now();
    let index = 0;
    setReplaying(true);
    replayTimer.current = setInterval(() => {
      const elapsed = performance.now() - started;
      while (index < r.events.length && r.events[index].elapsedMs <= elapsed) {
        const e = r.events[index++].event;
        audio.receive({ ...e, source: "playback" });
        setMonitor((v) =>
          [{ ...e, source: "playback" as const }, ...v].slice(0, 8),
        );
      }
      if (
        index === r.events.length &&
        elapsed > (r.events.at(-1)?.elapsedMs ?? 0) + 1000
      )
        stopReplay();
    }, 10);
  };
  const r = engine.result(),
    completed = sessions.filter((s) => s.completed && s.config.mode !== "free"),
    completedIds = new Set(completed.map((s) => s.songId)),
    config = engine.config,
    active = engine.status === "playing" || engine.status === "waiting",
    warnings = rangeWarnings(engine.song, config),
    song = engine.song;
  void revision;
  void deviceVersion;
  const fitted = keyboardRange(
    engine.targets.length ? { ...song, notes: engine.targets } : song,
  );
  const viewMin =
      visible === "song"
        ? fitted[0]
        : visible === "88"
          ? 21
          : visible === "49"
            ? 36
            : 60,
    viewMax = visible === "song" ? fitted[1] : visible === "88" ? 108 : 84;
  const assignments = [
    ...new Set(song.notes.map((n) => `${n.track}:${n.channel}`)),
  ];
  if (!ready)
    return (
      <div className="startup" role="status">
        Loading your pieces…
      </div>
    );
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void importSong(e.dataTransfer.files[0]);
      }}
    >
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("practice");
          }}
        >
          <span className="brand-icon">
            <Icon name="piano" size={25} />
          </span>
          cadence<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR PIANO SPACE</div>
        <nav>
          {[
            ["practice", "piano", "Practice"],
            ["library", "grid", "Your pieces"],
            ["progress", "chart", "Your progress"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={page === id ? "nav active" : "nav"}
              onClick={() => setPage(id)}
            >
              <Icon name={icon} />
              {label}
              {id === "practice" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-course">
          <span className="eyebrow">CURRENT PIECE</span>
          <strong className="current-piece-name">{song.title}</strong>
          <p>{song.composer || "Your imported MIDI"}</p>
          <button
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="upload" />
            Import a piece
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={page === "settings" ? "nav active" : "nav"}
            onClick={() => setPage("settings")}
          >
            <Icon name="settings" />
            Settings & help
          </button>
          <div className="local">
            <span className="status-dot" />
            Private by design<span>Saved on this device</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">Your workspace</span>
            <span className="slash">/</span>
            {page === "practice"
              ? "Practice studio"
              : page === "library"
                ? "Your pieces"
                : page === "progress"
                  ? "Your progress"
                  : "Settings & help"}
          </div>
          <button
            className={
              "device-pill " +
              (source === "hardware" && hardware.connected ? "connected" : "")
            }
            onClick={() => setModal(true)}
          >
            <span className="status-dot" />
            {source === "simulated"
              ? "Simulated input"
              : source === "hardware" && hardware.connected
                ? (hardware.ports().find((p) => p.id === hardware.selected)
                    ?.name ?? "Piano connected")
                : "Connect your piano"}
            <Icon name="plug" size={15} />
          </button>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <Icon name="close" />
              </button>
            </div>
          )}
          {page === "practice" && (
            <>
              <div className="page-heading">
                <div className="heading-copy">
                  <div className="eyebrow">PIECE PRACTICE</div>
                  <h1>{song.title}</h1>
                  <p>
                    {song.composer ||
                      "Import a MIDI. Choose your part. Play it at your pace."}
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Icon name="upload" />
                  {busy ? "Importing…" : "Import MIDI"}
                </button>
              </div>
              <div className="lesson-strip">
                <div className="lesson-art">
                  <Icon name="book" size={25} />
                </div>
                <div className="lesson-copy">
                  <span className="eyebrow">YOUR MUSIC</span>
                  <select
                    aria-label="Current piece"
                    className="song-select"
                    value={song.id}
                    onChange={(e) => {
                      const s = songs.find((s) => s.id === e.target.value);
                      if (s) selectSong(s);
                    }}
                  >
                    {songs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <p>{song.explanation}</p>
                </div>
                <div className="lesson-tags">
                  <span>{Math.round(song.tempos[0]?.bpm ?? 120)} BPM</span>
                  <span>{song.notes.length} notes</span>
                  <span>{duration(song.duration)}</span>
                </div>
              </div>
              <section className="studio">
                <div className="practice-mode-grid" aria-label="Practice mode">
                  {(
                    [
                      ["listen", "Listen", "Hear the piece"],
                      ["wait", "Practice melody", "Wait for each note"],
                      ["rhythm", "Practice rhythm", "Play in time"],
                      ["recital", "Song recital", "Perform & score"],
                      ["free", "Free play", "Play & record"],
                    ] as const
                  ).map(([mode, label, hint]) => (
                    <button
                      key={mode}
                      aria-label={label}
                      aria-pressed={config.mode === mode}
                      className={config.mode === mode ? "selected" : ""}
                      onClick={() => selectMode(mode)}
                    >
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </button>
                  ))}
                </div>
                <div className="practice-selection">
                  <div>
                    <span className="control-label">I’m playing</span>
                    <div className="segmented">
                      {(
                        [
                          ["both", "Both hands"],
                          ["right", "Right hand"],
                          ["left", "Left hand"],
                        ] as const
                      ).map(([hand, label]) => (
                        <button
                          aria-pressed={config.hand === hand}
                          className={config.hand === hand ? "selected" : ""}
                          onClick={() => configure({ hand })}
                          key={hand}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="control-label">Practice part</span>
                    <div className="segmented">
                      {(
                        [
                          ["all", "All notes"],
                          ["melody", "Melody line"],
                          ["harmony", "Harmonies"],
                        ] as const
                      ).map(([focus, label]) => (
                        <button
                          aria-pressed={(config.focus ?? "all") === focus}
                          className={
                            (config.focus ?? "all") === focus ? "selected" : ""
                          }
                          onClick={() => configure({ focus })}
                          key={focus}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={scheduler.accompaniment}
                      onChange={(e) => {
                        scheduler.accompaniment = e.target.checked;
                        engine.epoch++;
                        redraw((v) => v + 1);
                      }}
                    />
                    Play the other parts for me
                  </label>
                </div>
                <div className="view-controls">
                  <label>
                    Keys
                    <select
                      aria-label="Visible keys"
                      value={visible}
                      onChange={(e) => setVisible(e.target.value)}
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
                      value={labels}
                      onChange={(e) =>
                        setLabels(e.target.value as typeof labels)
                      }
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
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={showBackground}
                      onChange={(e) => setShowBackground(e.target.checked)}
                    />
                    Show other parts
                  </label>
                  {song.scoreUrl && (
                    <a
                      className="secondary"
                      href={song.scoreUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Full sheet music ↗
                    </a>
                  )}
                </div>
                <div className="roll-meta">
                  <div>
                    <span className="legend-dot left" />
                    Left hand
                    <span className="legend-dot right" />
                    Right hand
                  </div>
                  <span>
                    {engine.status === "waiting"
                      ? "WAITING FOR YOUR NOTES"
                      : config.mode === "wait"
                        ? "LEARN AT YOUR OWN PACE"
                        : rhythmMode(config.mode)
                          ? "FOLLOW THE BEAT"
                          : config.mode === "listen"
                            ? "DEMONSTRATION · NO SCORING"
                            : "PLAY SOMETHING THAT’S YOURS"}
                  </span>
                </div>
                <Roll
                  engine={engine}
                  accompaniment={scheduler.accompaniment}
                  min={viewMin}
                  max={viewMax}
                  press={press}
                  release={release}
                  visualOffset={visualOffset}
                  labels={labels}
                  showBackground={showBackground}
                  zoom={zoom}
                />
                <div className="feedback">
                  <span
                    className={
                      "feedback-icon " +
                      (engine.lastWrong !== null ? "wrong" : "")
                    }
                  >
                    <Icon
                      name={engine.status === "waiting" ? "piano" : "check"}
                      size={15}
                    />
                  </span>
                  <span aria-live="polite">{engine.feedback}</span>
                  {source === "simulated" && (
                    <small>Keys A–K · space for pedal</small>
                  )}
                </div>
                <div className="transport">
                  <div className="transport-main">
                    <button
                      className="icon-button"
                      title="Restart"
                      aria-label="Restart"
                      onClick={() => {
                        stopReplay();
                        engine.restart();
                      }}
                    >
                      <Icon name="back" />
                    </button>
                    <button
                      className="play-button"
                      onClick={() => void play()}
                      aria-label={active ? "Pause practice" : "Start practice"}
                    >
                      <Icon name={active ? "pause" : "play"} size={17} />
                      {active
                        ? "Pause"
                        : engine.status === "paused"
                          ? "Resume"
                          : "Start practice"}
                    </button>
                    <button
                      className="icon-button"
                      title="Stop and retain result"
                      aria-label="Stop"
                      onClick={() => {
                        stopReplay();
                        engine.stop();
                        audio.stopAll();
                      }}
                    >
                      <Icon name="stop" size={16} />
                    </button>
                  </div>
                  <div className="timeline">
                    <span>{duration(Math.max(0, engine.position))}</span>
                    <input
                      aria-label="Song position"
                      type="range"
                      min="0"
                      max={song.duration}
                      step="0.01"
                      value={Math.max(0, engine.position)}
                      onChange={(e) => engine.seek(Number(e.target.value))}
                    />
                    <span>{duration(song.duration)}</span>
                  </div>
                  <div className="speed">
                    <span>Speed</span>
                    <select
                      aria-label="Playback speed"
                      value={Math.round(config.speed * 100)}
                      onChange={(e) =>
                        configure({ speed: Number(e.target.value) / 100 })
                      }
                    >
                      {Array.from({ length: 26 }, (_, i) => 25 + i * 5).map(
                        (v) => (
                          <option key={v} value={v}>
                            {v}%
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <button
                    className={"icon-button " + (engine.loop ? "on" : "")}
                    title="A/B loop"
                    aria-label="Toggle loop"
                    onClick={() =>
                      document.querySelector(".loop-panel")?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                  >
                    <Icon name="loop" />
                  </button>
                </div>
              </section>
              <LoopPanel engine={engine} onError={report} />
              <PartsPanel song={song} onChange={saveParts} />
              <div className="practice-bottom">
                <section className="tip-card">
                  <div>
                    <span className="eyebrow">YOUR PRACTICE SETUP</span>
                    <h3>
                      {engine.targets.length} target notes ·{" "}
                      {config.hand === "both"
                        ? "both hands"
                        : config.hand + " hand"}{" "}
                      ·{" "}
                      {(config.focus ?? "all") === "all"
                        ? "all notes"
                        : config.focus === "harmony"
                          ? "harmonies"
                          : "melody"}
                    </h3>
                    <p>
                      {config.mode === "listen"
                        ? "Listen plays automatically. Turn off “Play the other parts for me” to hear only your selected hand and part."
                        : config.mode === "wait"
                          ? "The timeline waits for every target note or chord. The other parts play automatically when enabled."
                          : config.mode === "free"
                            ? "Play freely. Stop to save your performance for replay or MIDI export."
                            : "The timeline keeps moving. Match pitches and timing; a miss does not stop the piece."}
                    </p>
                  </div>
                </section>
                <section className="session-card">
                  <span className="eyebrow">THIS SESSION</span>
                  <div className="metrics">
                    <div>
                      <strong>
                        {config.mode === "wait"
                          ? `${r.hits}/${r.targets}`
                          : pct(r.recall)}
                      </strong>
                      <span>
                        {config.mode === "wait" ? "Notes found" : "Note recall"}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {config.mode === "wait" ? r.extras : pct(r.precision)}
                      </strong>
                      <span>
                        {config.mode === "wait"
                          ? "Extra notes"
                          : "Input precision"}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {config.mode === "wait"
                          ? `${Math.round(r.findingMs / 1000)}s`
                          : r.timingMs === null
                            ? "—"
                            : `${Math.round(r.timingMs)}ms`}
                      </strong>
                      <span>
                        {config.mode === "wait"
                          ? "Finding time"
                          : "Timing error"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
              {engine.lastResult && (
                <div className="retained-result">
                  <Icon name="check" />
                  <span>
                    Last saved attempt: {engine.lastResult.hits}/
                    {engine.lastResult.targets} notes ·{" "}
                    {engine.lastResult.completed
                      ? "completed"
                      : "stopped early"}
                  </span>
                  <button onClick={() => setPage("progress")}>
                    View progress <Icon name="arrow" size={14} />
                  </button>
                </div>
              )}
              {warnings.length > 0 && (
                <p className="warning">
                  {warnings.length} notes are outside the configured range.
                  Adjust your range or transposition in settings.
                </p>
              )}
              <details className="practice-details">
                <summary>
                  More practice settings{" "}
                  <span>Adaptive speed, count-in & sound</span>
                </summary>
                <div className="tools-grid">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={engine.adaptive}
                      onChange={(e) => {
                        engine.adaptive = e.target.checked;
                        redraw((v) => v + 1);
                      }}
                    />
                    Adaptive speed
                  </label>
                  <label>
                    Success threshold (%)
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={engine.adaptiveThreshold * 100}
                      onChange={(e) => {
                        engine.adaptiveThreshold = Math.max(
                          0.5,
                          Math.min(1, Number(e.target.value) / 100),
                        );
                        redraw((v) => v + 1);
                      }}
                    />
                  </label>
                  <label>
                    Successful passes
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={engine.adaptivePasses}
                      onChange={(e) => {
                        engine.adaptivePasses = Math.max(
                          1,
                          Math.min(10, Number(e.target.value)),
                        );
                        redraw((v) => v + 1);
                      }}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={countIn}
                      onChange={(e) => setCountIn(e.target.checked)}
                    />
                    One-bar count-in
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={scheduler.metronome}
                      onChange={(e) => {
                        scheduler.metronome = e.target.checked;
                        redraw((v) => v + 1);
                      }}
                    />
                    Metronome
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={scheduler.accompaniment}
                      onChange={(e) => {
                        scheduler.accompaniment = e.target.checked;
                        engine.epoch++;
                        redraw((v) => v + 1);
                      }}
                    />
                    Auto accompaniment
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={computerSound}
                      onChange={(e) => {
                        setComputerSound(e.target.checked);
                        audio.stopAll();
                      }}
                    />
                    Computer sound
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={notation}
                      onChange={(e) => setNotation(e.target.checked)}
                    />
                    Pitch-reading staff
                  </label>
                </div>
                <p className="muted">
                  Adaptive speed adds 5% after {engine.adaptivePasses} completed
                  Rhythm loops meeting both precision and recall thresholds.
                  Learn mode never raises speed automatically. Computer sound
                  uses a bundled synthesizer; leave it off to hear your piano’s
                  own sound.
                </p>
                {notation && <Staff song={song} />}
              </details>
            </>
          )}
          {page === "library" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR MIDI LIBRARY</div>
                  <h1>Your pieces.</h1>
                  <p>
                    Import the music you want to play. Your files stay on this
                    device.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" />
                  Import MIDI
                </button>
              </div>
              <input
                className="piece-search"
                aria-label="Search pieces"
                placeholder="Search your pieces…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="library-grid">
                {songs
                  .filter((s) =>
                    (s.title + " " + (s.composer ?? ""))
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((s, i) => (
                    <article className="lesson-card" key={s.id}>
                      <div className="card-top">
                        <span className="lesson-number">MIDI</span>
                        <span className="tag">
                          {completedIds.has(s.id)
                            ? "Practiced"
                            : "Ready to play"}
                        </span>
                      </div>
                      <h2>{s.title}</h2>
                      <p>{s.explanation}</p>
                      <div className="card-footer">
                        <span>
                          {s.notes.length} notes ·{" "}
                          {Math.round(s.tempos[0]?.bpm ?? 120)} BPM
                        </span>
                        <button
                          aria-label={"Practice " + s.title}
                          onClick={() => selectSong(s)}
                        >
                          Practice <Icon name="arrow" size={16} />
                        </button>
                      </div>
                      {!s.lesson && (
                        <button
                          className="text-button"
                          onClick={() => {
                            db.songs
                              .delete(s.id)
                              .then(() => {
                                if (song.id === s.id) selectSong(pathetique);
                                return reload();
                              })
                              .catch(report);
                          }}
                        >
                          Delete imported song
                        </button>
                      )}
                    </article>
                  ))}
              </div>
            </>
          )}
          {page === "progress" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR MUSIC, TAKING SHAPE</div>
                  <h1>Every practice counts.</h1>
                  <p>Real attempts, saved privately in this browser.</p>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    backup()
                      .then((v) => download("cadence-backup.json", v))
                      .catch(report)
                  }
                >
                  <Icon name="upload" />
                  Export backup
                </button>
              </div>
              <div className="progress-stats">
                <div>
                  <strong>{sessions.length}</strong>
                  <span>Saved attempts</span>
                </div>
                <div>
                  <strong>{completed.length}</strong>
                  <span>Completed practices</span>
                </div>
                <div>
                  <strong>
                    {songs.filter((l) => completedIds.has(l.id)).length}
                  </strong>
                  <span>Pieces practiced</span>
                </div>
              </div>
              {sessions.length === 0 ? (
                <div className="empty-state">
                  <Icon name="chart" size={40} />
                  <h2>Your story starts at the keys.</h2>
                  <p>
                    Practice a passage or record some free play to save your
                    first session.
                  </p>
                  <button
                    className="play-button"
                    onClick={() => setPage("practice")}
                  >
                    Go to practice <Icon name="arrow" />
                  </button>
                </div>
              ) : (
                <div className="history">
                  {sessions.map((s) => (
                    <article key={s.id}>
                      <div>
                        <h3>{s.title}</h3>
                        <p>
                          {new Date(s.date).toLocaleString()} ·{" "}
                          {s.config.mode === "wait"
                            ? "Learn"
                            : s.config.mode === "free"
                              ? "Free play"
                              : "Rhythm"}{" "}
                          · {Math.round(s.config.speed * 100)}% ·{" "}
                          {s.config.hand} hands · {duration(s.passage[0])}–
                          {duration(s.passage[1])}
                        </p>
                        <small>
                          {s.config.mode === "wait"
                            ? `${s.hits}/${s.targets} notes found · ${s.extras} extras · ${s.retries} retries`
                            : `Recall ${pct(s.recall)} · precision ${pct(s.precision)} · timing ${s.timingMs === null ? "—" : Math.round(s.timingMs) + " ms"}`}{" "}
                          · {s.completed ? "Completed" : "Stopped early"}
                        </small>
                      </div>
                      <div className="history-actions">
                        <button
                          className="secondary"
                          onClick={() => replay(s).catch(report)}
                        >
                          <Icon name="play" />
                          Replay
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            download(
                              "cadence-performance.mid",
                              performanceMidi(s) as BlobPart,
                              "audio/midi",
                            )
                          }
                        >
                          MIDI
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            db.sessions.delete(s.id).then(reload).catch(report)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {replaying && (
                <button className="play-button" onClick={stopReplay}>
                  Stop replay
                </button>
              )}
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                  <h1>Your piano. Your pace.</h1>
                  <p>A few thoughtful adjustments make practice feel right.</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="settings-card">
                  <h2>Piano connection</h2>
                  <p>
                    Connect your instrument with USB MIDI (usually USB TO HOST),
                    or a MIDI interface. A headphone jack carries audio, not
                    MIDI. USB TO DEVICE is usually for storage.
                  </p>
                  <button className="secondary" onClick={() => setModal(true)}>
                    <Icon name="plug" />
                    Set up piano
                  </button>
                  <p>
                    Use HTTPS or localhost. Desktop Chrome and Edge are the
                    first targets. Firefox may ask for additional permissions.
                    Safari/iOS is not an initial MIDI target; availability is
                    checked in your browser.
                  </p>
                  <h3>Sound routing</h3>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={computerSound}
                      onChange={(e) => {
                        setComputerSound(e.target.checked);
                        audio.stopAll();
                      }}
                    />
                    Computer sound monitoring
                  </label>
                  <p>
                    Leave this off for your piano’s own speakers. If monitoring
                    is on, mute your piano to avoid doubled notes. Simulated
                    input always uses computer sound.
                  </p>
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
                        [
                          "inputOffsetMs",
                          "Input timing offset (ms)",
                          -300,
                          300,
                        ],
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
                        onChange={(e) =>
                          setVisualOffset(Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Audio offset (ms)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scheduler.audioOffsetMs}
                        onChange={(e) => {
                          scheduler.audioOffsetMs = Math.max(
                            0,
                            Math.min(100, Number(e.target.value)),
                          );
                          engine.epoch++;
                          redraw((v) => v + 1);
                        }}
                      />
                    </label>
                  </div>
                  <p>
                    Input offset subtracts from attack timestamps for scoring.
                    Positive visual offset draws notes further ahead. Positive
                    audio offset delays scheduled sound. These are manual
                    adjustments, not a measured end-to-end latency.
                  </p>
                </section>
                <section className="settings-card">
                  <h2>Track & channel assignments</h2>
                  <p>
                    For “{song.title}”. Imported hands begin with a middle-C
                    pitch split. Assignment changes start a new attempt.
                  </p>
                  {assignments.map((key) => {
                    const [track, channel] = key.split(":").map(Number);
                    const ns = song.notes.filter(
                      (n) => n.track === track && n.channel === channel,
                    );
                    const hand = ns.every((n) => n.hand === ns[0].hand)
                      ? ns[0].hand
                      : "split";
                    return (
                      <label className="assignment" key={key}>
                        Track {track + 1} · channel {channel}
                        <select
                          aria-label={
                            "Assign track " +
                            (track + 1) +
                            " channel " +
                            channel
                          }
                          value={hand}
                          onChange={(e) => {
                            const value = e.target.value;
                            const updated = {
                              ...song,
                              notes: song.notes.map((n) =>
                                n.track === track && n.channel === channel
                                  ? {
                                      ...n,
                                      hand: (value === "split"
                                        ? n.pitch < 60
                                          ? "left"
                                          : "right"
                                        : value) as Hand,
                                    }
                                  : n,
                              ),
                            };
                            engine.loadLesson(updated);
                            if (true)
                              db.songs.put(updated).then(reload).catch(report);
                          }}
                        >
                          <option value="split">Pitch split at C4</option>
                          <option value="left">Left hand</option>
                          <option value="right">Right hand</option>
                          <option value="accompaniment">
                            Accompaniment (not scored)
                          </option>
                          <option value="ignored">
                            Ignored (hidden & silent)
                          </option>
                        </select>
                      </label>
                    );
                  })}
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
                      This removes imported songs, attempts and settings from
                      this browser.
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
                            return reload();
                          })
                          .catch(report);
                      }}
                    >
                      Delete all songs, sessions and settings
                    </button>
                  </details>
                  <h3>Offline practice</h3>
                  <p>
                    The production app caches its core and your included piece
                    after the first load. Reopen this same address offline.
                    Imported files and MIDI input need no server. Notation is a
                    simple pitch preview; advanced score reading and MIDI output
                    are future work.
                  </p>
                </section>
              </div>
            </>
          )}
          <footer>
            <span>Your MIDI. Your practice.</span>
            <span>
              cadence · local-first piano practice{" "}
              <span className="tiny-star">✦</span>
            </span>
          </footer>
        </div>
      </main>
      <input
        ref={fileRef}
        className="hidden-input"
        type="file"
        accept=".mid,.midi,.json"
        onChange={(e) => {
          void importSong(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
            }}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close piano setup"
              onClick={() => setModal(false)}
            >
              <Icon name="close" />
            </button>
            <span className="modal-icon">
              <Icon name="plug" size={28} />
            </span>
            <div className="eyebrow">LET’S GET CONNECTED</div>
            <h2 id="connect-title">Bring your piano along.</h2>
            <p>
              Plug your piano’s USB MIDI port into your computer. Then give
              Cadence permission to listen.
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
                <button className="secondary" onClick={() => setModal(false)}>
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
    </div>
  );
}
