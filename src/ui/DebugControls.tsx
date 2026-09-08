import type { PracticeController } from "./usePracticeController";
export default function DebugControls({ c }: { c: PracticeController }) {
  return <div className="option-fields">
    <label className="checkbox"><input type="checkbox" checked={c.debugLog.enabled} onChange={(e) => c.setDebugRecording(e.target.checked)} />Record MIDI for debugging</label>
    <p>Stored on this device: the latest 2,000 note and pedal events, original MIDI bytes, timing, expected notes and scoring before/after each input. This is MIDI data, not microphone audio.</p>
    <small>{c.debugLog.entries.length} events recorded{c.debugLog.dropped ? ` · ${c.debugLog.dropped} older events discarded` : ""}</small>
    <div className="data-actions">
      <button className="secondary" disabled={!c.debugLog.entries.length} onClick={c.downloadDebugLog}>Download MIDI debug log</button>
      <button disabled={!c.debugLog.entries.length} onClick={c.clearDebugLog}>Clear debug log</button>
    </div>
  </div>;
}
