import { describe, expect, it } from "vitest";
import type { Play } from "../../domain";
import { isKeyPlay, playPeriods, playScoreLabel, playSpoken } from "./plays";

const play = (id: string, periodLabel: string, kind: Play["kind"], extra: Partial<Play> = {}): Play => ({
  id,
  period: { "1st": 1, "2nd": 2, "3rd": 3, OT: 4 }[periodLabel] ?? 1,
  periodLabel,
  time: "05:00",
  kind,
  text: `Play ${id}`,
  ...extra,
});

const plays = [
  play("1", "1st", "other"),
  play("2", "1st", "score", { teamId: "TOR", awayScore: 1, homeScore: 0 }),
  play("3", "2nd", "shot"),
  play("4", "2nd", "penalty"),
  play("5", "3rd", "other"),
];

const ids = (periods: ReturnType<typeof playPeriods>) => periods.map((p) => [p.label, p.plays.map((x) => x.id)]);

describe("playPeriods", () => {
  it("groups every play by period, in order, for a finished game", () => {
    expect(ids(playPeriods(plays, { filter: "all", newestFirst: false }))).toEqual([
      ["1st", ["1", "2"]],
      ["2nd", ["3", "4"]],
      ["3rd", ["5"]],
    ]);
  });

  it("puts the latest period and play first for a live game", () => {
    expect(ids(playPeriods(plays, { filter: "all", newestFirst: true }))).toEqual([
      ["3rd", ["5"]],
      ["2nd", ["4", "3"]],
      ["1st", ["2", "1"]],
    ]);
  });

  it("keeps only scores and penalties for key plays, leaving out periods without one", () => {
    expect(ids(playPeriods(plays, { filter: "key", newestFirst: false }))).toEqual([
      ["1st", ["2"]],
      ["2nd", ["4"]],
    ]);
    expect(isKeyPlay(play("x", "1st", "shot"))).toBe(false);
  });

  it("does not change the list it was given", () => {
    const copy = [...plays];
    playPeriods(plays, { filter: "all", newestFirst: true });
    expect(plays).toEqual(copy);
  });
});

describe("play labels", () => {
  it("shows the score after a scoring play, away first", () => {
    expect(playScoreLabel(plays[1])).toBe("1–0");
    expect(playScoreLabel(plays[0])).toBeUndefined();
  });

  it("reads a play out with its period, time, team, tag and score", () => {
    expect(playSpoken({ ...plays[1], tag: "Power play" })).toBe("1st, 05:00, TOR. Play 2, power play, 1–0");
    expect(playSpoken(plays[0])).toBe("1st, 05:00. Play 1");
  });
});
