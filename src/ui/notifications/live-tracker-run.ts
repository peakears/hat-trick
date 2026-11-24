// The live score service's loop (#114): every TRACK_POLL_MS it reads today's games in each league with a followed
// favourite through the app's SportsData (same cache, same diagnostics log), follows favourites' live games, updates
// the ongoing notification and posts the league's alerts (SportsData.liveAlerts: each goal in hockey, late lead
// changes in basketball, and the final), and stops when no followed game is left. Decisions are in live-tracker.ts (pure, tested); the
// notifications in live-tracker-native.ts. Runs inside the Android foreground service, so with the app closed too:
// the wait between checks and the wake lock are native (live-wait.ts, background-wait-native.ts, #137), as JS timers
// stop once the app leaves the front.
import { loadSettings, type Settings } from "../settings/settings";
import { scoresToday } from "../common/format";
import {
  followKey,
  followUpdate,
  gamesToFollow,
  ongoingSummary,
  TRACK_POLL_MS,
  type FollowState,
} from "./live-tracker";
import { liveTrackingAvailable, postAlert, registerLiveService, showOngoing, stopOngoing } from "./live-tracker-native";
import type { Game, GameDetail } from "../../domain";
import type { SportsData } from "../../data";
import { getServices } from "../data/sports-data-context";
import { leaguesWithFavorites } from "../team/favorites";
import { favoritesWithAlert } from "./team-alerts";
import { createWaiter, KEEP_AWAKE_MS } from "./live-wait";
import { allowSleep, backgroundSleep, keepAwake } from "./background-wait-native";

let running = false;
/** When a start was asked for and the service has not called runLoop yet; a start that never arrives expires. */
let startingSince: number | undefined;
const START_TIMEOUT_MS = 60_000;
let stopRequested = false;
const waiter = createWaiter({
  nativeSleep: backgroundSleep,
  setTimer: (done, ms) => setTimeout(done, ms),
  clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
});
/** Games the user stopped with the Stop button (followKey): not followed again while the app process lives. */
const stoppedGames = new Set<string>();
/** Alerts already posted, so a repeated check never posts a goal twice. */
const posted = new Set<string>();
/** Followed games by followKey, and what the last check saw. */
const followed = new Map<string, { game: Game; state: FollowState | undefined }>();

/** Registers the service at startup (index.ts). Does nothing where live tracking cannot run (Expo Go, iOS). */
export function registerLiveTracking(): void {
  registerLiveService({ run: runLoop, onStop: () => stopLiveTracking({ byUser: true }) });
}

/** The favourites live scores follow: every league's, less those switched off in Settings. */
const liveFavorites = (s: Settings) => favoritesWithAlert(s.favoriteTeams, s.teamAlerts, "live");
/** Whether a check should follow anything: the setting is on and a favourite is set. */
const wanted = (s: Settings) => s.liveScores && liveFavorites(s).length > 0;

/**
 * Today's games in every league with a followed favourite (`all`: a league that fails is skipped), and those worth
 * starting to follow. `all` keeps games that have just ended, so a followed game's final is still seen.
 */
async function gamesNow(data: SportsData, settings: Settings, now: number): Promise<{ all: Game[]; toFollow: Game[] }> {
  const favorites = liveFavorites(settings);
  const leagues = leaguesWithFavorites(favorites).filter((l) => data.leagues().includes(l));
  const days = await Promise.all(leagues.map((l) => data.getScores(l, scoresToday()).catch(() => undefined)));
  const all = days.flatMap((d) => d?.data ?? []);
  return { all, toFollow: gamesToFollow(all, favorites, now) };
}

/**
 * The game as this check sees it. A league that announces each score reads the game page for its goal list (with
 * the scorers); one that announces late moments only needs the scores, which this check already loaded (the NBA's
 * game page is about 480 KB, too much every 30 s). Undefined when offline.
 */
async function checkGame(data: SportsData, game: Game, today: Game[]): Promise<GameDetail | undefined> {
  if (data.liveAlerts(game.league).kind === "eachScore" && data.supports(game.league, "gameDetail")) {
    return (await data.getGameDetail(game.league, game.id).catch(() => undefined))?.data;
  }
  const fresh = today.find((g) => g.league === game.league && g.id === game.id);
  return fresh ? { game: fresh, boxscore: { home: [], away: [] } } : undefined;
}

/**
 * Starts following if a favourite's game is live or about to start and the setting is on. Called by the app when
 * it opens or settings change (use-live-tracking.ts); does nothing if the service already runs.
 */
export async function startLiveTracking(): Promise<void> {
  if (running || !liveTrackingAvailable()) return;
  if (startingSince !== undefined && Date.now() - startingSince < START_TIMEOUT_MS) return;
  const { data, store } = getServices();
  const settings = await loadSettings(store);
  if (!wanted(settings)) return;
  const games = (await gamesNow(data, settings, Date.now())).toFollow.filter((g) => !stoppedGames.has(followKey(g)));
  if (games.length === 0 || running) return;
  startingSince = Date.now();
  stopRequested = false;
  // Displaying the service notification starts the foreground service, which calls runLoop.
  await showOngoing({ title: "Following live games", body: "Loading the score…" }).catch(() => {
    startingSince = undefined;
  });
}

/** Stops the service. `byUser`: the Stop button, so today's followed games are not picked up again. */
export function stopLiveTracking(options: { byUser?: boolean } = {}): void {
  stopRequested = true;
  if (options.byUser) for (const id of followed.keys()) stoppedGames.add(id);
  waiter.wake();
}

async function runLoop(): Promise<void> {
  const { data, store } = getServices();
  running = true;
  startingSince = undefined;
  try {
    while (!stopRequested) {
      keepAwake(KEEP_AWAKE_MS); // renewed each check, so a loop that dies lets it lapse
      const settings = await loadSettings(store);
      if (!wanted(settings)) break;
      const now = Date.now();
      const today = await gamesNow(data, settings, now);
      for (const game of today.toFollow) {
        const key = followKey(game);
        if (!stoppedGames.has(key) && !followed.has(key)) followed.set(key, { game, state: undefined });
      }

      const lines: { gameId: string; title: string; body: string }[] = [];
      for (const [key, { game, state: previous }] of followed) {
        const detail = await checkGame(data, game, today.all);
        if (!detail) continue; // offline for now: keep following, try again next check
        const update = followUpdate(previous, detail, {
          hidden: settings.spoilerShield,
          goalAlerts: settings.goalAlerts,
          now,
          rule: data.liveAlerts(game.league),
        });
        followed.set(key, { game: detail.game, state: update.state });
        for (const alert of update.alerts) {
          if (posted.has(alert.id)) continue;
          posted.add(alert.id);
          await postAlert(alert, key).catch(() => {});
        }
        if (update.done) followed.delete(key);
        else if (update.ongoing) lines.push({ gameId: key, ...update.ongoing });
      }

      if (followed.size === 0) break;
      if (lines.length > 0) await showOngoing(ongoingSummary(lines)).catch(() => {});
      await waiter.sleep(TRACK_POLL_MS);
    }
  } finally {
    followed.clear();
    running = false;
    stopRequested = false;
    allowSleep();
    await stopOngoing().catch(() => {});
  }
}
