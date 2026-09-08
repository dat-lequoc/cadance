import minuteWaltz from "../../public/scores/minute-waltz/score.json";
import pathetique from "../../public/scores/pathetique-ii/score.json";
import type { Song } from "./model";
import { songFingerprint } from "./quests";
import { validateScore, type PreparedScore } from "./score";

// Register reviewed editions here; identity is musical content, not a filename.
const preparedScores = [pathetique as PreparedScore, minuteWaltz as PreparedScore];
export async function preparedScoreFor(song: Song) {
  const fingerprint = await songFingerprint(song);
  const score = preparedScores.find((s) => s.fingerprint === fingerprint);
  return score ? validateScore(score, song) : null;
}
