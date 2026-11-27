import { describe, expect, it } from "vitest";
import { columnWidth, MIN_COLUMN_WIDTH } from "./stat-grid-layout";

describe("columnWidth", () => {
  it("keeps short labels at the minimum width", () => {
    for (const label of ["G", "PTS", "AVG", "+/-", "LONG"]) expect(columnWidth(label)).toBe(MIN_COLUMN_WIDTH);
  });

  it("widens a column whose label would otherwise wrap", () => {
    expect(columnWidth("QB HTS")).toBeGreaterThan(MIN_COLUMN_WIDTH);
    expect(columnWidth("QB HTS")).toBeGreaterThan(columnWidth("In 20"));
  });
});
