import { z } from "zod";
import type { KeyValueStore } from "../data";

/**
 * User preferences, stored on the device under their own key (never under `cache:`,
 * which `SportsData.prune()` manages). Pure module: no React Native imports, so it is unit tested.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];

export interface Settings {
  theme: ThemePreference;
  showLogos: boolean;
  /** Does nothing until betting info (issue #7) lands. */
  showBetting: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  showLogos: true,
  showBetting: false,
};

export const SETTINGS_KEY = "settings:v1";

// Each field falls back to its default on its own, so one bad or missing value
// (e.g. a setting added in a later version) never resets the others.
const schema = z.object({
  theme: z.enum(THEMES).catch(DEFAULT_SETTINGS.theme),
  showLogos: z.boolean().catch(DEFAULT_SETTINGS.showLogos),
  showBetting: z.boolean().catch(DEFAULT_SETTINGS.showBetting),
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
