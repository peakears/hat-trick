import { describe, expect, it } from "vitest";
import type { Game } from "../domain";
import { eventWeekStart, withSpecialEvents } from "./special-events";

describe("eventWeekStart", () => {
  it("is the Monday of the date's week", () => {
    expect(eventWeekStart("2026-11-17")).toBe("2026-11-16"); // Tuesday
    expect(eventWeekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(eventWeekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(eventWeekStart("2026-11-23")).toBe("2026-11-23"); // next Monday
  });

  it("crosses months and years", () => {
    expect(eventWeekStart("2027-01-01")).toBe("2026-12-28"); // a Friday Winter Classic
    expect(eventWeekStart("2026-12-01")).toBe("2026-11-30");
  });
});

describe("withSpecialEvents", () => {
  const game = (id: string, specialEvent?: string): Game => {
    const side = (abbrev: string) => ({ team: { id: abbrev, league: "nhl", name: abbrev, abbrev }, score: null });
    return {
      id,
      league: "nhl",
      startTime: "2026-11-17T23:00:00Z",
      status: "scheduled",
      home: side("CHI"),
      away: side("TOR"),
      specialEvent,
    };
  };

  it("fills in events by game id, keeping one a game already names", () => {
    const games = [game("1"), game("2", "Stadium Series"), game("3")];
    const out = withSpecialEvents(games, { "1": "Original 6 Series", "2": "Something else" });
    expect(out.map((g) => g.specialEvent)).toEqual(["Original 6 Series", "Stadium Series", undefined]);
    expect(games[0].specialEvent).toBeUndefined(); // the input is not changed
  });

  it("returns the same games when there are no events", () => {
    const games = [game("1")];
    expect(withSpecialEvents(games, undefined)).toBe(games);
    expect(withSpecialEvents(games, {})).toBe(games);
  });
});
