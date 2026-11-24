import { describe, expect, it } from "vitest";
import type { Game, GameDetail, Goal } from "../../domain";
import {
  createTapRouter,
  followUpdate,
  gamesToFollow,
  ongoingSummary,
  ongoingText,
  scoreLine,
  TRACK_LATE_MS,
  TRACK_LEAD_MS,
  TAP_REPEAT_MS,
} from "./live-tracker";

const NOW = Date.parse("2026-11-22T00:30:00Z");

type GameOver = Omit<Partial<Game>, "away" | "home"> & { away?: number | null; home?: number | null };

function game(over: GameOver = {}): Game {
  const { away = 1, home = 0, ...rest } = over;
  const side = (abbrev: string, score: number | null) => ({
    team: { id: abbrev, league: "nhl", name: abbrev, abbrev },
    score,
  });
  return {
    id: "g1",
    league: "nhl",
    startTime: "2026-11-22T00:00:00Z",
    status: "live",
    clock: { period: 2, label: "2nd", timeRemaining: "12:34" },
    away: side("TOR", away),
    home: side("CHI", home),
    ...rest,
  };
}

function goal(teamId: string, scorerId: string, over: Partial<Goal> = {}): Goal {
  return {
    teamId,
    period: 2,
    periodLabel: "2nd",
    time: "07:26",
    scorer: { id: scorerId, league: "nhl", name: `P. ${scorerId}` },
    assists: [],
    strength: "even",
    emptyNet: false,
    penaltyShot: false,
    ...over,
  };
}

const detail = (g: Game, goals?: Goal[]): GameDetail => ({ game: g, goals, boxscore: { home: [], away: [] } });
const on = { hidden: false, goalAlerts: true };

describe("gamesToFollow", () => {
  const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

  it("follows a favourite's live game, and one starting within the lead time", () => {
    const games = [
      game({ id: "live" }),
      game({ id: "soon", status: "scheduled", startTime: at(10), away: null, home: null }),
      game({ id: "later", status: "scheduled", startTime: at(TRACK_LEAD_MS / 60_000 + 5), away: null, home: null }),
      game({ id: "over", status: "final" }),
    ];
    expect(gamesToFollow(games, ["TOR"], NOW).map((g) => g.id)).toEqual(["live", "soon"]);
  });

  it("follows only favourites' games, home or away", () => {
    expect(gamesToFollow([game()], ["CHI"], NOW)).toHaveLength(1);
    expect(gamesToFollow([game()], ["MTL"], NOW)).toHaveLength(0);
    expect(gamesToFollow([game()], [], NOW)).toHaveLength(0);
  });

  it("stops waiting for a game that is still 'scheduled' long after its start", () => {
    const stale = game({ status: "scheduled", startTime: new Date(NOW - TRACK_LATE_MS - 60_000).toISOString() });
    expect(gamesToFollow([stale], ["TOR"], NOW)).toHaveLength(0);
  });
});

describe("ongoing notification text", () => {
  it("shows the score and clock, away first", () => {
    expect(scoreLine(game({ away: 2, home: 1 }))).toBe("TOR 2–1 CHI");
    expect(ongoingText(game({ away: 2, home: 1 }), false)).toEqual({ title: "TOR 2–1 CHI", body: "2nd 12:34" });
  });

  it("shows no score while the spoiler shield is on", () => {
    expect(ongoingText(game({ away: 2, home: 1 }), true)).toEqual({
      title: "TOR at CHI",
      body: "2nd 12:34 · score hidden",
    });
  });

  it("shows the start time before puck drop", () => {
    const text = ongoingText(game({ status: "scheduled", clock: undefined, away: null, home: null }), false);
    expect(text.title).toBe("TOR at CHI");
    expect(text.body).toMatch(/^Starts /);
  });
});

