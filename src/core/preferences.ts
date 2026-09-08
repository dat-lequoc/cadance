export interface PracticePreferences {
  version: 1;
  savedAt?: number;
  soundSource: "piano" | "computer";
  accompaniment: boolean;
  metronome: boolean;
  countIn: boolean;
  preparationSeconds: number;
  visualOffset: number;
  audioOffset: number;
  sheetMusic: boolean;
  sheetOnly: boolean;
  sheetWrongNotes: boolean;
  sheetZoom: number;
  sheetSpace: number;
  dashboardDark: boolean;
  practiceSpeed: number | null;
}
export function readPracticePreferences(
  value: unknown,
  legacyPreparation: unknown = 3,
): PracticePreferences {
  const defaults: PracticePreferences = {
    version: 1,
    soundSource: "piano",
    accompaniment: true,
    metronome: false,
    countIn: false,
    preparationSeconds: [0, 2, 3, 5].includes(Number(legacyPreparation))
      ? Number(legacyPreparation)
      : 3,
    visualOffset: 0,
    audioOffset: 0,
    sheetMusic: false,
    sheetOnly: false,
    sheetWrongNotes: true,
    sheetZoom: 1,
    sheetSpace: 35,
    dashboardDark: true,
    practiceSpeed: null,
  };
  if (
    !value ||
    typeof value !== "object" ||
    (value as PracticePreferences).version !== 1
  )
    return defaults;
  const v = value as PracticePreferences;
  if (Number.isFinite(v.savedAt)) defaults.savedAt = v.savedAt;
  for (const k of [
    "accompaniment",
    "metronome",
    "countIn",
    "sheetMusic",
    "sheetOnly",
    "sheetWrongNotes",
    "dashboardDark",
  ] as const)
    if (typeof v[k] === "boolean") defaults[k] = v[k];
  if (v.soundSource === "computer" || v.soundSource === "piano")
    defaults.soundSource = v.soundSource;
  if ([0, 2, 3, 5].includes(v.preparationSeconds))
    defaults.preparationSeconds = v.preparationSeconds;
  if (Number.isFinite(v.visualOffset))
    defaults.visualOffset = Math.max(-300, Math.min(300, v.visualOffset));
  if (Number.isFinite(v.audioOffset))
    defaults.audioOffset = Math.max(0, Math.min(100, v.audioOffset));
  if (Number.isFinite(v.sheetZoom))
    defaults.sheetZoom = Math.max(0.75, Math.min(2, v.sheetZoom));
  if (Number.isFinite(v.sheetSpace))
    defaults.sheetSpace = Math.max(20, Math.min(50, v.sheetSpace));
  if (typeof v.practiceSpeed === "number" && Number.isFinite(v.practiceSpeed))
    defaults.practiceSpeed = Math.max(.25, Math.min(1.5, v.practiceSpeed));
  return defaults;
}
