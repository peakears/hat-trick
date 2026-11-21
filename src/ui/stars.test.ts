import { describe, expect, it } from "vitest";
import type { GameStar } from "../domain";
import { initials, starAccessibilityLabel, starPlayerLine, starStatLine, starTitle } from "./stars";

const kuemper: GameStar = {
  rank: 1,
  player: { id: "8475311", league: "nhl", name: "D. Kuemper", teamId: "LAK", position: "G" },
  sweaterNumber: 35,
  stats: [
    { value: "29", label: "saves" },
    { value: "1.000", label: "SV%" },
  ],
};

describe("three stars text", () => {
  it("names the stars", () => {
    expect([1, 2, 3, 4].map(starTitle)).toEqual(["First star", "Second star", "Third star", "Star 4"]);
  });

  it("describes the player and their game", () => {
    expect(starPlayerLine(kuemper)).toBe("LAK · #35 · G");
    expect(starStatLine(kuemper)).toBe("29 saves · 1.000 SV%");
    expect(starAccessibilityLabel(kuemper)).toBe("First star, D. Kuemper, LAK, 29 saves, 1.000 SV%");
  });

  it("leaves out what is unknown", () => {
    const bare: GameStar = { rank: 2, player: { id: "1", league: "nhl", name: "A. Player" }, stats: [] };
    expect(starPlayerLine(bare)).toBe("");
    expect(starStatLine(bare)).toBe("");
    expect(starAccessibilityLabel(bare)).toBe("Second star, A. Player");
  });

  it("makes initials for the headshot fallback", () => {
    expect(initials("D. Kuemper")).toBe("DK");
    expect(initials("J. van Riemsdyk")).toBe("JR");
    expect(initials("Sidney")).toBe("S");
    expect(initials("")).toBe("");
  });
});
