import { z } from "zod";
import { normalizeFavorites } from "../team/favorites";
import type { TeamAlerts } from "../notifications/team-alerts";
import type { KeyValueStore } from "../../data";
import { TV_REGIONS, type TvRegionPreference } from "../game/broadcasts";
import { ACCENTS, type AccentId } from "../theme/palette";
import { STANDINGS_VIEWS, type StandingsView } from "../standings/standings";

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
  /** Use a black background (OLED) whenever the app is dark, by the phone's setting or by `theme`. */
  pureBlack: boolean;
  /** The colour of links, buttons and highlights. */
  accent: AccentId;
  showLogos: boolean;
  /** Does nothing, and has no switch in Settings, unless betting info (issue #7) is built. */
  showBetting: boolean;
  /** Team ids (three-letter abbreviations) the user starred. Their games sort to the top of Scores. */
  favoriteTeams: string[];
  /** Notify before a favourite team's game starts. Needs the notification permission. */
  remindersEnabled: boolean;
  reminderLeadMinutes: ReminderLead;
  /** Follow favourite teams' live games in an ongoing notification, even with the app closed. Android only. */
  liveScores: boolean;
  /** While following a game, notify for each goal and the final. */
  goalAlerts: boolean;
  /** Look for a newer release on GitHub (at most once a day). The only request the app makes besides game data. */
  checkForUpdates: boolean;
  /** Whose TV channels to show: "auto" uses the phone's region. */
  tvRegion: TvRegionPreference;
  /** Hide scores and box scores until the user taps to show them (for watching games on delay). */
  spoilerShield: boolean;
  /** How the Standings tab groups teams; the last view picked. */
  standingsView: StandingsView;
  /** The first-run setup was finished or skipped, so it is not shown again. */
  onboardingComplete: boolean;
  /** The league the Scores, Standings and Leaders tabs show (a LeagueId). One the app lacks shows the NHL. */
  league: string;
  /** Scores shows every league's games (the league row's "All"), rather than `league`'s alone. */
  scoresAllLeagues: boolean;
  /** Per favourite, the notifications switched off for it (team-alerts.ts); every other favourite gets them all. */
  teamAlerts: TeamAlerts;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  pureBlack: false,
  accent: "blue",
  showLogos: true,
  showBetting: false,
  favoriteTeams: [],
  remindersEnabled: false,
  reminderLeadMinutes: 30,
  liveScores: false,
  goalAlerts: true,
  checkForUpdates: true,
  tvRegion: "auto",
  spoilerShield: false,
  standingsView: "division",
  onboardingComplete: false,
  league: "nhl",
  scoresAllLeagues: true,
  teamAlerts: {},
};

export const SETTINGS_KEY = "settings:v1";

// Each field falls back to its default on its own, so one bad or missing value
// (e.g. a setting added in a later version) never resets the others.
const schema = z.object({
  theme: z.enum(THEMES).catch(DEFAULT_SETTINGS.theme),
  pureBlack: z.boolean().catch(DEFAULT_SETTINGS.pureBlack),
  accent: z.enum(ACCENTS).catch(DEFAULT_SETTINGS.accent),
  showLogos: z.boolean().catch(DEFAULT_SETTINGS.showLogos),
  showBetting: z.boolean().catch(DEFAULT_SETTINGS.showBetting),
  // `league:team` keys. Bare ids from a version before favourites had a league are the NHL's; duplicates are dropped.
  favoriteTeams: z.array(z.string()).transform(normalizeFavorites).catch([]),
  remindersEnabled: z.boolean().catch(DEFAULT_SETTINGS.remindersEnabled),
  reminderLeadMinutes: z.literal(REMINDER_LEADS).catch(DEFAULT_SETTINGS.reminderLeadMinutes),
  liveScores: z.boolean().catch(DEFAULT_SETTINGS.liveScores),
  goalAlerts: z.boolean().catch(DEFAULT_SETTINGS.goalAlerts),
  checkForUpdates: z.boolean().catch(DEFAULT_SETTINGS.checkForUpdates),
  tvRegion: z.enum(TV_REGIONS).catch(DEFAULT_SETTINGS.tvRegion),
  spoilerShield: z.boolean().catch(DEFAULT_SETTINGS.spoilerShield),
  standingsView: z.enum(STANDINGS_VIEWS).catch(DEFAULT_SETTINGS.standingsView),
  // Stored settings without this field were saved by a version before first-run setup existed: that user has
  // used the app, so they skip it. Only a fresh install (nothing stored) starts with it false.
  onboardingComplete: z.boolean().catch(true),
  league: z.string().min(1).catch(DEFAULT_SETTINGS.league),
  scoresAllLeagues: z.boolean().catch(DEFAULT_SETTINGS.scoresAllLeagues),
  // A team's entry that cannot be read is dropped (its alerts come back on), never the whole setting.
  teamAlerts: z
    .record(
      z.string(),
      z
        .object({ reminders: z.literal(false).optional(), live: z.literal(false).optional() })
        .transform((a): TeamAlerts[string] => a)
        .catch({}),
    )
    .transform((alerts) => Object.fromEntries(Object.entries(alerts).filter(([, a]) => Object.keys(a).length > 0)))
    .catch({}),
});

/** Defaults for someone who has used the app before but whose stored settings are unreadable. */
const RETURNING_DEFAULTS: Settings = { ...DEFAULT_SETTINGS, onboardingComplete: true };

export function parseSettings(raw: string | null): Settings {
  if (raw == null) return { ...DEFAULT_SETTINGS };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ...RETURNING_DEFAULTS };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return { ...RETURNING_DEFAULTS };
  return schema.parse(json);
}

/**
 * Settings are only written when one changes, so someone who updated from a version without first-run setup and
 * never changed a setting has none stored. Anything else on the device (cached data, the update check, the
 * diagnostics log) shows the app has been used, so setup is skipped for them too.
 */
export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  try {
    const raw = await store.get(SETTINGS_KEY);
    const settings = parseSettings(raw);
    if (raw == null && (await store.keys()).length > 0) settings.onboardingComplete = true;
    return settings;
  } catch {
    // Storage could not be read: do not put a returning user through setup again.
    return { ...RETURNING_DEFAULTS };
  }
}

export function saveSettings(store: KeyValueStore, settings: Settings): Promise<void> {
  return store.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** The value React Native's `Appearance.setColorScheme` expects; "auto" follows the phone. */
export function colorSchemeOverride(theme: ThemePreference): "light" | "dark" | "auto" {
  return theme === "system" ? "auto" : theme;
}
