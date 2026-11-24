import { describe, expect, it } from "vitest";
import type { Game } from "../../domain";
import { attendanceLabel, awayShare, periodSpoken, teamStatSpoken } from "./game-page";

const team = (name: string) => ({ id: name, league: "nba", name, abbrev: name });
const game = { away: { team: team("Nuggets"), score: 151 }, home: { team: team("Bulls"), score: 145 } } as Game;

describe("game page helpers", () => {
  it("splits a stat's bar by each team's share, evenly at 0-0, and not at all without numbers", () => {
    expect(awayShare({ label: "Rebounds", away: "30", home: "10", awayValue: 30, homeValue: 10 })).toBe(0.75);
    expect(awayShare({ label: "Blocks", away: "0", home: "0", awayValue: 0, homeValue: 0 })).toBe(0.5);
    expect(awayShare({ label: "Record", away: "10-5", home: "4-12" })).toBeUndefined();
  });

  it("says a stat and a period with the team names", () => {
    expect(teamStatSpoken({ label: "Field goal %", away: "53%", home: "52%" }, game)).toBe(
      "Field goal %: Nuggets 53%, Bulls 52%",
    );
    expect(periodSpoken("OT", 20, 14, game)).toBe("OT: Nuggets 20, Bulls 14");
    expect(periodSpoken("3rd", null, null, game)).toBe("3rd: not played yet");
  });

  it("separates thousands in the attendance", () => {
    expect(attendanceLabel(19360)).toBe("19,360");
    expect(attendanceLabel(950)).toBe("950");
    expect(attendanceLabel(1234567)).toBe("1,234,567");
  });
});
