import type { Song } from "./model";
import { songFingerprint } from "./quests";
import { preparedEditionFor } from "./catalogue";
import { validateScore, type PreparedScore } from "./score";

// Discover reviewed editions; identity is musical content, not a filename.
const preparedScores = Object.values(import.meta.glob<PreparedScore>(
  "../../public/scores/*/score.json", { eager: true, import: "default" },
));
export async function preparedScoreFor(song: Song) {
  const fingerprint = await songFingerprint(song);
  const matching = preparedScores.filter((s) => s.fingerprint === fingerprint);
  if (!matching.length) return null;
  const edition = preparedEditionFor(song);
  const score =
    matching.find((s) => song.scoreUrl && s.sourcePdf === song.scoreUrl) ??
    matching.find(
      (s) =>
        edition && s.systems[0]?.image.startsWith(`/scores/${edition.slug}/`),
    ) ??
    (matching.length === 1 ? matching[0] : null);
  return score ? validateScore(score, song) : null;
}
