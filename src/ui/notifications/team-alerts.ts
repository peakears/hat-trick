// Which favourite teams each kind of notification covers (pure). Every favourite is covered unless it was switched
// off in Settings, so the setting only stores the exceptions: an empty one (and every older version's settings)
// means all favourites, and a new favourite is covered from the start.

export type AlertKind = "reminders" | "live";

/** Per favourite (`league:team` key), the kinds switched off. */
export type TeamAlerts = Record<string, Partial<Record<AlertKind, false>>>;

/** Whether `kind` covers the favourite `key`. */
export function alertsOn(alerts: TeamAlerts, key: string, kind: AlertKind): boolean {
  return alerts[key]?.[kind] !== false;
}

/** The favourites (keys) that `kind` covers, in their order. */
export function favoritesWithAlert(favorites: readonly string[], alerts: TeamAlerts, kind: AlertKind): string[] {
  return favorites.filter((key) => alertsOn(alerts, key, kind));
}

/** Switches `kind` on or off for one favourite. Returns new alerts, keeping only what is switched off. */
export function setAlert(alerts: TeamAlerts, key: string, kind: AlertKind, on: boolean): TeamAlerts {
  const { [kind]: _, ...rest } = alerts[key] ?? {};
  const team = on ? rest : { ...rest, [kind]: false as const };
  const next = { ...alerts };
  if (Object.keys(team).length === 0) delete next[key];
  else next[key] = team;
  return next;
}

/** Drops the entries of teams that are no longer favourites, so a team starred again starts with every alert on. */
export function pruneAlerts(alerts: TeamAlerts, favorites: readonly string[]): TeamAlerts {
  const kept = new Set(favorites);
  return Object.fromEntries(Object.entries(alerts).filter(([key]) => kept.has(key)));
}

/**
 * The leagues reminders and live scores cover so far: the NHL (the rest is #132). One place to widen, so Settings
 * shows per-team switches only where they do something.
 */
const NOTIFICATION_LEAGUES: readonly string[] = ["nhl"];

export function notificationsCover(league: string): boolean {
  return NOTIFICATION_LEAGUES.includes(league);
}
