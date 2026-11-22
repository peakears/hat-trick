import { describe, expect, it } from "vitest";
import type { DataMeta } from "../data";
import type { Game, GameStatus, Goal, Standings } from "../domain";
import {
  assistsLabel,
  gameGoalTag,
  goalTags,
  groupGoalsByPeriod,
  scoreAfterLabel,
  scorerGameGoalNumbers,
  scorerLabel,
  seasonGoalLabel,
} from "./goals";
import {
  addDays,
  dateLabel,
  dateToPickerValue,
  gameStatusLabel,
  groupGamesForScores,
  localDate,
  pickerValueToDate,
  recordLabel,
  scoresToday,
  sortGamesForScores,
  statValue,
  teamRecord,
  venueLabel,
  winner,
} from "./format";
import { POLL, REFRESH_COOLDOWN_MS, canManualRefresh, combineFetched, nextPollDelay } from "./polling";
import { isHorizontalDrag, swipeDayStep } from "./swipe";

const NOW = Date.parse("2026-11-17T23:00:00Z");

function game(status: GameStatus, extra: Partial<Game> = {}, scores: [number | null, number | null] = [3, 2]): Game {
  const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });
  return {
    id: "1",
    league: "nhl",
    startTime: "2026-11-18T00:00:00Z",
    status,
    home: { team: team("TOR"), score: scores[0] },
    away: { team: team("MTL"), score: scores[1] },
    ...extra,
  };
}

function meta(overrides: Partial<DataMeta> = {}): DataMeta {
  return {
    league: "nhl",
    key: "nhl:scores:2026-11-17",
    source: "network",
    fetchedAt: new Date(NOW).toISOString(),
    staleAt: new Date(NOW + 20_000).toISOString(),
    stale: false,
    warnings: [],
    ...overrides,
  };
}

