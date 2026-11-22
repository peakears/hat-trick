// First-run setup (issue #120). Pure: step order and the team picker's groups, tested in onboarding.test.ts.
import type { Standings, Team } from "../domain";

/**
 * The steps, in order. Add a step here (e.g. "Which leagues do you follow?" with a second league) and give it a
 * view in `app/welcome.tsx`; navigation and the progress dots follow this list.
 */
export const ONBOARDING_STEPS = ["welcome", "teams", "look", "options", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

/**
 * Where this step sits among the ones with choices to make (not the welcome and done pages), for the progress
 * dots; null for those two.
 */
export function stepProgress(step: OnboardingStep): { index: number; total: number } | null {
  const middle = ONBOARDING_STEPS.slice(1, -1);
  const index = middle.indexOf(step as (typeof middle)[number]);
  return index < 0 ? null : { index, total: middle.length };
}

/** The setup screen is shown at launch once settings are read and setup was never finished or skipped. */
export function shouldShowOnboarding(loaded: boolean, onboardingComplete: boolean): boolean {
  return loaded && !onboardingComplete;
}

/** What the reminders switch in setup says: reminders follow favourite teams, so it needs one first. */
export function reminderHint(favoriteCount: number, permissionDenied: boolean): string {
  if (permissionDenied) return "Notifications are blocked. Allow them for Hat Trick in your phone's settings.";
  if (favoriteCount === 0) return "Pick a favourite team first. Reminders are for their games.";
  return favoriteCount === 1
    ? "A notification before your team's games."
    : `A notification before your ${favoriteCount} teams' games.`;
}

export interface TeamGroup {
  /** "Atlantic", or the standings group's name when the league has no divisions. */
  title: string;
  conference?: string;
  teams: Team[];
}

/**
 * Every team, for the setup's team picker: by division, Eastern Conference first, teams A to Z within a division
 * (easier to find your team than standings order).
 */
export function teamsByDivision(standings: Standings | undefined): TeamGroup[] {
  const groups = new Map<string, TeamGroup>();
  const seen = new Set<string>();
  for (const group of standings?.groups ?? []) {
    for (const row of group.rows) {
      if (seen.has(row.team.id)) continue;
      seen.add(row.team.id);
      const title = row.divisionName ?? group.name;
      const key = `${row.conferenceName ?? ""}|${title}`;
      let target = groups.get(key);
      if (!target) {
        target = { title, conference: row.conferenceName, teams: [] };
        groups.set(key, target);
      }
      target.teams.push(row.team);
    }
  }
  const out = [...groups.values()];
  for (const g of out) g.teams.sort((a, b) => a.name.localeCompare(b.name));
  return out.sort(
    (a, b) =>
      // Groups with no conference go last.
      (a.conference === undefined ? 1 : 0) - (b.conference === undefined ? 1 : 0) ||
      (a.conference ?? "").localeCompare(b.conference ?? "") ||
      a.title.localeCompare(b.title),
  );
}
