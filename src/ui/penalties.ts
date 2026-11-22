import type { Goal, Penalty } from "../domain";

// Pure helpers for the game page's penalty summary.

export interface PenaltyPeriod {
  label: string; // "1st", "OT"
  penalties: Penalty[];
}

/** Penalties shown before "Show more". A rough game has 15 or more, which would push the box score row far down. */
export const PENALTIES_COLLAPSED = 5;

/**
 * The penalties to show, in the order taken, and how many more are behind "Show more". One extra penalty is shown
 * rather than hidden behind a "Show 1 more" toggle.
 */
export function visiblePenalties<T>(penalties: readonly T[], expanded: boolean): { shown: T[]; more: number } {
  const all = expanded || penalties.length <= PENALTIES_COLLAPSED + 1;
  const shown = all ? [...penalties] : penalties.slice(0, PENALTIES_COLLAPSED);
  return { shown, more: penalties.length - shown.length };
}

/** Groups penalties by period, keeping the order taken. */
export function groupPenaltiesByPeriod(penalties: Penalty[]): PenaltyPeriod[] {
  const out: PenaltyPeriod[] = [];
  for (const penalty of penalties) {
    const last = out[out.length - 1];
    if (last && last.label === penalty.periodLabel) last.penalties.push(penalty);
    else out.push({ label: penalty.periodLabel, penalties: [penalty] });
  }
  return out;
}

/** "2 min", "4 min" (double minor), "Penalty shot". */
export function penaltyLengthLabel(penalty: Penalty): string {
  return penalty.kind === "penaltyShot" ? "Penalty shot" : `${penalty.minutes} min`;
}

/** "M. Geekie" or "Bench" for a team penalty with no player named. */
export function penaltyPlayerLabel(penalty: Penalty): string {
  return penalty.player ?? "Bench";
}

/** "Roughing · drawn by Q. Byfield". */
export function penaltyDetailLabel(penalty: Penalty): string {
  return penalty.drawnBy ? `${penalty.infraction} · drawn by ${penalty.drawnBy}` : penalty.infraction;
}

/** Penalty minutes per team, in the order given ("PIM" in the summary's header). Penalty shots count 0. */
export function penaltyMinutesByTeam(penalties: Penalty[], teamIds: string[]): { teamId: string; minutes: number }[] {
  return teamIds.map((teamId) => ({
    teamId,
    minutes: penalties.reduce((sum, p) => (p.teamId === teamId ? sum + p.minutes : sum), 0),
  }));
}

const PERIOD_SECONDS = 20 * 60;

/** Seconds since puck drop. Overtime starts after the last regulation period, so ordering holds across periods. */
function gameSeconds(period: number, time: string): number | undefined {
  const m = /^(\d+):(\d{2})$/.exec(time);
  if (!m) return undefined;
  return (period - 1) * PERIOD_SECONDS + Number(m[1]) * 60 + Number(m[2]);
}

/** Kinds that put a team short-handed for their minutes (misconducts do not). */
const SHORT_HANDED_KINDS = new Set<Penalty["kind"]>(["minor", "doubleMinor", "major", "match"]);

/**
 * For each penalty, the power-play goal it led to: the first power-play goal by the other team while the penalty
 * ran, not already matched to an earlier penalty. Undefined for none. A best guess from times alone (the league does
 * not link them), so two overlapping penalties by the same team are matched in the order taken.
 */
export function powerPlayGoals(penalties: Penalty[], goals: Goal[] | undefined): (Goal | undefined)[] {
  const used = new Set<Goal>();
  const ppGoals = (goals ?? []).filter((g) => g.strength === "powerPlay" && g.periodLabel !== "SO");
  return penalties.map((p) => {
    if (!SHORT_HANDED_KINDS.has(p.kind) || p.minutes <= 0) return undefined;
    const start = gameSeconds(p.period, p.time);
    if (start === undefined) return undefined;
    const end = start + p.minutes * 60;
    const goal = ppGoals.find((g) => {
      if (used.has(g) || g.teamId === p.teamId) return false;
      const at = gameSeconds(g.period, g.time);
      // A goal at the same second as the call was scored before it; one at the last second still counts.
      return at !== undefined && at > start && at <= end;
    });
    if (goal) used.add(goal);
    return goal;
  });
}
