// Which league the tabs show (pure). The picked league is stored as a plain string in settings, so one from a newer
// version, or one later removed, falls back to the first league the app has rather than breaking the tabs.
import type { LeagueId } from "../../domain";

export function pickLeague(stored: string, available: readonly LeagueId[]): LeagueId {
  if (available.includes(stored)) return stored;
  return available[0] ?? "nhl";
}
