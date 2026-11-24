import { describe, expect, it } from "vitest";
import { boxScoreRoute, gameRoute, playerRoute, playsRoute, routeLeague, teamRoute } from "./routes";

describe("routeLeague", () => {
  it("is the link's league when the app has it", () => {
    expect(routeLeague("nba", ["nhl", "nba"])).toBe("nba");
  });

  it("is the NHL for a link without one, an unknown one, or a repeated parameter", () => {
    expect(routeLeague(undefined, ["nhl", "nba"])).toBe("nhl");
    expect(routeLeague("mlb", ["nhl", "nba"])).toBe("nhl");
    expect(routeLeague(["nba", "nba"], ["nhl", "nba"])).toBe("nhl");
  });
});

describe("routes", () => {
  it("carry the league with the id", () => {
    const game = { id: "401910032", league: "nba" };
    expect(gameRoute(game)).toEqual({ pathname: "/game/[id]", params: { id: "401910032", league: "nba" } });
    expect(boxScoreRoute(game).pathname).toBe("/game/[id]/box-score");
    expect(playsRoute({ id: "2026020333", league: "nhl" })).toEqual({
      pathname: "/game/[id]/plays",
      params: { id: "2026020333", league: "nhl" },
    });
    expect(playerRoute({ id: "3936299", league: "nba" })).toEqual({
      pathname: "/player/[id]",
      params: { id: "3936299", league: "nba" },
    });
    expect(teamRoute({ id: "DEN", league: "nba" })).toEqual({
      pathname: "/team/[id]",
      params: { id: "DEN", league: "nba" },
    });
  });
});
