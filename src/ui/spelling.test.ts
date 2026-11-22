import { describe, expect, it } from "vitest";
import { spell, spellingForRegion } from "./spelling";

describe("spelling", () => {
  it("uses American spelling only for a US phone region", () => {
    expect(spellingForRegion("US")).toBe("american");
    expect(spellingForRegion("us")).toBe("american");
    for (const region of ["CA", "GB", "SE", null, undefined]) expect(spellingForRegion(region)).toBe("canadian");
  });

  it("switches each listed word, keeping capitals and plurals", () => {
    expect(spell("Favourite teams", "american")).toBe("Favorite teams");
    expect(spell("Add Toronto to favourites", "american")).toBe("Add Toronto to favorites");
    expect(spell("Accent colour", "american")).toBe("Accent color");
    expect(spell("LAK · #8 · Defence", "american")).toBe("LAK · #8 · Defense");
    expect(spell("Centre", "american")).toBe("Center");
    expect(spell("for example when travelling.", "american")).toBe("for example when traveling.");
  });

  it("turns the adapter's American words Canadian too", () => {
    expect(spell("Defense", "canadian")).toBe("Defence");
    expect(spell("Favorite", "canadian")).toBe("Favourite");
    expect(spell("Favourite teams", "canadian")).toBe("Favourite teams");
  });

  it("leaves other words alone, including ones that only contain a listed word", () => {
    expect(spell("Colourful defenceman, Recolor", "american")).toBe("Colourful defenceman, Recolor");
    expect(spell("Goalies", "american")).toBe("Goalies");
  });
});
