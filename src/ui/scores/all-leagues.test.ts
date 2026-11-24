import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../../domain";
import { allLeaguesSections, daySummary } from "./all-leagues";

function game(league: string, id: string, status: GameStatus, away: string, home: string, hour = 0): Game {
  const team = (abbrev: string) => ({ id: abbrev, league, name: abbrev, abbrev });
  return {
    id,
    league,
    status,
    startTime: `2026-11-24T${String(hour).padStart(2, "0")}:00:00Z`,
    away: { team: team(away), score: null },
    home: { team: team(home), score: null },
  };
}

const nhl = [game("nhl", "1", "final", "MTL", "TOR", 0), game("nhl", "2", "live", "BOS", "NYR", 1)];
const nba = [game("nba", "3", "live", "BOS", "NY", 1), game("nba", "4", "scheduled", "DEN", "SA", 2)];

describe("All view", () => {
  it("lists each league under its own heading, live games first, with a summary", () => {
    const sections = allLeaguesSections(
      [
        { league: "nhl", games: nhl, failed: false },
        { league: "nba", games: nba, failed: false },
      ],
      [],
    );
    expect(sections.map((s) => [s.key, s.summary, s.data.map((g) => g.id)])).toEqual([
      ["league:nhl", "1 live · 1 final", ["2", "1"]],
      ["league:nba", "1 live · 1 upcoming", ["3", "4"]],
    ]);
  });

  it("puts favourites' games from every league first, matching each team in its own league", () => {
    // nba:BOS is the Celtics: the Bruins' game stays under the NHL.
    const sections = allLeaguesSections(
      [
        { league: "nhl", games: nhl, failed: false },
        { league: "nba", games: nba, failed: false },
      ],
      ["nhl:TOR", "nba:BOS"],
    );
    expect(sections[0]).toMatchObject({ key: "favorites", title: "Your teams" });
    expect(sections[0].data.map((g) => g.id)).toEqual(["3", "1"]);
    expect(sections[1].data.map((g) => g.id)).toEqual(["2"]);
    expect(sections[2].data.map((g) => g.id)).toEqual(["4"]);
    // The summary counts what is listed under it: the Leafs' final is up in "Your teams".
    expect(sections[1].summary).toBe("1 live");
  });

  it("leaves out a league whose every game is up in Your teams, so no heading stands alone", () => {
    // The NHL's only game is the Oilers' (a favourite): it shows under Your teams, and no "NHL 1 upcoming" heading
    // with nothing under it.
    const oilers = [game("nhl", "1", "scheduled", "VGK", "EDM", 0)];
    const sections = allLeaguesSections(
      [
        { league: "nhl", games: oilers, failed: false },
        { league: "nba", games: nba, failed: false },
      ],
      ["nhl:EDM"],
    );
    expect(sections.map((s) => s.key)).toEqual(["favorites", "league:nba"]);
    expect(sections[0].data.map((g) => g.id)).toEqual(["1"]);
    expect(sections[1].summary).toBe("1 live · 1 upcoming");
  });

  it("keeps a league that failed or has no games, with a note, and shows the others", () => {
    const sections = allLeaguesSections(
      [
        { league: "nhl", games: [], failed: false },
        { league: "nba", failed: true },
      ],
      [],
    );
    expect(sections.map((s) => [s.title, s.note, s.data.length])).toEqual([
      ["NHL", "No games on this date.", 0],
      ["NBA", "Couldn't load NBA scores. Pull down to try again.", 0],
    ]);
    // Still loading: no note yet.
    expect(allLeaguesSections([{ league: "nba", failed: false }], [])[0].note).toBeUndefined();
  });

  it("summarizes a day by status, leaving out the empty ones", () => {
    expect(daySummary([])).toBe("");
    expect(daySummary(nba)).toBe("1 live · 1 upcoming");
  });
});
