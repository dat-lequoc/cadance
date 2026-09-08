import { type InputEvent, keyId, pedalId } from "./model";
export function normalize(
  data: ArrayLike<number>,
  time: number,
  port: string,
  source: InputEvent["source"] = "hardware",
): InputEvent | null {
  if (data.length < 3) return null;
  const [status, pitch, value] = Array.from(data);
  if (
    status < 128 ||
    status > 239 ||
    pitch < 0 ||
    pitch > 127 ||
    value < 0 ||
    value > 127
  )
    return null;
  const command = status & 240,
    channel = (status & 15) + 1;
  const base = {
    raw: Array.from(data),
    pitch,
    velocity: value / 127,
    value,
    channel,
    port,
    time,
    source,
  };
  if (command === 144) return { ...base, type: value === 0 ? "off" : "on" };
  if (command === 128) return { ...base, type: "off" };
  if (command === 176 && pitch === 64) return { ...base, type: "sustain" };
  return null;
}
export class InputState {
  held = new Map<string, InputEvent>();
  sounding = new Map<string, InputEvent>();
  pedals = new Map<string, number>();
  apply(e: InputEvent) {
    const k = keyId(e);
    if (e.type === "on") {
      this.held.set(k, e);
      this.sounding.set(k, e);
    } else if (e.type === "off") {
      this.held.delete(k);
      if ((this.pedals.get(pedalId(e)) ?? 0) < 64) this.sounding.delete(k);
    } else {
      this.pedals.set(pedalId(e), e.value);
      if (e.value < 64)
        for (const [id, n] of this.sounding)
          if (pedalId(n) === pedalId(e) && !this.held.has(id))
            this.sounding.delete(id);
    }
  }
  lost(port?: string) {
    for (const map of [this.held, this.sounding])
      for (const [k, e] of map) if (!port || e.port === port) map.delete(k);
    for (const k of this.pedals.keys())
      if (!port || k.startsWith(port + ":")) this.pedals.delete(k);
  }
}
export interface MidiInputAdapter {
  subscribe(fn: (e: InputEvent) => void): () => void;
  dispose(): void;
}
export class SimulatedInput implements MidiInputAdapter {
  private listeners = new Set<(e: InputEvent) => void>();
  constructor(private now = () => performance.now()) {}
  subscribe(fn: (e: InputEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  send(data: number[]) {
    const e = normalize(data, this.now(), "simulated", "simulated");
    if (e) for (const fn of this.listeners) fn(e);
  }
  dispose() {
    this.listeners.clear();
  }
}
// A small injectable Web MIDI boundary. Channels in the public API are 1–16.
export interface Port {
  id: string;
  name: string | null;
  state: string;
  onmidimessage: ((e: { data: Uint8Array; timeStamp: number }) => void) | null;
}
export interface Access {
  inputs: Map<string, Port>;
  onstatechange: (() => void) | null;
}
export class HardwareInput implements MidiInputAdapter {
  access: Access | null = null;
  selected = "";
  private port: Port | null = null;
  private listeners = new Set<(e: InputEvent) => void>();
  constructor(
    private changed: () => void,
    private lost: (port: string) => void,
    private request: () => Promise<Access> = async () => {
      if (!globalThis.isSecureContext)
        throw Error("MIDI needs HTTPS or localhost.");
      if (!navigator.requestMIDIAccess)
        throw Error(
          "Web MIDI is unavailable. Try desktop Chrome or Edge, or use simulated input.",
        );
      return (await navigator.requestMIDIAccess({
        sysex: false,
      })) as unknown as Access;
    },
  ) {}
  async connect() {
    if (!this.access) {
      this.access = await this.request();
      this.access.onstatechange = () => {
        const p = this.access?.inputs.get(this.selected);
        if (this.port && (p?.state !== "connected" || p !== this.port)) {
          const old = this.selected;
          this.detach();
          this.lost(old);
        }
        if (!this.port && p?.state === "connected") this.select(this.selected);
        this.changed();
      };
    }
    this.changed();
  }
  ports() {
    return [...(this.access?.inputs.values() ?? [])].filter(
      (p) => p.state === "connected",
    );
  }
  select(id: string) {
    if (this.connected && this.selected === id) return;
    if (this.port) {
      const old = this.selected;
      this.detach();
      this.lost(old);
    }
    this.selected = id;
    const p = this.access?.inputs.get(id);
    if (!p || p.state !== "connected") {
      this.changed();
      return;
    }
    this.port = p;
    p.onmidimessage = (e) => {
      const n = normalize(e.data, e.timeStamp, p.id);
      if (n) for (const fn of this.listeners) fn(n);
    };
    this.changed();
  }
  get connected() {
    return !!this.port && this.port.state === "connected";
  }
  subscribe(fn: (e: InputEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private detach() {
    if (this.port) this.port.onmidimessage = null;
    this.port = null;
  }
  dispose() {
    this.detach();
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.listeners.clear();
  }
}
