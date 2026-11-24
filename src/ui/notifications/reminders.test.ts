import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../../domain";
import {
  diffReminders,
  parseScheduled,
  planReminders,
  reminderId,
  serializeScheduled,
  type Reminder,
} from "./reminders";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const TERM = (league: string) => (league === "nba" ? "Tip-off" : "Puck drop");

function game(id: string, status: GameStatus, startTime: string, away = "MTL", home = "TOR", league = "nhl"): Game {
  const team = (abbrev: string) => ({ id: abbrev, league, name: abbrev, abbrev });
  return {
    id,
    league,
    startTime,
    status,
    away: { team: team(away), score: null },
    home: { team: team(home), score: null },
  };
}

describe("planReminders", () => {
  it("plans a reminder at start time minus the lead for an upcoming favourite game", () => {
    const [r] = planReminders([game("g1", "scheduled", "2026-11-20T23:00:00Z")], ["TOR"], 30, NOW, TERM);
    expect(r.id).toBe(reminderId("nhl", "g1"));
    expect(r.league).toBe("nhl");
    expect(r.gameId).toBe("g1");
    expect(r.fireAt).toBe(Date.parse("2026-11-20T22:30:00Z"));
    expect(r.title).toBe("Puck drop in 30 minutes");
    expect(r.body).toContain("MTL at TOR");
  });

  it("matches a favourite on either side and ignores other games", () => {
    const games = [
      game("home", "scheduled", "2026-11-20T23:00:00Z", "BOS", "TOR"),
      game("away", "scheduled", "2026-11-20T23:30:00Z", "TOR", "BOS"),
      game("other", "scheduled", "2026-11-20T23:30:00Z", "EDM", "CGY"),
    ];
    expect(planReminders(games, ["TOR"], 15, NOW, TERM).map((r) => r.gameId)).toEqual(["home", "away"]);
  });

  it("reminds for every league's favourites in the league's own words, and keeps BOS apart in each league", () => {
    const games = [
      game("hockey", "scheduled", "2026-11-20T23:00:00Z", "BOS", "TOR"),
      game("basketball", "scheduled", "2026-11-21T00:30:00Z", "BOS", "NY", "nba"),
    ];
    // Only the Celtics are a favourite: the Bruins' game gets no reminder.
    const [r] = planReminders(games, ["nba:BOS"], 30, NOW, TERM);
    expect(planReminders(games, ["nba:BOS"], 30, NOW, TERM)).toHaveLength(1);
    expect(r).toMatchObject({ gameId: "basketball", league: "nba", title: "Tip-off in 30 minutes" });
    expect(r.id).toBe("puckdrop:nba:basketball");
    const both = planReminders(games, ["nhl:TOR", "nba:BOS"], 30, NOW, TERM);
    expect(both.map((x) => x.title)).toEqual(["Puck drop in 30 minutes", "Tip-off in 30 minutes"]);
  });

  it("keeps the NHL's reminder ids as they were, so reminders already scheduled are recognised", () => {
    expect(reminderId("nhl", "2026020333")).toBe("puckdrop:2026020333");
    expect(reminderId("nba", "401910043")).toBe("puckdrop:nba:401910043");
  });

  it("plans nothing without favourites", () => {
    expect(planReminders([game("g1", "scheduled", "2026-11-20T23:00:00Z")], [], 30, NOW, TERM)).toEqual([]);
  });

  it("skips live, final and postponed games", () => {
    const games = (["live", "final", "postponed"] as const).map((s) => game(s, s, "2026-11-20T23:00:00Z"));
    expect(planReminders(games, ["TOR"], 30, NOW, TERM)).toEqual([]);
  });

  it("skips a game whose reminder time has already passed", () => {
    // Starts in 20 minutes; a 30-minute reminder would have fired 10 minutes ago.
    const soon = game("soon", "scheduled", new Date(NOW + 20 * 60_000).toISOString());
    expect(planReminders([soon], ["TOR"], 30, NOW, TERM)).toEqual([]);
    expect(planReminders([soon], ["TOR"], 10, NOW, TERM)).toHaveLength(1);
  });

  it("skips an unparseable start time and keeps one reminder per game id, soonest first", () => {
    const games = [
      game("late", "scheduled", "2026-11-21T00:00:00Z"),
      game("bad", "scheduled", "not a date"),
      game("early", "scheduled", "2026-11-20T20:00:00Z"),
      game("early", "scheduled", "2026-11-20T20:00:00Z"),
    ];
    expect(planReminders(games, ["TOR"], 30, NOW, TERM).map((r) => r.gameId)).toEqual(["early", "late"]);
  });
});

describe("diffReminders", () => {
  const planned = (id: string, fireAt: number): Reminder => ({
    id: reminderId("nhl", id),
    gameId: id,
    league: "nhl",
    fireAt,
    title: "t",
    body: "b",
  });

  it("schedules everything when nothing is scheduled", () => {
    const plan = [planned("a", 1), planned("b", 2)];
    expect(diffReminders([], plan)).toEqual({ cancel: [], schedule: plan });
  });

  it("leaves reminders that are already scheduled at the right time alone", () => {
    expect(diffReminders([{ id: reminderId("nhl", "a"), fireAt: 1 }], [planned("a", 1)])).toEqual({
      cancel: [],
      schedule: [],
    });
  });

  it("cancels reminders that are no longer wanted", () => {
    expect(diffReminders([{ id: reminderId("nhl", "gone"), fireAt: 1 }], [])).toEqual({
      cancel: [reminderId("nhl", "gone")],
      schedule: [],
    });
  });

  it("replaces a reminder whose time changed (a moved game)", () => {
    const changed = planned("a", 5);
    expect(diffReminders([{ id: reminderId("nhl", "a"), fireAt: 1 }], [changed])).toEqual({
      cancel: [reminderId("nhl", "a")],
      schedule: [changed],
    });
  });
});

describe("parseScheduled / serializeScheduled", () => {
  it("round-trips", () => {
    const list = [
      { id: reminderId("nhl", "a"), fireAt: 1 },
      { id: reminderId("nhl", "b"), fireAt: 2 },
    ];
    expect(parseScheduled(serializeScheduled(list))).toEqual(list);
  });

  it("returns an empty list for nothing stored, corrupt JSON or the wrong shape", () => {
    expect(parseScheduled(null)).toEqual([]);
    expect(parseScheduled("{not json")).toEqual([]);
    expect(parseScheduled('{"id":"x"}')).toEqual([]);
  });

  it("drops entries that are malformed or not ours", () => {
    const raw = JSON.stringify([
      { id: reminderId("nhl", "ok"), fireAt: 5 },
      { id: "someone-else:1", fireAt: 5 },
      { id: reminderId("nhl", "no-time") },
      { id: reminderId("nhl", "bad-time"), fireAt: "soon" },
      null,
      7,
    ]);
    expect(parseScheduled(raw)).toEqual([{ id: reminderId("nhl", "ok"), fireAt: 5 }]);
  });
});
