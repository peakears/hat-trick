import { describe, expect, it } from "vitest";
import type { DataMeta } from "../data";
import type { Game, GameStatus } from "../domain";
import { addDays, dateLabel, gameStatusLabel, localDate, statValue, winner } from "./format";
import { POLL, combineFetched, nextPollDelay } from "./polling";

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

  it("labels nearby dates relative to today", () => {
    expect(dateLabel("2026-11-17", "2026-11-17")).toBe("Today");
    expect(dateLabel("2026-11-16", "2026-11-17")).toBe("Yesterday");
    expect(dateLabel("2026-11-18", "2026-11-17")).toBe("Tomorrow");
    expect(dateLabel("2026-11-20", "2026-11-17")).toMatch(/20/);
  });
});

describe("game status", () => {
  it.each([
    [game("live", { clock: { period: 2, label: "2nd", timeRemaining: "12:34" } }), "2nd 12:34"],
    [game("live", { clock: { period: 2, label: "2nd", intermission: true, intermissionRemaining: "03:05" } }), "2nd INT 03:05"],
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
