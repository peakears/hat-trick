// What a Scores card shows beyond the two teams (pure).
import type { Game, GameStandout } from "../../domain";

/**
 * A live game's card grows a strip of each period's score and the standout player. Not before or after the game
 * (the list stays compact), and never while the spoiler shield hides the game: both give the score away.
 */
export function showLiveDetail(game: Game, hidden: boolean): boolean {
  return game.status === "live" && !hidden && (Boolean(game.periods?.length) || game.standout !== undefined);
}

/** The standout line on a card, "J. Brunson NY · 31 PTS", and what a screen reader says for it. */
export function standoutText(standout: GameStandout): { shown: string; spoken: string } {
  return {
    shown: `${standout.name} ${standout.teamId} · ${standout.line}`,
    spoken: `Top performer: ${standout.name}, ${standout.teamId}, ${standout.line}`,
  };
}
