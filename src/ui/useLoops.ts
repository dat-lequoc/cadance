import { useEffect, useMemo, useRef, useState } from "react";
import { PracticeEngine } from "../core/engine";
import {
  createLoop,
  measures,
  validLoops,
  type SavedLoop,
} from "../core/loops";
import { db } from "../core/storage";

export function useLoops(
  engine: PracticeEngine,
  onError: (error: unknown) => void,
  beforeApply?: () => void,
) {
  const song = engine.song;
  const bars = useMemo(() => measures(song), [song]);
  const [a, setA] = useState(0),
    [b, setB] = useState(song.duration);
  const [marked, setMarked] = useState({ a: false, b: false });
  const [saved, setSaved] = useState<SavedLoop[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    setA(0);
    setB(song.duration);
    setMarked({ a: false, b: false });
    setSaved([]);
    setName("");
    setEditing(null);
    setNotice("");
    setSaving(false);
    db.settings
      .get("loops:" + song.id)
      .then((row) => {
        if (generation.current === version)
          setSaved(validLoops(row?.value, song));
      })
      .catch(onError);
    return () => {
      generation.current++;
    };
  }, [song.id]);
  const position = () =>
    Math.max(0, Math.min(song.duration, engine.currentPosition()));
  const snapValue = (value: number, edge: "a" | "b") => {
    if (!snap) return value;
    if (edge === "a")
      return bars.findLast((bar) => bar.start <= value)?.start ?? 0;
    return (
      bars.find((bar) => value >= bar.start && value < bar.end)?.end ??
      song.duration
    );
  };
  const editA = (value: number) => {
    setA(value);
    setMarked((m) => ({ ...m, a: true }));
  };
  const editB = (value: number) => {
    setB(value);
    setMarked((m) => ({ ...m, b: true }));
  };
  const markA = () => {
    editA(snapValue(position(), "a"));
    setNotice("A marked. Mark B at the end of your passage.");
  };
  const markB = () => {
    editB(snapValue(position(), "b"));
    setNotice("B marked. Turn on Loop to repeat this passage.");
  };
  const valid =
    marked.a &&
    marked.b &&
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= 0 &&
    b <= song.duration &&
    b - a >= 0.1;
  const apply = (start = a, end = b, resume = false) => {
    try {
      beforeApply?.();
      engine.selectPassage(start, end, true);
      if (resume) engine.start();
      setNotice("Loop active");
    } catch (error) {
      onError(error);
    }
  };
  const toggle = () => {
    const resume = engine.status === "playing" || engine.status === "waiting";
    if (engine.loop) {
      beforeApply?.();
      engine.seek(position(), false);
      if (resume) engine.start();
      setNotice("Loop off");
    } else if (valid) apply(a, b, resume);
  };
  const open = (loop: SavedLoop) => {
    setA(loop.start);
    setB(loop.end);
    setMarked({ a: true, b: true });
    apply(loop.start, loop.end);
  };
  const save = async () => {
    if (!valid || saving) return;
    const version = generation.current;
    setSaving(true);
    try {
      const item = createLoop(
        song,
        name || `Passage ${saved.length + 1}`,
        a,
        b,
      );
      const next = editing
        ? saved.map((loop) =>
            loop.id === editing ? { ...item, id: editing } : loop,
          )
        : [...saved, item];
      await db.settings.put({ key: "loops:" + song.id, value: next });
      if (version !== generation.current) return;
      setSaved(next);
      setName("");
      setEditing(null);
      setNotice("Passage saved");
    } catch (error) {
      onError(error);
    } finally {
      if (version === generation.current) setSaving(false);
    }
  };
  const remove = async (id: string) => {
    const version = generation.current;
    try {
      const next = saved.filter((loop) => loop.id !== id);
      await db.settings.put({ key: "loops:" + song.id, value: next });
      if (version !== generation.current) return;
      setSaved(next);
      if (editing === id) {
        setEditing(null);
        setName("");
      }
    } catch (error) {
      onError(error);
    }
  };
  const rename = (loop: SavedLoop) => {
    setEditing(loop.id);
    setName(loop.name);
    setA(loop.start);
    setB(loop.end);
    setMarked({ a: true, b: true });
  };
  return {
    a,
    b,
    editA,
    editB,
    marked,
    saved,
    name,
    setName,
    editing,
    snap,
    setSnap,
    notice,
    saving,
    bars,
    valid,
    markA,
    markB,
    toggle,
    apply,
    open,
    save,
    remove,
    rename,
    snapValue,
  };
}
export type LoopState = ReturnType<typeof useLoops>;
