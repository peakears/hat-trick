import { describe, expect, it } from "vitest";
import type { Game } from "../../domain";
import { showLiveDetail, situationText, standoutText } from "./game-card";

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

  it("shows where play stands on a live card, and not behind the shield", () => {
    const situation = { text: "2nd & 8 at DET 22" };
    expect(showLiveDetail(game({ situation }), false)).toBe(true);
    expect(showLiveDetail(game({ situation }), true)).toBe(false);
    expect(showLiveDetail(game({ status: "final", situation }), false)).toBe(false);
  });

  it("words the situation with the team that has the ball, and the red zone", () => {
    const team = (id: string, name: string) => ({ id, league: "nfl", name, abbrev: id });
    const sides = {
      away: { team: team("CHI", "Chicago Bears"), score: 3 },
      home: { team: team("DET", "Detroit Lions"), score: 10 },
    };
    expect(situationText({ text: "2nd & 8 at DET 22", possessionTeamId: "CHI" }, sides)).toEqual({
      possession: "CHI",
      text: "2nd & 8 at DET 22",
      redZone: false,
      spoken: "Chicago Bears ball, 2nd and 8 at DET 22",
    });
    expect(situationText({ text: "1st & Goal at CHI 4", possessionTeamId: "DET", redZone: true }, sides)).toEqual({
      possession: "DET",
      text: "1st & Goal at CHI 4",
      redZone: true,
      spoken: "Detroit Lions ball, 1st and Goal at CHI 4, in the red zone",
    });
    // A team the game does not have is left out rather than guessed.
    expect(situationText({ text: "3rd & 2 at BUF 40", possessionTeamId: "XYZ" }, sides).possession).toBeUndefined();
  });

  it("words the standout for the card and for a screen reader", () => {
    expect(standoutText(standout)).toEqual({
      shown: "J. Brunson NY · 31 PTS",
      spoken: "Top performer: J. Brunson, NY, 31 PTS",
    });
  });
});
