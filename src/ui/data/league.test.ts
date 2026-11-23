import { describe, expect, it } from "vitest";
import { pickLeague } from "./league";

describe("pickLeague", () => {
  it("shows the picked league when the app has it", () => {
    expect(pickLeague("nba", ["nhl", "nba"])).toBe("nba");
  });

  it("falls back to the first league for one the app does not have", () => {
    expect(pickLeague("mlb", ["nhl", "nba"])).toBe("nhl");
    expect(pickLeague("nba", ["nhl"])).toBe("nhl");
  });
});
