import type { Goal } from "../domain";

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

export function assistsLabel(goal: Goal): string {
  return goal.assists.length === 0 ? "Unassisted" : goal.assists.map((a) => a.name).join(", ");
}

/** The score after the goal in the game page's order, away first: "1–0". Undefined when unknown. */
export function scoreAfterLabel(goal: Goal): string | undefined {
  if (goal.awayScore === undefined || goal.homeScore === undefined) return undefined;
  return `${goal.awayScore}–${goal.homeScore}`;
}
