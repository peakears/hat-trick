import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapGoals } from "../../adapters/nhl/mappers";
import { RawScoreResponseSchema } from "../../adapters/nhl/raw-types";
import type { Game, GameStatus, Goal } from "../../domain";
import {
  assistsLabel,
  gameGoalTag,
  goalTags,
  groupGoalsByPeriod,
  scoreAfterLabel,
  scorerGameGoalNumbers,
  scorerLabel,
  seasonGoalLabel,
} from "./goals";

describe("goal numbers on the recorded scores", () => {
  // Multi-goal games from the 2026-11-17 scores: a hat trick (Schaefer) and two players with two (Podkolzin, Tkachuk).
  const scores = RawScoreResponseSchema.parse(
    JSON.parse(readFileSync(new URL("../../adapters/nhl/__fixtures__/score-2026-11-17.json", import.meta.url), "utf8")),
  );
  const goalsOf = (id: number) => mapGoals(scores.games!.find((g) => g.id === id)!.goals)!;
  const byScorer = (goals: Goal[], name: string) => {
    const numbers = scorerGameGoalNumbers(goals);
    return goals.flatMap((g, i) => (g.scorer.name === name ? [[g.scorerSeasonGoals, numbers[i]]] : []));
  };

  it("counts up the season total and the goal of the game for each scorer", () => {
    expect(byScorer(goalsOf(2026020336), "M. Schaefer")).toEqual([
      [7, 1],
      [8, 2],
      [9, 3],
    ]);
    const edmFla = goalsOf(2026020335);
    expect(byScorer(edmFla, "V. Podkolzin")).toEqual([
      [11, 1],
      [12, 2],
    ]);
    expect(byScorer(edmFla, "M. Tkachuk")).toEqual([
      [6, 1],
      [7, 2],
    ]);
  });
});

function game(status: GameStatus, extra: Partial<Game> = {}, scores: [number | null, number | null] = [3, 2]): Game {
  const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });
  return {
    id: "1",
    league: "nhl",
    startTime: "2026-11-18T00:00:00Z",
    status,
    home: { team: team("TOR"), score: scores[0] },
    away: { team: team("MTL"), score: scores[1] },
    ...extra,
  };
}

describe("goal summary helpers", () => {
  const goal = (over: Partial<Goal> = {}): Goal => ({
    teamId: "LAK",
    period: 1,
    periodLabel: "1st",
    time: "15:46",
    scorer: { id: "1", league: "nhl", name: "M. Zuccarello" },
    assists: [],
    strength: "even",
    emptyNet: false,
    penaltyShot: false,
    ...over,
  });

  it("groups goals by period in the order scored", () => {
    const periods = groupGoalsByPeriod([
      goal(),
      goal({ time: "02:00" }),
      goal({ periodLabel: "2nd", period: 2 }),
      goal({ periodLabel: "OT", period: 4 }),
    ]);
    expect(periods.map((p) => [p.label, p.goals.length])).toEqual([
      ["1st", 2],
      ["2nd", 1],
      ["OT", 1],
    ]);
    expect(groupGoalsByPeriod([])).toEqual([]);
  });

  it("tags power-play, short-handed, empty-net and penalty-shot goals", () => {
    expect(goalTags(goal())).toEqual([]);
    expect(goalTags(goal({ strength: "powerPlay" }))).toEqual(["PP"]);
    expect(goalTags(goal({ strength: "shortHanded", emptyNet: true }))).toEqual(["SH", "EN"]);
    expect(goalTags(goal({ penaltyShot: true }))).toEqual(["PS"]);
  });

  it("lists assists, or says unassisted", () => {
    expect(assistsLabel(goal())).toBe("Unassisted");
    const a = (name: string) => ({ id: name, league: "nhl", name });
    expect(assistsLabel(goal({ assists: [a("E. Gustafsson"), a("B. Clarke")] }))).toBe("E. Gustafsson, B. Clarke");
  });

  it("puts the goal of the game after the scorer from the 2nd on, and the season goal in words", () => {
    expect(scorerLabel(goal(), 1)).toBe("M. Zuccarello");
    expect(scorerLabel(goal(), 0)).toBe("M. Zuccarello"); // shootout
    expect(scorerLabel(goal(), 3)).toBe("M. Zuccarello (3)");
    expect(seasonGoalLabel(goal({ scorerSeasonGoals: 21 }))).toBe("21st goal");
    expect(seasonGoalLabel(goal({ scorerSeasonGoals: 12 }))).toBe("12th goal");
    expect(seasonGoalLabel(goal())).toBeUndefined();
  });

  it("numbers each scorer's goals in the game, skipping the shootout", () => {
    const by = (id: string, periodLabel = "1st") => goal({ scorer: { id, league: "nhl", name: id }, periodLabel });
    const goals = [by("A"), by("B"), by("A"), by("A", "3rd"), by("A", "SO"), by("B", "OT"), by("A", "OT")];
    expect(scorerGameGoalNumbers(goals)).toEqual([1, 1, 2, 3, 0, 2, 4]);
    expect([0, 1, 2, 3, 4].map(gameGoalTag)).toEqual([undefined, undefined, undefined, "Hat trick", undefined]);
  });

  it("shows the score after the goal, away first", () => {
    expect(scoreAfterLabel(goal({ awayScore: 2, homeScore: 1 }))).toBe("2–1");
    expect(scoreAfterLabel(goal())).toBeUndefined();
  });
});
