import { z } from "zod";
import type { KeyValueStore } from "../data";

/**
 * User preferences, stored on the device under their own key (never under `cache:`,
 * which `SportsData.prune()` manages). Pure module: no React Native imports, so it is unit tested.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];

/** How many minutes before puck drop a reminder fires. */
export const REMINDER_LEADS = [10, 15, 30, 60] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

export interface Settings {
  theme: ThemePreference;
  showLogos: boolean;
  /** Does nothing until betting info (issue #7) lands. */
  showBetting: boolean;
  /** Team ids (three-letter abbreviations) the user starred. Their games sort to the top of Scores. */
  favoriteTeams: string[];
  /** Notify before a favourite team's game starts. Needs the notification permission. */
  remindersEnabled: boolean;
  reminderLeadMinutes: ReminderLead;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  showLogos: true,
  showBetting: false,
  favoriteTeams: [],
  remindersEnabled: false,
  reminderLeadMinutes: 30,
};

export const SETTINGS_KEY = "settings:v1";

// Each field falls back to its default on its own, so one bad or missing value
// (e.g. a setting added in a later version) never resets the others.
const schema = z.object({
  theme: z.enum(THEMES).catch(DEFAULT_SETTINGS.theme),
  showLogos: z.boolean().catch(DEFAULT_SETTINGS.showLogos),
  showBetting: z.boolean().catch(DEFAULT_SETTINGS.showBetting),
  // Duplicates are dropped, so a hand-edited or doubled-up list stays a set.
  favoriteTeams: z
    .array(z.string())
    .transform((ids) => [...new Set(ids)])
    .catch([]),
  remindersEnabled: z.boolean().catch(DEFAULT_SETTINGS.remindersEnabled),
  reminderLeadMinutes: z.literal(REMINDER_LEADS).catch(DEFAULT_SETTINGS.reminderLeadMinutes),
});

export function parseSettings(raw: string | null): Settings {
  if (raw == null) return { ...DEFAULT_SETTINGS };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return { ...DEFAULT_SETTINGS };
  return schema.parse(json);
}

export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  try {
    return parseSettings(await store.get(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore, settings: Settings): Promise<void> {
  return store.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** The value React Native's `Appearance.setColorScheme` expects; "auto" follows the phone. */
export function colorSchemeOverride(theme: ThemePreference): "light" | "dark" | "auto" {
  return theme === "system" ? "auto" : theme;
}
