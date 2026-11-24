import { describe, expect, it } from "vitest";
import type { Game, GameStatus } from "../../domain";
import { NO_REVEALS, isGameHidden, revealAllGames, revealGame, statusLabelFor } from "./spoilers";

const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });

function game(id: string, status: GameStatus, extra: Partial<Game> = {}): Game {
  return {
    id,
    league: "nhl",
    startTime: "2026-11-20T00:00:00Z",
    status,
    home: { team: team("BOS"), score: status === "scheduled" ? null : 3 },
    away: { team: team("TOR"), score: status === "scheduled" ? null : 2 },
    ...extra,
  };
}

describe("isGameHidden", () => {
  it("hides live and finished games while the shield is on", () => {
    expect(isGameHidden(game("1", "live"), true, NO_REVEALS)).toBe(true);
    expect(isGameHidden(game("1", "final"), true, NO_REVEALS)).toBe(true);
  });

  it("has nothing to hide for games that have not started, or are postponed", () => {
    expect(isGameHidden(game("1", "scheduled"), true, NO_REVEALS)).toBe(false);
    expect(isGameHidden(game("1", "postponed"), true, NO_REVEALS)).toBe(false);
  });

  it("hides nothing when the shield is off", () => {
    expect(isGameHidden(game("1", "final"), false, NO_REVEALS)).toBe(false);
  });

  it("shows a game that was revealed, and only that one", () => {
    const reveals = revealGame(NO_REVEALS, "1");
    expect(isGameHidden(game("1", "final"), true, reveals)).toBe(false);
    expect(isGameHidden(game("2", "final"), true, reveals)).toBe(true);
  });

  it("shows every game after Show all scores", () => {
    const reveals = revealAllGames(NO_REVEALS);
    expect(isGameHidden(game("1", "final"), true, reveals)).toBe(false);
    expect(isGameHidden(game("2", "live"), true, reveals)).toBe(false);
  });

  it("keeps a live game revealed once it ends", () => {
    const reveals = revealGame(NO_REVEALS, "1");
    expect(isGameHidden(game("1", "final"), true, reveals)).toBe(false);
  });
});

describe("reveals", () => {
  it("never change the object they were given", () => {
    const before = { all: false, games: ["1"] };
    revealGame(before, "2");
    revealAllGames(before);
    expect(before).toEqual({ all: false, games: ["1"] });
  });

  it("do not add a game twice", () => {
    expect(revealGame(revealGame(NO_REVEALS, "1"), "1").games).toEqual(["1"]);
  });
});

describe("statusLabelFor", () => {
  it("drops OT and shootout from a hidden finished game", () => {
    expect(statusLabelFor(game("1", "final", { endedIn: "overtime" }), true)).toBe("Final");
    expect(statusLabelFor(game("1", "final", { endedIn: "shootout" }), true)).toBe("Final");
  });

  it("shows the full result once visible", () => {
    expect(statusLabelFor(game("1", "final", { endedIn: "overtime" }), false)).toBe("Final/OT");
    expect(statusLabelFor(game("1", "final", { endedIn: "shootout" }), false)).toBe("Final/SO");
  });

  it("keeps a live clock, which says nothing about the score", () => {
    const live = game("1", "live", { clock: { period: 2, label: "2nd", timeRemaining: "08:14" } });
    expect(statusLabelFor(live, true)).toBe("2nd 08:14");
  });
});
