import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TempoMap } from "../core/model";
import { playedScorePosition, scorePitch, scoreAnchorAt, scoreBarAt, type PreparedScore } from "../core/score";
import type { PracticeController } from "./usePracticeController";

export default function ScoreStrip({
  c,
  score,
}: {
  c: PracticeController;
  score: PreparedScore;
}) {
  const map = useMemo(() => new TempoMap(c.song.ppq, c.song.tempos), [c.song]);
  const position =
    c.browsePosition ??
    (c.engine.preparationRemaining > 0
      ? Math.max(c.engine.passage[0], c.engine.currentPosition())
      : c.engine.currentPosition());
  const bar = scoreBarAt(score, map, position);
  const anchor = scoreAnchorAt(bar, map, position);
  const only = c.sheetOnly;
  const required = new Set(c.engine.group?.notes.filter((n) => n.tick === anchor?.tick).map((n) => n.pitch - c.config.transpose) ?? []);
  const [browsing, setBrowsing] = useState<number | null>(null);
  const systemIndex = browsing ?? bar.system;
  const system = score.systems[systemIndex];
  const flats = (c.song.keys.findLast((key) => key.tick <= map.ticks(position))?.key ?? "").includes("b");
  const mismatches = c.sheetWrongNotes && c.active && c.engine.preparationRemaining <= 0 && c.browsePosition === null && browsing === null
    ? [...new Map([...c.engine.wrongHeld].filter(([key]) => c.engine.input.held.has(key)).map(([, value]) => [value.event.pitch, value])).values()] : [];
  const viewport = useRef<HTMLDivElement>(null);
  const manualScroll = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const scrollPoint = useRef<{ x: number; y: number } | null>(null);
  const selectPrintedPoint = (x: number, y: number) => {
    const images = [...viewport.current!.querySelectorAll<HTMLElement>(".score-image")];
    const image = images.reduce<HTMLElement | null>((best, item) => {
      const distance = (node: HTMLElement) => {
        const r = node.getBoundingClientRect();
        return Math.max(r.top - y, 0, y - r.bottom);
      };
      return !best || distance(item) < distance(best) ? item : best;
    }, null);
    if (!image) return;
    const index = Number(image.dataset.system);
    const rect = image.getBoundingClientRect();
    const normalized = (x - rect.left) / rect.width;
    const bars = score.bars.filter((b) => b.system === index);
    const selectedBar = bars.find((b) => normalized >= b.left && normalized <= b.right) ??
      (normalized < bars[0].left ? bars[0] : bars.at(-1)!);
    const selectedAnchor = selectedBar.anchors?.reduce((best, item) => Math.abs(item.x - normalized) < Math.abs(best.x - normalized) ? item : best);
    setBrowsing(null);
    c.previewAt(map.seconds(selectedAnchor?.tick ?? selectedBar.tick));
  };
  const selectAfterScroll = () => {
    if (!only || !manualScroll.current || !scrollPoint.current) return;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const point = scrollPoint.current;
      if (point && manualScroll.current) selectPrintedPoint(point.x, point.y);
    });
  };
  useEffect(() => () => { if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); }, []);
  useEffect(() => {
    if (only && c.active && c.browsePosition === null) setBrowsing(null);
  }, [only, c.active, c.browsePosition]);
  const [size, setSize] = useState({ width: 800, height: 200 });
  const [failedImage, setFailedImage] = useState("");
  useLayoutEffect(() => {
    const element = viewport.current!;
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fit = Math.min(
    (size.width - 24) / system.width,
    (size.height - 20) / system.height,
  );
  const width = only ? Math.max(100, size.width - 48) * c.sheetZoom : system.width * fit * c.sheetZoom;
  const height = only ? width * system.height / system.width : system.height * fit * c.sheetZoom;
  const stackedTop = score.systems.slice(0, systemIndex).reduce((sum, s) => sum + width * s.height / s.width + 24, 12);
  useLayoutEffect(() => {
    const element = viewport.current!;
    if (only && manualScroll.current) {
      if (c.browsePosition !== null || scrollFrame.current !== null) return;
      manualScroll.current = false;
    }
    if (only) {
      const targetX = width * (anchor?.x ?? (bar.left + bar.right) / 2) + 24;
      if (height > size.height && anchor && browsing === null) {
        const focusNotes = anchor.notes.filter((n) => required.has(n.pitch));
        const points = focusNotes.length ? focusNotes : anchor.notes;
        const top = stackedTop + Math.min(...points.map((n) => n.y)) * height - 24;
        const bottom = stackedTop + Math.max(...points.map((n) => n.y)) * height + 24;
        if (top < element.scrollTop + 8 || bottom > element.scrollTop + size.height - 8)
          element.scrollTop = Math.max(0, (top + bottom - size.height) / 2);
      } else if (stackedTop < element.scrollTop + 8 || stackedTop + height > element.scrollTop + size.height - 8 || browsing !== null) {
        element.scrollTop = Math.max(0, stackedTop - 12);
      }
      if (browsing === null && (targetX < element.scrollLeft + 30 || targetX > element.scrollLeft + size.width - 30))
        element.scrollLeft = Math.max(0, targetX - size.width / 2);
      return;
    }
    if (browsing !== null) return;
    element.scrollTo({
      left: Math.max(
        0,
        (width * (bar.left + bar.right)) / 2 + 12 - size.width / 2,
      ),
      top: Math.max(0, (height + 20 - size.height) / 2),
      behavior: "instant",
    });
  }, [
    bar.number,
    systemIndex,
    browsing,
    width,
    height,
    size.width,
    size.height,
    only,
    stackedTop,
    anchor?.tick,
    c.browsePosition,
  ]);
  const preview = c.browsePosition !== null;
  const failed = failedImage === system.image;
  return (
    <section
      className={"score-strip" + (only ? " score-only" : "")}
      style={only ? undefined : { height: `${c.sheetSpace}dvh` }}
      aria-label="Sheet music"
      inert={!!c.panel || undefined}
    >
      <div className="score-toolbar">
        <div className="score-position">
          <strong>
            {browsing !== null
              ? `Bars ${system.fromBar}–${system.throughBar}`
              : `${preview ? "Resume here · " : ""}Bar ${bar.number}`}
          </strong>
          <span>
            {c.config.transpose
              ? "Original key · score is not transposed"
              : browsing !== null
                ? "Browsing score"
                : bar.anchors ? "Following notes" : "Following bar"}
          </span>
          {!only && <div
            className="score-space"
            role="group"
            aria-label="Sheet music space"
          >
            <span>Space</span>
            <button
              aria-label="Decrease sheet music space"
              title="Less sheet music space"
              disabled={c.sheetSpace <= 20}
              onClick={() => c.setSheetSpace(c.sheetSpace - 5)}
            >
              −
            </button>
            <output aria-label="Sheet music space percent">
              {c.sheetSpace}%
            </output>
            <button
              aria-label="Increase sheet music space"
              title="More sheet music space"
              disabled={c.sheetSpace >= 50}
              onClick={() => c.setSheetSpace(c.sheetSpace + 5)}
            >
              +
            </button>
          </div>}
        </div>
        <div className="score-actions">
          <button aria-pressed={only} onClick={() => c.setSheetOnly(!only)} title={only ? "Show sheet music with falling notes" : "Practice using only the sheet music"}>Sheet only</button>
          <button aria-label="Show wrong notes" aria-pressed={c.sheetWrongNotes} onClick={() => c.setSheetWrongNotes(!c.sheetWrongNotes)} title="Show wrong pressed notes in red on the sheet">Wrong notes</button>
          <button
            aria-label="Previous score system"
            disabled={systemIndex === 0}
            onClick={() => {
              setBrowsing(systemIndex - 1);
              if (only) { manualScroll.current = false; c.previewAt(map.seconds(score.bars.find((b) => b.system === systemIndex - 1)!.tick)); }
            }}
          >
            ←
          </button>
          <button
            aria-label="Next score system"
            disabled={systemIndex === score.systems.length - 1}
            onClick={() => {
              setBrowsing(systemIndex + 1);
              if (only) { manualScroll.current = false; c.previewAt(map.seconds(score.bars.find((b) => b.system === systemIndex + 1)!.tick)); }
            }}
          >
            →
          </button>
          <button
            aria-pressed={browsing === null}
            onClick={() => {
              manualScroll.current = false;
              c.backToPlayhead();
              setBrowsing(browsing === null && !preview ? systemIndex : null);
            }}
          >
            Follow
          </button>
          <label className="score-zoom">
            Zoom
            <input
              aria-label="Sheet music zoom"
              type="range"
              min="75"
              max="200"
              step="5"
              value={Math.round(c.sheetZoom * 100)}
              onChange={(e) => c.setSheetZoom(Number(e.target.value) / 100)}
            />
          </label>
          <button
            title="Fit score to panel"
            aria-label="Fit sheet music"
            onClick={() => c.setSheetZoom(1)}
          >
            {Math.round(c.sheetZoom * 100)}%
          </button>
          <a
            href={score.sourcePdf}
            target="_blank"
            rel="noreferrer"
            title="Open complete score PDF"
          >
            PDF ↗
          </a>
          <button
            aria-label="Hide sheet music"
            onClick={() => c.setSheetMusic(false)}
          >
            ×
          </button>
        </div>
      </div>
      <div
        className="score-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="Score image; scroll to pan"
        onWheel={(e) => {
          e.stopPropagation();
          if (only && !e.ctrlKey && (e.deltaX || e.deltaY)) {
            manualScroll.current = true;
            scrollPoint.current = { x: e.clientX, y: e.clientY };
            c.pause();
            selectAfterScroll();
          }
        }}
        onScroll={selectAfterScroll}
      >
        {failed && <p role="status">This score image could not load. <button onClick={() => setFailedImage("")}>Retry</button> or <a href={score.sourcePdf} target="_blank" rel="noreferrer">open the PDF</a>.</p>}
        <div className={"score-pan" + (only ? " score-stack" : "")} style={{ minWidth: width + (only ? 48 : 24), minHeight: Math.max(size.height, height + 20) }}>
          {(only ? score.systems : [system]).map((item) => {
            const index = score.systems.indexOf(item);
            const imageHeight = only ? width * item.height / item.width : height;
            const current = bar.system === index;
            return <div key={item.image} className="score-image" data-system={index} style={{ width, height: imageHeight }}
              onClick={(event) => {
                if (!only) return;
                manualScroll.current = true;
                selectPrintedPoint(event.clientX, event.clientY);
              }}>
              <img src={item.image} width={item.width} height={item.height} loading={only && index > systemIndex + 1 ? "lazy" : "eager"}
                alt={`Score page ${item.page}, bars ${item.fromBar}–${item.throughBar}`}
                onError={() => setFailedImage(item.image)} draggable={false} />
              {current && <>
                <div className="score-current-bar" aria-label={`Highlighted bar ${bar.number}`} style={{ left: `${bar.left * 100}%`, width: `${(bar.right - bar.left) * 100}%` }} />
                {anchor && <svg className="score-note-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" role="img" aria-label={`Score cursor at bar ${bar.number}`}>
                  <line x1={anchor.x} x2={anchor.x} y1="0.08" y2="0.94" vectorEffect="non-scaling-stroke" />
                </svg>}
                {mismatches.length > 0 && <>
                  <div className="score-input-feedback" role="status" aria-label="Played note mismatch" style={{ left: `${Math.min(.75, anchor?.x ?? bar.left) * 100}%` }}>
                    Played {mismatches.map(({ event, reason }) => `${scorePitch(event.pitch, flats).label}${reason === "early" ? " (early)" : ""}`).join(" + ")}
                  </div>
                  {anchor && c.config.transpose === 0 && <svg className="score-wrong-overlay" viewBox={`0 0 ${item.width} ${item.height}`} aria-label="Wrong pressed notes on score" role="img">
                    {mismatches.map(({ event }, wrongIndex) => {
                      const point = playedScorePosition(item, anchor, event.pitch, [...required], flats);
                      if (!point || point.y < .02 || point.y > .98) return null;
                      const x = Math.max(28, anchor.x * item.width - 26 - wrongIndex * 32);
                      return <g key={event.pitch} data-pitch={event.pitch} aria-label={`Played ${point.label}; does not match`}>
                        {point.ledgers.map((y) => <line key={y} x1={x - 20} x2={x + 20} y1={y * item.height} y2={y * item.height} vectorEffect="non-scaling-stroke" />)}
                        <ellipse cx={x} cy={point.y * item.height} rx="12" ry="8" vectorEffect="non-scaling-stroke" />
                        <text x={x - 18} y={point.y * item.height} textAnchor="end" dominantBaseline="central" fontSize="24">{point.accidental}</text>
                      </g>;
                    })}
                  </svg>}
                </>}
              </>}
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}
