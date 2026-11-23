import type { Game } from "../../domain";

/**
 * Favourite teams are a list of team ids stored in the settings. Pure helpers, no React Native
 * imports, so they are unit tested.
 */

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
