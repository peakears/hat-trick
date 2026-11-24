// The only react-native-notify-kit code: the live score foreground service and its notifications (#114). Rules live
// in live-tracker.ts, the polling loop in live-tracker-run.ts. Android only; in Expo Go (no native module) every
// call here is a no-op and `liveTrackingAvailable()` is false, so the rest of the app works unchanged.
import { Platform, TurboModuleRegistry } from "react-native";
import type { Event, Notification } from "react-native-notify-kit";
import { createTapRouter, type Alert } from "./live-tracker";

type Kit = typeof import("react-native-notify-kit");

/** The library's native module. Missing in Expo Go, which ships only its own native modules. */
const NATIVE_MODULE = "NotifeeApiModule";

let lib: Kit | null | undefined;
let nativeReady = false;

/**
 * The library's JS, on Android. Importing it never touches native code (the library looks its native module up on
 * first use), so this is safe at startup and in Expo Go; only registration that stays in JS may use it alone.
 */
function library(): Kit | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS !== "android") return lib;
  try {
    lib = require("react-native-notify-kit") as Kit;
  } catch {
    lib = null;
  }
  return lib;
}

/**
 * The library, or null where it cannot run (iOS, Expo Go). `TurboModuleRegistry.get` returns null for a missing
 * module where the library's own lookup throws, so this is the check. Only a positive answer is kept: called too
 * early at startup the module may not be installed yet, and a later call must still find it.
 */
function load(): Kit | null {
  const k = library();
  if (!k) return null;
  if (!nativeReady) nativeReady = TurboModuleRegistry.get(NATIVE_MODULE) != null;
  return nativeReady ? k : null;
}

export function liveTrackingAvailable(): boolean {
  return load() !== null;
}

const ONGOING_ID = "live-scores";
const ONGOING_CHANNEL = "live-scores";
const ALERT_CHANNEL = "goals";
const STOP_ACTION = "stop";
const SMALL_ICON = "notification_icon"; // from the expo-notifications plugin's monochrome icon
const COLOR = "#2563eb";

let channelsReady = false;

async function channels(k: Kit): Promise<void> {
  if (channelsReady) return;
  const notifee = k.default;
  // Quiet and low: the score changes all game long and must never buzz. Alerts (goals, late lead changes, overtime,
  // finals) get their own loud channel. Only the names people see are neutral: the ids stay, so phones keep the
  // settings they gave each channel.
  await notifee.createChannel({ id: ONGOING_CHANNEL, name: "Live scores", importance: k.AndroidImportance.LOW });
  await notifee.createChannel({ id: ALERT_CHANNEL, name: "Scoring alerts", importance: k.AndroidImportance.HIGH });
  channelsReady = true;
}

/**
 * Shows or updates the ongoing score notification. The first call starts the foreground service (which runs the
 * task given to `registerLiveService`); later calls only update the text.
 */
export async function showOngoing(text: { title: string; body: string; gameId?: string }): Promise<void> {
  const k = load();
  if (!k) return;
  await channels(k);
  const notification: Notification = {
    id: ONGOING_ID,
    title: text.title,
    body: text.body,
    data: text.gameId ? { gameId: text.gameId } : {},
    android: {
      channelId: ONGOING_CHANNEL,
      asForegroundService: true,
      foregroundServiceTypes: [k.AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: SMALL_ICON,
      color: COLOR,
      style: text.body.includes("\n") ? { type: k.AndroidStyle.BIGTEXT, text: text.body } : undefined,
      pressAction: { id: "default", launchActivity: "default" },
      actions: [{ title: "Stop", pressAction: { id: STOP_ACTION } }],
    },
  };
  await k.default.displayNotification(notification);
}

/** Stops the foreground service and removes the ongoing notification. */
export async function stopOngoing(): Promise<void> {
  const k = load();
  if (!k) return;
  await k.default.stopForegroundService();
  await k.default.cancelNotification(ONGOING_ID);
}

/** An alert (a goal, a late lead change, overtime, the final); a tap opens the game. `gameId` is its followKey. */
export async function postAlert(alert: Alert, gameId: string): Promise<void> {
  const k = load();
  if (!k) return;
  await channels(k);
  await k.default.displayNotification({
    id: alert.id,
    title: alert.title,
    body: alert.body,
    data: { gameId },
    android: {
      channelId: ALERT_CHANNEL,
      smallIcon: SMALL_ICON,
      color: COLOR,
      pressAction: { id: "default", launchActivity: "default" },
    },
  });
}

export interface LiveServiceHandlers {
  /** The service's work: resolves when following ends (the service then stops). */
  run: () => Promise<void>;
  /** The Stop button, or Android ending the service (the dataSync time limit). */
  onStop: () => void;
}

/**
 * Registers the service task and the background event handler. Called once at startup, before the app renders
 * (index.ts), as Android may start the JS for a notification event with no screen open.
 */
export function registerLiveService(handlers: LiveServiceHandlers): void {
  // Both calls only store a function in JS: native code must not run here (index.ts, before the app mounts).
  const k = library();
  if (!k) return;
  stopHandler = handlers.onStop;
  k.default.registerForegroundService(() => handlers.run());
  k.default.onBackgroundEvent(async (event) => {
    if (isStop(k, event)) handlers.onStop();
    // A tap while the app is in the background comes here, not to the foreground listener.
    const gameId = tappedGame(k, event);
    if (gameId) taps.tap(gameId, Date.now());
  });
}

/** Taps from either handler, opened once a screen attaches (see onLiveNotificationTap). */
const taps = createTapRouter();

let stopHandler: (() => void) | undefined;

/** The Stop button, or Android ending the service (the dataSync time limit). */
function isStop(k: Kit, event: Event): boolean {
  return (
    (event.type === k.EventType.ACTION_PRESS && event.detail.pressAction?.id === STOP_ACTION) ||
    event.detail.foregroundServiceRunLimit !== undefined
  );
}

/** The game to open for a tapped live score, goal or final notification; undefined for others. */
function tappedGame(k: Kit, event: Event): string | undefined {
  if (event.type !== k.EventType.PRESS) return undefined;
  const gameId = event.detail.notification?.data?.gameId;
  return typeof gameId === "string" ? gameId : undefined;
}

/**
 * While the app is open: calls `open` with the game of a tapped notification (one that launched the app, one
 * tapped while it was in the background, and any tapped while it is in front), and handles Stop. Mounted from a
 * hook, since listening needs the native module. Returns the unsubscribe function.
 */
export function onLiveNotificationTap(open: (gameId: string) => void): () => void {
  const k = load();
  if (!k) return () => {};
  const detach = taps.attach(open, Date.now());
  k.default
    .getInitialNotification()
    .then((initial) => {
      const gameId = initial?.notification.data?.gameId;
      if (typeof gameId === "string") taps.tap(gameId, Date.now());
    })
    .catch(() => {});
  const unsubscribe = k.default.onForegroundEvent((event) => {
    if (isStop(k, event)) stopHandler?.();
    const gameId = tappedGame(k, event);
    if (gameId) taps.tap(gameId, Date.now());
  });
  return () => {
    unsubscribe();
    detach();
  };
}
