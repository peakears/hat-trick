// Pure rules for following favourite teams' live games in notifications (#114): which games to follow, what the
// ongoing score notification says, which goals to announce, and when to stop. The service that runs them is
// live-tracker-run.ts; the only notification code is live-tracker-native.ts. Tested in live-tracker.test.ts.
import type { Game, GameDetail, Goal, LeagueId, LiveAlertRule } from "../../domain";
import { favoritesFor } from "../team/favorites";
import { gameStatusLabel } from "../common/format";
import { goalTags, scorerGameGoalNumbers, scorerLabel, seasonGoalLabel } from "../game/goals";

/** How often the service checks a followed game. Live games are fresh for 20 s, so this is at most one request. */
export const TRACK_POLL_MS = 30_000;
/** A favourite's game is followed from this long before puck drop, so the notification is up when it starts. */
export const TRACK_LEAD_MS = 15 * 60_000;
/** A game still "scheduled" this long after its start time is not waited for (delayed, or the data is stale). */
export const TRACK_LATE_MS = 3 * 60 * 60_000;

/** A followed game's key, which its notifications carry so a tap opens it: "nba:401910043". */
export function followKey(game: { league: LeagueId; id: string }): string {
  return `${game.league}:${game.id}`;
}

/** The game a tapped notification names. A bare id is from before notifications carried a league: the NHL's. */
export function parseFollowKey(key: string): { league: LeagueId; id: string } {
  const at = key.indexOf(":");
  return at < 0 ? { league: "nhl", id: key } : { league: key.slice(0, at), id: key.slice(at + 1) };
}

/**
 * The games worth following now: a favourite team's, live or starting within TRACK_LEAD_MS. `favorites` are
 * `league:team` keys, matched in each game's own league.
 */
export function gamesToFollow(games: readonly Game[], favorites: readonly string[], now: number): Game[] {
  return games.filter((g) => {
    const fav = new Set(favoritesFor(g.league, favorites));
    if (!fav.has(g.home.team.id) && !fav.has(g.away.team.id)) return false;
    if (g.status === "live") return true;
    if (g.status !== "scheduled") return false;
    const start = Date.parse(g.startTime);
    return start - now <= TRACK_LEAD_MS && now - start <= TRACK_LATE_MS;
  });
}

/** What the tracker remembers about a followed game between checks. */
export interface FollowState {
  gameId: string;
  awayScore: number;
  homeScore: number;
  /** Goals in the goal list at the last check; undefined while the list could not be loaded. */
  goalCount?: number;
  /** The period at the last check (lateLeadChanges: overtime is announced as it starts). */
  period?: number;
  /** The team last seen ahead, -1 away or 1 home, kept through a tie (lateLeadChanges: a change of lead). */
  leader?: -1 | 1;
}

export interface Alert {
  /** Stable per goal, so a repeated check never posts the same goal twice. */
  id: string;
  title: string;
  body: string;
}

export interface FollowUpdate {
  state: FollowState;
  /** The ongoing notification's text; null once the game is over (remove it). */
  ongoing: { title: string; body: string } | null;
  alerts: Alert[];
  /** The game is over (or postponed): stop following it. */
  done: boolean;
}

export interface FollowOptions {
  /** The spoiler shield is on: no scores, scorers or results anywhere in the notifications. */
  hidden: boolean;
  /** Post a notification for each goal (and the final). */
  goalAlerts: boolean;
  /** The time of this check; a game still scheduled TRACK_LATE_MS after its start is given up on. */
  now?: number;
  /** The league's rule for what to announce (SportsData.liveAlerts); each score if not given. */
  rule?: LiveAlertRule;
}

const abbrevs = (game: Game) => `${game.away.team.abbrev} at ${game.home.team.abbrev}`;

/** "TOR 2–1 CHI", away first like the rest of the app. */
export function scoreLine(game: Game): string {
  return `${game.away.team.abbrev} ${game.away.score ?? 0}–${game.home.score ?? 0} ${game.home.team.abbrev}`;
}

/** The ongoing notification while a game is followed. */
export function ongoingText(game: Game, hidden: boolean): { title: string; body: string } {
  if (game.status === "scheduled") return { title: abbrevs(game), body: `Starts ${gameStatusLabel(game)}` };
  if (hidden) return { title: abbrevs(game), body: `${gameStatusLabel(game)} · score hidden` };
  return { title: scoreLine(game), body: gameStatusLabel(game) };
}

/** "Goal: TOR", then "M. Marner (2) · PP · 9th goal · 2nd 15:46 · TOR 2–1 CHI" (whatever is known). */
function goalAlert(game: Game, goal: Goal, gameGoal: number, scoreAfter: string): Alert {
  const parts = [
    scorerLabel(goal, gameGoal),
    goalTags(goal).join(" "),
    gameGoal === 3 ? "Hat trick" : "",
    seasonGoalLabel(goal) ?? "",
    `${goal.periodLabel} ${goal.time}`,
    scoreAfter,
  ].filter(Boolean);
  return {
    id: `goal:${game.league}:${game.id}:${goal.period}:${goal.time}:${goal.scorer.id}`,
    title: `Goal: ${goal.teamId}`,
    body: parts.join(" · "),
  };
}

/**
 * Compares a check of a followed game with the last one. The first check (no `previous`) announces nothing, so
 * goals scored before following started are not replayed. A goal is announced from the goal list when it has it
 * (with the scorer), else from the score going up; a goal taken back (the score going down) is not announced.
 */