describe("followUpdate", () => {
  it("announces nothing on the first check, so earlier goals are not replayed", () => {
    const update = followUpdate(undefined, detail(game({ away: 2 }), [goal("TOR", "a"), goal("TOR", "b")]), on);
    expect(update.alerts).toEqual([]);
    expect(update.state).toEqual({ gameId: "g1", awayScore: 2, homeScore: 0, goalCount: 2 });
    expect(update.done).toBe(false);
  });

  it("announces each new goal with the scorer, the goal of the game and the score after", () => {
    const first = followUpdate(undefined, detail(game({ away: 1 }), [goal("TOR", "a")]), on);
    const goals = [
      goal("TOR", "a"),
      goal("TOR", "a", { time: "11:00", strength: "powerPlay", scorerSeasonGoals: 9 }),
      goal("CHI", "c", { time: "15:46" }),
    ];
    const update = followUpdate(first.state, detail(game({ away: 2, home: 1 }), goals), on);
    expect(update.alerts.map((a) => [a.title, a.body])).toEqual([
      ["Goal: TOR", "P. a (2) · PP · 9th goal · 2nd 11:00 · TOR 2–1 CHI"],
      ["Goal: CHI", "P. c · 2nd 15:46 · TOR 2–1 CHI"],
    ]);
    expect(new Set(update.alerts.map((a) => a.id)).size).toBe(2);
  });

  it("tags a hat trick", () => {
    const goals = [goal("TOR", "a", { time: "01:00" }), goal("TOR", "a", { time: "02:00" })];
    const before = followUpdate(undefined, detail(game({ away: 2 }), goals), on);
    const update = followUpdate(before.state, detail(game({ away: 3 }), [...goals, goal("TOR", "a")]), on);
    expect(update.alerts[0].body).toMatch(/^P\. a \(3\) · Hat trick · /);
  });

  it("falls back to the score when the goal list could not be loaded", () => {
    const before = followUpdate(undefined, detail(game({ away: 1, home: 0 })), on);
    const update = followUpdate(before.state, detail(game({ away: 1, home: 2 })), on);
    expect(update.alerts.map((a) => [a.id, a.title, a.body])).toEqual([
      ["goal:g1:home:1", "Goal: CHI", "TOR 1–2 CHI"],
      ["goal:g1:home:2", "Goal: CHI", "TOR 1–2 CHI"],
    ]);
  });

  it("waits for the goal list when the score is ahead of it, so a goal is announced once", () => {
    const before = followUpdate(undefined, detail(game({ away: 1 }), [goal("TOR", "a")]), on);
    const lagging = followUpdate(before.state, detail(game({ away: 2 }), [goal("TOR", "a")]), on);
    expect(lagging.alerts).toEqual([]);
    const caughtUp = followUpdate(
      lagging.state,
      detail(game({ away: 2 }), [goal("TOR", "a"), goal("TOR", "b", { time: "11:00" })]),
      on,
    );
    expect(caughtUp.alerts.map((a) => a.title)).toEqual(["Goal: TOR"]);
    expect(caughtUp.alerts[0].body).toMatch(/^P\. b · /);
  });

  it("gives up on a followed game still scheduled long after its start", () => {
    const late = game({ status: "scheduled", away: null, home: null });
    const start = Date.parse(late.startTime);
    expect(followUpdate(undefined, detail(late), { ...on, now: start + TRACK_LATE_MS - 1 }).done).toBe(false);
    const update = followUpdate(undefined, detail(late), { ...on, now: start + TRACK_LATE_MS + 1 });
    expect(update.done).toBe(true);
    expect(update.ongoing).toBeNull();
  });

  it("does not announce a goal taken back after review", () => {
    const before = followUpdate(undefined, detail(game({ away: 2 }), [goal("TOR", "a"), goal("TOR", "b")]), on);
    const update = followUpdate(before.state, detail(game({ away: 1 }), [goal("TOR", "a")]), on);
    expect(update.alerts).toEqual([]);
    expect(update.ongoing?.title).toBe("TOR 1–0 CHI");
  });

  it("does not announce shootout attempts", () => {
    const before = followUpdate(
      undefined,
      detail(game({ away: 2, home: 2 }), [goal("TOR", "a"), goal("CHI", "c")]),
      on,
    );
    const so = goal("TOR", "b", { periodLabel: "SO", period: 5 });
    const update = followUpdate(
      before.state,
      detail(game({ away: 2, home: 2 }), [goal("TOR", "a"), goal("CHI", "c"), so]),
      on,
    );
    expect(update.alerts).toEqual([]);
  });

  it("announces the final and stops", () => {
    const before = followUpdate(undefined, detail(game({ away: 3, home: 2 }), []), on);
    const final = game({ status: "final", endedIn: "overtime", clock: undefined, away: 3, home: 2 });
    const update = followUpdate(before.state, detail(final, []), on);
    expect(update.done).toBe(true);
    expect(update.ongoing).toBeNull();
    expect(update.alerts).toEqual([{ id: "final:g1", title: "Final: TOR 3–2 CHI", body: "Final/OT" }]);
  });

  it("stops without a word for a postponed game", () => {
    const before = followUpdate(undefined, detail(game({ status: "scheduled", away: null, home: null })), on);
    const update = followUpdate(before.state, detail(game({ status: "postponed", away: null, home: null })), on);
    expect(update).toMatchObject({ done: true, ongoing: null, alerts: [] });
  });

  it("announces nothing while the spoiler shield is on, or with goal alerts off", () => {
    for (const options of [
      { hidden: true, goalAlerts: true },
      { hidden: false, goalAlerts: false },
    ]) {
      const before = followUpdate(undefined, detail(game({ away: 0 }), []), options);
      const update = followUpdate(before.state, detail(game({ away: 1 }), [goal("TOR", "a")]), options);
      expect(update.alerts).toEqual([]);
    }
  });

  it("keeps the last goal count when the goal list fails to load once", () => {
    const before = followUpdate(undefined, detail(game({ away: 1 }), [goal("TOR", "a")]), on);
    const gap = followUpdate(before.state, detail(game({ away: 1 })), on);
    expect(gap.state.goalCount).toBe(1);
    const update = followUpdate(gap.state, detail(game({ away: 2 }), [goal("TOR", "a"), goal("TOR", "b")]), on);
    expect(update.alerts).toHaveLength(1);
  });
});

