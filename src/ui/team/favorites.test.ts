import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../../domain";
import { involvesFavorite, isFavorite, toggleFavorite } from "./favorites";
import { sortGamesForScores } from "../common/format";

function game(id: string, status: GameStatus, startTime: string, away: string, home: string): Game {
  const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });
  return {
    id,
    league: "nhl",
    startTime,
    status,
    away: { team: team(away), score: null },
    home: { team: team(home), score: null },
  };
}

describe("toggleFavorite", () => {
  it("adds a team that is not a favourite and removes one that is", () => {
    expect(toggleFavorite([], "TOR")).toEqual(["TOR"]);
    expect(toggleFavorite(["TOR"], "MTL")).toEqual(["TOR", "MTL"]);
    expect(toggleFavorite(["TOR", "MTL"], "TOR")).toEqual(["MTL"]);
  });

  it("returns a new list and does not mutate the input", () => {
    const favorites = ["TOR"];
    expect(toggleFavorite(favorites, "MTL")).not.toBe(favorites);
    expect(favorites).toEqual(["TOR"]);
  });
});

describe("isFavorite / involvesFavorite", () => {
  it("matches on either side of the game", () => {
    const g = game("1", "scheduled", "2026-11-20T00:00:00Z", "MTL", "TOR");
    expect(isFavorite(["TOR"], "TOR")).toBe(true);
    expect(isFavorite(["TOR"], "MTL")).toBe(false);
    expect(involvesFavorite(g, ["TOR"])).toBe(true);
    expect(involvesFavorite(g, ["MTL"])).toBe(true);
    expect(involvesFavorite(g, ["BOS"])).toBe(false);
    expect(involvesFavorite(g, [])).toBe(false);
  });
});

describe("sortGamesForScores with favourites", () => {
  const games = [
    game("live", "live", "2026-11-19T23:00:00Z", "BOS", "NYR"),
    game("soon", "scheduled", "2026-11-20T00:00:00Z", "EDM", "CGY"),
    game("fav-final", "final", "2026-11-19T20:00:00Z", "MTL", "TOR"),
    game("fav-soon", "scheduled", "2026-11-20T02:00:00Z", "VAN", "TOR"),
  ];

  it("puts favourite teams' games first, then keeps the usual order within each group", () => {
    // Favourites: scheduled before final (status order). Others: live before scheduled.
    expect(sortGamesForScores(games, ["TOR"]).map((g) => g.id)).toEqual(["fav-soon", "fav-final", "live", "soon"]);
  });

  it("is the same as before when there are no favourites", () => {
    expect(sortGamesForScores(games).map((g) => g.id)).toEqual(["live", "soon", "fav-soon", "fav-final"]);
    expect(sortGamesForScores(games, [])).toEqual(sortGamesForScores(games));
  });
});
