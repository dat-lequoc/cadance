const paths: Record<string, string> = {
  piano: "M4 4h16v16H4z M9 4v16 M15 4v16 M8 4v8 M14 4v8",
  grid: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  chart: "M4 19V5 M4 19h16 M8 15l4-5 4 2 4-7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  play: "M8 5l11 7-11 7z",
  pause: "M8 5v14 M16 5v14",
  back: "M5 5v14 M19 5L8 12l11 7z",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  plug: "M8 3v5 M16 3v5 M6 8h12v4a6 6 0 0 1-12 0z M12 18v4",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  close: "M6 6l12 12 M18 6L6 18",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13 M15.5 15.5L21 21",
  check: "M5 12l4 4L19 6",
  loop: "M5 8h12l-3-3 M19 16H7l3 3 M19 8v4 M5 16v-4",
  volume: "M4 9h4l5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8",
  book: "M12 6C8 3 5 4 3 5v14c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-1-6-2-9 1z M12 6v13",
  stop: "M6 6h12v12H6z",
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.piano} />
    </svg>
  );
}
export const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const modeName = (mode: string) =>
  ({
    wait: "Wait for notes",
    rhythm: "Practice rhythm",
    recital: "Full song",
    listen: "Listen",
    free: "Free play",
  })[mode] ?? mode;