export function followUpdate(
  previous: FollowState | undefined,
  detail: GameDetail,
  options: FollowOptions,
): FollowUpdate {
  const { game, goals } = detail;
  const rule = options.rule ?? { kind: "eachScore" };
  const awayScore = game.away.score ?? 0;
  const homeScore = game.home.score ?? 0;
  const ahead = awayScore === homeScore ? undefined : awayScore > homeScore ? -1 : 1;
  const state: FollowState = {
    gameId: game.id,
    awayScore,
    homeScore,
    goalCount: goals?.length ?? previous?.goalCount,
    period: game.clock?.period ?? previous?.period,
    leader: ahead ?? previous?.leader,
  };
  const givenUp =
    game.status === "scheduled" &&
    options.now !== undefined &&
    options.now - Date.parse(game.startTime) > TRACK_LATE_MS;
  const done = game.status === "final" || game.status === "postponed" || givenUp;
  const alerts: Alert[] = [];
  const announce = previous !== undefined && options.goalAlerts && !options.hidden;

  if (announce && game.status !== "postponed") {
    const scoreAfter = scoreLine(game);
    if (rule.kind === "lateLeadChanges") {
      alerts.push(...lateMoments(game, previous, state, rule.regulationPeriods));
    } else if (goals && previous.goalCount !== undefined && goals.length > previous.goalCount) {
      const numbers = scorerGameGoalNumbers(goals);
      for (let i = previous.goalCount; i < goals.length; i++) {
        if (goals[i].periodLabel === "SO") continue; // shootout attempts are not goals
        alerts.push(goalAlert(game, goals[i], numbers[i], scoreAfter));
      }
    } else if (!goals || previous.goalCount === undefined) {
      // No goal list to compare with: announce from the score. With a list, a goal the score already shows but the
      // list does not yet (they come from different requests) waits for the list, or it would be announced twice.
      const sides: ["away" | "home", number, number][] = [
        ["away", previous.awayScore, state.awayScore],
        ["home", previous.homeScore, state.homeScore],
      ];
      for (const [side, before, after] of sides) {
        for (let n = before + 1; n <= after; n++) {
          const abbrev = game[side].team.abbrev;
          alerts.push({
            id: `goal:${game.league}:${game.id}:${side}:${n}`,
            title: `Goal: ${abbrev}`,
            body: scoreAfter,
          });
        }
      }
    }
    if (game.status === "final") {
      alerts.push({
        id: `final:${game.league}:${game.id}`,
        title: `Final: ${scoreLine(game)}`,
        body: gameStatusLabel(game),
      });
    }
  }

  return { state, ongoing: done ? null : ongoingText(game, options.hidden), alerts, done };
}

/**
 * lateLeadChanges: from the last regulation period on, a change of lead (from one team to the other, through a tie
 * or not) and the start of each overtime. Earlier lead changes and every basket are left to the ongoing notification.
 */
function lateMoments(game: Game, previous: FollowState, state: FollowState, regulationPeriods: number): Alert[] {
  if (game.status !== "live") return [];
  const period = game.clock?.period ?? 0;
  const status = gameStatusLabel(game);
  const alerts: Alert[] = [];
  if (period > regulationPeriods && (previous.period ?? 0) < period) {
    alerts.push({
      id: `overtime:${game.league}:${game.id}:${period}`,
      title: `${game.clock?.label ?? "Overtime"}: ${scoreLine(game)}`,
      body: period === regulationPeriods + 1 ? "Tied at the end of regulation" : "Still tied",
    });
  }
  const changed = previous.leader !== undefined && state.leader !== undefined && state.leader !== previous.leader;
  if (period >= regulationPeriods && changed) {
    const leading = state.leader === -1 ? game.away.team.abbrev : game.home.team.abbrev;
    alerts.push({
      id: `lead:${game.league}:${game.id}:${state.awayScore}-${state.homeScore}`,
      title: `Lead change: ${leading}`,
      body: `${scoreLine(game)} · ${status}`,
    });
  }
  return alerts;
}

/**
 * The one ongoing notification for every followed game (Android shows a single foreground service notification).
 * One game: its own text, and a tap opens it. Several: a line each, and a tap opens the app.
 */
export function ongoingSummary(games: { gameId: string; title: string; body: string }[]): {
  title: string;
  body: string;
  gameId?: string;
} {
  if (games.length === 1) return games[0];
  return { title: `Following ${games.length} games`, body: games.map((g) => `${g.title} · ${g.body}`).join("\n") };
}

/** A second report of the same tap within this long is the same tap (the library can report one tap twice). */
export const TAP_REPEAT_MS = 2_000;

/**
 * Routes notification taps to the screen that opens games. A tap can arrive before any screen exists (it launched
 * or brought back the app), so it is kept until `attach` is called; the same game tapped twice within
 * TAP_REPEAT_MS opens once.
 */
export function createTapRouter() {
  let open: ((gameId: string) => void) | undefined;
  let pending: string | undefined;
  let last: { gameId: string; at: number } | undefined;
  return {
    tap(gameId: string, now: number): void {
      if (last && last.gameId === gameId && now - last.at < TAP_REPEAT_MS) return;
      last = { gameId, at: now };
      if (open) open(gameId);
      else pending = gameId;
    },
    /** Starts opening games with `handler`, first any tap kept from before. Returns the detach function. */
    attach(handler: (gameId: string) => void, now: number): () => void {
      open = handler;
      if (pending !== undefined) {
        const gameId = pending;
        pending = undefined;
        last = { gameId, at: now }; // the app may take a while to start: repeats count from the opening
        handler(gameId);
      }
      return () => {
        if (open === handler) open = undefined;
      };
    },
  };
}
