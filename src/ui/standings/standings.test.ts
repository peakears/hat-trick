import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapStandings } from "../../adapters/nhl/mappers";
import { RawStandingsResponseSchema } from "../../adapters/nhl/raw-types";
import type { StandingRow, Standings } from "../../domain";
import { availableStandingsViews, effectiveStandingsView, leagueOrder, standingsSections } from "./standings";

// The recorded NHL standings (2026-11-17), through the real mapper.
const nhl: Standings = mapStandings(
  RawStandingsResponseSchema.parse(
    JSON.parse(readFileSync(new URL("../../adapters/nhl/__fixtures__/standings-now.json", import.meta.url), "utf8")),
  ),
);

const ids = (items: { row: StandingRow }[]) => items.map((i) => i.row.team.id);

function row(id: string, rank: number, points: number): StandingRow {
  return {
    team: { id, league: "test", name: id, abbrev: id },
    rank,
    gamesPlayed: 10,
    wins: 5,
    losses: 5,
    points,
  };
}

// A league with no conferences or league order (like a future second league might be).
const plain: Standings = {
  league: "test",
  updatedAt: "2026-11-21T00:00:00Z",
  groups: [
    { name: "North", rows: [row("AAA", 1, 10), row("BBB", 2, 4)] },
    { name: "South", rows: [row("CCC", 1, 12), row("DDD", 2, 2)] },
  ],
};

describe("standingsSections", () => {
  it("division view: divisions under conference headings, Eastern first", () => {
    const sections = standingsSections(nhl, "division");
    expect(sections.map((s) => [s.conference, s.title])).toEqual([
      ["Eastern Conference", "Atlantic"],
      [undefined, "Metropolitan"],
      ["Western Conference", "Central"],
      [undefined, "Pacific"],
    ]);
    expect(ids(sections[0].data).slice(0, 2)).toEqual(["TBL", "OTT"]);
    expect(sections[0].data.map((i) => i.rank).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("conference view: each conference in the league's order, ranked 1..16", () => {
    const sections = standingsSections(nhl, "conference");
    // The same heading style as Division and Wild card: the conference above, then the column row.
    expect(sections.map((s) => [s.conference, s.title])).toEqual([
      ["Eastern Conference", "Team"],
      ["Western Conference", "Team"],
    ]);
    expect(sections.map((s) => s.data.length)).toEqual([16, 16]);
    expect(ids(sections[0].data).slice(0, 3)).toEqual(["CAR", "TBL", "NJD"]);
    expect(ids(sections[1].data).slice(0, 3)).toEqual(["EDM", "MIN", "VGK"]);
    expect(sections[1].data.at(-1)).toMatchObject({ rank: 16, row: { team: { id: "VAN" } } });
  });

  it("wild card view: each division's top three, then the wild card race with the playoff line after two", () => {
    const sections = standingsSections(nhl, "wildcard");
    expect(sections.map((s) => [s.conference, s.title, s.data.length])).toEqual([
      ["Eastern Conference", "Atlantic", 3],
      [undefined, "Metropolitan", 3],
      [undefined, "Wild Card", 10],
      ["Western Conference", "Central", 3],
      [undefined, "Pacific", 3],
      [undefined, "Wild Card", 10],
    ]);
    expect(ids(sections[0].data)).toEqual(["TBL", "OTT", "MTL"]);
    expect(ids(sections[1].data)).toEqual(["CAR", "NJD", "NYR"]);
    // BOS and FLA are tied on 27 points with NYR above them: the order is the league's, not by points.
    const east = sections[2];
    expect(east.playoffLine).toBe(2);
    expect(ids(east.data).slice(0, 3)).toEqual(["BOS", "FLA", "NYI"]);
    expect(east.data.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ids(sections[5].data).slice(0, 2)).toEqual(["DAL", "UTA"]);
    expect(sections[5].data.at(-1)).toMatchObject({ rank: 10, row: { team: { id: "VAN" } } });
    // Division sections carry no playoff line and every team appears once.
    expect(sections.filter((s) => s.playoffLine !== undefined)).toHaveLength(2);
    expect(new Set(sections.flatMap((s) => ids(s.data))).size).toBe(32);
  });

  it("league view: every team, by league rank", () => {
    const [league] = standingsSections(nhl, "league");
    expect([league.conference, league.title]).toEqual(["League", "Team"]);
    expect(league.data).toHaveLength(32);
    expect(ids(league.data).slice(0, 4)).toEqual(["EDM", "MIN", "CAR", "TBL"]);
    expect(league.data[31]).toMatchObject({ rank: 32, row: { team: { id: "VAN" } } });
  });

  it("keeps the adapter's group order and no headings when there are no conferences", () => {
    const sections = standingsSections(plain, "division");
    expect(sections.map((s) => s.title)).toEqual(["North", "South"]);
    expect(sections.every((s) => s.conference === undefined)).toBe(true);
  });

  it("orders by points when the league gives no league rank", () => {
    expect(leagueOrder(plain).map((r) => r.team.id)).toEqual(["CCC", "AAA", "BBB", "DDD"]);
  });

  it("is empty with no standings", () => {
    expect(standingsSections(undefined, "league")).toEqual([]);
  });
});

describe("standings views", () => {
  it("offers Conference only for leagues with conferences", () => {
    expect(availableStandingsViews(nhl)).toEqual(["division", "conference", "wildcard", "league"]);
    expect(availableStandingsViews(plain)).toEqual(["division", "league"]);
    expect(availableStandingsViews(undefined)).toEqual(["division"]);
  });

  it("offers Wild card only when the league has wild cards", () => {
    const noSpots: Standings = { ...nhl, wildCardSpots: undefined };
    expect(availableStandingsViews(noSpots)).toEqual(["division", "conference", "league"]);
    const noRanks: Standings = {
      ...nhl,
      groups: nhl.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, wildCardRank: undefined })) })),
    };
    expect(availableStandingsViews(noRanks)).not.toContain("wildcard");
    expect(effectiveStandingsView(noRanks, "wildcard")).toBe("division");
  });

  it("falls back to Division when the saved view is not available", () => {
    expect(effectiveStandingsView(plain, "conference")).toBe("division");
    expect(effectiveStandingsView(nhl, "conference")).toBe("conference");
  });
});
