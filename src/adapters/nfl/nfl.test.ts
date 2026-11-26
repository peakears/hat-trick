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
  // Game summaries, recorded at 1:53 pm ET: CHI at DET in the 2nd quarter (DET 10-3, 10:52 left).
  [/\/summary\?event=401873079$/, "summary-401873079-final.json"], // GB 13 at LAR 26
  [/\/summary\?event=401873081$/, "summary-401873081-live.json"], // CHI at DET, live
  [/\/summary\?event=401873082$/, "summary-401873082-pre.json"], // KC at BUF, scheduled
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
    // Not built yet: team and player pages, play-by-play, special events and spotlight.
    gameIds: ["401873079", "401873081", "401873082"],
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
    for (const id of ["401873079", "401873081", "401873082"]) await adapter.getGameDetail(id);
    expect(warnings).toEqual([]);
  });

  it("names the league and its words, and has game pages but none of the other optional features yet", () => {
    const adapter = new NflAdapter();
    expect(adapter).toMatchObject({
      league: "nfl",
      name: "National Football League",
      gameStartTerm: "Kickoff",
      liveAlerts: { kind: "lateLeadChanges", regulationPeriods: 4 },
    });
    const methods = adapter as unknown as Record<string, unknown>;
    expect(methods.getGameDetail).toBeTypeOf("function");
    for (const method of ["getPlays", "getTeam", "getPlayer", "getSpecialEvents", "getSpotlight"]) {
      expect(methods[method], method).toBeUndefined();
    }
  });

  it("builds the expected endpoint URLs", async () => {
    const { adapter, urls } = fixtureAdapter();
    await adapter.getScores("2026-11-26");
    await adapter.getStandings();
    await adapter.getLeaders({ category: "defensiveInterceptions.interceptions", limit: 5 });
    await adapter.getGameDetail("401873079");
    expect(urls).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261126",
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3",
      "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=5&sort=defensiveInterceptions.interceptions:desc",
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873079",
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

  describe("game page", () => {
    it("maps a final game's score card: scores, quarters, stadium and attendance", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("401873079");
      expect(detail.game).toMatchObject({
        id: "401873079",
        status: "final",
        endedIn: "regulation",
        away: { team: { id: "GB", name: "Green Bay Packers" }, score: 13 },
        home: { team: { id: "LAR", logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png" }, score: 26 },
        venue: { name: "SoFi Stadium", city: "Inglewood" },
      });
      // The record is the one before the game, so a finished game has none.
      expect(detail.game.away.record).toBeUndefined();
      expect(detail.game.periods?.map((p) => [p.label, p.away, p.home])).toEqual([
        ["Q1", 3, 6],
        ["Q2", 10, 7],
        ["Q3", 0, 7],
        ["Q4", 0, 6],
      ]);
      expect(detail.attendance).toBe(75211);
    });

    it("has a box score table per stat group, with ESPN's columns", async () => {
      const { boxscore } = await fixtureAdapter().adapter.getGameDetail("401873079");
      expect(boxscore.away.map((t) => t.title)).toEqual([
        "Passing",
        "Rushing",
        "Receiving",
        "Defence",
        "Interceptions",
        "Fumbles",
        "Kicking",
        "Punting",
        "Kick returns",
        "Punt returns",
      ]);
      const [passing] = boxscore.away;
      expect(passing.columns.map((c) => c.label)).toEqual(["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "QBR", "RTG"]);
      expect(passing.rows).toHaveLength(1);
      expect(passing.rows[0].player).toMatchObject({ name: "Jordan Love", teamId: "GB", league: "nfl" });
      expect(passing.rows[0].values).toMatchObject({ "completions/passingAttempts": "17/29", passingYards: "198" });
      expect(boxscore.home[0].rows[0].player.name).toBe("Matthew Stafford");
    });

    it("compares the teams, with bars only for plain numbers", async () => {
      const { teamStats } = await fixtureAdapter().adapter.getGameDetail("401873079");
      expect(teamStats?.map((s) => s.label)).toEqual([
        "Total yards",
        "Passing yards",
        "Rushing yards",
        "1st downs",
        "3rd down",
        "4th down",
        "Red zone",
        "Turnovers",
        "Sacks allowed",
        "Penalties",
        "Time of possession",
      ]);
      const line = (label: string) => teamStats!.find((s) => s.label === label);
      expect(line("Total yards")).toEqual({
        label: "Total yards",
        away: "244",
        home: "373",
        awayValue: 244,
        homeValue: 373,
      });
      expect(line("3rd down")).toEqual({ label: "3rd down", away: "2-8", home: "8-15" });
      expect(line("Time of possession")).toEqual({ label: "Time of possession", away: "19:20", home: "40:40" });
    });

    it("picks each team's top performer by yards: passing, rushing or receiving", async () => {
      const { performers } = await fixtureAdapter().adapter.getGameDetail("401873079");
      expect(performers).toEqual([
        {
          teamId: "GB",
          line: "17/29, 198 YDS, 1 TD, 2 INT",
          player: expect.objectContaining({ id: "4036378", name: "Jordan Love", position: "QB", teamId: "GB" }),
        },
        // Blake Corum's 184 rushing yards beat Matthew Stafford's 140 passing.
        {
          teamId: "LAR",
          line: "32 CAR, 184 YDS, 1 TD",
          player: expect.objectContaining({ name: "Blake Corum", position: "RB", headshotUrl: expect.any(String) }),
        },
      ]);
    });

    it("lists every score in order, as plays with the score after them", async () => {
      const { scoringPlays } = await fixtureAdapter().adapter.getGameDetail("401873079");
      expect(scoringPlays).toHaveLength(9);
      expect(scoringPlays![0]).toEqual({
        id: expect.any(String),
        period: 1,
        periodLabel: "Q1",
        time: "9:55",
        kind: "score",
        teamId: "LAR",
        text: "Brandon McManus 43 Yd Field Goal",
        tag: "Field goal",
        awayScore: 0,
        homeScore: 3,
      });
      expect(scoringPlays![3]).toMatchObject({
        periodLabel: "Q2",
        text: "Kyren Williams 7 Yd Rush (Brandon McManus Kick)",
        tag: "Touchdown",
      });
      // ESPN's text can end in a space; it is trimmed.
      expect(scoringPlays![8]).toMatchObject({
        text: "Brandon McManus 30 Yd Field Goal",
        awayScore: 13,
        homeScore: 26,
      });
    });

    it("maps a live game: the clock, the quarters to come, and what has happened so far", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("401873081");
      expect(detail.game).toMatchObject({
        status: "live",
        clock: { period: 2, label: "Q2", timeRemaining: "10:52" },
        away: { team: { id: "CHI" }, score: 3 },
        home: { team: { id: "DET" }, score: 10 },
      });
      expect(detail.game.periods?.map((p) => [p.label, p.away, p.home])).toEqual([
        ["Q1", 0, 3],
        ["Q2", 3, 7],
        ["Q3", null, null],
        ["Q4", null, null],
      ]);
      expect(detail.scoringPlays?.map((p) => [p.time, p.teamId, p.tag])).toEqual([
        ["11:28", "DET", "Field goal"],
        ["12:51", "DET", "Touchdown"],
        ["10:52", "CHI", "Field goal"],
      ]);
      expect(detail.performers?.map((p) => p.player.name)).toEqual(["Caleb Williams", "Jared Goff"]);
      expect(detail.boxscore.home.length).toBeGreaterThan(0);
      expect(detail.attendance).toBeUndefined();
    });

    it("gives a scheduled game the records, and none of the season's stats or leaders", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("401873082");
      expect(detail.game).toMatchObject({
        status: "scheduled",
        away: { team: { id: "KC" }, score: null, record: "8-2" },
        home: { team: { id: "BUF" }, score: null, record: "9-1" },
        venue: { name: "Highmark Stadium" },
      });
      expect(detail.boxscore).toEqual({ away: [], home: [] });
      for (const key of ["teamStats", "performers", "scoringPlays", "periods", "attendance"]) {
        expect(detail, key).not.toHaveProperty(key);
      }
    });

    it("still shows the game when the box score, leaders or scoring plays are malformed", async () => {
      const { adapter, warnings } = fixtureAdapter((url, body) => {
        if (!url.includes("summary")) return;
        body.boxscore = "nope";
        body.leaders[0].leaders = 7;
        body.scoringPlays[0].awayScore = "three";
      });
      const detail = await adapter.getGameDetail("401873079");
      expect(detail.game.home.score).toBe(26);
      expect(detail.boxscore).toEqual({ away: [], home: [] });
      expect(detail.teamStats).toBeUndefined();
      expect(detail.performers?.map((p) => p.teamId)).toEqual(["GB"]);
      expect(detail.scoringPlays).toHaveLength(8);
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });

    it("fails without the header's teams", async () => {
      const { adapter } = fixtureAdapter((url, body) => body.header.competitions[0].competitors.pop());
      await expect(adapter.getGameDetail("401873079")).rejects.toBeInstanceOf(NflResponseError);
    });
  });

  it("reports a failed request as an NflApiError", async () => {
    const adapter = new NflAdapter({ fetch: async () => new Response("nope", { status: 503 }) });
    await expect(adapter.getStandings()).rejects.toBeInstanceOf(NflApiError);
  });
});
