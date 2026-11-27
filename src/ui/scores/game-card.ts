// What a Scores card shows beyond the two teams (pure).
import type { Game, GameSituation, GameStandout } from "../../domain";

/**
 * A live game's card grows a strip of each period's score, the standout player and where play stands (football's
 * down and distance). Not before or after the game (the list stays compact), and never while the spoiler shield hides
 * the game: the first two give the score away, and the shield hides the game as a whole.
 */
export function showLiveDetail(game: Game, hidden: boolean): boolean {
  return (
    game.status === "live" &&
    !hidden &&
    (Boolean(game.periods?.length) || game.standout !== undefined || game.situation !== undefined)
  );
}

/**
 * The situation line on a live card: "CHI ball · 2nd & 8 at DET 22", with the red zone as a tag of its own, and what
 * a screen reader says for it ("Chicago Bears ball, 2nd and 8 at DET 22, in the red zone").
 */
export function situationText(
  situation: GameSituation,
  game: Pick<Game, "home" | "away">,
): { possession?: string; text: string; redZone: boolean; spoken: string } {
  const team = [game.away.team, game.home.team].find((t) => t.id === situation.possessionTeamId);
  const redZone = situation.redZone === true;
  const spoken = [
    team ? `${team.name} ball` : undefined,
    situation.text.replace(/ & /g, " and "),
    redZone ? "in the red zone" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  return { possession: team?.abbrev, text: situation.text, redZone, spoken };
}

/** The standout line on a card, "J. Brunson NY · 31 PTS", and what a screen reader says for it. */
export function standoutText(standout: GameStandout): { shown: string; spoken: string } {
  return {
    shown: `${standout.name} ${standout.teamId} · ${standout.line}`,
    spoken: `Top performer: ${standout.name}, ${standout.teamId}, ${standout.line}`,
  };
}
