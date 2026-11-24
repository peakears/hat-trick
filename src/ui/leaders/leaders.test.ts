import { describe, expect, it } from "vitest";
import { statValue } from "../common/format";
import {
  LEADERS_MAX,
  LEADERS_SHOWN,
  leadLine,
  leaderBarShare,
  leaderSectionKey,
  leaderValue,
  lowerIsBetter,
  spotlightDetail,
  visibleLeaders,
} from "./leaders";

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

describe("leaderValue decimals", () => {
  it("shows a board's values with its decimals, ahead of the general stat format", () => {
    expect(leaderValue(37.2, undefined, statValue, 1)).toBe("37.2");
    expect(leaderValue(30, undefined, statValue, 1)).toBe("30.0");
    expect(leaderValue(0.5, "percent", statValue, 1)).toBe("50.0%");
  });
});

describe("leader bars and lead", () => {
  const points = [{ value: 42 }, { value: 26 }, { value: 21 }];
  const gaa = [{ value: 1.85 }, { value: 2.1 }, { value: 3.7 }];
  const fmt = (v: number) => String(Math.round(v * 100) / 100);

  it("reads which way a board runs from its order", () => {
    expect(lowerIsBetter(points)).toBe(false);
    expect(lowerIsBetter(gaa)).toBe(true);
    expect(lowerIsBetter([{ value: 1 }])).toBe(false);
  });

  it("sizes bars against the leader, inverted when lower is better", () => {
    expect(leaderBarShare(42, points)).toBe(1);
    expect(leaderBarShare(21, points)).toBe(0.5);
    expect(leaderBarShare(3.7, gaa)).toBeCloseTo(0.5, 5);
    expect(leaderBarShare(0, [{ value: 0 }, { value: 0 }])).toBe(1);
  });

  it("says how far ahead the leader is, in the board's format, or that they are tied", () => {
    expect(leadLine(points, undefined, fmt)).toBe("Leads by 16");
    expect(leadLine([{ value: 37.2 }, { value: 31.7 }], undefined, fmt, 1)).toBe("Leads by 5.5");
    expect(leadLine([{ value: 0.932 }, { value: 0.931 }], "percent", fmt)).toBe("Leads by 0.1%");
    expect(leadLine([{ value: 25 }, { value: 25 }], undefined, fmt)).toBe("Tied for first");
    expect(leadLine([{ value: 0.9321 }, { value: 0.932 }], "percent", fmt)).toBe("Tied for first");
    expect(leadLine([{ value: 5 }], undefined, fmt)).toBeUndefined();
  });
});
