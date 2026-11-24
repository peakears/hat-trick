// The league row at the top of Scores, Standings and Leaders (pure): one chip per league the app has, the picked one
// selected. On Scores each chip also counts that day's games and how many are live, so you can see where the action
// is before switching.
import type { Game, LeagueId } from "../../domain";

/** A day's games in one league, as a chip shows them. */
export interface DayCount {
  games: number;
  live: number;
}

/** Whether the row is drawn at all: with a single league there is nothing to pick. */
export function showLeagueRow(leagues: readonly LeagueId[]): boolean {
  return leagues.length > 1;
}

/** How many games a day has and how many are live. Undefined until the day has loaded. */
export function dayCount(games: readonly Game[] | undefined): DayCount | undefined {
  if (!games) return undefined;
  return { games: games.length, live: games.filter((g) => g.status === "live").length };
}

/** The chip's text: the league's abbreviation, as the app shows it everywhere. */
export function leagueChipLabel(league: LeagueId): string {
  return league.toUpperCase();
}

/**
 * What a screen reader says for a chip: the league's full name, then the day's games when known
 * ("National Basketball Association, 7 games, 2 live"). Whether it is picked is said by its selected state.
 */
export function leagueChipSpoken(name: string, count?: DayCount): string {
  if (!count) return name;
  const games = count.games === 1 ? "1 game" : `${count.games} games`;
  return count.live > 0 ? `${name}, ${games}, ${count.live} live` : `${name}, ${games}`;
}