describe("dates", () => {
  it("formats a local calendar date", () => {
    expect(localDate(new Date(2026, 10, 17, 23, 59))).toBe("2026-11-17");
    expect(localDate(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // US DST ends
  });

  it("keeps last night's games as Today until the morning rollover", () => {
    expect(scoresToday(new Date(2026, 10, 17, 23, 30))).toBe("2026-11-17");
    expect(scoresToday(new Date(2026, 10, 18, 0, 45))).toBe("2026-11-17"); // late game past midnight
    expect(scoresToday(new Date(2026, 10, 18, 4, 59))).toBe("2026-11-17");
    expect(scoresToday(new Date(2026, 10, 18, 5, 0))).toBe("2026-11-18");
    expect(scoresToday(new Date(2026, 11, 1, 1, 0))).toBe("2026-11-30"); // across a month
    expect(scoresToday(new Date(2027, 0, 1, 2, 0))).toBe("2026-12-31"); // and a year
  });

  it("labels nearby dates relative to today", () => {
    expect(dateLabel("2026-11-17", "2026-11-17")).toBe("Today");
    expect(dateLabel("2026-11-16", "2026-11-17")).toBe("Yesterday");
    expect(dateLabel("2026-11-18", "2026-11-17")).toBe("Tomorrow");
    expect(dateLabel("2026-11-20", "2026-11-17")).toMatch(/20/);
  });
});

describe("date picker values", () => {
  it("round-trips a date through the picker's local Date", () => {
    for (const d of ["2026-11-19", "2026-03-08", "2026-11-01", "2027-01-01", "2028-02-29"]) {
      expect(pickerValueToDate(dateToPickerValue(d))).toBe(d);
    }
  });

  it("opens the picker at local noon on that date", () => {
    const v = dateToPickerValue("2026-11-19");
    expect([v.getFullYear(), v.getMonth(), v.getDate(), v.getHours()]).toEqual([2026, 10, 19, 12]);
  });

  it("reads the local calendar date the picker returns, whatever the time", () => {
    expect(pickerValueToDate(new Date(2026, 10, 19, 0, 0))).toBe("2026-11-19");
    expect(pickerValueToDate(new Date(2026, 10, 19, 23, 59))).toBe("2026-11-19");
  });
});

describe("game status", () => {
  it.each([
    [game("live", { clock: { period: 2, label: "2nd", timeRemaining: "12:34" } }), "2nd 12:34"],
    [
      game("live", { clock: { period: 2, label: "2nd", intermission: true, intermissionRemaining: "03:05" } }),
      "2nd INT 03:05",
    ],
    [game("live", { clock: { period: 1, label: "1st", intermission: true } }), "1st INT"],
    [game("live"), "Live"],
    [game("final"), "Final"],
    [game("final", { endedIn: "overtime" }), "Final/OT"],
    [game("final", { endedIn: "shootout" }), "Final/SO"],
    [game("postponed"), "Postponed"],
  ])("%#: %s", (g, expected) => {
    expect(gameStatusLabel(g)).toBe(expected);
  });

  it("picks the winner of a final game only", () => {
    expect(winner(game("final", {}, [3, 2]))).toBe("home");
    expect(winner(game("final", {}, [1, 4]))).toBe("away");
    expect(winner(game("live", {}, [3, 2]))).toBeUndefined();
    expect(winner(game("scheduled", {}, [null, null]))).toBeUndefined();
  });
});

describe("scores order", () => {
  const at = (id: string, status: GameStatus, startTime: string) => game(status, { id, startTime });

  it("puts live games first, then upcoming, then finished, then postponed", () => {
    const games = [
      at("final-early", "final", "2026-11-17T23:00:00Z"),
      at("ppd", "postponed", "2026-11-17T22:00:00Z"),
      at("later", "scheduled", "2026-11-18T03:00:00Z"),
      at("live-late", "live", "2026-11-18T01:00:00Z"),
      at("final-late", "final", "2026-11-18T00:00:00Z"),
      at("live-early", "live", "2026-11-18T00:00:00Z"),
      at("sooner", "scheduled", "2026-11-18T02:00:00Z"),
    ];
    expect(sortGamesForScores(games).map((g) => g.id)).toEqual([
      "live-early",
      "live-late",
      "sooner",
      "later",
      "final-early",
      "final-late",
      "ppd",
    ]);
  });

  it("breaks start-time ties by id and does not mutate the input", () => {
    const games = [at("b", "live", "2026-11-18T00:00:00Z"), at("a", "live", "2026-11-18T00:00:00Z")];
    expect(sortGamesForScores(games).map((g) => g.id)).toEqual(["a", "b"]);
    expect(games.map((g) => g.id)).toEqual(["b", "a"]);
  });
});

describe("venueLabel", () => {
  it("joins the arena and city, or gives just the arena", () => {
    expect(venueLabel({ name: "TD Garden", city: "Boston" })).toBe("TD Garden · Boston");
    expect(venueLabel({ name: "TD Garden" })).toBe("TD Garden");
    expect(venueLabel(undefined)).toBeUndefined();
  });
});

describe("goal summary helpers", () => {
  const goal = (over: Partial<Goal> = {}): Goal => ({
    teamId: "LAK",
    period: 1,
    periodLabel: "1st",
    time: "15:46",
    scorer: { id: "1", league: "nhl", name: "M. Zuccarello" },
    assists: [],
    strength: "even",
    emptyNet: false,
    penaltyShot: false,
    ...over,
  });

  it("groups goals by period in the order scored", () => {
    const periods = groupGoalsByPeriod([
      goal(),
      goal({ time: "02:00" }),
      goal({ periodLabel: "2nd", period: 2 }),
      goal({ periodLabel: "OT", period: 4 }),
    ]);
    expect(periods.map((p) => [p.label, p.goals.length])).toEqual([
      ["1st", 2],
      ["2nd", 1],
      ["OT", 1],
    ]);
    expect(groupGoalsByPeriod([])).toEqual([]);
  });

  it("tags power-play, short-handed, empty-net and penalty-shot goals", () => {
    expect(goalTags(goal())).toEqual([]);
    expect(goalTags(goal({ strength: "powerPlay" }))).toEqual(["PP"]);
    expect(goalTags(goal({ strength: "shortHanded", emptyNet: true }))).toEqual(["SH", "EN"]);
    expect(goalTags(goal({ penaltyShot: true }))).toEqual(["PS"]);
  });

  it("lists assists, or says unassisted", () => {
    expect(assistsLabel(goal())).toBe("Unassisted");
    const a = (name: string) => ({ id: name, league: "nhl", name });
    expect(assistsLabel(goal({ assists: [a("E. Gustafsson"), a("B. Clarke")] }))).toBe("E. Gustafsson, B. Clarke");
  });

  it("puts the goal of the game after the scorer from the 2nd on, and the season goal in words", () => {
    expect(scorerLabel(goal(), 1)).toBe("M. Zuccarello");
    expect(scorerLabel(goal(), 0)).toBe("M. Zuccarello"); // shootout
    expect(scorerLabel(goal(), 3)).toBe("M. Zuccarello (3)");
    expect(seasonGoalLabel(goal({ scorerSeasonGoals: 21 }))).toBe("21st goal");
    expect(seasonGoalLabel(goal({ scorerSeasonGoals: 12 }))).toBe("12th goal");
    expect(seasonGoalLabel(goal())).toBeUndefined();
  });

  it("numbers each scorer's goals in the game, skipping the shootout", () => {
    const by = (id: string, periodLabel = "1st") => goal({ scorer: { id, league: "nhl", name: id }, periodLabel });
    const goals = [by("A"), by("B"), by("A"), by("A", "3rd"), by("A", "SO"), by("B", "OT"), by("A", "OT")];
    expect(scorerGameGoalNumbers(goals)).toEqual([1, 1, 2, 3, 0, 2, 4]);
    expect([0, 1, 2, 3, 4].map(gameGoalTag)).toEqual([undefined, undefined, undefined, "Hat trick", undefined]);
  });

  it("shows the score after the goal, away first", () => {
    expect(scoreAfterLabel(goal({ awayScore: 2, homeScore: 1 }))).toBe("2–1");
    expect(scoreAfterLabel(goal())).toBeUndefined();
  });
});

describe("scores sections", () => {
  const g = (id: string, status: GameStatus, away = "MTL", home = "TOR"): Game => {
    const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });
    return {
      id,
      league: "nhl",
      startTime: "2026-11-18T00:00:00Z",
      status,
      home: { team: team(home), score: null },
      away: { team: team(away), score: null },
    };
  };

  it("groups by status in Scores order, with a title for each", () => {
    const sections = groupGamesForScores([g("f", "final"), g("u", "scheduled"), g("l", "live"), g("p", "postponed")]);
    expect(sections.map((s) => [s.title, s.data.map((x) => x.id)])).toEqual([
      ["Live", ["l"]],
      ["Upcoming", ["u"]],
      ["Final", ["f"]],
      ["Postponed", ["p"]],
    ]);
  });

  it("leaves out sections with no games", () => {
    expect(groupGamesForScores([g("a", "final"), g("b", "final")]).map((s) => s.title)).toEqual(["Final"]);
    expect(groupGamesForScores([])).toEqual([]);
  });

  it("puts favourite teams' games in their own first section, in Scores order inside it", () => {
    const sections = groupGamesForScores(
      [g("x", "live", "BOS", "NYR"), g("fin", "final", "EDM", "CGY"), g("up", "scheduled", "TOR", "OTT")],
      ["TOR", "CGY"],
    );
    expect(sections.map((s) => [s.title, s.data.map((x) => x.id)])).toEqual([
      ["Your teams", ["up", "fin"]],
      ["Live", ["x"]],
    ]);
    expect(sections[0].key).toBe("favorites");
  });

  it("keeps exactly the order sortGamesForScores gives", () => {
    const games = [g("1", "final"), g("2", "live", "TOR", "BOS"), g("3", "scheduled"), g("4", "live")];
    const flat = groupGamesForScores(games, ["TOR"]).flatMap((s) => s.data.map((x) => x.id));
    expect(flat).toEqual(sortGamesForScores(games, ["TOR"]).map((x) => x.id));
  });
});

