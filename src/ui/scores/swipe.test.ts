import { describe, expect, it } from "vitest";
import { isHorizontalDrag, swipeDayStep } from "./swipe";

describe("day swipe", () => {
  it("swipes left to the next day and right to the previous", () => {
    expect(swipeDayStep(-120, 10)).toBe(1);
    expect(swipeDayStep(120, -10)).toBe(-1);
  });

  it("ignores short drags and mostly vertical ones", () => {
    expect(swipeDayStep(-40, 0)).toBe(0);
    expect(swipeDayStep(-100, 80)).toBe(0);
    expect(swipeDayStep(0, 200)).toBe(0);
  });

  it("only takes over a drag that is clearly sideways", () => {
    expect(isHorizontalDrag(30, 5)).toBe(true);
    expect(isHorizontalDrag(10, 0)).toBe(false);
    expect(isHorizontalDrag(30, 25)).toBe(false);
  });
});
