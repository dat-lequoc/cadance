import type { Note } from "./model";
/** Prefix maximum end times retain overlaps while skipping all completed history. */
export class NoteIndex {
  ends: number[] = [];
  constructor(public notes: Note[]) {
    let end = 0;
    for (const n of notes) {
      end = Math.max(end, n.time + n.duration);
      this.ends.push(end);
    }
  }
  visible(start: number, end: number) {
    let lo = 0,
      hi = this.notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ends[mid] < start) lo = mid + 1;
      else hi = mid;
    }
    const result: Note[] = [];
    for (let i = lo; i < this.notes.length && this.notes[i].time <= end; i++)
      if (this.notes[i].time + this.notes[i].duration >= start)
        result.push(this.notes[i]);
    return result;
  }
}
