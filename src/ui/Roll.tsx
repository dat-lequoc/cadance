import { useEffect, useRef } from "react";
import { PracticeEngine } from "../core/engine";
import { NoteIndex } from "../core/render-index";
import { black, noteName, scored } from "../core/model";
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
}: {
  engine: PracticeEngine;
  min: number;
  max: number;
  press: (p: number) => void;
  release: (p: number) => void;
  visualOffset: number;
  labels?: "notes" | "fingers" | "none";
  showBackground?: boolean;
  zoom?: number;
  accompaniment?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef(new Map<number, number>());
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
      const keyboard = 98,
        line = h - keyboard,
        geo = keyGeometry(min, max, w);
      const time =
        engine.currentPosition() + (visualOffset / 1000) * engine.config.speed;
      const scale = zoom;
      ctx.fillStyle = "#102238";
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
        if (n.hidden || (!showBackground && !scored(n, engine.config)))
          continue;
        const g = geo.get(n.pitch);
        if (!g) continue;
        const bottom = line - (n.time - time) * scale,
          top = bottom - n.duration * scale;
        if (top > line + 8 || bottom < 0) continue;
        const hit = engine.hits.has(n.id),
          miss = engine.misses.has(n.id);
        ctx.fillStyle = hit
          ? "#42e89b"
          : miss
            ? "#ff7979"
            : n.hand === "left"
              ? "#59b3ff"
              : n.hand === "accompaniment"
                ? "#a8b8c9"
                : "#ffc15a";
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
        ctx.globalAlpha = 1;
        if (
          labels !== "none" &&
          g.width > 18 &&
          bottom - top > 24 &&
          bottom > 25
        ) {
          ctx.fillStyle = "#102238";
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
          ? "#59b3ff"
          : hand === "accompaniment"
            ? "#a8b8c9"
            : "#ffc15a";
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
          engine.config.mode !== "free" &&
          playable &&
          !n.muted &&
          !n.hidden &&
          n.time < engine.boundary &&
          time < engine.passage[1]
        )
          playback.set(n.pitch, handColor(n.hand));
      }
      if (engine.status === "waiting")
        for (const n of engine.group?.notes ?? [])
          inputColors.set(n.pitch, handColor(n.hand));
      const expected = new Set(
        engine.status === "waiting"
          ? engine.group?.notes.map((n) => n.pitch)
          : [],
      );
      for (const isBlack of [false, true])
        for (const [p, g] of geo) {
          if (black(p) !== isBlack) continue;
          const height = isBlack ? 62 : keyboard - 4;
          ctx.fillStyle = held.has(p)
            ? engine.lastWrong === p
              ? "#ff7171"
              : (inputColors.get(p) ??
                (engine.config.hand === "left" ? "#59b3ff" : "#ffc15a"))
            : sounding.has(p)
              ? "#b199ff"
              : (playback.get(p) ?? (isBlack ? "#0c1522" : "#ffffff"));
          ctx.beginPath();
          ctx.roundRect(g.x + 1, line + 2, g.width - 2, height, [0, 0, 3, 3]);
          ctx.fill();
          if (expected.has(p)) {
            ctx.fillStyle = engine.partial.has(p) ? "#06753b" : "#cf4d00";
            ctx.beginPath();
            ctx.arc(g.x + g.width / 2, line + height - 28, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          if (
            labels !== "none" &&
            (p % 12 === 0 || held.has(p) || expected.has(p) || g.width > 25) &&
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
    labels,
    showBackground,
    zoom,
    accompaniment,
  ]);
  const up = (id: number) => {
    const p = active.current.get(id);
    if (p !== undefined) {
      release(p);
      active.current.delete(id);
    }
  };
  return (
    <canvas
      ref={canvas}
      className="roll"
      aria-label="Falling notes and interactive piano keyboard"
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height - 98) return;
        const geo = keyGeometry(min, max, rect.width);
        const x = e.clientX - rect.left;
        const found = [...geo]
          .sort(([a], [b]) => Number(black(b)) - Number(black(a)))
          .find(
            ([p, g]) =>
              x >= g.x &&
              x < g.x + g.width &&
              (!black(p) || y < rect.height - 34),
          );
        if (found) {
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current.set(e.pointerId, found[0]);
          press(found[0]);
        }
      }}
      onPointerUp={(e) => up(e.pointerId)}
      onPointerCancel={(e) => up(e.pointerId)}
    />
  );
}
