import type { Game, LeagueId, SpecialEvents } from "../../domain";
import { useSportsData } from "../data/sports-data-context";
import { usePolled, type Polled } from "../data/use-polled";

export interface LeagueDayPolled {
  league: LeagueId;
  scores: Polled<Game[]>;
  events: Polled<SpecialEvents>;
}

/**
 * Every league's scores for `date` and special events for its week, each its own `usePolled` (one league failing
 * never hides another's games), under the keys the single-league view uses (`{league}:scores:{date}`,
 * `{league}:events:{monday}`), so switching between "All" and one league costs no request. A league without special
 * events answers empty with no request.
 *
 * The hooks run in a loop over the app's leagues: that list is fixed when the app starts (the adapter registry), so
 * every render calls them in the same order, as React requires.
 */
export function useLeagueDays(leagues: readonly LeagueId[], date: string, weekStart: string): LeagueDayPolled[] {
  const sports = useSportsData();
  return leagues.map((league) => ({
    league,
    scores: usePolled(`${league}:scores:${date}`, (o) => sports.getScores(league, date, o)),
    events: usePolled(`${league}:events:${weekStart}`, (o) => sports.getSpecialEvents(league, weekStart, o)),
  }));
}
