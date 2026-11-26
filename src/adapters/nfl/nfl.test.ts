import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLeagueAdapterContract } from "../../contract/league-adapter.contract";
import type { AdapterWarning, Game } from "../../domain";
import { NflAdapter, NflApiError, NflResponseError } from ".";
import { LEADER_CATEGORIES, LEADER_GROUPS } from "./constants";
import { periodLabel, split } from "./mappers";

// Recorded from ESPN on 2026-11-26 (about 8:50 am ET; Thanksgiving's scoreboard at 1:18 pm ET), trimmed of fields the
// adapter does not read; see CLAUDE.md.
const FIXTURES: [RegExp, string][] = [
  [/\/scoreboard\?dates=20261125$/, "scoreboard-2026-11-25.json"], // GB at LAR, final (LAR won 26-13)
  // Thanksgiving: CHI at DET live (DET 3-0, 8:31 left in Q1), PHI at DAL and KC at BUF scheduled.
  [/\/scoreboard\?dates=20261126$/, "scoreboard-2026-11-26.json"],
  [/\/standings\?level=3$/, "standings-now.json"], // after week 12's Wednesday game; NYG 6-3-1 and WSH 4-5-1 tied
  ...LEADER_CATEGORIES.map(({ category }): [RegExp, string] => [
    new RegExp(`/byathlete\\?.*sort=${category.replace(".", "\\.")}:desc`),
    `leaders-${category}.json`,
  ]),
];