describe("team records", () => {
  const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });
  const standings: Standings = {
    league: "nhl",
    updatedAt: "2026-11-19T12:00:00Z",
    groups: [
      { name: "Atlantic", rows: [{ team: team("TOR"), rank: 1, gamesPlayed: 21, wins: 13, losses: 7, otLosses: 1 }] },
      { name: "Pacific", rows: [{ team: team("LAK"), rank: 1, gamesPlayed: 20, wins: 12, losses: 8, otLosses: 0 }] },
    ],
  };

  it("formats W-L-OT, or W-L when the league has no OT losses", () => {
    expect(recordLabel({ wins: 13, losses: 7, otLosses: 1 })).toBe("13-7-1");
    expect(recordLabel({ wins: 12, losses: 8, otLosses: 0 })).toBe("12-8-0");
    expect(recordLabel({ wins: 30, losses: 12 })).toBe("30-12");
  });

  it("finds a team's record in any standings group", () => {
    expect(teamRecord(standings, team("TOR"))).toBe("13-7-1");
    expect(teamRecord(standings, team("LAK"))).toBe("12-8-0");
  });

  it("returns undefined for a missing team or no standings", () => {
    expect(teamRecord(standings, team("SEA"))).toBeUndefined();
    expect(teamRecord(undefined, team("TOR"))).toBeUndefined();
  });
});

