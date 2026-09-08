import { stageColors } from "./theme";
import { useEffect, useRef } from "react";
import { PracticeEngine } from "../core/engine";
import { NoteIndex } from "../core/render-index";
import { black, noteName, scored } from "../core/model";
export const keyboardHeight = (height: number) =>
  Math.max(88, Math.min(132, height * 0.18));
export function keyGeometry(min: number, max: number, width: number) {
  const whites = Array.from(
    { length: max - min + 1 },
    (_, i) => i + min,
  ).filter((p) => !black(p));
  const unit = width / whites.length;
  const map = new Map<number, { x: number; width: number }>();
  let index = 0;
  for (let p = min; p <= max; p++) {
    if (black(p))
      map.set(p, { x: index * unit - unit * 0.31, width: unit * 0.62 });
    else {
      map.set(p, { x: index * unit, width: unit });
      index++;
    }
  }
  return map;
}
export default function Roll({
  engine,
  min,
  max,
  press,
  release,
  visualOffset,
  labels = "notes",
  showBackground = true,
  zoom = 90,
  accompaniment = true,
  scroll,
  section,
  viewPosition,
}: {
  engine: PracticeEngine;
  min: number;
  max: number;
  press: (p: number) => void;
  release: (p: number) => void;
  visualOffset: number;
  viewPosition?: number | null;
  labels?: "notes" | "fingers" | "none";
  showBackground?: boolean;
  zoom?: number;
  accompaniment?: boolean;
  scroll?: (deltaPixels: number) => void;
  section?: {
    start: number;
    end: number;
    label: string;
    draft: boolean;
    startMarked?: boolean;
    endMarked?: boolean;
  } | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef(new Map<number, number>());
  const scrollRef = useRef(scroll);
  scrollRef.current = scroll;
  useEffect(() => {
    const el = canvas.current!;
    const wheel = (event: WheelEvent) => {
      if (!scrollRef.current || event.ctrlKey || event.metaKey) return;
      const rect = el.getBoundingClientRect();
      if (event.clientY - rect.top >= rect.height - keyboardHeight(rect.height))
        return;
      event.preventDefault();
      const factor =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      scrollRef.current(event.deltaY * factor);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    let frame = 0;
    let index = new NoteIndex(engine.notes);
    const draw = () => {
      const rect = el.getBoundingClientRect(),
        w = rect.width,
        h = rect.height,
        dpr = devicePixelRatio || 1;
      if (
        el.width !== Math.round(w * dpr) ||
        el.height !== Math.round(h * dpr)
      ) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const keyboard = keyboardHeight(h),
        line = h - keyboard,
        geo = keyGeometry(min, max, w);
      const time =
        (viewPosition ?? engine.currentPosition()) +
        (visualOffset / 1000) * engine.config.speed;
      const scale = zoom;
      ctx.fillStyle = stageColors.stage;
      ctx.fillRect(0, 0, w, h);
      for (const [p, g] of geo) {
        if (!black(p)) {
          ctx.strokeStyle = p % 12 === 0 ? "#4e6782" : "#273e57";
          ctx.beginPath();
          ctx.moveTo(g.x, 0);
          ctx.lineTo(g.x, line);
          ctx.stroke();
        }
        if (p % 12 === 0) {
          ctx.fillStyle = "#cedcec";
          ctx.font = "12px monospace";
          ctx.fillText(noteName(p), g.x + 5, 20);
        }
      }
      for (let sec = Math.floor(time); sec < time + line / scale; sec++) {
        const y = line - (sec - time) * scale;
        ctx.strokeStyle = "#304b66";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      if (index.notes !== engine.notes) index = new NoteIndex(engine.notes);
      for (const n of index.visible(time - 0.3, time + line / scale + 1)) {
        if (
          n.hidden ||
          (engine.preparationRemaining > 0 && n.time < engine.passage[0]) ||
          (!showBackground && !scored(n, engine.config))
        )
          continue;
        const g = geo.get(n.pitch);
        if (!g) continue;
        const bottom = line - (n.time - time) * scale,
          top = bottom - n.duration * scale;
        if (top > line + 8 || bottom < 0) continue;
        const hit = engine.hits.has(n.id),
          miss = engine.misses.has(n.id);
        ctx.fillStyle = miss
          ? "#ff7979"
          : n.hand === "left"
            ? stageColors.left
            : n.hand === "accompaniment"
              ? stageColors.background
              : stageColors.right;
        ctx.globalAlpha =
          !scored(n, engine.config) && engine.config.mode !== "listen"
            ? 0.6
            : 1;
        ctx.beginPath();
        ctx.roundRect(
          g.x + 2,
          Math.max(-8, top),
          Math.max(2, g.width - 3),
          Math.min(line + 8, bottom) - Math.max(-8, top),
          4,
        );
        ctx.fill();
        if (hit) {
          ctx.fillStyle = stageColors.success;
          ctx.fillRect(g.x + 3, Math.max(0, top), Math.max(1, g.width - 5), 3);
        }
        ctx.globalAlpha = 1;
        if (
          labels !== "none" &&
          g.width > 18 &&
          bottom - top > 24 &&
          bottom > 25
        ) {
          ctx.fillStyle = stageColors.stage;
          ctx.font = "700 11px system-ui";
          ctx.fillText(
            labels === "fingers"
              ? n.finger
                ? String(n.finger)
                : ""
              : noteName(n.pitch),
            g.x + 5,
            Math.min(line - 8, bottom - 9),
          );
        }
      }
      if (section) {
        const startY = line - (section.start - time) * scale;
        const endY = line - (section.end - time) * scale;
        ctx.fillStyle = "#06132388";
        ctx.fillRect(0, 0, w, Math.max(0, Math.min(line, endY)));
        const below = Math.max(0, Math.min(line, startY));
        ctx.fillRect(0, below, w, line - below);
        // Time runs vertically: a bright bracket follows the entire passage.
        const top = Math.max(8, Math.min(line - 8, endY));
        const bottom = Math.max(8, Math.min(line - 8, startY));
        const color = section.draft ? "#ffd18a" : "#ccff80";
        ctx.lineCap = "round";
        ctx.strokeStyle = "#061323";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(12, top);
        ctx.lineTo(12, bottom);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.setLineDash(section.draft ? [10, 7] : []);
        ctx.beginPath();
        ctx.moveTo(12, top);
        ctx.lineTo(12, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        const endLabelY = Math.max(4, Math.min(line - 52, top - 26));
        const startLabelY = Math.max(
          endLabelY + 26,
          Math.min(line - 26, bottom + 4),
        );
        const mark = (y: number, label: string, above: boolean) => {
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(12, y);
          ctx.lineTo(32, y);
          ctx.stroke();
          const labelY = above ? endLabelY : startLabelY;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(26, labelY, 112, 22, 4);
          ctx.fill();
          ctx.fillStyle = "#102238";
          ctx.font = "800 12px system-ui";
          ctx.fillText(label, 34, labelY + 15);
        };
        if (startY < 8 || endY > line - 8) {
          mark(top, startY < 8 ? "↑ SECTION" : "↓ SECTION", startY >= 8);
        } else {
          if (section.endMarked !== false)
            mark(
              top,
              endY < 8
                ? "↑ END · B"
                : endY > line - 8
                  ? "↓ END · B"
                  : "END · B",
              true,
            );
          if (section.startMarked !== false)
            mark(
              bottom,
              startY > line - 8
                ? "↓ START · A"
                : startY < 8
                  ? "↑ START · A"
                  : "START · A",
              false,
            );
        }
        ctx.lineWidth = 1;
        ctx.lineCap = "butt";
      }
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, line - 2, w, 2);
      ctx.shadowBlur = 0;
      const held = new Set([...engine.input.held.values()].map((e) => e.pitch)),
        sounding = new Set(
          [...engine.input.sounding.values()].map((e) => e.pitch),
        );
      const handColor = (hand: string) =>
        hand === "left"
          ? stageColors.left
          : hand === "accompaniment"
            ? stageColors.background
            : stageColors.right;
      const playback = new Map<number, string>();
      const inputColors = new Map<number, string>();
      for (const n of index.visible(time, time)) {
        if (n.time + n.duration <= time) continue;
        inputColors.set(n.pitch, handColor(n.hand));
        const playable =
          engine.config.mode === "listen"
            ? scored(n, engine.config) || accompaniment
            : accompaniment && !scored(n, engine.config);
        if (
          engine.status === "playing" &&
          !engine.resuming &&
          engine.config.mode !== "free" &&
          playable &&
          !n.muted &&
          !n.hidden &&
          n.time >= engine.passage[0] &&
          n.time < engine.boundary &&
          time < engine.passage[1]
        )
          playback.set(n.pitch, handColor(n.hand));
      }
      const promptGroup =
        engine.config.mode === "wait"
          ? engine.group
          : engine.groups.find(
              (group) =>
                group.time >= engine.position - 0.001 &&
                group.notes.some(
                  (n) => !engine.hits.has(n.id) && !engine.misses.has(n.id),
                ),
            );
      const promptNotes =
        engine.status === "waiting" || engine.preparationRemaining > 0
          ? (promptGroup?.notes ?? [])
          : [];
      for (const n of promptNotes) inputColors.set(n.pitch, handColor(n.hand));
      const expected = new Set(promptNotes.map((n) => n.pitch));
      // Accompaniment pauses with wait mode, but its simultaneous notes should
      // remain visible as context rather than disappearing from the keyboard.
      const companion = new Map<number, string>();
      if (
        promptNotes.length &&
        promptGroup &&
        accompaniment &&
        showBackground
      ) {
        for (const n of index.visible(promptGroup.time, promptGroup.time)) {
          if (
            Math.abs(n.time - promptGroup.time) < 0.00001 &&
            !scored(n, engine.config) &&
            !n.hidden &&
            !n.muted &&
            n.time >= engine.passage[0] &&
            n.time < engine.boundary &&
            !expected.has(n.pitch)
          )
            companion.set(n.pitch, handColor(n.hand));
        }
      }
      for (const isBlack of [false, true])
        for (const [p, g] of geo) {
          if (black(p) !== isBlack) continue;
          const height = isBlack ? keyboard * 0.64 : keyboard - 4;
          ctx.fillStyle = held.has(p)
            ? engine.lastWrong === p
              ? stageColors.wrong
              : (inputColors.get(p) ??
                (engine.config.hand === "left"
                  ? stageColors.left
                  : stageColors.right))
            : sounding.has(p)
              ? stageColors.sustain
              : (playback.get(p) ?? (isBlack ? "#0c1522" : "#ffffff"));
          ctx.beginPath();
          ctx.roundRect(g.x + 1, line + 2, g.width - 2, height, [0, 0, 3, 3]);
          ctx.fill();
          if (expected.has(p) || companion.has(p)) {
            ctx.fillStyle = inputColors.get(p) ?? companion.get(p)!;
            ctx.globalAlpha = expected.has(p) ? 0.35 : 0.16;
            ctx.fillRect(
              g.x + 2,
              line + 3,
              Math.max(1, g.width - 4),
              height - 2,
            );
            ctx.globalAlpha = 1;
          }
          if (expected.has(p)) {
            ctx.fillStyle = engine.partial.has(p) ? "#06753b" : "#cf4d00";
            ctx.beginPath();
            ctx.arc(g.x + g.width / 2, line + height - 28, 5, 0, Math.PI * 2);
            ctx.fill();
          } else if (companion.has(p)) {
            ctx.strokeStyle = isBlack ? companion.get(p)! : "#51677c";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(g.x + g.width / 2, line + height - 28, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          if (
            labels !== "none" &&
            (p % 12 === 0 ||
              held.has(p) ||
              expected.has(p) ||
              companion.has(p) ||
              g.width > 25) &&
            g.width > 14
          ) {
            ctx.fillStyle =
              isBlack && !held.has(p) && !sounding.has(p) && !playback.has(p)
                ? "#ffffff"
                : "#17283b";
            ctx.font = "600 11px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(noteName(p), g.x + g.width / 2, line + height - 8);
            ctx.textAlign = "left";
          }
        }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [
    engine,
    min,
    max,
    visualOffset,
    viewPosition,
    labels,
    showBackground,
    zoom,
    accompaniment,
    section?.start,
    section?.end,
    section?.draft,
    section?.startMarked,
    section?.endMarked,
  ]);
  const up = (id: number) => {
    const p = active.current.get(id);
    if (p !== undefined) {
      release(p);
      active.current.delete(id);
    }
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;
  useEffect(() => {
    const heldPointers = active.current;
    const clear = () => {
      for (const pitch of heldPointers.values()) releaseRef.current(pitch);
      heldPointers.clear();
    };
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className="roll"
      aria-label="Falling notes and interactive piano keyboard"
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const keyboard = keyboardHeight(rect.height);
        if (y < rect.height - keyboard) return;
        const geo = keyGeometry(min, max, rect.width);
        const x = e.clientX - rect.left;
        const found = [...geo]
          .sort(([a], [b]) => Number(black(b)) - Number(black(a)))
          .find(
            ([p, g]) =>
              x >= g.x &&
              x < g.x + g.width &&
              (!black(p) || y < rect.height - keyboard + 2 + keyboard * 0.64),
          );
        if (found) {
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current.set(e.pointerId, found[0]);
          press(found[0]);
        }
      }}
      onPointerUp={(e) => up(e.pointerId)}
      onPointerCancel={(e) => up(e.pointerId)}
      onLostPointerCapture={(e) => up(e.pointerId)}
    />
  );
}
