import type { LeagueId } from "../domain";
import { pickLeague } from "./league";
import { useSettings } from "./settings-context";
import { useSportsData } from "./sports-data-context";

/** The league the Scores, Standings and Leaders tabs show: the one picked in Settings, if the app has it. */
export function useLeague(): LeagueId {
  const { settings } = useSettings();
  const sports = useSportsData();
  return pickLeague(settings.league, sports.leagues());
}
