import { describe, expect, it } from "vitest";
import { fullDateLabel, weekStrip } from "./week-strip";

describe("week strip", () => {
  it("shows seven days with the chosen one in the middle, marking today", () => {
    const days = weekStrip("2026-11-24", "2026-11-24");
    expect(days.map((d) => `${d.weekday} ${d.day}`)).toEqual([
      "SAT 21",
      "SUN 22",
      "MON 23",
      "TUE 24",
      "WED 25",
      "THU 26",
      "FRI 27",
    ]);
    expect(days.filter((d) => d.selected).map((d) => d.date)).toEqual(["2026-11-24"]);
    expect(days[3]).toMatchObject({ isToday: true, spoken: "Tuesday 24 November, today" });
  });

  it("moves with the chosen day, across months and years, with today kept wherever it falls", () => {
    const days = weekStrip("2027-01-01", "2026-12-30");
    expect(days.map((d) => d.date)).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
      "2027-01-04",
    ]);
    expect(days.find((d) => d.isToday)?.date).toBe("2026-12-30");
    expect(days[3].spoken).toBe("Friday 1 January 2027");
  });

  it("words a date in full, with the year only when it is not this year's", () => {
    expect(fullDateLabel("2026-11-24", "2026-11-24")).toBe("Tuesday 24 November");
    expect(fullDateLabel("2025-04-01", "2026-11-24")).toBe("Tuesday 1 April 2025");
  });

  it("keeps the day across a daylight saving change", () => {
    // Canada falls back on 2026-11-01.
    expect(weekStrip("2026-11-01", "2026-11-01").map((d) => d.day)).toEqual(["29", "30", "31", "1", "2", "3", "4"]);
  });
});
