// Pure rules for following favourite teams' live games in notifications (#114): which games to follow, what the
// ongoing score notification says, which goals to announce, and when to stop. The service that runs them is
// live-tracker-run.ts; the only notification code is live-tracker-native.ts. Tested in live-tracker.test.ts.
import type { Game, GameDetail, Goal } from "../../domain";
import { gameStatusLabel } from "../common/format";
import { goalTags, scorerGameGoalNumbers, scorerLabel, seasonGoalLabel } from "../game/goals";

/** How often the service checks a followed game. Live games are fresh for 20 s, so this is at most one request. */
export const TRACK_POLL_MS = 30_000;
/** A favourite's game is followed from this long before puck drop, so the notification is up when it starts. */
export const TRACK_LEAD_MS = 15 * 60_000;
/** A game still "scheduled" this long after its start time is not waited for (delayed, or the data is stale). */
export const TRACK_LATE_MS = 3 * 60 * 60_000;

/** The games worth following now: a favourite team's, live or starting within TRACK_LEAD_MS. */
export function gamesToFollow(games: readonly Game[], favorites: readonly string[], now: number): Game[] {
  const fav = new Set(favorites);
  return games.filter((g) => {
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
    id: `goal:${game.id}:${goal.period}:${goal.time}:${goal.scorer.id}`,
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
  const state: FollowState = {
    gameId: game.id,
    awayScore: game.away.score ?? 0,
    homeScore: game.home.score ?? 0,
    goalCount: goals?.length ?? previous?.goalCount,
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
    if (goals && previous.goalCount !== undefined && goals.length > previous.goalCount) {
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
          alerts.push({ id: `goal:${game.id}:${side}:${n}`, title: `Goal: ${abbrev}`, body: scoreAfter });
        }
      }
    }
    if (game.status === "final") {
      alerts.push({ id: `final:${game.id}`, title: `Final: ${scoreLine(game)}`, body: gameStatusLabel(game) });
    }
  }

  return { state, ongoing: done ? null : ongoingText(game, options.hidden), alerts, done };
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
