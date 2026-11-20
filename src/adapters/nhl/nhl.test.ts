import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLeagueAdapterContract } from "../../contract/league-adapter.contract";
import { NhlAdapter, NhlApiError, NhlResponseError, type AdapterWarning } from ".";

// Real responses recorded from api-web.nhle.com on 2026-11-17.
const FIXTURES: [RegExp, string][] = [
  [/\/score\/2026-11-17$/, "score-2026-11-17.json"], // final + live games
  [/\/score\/2026-11-18$/, "score-2026-11-18.json"], // scheduled games
  [/\/standings\/now$/, "standings-now.json"],
  [/\/skater-stats-leaders\//, "skater-leaders.json"],
  [/\/goalie-stats-leaders\//, "goalie-leaders.json"],
  [/\/gamecenter\/2026020342\/boxscore$/, "boxscore-2026020342-live.json"],
  [/\/gamecenter\/2026020333\/boxscore$/, "boxscore-2026020333-final.json"],
];

function loadFixture(file: string): any {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${file}`, import.meta.url), "utf8"));
}

function fixtureFor(url: string): any {
  const hit = FIXTURES.find(([pattern]) => pattern.test(url.split("?")[0]));
  if (!hit) throw new Error(`No fixture for ${url}`);
  return loadFixture(hit[1]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** An adapter served from fixtures. `edit` lets a test change a response to simulate API drift. */
function fixtureAdapter(edit?: (url: string, body: any) => void) {
  const warnings: AdapterWarning[] = [];
  const urls: string[] = [];
  const adapter = new NhlAdapter({
    fetch: async (input) => {
      const url = String(input);
      urls.push(url);
      const body = fixtureFor(url);
      edit?.(url, body);
      return jsonResponse(body);
    },
    onWarning: (w) => warnings.push(w),
  });
  return { adapter, warnings, urls };
}

// ---------- Shared contract ----------

runLeagueAdapterContract({
  name: "NHL",
  league: "nhl",
  makeAdapter: () => fixtureAdapter().adapter,
  makeFailingAdapter: () =>
    new NhlAdapter({
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    }),
  inputs: {
    scoreDates: ["2026-11-17", "2026-11-18"],
    gameIds: ["2026020342", "2026020333"],
    leaderQueries: [{}, { category: "goals", limit: 3 }, { category: "savePctg" }, { category: "goalsAgainstAverage" }],
  },
});

// ---------- NHL-specific behavior ----------

describe("NHL adapter", () => {
  it("parses every recorded response with no warnings", async () => {
    const { adapter, warnings } = fixtureAdapter();
    await adapter.getScores("2026-11-17");
    await adapter.getScores("2026-11-18");
    await adapter.getStandings();
    await adapter.getLeaders();
    await adapter.getLeaders({ category: "wins" });
    await adapter.getGameDetail("2026020342");
    await adapter.getGameDetail("2026020333");
    expect(warnings).toEqual([]);
  });

  it("builds the expected endpoint URLs", async () => {
    const { adapter, urls } = fixtureAdapter();
    await adapter.getScores("2026-11-17");
    await adapter.getLeaders();
    await adapter.getLeaders({ category: "savePctg", limit: 5 });
    expect(urls).toEqual([
      "https://api-web.nhle.com/v1/score/2026-11-17",
      "https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=goals,assists,points&limit=10",
      "https://api-web.nhle.com/v1/goalie-stats-leaders/current?categories=savePctg&limit=5",
    ]);
  });

  describe("games", () => {
    it("maps a live game in intermission without a period clock", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-17");
      const live = games.find((g) => g.id === "2026020342")!;
      expect(live.status).toBe("live");
      expect(live.clock).toEqual({
        period: 1,
        label: "1st",
        intermission: true,
        intermissionRemaining: "03:05",
      });
    });

    it("maps a final game", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-17");
      const game = games.find((g) => g.id === "2026020333")!;
      expect(game).toMatchObject({
        status: "final",
        endedIn: "regulation",
        startTime: "2026-11-18T00:00:00Z",
        home: { team: { id: "BOS", name: "Bruins" }, score: 0 },
        away: { team: { id: "LAK", name: "Kings" }, score: 3 },
      });
    });

    it.each([
      ["OT", "overtime"],
      ["SO", "shootout"],
    ] as const)("maps a final game decided by %s", async (periodType, expected) => {
      const { adapter } = fixtureAdapter((_url, body) => {
        body.games[0].gameOutcome = { lastPeriodType: periodType };
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.endedIn).toBe(expected);
    });

    it("maps each team's season record on a game that has not started", async () => {
      const [game] = await fixtureAdapter().adapter.getScores("2026-11-18");
      expect(game.away.record).toBe("13-7-1");
      expect(game.home.record).toBe("8-10-3");
    });

    it("has no record on a game that has started, where the API sends none", async () => {
      const final = (await fixtureAdapter().adapter.getScores("2026-11-17")).find((g) => g.status === "final")!;
      expect(final.home.record).toBeUndefined();
      expect(final.away.record).toBeUndefined();
    });

    it("maps a scheduled game with no score", async () => {
      const [game] = await fixtureAdapter().adapter.getScores("2026-11-18");
      expect(game.status).toBe("scheduled");
      expect(game.home.score).toBeNull();
      expect(game.away.score).toBeNull();
    });

    it.each([
      ["FUT", "scheduled"],
      ["PRE", "scheduled"],
      ["LIVE", "live"],
      ["CRIT", "live"],
      ["FINAL", "final"],
      ["OFF", "final"],
      ["PPD", "postponed"],
      ["SUSP", "postponed"],
      ["SOMETHING_NEW", "scheduled"],
    ])("maps game state %s to %s", async (state, expected) => {
      const { adapter } = fixtureAdapter((_url, body) => {
        body.games[0].gameState = state;
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.status).toBe(expected);
    });
  });

  describe("TV broadcasts", () => {
    it("maps channels with their country and market, in the league's order", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-17");
      const edmFla = games.find((g) => g.away.team.id === "EDM")!;
      expect(edmFla.broadcasts).toEqual([
        { network: "SN", country: "CA", market: "national" },
        { network: "TVAS", country: "CA", market: "national" },
        { network: "SCRIPPS", country: "US", market: "home" },
      ]);
    });

    it("trims network names", async () => {
      const games = await fixtureAdapter().adapter.getScores("2026-11-17");
      const lakBos = games.find((g) => g.away.team.id === "LAK")!;
      expect(lakBos.broadcasts).toEqual([
        { network: "ABTV", country: "US", market: "away" },
        { network: "NESN", country: "US", market: "home" },
      ]);
    });

    it("includes the channels in the box score's game", async () => {
      const { game } = await fixtureAdapter().adapter.getGameDetail("2026020333");
      expect(game.broadcasts?.map((b) => b.network)).toEqual(["ABTV", "NESN"]);
    });

    it("leaves broadcasts absent when the API sends none", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        delete body.games[0].tvBroadcasts;
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.broadcasts).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    it("drops a broken listing or an unknown market and keeps the rest, with a warning for the broken one", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        body.games[0].tvBroadcasts = [
          { id: 1, market: "N", countryCode: "US", network: "TNT", sequenceNumber: 1 },
          { id: 2, market: "N", countryCode: "US" },
          { id: 3, market: "X", countryCode: "US", network: "MYSTERY", sequenceNumber: 3 },
          { id: 4, market: "N", countryCode: "US", network: "TNT ", sequenceNumber: 4 },
        ];
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.broadcasts).toEqual([{ network: "TNT", country: "US", market: "national" }]);
      expect(warnings.map((w) => w.message)).toEqual([expect.stringContaining("tvBroadcasts[1] dropped")]);
    });

    it("never fails the scores when tvBroadcasts has the wrong type", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        body.games[0].tvBroadcasts = "TNT";
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.broadcasts).toBeUndefined();
      expect(warnings.some((w) => w.message.startsWith("tvBroadcasts:"))).toBe(true);
    });
  });

  describe("venue", () => {
    it("has the arena in the scores list, without a city", async () => {
      const [game] = await fixtureAdapter().adapter.getScores("2026-11-17");
      expect(game.venue).toEqual({ name: "TD Garden", city: undefined });
    });

    it("has the arena and city in the box score", async () => {
      const { adapter } = fixtureAdapter();
      expect((await adapter.getGameDetail("2026020333")).game.venue).toEqual({ name: "TD Garden", city: "Boston" });
      expect((await adapter.getGameDetail("2026020342")).game.venue).toEqual({
        name: "T-Mobile Arena",
        city: "Paradise",
      });
    });

    it("leaves the venue out when the API sends none", async () => {
      const { adapter } = fixtureAdapter((_url, body) => {
        if (body.games) delete body.games[0].venue;
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.venue).toBeUndefined();
    });
  });

  describe("goal summary", () => {
    it("lists a final game's goals in the order scored", async () => {
      const { goals } = await fixtureAdapter().adapter.getGameDetail("2026020333");
      expect(goals).toHaveLength(3);
      expect(goals!.map((g) => [g.teamId, g.periodLabel, g.time])).toEqual([
        ["LAK", "1st", "15:46"],
        ["LAK", "2nd", "16:35"],
        ["LAK", "3rd", "16:53"],
      ]);
      expect(goals![0].scorer).toMatchObject({ id: "8475692", name: "M. Zuccarello", teamId: "LAK" });
      expect(goals![0].assists.map((a) => a.name)).toEqual(["E. Gustafsson", "B. Clarke"]);
      expect([goals![0].awayScore, goals![0].homeScore]).toEqual([1, 0]);
    });

    it("tags empty-net and power-play goals", async () => {
      const { goals } = await fixtureAdapter().adapter.getGameDetail("2026020333");
      expect(goals![2]).toMatchObject({ emptyNet: true, strength: "even", penaltyShot: false });
      const { adapter } = fixtureAdapter((_url, body) => {
        if (body.games) body.games.find((g: any) => g.id === 2026020333).goals[0].strength = "pp";
      });
      expect((await adapter.getGameDetail("2026020333")).goals![0].strength).toBe("powerPlay");
    });

    it("reads the goals from the scores response for the game's date", async () => {
      const { adapter, urls } = fixtureAdapter();
      await adapter.getGameDetail("2026020333");
      expect(urls).toEqual([
        "https://api-web.nhle.com/v1/gamecenter/2026020333/boxscore",
        "https://api-web.nhle.com/v1/score/2026-11-17",
      ]);
    });

    it("works for a live game", async () => {
      const { goals } = await fixtureAdapter().adapter.getGameDetail("2026020342");
      expect(goals).toBeDefined();
    });

    it("still returns the game when the scores call fails", async () => {
      const adapter = new NhlAdapter({
        fetch: async (input) => {
          const url = String(input);
          if (url.includes("/score/")) throw new TypeError("Network request failed");
          return jsonResponse(fixtureFor(url));
        },
      });
      const detail = await adapter.getGameDetail("2026020333");
      expect(detail.game.id).toBe("2026020333");
      expect(detail.goals).toBeUndefined();
    });

    it("drops one broken goal without failing the game", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        if (body.games) delete body.games.find((g: any) => g.id === 2026020333).goals[1].playerId;
      });
      const { goals } = await adapter.getGameDetail("2026020333");
      expect(goals).toHaveLength(2);
      expect(warnings.some((w) => w.message.includes("goals[1] dropped"))).toBe(true);
    });

    it("treats a missing assists list as unassisted", async () => {
      const { adapter } = fixtureAdapter((_url, body) => {
        if (body.games) delete body.games.find((g: any) => g.id === 2026020333).goals[0].assists;
      });
      expect((await adapter.getGameDetail("2026020333")).goals![0].assists).toEqual([]);
    });
  });

  describe("box scores", () => {
    it("leaves out stats a backup goalie does not have", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("2026020333");
      const goalies = detail.boxscore.home.find((t) => t.title === "Goalies")!;
      const backup = goalies.rows.find((r) => r.player.name === "J. Swayman")!;
      const starter = goalies.rows.find((r) => r.player.name === "M. DiPietro")!;
      expect(backup.values).not.toHaveProperty("savePctg");
      expect(starter.values.savePctg).toBeCloseTo(0.905, 3);
    });

    it("splits each side into forwards, defense and goalies", async () => {
      const detail = await fixtureAdapter().adapter.getGameDetail("2026020333");
      expect(detail.boxscore.home.map((t) => [t.title, t.rows.length])).toEqual([
        ["Forwards", 12],
        ["Defense", 6],
        ["Goalies", 2],
      ]);
    });
  });

  describe("standings", () => {
    it("groups by division with common team names", async () => {
      const standings = await fixtureAdapter().adapter.getStandings();
      expect(standings.groups.map((g) => g.name)).toEqual(["Pacific", "Central", "Metropolitan", "Atlantic"]);
      expect(standings.groups[0].rows[0]).toMatchObject({
        team: { id: "EDM", name: "Oilers" },
        rank: 1,
        streak: "W6",
      });
    });
  });

  describe("leaders", () => {
    it("gives tied values the same rank", async () => {
      const boards = await fixtureAdapter().adapter.getLeaders();
      const assists = boards.find((b) => b.category === "assists")!;
      expect(assists.entries.map((e) => [e.rank, e.value])).toEqual([
        [1, 42],
        [2, 25],
        [2, 25],
      ]);
    });
  });

  // ---------- API drift ----------

  describe("API drift", () => {
    it("drops a minor field with the wrong type and warns", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        body.playerByGameStats.homeTeam.goalies[1].savePctg = ".905";
      });
      const detail = await adapter.getGameDetail("2026020333");
      const goalies = detail.boxscore.home.find((t) => t.title === "Goalies")!;
      expect(goalies.rows[1].values).not.toHaveProperty("savePctg");
      expect(goalies.rows[1].values.saves).toBe(19);
      expect(warnings.map((w) => w.message)).toEqual(['savePctg: unexpected value ".905" (string), ignored']);
    });

    it("treats a null minor field as absent, without a warning", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        body.games[0].venue = null;
        body.games[0].homeTeam.logo = null;
      });
      const [game] = await adapter.getScores("2026-11-17");
      expect(game.home.team.logoUrl).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    it("drops a broken box score row and keeps the rest", async () => {
      const { adapter, warnings } = fixtureAdapter((_url, body) => {
        delete body.playerByGameStats.homeTeam.forwards[0].playerId;
      });
      const detail = await adapter.getGameDetail("2026020333");
      expect(detail.boxscore.home[0].rows).toHaveLength(11);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toMatch(/^forwards\[0\] dropped: .*playerId/);
    });

    it.each([
      [
        "team abbrev renamed",
        "games[0].homeTeam.abbrev",
        (b: any) => {
          b.games[0].homeTeam.teamAbbrev = b.games[0].homeTeam.abbrev;
          delete b.games[0].homeTeam.abbrev;
        },
      ],
      [
        "score is a string",
        "games[0].homeTeam.score",
        (b: any) => {
          b.games[0].homeTeam.score = "3";
        },
      ],
      [
        "game id missing",
        "games[0].id",
        (b: any) => {
          delete b.games[0].id;
        },
      ],
    ])("throws NhlResponseError when a core field breaks: %s", async (_name, path, edit) => {
      const { adapter } = fixtureAdapter((_url, body) => edit(body));
      const error = await adapter.getScores("2026-11-17").catch((e) => e);
      expect(error).toBeInstanceOf(NhlResponseError);
      expect(error.url).toBe("https://api-web.nhle.com/v1/score/2026-11-17");
      expect(error.message).toContain(path);
    });

    it("throws NhlResponseError when standings lose a core field", async () => {
      const { adapter } = fixtureAdapter((_url, body) => {
        delete body.standings[0].wins;
      });
      await expect(adapter.getStandings()).rejects.toBeInstanceOf(NhlResponseError);
    });
  });

  // ---------- Transport errors ----------

  describe("transport errors", () => {
    it("wraps an HTTP error status", async () => {
      const adapter = new NhlAdapter({ fetch: async () => jsonResponse({}, 503) });
      const error = await adapter.getStandings().catch((e) => e);
      expect(error).toBeInstanceOf(NhlApiError);
      expect(error.status).toBe(503);
    });

    it("wraps a body that is not JSON", async () => {
      const adapter = new NhlAdapter({ fetch: async () => new Response("<html>down</html>") });
      const error = await adapter.getStandings().catch((e) => e);
      expect(error).toBeInstanceOf(NhlApiError);
      expect(error.message).toMatch(/invalid JSON/);
    });

    it("wraps a network failure", async () => {
      const adapter = new NhlAdapter({
        fetch: async () => {
          throw new TypeError("Network request failed");
        },
      });
      await expect(adapter.getScores("2026-11-17")).rejects.toThrow(/NHL API request failed/);
    });

    it("times out a request that never answers, without AbortSignal.timeout (missing in Hermes)", async () => {
      const original = AbortSignal.timeout;
      // @ts-expect-error simulate React Native, where AbortSignal.timeout does not exist
      AbortSignal.timeout = undefined;
      try {
        const adapter = new NhlAdapter({
          timeoutMs: 10,
          fetch: (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
            }),
        });
        await expect(adapter.getStandings()).rejects.toThrow("NHL API request failed: timed out after 10 ms");
      } finally {
        AbortSignal.timeout = original;
      }
    });
  });
});
