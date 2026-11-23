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

/** Games in each of the team page's lists (recent and upcoming), as for the NHL. */
export const TEAM_GAMES_SHOWN = 5;

/** The team page's season stats table: per-game averages and shooting, by ESPN's group and stat name. */
export const TEAM_STAT_COLUMNS = [
  { key: "gamesPlayed", label: "GP", group: "general", name: "gamesPlayed" },
  { key: "avgMinutes", label: "MIN", group: "general", name: "avgMinutes" },
  { key: "avgPoints", label: "PTS", group: "offensive", name: "avgPoints" },
  { key: "avgRebounds", label: "REB", group: "general", name: "avgRebounds" },
  { key: "avgAssists", label: "AST", group: "offensive", name: "avgAssists" },
  { key: "avgSteals", label: "STL", group: "defensive", name: "avgSteals" },
  { key: "avgBlocks", label: "BLK", group: "defensive", name: "avgBlocks" },
  { key: "fieldGoalPct", label: "FG%", group: "offensive", name: "fieldGoalPct" },
  { key: "threePointFieldGoalPct", label: "3P%", group: "offensive", name: "threePointFieldGoalPct" },
  { key: "freeThrowPct", label: "FT%", group: "offensive", name: "freeThrowPct" },
] as const;
