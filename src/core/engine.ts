import {
  defaults,
  rhythmMode,
  prepare,
  rangeWarnings,
  scored,
  keyId,
  type Config,
  type InputEvent,
  type Note,
  type Song,
} from "./model";
import { InputState, type MidiInputAdapter } from "./midi";
export type Status = "ready" | "playing" | "waiting" | "paused" | "finished";
export interface RecordedEvent {
  event: InputEvent;
  elapsedMs: number;
  position: number;
}
export interface Result {
  id: string;
  songId: string;
  title: string;
  date: string;
  config: Config;
  passage: [number, number];
  hits: number;
  misses: number;
  extras: number;
  targets: number;
  recall: number | null;
  precision: number | null;
  timingMs: number | null;
  retries: number;
  findingMs: number;
  completed: boolean;
  events: RecordedEvent[];
  checkpoints: {
    elapsedMs: number;
    position: number;
    action: string;
    speed: number;
  }[];
}
export class PracticeEngine {
  readonly input = new InputState();
  song: Song;
  config: Config;
  notes: Note[] = [];
  targets: Note[] = [];
  status: Status = "ready";
  position = 0;
  epoch = 0;
  hits = new Set<string>();
  misses = new Set<string>();
  extras = 0;
  timings: number[] = [];
  retries = 0;
  findingMs = 0;
  partial = new Map<number, { time: number; key: string }>();
  groups: { time: number; notes: Note[] }[] = [];
  groupIndex = 0;
  feedback = "Take a breath. Start when you’re ready.";
  lastWrong: number | null = null;
  loop: [number, number] | null = null;
  passage: [number, number];
  adaptive = false;
  successes = 0;
  adaptiveThreshold = 0.9;
  adaptivePasses = 3;
  lastResult: Result | null = null;
  events: RecordedEvent[] = [];
  checkpoints: Result["checkpoints"] = [];
  onResult?: (r: Result) => void;
  private anchorTime = 0;
  private anchorPosition = 0;
  private startedAt = 0;
  private waitingAt = 0;
  private listeners = new Set<() => void>();
  private detach?: () => void;
  constructor(
    song: Song,
    config: Partial<Config> = {},
    public now = () => performance.now(),
  ) {
    this.song = song;
    this.config = { ...defaults, ...config };
    this.passage = [0, song.duration];
    this.rebuild();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  attach(adapter: MidiInputAdapter) {
    this.detach?.();
    this.detach = adapter.subscribe((e) => this.receive(e));
  }
  dispose() {
    this.pause("Practice closed");
    this.detach?.();
    this.listeners.clear();
  }
  private rebuild() {
    this.notes = prepare(this.song, this.config);
    const unique = new Set<string>();
    this.targets = this.notes.filter((n) => {
      const k = `${n.time}:${n.pitch}`;
      if (
        !scored(n, this.config) ||
        n.time < this.passage[0] ||
        n.time >= this.passage[1] ||
        unique.has(k)
      )
        return false;
      unique.add(k);
      return true;
    });
    this.groups = [];
    for (const n of this.targets) {
      const last = this.groups.at(-1);
      if (last && (n.time - last.time) * 1000 <= this.config.groupingMs)
        last.notes.push(n);
      else this.groups.push({ time: n.time, notes: [n] });
    }
  }
  private checkpoint(action: string) {
    this.checkpoints.push({
      elapsedMs: this.now() - this.startedAt,
      position: this.position,
      action,
      speed: this.config.speed,
    });
  }
  private resetAttempt() {
    this.hits.clear();
    this.misses.clear();
    this.extras = 0;
    this.timings = [];
    this.partial.clear();
    this.retries = 0;
    this.findingMs = 0;
    this.events = [];
    this.checkpoints = [];
    this.startedAt = this.now();
    this.lastWrong = null;
    this.groupIndex = 0;
    this.rebuild();
    this.epoch++;
  }
  loadLesson(song: Song) {
    this.stop();
    this.song = song;
    this.passage = [0, song.duration];
    this.loop = null;
    this.position = 0;
    this.resetAttempt();
    this.status = "ready";
    this.feedback = song.explanation;
    this.emit();
  }
  configure(patch: Partial<Config>) {
    if (Object.keys(patch).every((k) => k === "speed")) {
      this.setSpeed(patch.speed!);
      return;
    }
    this.stop();
    this.config = { ...this.config, ...patch };
    this.position = this.passage[0];
    this.resetAttempt();
    this.status = "ready";
    this.emit();
  }
  setSpeed(speed: number) {
    this.tick();
    this.config.speed = Math.min(1.5, Math.max(0.25, speed));
    this.anchorPosition = this.position;
    this.anchorTime = this.now();
    this.epoch++;
    this.checkpoint("speed");
    this.emit();
  }
  selectPassage(a: number, b: number, loop = false) {
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      a < 0 ||
      b > this.song.duration ||
      b <= a
    )
      throw Error("Choose an A/B passage within the song, with B after A.");
    this.stop();
    this.passage = [a, b];
    this.loop = loop ? [a, b] : null;
    this.position = a;
    this.resetAttempt();
    this.status = "ready";
    this.emit();
  }
  seek(seconds: number, preserveLoop = true) {
    const oldLoop = this.loop;
    this.stop();
    const p = Math.max(0, Math.min(this.song.duration - 0.001, seconds));
    const retained =
      preserveLoop && oldLoop && p >= oldLoop[0] && p < oldLoop[1]
        ? oldLoop
        : null;
    this.passage = [p, retained?.[1] ?? this.song.duration];
    this.loop = retained;
    this.position = p;
    this.resetAttempt();
    this.status = "ready";
    this.feedback = "Position changed. Start a new attempt here.";
    this.emit();
  }
  restart() {
    const start = this.loop?.[0] ?? this.passage[0];
    this.stop();
    if (this.loop) this.passage = [...this.loop];
    this.position = start;
    this.resetAttempt();
    this.status = "ready";
    this.emit();
  }
  start(countInSeconds = 0) {
    if (this.status === "playing" || this.status === "waiting") return;
    if (
      this.config.mode !== "listen" &&
      this.config.mode !== "free" &&
      rangeWarnings(this.song, this.config).length
    )
      throw Error(
        "Some targets are outside your piano range. Adjust range, hand assignment or transposition before starting.",
      );
    if (!["listen", "free"].includes(this.config.mode) && !this.targets.length)
      throw Error(
        "No notes match this hand and part. Choose Both hands or All notes, or edit the part assignments.",
      );
    if (this.status === "finished" || this.status === "ready") {
      this.position = this.passage[0] - countInSeconds * this.config.speed;
      this.resetAttempt();
    }
    this.anchorTime = this.now();
    this.anchorPosition = this.position;
    this.status = "playing";
    this.checkpoint("start");
    this.feedback =
      this.config.mode === "listen"
        ? "Listen to the shape of the phrase."
        : "Follow the notes to the strike line.";
    this.epoch++;
    this.tick();
    this.emit();
  }
  pause(reason = "Paused — resume when you’re ready.") {
    if (this.status === "playing" || this.status === "waiting") {
      this.tick();
      if ((this.status as Status) === "finished") return;
      if (this.status === "waiting")
        this.findingMs += this.now() - this.waitingAt;
      this.status = "paused";
      this.partial.clear();
      this.feedback = reason;
      this.epoch++;
      this.checkpoint("pause");
      this.emit();
    }
  }
  stop() {
    if (["playing", "waiting", "paused"].includes(this.status)) {
      if (this.status === "waiting") {
        this.findingMs += this.now() - this.waitingAt;
        this.status = "paused";
      }
      this.save(false);
    }
    this.status = "ready";
    this.position = this.passage[0];
    this.partial.clear();
    this.epoch++;
    this.emit();
  }
  panic() {
    this.pause("All app sound stopped. Release held keys before resuming.");
    this.epoch++;
    this.emit();
  }
  deviceLost(port?: string) {
    this.pause("Piano disconnected. Reconnect, select an input, then resume.");
    this.input.lost(port);
    this.partial.clear();
    this.epoch++;
    this.emit();
  }
  get group() {
    return this.groups[this.groupIndex];
  }
  get boundary() {
    return this.config.mode === "wait"
      ? (this.group?.time ?? Infinity)
      : Infinity;
  }
  currentPosition() {
    if (this.status !== "playing") return this.position;
    return Math.min(
      this.anchorPosition +
        ((this.now() - this.anchorTime) / 1000) * this.config.speed,
      this.boundary,
      this.config.mode === "free" ? Infinity : this.passage[1],
    );
  }
  tick() {
    const now = this.now();
    if (this.status === "waiting") {
      for (const [p, v] of this.partial)
        if (now - v.time > this.config.chordMs) {
          this.partial.clear();
          this.retries++;
          this.feedback =
            "Try the chord again. Keep each key held as you add the others.";
          break;
        }
      return;
    }
    if (this.status !== "playing") return;
    this.position = this.currentPosition();
    if (
      this.config.mode === "wait" &&
      this.group &&
      this.position >= this.group.time
    ) {
      this.position = this.group.time;
      this.status = "waiting";
      this.waitingAt = now;
      this.partial.clear();
      this.feedback = "Your turn — play the highlighted notes.";
      this.epoch++;
      this.emit();
      return;
    }
    if (rhythmMode(this.config.mode))
      for (const n of this.targets)
        if (
          !this.hits.has(n.id) &&
          !this.misses.has(n.id) &&
          ((this.position - n.time) / this.config.speed) * 1000 >
            this.config.lateMs
        ) {
          this.misses.add(n.id);
        }
    if (this.config.mode !== "free" && this.position >= this.passage[1]) {
      this.finish();
    }
  }
  receive(e: InputEvent) {
    if (e.source === "playback") return;
    const wasHeld = this.input.held.has(keyId(e));
    this.input.apply(e);
    this.tick();
    if (
      ["playing", "waiting", "paused"].includes(this.status) &&
      this.config.mode !== "listen"
    )
      this.events.push({
        event: { ...e },
        elapsedMs: e.time - this.startedAt,
        position: this.position,
      });
    if (e.type === "off") {
      for (const [p, v] of this.partial)
        if (v.key === keyId(e)) this.partial.delete(p);
      this.emit();
      return;
    }
    if (
      e.type !== "on" ||
      wasHeld ||
      !["playing", "waiting"].includes(this.status)
    ) {
      this.emit();
      return;
    }
    if (this.config.mode === "wait") {
      if (
        this.status !== "waiting" ||
        !this.group?.notes.some((n) => n.pitch === e.pitch)
      ) {
        this.extras++;
        this.lastWrong = e.pitch;
        this.feedback = "That’s a different note. Try the highlighted key.";
        this.emit();
        return;
      }
      if (
        this.partial.size &&
        e.time - Math.min(...[...this.partial.values()].map((v) => v.time)) >
          this.config.chordMs
      ) {
        this.partial.clear();
        this.retries++;
      }
      this.partial.set(e.pitch, { time: e.time, key: keyId(e) });
      this.lastWrong = null;
      if (this.group.notes.every((n) => this.partial.has(n.pitch))) {
        for (const n of this.group.notes) this.hits.add(n.id);
        this.findingMs += this.now() - this.waitingAt;
        this.groupIndex++;
        this.partial.clear();
        this.status = "playing";
        this.anchorPosition = this.position;
        this.anchorTime = this.now();
        this.epoch++;
        this.checkpoint("group-complete");
        this.feedback = "Nicely done. On to the next note.";
      } else
        this.feedback = `${this.partial.size} of ${new Set(this.group.notes.map((n) => n.pitch)).size} keys held — add the remaining notes.`;
    } else if (rhythmMode(this.config.mode)) {
      const eventPosition =
        this.anchorPosition +
        ((e.time - this.config.inputOffsetMs - this.anchorTime) / 1000) *
          this.config.speed;
      const eligible = this.targets
        .filter(
          (n) =>
            !this.hits.has(n.id) &&
            !this.misses.has(n.id) &&
            n.pitch === e.pitch,
        )
        .map((n) => ({
          n,
          delta: ((eventPosition - n.time) / this.config.speed) * 1000,
        }))
        .filter(
          (v) =>
            v.delta >= -this.config.earlyMs - 1e-7 &&
            v.delta <= this.config.lateMs + 1e-7,
        )
        .sort(
          (a, b) =>
            Math.abs(a.delta) - Math.abs(b.delta) || a.n.time - b.n.time,
        );
      if (eligible.length) {
        this.hits.add(eligible[0].n.id);
        this.timings.push(eligible[0].delta);
        this.lastWrong = null;
        this.feedback = `Good note · ${Math.round(eligible[0].delta)} ms`;
      } else {
        this.extras++;
        this.lastWrong = e.pitch;
        this.feedback = "Extra note — find the next beat.";
      }
    }
    this.emit();
  }
  result(completed = false): Result {
    const isScored =
      rhythmMode(this.config.mode) || this.config.mode === "wait";
    const targets = isScored ? this.targets.length : 0,
      hits = isScored ? this.hits.size : 0;
    return {
      id: crypto.randomUUID(),
      songId: this.song.id,
      title: this.song.title,
      date: new Date().toISOString(),
      config: { ...this.config },
      passage: [...this.passage],
      hits,
      misses: this.misses.size,
      extras: this.extras,
      targets,
      recall: targets ? hits / targets : null,
      precision: hits + this.extras ? hits / (hits + this.extras) : null,
      timingMs:
        rhythmMode(this.config.mode) && this.timings.length
          ? this.timings.reduce((a, b) => a + b, 0) / this.timings.length
          : null,
      retries: this.retries,
      findingMs:
        this.findingMs +
        (this.status === "waiting" ? this.now() - this.waitingAt : 0),
      completed,
      events: [...this.events],
      checkpoints: [...this.checkpoints],
    };
  }
  private save(completed: boolean) {
    if (
      this.config.mode === "listen" ||
      (!this.events.length && !this.hits.size && !this.misses.size)
    )
      return;
    const r = this.result(completed);
    this.lastResult = r;
    this.onResult?.(r);
  }
  private finish() {
    if (rhythmMode(this.config.mode))
      for (const n of this.targets)
        if (!this.hits.has(n.id)) this.misses.add(n.id);
    this.status = "finished";
    this.checkpoint("finish");
    this.save(true);
    this.epoch++;
    this.feedback =
      "Practice complete. Take a moment to notice what felt easier.";
    if (this.loop) {
      const r = this.result(true);
      if (
        this.adaptive &&
        rhythmMode(this.config.mode) &&
        r.targets > 0 &&
        (r.recall ?? 0) >= this.adaptiveThreshold &&
        (r.precision ?? 0) >= this.adaptiveThreshold
      ) {
        this.successes++;
        if (this.successes >= this.adaptivePasses) {
          this.config.speed = Math.min(1.5, this.config.speed + 0.05);
          this.successes = 0;
        }
      } else this.successes = 0;
      this.passage = [...this.loop];
      this.status = "ready";
      this.start();
    }
    this.emit();
  }
}
