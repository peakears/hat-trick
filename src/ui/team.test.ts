import { describe, expect, it } from "vitest";
import type { StandingRow, Standings } from "../domain";
import { findStandingRow, goalDifferentialLabel, ordinal, rankLines, splitLines } from "./team";

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

describe("rankLines", () => {
  it("lists division, conference and league positions", () => {
    const r = row("EDM", {
      rank: 1,
      divisionName: "Pacific",
      conferenceRank: 2,
      conferenceName: "Western Conference",
      leagueRank: 3,
    });
    expect(rankLines(r)).toEqual(["1st in Pacific", "2nd in Western Conference", "3rd in the league"]);
  });

  it("leaves out what the league did not send", () => {
    expect(rankLines(row("EDM", { rank: 4 }))).toEqual(["4th"]);
  });
});

describe("splitLines", () => {
  it("formats last 10, home and road, and skips missing ones", () => {
    const r = row("EDM", {
      last10: { wins: 8, losses: 1, otLosses: 1, goalsFor: 36, goalsAgainst: 19 },
      road: { wins: 10, losses: 0, otLosses: 1 },
    });
    expect(splitLines(r)).toEqual([
      { label: "Last 10", record: "8-1-1", goals: "36 for, 19 against" },
      { label: "Road", record: "10-0-1", goals: undefined },
    ]);
  });
});
