import type { Goal } from "../../domain";
import { ordinal } from "../team/team";

export interface GoalPeriod {
  label: string; // "1st", "OT"
  goals: Goal[];
}

/** Groups goals by period, keeping the order scored. */
export function groupGoalsByPeriod(goals: Goal[]): GoalPeriod[] {
  const out: GoalPeriod[] = [];
  for (const goal of goals) {
    const last = out[out.length - 1];
    if (last && last.label === goal.periodLabel) last.goals.push(goal);
    else out.push({ label: goal.periodLabel, goals: [goal] });
  }
  return out;
}

/** Short tags after the scorer: "PP", "SH", "EN", "PS". Empty for a plain even-strength goal. */
export function goalTags(goal: Goal): string[] {
  const tags: string[] = [];
  if (goal.strength === "powerPlay") tags.push("PP");
  if (goal.strength === "shortHanded") tags.push("SH");
  if (goal.emptyNet) tags.push("EN");
  if (goal.penaltyShot) tags.push("PS");
  return tags;
}

/** "M. Schaefer (3)" for a scorer's 2nd or later goal of the game (`gameGoal` from `scorerGameGoalNumbers`). */
export function scorerLabel(goal: Goal, gameGoal: number): string {
  return gameGoal >= 2 ? `${goal.scorer.name} (${gameGoal})` : goal.scorer.name;
}

/** "9th goal": which goal of the season it was for the scorer. Undefined when unknown (and on shootout goals). */
export function seasonGoalLabel(goal: Goal): string | undefined {
  return goal.scorerSeasonGoals === undefined ? undefined : `${ordinal(goal.scorerSeasonGoals)} goal`;
}

export function assistsLabel(goal: Goal): string {
  return goal.assists.length === 0 ? "Unassisted" : goal.assists.map((a) => a.name).join(", ");
}

/**
 * For each goal, which of the scorer's goals in this game it is (1 for their first). Shootout goals are not
 * counted and get 0.
 */
export function scorerGameGoalNumbers(goals: Goal[]): number[] {
  const counts = new Map<string, number>();
  return goals.map((goal) => {
    if (goal.periodLabel === "SO") return 0;
    const n = (counts.get(goal.scorer.id) ?? 0) + 1;
    counts.set(goal.scorer.id, n);
    return n;
  });
}

/** "Hat trick" on a scorer's 3rd goal of the game. */
export function gameGoalTag(gameGoal: number): string | undefined {
  return gameGoal === 3 ? "Hat trick" : undefined;
}

/** The score after the goal in the game page's order, away first: "1–0". Undefined when unknown. */
export function scoreAfterLabel(goal: Goal): string | undefined {
  if (goal.awayScore === undefined || goal.homeScore === undefined) return undefined;
  return `${goal.awayScore}–${goal.homeScore}`;
}
