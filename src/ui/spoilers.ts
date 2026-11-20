import type { Game } from "../domain";
import { gameStatusLabel } from "./format";

/**
 * Spoiler shield rules (scores only: Scores cards and the game page; Standings and Leaders are not shielded). Pure module: no React Native imports, so it is unit tested.
 * The shield only changes what is shown. Data is still fetched and cached as usual, so turning it off
 * (or tapping Show) needs no reload. Reveals last until the app closes, or until the shield is switched on again.
 */

export interface Reveals {
  /** "Show all scores" was tapped: every game's score is visible. */
  all: boolean;
  /** Games whose score was shown one by one. */
  games: string[];
}

export const NO_REVEALS: Reveals = { all: false, games: [] };

export function revealGame(reveals: Reveals, gameId: string): Reveals {
  return reveals.games.includes(gameId) ? reveals : { ...reveals, games: [...reveals.games, gameId] };
}

export function revealAllGames(reveals: Reveals): Reveals {
  return reveals.all ? reveals : { ...reveals, all: true };
}

/** Only games that have started have a score to give away. */
function hasScore(game: Pick<Game, "status">): boolean {
  return game.status === "live" || game.status === "final";
}

export function isGameHidden(game: Pick<Game, "id" | "status">, enabled: boolean, reveals: Reveals): boolean {
  return enabled && hasScore(game) && !reveals.all && !reveals.games.includes(game.id);
}

/**
 * The status text for a game. A hidden finished game says only "Final": "Final/OT" and "Final/SO"
 * would give something away. A live clock says nothing about the score, so it stays.
 */
export function statusLabelFor(game: Game, hidden: boolean): string {
  return hidden && game.status === "final" ? "Final" : gameStatusLabel(game);
}
