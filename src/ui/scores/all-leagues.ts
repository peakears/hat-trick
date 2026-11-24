// The Scores tab's "All" view (pure): every league's games for the day in one list. Your teams' games come first,
// from every league, then each league under its own heading. Each league is loaded on its own, so one that fails
// shows a note under its heading while the others still show their games.
import type { Game, LeagueId } from "../../domain";
import { sortGamesForScores } from "../common/format";
import { favoritesFor, involvesFavorite } from "../team/favorites";

/** One league's day as the Scores tab loaded it. */
export interface LeagueDay {
  league: LeagueId;
  /** Undefined until loaded, or when the request failed with nothing cached. */
  games?: Game[];
  failed: boolean;
}

export interface AllLeaguesSection {
  key: string;
  title: string;
  /** Set on a league's own section: its heading is drawn in the league's colour. */
  league?: LeagueId;
  /** "2 live · 3 final" beside a league's heading. */
  summary?: string;
  /** Shown under a league's heading when it has no games to list. */
  note?: string;
  data: Game[];
}

/** "2 live · 1 upcoming · 3 final"; statuses with no games are left out. Empty for no games. */
export function daySummary(games: readonly Game[]): string {
  const count = (status: Game["status"]) => games.filter((g) => g.status === status).length;
  const parts: [number, string][] = [
    [count("live"), "live"],
    [count("scheduled"), "upcoming"],
    [count("final"), "final"],
    [count("postponed"), "postponed"],
  ];
  return parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
}

/**
 * The "All" list: "Your teams" (favourites' games from every league, live first) when there are any, then one
 * section per league in the app's order with the rest of its games. A league is always listed, so a failed or empty
 * day says so under its heading. `favorites` are the stored `league:team` keys.
 */
export function allLeaguesSections(days: readonly LeagueDay[], favorites: readonly string[]): AllLeaguesSection[] {
  const isFavoriteGame = (g: Game) => involvesFavorite(g, favoritesFor(g.league, favorites));
  const all = days.flatMap((d) => d.games ?? []);
  const sections: AllLeaguesSection[] = [];
  const yours = sortGamesForScores(all.filter(isFavoriteGame));
  if (yours.length > 0) sections.push({ key: "favorites", title: "Your teams", data: yours });
  for (const day of days) {
    const games = day.games ?? [];
    const rest = sortGamesForScores(games.filter((g) => !isFavoriteGame(g)));
    const note = !day.games
      ? day.failed
        ? `Couldn't load ${day.league.toUpperCase()} scores. Pull down to try again.`
        : undefined
      : games.length === 0
        ? "No games on this date."
        : undefined;
    sections.push({
      key: `league:${day.league}`,
      title: day.league.toUpperCase(),
      league: day.league,
      summary: daySummary(games) || undefined,
      note,
      data: rest,
    });
  }
  return sections;
}