function loadFixture(file: string): any {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${file}`, import.meta.url), "utf8"));
}

function fixtureFor(url: string): any {
  const hit = FIXTURES.find(([pattern]) => pattern.test(url));
  if (!hit) throw new Error(`No fixture for ${url}`);
  const body = loadFixture(hit[1]);
  const limit = Number(new URL(url).searchParams.get("limit"));
  if (/\/byathlete\?/.test(url) && limit > 0) body.athletes = body.athletes.slice(0, limit);
  return body;
}

/** An adapter served from fixtures. `edit` lets a test change a response to simulate API drift. */
function fixtureAdapter(edit?: (url: string, body: any) => void) {
  const warnings: AdapterWarning[] = [];
  const urls: string[] = [];
  const adapter = new NflAdapter({
    fetch: async (input) => {
      const url = String(input);
      urls.push(url);
      const body = fixtureFor(url);
      edit?.(url, body);
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
    onWarning: (w) => warnings.push(w),
    now: () => new Date("2026-11-26T13:50:00Z"),
  });
  return { adapter, warnings, urls };
}

runLeagueAdapterContract({
  name: "NFL",
  league: "nfl",
  makeAdapter: () => fixtureAdapter().adapter,
  makeFailingAdapter: () =>
    new NflAdapter({
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    }),
  inputs: {
    scoreDates: ["2026-11-25", "2026-11-26"],
    leaderQueries: [{}, { category: "passing.passingYards", limit: 3 }, { category: "defensive.sacks" }],
    // Not built yet: game, team and player pages, play-by-play, special events and spotlight.
    gameIds: [],
    teamIds: [],
    playerIds: [],
    playGameIds: [],
    specialEventDates: [],
  },
});

const byMatchup = (games: Game[], away: string, home: string) => {
  const game = games.find((g) => g.away.team.id === away && g.home.team.id === home);
  if (!game) throw new Error(`no ${away} at ${home}`);
  return game;
};

/** The final GB at LAR game turned into a live one in `name` (period 3, 7:42 left), with three quarters scored. */
const liveEdit =
  (name = "STATUS_IN_PROGRESS") =>
  (url: string, body: any) => {
    if (!url.includes("dates=20261125")) return;
    const event = body.events[0];
    event.status = { ...event.status, period: 3, displayClock: "7:42", type: { name, state: "in", completed: false } };
    for (const c of event.competitions[0].competitors) {
      c.linescores = c.linescores.slice(0, 3);
      c.score = String(c.linescores.reduce((sum: number, l: any) => sum + l.value, 0));
    }
  };

describe("NFL adapter", () => {
  it("parses every recorded response with no warnings", async () => {
    const { adapter, warnings } = fixtureAdapter();
    await adapter.getScores("2026-11-25");
    await adapter.getScores("2026-11-26");
    await adapter.getStandings();
    await adapter.getLeaders();
    expect(warnings).toEqual([]);
  });

  it("names the league and its words, and has none of the optional features yet", () => {
    const adapter = new NflAdapter();
    expect(adapter).toMatchObject({
      league: "nfl",
      name: "National Football League",
      gameStartTerm: "Kickoff",
      liveAlerts: { kind: "lateLeadChanges", regulationPeriods: 4 },
    });
    const methods = adapter as unknown as Record<string, unknown>;
    for (const method of ["getGameDetail", "getPlays", "getTeam", "getPlayer", "getSpecialEvents", "getSpotlight"]) {
      expect(methods[method], method).toBeUndefined();
    }
  });

  it("builds the expected endpoint URLs", async () => {
    const { adapter, urls } = fixtureAdapter();
    await adapter.getScores("2026-11-26");
    await adapter.getStandings();
    await adapter.getLeaders({ category: "defensiveInterceptions.interceptions", limit: 5 });
    expect(urls).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261126",
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3",
      "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=5&sort=defensiveInterceptions.interceptions:desc",
    ]);
  });

  describe("scores", () => {
    it("maps a final game: scores, each quarter, records and stadium", async () => {
      const [game] = await fixtureAdapter().adapter.getScores("2026-11-25");
      expect(game).toMatchObject({
        id: "401873079",
        league: "nfl",
        status: "final",
        endedIn: "regulation",
        startTime: "2026-11-26T01:00:00.000Z",
        away: { team: { id: "GB", abbrev: "GB", name: "Green Bay Packers" }, score: 13, record: "6-5" },
        home: { team: { id: "LAR", name: "Los Angeles Rams" }, score: 26, record: "7-4" },
        venue: { name: "SoFi Stadium", city: "Inglewood" },
      });
      expect(game.periods).toEqual([
        { label: "Q1", away: 3, home: 6 },
        { label: "Q2", away: 10, home: 7 },
        { label: "Q3", away: 0, home: 7 },
        { label: "Q4", away: 0, home: 6 },
      ]);
      expect(game.clock).toBeUndefined();
    });

    it("maps a live game from the league: the quarter, its clock and the quarters to come", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-26");
      expect(byMatchup(games, "CHI", "DET")).toMatchObject({
        status: "live",
        clock: { period: 1, label: "Q1", timeRemaining: "8:31" },
        away: { team: { name: "Chicago Bears" }, score: 0 },
        home: { team: { name: "Detroit Lions" }, score: 3 },
        venue: { name: "Ford Field", city: "Detroit" },
        periods: [
          { label: "Q1", away: 0, home: 3 },
          { label: "Q2", away: null, home: null },
          { label: "Q3", away: null, home: null },
          { label: "Q4", away: null, home: null },
        ],
      });
    });

    it("gives scheduled games no score, clock or quarters", async () => {
      const games = (await fixtureAdapter().adapter.getScores("2026-11-26")).filter((g) => g.status === "scheduled");
      expect(games.map((g) => `${g.away.team.id}@${g.home.team.id}`)).toEqual(["PHI@DAL", "KC@BUF"]);
      for (const game of games) {
        expect(game.status).toBe("scheduled");
        expect([game.home.score, game.away.score]).toEqual([null, null]);
        expect(game.clock).toBeUndefined();
        expect(game.periods).toBeUndefined();
      }
      expect(byMatchup(games, "KC", "BUF").venue?.name).toBe("Highmark Stadium");
    });

    it("maps a live game: the quarter, its clock, and every quarter with those not played yet empty", async () => {
      const [game] = await fixtureAdapter(liveEdit()).adapter.getScores("2026-11-25");
      expect(game).toMatchObject({
        status: "live",
        clock: { period: 3, label: "Q3", timeRemaining: "7:42" },
        away: { score: 13 },
        home: { score: 20 },
      });
      expect(game.periods?.map((p) => [p.label, p.away, p.home])).toEqual([
        ["Q1", 3, 6],
        ["Q2", 10, 7],
        ["Q3", 0, 7],
        ["Q4", null, null],
      ]);
    });

    it("labels halftime, the end of a quarter, overtime and postponed games", async () => {
      const clockOf = async (name: string) => (await fixtureAdapter(liveEdit(name)).adapter.getScores("2026-11-25"))[0];
      expect((await clockOf("STATUS_HALFTIME")).clock).toEqual({ period: 3, label: "Halftime" });
      expect((await clockOf("STATUS_END_PERIOD")).clock).toEqual({ period: 3, label: "End Q3" });
      const overtime = fixtureAdapter((url, body) => (body.events[0].status.period = 5));
      expect((await overtime.adapter.getScores("2026-11-25"))[0].endedIn).toBe("overtime");
      const postponed = fixtureAdapter((url, body) => {
        if (!url.includes("dates=20261126")) return;
        body.events[1].status.type = { name: "STATUS_POSTPONED", state: "pre", completed: false };
      });
      const game = (await postponed.adapter.getScores("2026-11-26"))[1];
      expect(game.status).toBe("postponed");
    });

    it("leaves out quarters that do not add up to the score", async () => {
      const { adapter } = fixtureAdapter((url, body) => body.events[0].competitions[0].competitors[0].linescores.pop());
      expect((await adapter.getScores("2026-11-25"))[0].periods).toBeUndefined();
    });

    it("names quarters and overtimes", () => {
      expect([1, 4, 5, 6].map(periodLabel)).toEqual(["Q1", "Q4", "OT", "2OT"]);
    });

    it("fails on a missing core field, and drops a bad minor one with a warning", async () => {
      const broken = fixtureAdapter((url, body) => delete body.events[0].competitions[0].competitors[0].score);
      await expect(broken.adapter.getScores("2026-11-25")).rejects.toBeInstanceOf(NflResponseError);
      const minor = fixtureAdapter((url, body) => (body.events[0].competitions[0].competitors[0].team.logo = 7));
      const [game] = await minor.adapter.getScores("2026-11-25");
      expect(game.home.team.logoUrl).toBeUndefined();
      expect(minor.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("standings", () => {
    it("groups teams by division, each in the league's order", async () => {
      const standings = await fixtureAdapter().adapter.getStandings();
      expect(standings.groups.map((g) => g.name)).toEqual([
        "AFC East",
        "AFC North",
        "AFC South",
        "AFC West",
        "NFC East",
        "NFC North",
        "NFC South",
        "NFC West",
      ]);
      for (const group of standings.groups) expect(group.rows).toHaveLength(4);
      // Entries come unsorted; the conference seed orders them (KC and DEN are both 8-2: DEN holds the division).
      expect(standings.groups[0].rows.map((r) => r.team.id)).toEqual(["BUF", "NE", "NYJ", "MIA"]);
      expect(standings.groups[3].rows.map((r) => r.team.id)).toEqual(["DEN", "KC", "LV", "LAC"]);
    });

    it("seeds each conference and bands the seeds: seven make the playoffs", async () => {
      const standings = await fixtureAdapter().adapter.getStandings();
      expect(standings.conferenceBands).toEqual([{ label: "Playoffs", through: 7 }, { label: "Out" }]);
      const afc = standings.groups
        .flatMap((g) => g.rows)
        .filter((r) => r.conferenceName === "American Football Conference")
        .sort((a, b) => a.conferenceRank! - b.conferenceRank!);
      expect(afc.map((r) => r.conferenceRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      expect(afc.slice(0, 4).map((r) => r.team.id)).toEqual(["BUF", "DEN", "JAX", "CIN"]);
      expect(standings.wildCardSpots).toBeUndefined();
    });

    it("counts ties, in the record and the home and road splits", async () => {
      const rows = (await fixtureAdapter().adapter.getStandings()).groups.flatMap((g) => g.rows);
      const nyg = rows.find((r) => r.team.id === "NYG")!;
      expect(nyg).toMatchObject({
        team: { name: "New York Giants", logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png" },
        wins: 6,
        losses: 3,
        ties: 1,
        gamesPlayed: 10,
        winPercent: 0.65,
        streak: "W1",
        home: { wins: 4, losses: 2, ties: 0 },
        road: { wins: 2, losses: 1, ties: 1 },
        divisionName: "NFC East",
        conferenceName: "National Football Conference",
      });
      expect(rows.find((r) => r.team.id === "BUF")).toMatchObject({ wins: 9, losses: 1, ties: 0, gamesPlayed: 10 });
      for (const key of ["otLosses", "points", "gamesBehind", "goalsFor", "last10", "wildCardRank"]) {
        expect(nyg, key).not.toHaveProperty(key);
      }
    });

    it("ranks the whole league by win percentage", async () => {
      const rows = (await fixtureAdapter().adapter.getStandings()).groups.flatMap((g) => g.rows);
      const ordered = [...rows].sort((a, b) => a.leagueRank! - b.leagueRank!);
      expect(ordered.map((r) => r.leagueRank)).toEqual(rows.map((_, i) => i + 1));
      const pct = ordered.map((r) => r.winPercent!);
      expect(pct).toEqual([...pct].sort((a, b) => b - a));
    });

    it("reads W-L and W-L-T splits", () => {
      expect(split("4-2")).toEqual({ wins: 4, losses: 2, ties: 0 });
      expect(split("2-1-1")).toEqual({ wins: 2, losses: 1, ties: 1 });
      expect(split("-")).toBeUndefined();
    });
  });

  describe("leaders", () => {
    it("returns one board per category, in order, with 20 players each by default", async () => {
      const boards = await fixtureAdapter().adapter.getLeaders();
      expect(boards.map((b) => b.label)).toEqual(LEADER_CATEGORIES.map((c) => c.label));
      for (const board of boards) expect(board.entries).toHaveLength(20);
    });

    it("splits the boards into offence and defence", () => {
      expect(LEADER_GROUPS.map((g) => g.label)).toEqual(["Offence", "Defence"]);
      expect(LEADER_GROUPS.flatMap((g) => g.categories)).toEqual(LEADER_CATEGORIES.map((c) => c.category));
    });

    it("maps the player, team and value shown", async () => {
      const [yards] = await fixtureAdapter().adapter.getLeaders({ category: "passing.passingYards", limit: 3 });
      expect(yards).toMatchObject({ label: "Passing yards", decimals: 0 });
      expect(yards.entries[0]).toEqual({
        rank: 1,
        player: {
          id: "3915511",
          league: "nfl",
          name: "Joe Burrow",
          teamId: "CIN",
          position: "QB",
          headshotUrl: "https://a.espncdn.com/i/headshots/nfl/players/full/3915511.png",
        },
        team: {
          id: "CIN",
          league: "nfl",
          name: "CIN",
          abbrev: "CIN",
          logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png",
        },
        value: 3095,
      });
      expect(yards.entries.map((e) => e.value)).toEqual([3095, 3049, 3036]);
    });

    it("rounds rates and half sacks to one decimal", async () => {
      const [rating] = await fixtureAdapter().adapter.getLeaders({ category: "passing.QBRating", limit: 2 });
      expect(rating.entries.map((e) => e.value)).toEqual([125.9, 125.6]);
      const [sacks] = await fixtureAdapter().adapter.getLeaders({ category: "defensive.sacks", limit: 3 });
      expect(sacks).toMatchObject({ decimals: 1 });
      expect(sacks.entries.map((e) => e.value)).toEqual([11.5, 10, 9.5]);
    });

    it("finds a group whose name differs in case from the sort key, and shares ranks on ties", async () => {
      const [ints] = await fixtureAdapter().adapter.getLeaders({ category: "defensiveInterceptions.interceptions" });
      expect(ints.entries.slice(0, 5).map((e) => [e.player.name, e.value, e.rank])).toEqual([
        ["Xavier McKinney", 6, 1],
        ["Amani Hooker", 5, 2],
        ["Alex Anzalone", 4, 3],
        ["Byron Murphy Jr.", 4, 3],
        ["Zyon McCollum", 4, 3],
      ]);
    });

    it("rejects an unknown category", async () => {
      await expect(fixtureAdapter().adapter.getLeaders({ category: "kicking.punts" })).rejects.toThrow(/Unknown NFL/);
    });
  });

  it("reports a failed request as an NflApiError", async () => {
    const adapter = new NflAdapter({ fetch: async () => new Response("nope", { status: 503 }) });
    await expect(adapter.getStandings()).rejects.toBeInstanceOf(NflApiError);
  });
});
