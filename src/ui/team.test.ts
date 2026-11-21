import { describe, expect, it } from "vitest";
import type { Game, GameStatus, StandingRow, Standings } from "../domain";
import {
  findStandingRow,
  goalDifferentialLabel,
  ordinal,
  rankLine,
  splitLines,
  teamGameLine,
  teamGameSpoken,
  visibleGames,
} from "./team";

function row(id: string, extra: Partial<StandingRow> = {}): StandingRow {
  return {
    team: { id, league: "nhl", name: id, abbrev: id },
    rank: 1,
    gamesPlayed: 20,
    wins: 12,
    losses: 6,
    otLosses: 2,
    ...extra,
  };
}

describe("ordinal", () => {
  it("handles the usual endings and the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "32nd",
    ]);
  });
});

describe("findStandingRow", () => {
  const standings: Standings = {
    league: "nhl",
    updatedAt: "",
    groups: [
      { name: "Atlantic", rows: [row("TOR"), row("BOS")] },
      { name: "Pacific", rows: [row("EDM")] },
    ],
  };

  it("finds a team in any group", () => {
    expect(findStandingRow(standings, "EDM")?.team.id).toBe("EDM");
  });

  it("is undefined for an unknown team or no standings", () => {
    expect(findStandingRow(standings, "XXX")).toBeUndefined();
    expect(findStandingRow(undefined, "TOR")).toBeUndefined();
  });
});

describe("goalDifferentialLabel", () => {
  it("shows a sign for positive and negative values", () => {
    expect(goalDifferentialLabel(30)).toBe("+30");
    expect(goalDifferentialLabel(-5)).toBe("-5");
    expect(goalDifferentialLabel(0)).toBe("0");
  });
});

describe("rankLine", () => {
  it("gives the position in the division", () => {
    expect(rankLine(row("EDM", { rank: 1, divisionName: "Pacific" }))).toBe("1st in Pacific");
  });

  it("is just the position when the league names no division", () => {
    expect(rankLine(row("EDM", { rank: 4 }))).toBe("4th");
  });
});

describe("splitLines", () => {
  it("formats last 10, home and road, and skips missing ones", () => {
    const r = row("EDM", {
      last10: { wins: 8, losses: 1, otLosses: 1, goalsFor: 36, goalsAgainst: 19 },
      road: { wins: 10, losses: 0, otLosses: 1 },
    });
    expect(splitLines(r)).toEqual([
      { label: "Last 10", record: "8-1-1", goals: "Scored 36 · Allowed 19" },
      { label: "Road", record: "10-0-1", goals: undefined },
    ]);
  });
});

describe("compact team games", () => {
  const team = (id: string, name: string) => ({ id, league: "nhl", name, abbrev: id });
  function game(
    status: GameStatus,
    homeScore: number | null,
    awayScore: number | null,
    extra: Partial<Game> = {},
  ): Game {
    return {
      id: "1",
      league: "nhl",
      startTime: "2026-11-20T00:00:00Z",
      status,
      home: { team: team("TOR", "Toronto Maple Leafs"), score: homeScore },
      away: { team: team("LAK", "Los Angeles Kings"), score: awayScore },
      ...extra,
    };
  }

  it("shows three games, with the rest behind Show more", () => {
    expect(visibleGames([1, 2, 3, 4, 5], false)).toEqual({ shown: [1, 2, 3], more: 2 });
    expect(visibleGames([1, 2, 3, 4, 5], true)).toEqual({ shown: [1, 2, 3, 4, 5], more: 0 });
    expect(visibleGames([1, 2], false)).toEqual({ shown: [1, 2], more: 0 });
  });

  it("tells a final from the team's side, team's goals first", () => {
    const final = game("final", 3, 4, { endedIn: "overtime" });
    const road = teamGameLine(final, "LAK", false);
    expect(road).toMatchObject({
      home: false,
      opponent: { id: "TOR" },
      result: { won: true, score: "4-3", endedIn: "OT" },
    });
    expect(teamGameSpoken(road)).toBe("at Toronto Maple Leafs, won 4-3 in overtime");
    const home = teamGameLine(final, "TOR", false);
    expect(home).toMatchObject({ home: true, opponent: { id: "LAK" }, result: { won: false, score: "3-4" } });
    expect(teamGameSpoken(home)).toBe("vs Los Angeles Kings, lost 3-4 in overtime");
    expect(teamGameLine(game("final", 2, 1), "TOR", false).result).toEqual({
      won: true,
      score: "2-1",
      endedIn: undefined,
    });
  });

  it("shows a live score, and nothing before puck drop", () => {
    const live = teamGameLine(game("live", 1, 2), "TOR", false);
    expect(live.liveScore).toBe("1-2");
    expect(teamGameSpoken(live)).toBe("vs Los Angeles Kings, live, 1-2");
    const scheduled = teamGameLine(game("scheduled", null, null), "TOR", false);
    expect(scheduled.result).toBeUndefined();
    expect(scheduled.liveScore).toBeUndefined();
  });

  it("gives nothing away while the spoiler shield hides the game", () => {
    for (const status of ["final", "live"] as const) {
      const line = teamGameLine(game(status, 3, 4, { endedIn: "shootout" }), "LAK", true);
      expect(line.result).toBeUndefined();
      expect(line.liveScore).toBeUndefined();
      expect(teamGameSpoken(line)).toBe("at Toronto Maple Leafs");
    }
  });
});
