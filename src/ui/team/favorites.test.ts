import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../../domain";
import {
  favoritesFor,
  favoritesLabel,
  involvesFavorite,
  isFavorite,
  leaguesWithFavorites,
  normalizeFavorites,
  toggleFavorite,
} from "./favorites";
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
    expect(toggleFavorite([], "nhl", "TOR")).toEqual(["nhl:TOR"]);
    expect(toggleFavorite(["nhl:TOR"], "nhl", "MTL")).toEqual(["nhl:TOR", "nhl:MTL"]);
    expect(toggleFavorite(["nhl:TOR", "nhl:MTL"], "nhl", "TOR")).toEqual(["nhl:MTL"]);
  });

  it("keeps a team apart from another league's team with the same abbreviation", () => {
    const both = toggleFavorite(["nhl:BOS"], "nba", "BOS");
    expect(both).toEqual(["nhl:BOS", "nba:BOS"]);
    expect(toggleFavorite(both, "nhl", "BOS")).toEqual(["nba:BOS"]);
  });

  it("returns a new list and does not mutate the input", () => {
    const favorites = ["nhl:TOR"];
    expect(toggleFavorite(favorites, "nhl", "MTL")).not.toBe(favorites);
    expect(favorites).toEqual(["nhl:TOR"]);
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

describe("favoritesFor", () => {
  it("gives each league its own teams, so BOS is the Bruins in one and the Celtics in the other", () => {
    const favorites = ["nhl:BOS", "nhl:TOR", "nba:BOS"];
    expect(favoritesFor("nhl", favorites)).toEqual(["BOS", "TOR"]);
    expect(favoritesFor("nba", favorites)).toEqual(["BOS"]);
    expect(favoritesFor("nfl", favorites)).toEqual([]);
  });

  it("reads bare ids from an older version as the NHL's", () => {
    expect(favoritesFor("nhl", ["TOR"])).toEqual(["TOR"]);
    expect(normalizeFavorites(["TOR", "nhl:TOR", "", "nba:", "nba:DEN"])).toEqual(["nhl:TOR", "nba:DEN"]);
  });
});

describe("favourites across leagues", () => {
  it("lists the leagues with a favourite and labels them for Settings", () => {
    expect(leaguesWithFavorites(["nhl:TOR", "nba:DEN", "nhl:MTL"])).toEqual(["nhl", "nba"]);
    expect(favoritesLabel(["nhl:TOR", "nhl:MTL"])).toBe("TOR, MTL");
    expect(favoritesLabel(["nhl:TOR", "nba:DEN", "nhl:MTL"])).toBe("NHL: TOR, MTL · NBA: DEN");
  });
});
