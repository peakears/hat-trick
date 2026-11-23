import { describe, expect, it } from "vitest";
import type { Goal } from "../../domain";
import { goalVideoLabel, isOpenableVideoUrl, playableVideos } from "./videos";

describe("videos", () => {
  it("opens only https web pages", () => {
    expect(isOpenableVideoUrl("https://www.nhl.com/video/a-1")).toBe(true);
    for (const bad of [undefined, "", "http://nhl.com/video/a", "javascript:alert(1)", "intent://x", "https://"]) {
      expect(isOpenableVideoUrl(bad)).toBe(false);
    }
  });

  it("lists the recap first and drops links that cannot be opened", () => {
    expect(
      playableVideos([
        { kind: "condensed", url: "https://www.nhl.com/video/c" },
        { kind: "recap", url: "https://www.nhl.com/video/r" },
      ]).map((v) => v.kind),
    ).toEqual(["recap", "condensed"]);
    expect(playableVideos([{ kind: "recap", url: "file:///sdcard/x" }])).toEqual([]);
    expect(playableVideos(undefined)).toEqual([]);
  });

  it("names the goal in the play button's label", () => {
    const goal = {
      teamId: "LAK",
      period: 1,
      periodLabel: "1st",
      time: "15:46",
      scorer: { id: "1", league: "nhl", name: "M. Zuccarello" },
      assists: [],
      strength: "even",
      emptyNet: false,
      penaltyShot: false,
    } satisfies Goal;
    expect(goalVideoLabel(goal)).toBe("Watch M. Zuccarello's goal at 15:46 of the 1st");
  });
});