describe("stat values", () => {
  it.each([
    [12, "12"],
    [0.925, ".925"],
    [1, "1"],
    [2.314, "2.31"],
    ["18:32", "18:32"],
    [undefined, "-"],
  ] as const)("%s -> %s", (value, expected) => {
    expect(statValue(value)).toBe(expected);
  });
});

describe("manual refresh limit", () => {
  const at = (msAgo: number, over: Partial<DataMeta> = {}) =>
    meta({ fetchedAt: new Date(NOW - msAgo).toISOString(), ...over });

  it("ignores a pull when the data on screen is newer than the cooldown", () => {
    expect(canManualRefresh(at(5_000), NOW)).toBe(false);
    expect(canManualRefresh(at(REFRESH_COOLDOWN_MS - 1), NOW)).toBe(false);
  });

  it("allows it once the cooldown has passed", () => {
    expect(canManualRefresh(at(REFRESH_COOLDOWN_MS), NOW)).toBe(true);
    expect(canManualRefresh(at(3 * 86_400_000, { source: "cache" }), NOW)).toBe(true);
  });

  it("always allows it when nothing loaded, or the data is an offline fallback", () => {
    expect(canManualRefresh(undefined, NOW)).toBe(true);
    expect(canManualRefresh(at(1_000, { stale: true, error: "offline", source: "cache" }), NOW)).toBe(true);
  });
});

describe("day swipe", () => {
  it("swipes left to the next day and right to the previous", () => {
    expect(swipeDayStep(-120, 10)).toBe(1);
    expect(swipeDayStep(120, -10)).toBe(-1);
  });

  it("ignores short drags and mostly vertical ones", () => {
    expect(swipeDayStep(-40, 0)).toBe(0);
    expect(swipeDayStep(-100, 80)).toBe(0);
    expect(swipeDayStep(0, 200)).toBe(0);
  });

  it("only takes over a drag that is clearly sideways", () => {
    expect(isHorizontalDrag(30, 5)).toBe(true);
    expect(isHorizontalDrag(10, 0)).toBe(false);
    expect(isHorizontalDrag(30, 25)).toBe(false);
  });
});

describe("polling", () => {
  it("polls just after the data goes stale", () => {
    expect(nextPollDelay(meta(), NOW)).toBe(20_000 + POLL.margin);
  });

  it("never polls faster than the minimum", () => {
    expect(nextPollDelay(meta({ staleAt: new Date(NOW - 5_000).toISOString() }), NOW)).toBe(POLL.minDelay);
  });

  it("caps long TTLs so the timer stays reliable", () => {
    expect(nextPollDelay(meta({ staleAt: new Date(NOW + 7 * 86_400_000).toISOString() }), NOW)).toBe(POLL.maxDelay);
  });

  it("retries on a schedule after a failed refresh, with or without cached data", () => {
    expect(nextPollDelay(undefined, NOW)).toBe(POLL.retry);
    expect(nextPollDelay(meta({ source: "cache", stale: true, error: "offline" }), NOW)).toBe(POLL.retry);
  });

  it("combines results using the most urgent meta", () => {
    const combined = combineFetched([
      { data: "a", meta: meta({ source: "cache", staleAt: new Date(NOW + 60_000).toISOString(), warnings: ["w1"] }) },
      { data: "b", meta: meta({ source: "network", key: "k2", error: "offline", warnings: ["w2"] }) },
    ]);
    expect(combined.data).toEqual(["a", "b"]);
    expect(combined.meta).toMatchObject({
      source: "network",
      staleAt: new Date(NOW + 20_000).toISOString(),
      warnings: ["w1", "w2"],
      error: "offline",
    });
  });
});
