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
  const sum = (side: "away" | "home") => periods.reduce((total, p) => total + (p[side] ?? 0), 0);
  return sum("away") === away.score && sum("home") === home.score ? periods : undefined;
}

/**
 * A live game's periods with the regulation periods not played yet added, scoreless (null), so the strip shows the
 * whole game from the start: in the 1st period of hockey, "1st", "2nd" and "3rd". `label` names period n.
 */
export function withUpcomingPeriods(
  periods: PeriodScore[],
  regulation: number,
  label: (period: number) => string,
): PeriodScore[] {
  const upcoming: PeriodScore[] = [];
  for (let n = periods.length + 1; n <= regulation; n++) upcoming.push({ label: label(n), away: null, home: null });
  return [...periods, ...upcoming];
}
