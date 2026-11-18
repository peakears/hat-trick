// How long each kind of data stays fresh, based on game status.
// League-agnostic: it only reads domain types.

import type { Game } from "../domain";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const FRESHNESS = {
  /** A game is in progress: scores change every few seconds. */
  live: 20 * SECOND,
  /** A game starts within this window (or should have started): watch for puck drop. */
  startingSoonWindow: 15 * MINUTE,
  startingSoon: 1 * MINUTE,
  /** Scheduled later today or tomorrow. */
  scheduled: 5 * MINUTE,
  /** Scheduled more than a day away: only start times can change. */
  scheduledFar: 1 * HOUR,
  /** Finished within the last day: stat corrections still happen. */
  recentFinal: 1 * HOUR,
  /** Finished more than a day ago. */
  oldFinal: 7 * DAY,
  /** No games on the date: the schedule could still be published. */
  noGames: 1 * HOUR,
  standings: 10 * MINUTE,
  leaders: 30 * MINUTE,
} as const;

/** How long one game stays fresh. */
export function gameFreshness(game: Game, now: number): number {
  const start = Date.parse(game.startTime);
  switch (game.status) {
    case "live":
      return FRESHNESS.live;
    case "scheduled": {
      const untilStart = start - now;
      if (untilStart <= FRESHNESS.startingSoonWindow) return FRESHNESS.startingSoon;
      if (untilStart > DAY) return FRESHNESS.scheduledFar;
      return FRESHNESS.scheduled;
    }
    case "final":
      // Games last about three hours, so "started over a day ago" means finished a while back.
      return now - start > DAY ? FRESHNESS.oldFinal : FRESHNESS.recentFinal;
    case "postponed":
      return FRESHNESS.recentFinal;
  }
}

/** A day of scores is as fresh as its most urgent game. */
export function scoresFreshness(games: Game[], now: number): number {
  if (games.length === 0) return FRESHNESS.noGames;
  return Math.min(...games.map((g) => gameFreshness(g, now)));
}
