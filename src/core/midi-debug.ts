import type { PracticeEngine } from "./engine";
import type { InputEvent } from "./model";
export function debugSnapshot(engine: PracticeEngine) {
  const position = engine.currentPosition();
  return {
    status: engine.status, position, preparation: engine.preparationRemaining,
    expected: engine.group?.notes.map((n) => ({ pitch: n.pitch, time: n.time, hand: n.hand, role: n.role })) ?? [],
    earlyByMs: engine.group ? (engine.group.time - position) / engine.config.speed * 1000 : null,
    held: [...engine.input.held.values()].map((e) => e.pitch),
    wrongHeld: [...engine.wrongHeld.values()].map(({ event, reason }) => ({ pitch: event.pitch, port: event.port, reason })),
    partial: [...engine.partial.keys()], hits: engine.hits.size,
    extras: engine.extras, retries: engine.retries, lastWrong: engine.lastWrong, feedback: engine.feedback,
  };
}
export interface DebugEntry {
  at: string; receivedAt: number; input: InputEvent;
  song: { id: string; title: string }; config: PracticeEngine["config"]; questId: string | null;
  before: ReturnType<typeof debugSnapshot>; after: ReturnType<typeof debugSnapshot>;
}
export class MidiDebugLog {
  enabled = true;
  entries: DebugEntry[] = [];
  dropped = 0;
  revision = 0;
  static limit = 2000;
  restore(value: unknown) {
    const data = value as { version?: number; enabled?: boolean; entries?: DebugEntry[]; dropped?: number } | null;
    if (data?.version !== 1) return;
    this.enabled = data.enabled !== false;
    this.entries = Array.isArray(data.entries) ? data.entries.filter((e) => e?.input && e.before && e.after).slice(-MidiDebugLog.limit) : [];
    this.dropped = Number.isSafeInteger(data.dropped) && data.dropped! >= 0 ? data.dropped! : 0;
  }
  capture(engine: PracticeEngine, event: InputEvent, questId: string | null, deliver: () => void) {
    if (!this.enabled) { deliver(); return; }
    const before = debugSnapshot(engine), receivedAt = performance.now();
    deliver();
    this.entries.push({ at: new Date().toISOString(), receivedAt, input: structuredClone(event),
      song: { id: engine.song.id, title: engine.song.title }, config: { ...engine.config }, questId,
      before, after: debugSnapshot(engine) });
    if (this.entries.length > MidiDebugLog.limit) { this.entries.shift(); this.dropped++; }
    this.revision++;
  }
  clear() { this.entries = []; this.dropped = 0; this.revision++; }
  data() { return { version: 1, enabled: this.enabled, dropped: this.dropped, entries: this.entries }; }
}
