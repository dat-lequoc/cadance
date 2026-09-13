import { useEffect, useMemo, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { noteStartAt, PracticeEngine, type Result } from "../core/engine";
import { HardwareInput, SimulatedInput } from "../core/midi";
import { pathetique, initialPieces } from "../core/catalogue";
import { useLoops } from "./useLoops";
import { useQuestPlan } from "./useQuestPlan";
import { applyDashboardTheme } from "./theme";
import { MidiDebugLog } from "../core/midi-debug";

import { readPracticePreferences } from "../core/preferences";
import { keyboardRange } from "../core/model";
import {
  defaults,
  rangeWarnings,
  type Config,
  type InputEvent,
  type Song,
} from "../core/model";
import { AudioScheduler, PianoAudio } from "../core/audio";
import { db } from "../core/storage";
import { importFile, download } from "../core/files";

export function usePracticeController() {
  const engine = useMemo(() => {
    const engine = new PracticeEngine(pathetique);
    engine.preparationSeconds = 1;
    return engine;
  }, []);
  const audio = useMemo(() => new PianoAudio(), []);
  const debugLog = useMemo(() => new MidiDebugLog(), []);
  const debugSavedRevision = useRef(0);
  const persistDebug = async () => {
    const revision = debugLog.revision;
    await db.settings.put({ key: "midi-debug-v1", value: structuredClone(debugLog.data()) });
    debugSavedRevision.current = revision;
  };
  const scheduler = useMemo(
    () => new AudioScheduler(engine, audio),
    [engine, audio],
  );
  const simulated = useMemo(() => new SimulatedInput(), []);
  const [revision, redraw] = useState(0),
    [ready, setReady] = useState(false),
    [page, setPage] = useState<Screen>("setup"),
    [modal, setModal] = useState(false),
    [source, setSource] = useState<"none" | "hardware" | "simulated">("none"),
    [deviceVersion, setDeviceVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [monitor, setMonitor] = useState<InputEvent[]>([]),
    [songs, setSongs] = useState<Song[]>(initialPieces),
    [sessions, setSessions] = useState<Result[]>([]),
    [computerSound, setComputerSound] = useState(false),
    [visible, setVisible] = useState("88"),
    [notation, setNotation] = useState(false),
    [visualOffset, setVisualOffset] = useState(0),
    [countIn, setCountIn] = useState(false),
    [replaying, setReplaying] = useState(false),
    [calibrated, setCalibrated] = useState(false),
    [search, setSearch] = useState(""),
    [labels, setLabels] = useState<"notes" | "fingers" | "none">("notes"),
    [showBackground, setShowBackground] = useState(true),
    [zoom, setZoom] = useState(90);
  const [sheetMusic, setSheetMusic] = useState(false);
  const [sheetOnly, setSheetOnly] = useState(false);
  const [sheetWrongNotes, setSheetWrongNotes] = useState(true);
  const [sheetZoom, setSheetZoom] = useState(1);
  const [sheetSpace, setSheetSpace] = useState(35);
  const [dashboardDark, setDashboardDark] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [panel, setPanel] = useState<"tools" | "passages" | null>(null);
  const [review, setReview] = useState<Result | null>(null);
  const [pendingSaves, setPendingSaves] = useState<Result[]>([]);
  const pendingSave = pendingSaves[0] ?? null;
  const pendingStart = useRef(false);
  const startGeneration = useRef(0);
  const starting = useRef(false);
  const preferenceWrite = useRef<Promise<unknown>>(Promise.resolve());
  const preferenceSnapshot = useRef(readPracticePreferences(undefined));
  const preferenceCacheKey = "cadance-practice-preferences-v1";
  const [browsePosition, setBrowsePosition] = useState<number | null>(null);
  const resumeFromBrowse = useRef<number | null>(null);
  const listenRestore = useRef<{ config: Config; passage: [number, number] } | null>(null);
  const clearBrowse = () => {
    resumeFromBrowse.current = null;
    setBrowsePosition(null);
  };
  const cancelStart = () => {
    startGeneration.current++;
    starting.current = false;
    pendingStart.current = false;
  };
  const practiceMode = useRef<Config["mode"]>("wait");
  const inputEnabled = useRef(false);
  inputEnabled.current = (page === "player" && !panel) || modal;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const soundRef = useRef(computerSound);
  soundRef.current = computerSound;
  const fileRef = useRef<HTMLInputElement>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayGeneration = useRef(0);
  const suspendQuest = useRef(() => {});
  const hardware = useMemo(
    () =>
      new HardwareInput(
        () => setDeviceVersion((v) => v + 1),
        (port) => {
          cancelStart();
          suspendQuest.current();
          engine.deviceLost(port);
          audio.stopAll();
        },
      ),
    [engine, audio],
  );
  const report = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const quests = useQuestPlan(engine, report);
  suspendQuest.current = () => quests.runner.suspend();
  useEffect(() => {
    const subscription = liveQuery(() => db.sessions.toArray()).subscribe({
      next: (results) =>
        setSessions(results.sort((a, b) => b.date.localeCompare(a.date))),
      error: report,
    });
    return () => subscription.unsubscribe();
  }, []);
  const reload = async () => {
    setSongs(await db.songs.toArray());
    setSessions(
      (await db.sessions.toArray()).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    );
  };
  const persistPreferences = (
    patch: Partial<ReturnType<typeof readPracticePreferences>>,
  ) => {
    const value = {
      ...preferenceSnapshot.current,
      ...patch,
      savedAt: Math.max(
        Date.now(),
        (preferenceSnapshot.current.savedAt ?? 0) + 1,
      ),
    };
    preferenceSnapshot.current = value;
    try {
      localStorage.setItem(preferenceCacheKey, JSON.stringify(value));
    } catch {
      /* IndexedDB remains the primary store. */
    }
    preferenceWrite.current = db.settings.put({
      key: "practice-preferences-v1",
      value,
    });
    void preferenceWrite.current.catch(report);
  };
  const restorePreferences = async (
    fromBackup = false,
    isCurrent = () => true,
  ) => {
    const [row, legacy] = await Promise.all([
      db.settings.get("practice-preferences-v1"),
      db.settings.get("preparation-seconds"),
    ]);
    if (!isCurrent()) return;
    let p = readPracticePreferences(row?.value, legacy?.value);
    try {
      const cached = readPracticePreferences(
        JSON.parse(localStorage.getItem(preferenceCacheKey) ?? "null"),
        legacy?.value,
      );
      if (!fromBackup && (cached.savedAt ?? 0) > (p.savedAt ?? 0)) p = cached;
      localStorage.setItem(preferenceCacheKey, JSON.stringify(p));
    } catch {
      /* A missing cache does not prevent loading IndexedDB. */
    }
    preferenceSnapshot.current = p;
    preferenceWrite.current = db.settings.put({
      key: "practice-preferences-v1",
      value: p,
    });
    await preferenceWrite.current;
    if (!isCurrent()) return;
    setComputerSound(p.soundSource === "computer");
    soundRef.current = p.soundSource === "computer";
    scheduler.accompaniment = p.accompaniment;
    scheduler.metronome = p.metronome;
    scheduler.audioOffsetMs = p.audioOffset;
    engine.countIn = p.countIn;
    setCountIn(p.countIn);
    engine.preparationSeconds = p.preparationSeconds;
    setVisualOffset(p.visualOffset);
    setSheetMusic(p.sheetMusic);
    setSheetOnly(p.sheetOnly);
    setSheetWrongNotes(p.sheetWrongNotes);
    setSheetZoom(p.sheetZoom);
    setSheetSpace(p.sheetSpace);
    quests.runner.speedOverride = p.practiceSpeed;
    setDashboardDark(p.dashboardDark);
    applyDashboardTheme(p.dashboardDark);
    engine.epoch++;
    if (fromBackup) {
      debugLog.clear();
      debugLog.enabled = true;
      debugLog.restore((await db.settings.get("midi-debug-v1"))?.value);
      if (p.practiceSpeed !== null) engine.setSpeed(p.practiceSpeed);
    }
    redraw((v) => v + 1);
  };
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      if (!(await db.settings.get("piece-workspace-v2"))) {
        await db.songs.put(pathetique);
        await db.settings.put({ key: "piece-workspace-v2", value: true });
        await db.settings.put({ key: "lastPiece", value: pathetique.id });
      }
      for (const piece of initialPieces) {
        const key = "bundled-piece:" + piece.id;
        const existing = await db.songs.get(piece.id);
        if (!(await db.settings.get(key))) {
          if (!existing) await db.songs.put(piece);
          await db.settings.put({ key, value: true });
        }
        // Add newly supplied reference metadata without replacing edited parts
        // or resurrecting a piece the user deleted from their library.
        if (existing && !existing.studyScore && piece.studyScore)
          await db.songs.update(piece.id, { studyScore: piece.studyScore });
      }
      await reload();
      const preferences = (await db.settings.get("display-v1"))?.value as
        Record<string, unknown> | undefined;
      if (preferences?.version === 1) {
        if (["song", "88", "49", "25"].includes(String(preferences.visible)))
          setVisible(String(preferences.visible));
        if (["notes", "fingers", "none"].includes(String(preferences.labels)))
          setLabels(preferences.labels as "notes" | "fingers" | "none");
        if (
          typeof preferences.zoom === "number" &&
          Number.isFinite(preferences.zoom)
        )
          setZoom(Math.max(45, Math.min(180, preferences.zoom)));
        if (typeof preferences.showBackground === "boolean")
          setShowBackground(preferences.showBackground);
      }
      await restorePreferences(false, () => !disposed);
      debugLog.restore((await db.settings.get("midi-debug-v1"))?.value);
      const remembered = (await db.settings.get("lastDevice"))?.value;
      if (typeof remembered === "string" && remembered && !disposed) {
        try {
          const permission = await navigator.permissions.query({ name: "midi", sysex: false } as unknown as PermissionDescriptor);
          if (permission.state === "granted") {
            await hardware.connect();
            if (!disposed) {
              hardware.select(remembered);
              sourceRef.current = "hardware";
              setSource("hardware");
            }
          }
        } catch { /* Unsupported permission checks fall back to explicit connection. */ }
      }
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
        if (!disposed) {
          const speed = preferenceSnapshot.current.practiceSpeed;
          if (speed !== null) engine.setSpeed(speed);
          setReady(true);
        }
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
      debugLog.capture(engine, e, quests.runner.activeId, () => engine.receive(e));
      if (soundRef.current || e.source === "simulated") audio.receive(e);
      setMonitor((v) => [e, ...v].slice(0, 8));
      if (e.type === "on" && e.pitch === 60) setCalibrated(true);
    };
    const off1 = simulated.subscribe(receive),
      off2 = hardware.subscribe(receive),
      off3 = engine.subscribe(() => {
        const restore = listenRestore.current;
        if (restore && engine.status === "finished") {
          listenRestore.current = null;
          engine.stop();
          engine.config = { ...restore.config };
          engine.selectPassage(...restore.passage, false);
        }
        redraw((v) => v + 1);
      });
    engine.onResult = (r) => {
      if (quests.runner.handleResult(r)) return;
      setPendingSaves((current) => [...current, r]);
      db.sessions
        .put(r)
        .then(() => {
          setPendingSaves((current) =>
            current.filter((result) => result.id !== r.id),
          );
          return reload();
        })
        .catch(report);
    };
    scheduler.start();
    const background = () => {
      // Keep AudioContext supplied across background timer throttling.
      scheduler.lookaheadSeconds = document.hidden ? 2 : 0.1;
      scheduler.pump();
    };
    document.addEventListener("visibilitychange", background);
    const timer = setInterval(() => redraw((v) => v + 1), 100);
    return () => {
      disposed = true;
      off1();
      off2();
      off3();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", background);
      scheduler.dispose();
      hardware.dispose();
      engine.pause();
      engine.onResult = undefined;
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, [engine, audio, hardware, simulated, scheduler]);
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      if (debugLog.revision !== debugSavedRevision.current) void persistDebug().catch(report);
    };
    const timer = setInterval(save, 1000);
    const hide = () => { if (document.hidden) save(); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, [ready, debugLog]);
  const stopReplay = () => {
    replayGeneration.current++;
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
      if (!inputEnabled.current) return;
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      if (map[k] !== undefined) {
        pressed.add(k);
        press(map[k]);
      }
      if (k === "shift" && sourceRef.current === "simulated") {
        e.preventDefault();
        simulated.send([0xb0, 64, 127]);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (pressed.delete(k)) release(map[k]);
      if (k === "shift" && sourceRef.current === "simulated")
        simulated.send([0xb0, 64, 0]);
    };
    const blur = () => {
      for (const k of pressed) release(map[k]);
      pressed.clear();
      simulated.send([0xb0, 64, 0]);
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
    cancelStart();
    clearBrowse();
    quests.runner.leave();
    stopReplay();
    engine.loadLesson(song);
    db.settings.put({ key: "lastPiece", value: song.id }).catch(report);
    setPage("setup");
  };
  const configure = (patch: Partial<Config>) => {
    cancelStart();
    clearBrowse();
    if (Object.keys(patch).every((key) => key === "speed") && patch.speed !== undefined) {
      engine.setSpeed(patch.speed);
      quests.runner.speedOverride = engine.config.speed;
      persistPreferences({ practiceSpeed: engine.config.speed });
      db.settings.put({ key: "config", value: engine.config }).catch(report);
      return;
    }
    quests.runner.leave();
    stopReplay();
    engine.configure(patch);
    db.settings.put({ key: "config", value: engine.config }).catch(report);
  };
  const importSong = async (file?: File) => {
    if (!file) return;
    if (/\.md$/i.test(file.name)) {
      await quests.importPlan(file);
      return;
    }
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
      const remembered = (await db.settings.get("lastDevice"))?.value;
      if (typeof remembered === "string" && remembered) {
        hardware.select(remembered);
        sourceRef.current = "hardware";
        setSource("hardware");
      }
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
    if (pendingStart.current) {
      pendingStart.current = false;
      void play();
    }
  };
  const play = async () => {
    if (!ready || updating) return;
    if (quests.runner.active && (quests.runner.saving || quests.runner.error))
      return;
    if (starting.current) {
      cancelStart();
      return;
    }
    setError("");
    stopReplay();
    try {
      if (engine.status === "playing" || engine.status === "waiting") {
        quests.runner.suspend();
        engine.pause();
        audio.stopAll();
        return;
      }
      if (
        !["listen"].includes(engine.config.mode) &&
        (sourceRef.current === "none" ||
          (sourceRef.current === "hardware" && !hardware.connected))
      ) {
        pendingStart.current = true;
        setModal(true);
        return;
      }
      const generation = ++startGeneration.current;
      starting.current = true;
      await audio.unlock();
      if (generation !== startGeneration.current) return;
      starting.current = false;
      if (
        engine.config.mode !== "listen" &&
        sourceRef.current === "hardware" &&
        !hardware.connected
      )
        return;
      const preview = resumeFromBrowse.current;
      if (preview !== null) {
        const onset = noteStartAt(engine.song, engine.config, preview);
        const activeId = quests.runner.activeId;
        if (activeId) {
          // A score preview is not a practice seek. Keep the active quest
          // attached and restart its configured passage; rehearing from the
          // selected line is provided explicitly by Listen forward.
          quests.runner.prepare(activeId);
        } else {
          // Score browsing leaves quest counting, but the lead-in should keep
          // the hand/part selected by the quest instead of falling back to
          // the user's general both-hands setting.
          const questHand = quests.runner.active?.hand;
          const questFocus = quests.runner.active?.focus;
          quests.runner.leave();
          if (questHand) engine.config.hand = questHand;
          if (questFocus) engine.config.focus = questFocus;
          engine.seek(onset);
        }
      }
      clearBrowse();
      quests.runner.resume();
      setReview(null);
      setPanel(null);
      // Practice starts directly on the first target. Listen mode keeps the
      // optional preparation/count-in preference for a calmer entry.
      const listenMode = engine.config.mode === "listen";
      engine.preparationSeconds = listenMode
        ? preferenceSnapshot.current.preparationSeconds
        : 0;
      engine.start(listenMode ? engine.preparationDuration : 0);
      setPage("player");
    } catch (e) {
      starting.current = false;
      report(e);
    }
  };
  const selectMode = (mode: Config["mode"]) => {
    configure({ mode });
    if (mode === "recital" || mode === "free")
      engine.selectPassage(0, engine.song.duration, false);
  };
  const listen = () => {
    if (engine.config.mode !== "listen") {
      if (engine.config.mode !== "free")
        practiceMode.current = engine.config.mode;
      configure({ mode: "listen" });
    }
    void play();
  };
  const listenSection = async () => {
    if (engine.status === "playing" || engine.status === "waiting") return;
    const selected = resumeFromBrowse.current ?? engine.passage[0];
    // Leave score-browse mode so the playhead follows the live audio position.
    clearBrowse();
    await audio.unlock();
    listenRestore.current = { config: { ...engine.config }, passage: [...engine.passage] };
    engine.stop();
    engine.config = { ...engine.config, mode: "listen" };
    // Listen from the selected point through the rest of the piece. This is
    // preview audio only and is restored before the next practice attempt.
    engine.selectPassage(Math.max(0, Math.min(engine.song.duration - 0.001, selected)), engine.song.duration, false);
    engine.start(engine.preparationDuration);
  };
  const startPractice = () => {
    // Returning from the player leaves the engine paused but clears the
    // transient activeId. Reattach the persisted checkpoint before resuming,
    // so skipped checkpoints do not redirect the run to the first incomplete
    // quest.
    const resumedQuest =
      engine.status === "paused" &&
      !["listen", "free"].includes(engine.config.mode) &&
      quests.runner.lastQuest;
    if (resumedQuest)
      quests.runner.prepare(resumedQuest.id);
    else quests.runner.leave();
    if (engine.config.mode === "listen")
      configure({ mode: practiceMode.current });
    void play();
  };
  const saveParts = (updated: Song) => {
    cancelStart();
    clearBrowse();
    quests.runner.leave();
    stopReplay();
    engine.loadLesson(updated);
    db.songs.put(updated).then(reload).catch(report);
  };
  const replay = async (r: Result) => {
    cancelStart();
    stopReplay();
    const generation = replayGeneration.current;
    engine.pause();
    await audio.unlock();
    if (generation !== replayGeneration.current) return;
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
  const loops = useLoops(engine, report, () => quests.runner.leave());
  const pause = () => {
    cancelStart();
    quests.runner.suspend();
    engine.pause();
    audio.stopAll();
  };
  const navigate = (next: Screen) => {
    clearBrowse();
    quests.runner.leave();
    pause();
    stopReplay();
    setPanel(null);
    setPage(next);
  };
  const closeConnection = () => {
    setModal(false);
    if (
      pendingStart.current &&
      (sourceRef.current === "simulated" || hardware.connected)
    ) {
      pendingStart.current = false;
      void play();
    } else pendingStart.current = false;
  };
  const openPanel = (next: "tools" | "passages") => {
    pause();
    setPanel(next);
  };
  const finish = () => {
    cancelStart();
    clearBrowse();
    quests.runner.leave();
    const result = engine.result(false);
    const previousId = engine.lastResult?.id;
    engine.stop();
    audio.stopAll();
    setReview(
      engine.lastResult && engine.lastResult.id !== previousId
        ? engine.lastResult
        : result,
    );
    setPanel(null);
    setPage("review");
  };
  useEffect(() => {
    if (
      page === "player" &&
      engine.status === "finished" &&
      !engine.loop &&
      !quests.runner.active
    ) {
      const recorded =
        engine.config.mode !== "listen" &&
        (engine.events.length > 0 ||
          engine.hits.size > 0 ||
          engine.misses.size > 0);
      setReview(
        recorded && engine.lastResult ? engine.lastResult : engine.result(true),
      );
      setPage("review");
      audio.stopAll();
    }
  }, [revision, page, engine, audio]);
  useEffect(() => {
    if (!ready) return;
    void db.settings
      .put({
        key: "display-v1",
        value: { version: 1, visible, labels, zoom, showBackground },
      })
      .catch(report);
  }, [ready, visible, labels, zoom, showBackground]);
  useEffect(() => {
    if (page !== "player" || panel || modal) {
      for (const event of engine.input.held.values())
        if (event.source === "simulated")
          simulated.send([0x80, event.pitch, 0]);
      simulated.send([0xb0, 64, 0]);
      audio.stopAll();
    }
  }, [page, panel, modal, engine, audio, simulated]);
  useEffect(() => {
    if (!modal) return;
    quests.runner.suspend();
    engine.pause();
    audio.stopAll();
  }, [modal, engine, audio]);
  const restart = () => {
    pause();
    clearBrowse();
    engine.restart();
  };
  const seek = (position: number) => {
    quests.runner.leave();
    pause();
    clearBrowse();
    engine.seek(position);
  };
  const previewAt = (seconds: number) => {
    pause();
    const position = Math.max(0, Math.min(engine.song.duration, seconds));
    resumeFromBrowse.current = position;
    setBrowsePosition(position);
  };
  const scroll = (delta: number) => {
    if (!delta) return;
    previewAt((resumeFromBrowse.current ?? engine.currentPosition()) + delta / zoom);
  };
  useEffect(() => {
    if (page !== "player" || modal) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panel) setPanel(null);
        else pause();
        return;
      }
      if (
        panel ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement).closest("input,select,textarea,[contenteditable=true],[role=dialog]")
      )
        return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        // Cancel native scrolling and focused-button activation on every repeat.
        e.preventDefault();
        if (!e.repeat) void play();
        return;
      }
      if (e.repeat) return;
      if (k === "p") {
        e.preventDefault();
        void play();
      }
      if (k === "r") {
        e.preventDefault();
        restart();
      }
      if (k === "[") {
        e.preventDefault();
        loops.markA();
      }
      if (k === "]") {
        e.preventDefault();
        loops.markB();
      }
      if (k === "l") {
        e.preventDefault();
        loops.toggle();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return {
    engine,
    quests,
    flushPreferences: async () => {
      await persistDebug();
      await preferenceWrite.current.catch(() =>
        db.settings.put({
          key: "practice-preferences-v1",
          value: preferenceSnapshot.current,
        }),
      );
    },
    updating,
    stopForUpdate: () => {
      setUpdating(true);
      pause();
      stopReplay();
      engine.stop();
    },
    savesPending:
      pendingSaves.length > 0 || quests.runner.saving || !!quests.runner.error,
    setPreparation: (seconds: number) => {
      if (![0, 1, 2, 3, 5].includes(seconds)) return;
      engine.preparationSeconds = seconds;
      persistPreferences({ preparationSeconds: seconds });
      redraw((v) => v + 1);
    },
    setAccompaniment: (value: boolean) => {
      scheduler.accompaniment = value;
      engine.epoch++;
      persistPreferences({ accompaniment: value });
      redraw((v) => v + 1);
    },
    setMetronome: (value: boolean) => {
      scheduler.metronome = value;
      persistPreferences({ metronome: value });
      redraw((v) => v + 1);
    },
    setAudioOffset: (value: number) => {
      if (!Number.isFinite(value)) return;
      scheduler.audioOffsetMs = Math.max(0, Math.min(100, value));
      engine.epoch++;
      persistPreferences({ audioOffset: scheduler.audioOffsetMs });
      redraw((v) => v + 1);
    },
    seek,
    restart,
    browsePosition,
    resumePosition: browsePosition === null ? null : noteStartAt(engine.song, engine.config, browsePosition),
    previewAt,
    scroll,
    backToPlayhead: clearBrowse,
    startQuest: (id: string) => {
      cancelStart();
      clearBrowse();
      try {
        stopReplay();
        quests.runner.prepare(id);
        setVisible("88");
        void play();
      } catch (error) {
        report(error);
      }
    },
    audio,
    scheduler,
    simulated,
    hardware,
    ready,
    page,
    navigate,
    panel,
    setPanel,
    openPanel,
    modal,
    setModal: (value: boolean) => {
      if (value) cancelStart();
      setModal(value);
    },
    closeConnection,
    review,
    pendingSave,
    retrySave: () => {
      for (const result of pendingSaves) {
        void db.sessions
          .put(result)
          .then(() => {
            setPendingSaves((current) =>
              current.filter((item) => item.id !== result.id),
            );
            setError("");
            return reload();
          })
          .catch(report);
      }
    },
    source,
    sourceRef,
    setSource,
    deviceVersion,
    error,
    setError,
    busy,
    monitor,
    debugLog,
    setDebugRecording: (enabled: boolean) => {
      debugLog.enabled = enabled;
      debugLog.revision++;
      void persistDebug().catch(report);
      redraw((v) => v + 1);
    },
    clearDebugLog: () => {
      debugLog.clear();
      void persistDebug().catch(report);
      redraw((v) => v + 1);
    },
    downloadDebugLog: () => {
      void (async () => {
        const recentRuns = await db.sessions.orderBy("date").reverse().limit(10).toArray();
        download("cadance-midi-debug.json", JSON.stringify({ ...debugLog.data(), exportedAt: new Date().toISOString(), timeOrigin: performance.timeOrigin, current: engine.result(false), quest: { id: quests.runner.activeId, message: quests.runner.message, count: quests.runner.count }, recentRuns }, null, 2));
        await persistDebug();
      })().catch(report);
    },
    songs,
    sessions,
    computerSound,
    setComputerSound: (value: boolean) => {
      soundRef.current = value;
      persistPreferences({ soundSource: value ? "computer" : "piano" });
      setComputerSound(value);
      audio.stopAll();
      engine.epoch++;
    },
    visible,
    setVisible,
    notation,
    setNotation,
    visualOffset,
    setVisualOffset: (value: number) => {
      if (!Number.isFinite(value)) return;
      const offset = Math.max(-300, Math.min(300, value));
      setVisualOffset(offset);
      persistPreferences({ visualOffset: offset });
    },
    countIn,
    setCountIn: (value: boolean) => {
      engine.countIn = value;
      persistPreferences({ countIn: value });
      setCountIn(value);
    },
    replaying,
    calibrated,
    setCalibrated,
    search,
    setSearch,
    labels,
    setLabels,
    showBackground,
    setShowBackground,
    zoom,
    setZoom,
    sheetWrongNotes,
    setSheetWrongNotes: (value: boolean) => {
      setSheetWrongNotes(value);
      persistPreferences({ sheetWrongNotes: value });
    },
    sheetOnly,
    setSheetOnly: (value: boolean) => {
      setSheetOnly(value);
      engine.preparationSeconds = value ? 0 : preferenceSnapshot.current.preparationSeconds;
      persistPreferences({ sheetOnly: value });
    },
    sheetMusic,
    setSheetMusic: (value: boolean) => {
      setSheetMusic(value);
      persistPreferences({ sheetMusic: value });
    },
    sheetZoom,
    sheetSpace,
    setSheetSpace: (value: number) => {
      if (!Number.isFinite(value)) return;
      const space = Math.max(20, Math.min(50, value));
      setSheetSpace(space);
      persistPreferences({ sheetSpace: space });
    },
    dashboardDark,
    setDashboardDark: (value: boolean) => {
      setDashboardDark(value);
      applyDashboardTheme(value);
      persistPreferences({ dashboardDark: value });
    },
    setSheetZoom: (value: number) => {
      if (!Number.isFinite(value)) return;
      const zoom = Math.max(0.75, Math.min(2, value));
      setSheetZoom(zoom);
      persistPreferences({ sheetZoom: zoom });
    },
    fileRef,
    redraw,
    report,
    reload,
    restorePreferences,
    stopReplay,
    press,
    release,
    selectSong,
    configure,
    importSong,
    connect,
    useSimulated,
    play,
    pause,
    finish,
    selectMode,
    listen,
    listenSection,
    startPractice,
    practiceMode: practiceMode.current,
    openPlayer: () => setPage("player"),
    saveParts,
    replay,
    r,
    completed,
    completedIds,
    config,
    active,
    warnings,
    song,
    viewMin,
    viewMax,
    loops,
  };
}
export type Screen =
  "library" | "setup" | "player" | "review" | "progress" | "settings";
export type PracticeController = ReturnType<typeof usePracticeController>;
