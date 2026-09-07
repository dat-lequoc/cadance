import { useEffect, useRef } from "react";
import type { Song } from "../core/model";
export default function Staff({ song }: { song: Song }) {
  const div = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    import("vexflow")
      .then(({ Renderer, Stave, StaveNote, Formatter, Accidental }) => {
        if (!alive || !div.current) return;
        div.current.innerHTML = "";
        const renderer = new Renderer(div.current, Renderer.Backends.SVG);
        renderer.resize(540, 135);
        const ctx = renderer.getContext();
        ctx.setFillStyle("#132238");
        ctx.setStrokeStyle("#132238");
        const first = song.notes.slice(0, 4);
        const clef = first.every((n) => n.pitch < 60) ? "bass" : "treble";
        const stave = new Stave(10, 10, 510);
        stave
          .addClef(clef)
          .addTimeSignature(
            `${song.meters[0]?.numerator ?? 4}/${song.meters[0]?.denominator ?? 4}`,
          )
          .setContext(ctx)
          .draw();
        const names = [
          "c",
          "c",
          "d",
          "d",
          "e",
          "f",
          "f",
          "g",
          "g",
          "a",
          "a",
          "b",
        ];
        const ns = first.map((n) => {
          const sn = new StaveNote({
            clef,
            keys: [`${names[n.pitch % 12]}/${Math.floor(n.pitch / 12) - 1}`],
            duration: "q",
          });
          if ([1, 3, 6, 8, 10].includes(n.pitch % 12))
            sn.addModifier(new Accidental("#"));
          return sn;
        });
        if (ns.length) Formatter.FormatAndDraw(ctx, stave, ns);
      })
      .catch(() => {
        if (div.current)
          div.current.textContent =
            "Notation could not load. Falling-note practice is still available.";
      });
    return () => {
      alive = false;
    };
  }, [song]);
  return (
    <div>
      <div ref={div} className="staff" />
      <small>
        Pitch-reading preview · first four notes shown as quarters. MIDI does
        not identify your fingers.
      </small>
    </div>
  );
}
