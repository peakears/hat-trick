import { useLocalSearchParams } from "expo-router";
import type { LeagueId } from "../../domain";
import { routeLeague } from "../common/routes";
import { useSportsData } from "./sports-data-context";

/** The league a game or team page shows, from its link (`gameRoute`, `teamRoute` in common/routes.ts). */
export function usePageLeague(): LeagueId {
  const { league } = useLocalSearchParams<{ league?: string }>();
  return routeLeague(league, useSportsData().leagues());
}
