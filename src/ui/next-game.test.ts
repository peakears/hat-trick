import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../domain";
import {
  countdownLabel,
  daysAwayLabel,
  nextGameHeading,
  nextGamePhase,
  pickNextGame,
  withoutNextGame,
} from "./next-game";

// Local times, so the tests hold in any time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const TODAY = "2026-11-22";

function game(id: string, status: GameStatus, start = at(22, 19)): Game {
  return {
    id,
    league: "nhl",
    startTime: new Date(start).toISOString(),
    status,
    home: { team: { id: "TOR", league: "nhl", name: "Toronto Maple Leafs", abbrev: "TOR" }, score: null },
    away: { team: { id: "BOS", league: "nhl", name: "Boston Bruins", abbrev: "BOS" }, score: null },
  };
}

describe("pickNextGame", () => {
  it("prefers a live game, then the first upcoming game that is not postponed", () => {
    const live = game("live", "live");
    const final = game("final", "final");
    const postponed = game("pp", "postponed");
    const next = game("next", "scheduled");
    expect(pickNextGame({ recent: [live, final], upcoming: [next] })).toEqual({ game: live, from: "recent" });
    expect(pickNextGame({ recent: [final], upcoming: [postponed, next] })).toEqual({ game: next, from: "upcoming" });
  });

  it("is undefined with no games (offseason) or no schedule", () => {
    expect(pickNextGame({ recent: [game("f", "final")], upcoming: [] })).toBeUndefined();
    expect(pickNextGame({})).toBeUndefined();
    expect(pickNextGame(undefined)).toBeUndefined();
  });

  it("leaves the card's game out of the list it came from only", () => {
    const next = game("next", "scheduled");
    const later = game("later", "scheduled");
    const picked = pickNextGame({ upcoming: [next, later] });
    expect(withoutNextGame([next, later], picked, "upcoming")).toEqual([later]);
    expect(withoutNextGame([next, later], picked, "recent")).toEqual([next, later]);
    expect(withoutNextGame(undefined, picked, "upcoming")).toBeUndefined();
  });
});

describe("next game phase and labels", () => {
  it("counts down on game day and waits for the league after puck drop", () => {
    const tonight = game("1", "scheduled", at(22, 19));
    expect(nextGamePhase(tonight, at(22, 15, 18), TODAY)).toBe("gameDay");
    expect(nextGamePhase(tonight, at(22, 19, 1), TODAY)).toBe("starting");
    expect(nextGamePhase(game("1", "live"), at(22, 19, 30), TODAY)).toBe("live");
    expect(nextGamePhase(game("1", "final"), at(22, 22), TODAY)).toBe("final");
    expect(nextGamePhase(game("2", "scheduled", at(24, 19)), at(22, 12), TODAY)).toBe("later");
  });

  it("treats a game just after midnight as the same day, as the Scores tab does", () => {
    // Before 5am the Scores tab's today is still the previous date.
    expect(nextGamePhase(game("1", "scheduled", at(22, 20)), at(22, 2), "2026-11-21")).toBe("later");
    // A 12:30am puck drop is part of the evening before, so it counts down from that day.
    expect(nextGamePhase(game("1", "scheduled", at(23, 0, 30)), at(23, 0, 10), "2026-11-22")).toBe("gameDay");
    expect(nextGamePhase(game("1", "scheduled", at(23, 0, 30)), at(22, 21), "2026-11-22")).toBe("gameDay");
  });

  it("formats the countdown", () => {
    const start = new Date(at(22, 19)).toISOString();
    expect(countdownLabel(start, at(22, 15, 18))).toBe("3h 42m");
    expect(countdownLabel(start, at(22, 18, 18))).toBe("42 min");
    expect(countdownLabel(start, at(22, 19) - 30_000)).toBe("Under 1 min");
  });

  it("heads the card by phase", () => {
    expect(nextGameHeading(game("1", "scheduled", at(22, 19)), "gameDay", TODAY)).toEqual({ title: "Tonight" });
    expect(nextGameHeading(game("1", "scheduled", at(22, 13)), "gameDay", TODAY)).toEqual({ title: "Today" });
    expect(nextGameHeading(game("1", "live"), "live", TODAY)).toEqual({ title: "Live now" });
    expect(nextGameHeading(game("1", "scheduled", at(23, 19)), "later", TODAY)).toEqual({
      title: "Next game",
      date: "Tomorrow",
    });
    expect(nextGameHeading(game("1", "scheduled", at(25, 19)), "later", TODAY).date).not.toBe("Tomorrow");
  });

  it("says how many days away, except for tomorrow", () => {
    expect(daysAwayLabel(game("1", "scheduled", at(23, 19)), TODAY)).toBeUndefined();
    expect(daysAwayLabel(game("1", "scheduled", at(24, 19)), TODAY)).toBe("in 2 days");
  });
});
