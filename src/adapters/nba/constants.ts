// ESPN's unofficial, keyless site API. Three hosts: the scoreboard on site/v2, standings on apis/v2 (site/v2
// standings is an empty stub), leaders on the "common" stats API. Shapes: raw-types.ts; notes: CLAUDE.md.
export const LEAGUE = "nba" as const;

export const SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
export const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
export const LEADERS_URL = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete";

export const DEFAULT_TIMEOUT_MS = 10_000;

/** One board each, in this order: ESPN sort keys ("<category group>.<stat>") for the leaders request. */
export const LEADER_CATEGORIES = [
  { category: "offensive.avgPoints", label: "Points per game" },
  { category: "general.avgRebounds", label: "Rebounds per game" },
  { category: "offensive.avgAssists", label: "Assists per game" },
  { category: "defensive.avgSteals", label: "Steals per game" },
  { category: "defensive.avgBlocks", label: "Blocks per game" },
  { category: "offensive.avgThreePointFieldGoalsMade", label: "3-pointers made per game" },
] as const;

/** Players per board when the query sets no limit. */
export const DEFAULT_LEADER_LIMIT = 20;
