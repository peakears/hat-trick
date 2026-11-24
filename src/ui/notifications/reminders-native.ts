import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { AsyncStorageStore } from "../data/async-storage-store";
import {
  REMINDER_ID_PREFIX,
  SCHEDULED_KEY,
  diffReminders,
  parseScheduled,
  serializeScheduled,
  type Reminder,
  type ScheduledReminder,
} from "./reminders";

/**
 * Schedules puck drop reminders as local notifications (they fire with the app closed; nothing
 * comes from a server). The pure planning lives in `reminders.ts`; this file only talks to the OS.
 */

const CHANNEL_ID = "puck-drop";
const store = new AsyncStorageStore();

// While the app is open, still show the reminder as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    // Only the name people see changes: the channel id stays, so reminders already scheduled keep their channel.
    name: "Game start reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** True if the notification permission is already granted. */
export async function hasReminderPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks for the notification permission (Android 13+ shows a prompt). True if granted. */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Ids of our reminders the system really has scheduled. */
async function systemReminderIds(): Promise<Set<string>> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return new Set(all.map((n) => n.identifier).filter((id) => id.startsWith(REMINDER_ID_PREFIX)));
}

async function loadScheduled(): Promise<ScheduledReminder[]> {
  return parseScheduled(await store.get(SCHEDULED_KEY));
}

/**
 * Makes the system's scheduled reminders match `planned`: cancels the ones no longer wanted
 * (or moved), schedules new ones, and leaves unchanged ones alone.
 */
export async function applyReminders(planned: readonly Reminder[]): Promise<void> {
  await ensureChannel();
  const inSystem = await systemReminderIds();
  // Trust our record only for reminders the system still has (the OS can drop them, e.g. on reboot
  // on some devices); stray ones we have no record of are cancelled below.
  const recorded = (await loadScheduled()).filter((s) => inSystem.has(s.id));
  const { cancel, schedule } = diffReminders(recorded, planned);

  const known = new Set(recorded.map((s) => s.id));
  const strays = [...inSystem].filter((id) => !known.has(id) && !schedule.some((r) => r.id === id));
  for (const id of [...cancel, ...strays]) await Notifications.cancelScheduledNotificationAsync(id);

  for (const r of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { gameId: r.gameId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
    });
  }

  await store.set(SCHEDULED_KEY, serializeScheduled(planned.map(({ id, fireAt }) => ({ id, fireAt }))));
}

/** Cancels every reminder (reminders switched off, or no favourite teams left). */
export async function cancelAllReminders(): Promise<void> {
  for (const id of await systemReminderIds()) await Notifications.cancelScheduledNotificationAsync(id);
  await store.set(SCHEDULED_KEY, serializeScheduled([]));
}
