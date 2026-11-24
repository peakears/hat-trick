import { describe, expect, it } from "vitest";
import type { Game } from "../../domain";
import { dayCount, leagueChipLabel, leagueChipSpoken, showLeagueRow } from "./league-row";

const game = (status: Game["status"]) => ({ status }) as Game;

describe("league row", () => {
  it("is drawn only when there is more than one league to pick", () => {
    expect(showLeagueRow(["nhl"])).toBe(false);
    expect(showLeagueRow(["nhl", "nba"])).toBe(true);
  });

  it("counts a day's games and the live ones, and nothing before the day loads", () => {
    expect(dayCount(undefined)).toBeUndefined();
    expect(dayCount([])).toEqual({ games: 0, live: 0 });
    expect(dayCount([game("live"), game("final"), game("live"), game("scheduled")])).toEqual({ games: 4, live: 2 });
  });

  it("labels a chip with the league's abbreviation", () => {
    expect(leagueChipLabel("nba")).toBe("NBA");
  });

  it("says the full name, then the day's games and live ones when known", () => {
    expect(leagueChipSpoken("National Basketball Association")).toBe("National Basketball Association");
    expect(leagueChipSpoken("National Hockey League", { games: 1, live: 0 })).toBe("National Hockey League, 1 game");
    expect(leagueChipSpoken("National Basketball Association", { games: 7, live: 2 })).toBe(
      "National Basketball Association, 7 games, 2 live",
    );
  });
});
