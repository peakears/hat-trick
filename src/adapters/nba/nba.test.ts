import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLeagueAdapterContract } from "../../contract/league-adapter.contract";
import type { AdapterWarning, Game } from "../../domain";
import { NbaAdapter, NbaApiError, NbaResponseError } from ".";
import { LEADER_CATEGORIES } from "./constants";
import { birthDate, draft, periodLabel, positionName } from "./mappers";

// Recorded from ESPN on 2026-11-22 (about 10:20 pm ET); the game summaries and the team's files on 2026-11-23 (just
// after midnight ET). All but the scoreboards and standings are trimmed of fields the adapter does not read, to keep
// them small; see CLAUDE.md.
const FIXTURES: [RegExp, string][] = [
  [/\/scoreboard\?dates=20261122$/, "scoreboard-2026-11-22.json"], // 5 final (one in OT), 2 live
  [/\/scoreboard\?dates=20261124$/, "scoreboard-2026-11-24.json"], // scheduled
  // Recorded 2026-11-23 about 10:40 pm ET: 6 final, 4 live (one in overtime, one at the end of the 1st). Trimmed of
  // links, headlines and broadcasts.
  [/\/scoreboard\?dates=20261123$/, "scoreboard-2026-11-23.json"],
  [/\/summary\?event=401910043$/, "summary-401910043-live.json"], // LAC at HOU, 4:10 left in the 4th (same time)
  [/\/standings\?level=3$/, "standings-now.json"],
  [/\/summary\?event=401910032$/, "summary-401910032-final.json"], // DEN won 151-145 at CHI in OT
  [/\/summary\?event=401909314$/, "summary-401909314-pre.json"], // DET at ORL, scheduled
  [/\/teams\/DEN\/athletes\/statistics$/, "team-DEN-athletes-statistics.json"],
  [/\/teams\/DEN\/schedule$/, "team-DEN-schedule.json"], // the 2026-27 regular season, 15 games played
  // Players, recorded 2026-11-23: Jamal Murray (ten seasons, playoffs) and Alpha Diallo (rookie, undrafted).
  [/\/athletes\/3936299\?region=us&lang=en$/, "athlete-3936299.json"],
  [/\/athletes\/3936299\/stats\?region=us&lang=en$/, "athlete-3936299-stats.json"],
  [/\/athletes\/3936299\/stats\?region=us&lang=en&seasontype=3$/, "athlete-3936299-stats-playoffs.json"],
  [/\/athletes\/3936299\/gamelog\?region=us&lang=en$/, "athlete-3936299-gamelog.json"],
  [/\/athletes\/4065813\?region=us&lang=en$/, "athlete-4065813.json"],
  [/\/athletes\/4065813\/stats\?region=us&lang=en(&seasontype=3)?$/, "athlete-4065813-stats.json"],
  [/\/athletes\/4065813\/gamelog\?region=us&lang=en$/, "athlete-4065813-gamelog.json"],
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
    // Not built yet: special events, spotlight and play-by-play.
    gameIds: ["401910032", "401909314"],
    teamIds: ["DEN"],
    playerIds: ["3936299", "4065813"],
    playGameIds: [],
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
    await adapter.getPlayer("3936299");
    await adapter.getPlayer("4065813");
    expect(warnings).toEqual([]);
  });

  it("has game, team and player pages, and none of the other optional features yet", () => {
    const adapter = new NbaAdapter() as unknown as Record<string, unknown>;
    for (const method of ["getGameDetail", "getTeam", "getPlayer"]) {
      expect(adapter[method], method).toBeTypeOf("function");
    }
    for (const method of ["getSpecialEvents", "getSpotlight"]) {
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

    it("gives live and final games each quarter's points and the top scorer", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-23");
      const overtime = byMatchup(games, "PHX", "NO");
      expect(overtime).toMatchObject({ status: "live", clock: { period: 5, label: "OT", timeRemaining: "1:03" } });
      expect(overtime.periods).toEqual([
        { label: "Q1", away: 31, home: 35 },
        { label: "Q2", away: 25, home: 19 },
        { label: "Q3", away: 23, home: 29 },
        { label: "Q4", away: 30, home: 26 },
        { label: "OT", away: 10, home: 5 },
      ]);
      // Poole leads with 28; ESPN's line for him is his points alone.
      expect(overtime.standout).toEqual({ name: "J. Poole", teamId: "NO", line: "28 PTS" });
      // Garland outscores Durant, and his line has his assists too.
      expect(byMatchup(games, "LAC", "HOU").standout).toEqual({
        name: "D. Garland",
        teamId: "LAC",
        line: "26 PTS, 6 AST",
      });

      const endOfFirst = byMatchup(games, "UTAH", "LAL");
      expect(endOfFirst.clock).toEqual({ period: 1, label: "End Q1" });
      expect(endOfFirst.periods).toEqual([{ label: "Q1", away: 20, home: 30 }]);

      const finals = await fixtureAdapter().adapter.getScores("2026-11-22");
      expect(byMatchup(finals, "DEN", "CHI").periods?.map((p) => p.label)).toEqual(["Q1", "Q2", "Q3", "Q4", "OT"]);
      for (const game of await fixtureAdapter().adapter.getScores("2026-11-24")) {
        expect(game.periods).toBeUndefined();
        expect(game.standout).toBeUndefined();
      }
    });

    it("leaves out quarters that do not add up to the score, and a game without leaders has no standout", async () => {
      const { adapter, warnings } = fixtureAdapter((url, body) => {
        if (!url.includes("scoreboard")) return;
        const competitors = body.events.find((e: any) => e.id === "401910043").competitions[0].competitors;
        competitors[0].linescores[1].value += 1;
        for (const c of competitors) delete c.leaders;
      });
      const game = byMatchup(await adapter.getScores("2026-11-23"), "LAC", "HOU");
      expect(game.status).toBe("live");
      expect(game.periods).toBeUndefined();
      expect(game.standout).toBeUndefined();
      expect(warnings).toEqual([]);
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

    it("maps a live game page: quarter, clock, score and box score", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("401910043");
      expect(detail.game).toMatchObject({
        status: "live",
        clock: { period: 4, label: "Q4", timeRemaining: "4:10" },
        away: { team: { id: "LAC" }, score: 95 },
        home: { team: { id: "HOU" }, score: 103 },
      });
      expect(detail.boxscore.away.flatMap((t) => t.rows).length).toBeGreaterThan(5);
      expect(detail.boxscore.home.flatMap((t) => t.rows).length).toBeGreaterThan(5);
    });

    // The live page above has a period and clock; this edits the final one to check another quarter.
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

  describe("player page", () => {
    it("maps the bio: number, position, team, birth date and place, size in both systems, draft", async () => {
      const d = await fixtureAdapter().adapter.getPlayer("3936299");
      expect(d.player).toMatchObject({ id: "3936299", name: "Jamal Murray", teamId: "DEN", position: "G" });
      expect(d.positionName).toBe("Guard");
      expect(d.sweaterNumber).toBe(27);
      expect(d.team).toMatchObject({ id: "DEN", name: "Denver Nuggets" });
      expect(d.active).toBe(true);
      expect(d.goalie).toBe(false);
      expect(d.bio).toEqual({
        birthDate: "1997-02-23",
        birthPlace: "Kitchener, ON",
        heightIn: 76,
        heightCm: 193,
        weightLb: 215,
        weightKg: 98,
        draft: { year: 2016, round: 1, overallPick: 7, teamId: "DEN" },
      });
    });

    it("has this season's averages, the career and every season, regular season and playoffs", async () => {
      const d = await fixtureAdapter().adapter.getPlayer("3936299");
      expect(d.seasonLabel).toBe("2026-27");
      expect(d.season).toEqual([
        { value: "24.9", label: "PTS" },
        { value: "5.0", label: "REB" },
        { value: "5.8", label: "AST" },
        { value: "50.2", label: "FG%" },
      ]);
      expect(d.career.regularSeason).toEqual([
        { value: "625", label: "GP" },
        { value: "19.0", label: "PTS" },
        { value: "3.9", label: "REB" },
        { value: "5.0", label: "AST" },
      ]);
      expect(d.career.playoffs.map((i) => i.label)).toEqual(["GP", "PTS", "REB", "AST"]);
      expect(d.career.playoffs[0].value).toBe("85");

      const regular = d.seasons.rows.filter((r) => !r.playoffs);
      expect(regular).toHaveLength(10);
      expect(regular[0]).toMatchObject({ season: "2026-27", team: "Nuggets", league: "NBA", inLeague: true });
      expect(regular[0].values).toMatchObject({ gamesPlayed: "14", avgPoints: "24.9" });
      expect(regular.at(-1)?.season).toBe("2016-17"); // newest first
      expect(d.seasons.rows.filter((r) => r.playoffs).length).toBeGreaterThan(0);
      expect(d.seasons.columns.map((c) => c.label)).toEqual([
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
    });

    it("lists the last five games, newest first, on the league's date", async () => {
      const d = await fixtureAdapter().adapter.getPlayer("3936299");
      expect(d.lastGames.columns.map((c) => c.label)).toEqual(["MIN", "PTS", "REB", "AST", "FG", "3PT", "STL", "BLK"]);
      expect(d.lastGames.games).toHaveLength(5);
      // 7 pm ET on Nov 22 is midnight UTC on Nov 23: the game is on the 22nd.
      expect(d.lastGames.games[0]).toEqual({
        gameId: "401910032",
        date: "2026-11-22",
        teamId: "DEN",
        opponentId: "CHI",
        home: false,
        values: {
          minutes: "45",
          points: "45",
          totalRebounds: "5",
          assists: "7",
          "fieldGoalsMade-fieldGoalsAttempted": "13-22",
          "threePointFieldGoalsMade-threePointFieldGoalsAttempted": "6-11",
          steals: "3",
          blocks: "2",
        },
      });
      const dates = d.lastGames.games.map((g) => g.date);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    it("maps a rookie: undrafted, no playoffs, and asks for no playoff stats", async () => {
      const { adapter, urls } = fixtureAdapter();
      const d = await adapter.getPlayer("4065813");
      expect(d.player.name).toBe("Alpha Diallo");
      expect(d.positionName).toBe("Forward");
      expect(d.bio.draft).toBeUndefined();
      expect(d.career.playoffs).toEqual([]);
      expect(d.seasons.rows.every((r) => !r.playoffs)).toBe(true);
      expect(urls.some((u) => u.includes("seasontype=3"))).toBe(false);
    });

    // ESPN answers a playoffs request for a player without any with the regular season (recorded for Diallo).
    it("ignores a playoffs answer that holds the regular season", async () => {
      const { adapter } = fixtureAdapter((url, body) => {
        if (url.includes("4065813/stats")) {
          body.filters.find((f: any) => f.name === "seasontype").options.push({ value: "3" });
        }
      });
      const d = await adapter.getPlayer("4065813");
      expect(d.career.playoffs).toEqual([]);
      expect(d.seasons.rows.filter((r) => r.playoffs)).toEqual([]);
      expect(d.seasons.rows.filter((r) => !r.playoffs)).toHaveLength(1);
    });

    it("names positions in Canadian spelling and sentence case", () => {
      expect(positionName("Center")).toBe("Centre");
      expect(positionName("Point Guard")).toBe("Point guard");
      expect(positionName("Forward-Center")).toBe("Forward-centre");
    });

    it("reads month-first birth dates and the draft line, and nothing else", () => {
      expect(birthDate("2/23/1997")).toBe("1997-02-23");
      expect(birthDate("23/2/1997")).toBeUndefined();
      expect(birthDate(undefined)).toBeUndefined();
      expect(draft("2014: Rd 2, Pk 41 (DEN)")).toEqual({ year: 2014, round: 2, overallPick: 41, teamId: "DEN" });
      expect(draft("Undrafted")).toBeUndefined();
    });

    it("still shows the bio when the stats and game log fail, with a warning each", async () => {
      const warnings: AdapterWarning[] = [];
      const adapter = new NbaAdapter({
        fetch: async (input) => {
          const url = String(input);
          if (/\/(stats|gamelog)\?/.test(url)) return new Response("down", { status: 503 });
          return new Response(JSON.stringify(fixtureFor(url)));
        },
        onWarning: (w) => warnings.push(w),
      });
      const d = await adapter.getPlayer("3936299");
      expect(d.bio.birthDate).toBe("1997-02-23");
      expect(d.season).toHaveLength(4); // from the athlete itself
      expect(d.seasons.rows).toEqual([]);
      expect(d.career).toEqual({ regularSeason: [], playoffs: [] });
      expect(d.lastGames.games).toEqual([]);
      expect(warnings.map((w) => w.message).sort()).toEqual([
        "last games left out: NBA API returned 503",
        "season stats left out: NBA API returned 503",
      ]);
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
