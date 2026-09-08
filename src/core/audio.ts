import { type InputEvent, keyId, pedalId, scored } from "./model";
import { PracticeEngine } from "./engine";
interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  end: number;
  kind: "live" | "scheduled";
}
export class PianoAudio {
  context: AudioContext | null = null;
  private voices = new Set<Voice>();
  private live = new Map<string, Voice[]>();
  private released = new Map<string, Voice[]>();
  private pedals = new Map<string, number>();
  async unlock() {
    this.context ??= new AudioContext({ latencyHint: "interactive" });
    await this.context.resume();
  }
  get time() {
    return this.context?.currentTime ?? 0;
  }
  tone(
    pitch: number,
    velocity = 0.7,
    at = this.time,
    duration?: number,
    kind: Voice["kind"] = "scheduled",
  ): Voice | null {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return null;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    const t = Math.max(at, ctx.currentTime);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(
      Math.max(0.005, velocity * 0.12),
      t + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(0.015, t + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    const voice = { osc, gain, end: Infinity, kind };
    this.voices.add(voice);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    if (duration !== undefined)
      this.release(voice, t + Math.max(0.03, duration));
    return voice;
  }
  release(v: Voice, at = this.time) {
    if (at >= v.end) return;
    v.end = at;
    try {
      v.gain.gain.cancelAndHoldAtTime(at);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      v.osc.stop(at + 0.09);
    } catch {
      /* Already ended. */
    }
  }
  receive(e: InputEvent) {
    const k = keyId(e),
      p = pedalId(e);
    if (e.type === "on") {
      if (this.live.has(k)) return;
      const v = this.tone(e.pitch, e.velocity, this.time, undefined, "live");
      if (v) this.live.set(k, [...(this.live.get(k) ?? []), v]);
    } else if (e.type === "off") {
      const queue = this.live.get(k) ?? [],
        v = queue.shift();
      if (!queue.length) this.live.delete(k);
      if (v) {
        if ((this.pedals.get(p) ?? 0) >= 64)
          this.released.set(p, [...(this.released.get(p) ?? []), v]);
        else this.release(v);
      }
    } else {
      this.pedals.set(p, e.value);
      if (e.value < 64) {
        for (const v of this.released.get(p) ?? []) this.release(v);
        this.released.delete(p);
      }
    }
  }
  stopScheduled() {
    for (const v of this.voices)
      if (v.kind === "scheduled") {
        try {
          v.osc.stop();
        } catch {
          /* Already stopped. */
        }
        this.voices.delete(v);
      }
  }
  stopAll() {
    for (const v of this.voices) {
      try {
        v.osc.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.voices.clear();
    this.live.clear();
    this.released.clear();
    this.pedals.clear();
  }
  click(at: number, accent = false) {
    this.tone(accent ? 96 : 89, 0.35, at, 0.035);
  }
}
// 25 ms scheduler with 100 ms lookahead. AudioContext schedules sound; rAF only draws.
export class AudioScheduler {
  private epoch = -1;
  private scheduled = new Set<string>();
  private cursor = 0;
  private beatScheduled = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  lookaheadSeconds = 0.1;
  accompaniment = true;
  metronome = false;
  audioOffsetMs = 0;
  constructor(
    public engine: PracticeEngine,
    public audio: PianoAudio,
  ) {}
  start() {
    this.timer ??= setInterval(() => this.pump(), 25);
  }
  pump() {
    const e = this.engine;
    e.tick();
    if (this.epoch !== e.epoch) {
      this.audio.stopScheduled();
      this.scheduled.clear();
      this.beatScheduled.clear();
      this.epoch = e.epoch;
      this.cursor = 0;
      while (
        this.cursor < e.notes.length &&
        e.notes[this.cursor].time + e.notes[this.cursor].duration < e.position
      )
        this.cursor++;
    }
    if (e.status !== "playing" || e.resuming || !this.audio.context) return;
    const position = e.currentPosition(),
      horizon = Math.min(
        position + this.lookaheadSeconds * e.config.speed,
        e.boundary,
        e.passage[1],
      ),
      at = this.audio.time;
    for (let i = this.cursor; i < e.notes.length; i++) {
      const n = e.notes[i];
      if (n.time > horizon) break;
      const playable =
        (e.config.mode === "listen" &&
          (scored(n, e.config) || this.accompaniment)) ||
        (this.accompaniment && !scored(n, e.config));
      if (
        !playable ||
        n.muted ||
        e.config.mode === "free" ||
        n.time < e.passage[0] ||
        n.time >= e.boundary ||
        n.time >= e.passage[1] ||
        n.time + n.duration <= position ||
        this.scheduled.has(n.id)
      )
        continue;
      this.scheduled.add(n.id);
      this.audio.tone(
        n.pitch,
        n.velocity,
        at +
          Math.max(
            0,
            (n.time - position) / e.config.speed + this.audioOffsetMs / 1000,
          ),
        Math.max(
          0.03,
          (Math.min(n.time + n.duration, e.boundary, e.passage[1]) -
            Math.max(position, n.time)) /
            e.config.speed,
        ),
      );
    }
    while (
      this.cursor < e.notes.length &&
      e.notes[this.cursor].time + e.notes[this.cursor].duration < position
    )
      this.cursor++;
    if (this.metronome || position < e.passage[0]) {
      // Beat grid is derived from the active meter and tempo map, including denominator.
      const map = e.song.tempos;
      const meters = e.song.meters.length
        ? e.song.meters
        : [{ tick: 0, numerator: 4, denominator: 4 }];
      const tm = this.tempoMap;
      const tick = tm.ticks(position),
        meter = meters.findLast((m) => m.tick <= tick) ?? meters[0];
      const step = (e.song.ppq * 4) / meter.denominator;
      const index = Math.floor((tick - meter.tick) / step);
      for (let b = index; b <= index + 2; b++) {
        const bt = meter.tick + b * step,
          t = tm.seconds(bt);
        if (
          t < position - 0.015 ||
          t > horizon ||
          t >= e.boundary ||
          this.beatScheduled.has(bt)
        )
          continue;
        this.beatScheduled.add(bt);
        this.audio.click(
          at + Math.max(0, (t - position) / e.config.speed),
          b % meter.numerator === 0,
        );
      }
      void map;
    }
  }
  private get tempoMap() {
    return new TempoMap(this.engine.song.ppq, this.engine.song.tempos);
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.audio.stopAll();
  }
}
import { TempoMap } from "./model";
