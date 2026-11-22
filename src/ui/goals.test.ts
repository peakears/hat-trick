import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapGoals } from "../adapters/nhl/mappers";
import { RawScoreResponseSchema } from "../adapters/nhl/raw-types";
import type { Goal } from "../domain";
import { scorerGameGoalNumbers } from "./goals";

describe("goal numbers on the recorded scores", () => {
  // Multi-goal games from the 2026-11-17 scores: a hat trick (Schaefer) and two players with two (Podkolzin, Tkachuk).
  const scores = RawScoreResponseSchema.parse(
    JSON.parse(readFileSync(new URL("../adapters/nhl/__fixtures__/score-2026-11-17.json", import.meta.url), "utf8")),
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
