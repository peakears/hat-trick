import { describe, expect, it } from "vitest";
import type { Game } from "../../domain";
import { showLiveDetail, standoutText } from "./game-card";

const periods = [{ label: "Q1", away: 24, home: 29 }];
const standout = { name: "J. Brunson", teamId: "NY", line: "31 PTS" };
const game = (over: Partial<Game>) => ({ status: "live", ...over }) as Game;

describe("Scores card", () => {
  it("shows periods and the standout only for a live game the shield does not hide", () => {
    expect(showLiveDetail(game({ periods }), false)).toBe(true);
    expect(showLiveDetail(game({ standout }), false)).toBe(true);
    expect(showLiveDetail(game({ periods, standout }), true)).toBe(false);
    expect(showLiveDetail(game({ status: "final", periods, standout }), false)).toBe(false);
    expect(showLiveDetail(game({ periods: [] }), false)).toBe(false);
  });

  it("words the standout for the card and for a screen reader", () => {
    expect(standoutText(standout)).toEqual({
      shown: "J. Brunson NY · 31 PTS",
      spoken: "Top performer: J. Brunson, NY, 31 PTS",
    });
  });
});
