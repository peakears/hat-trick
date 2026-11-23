import { describe, expect, it } from "vitest";
import { shouldFlash } from "./score-flash";

describe("shouldFlash", () => {
  it("flashes when a live score goes up", () => {
    expect(shouldFlash(1, 2, true)).toBe(true);
    expect(shouldFlash(0, 2, true)).toBe(true); // two goals between polls
  });

  it("does not flash on the first value, an unchanged score or a goal taken back", () => {
    expect(shouldFlash(undefined, 2, true)).toBe(false);
    expect(shouldFlash(null, 0, true)).toBe(false); // puck drop: no score yet, then 0
    expect(shouldFlash(2, 2, true)).toBe(false);
    expect(shouldFlash(3, 2, true)).toBe(false);
  });

  it("does not flash a game that is not live or is hidden by the spoiler shield", () => {
    expect(shouldFlash(1, 2, false)).toBe(false);
  });
});
