// The live score service's loop (#114): every TRACK_POLL_MS it reads today's games through the app's SportsData
// (same cache, same diagnostics log), follows favourites' live games, updates the ongoing notification and posts
// goal alerts, and stops when no followed game is left. Decisions are in live-tracker.ts (pure, tested); the
// notifications in live-tracker-native.ts. Runs inside the Android foreground service, so with the app closed too.
import { loadSettings, type Settings } from "../settings/settings";
import { scoresToday } from "../common/format";
import { followUpdate, gamesToFollow, ongoingSummary, TRACK_POLL_MS, type FollowState } from "./live-tracker";
import { liveTrackingAvailable, postAlert, registerLiveService, showOngoing, stopOngoing } from "./live-tracker-native";
import { getServices, NHL } from "../data/sports-data-context";

let running = false;
/** When a start was asked for and the service has not called runLoop yet; a start that never arrives expires. */
let startingSince: number | undefined;
const START_TIMEOUT_MS = 60_000;
let stopRequested = false;
let wake: (() => void) | undefined;
/** Games the user stopped with the Stop button: not followed again while the app process lives. */
const stoppedGames = new Set<string>();
/** Alerts already posted, so a repeated check never posts a goal twice. */
const posted = new Set<string>();
/** Followed games and what the last check saw. */
const followed = new Map<string, FollowState | undefined>();

/** Registers the service at startup (index.ts). Does nothing where live tracking cannot run (Expo Go, iOS). */
export function registerLiveTracking(): void {
  registerLiveService({ run: runLoop, onStop: () => stopLiveTracking({ byUser: true }) });
}

/** Whether a check should follow anything: the setting is on and a favourite is set. */
const wanted = (s: Settings) => s.liveScores && s.favoriteTeams.length > 0;

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
  const scores = await data.getScores(NHL, scoresToday()).catch(() => undefined);
  const games = gamesToFollow(scores?.data ?? [], settings.favoriteTeams, Date.now()).filter(
    (g) => !stoppedGames.has(g.id),
  );
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
  wake?.();
}

async function runLoop(): Promise<void> {
  const { data, store } = getServices();
  running = true;
  startingSince = undefined;
  try {
    while (!stopRequested) {
      const settings = await loadSettings(store);
      if (!wanted(settings)) break;
      const now = Date.now();
      const scores = await data.getScores(NHL, scoresToday()).catch(() => undefined);
      for (const game of gamesToFollow(scores?.data ?? [], settings.favoriteTeams, now)) {
        if (!stoppedGames.has(game.id) && !followed.has(game.id)) followed.set(game.id, undefined);
      }

      const lines: { gameId: string; title: string; body: string }[] = [];
      for (const [gameId, previous] of followed) {
        const detail = await data.getGameDetail(NHL, gameId).catch(() => undefined);
        if (!detail) continue; // offline for now: keep following, try again next check
        const update = followUpdate(previous, detail.data, {
          hidden: settings.spoilerShield,
          goalAlerts: settings.goalAlerts,
          now,
        });
        followed.set(gameId, update.state);
        for (const alert of update.alerts) {
          if (posted.has(alert.id)) continue;
          posted.add(alert.id);
          await postAlert(alert, gameId).catch(() => {});
        }
        if (update.done) followed.delete(gameId);
        else if (update.ongoing) lines.push({ gameId, ...update.ongoing });
      }

      if (followed.size === 0) break;
      if (lines.length > 0) await showOngoing(ongoingSummary(lines)).catch(() => {});
      await sleep(TRACK_POLL_MS);
    }
  } finally {
    followed.clear();
    running = false;
    stopRequested = false;
    await stopOngoing().catch(() => {});
  }
}

/** Waits `ms`, or less if stopLiveTracking() is called. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      wake = undefined;
      resolve();
    }
    wake = done;
  });
}
