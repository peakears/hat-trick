import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLeagueAdapterContract } from "../../contract/league-adapter.contract";
import type { AdapterWarning, Game } from "../../domain";
import { NbaAdapter, NbaApiError, NbaResponseError } from ".";
import { LEADER_CATEGORIES } from "./constants";
import { periodLabel } from "./mappers";

// Recorded from ESPN on 2026-11-22 (about 10:20 pm ET); the game summaries and the team's files on 2026-11-23 (just
// after midnight ET). All but the scoreboards and standings are trimmed of fields the adapter does not read, to keep
// them small; see CLAUDE.md.
const FIXTURES: [RegExp, string][] = [
  [/\/scoreboard\?dates=20261122$/, "scoreboard-2026-11-22.json"], // 5 final (one in OT), 2 live
  [/\/scoreboard\?dates=20261124$/, "scoreboard-2026-11-24.json"], // scheduled
  [/\/standings\?level=3$/, "standings-now.json"],
  [/\/summary\?event=401910032$/, "summary-401910032-final.json"], // DEN won 151-145 at CHI in OT
  [/\/summary\?event=401909314$/, "summary-401909314-pre.json"], // DET at ORL, scheduled
  [/\/teams\/DEN\/athletes\/statistics$/, "team-DEN-athletes-statistics.json"],
  [/\/teams\/DEN\/schedule$/, "team-DEN-schedule.json"], // the 2026-27 regular season, 15 games played
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
  const adapter = new NbaAdapter({
    fetch: async (input) => {
      const url = String(input);
      urls.push(url);
      const body = fixtureFor(url);
      edit?.(url, body);
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
    onWarning: (w) => warnings.push(w),
    now: () => new Date("2026-11-23T03:30:00Z"),
  });
  return { adapter, warnings, urls };
}

runLeagueAdapterContract({
  name: "NBA",
  league: "nba",
  makeAdapter: () => fixtureAdapter().adapter,
  makeFailingAdapter: () =>
    new NbaAdapter({
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    }),
  inputs: {
    scoreDates: ["2026-11-22", "2026-11-24"],
    leaderQueries: [{}, { category: "offensive.avgPoints", limit: 3 }, { category: "defensive.avgBlocks" }],
    // Not built yet: player pages, special events and spotlight.
    gameIds: ["401910032", "401909314"],
    teamIds: ["DEN"],
    playerIds: [],
    specialEventDates: [],
  },
});

const byMatchup = (games: Game[], away: string, home: string) => {
  const game = games.find((g) => g.away.team.id === away && g.home.team.id === home);
  if (!game) throw new Error(`no ${away} at ${home}`);
  return game;
};

describe("NBA adapter", () => {
  it("parses every recorded response with no warnings", async () => {
    const { adapter, warnings } = fixtureAdapter();
    await adapter.getScores("2026-11-22");
    await adapter.getScores("2026-11-24");
    await adapter.getStandings();
    await adapter.getLeaders();
    await adapter.getGameDetail("401910032");
    await adapter.getGameDetail("401909314");
    await adapter.getTeam("DEN");
    expect(warnings).toEqual([]);
  });

  it("has game and team pages, and none of the other optional features yet", () => {
    const adapter = new NbaAdapter() as unknown as Record<string, unknown>;
    for (const method of ["getGameDetail", "getTeam"]) expect(adapter[method], method).toBeTypeOf("function");
    for (const method of ["getSpecialEvents", "getSpotlight", "getPlayer"]) {
      expect(adapter[method], method).toBeUndefined();
    }
  });

  it("builds the expected endpoint URLs", async () => {
    const { adapter, urls } = fixtureAdapter();
    await adapter.getScores("2026-11-22");
    await adapter.getStandings();
    await adapter.getLeaders({ category: "offensive.avgPoints", limit: 5 });
    await adapter.getGameDetail("401910032");
    await adapter.getTeam("DEN");
    expect(urls).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261122",
      "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3",
      "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=5&sort=offensive.avgPoints:desc",
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401910032",
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/DEN/athletes/statistics",
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/DEN/schedule",
    ]);
  });

  describe("scores", () => {
    it("maps a live game: quarter, clock, scores, records and arena", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-22");
      expect(byMatchup(games, "IND", "NY")).toMatchObject({
        status: "live",
        clock: { period: 4, label: "Q4", timeRemaining: "4:06" },
        away: {
          team: { id: "IND", abbrev: "IND", name: "Indiana Pacers" },
          record: expect.stringMatching(/^\d+-\d+$/),
        },
        home: { team: { id: "NY", name: "New York Knicks" }, record: "10-6" },
        venue: { name: "Madison Square Garden", city: "New York" },
      });
      expect(byMatchup(games, "IND", "NY").startTime).toBe("2026-11-23T01:00:00.000Z");
    });

    it("maps finals, with overtime", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-22");
      expect(byMatchup(games, "DEN", "CHI")).toMatchObject({
        status: "final",
        endedIn: "overtime",
        away: { score: 151 },
        home: { score: 145 },
      });
      expect(byMatchup(games, "DET", "ATL")).toMatchObject({ status: "final", endedIn: "regulation" });
      expect(games.filter((g) => g.status === "final")).toHaveLength(5);
    });

    it("gives scheduled games no score and no clock", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-24");
      expect(games.length).toBeGreaterThan(0);
      for (const game of games) {
        expect(game.status).toBe("scheduled");
        expect([game.home.score, game.away.score]).toEqual([null, null]);
        expect(game.clock).toBeUndefined();
      }
    });

    it("labels halftime, the end of a quarter, and postponed games", async () => {
      const setStatus = (name: string, id: string) => (url: string, body: any) => {
        if (!url.includes("scoreboard")) return;
        const event = body.events.find((e: any) => e.id === id);
        event.status.type.name = name;
        if (name === "STATUS_POSTPONED") event.status.type.state = "pre";
      };
      const live = "401910035"; // BOS at GS, live in the fixture
      const clockOf = async (name: string) =>
        (await fixtureAdapter(setStatus(name, live)).adapter.getScores("2026-11-22")).find((g) => g.id === live)!;
      const { period } = (await clockOf("STATUS_IN_PROGRESS")).clock!;
      expect((await clockOf("STATUS_HALFTIME")).clock).toEqual({ period, label: "Halftime" });
      expect((await clockOf("STATUS_END_PERIOD")).clock).toEqual({ period, label: `End Q${period}` });
      const postponed = await clockOf("STATUS_POSTPONED");
      expect(postponed.status).toBe("postponed");
      expect(postponed.home.score).toBeNull();
    });

    it("names quarters and overtimes", () => {
      expect([1, 4, 5, 6, 7].map(periodLabel)).toEqual(["Q1", "Q4", "OT", "2OT", "3OT"]);
    });
  });

  describe("standings", () => {
    it("groups teams by division, in the league's order", async () => {
      const standings = await fixtureAdapter().adapter.getStandings();
      expect(standings.groups.map((g) => g.name)).toEqual([
        "Atlantic",
        "Central",
        "Southeast",
        "Northwest",
        "Pacific",
        "Southwest",
      ]);
      for (const group of standings.groups) expect(group.rows).toHaveLength(5);
      // Entries come unsorted; the conference seed orders them (PHI 1, BOS 2, NY 6, TOR 10, BKN 14).
      expect(standings.groups[0].rows.map((r) => r.team.id)).toEqual(["PHI", "BOS", "NY", "TOR", "BKN"]);
      expect(standings.wildCardSpots).toBeUndefined();
    });

    it("has win percentage, games behind, streak and splits, and no hockey fields", async () => {
      const standings = await fixtureAdapter().adapter.getStandings();
      const bkn = standings.groups[0].rows.find((r) => r.team.id === "BKN")!;
      expect(bkn).toMatchObject({
        team: { name: "Brooklyn Nets", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png" },
        divisionName: "Atlantic",
        conferenceName: "Eastern Conference",
        gamesPlayed: bkn.wins + bkn.losses,
        streak: expect.stringMatching(/^[WL]\d+$/),
      });
      expect(bkn.winPercent).toBeCloseTo(bkn.wins / bkn.gamesPlayed, 3);
      expect(bkn.gamesBehind).toBeGreaterThan(0);
      expect(bkn.home!.wins + bkn.home!.losses + bkn.road!.wins + bkn.road!.losses).toBe(bkn.gamesPlayed);
      expect(bkn.last10!.wins + bkn.last10!.losses).toBe(10);
      for (const key of ["otLosses", "points", "goalsFor", "goalsAgainst", "wildCardRank"]) {
        expect(bkn, key).not.toHaveProperty(key);
      }
    });

    it("ranks the whole league by win percentage", async () => {
      const rows = (await fixtureAdapter().adapter.getStandings()).groups.flatMap((g) => g.rows);
      const ordered = [...rows].sort((a, b) => a.leagueRank! - b.leagueRank!);
      expect(ordered.map((r) => r.leagueRank)).toEqual(rows.map((_, i) => i + 1));
      const pct = ordered.map((r) => r.winPercent!);
      expect(pct).toEqual([...pct].sort((a, b) => b - a));
    });
  });

  describe("leaders", () => {
    it("returns one board per category, in order, with 20 players each by default", async () => {
      const boards = await fixtureAdapter().adapter.getLeaders();
      expect(boards.map((b) => b.label)).toEqual(LEADER_CATEGORIES.map((c) => c.label));
      for (const board of boards) expect(board.entries).toHaveLength(20);
    });

    it("maps the player, team and value shown", async () => {
      const [points] = await fixtureAdapter().adapter.getLeaders({ category: "offensive.avgPoints", limit: 3 });
      expect(points.entries[0]).toEqual({
        rank: 1,
        player: {
          id: "3945274",
          league: "nba",
          name: "Luka Doncic",
          teamId: "LAL",
          position: "G",
          headshotUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3945274.png",
        },
        team: {
          id: "LAL",
          league: "nba",
          name: "LAL",
          abbrev: "LAL",
          logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
        },
        value: 37.2,
      });
    });

    it("rounds values to one decimal and ranks ties together", async () => {
      const { adapter } = fixtureAdapter((url, body) => {
        if (!url.includes("byathlete")) return;
        const i = body.categories.find((c: any) => c.name === "offensive").names.indexOf("avgPoints");
        const offensive = (n: number) => body.athletes[n].categories.find((c: any) => c.name === "offensive");
        offensive(0).values[i] = 30.04;
        offensive(1).values[i] = 29.96;
        offensive(2).values[i] = 29.0;
      });
      const [board] = await adapter.getLeaders({ category: "offensive.avgPoints", limit: 3 });
      expect(board.entries.map((e) => [e.rank, e.value])).toEqual([
        [1, 30],
        [1, 30],
        [3, 29],
      ]);
    });

    it("rejects an unknown category", async () => {
      await expect(fixtureAdapter().adapter.getLeaders({ category: "goals" })).rejects.toThrow("Unknown NBA leader");
    });
  });

  describe("game page", () => {
    it("maps a final game in overtime: teams, scores, arena, no records", async () => {
      const { game } = await fixtureAdapter().adapter.getGameDetail("401910032");
      expect(game).toEqual({
        id: "401910032",
        league: "nba",
        startTime: "2026-11-23T00:00:00.000Z",
        status: "final",
        endedIn: "overtime",
        home: { team: expect.objectContaining({ id: "CHI", name: "Chicago Bulls" }), score: 145 },
        away: { team: expect.objectContaining({ id: "DEN", name: "Denver Nuggets" }), score: 151 },
        venue: { name: "United Center", city: "Chicago" },
      });
    });

    it("splits each box score into starters and bench, with ESPN's columns, leaving out who did not play", async () => {
      const { boxscore } = await fixtureAdapter().adapter.getGameDetail("401910032");
      const [starters, bench] = boxscore.away;
      expect(boxscore.away.map((t) => t.title)).toEqual(["Starters", "Bench"]);
      expect(starters.rows).toHaveLength(5);
      expect(starters.columns.map((c) => c.label)).toEqual([
        "MIN",
        "PTS",
        "FG",
        "3PT",
        "FT",
        "REB",
        "AST",
        "TO",
        "STL",
        "BLK",
        "OREB",
        "DREB",
        "PF",
        "+/-",
      ]);
      expect(starters.rows[0]).toMatchObject({
        player: { id: "3064290", name: "Aaron Gordon", teamId: "DEN", position: "F" },
        values: { minutes: "33", points: "18", "fieldGoalsMade-fieldGoalsAttempted": "8-19" },
      });
      const names = [...starters.rows, ...bench.rows].map((r) => r.player.name);
      expect(names).not.toContain("Alpha Diallo"); // did not play (coach's decision)
      expect(boxscore.home.map((t) => t.title)).toEqual(["Starters", "Bench"]);
    });

    it("maps a scheduled game: no scores or box score, with the season records", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("401909314");
      expect(detail.game).toMatchObject({
        status: "scheduled",
        home: { team: { id: "ORL" }, score: null, record: "7-9" },
        away: { team: { id: "DET" }, score: null, record: "10-6" },
        venue: { name: "Kia Center", city: "Orlando" },
      });
      expect(detail.boxscore).toEqual({ home: [], away: [] });
    });

    // No live summary is recorded yet (see CLAUDE.md): this edits the final one into a live third quarter.
    it("maps a live game's quarter and clock from the header, when it has them", async () => {
      const { adapter } = fixtureAdapter((url, body) => {
        if (!url.includes("summary")) return;
        const competition = body.header.competitions[0];
        competition.status = {
          period: 3,
          displayClock: "4:21",
          type: { name: "STATUS_IN_PROGRESS", state: "in", completed: false },
        };
        for (const c of competition.competitors) c.linescores = c.linescores.slice(0, 3);
      });
      const { game } = await adapter.getGameDetail("401910032");
      expect(game).toMatchObject({ status: "live", clock: { period: 3, label: "Q3", timeRemaining: "4:21" } });
    });

    it("counts the quarters played when a live header has no period", async () => {
      const { adapter } = fixtureAdapter((url, body) => {
        if (!url.includes("summary")) return;
        const competition = body.header.competitions[0];
        competition.status = { type: { name: "STATUS_HALFTIME", state: "in", completed: false } };
        for (const c of competition.competitors) c.linescores = c.linescores.slice(0, 2);
      });
      const { game } = await adapter.getGameDetail("401910032");
      expect(game.clock).toEqual({ period: 2, label: "Halftime" });
    });
  });

  describe("team page", () => {
    it("maps the roster's season stats as one table, by points per game", async () => {
      const { stats } = await fixtureAdapter().adapter.getTeam("DEN");
      expect(stats).toHaveLength(1);
      const [table] = stats;
      expect(table.title).toBe("Players");
      expect(table.columns.map((c) => c.label)).toEqual([
        "GP",
        "MIN",
        "PTS",
        "REB",
        "AST",
        "STL",
        "BLK",
        "FG%",
        "3P%",
        "FT%",
      ]);
      expect(table.rows).toHaveLength(16);
      expect(table.rows[0]).toEqual({
        player: expect.objectContaining({ id: "3936299", name: "Jamal Murray", position: "G" }),
        values: {
          gamesPlayed: "14",
          avgMinutes: "36.4",
          avgPoints: "24.9",
          avgRebounds: "5.0",
          avgAssists: "5.8",
          avgSteals: "1.1",
          avgBlocks: "0.9",
          fieldGoalPct: "50.2",
          threePointFieldGoalPct: "46.3",
          freeThrowPct: "86.7",
        },
      });
    });

    it("takes recent and upcoming games and the home arena from the schedule", async () => {
      const team = await fixtureAdapter().adapter.getTeam("DEN");
      expect(team.arena).toBe("Ball Arena");
      expect(team.recent?.[0]).toMatchObject({
        id: "401910032",
        status: "final",
        endedIn: "overtime",
        away: { team: { id: "DEN" }, score: 151 },
        home: { team: { id: "CHI" }, score: 145 },
      });
      expect(team.recent).toHaveLength(5);
      expect(team.upcoming?.[0]).toMatchObject({
        id: "401909316",
        status: "scheduled",
        home: { team: { id: "DEN" }, score: null },
        away: { team: { id: "DAL" } },
      });
      expect(team.upcoming).toHaveLength(5);
    });

    it("gives empty lists for a schedule with no games (the offseason)", async () => {
      const { adapter, warnings } = fixtureAdapter((url, body) => {
        if (url.endsWith("/schedule")) delete body.events;
      });
      const team = await adapter.getTeam("DEN");
      expect(team).toMatchObject({ recent: [], upcoming: [] });
      expect(team.arena).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    it("still shows the stats when the schedule fails, with a warning", async () => {
      const warnings: AdapterWarning[] = [];
      const failing = new NbaAdapter({
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/schedule")) return new Response("down", { status: 503 });
          return new Response(JSON.stringify(fixtureFor(url)));
        },
        onWarning: (w) => warnings.push(w),
      });
      const team = await failing.getTeam("DEN");
      expect(team.stats).toHaveLength(1);
      expect(team.recent).toBeUndefined();
      expect(team.upcoming).toBeUndefined();
      expect(warnings.map((w) => w.message)).toEqual(["team games left out: NBA API returned 503"]);
    });
  });

  describe("drift", () => {
    it("fails on a missing core field", async () => {
      const { adapter } = fixtureAdapter((url, body) => {
        if (url.includes("standings")) body.children[0].children[0].standings.entries[0].stats = [];
      });
      await expect(adapter.getStandings()).rejects.toBeInstanceOf(NbaResponseError);
    });

    it("drops a bad minor field with a warning and keeps the rest", async () => {
      const { adapter, warnings } = fixtureAdapter((url, body) => {
        if (url.includes("scoreboard")) body.events[0].competitions[0].venue = "Madison Square Garden";
      });
      const games = await adapter.getScores("2026-11-22");
      expect(games[0].venue).toBeUndefined();
      expect(games).toHaveLength(7);
      expect(warnings.map((w) => w.message)).toEqual([expect.stringMatching(/^competition\.venue: unexpected value/)]);
    });

    it("drops a broken leader row with a warning", async () => {
      const { adapter, warnings } = fixtureAdapter((url, body) => {
        if (url.includes("byathlete")) delete body.athletes[0].athlete.id;
      });
      const [board] = await adapter.getLeaders({ category: "offensive.avgPoints", limit: 3 });
      expect(board.entries).toHaveLength(2);
      expect(warnings).toHaveLength(1);
    });

    it("reports HTTP errors with the status", async () => {
      const adapter = new NbaAdapter({ fetch: async () => new Response("down", { status: 503 }) });
      const err = await adapter.getStandings().catch((e) => e);
      expect(err).toBeInstanceOf(NbaApiError);
      expect(err.status).toBe(503);
    });
  });
});
