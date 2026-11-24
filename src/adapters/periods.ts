// Helpers both adapters use for a game's periods (pure).
import type { GameSide, PeriodScore } from "../domain";

/**
 * The periods only when they add up to the score: a dropped or late item in the league's list would otherwise show
 * a strip that disagrees with the score above it. Undefined for none.
 */
export function periodsMatchingScore(
  periods: PeriodScore[],
  away: GameSide,
  home: GameSide,
): PeriodScore[] | undefined {
  if (periods.length === 0 || away.score === null || home.score === null) return undefined;
  const sum = (side: "away" | "home") => periods.reduce((total, p) => total + p[side], 0);
  return sum("away") === away.score && sum("home") === home.score ? periods : undefined;
}
