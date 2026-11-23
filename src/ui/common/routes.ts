// Links to the game and team pages (pure). Each carries its league, so a page knows which league's data to load;
// a link without one (puck drop reminders and live score notifications, which are NHL only, and links saved by an
// older version) opens the NHL's page.
import type { LeagueId } from "../../domain";

/** The league a game or team page shows: the link's `league`, if the app has that league, else the NHL. */
export function routeLeague(param: string | string[] | undefined, available: readonly LeagueId[]): LeagueId {
  return typeof param === "string" && available.includes(param) ? param : "nhl";
}

export function gameRoute(game: { id: string; league: LeagueId }) {
  return { pathname: "/game/[id]", params: { id: game.id, league: game.league } } as const;
}

export function boxScoreRoute(game: { id: string; league: LeagueId }) {
  return { pathname: "/game/[id]/box-score", params: { id: game.id, league: game.league } } as const;
}

export function teamRoute(team: { id: string; league: LeagueId }) {
  return { pathname: "/team/[id]", params: { id: team.id, league: team.league } } as const;
}