describe("ongoingSummary", () => {
  it("shows one game as itself, opening it on tap", () => {
    const one = { gameId: "g1", title: "TOR 2–1 CHI", body: "2nd 12:34" };
    expect(ongoingSummary([one])).toEqual(one);
  });

  it("puts several games on a line each, opening the app on tap", () => {
    const summary = ongoingSummary([
      { gameId: "g1", title: "TOR 2–1 CHI", body: "2nd 12:34" },
      { gameId: "g2", title: "MTL 0–0 BOS", body: "1st 03:10" },
    ]);
    expect(summary).toEqual({
      title: "Following 2 games",
      body: "TOR 2–1 CHI · 2nd 12:34\nMTL 0–0 BOS · 1st 03:10",
    });
  });
});

describe("createTapRouter", () => {
  it("keeps a tap from before any screen attached, and opens it on attach", () => {
    const router = createTapRouter();
    const opened: string[] = [];
    router.tap("g1", 0);
    router.attach((id) => opened.push(id), 0);
    expect(opened).toEqual(["g1"]);
  });

  it("opens a tap at once while a screen is attached, and stops after detach", () => {
    const router = createTapRouter();
    const opened: string[] = [];
    const detach = router.attach((id) => opened.push(id), 0);
    router.tap("g1", 0);
    detach();
    router.tap("g2", 10_000);
    expect(opened).toEqual(["g1"]);
    router.attach((id) => opened.push(id), 10_000);
    expect(opened).toEqual(["g1", "g2"]);
  });

  it("opens one tap reported twice only once, but a later tap again", () => {
    const router = createTapRouter();
    const opened: string[] = [];
    router.attach((id) => opened.push(id), 0);
    router.tap("g1", 0);
    router.tap("g1", TAP_REPEAT_MS - 1);
    router.tap("g1", TAP_REPEAT_MS * 2);
    expect(opened).toEqual(["g1", "g1"]);
  });

  it("counts repeats from when a kept tap opens, so a slow start does not open it twice", () => {
    const router = createTapRouter();
    const opened: string[] = [];
    router.tap("g1", 0);
    router.attach((id) => opened.push(id), 5_000);
    router.tap("g1", 5_500); // the launch notification, reported again once the app is up
    expect(opened).toEqual(["g1"]);
  });
});
