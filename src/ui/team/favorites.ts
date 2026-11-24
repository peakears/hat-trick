import type { Game, LeagueId } from "../../domain";

/**
 * Favourite teams are stored in the settings as `league:team` keys ("nhl:TOR", "nba:BOS"): team ids are unique within
 * a league only (BOS is the Bruins and the Celtics). Versions before favourites had a league stored bare NHL ids
 * ("TOR"); `normalizeFavorites` reads those as the NHL's. Pure helpers, no React Native imports, so they are tested.
 *
 * Everything that looks a game or team up asks `favoritesFor(league, …)` and gets that league's bare team ids.
 */

/** The league whose teams older versions stored bare. */
const BARE_LEAGUE: LeagueId = "nhl";

export function favoriteKey(league: LeagueId, teamId: string): string {
  return `${league}:${teamId}`;
}

function parseKey(key: string): { league: LeagueId; teamId: string } {
  const at = key.indexOf(":");
  return at < 0 ? { league: BARE_LEAGUE, teamId: key } : { league: key.slice(0, at), teamId: key.slice(at + 1) };
}

/** A stored list as keys: bare ids from an older version become the NHL's, and duplicates and blanks are dropped. */
export function normalizeFavorites(stored: readonly string[]): string[] {
  const keys = stored.map(parseKey).filter((k) => k.league && k.teamId);
  return [...new Set(keys.map((k) => favoriteKey(k.league, k.teamId)))];
}

/** The team ids of `league`'s favourites, in the order they were picked. */
export function favoritesFor(league: LeagueId, favorites: readonly string[]): string[] {
  return favorites.map(parseKey).flatMap((k) => (k.league === league ? [k.teamId] : []));
}

/** A favourite key's league ("nba:BOS" is the NBA's; a bare id from an older version is the NHL's). */
export function favoriteLeague(key: string): LeagueId {
  return parseKey(key).league;
}

/** The leagues that have a favourite, in the order their first one was picked. */
export function leaguesWithFavorites(favorites: readonly string[]): LeagueId[] {
  return [...new Set(favorites.map((key) => parseKey(key).league))];
}

/** "TOR, MTL" with one league, "NHL: TOR, MTL · NBA: BOS" with more. */
export function favoritesLabel(favorites: readonly string[]): string {
  const leagues = leaguesWithFavorites(favorites);
  if (leagues.length === 1) return favoritesFor(leagues[0], favorites).join(", ");
  return leagues.map((l) => `${l.toUpperCase()}: ${favoritesFor(l, favorites).join(", ")}`).join(" · ");
}

/** `favorites` here is one league's team ids, from favoritesFor. */
export function isFavorite(favorites: readonly string[], teamId: string): boolean {
  return favorites.includes(teamId);
}

/** Adds `league`'s team if it is not a favourite yet, removes it if it is. Returns a new list of keys. */
export function toggleFavorite(favorites: readonly string[], league: LeagueId, teamId: string): string[] {
  const key = favoriteKey(league, teamId);
  const keys = normalizeFavorites(favorites);
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

/** True when either team in the game is a favourite. `favorites` is the game's league's team ids. */
export function involvesFavorite(game: Game, favorites: readonly string[]): boolean {
  return isFavorite(favorites, game.home.team.id) || isFavorite(favorites, game.away.team.id);
}
