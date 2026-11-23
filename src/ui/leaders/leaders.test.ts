import { describe, expect, it } from "vitest";
import { statValue } from "../common/format";
import { LEADERS_MAX, LEADERS_SHOWN, leaderSectionKey, leaderValue, spotlightDetail, visibleLeaders } from "./leaders";

const list = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("visibleLeaders", () => {
  it("shows the top 5 with Show more, and up to 20 when expanded", () => {
    expect(LEADERS_SHOWN).toBe(5);
    expect(LEADERS_MAX).toBe(20);
    expect(visibleLeaders(list(20), false)).toEqual({ shown: list(5), hasMore: true });
    expect(visibleLeaders(list(20), true)).toEqual({ shown: list(20), hasMore: true });
  });

  it("never shows more than 20, even if the league sends more", () => {
    expect(visibleLeaders(list(25), true).shown).toEqual(list(20));
  });

  it("has no Show more when 5 or fewer players are listed", () => {
    expect(visibleLeaders(list(5), false)).toEqual({ shown: list(5), hasMore: false });
    expect(visibleLeaders(list(3), true)).toEqual({ shown: list(3), hasMore: false });
    expect(visibleLeaders([], false)).toEqual({ shown: [], hasMore: false });
  });
});

describe("leaderSectionKey", () => {
  it("keeps skater and goalie categories apart", () => {
    expect(leaderSectionKey("skaters", "points")).not.toBe(leaderSectionKey("goalies", "points"));
  });
});

describe("spotlightDetail", () => {
  it("shows the team, number and position, leaving out what is unknown", () => {
    const team = { abbrev: "EDM" };
    expect(spotlightDetail({ team, sweaterNumber: 97, player: { position: "C" } })).toBe("EDM · #97 · C");
    expect(spotlightDetail({ team, sweaterNumber: 0, player: {} })).toBe("EDM · #0");
    expect(spotlightDetail({ team, player: {} })).toBe("EDM");
  });
});

describe("leaderValue", () => {
  it("shows a percent board's fractions as percentages, one decimal", () => {
    expect(leaderValue(0.640167, "percent", statValue)).toBe("64.0%");
    expect(leaderValue(0.5632, "percent", statValue)).toBe("56.3%");
  });

  it("shows other values as usual", () => {
    expect(leaderValue(80, undefined, statValue)).toBe("80");
    expect(leaderValue(0.925, undefined, statValue)).toBe(".925");
    expect(leaderValue(2.31, undefined, statValue)).toBe("2.31");
  });
});
