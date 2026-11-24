// ESPN's unofficial, keyless site API, on two hosts: the scoreboard, game summaries and team pages on site/v2,
// standings on apis/v2 (site/v2 standings is an empty stub), leaders and players on the "common" v3 API. Shapes: raw-types.ts; notes: CLAUDE.md.
import type { StandingsBand } from "../../domain";

export const LEAGUE = "nba" as const;

export const SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
export const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
export const LEADERS_URL = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete";
export const ATHLETES_URL = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes";

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

/** The player page's season-by-season table and career line: from the "averages" category, by ESPN's stat name. */
export const PLAYER_SEASON_COLUMNS = [
  { key: "gamesPlayed", label: "GP" },
  { key: "avgMinutes", label: "MIN" },
  { key: "avgPoints", label: "PTS" },
  { key: "avgRebounds", label: "REB" },
  { key: "avgAssists", label: "AST" },
  { key: "avgSteals", label: "STL" },
  { key: "avgBlocks", label: "BLK" },
  { key: "fieldGoalPct", label: "FG%" },
  { key: "threePointFieldGoalPct", label: "3P%" },
  { key: "freeThrowPct", label: "FT%" },
] as const;

/** The career line's headline numbers, a subset of PLAYER_SEASON_COLUMNS. */
export const PLAYER_CAREER_KEYS = ["gamesPlayed", "avgPoints", "avgRebounds", "avgAssists"] as const;

/** The player page's last games table, from the game log, by ESPN's stat name. */
export const PLAYER_GAME_COLUMNS = [
  { key: "minutes", label: "MIN" },
  { key: "points", label: "PTS" },
  { key: "totalRebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "fieldGoalsMade-fieldGoalsAttempted", label: "FG" },
  { key: "threePointFieldGoalsMade-threePointFieldGoalsAttempted", label: "3PT" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
] as const;

/** Games in the player page's last games table, as for the NHL. */
export const PLAYER_LAST_GAMES = 5;

/**
 * The game page's team stats, from the summary's `boxscore.teams` (stat name, label, shown as a percentage). In the
 * order shown; a stat a team lacks leaves its line out.
 */
export const TEAM_GAME_STATS: [name: string, label: string, percent: boolean][] = [
  ["fieldGoalPct", "Field goal %", true],
  ["threePointFieldGoalPct", "3-point %", true],
  ["freeThrowPct", "Free throw %", true],
  ["totalRebounds", "Rebounds", false],
  ["assists", "Assists", false],
  ["turnovers", "Turnovers", false],
  ["pointsInPaint", "Points in the paint", false],
  ["fastBreakPoints", "Fast break points", false],
  ["largestLead", "Largest lead", false],
];

/** What a conference seed means in the NBA: the top six go to the playoffs, seven to ten to the play-in. */
export const CONFERENCE_BANDS: StandingsBand[] = [
  { label: "Playoffs", through: 6 },
  { label: "Play-in", through: 10 },
  { label: "Out" },
];

/** Quarters in regulation: a live game's strip lists all of them from tip-off, and late lead changes count from the last. */
export const QUARTERS = 4;
