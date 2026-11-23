import type { Game, LeagueId } from "../../domain";

/**
 * Favourite teams are a list of team ids stored in the settings. Pure helpers, no React Native
 * imports, so they are unit tested.
 */

/**
 * The favourites that apply to `league`. Favourites are bare team ids, picked from NHL teams, and other leagues
 * reuse abbreviations (BOS is the Bruins and the Celtics), so for now they only apply to the NHL. When favourites
 * carry their league, this is the one place to change.
 */
export function favoritesFor(league: LeagueId, favorites: readonly string[]): readonly string[] {
  return league === "nhl" ? favorites : [];
}

export function isFavorite(favorites: readonly string[], teamId: string): boolean {
  return favorites.includes(teamId);
}

/** Adds the team if it is not a favourite yet, removes it if it is. Returns a new list. */
export function toggleFavorite(favorites: readonly string[], teamId: string): string[] {
  return isFavorite(favorites, teamId) ? favorites.filter((id) => id !== teamId) : [...favorites, teamId];
}

/** True when either team in the game is a favourite. */
export function involvesFavorite(game: Game, favorites: readonly string[]): boolean {
  return isFavorite(favorites, game.home.team.id) || isFavorite(favorites, game.away.team.id);
}
