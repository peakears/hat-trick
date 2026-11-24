// First-run setup (issue #120). Pure: step order and the team picker's groups, tested in onboarding.test.ts.
import type { LeagueId, Standings, Team } from "../../domain";
import { favoriteLeague } from "../team/favorites";

/**
 * Every step, in order. Add a step here and give it a view in `app/welcome.tsx`; navigation and the progress dots
 * follow the list `stepsFor` gives.
 */
// Notifications follow the teams they are for; the look comes last, after the choices about games.
export const ONBOARDING_STEPS = ["welcome", "leagues", "teams", "notifications", "options", "look", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The steps for an app with `leagueCount` leagues: with one, there is no league to pick. */
export function stepsFor(leagueCount: number): readonly OnboardingStep[] {
  return leagueCount > 1 ? ONBOARDING_STEPS : ONBOARDING_STEPS.filter((s) => s !== "leagues");
}

export function nextStep(
  step: OnboardingStep,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): OnboardingStep | null {
  return steps[steps.indexOf(step) + 1] ?? null;
}

export function previousStep(
  step: OnboardingStep,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): OnboardingStep | null {
  const index = steps.indexOf(step);
  return index > 0 ? steps[index - 1] : null;
}

/**
 * Where this step sits among the ones with choices to make (not the welcome and done pages), for the progress
 * dots; null for those two.
 */
export function stepProgress(
  step: OnboardingStep,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): { index: number; total: number } | null {
  const middle = steps.slice(1, -1);
  const index = middle.indexOf(step);
  return index < 0 ? null : { index, total: middle.length };
}

/** "NHL", "NHL and NBA", "NHL, NBA and MLB": the leagues named in the welcome text. */
export function leaguesSentence(abbrevs: readonly string[]): string {
  if (abbrevs.length <= 1) return abbrevs[0] ?? "";
  return `${abbrevs.slice(0, -1).join(", ")} and ${abbrevs[abbrevs.length - 1]}`;
}

/**
 * The leagues setup shows as followed: every league while Scores shows All, else the one league Scores shows
 * (`league`, already checked against the app's leagues).
 */
export function followedLeagues(
  settings: { scoresAllLeagues: boolean },
  league: LeagueId,
  available: readonly LeagueId[],
): LeagueId[] {
  return settings.scoresAllLeagues ? [...available] : [league];
}

/**
 * What tapping a league in "Which leagues do you follow?" saves. More than one followed: Scores shows All (and the
 * tabs keep their league if it is still followed). One: Scores shows that league alone. The last one cannot be
 * turned off.
 */
export function toggleFollowedLeague(
  followed: readonly LeagueId[],
  tapped: LeagueId,
  available: readonly LeagueId[],
  current: LeagueId,
): { league: LeagueId; scoresAllLeagues: boolean } {
  const on = followed.includes(tapped);
  const next = on ? followed.filter((l) => l !== tapped) : [...followed, tapped];
  const kept = available.filter((l) => next.includes(l));
  if (kept.length === 0) return { league: tapped, scoresAllLeagues: false };
  if (kept.length === 1) return { league: kept[0], scoresAllLeagues: false };
  return { league: kept.includes(current) ? current : kept[0], scoresAllLeagues: true };
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

/**
 * What the live scores switch in setup says: like reminders, it follows favourite teams. The spoiler shield (on the
 * same step) holds back scoring alerts, so with it on the hint says so, as Settings does.
 */
export function liveHint(
  favoriteCount: number,
  available: boolean,
  permissionDenied: boolean,
  spoilerShield = false,
): string {
  if (!available) return "Available in the installed Android app (not in Expo Go).";
  if (permissionDenied) return "Notifications are blocked. Allow them for Hat Trick in your phone's settings.";
  if (favoriteCount === 0) return "Pick a favourite team first. Live scores follow their games.";
  return spoilerShield
    ? "Their game in a notification, even with the app closed. No scores or scoring alerts while the spoiler shield is on."
    : "Their score in a notification during their games, even with the app closed, and scoring alerts.";
}

/** The favourites (keys) in the leagues setup has as followed: what its team step counts and Done lists. */
export function followedFavorites(favorites: readonly string[], followed: readonly LeagueId[]): string[] {
  return favorites.filter((key) => followed.includes(favoriteLeague(key)));
}

/**
 * The leagues with favourites that are not followed: unfollowing a league in setup keeps its teams (and their
 * reminders and live scores), and Done says so. In the order their first favourite was picked.
 */
export function keptLeagues(favorites: readonly string[], followed: readonly LeagueId[]): LeagueId[] {
  return [...new Set(favorites.map(favoriteLeague))].filter((l) => !followed.includes(l));
}

/** "Your NBA teams are kept, with their reminders and live scores." for Done, or nothing with none kept. */
export function keptNote(leagues: readonly LeagueId[]): string | undefined {
  if (leagues.length === 0) return undefined;
  return `Your ${leaguesSentence(leagues.map((l) => l.toUpperCase()))} teams are kept, with their reminders and live scores. Remove them in Settings › Favourite teams.`;
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
