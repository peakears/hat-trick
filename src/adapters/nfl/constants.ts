// ESPN's unofficial, keyless site API, the same hosts as the NBA's: the scoreboard on site/v2, standings on apis/v2
// (site/v2 standings is an empty stub), leaders on the "common" v3 API. Shapes: raw-types.ts; notes: CLAUDE.md.
import type { LeaderGroup, StandingsBand } from "../../domain";

export const LEAGUE = "nfl" as const;

export const SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
export const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";
export const LEADERS_URL = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete";

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Every board, by ESPN's sort key ("<category group>.<stat>"). Season totals, so whole numbers, except sacks (half
 * sacks, "11.5") and passer rating, with one decimal. The response names a group in lower case
 * ("defensiveinterceptions") although the sort key needs "defensiveInterceptions".
 */
export const LEADER_CATEGORIES: readonly { category: string; label: string; decimals?: number }[] = [
  { category: "passing.passingYards", label: "Passing yards", decimals: 0 },
  { category: "passing.passingTouchdowns", label: "Passing touchdowns", decimals: 0 },
  { category: "passing.QBRating", label: "Passer rating", decimals: 1 },
  { category: "rushing.rushingYards", label: "Rushing yards", decimals: 0 },
  { category: "rushing.rushingTouchdowns", label: "Rushing touchdowns", decimals: 0 },
  { category: "receiving.receivingYards", label: "Receiving yards", decimals: 0 },
  { category: "receiving.receptions", label: "Receptions", decimals: 0 },
  { category: "receiving.receivingTouchdowns", label: "Receiving touchdowns", decimals: 0 },
  { category: "defensive.sacks", label: "Sacks", decimals: 1 },
  { category: "defensive.totalTackles", label: "Tackles", decimals: 0 },
  { category: "defensiveInterceptions.interceptions", label: "Interceptions", decimals: 0 },
];

/** The Leaders tab's choices. The default query (no category) asks for every board, offence first. */
export const LEADER_GROUPS: readonly LeaderGroup[] = [
  { id: "offence", label: "Offence", categories: LEADER_CATEGORIES.slice(0, 8).map((c) => c.category) },
  { id: "defence", label: "Defence", categories: LEADER_CATEGORIES.slice(8).map((c) => c.category) },
];

/** Players per board when the query sets no limit. */
export const DEFAULT_LEADER_LIMIT = 20;

/** What a conference seed means: four division winners and three wild cards make the playoffs. */
export const CONFERENCE_BANDS: StandingsBand[] = [{ label: "Playoffs", through: 7 }, { label: "Out" }];

/** Quarters in regulation: a live game's strip lists all of them from kickoff, and late lead changes count from the last. */
export const QUARTERS = 4;

/** The box score's tables, by ESPN's group name, in the order shown, with their titles. Groups not listed are left out. */
export const BOX_SCORE_TABLES: readonly [group: string, title: string][] = [
  ["passing", "Passing"],
  ["rushing", "Rushing"],
  ["receiving", "Receiving"],
  ["defensive", "Defence"],
  ["interceptions", "Interceptions"],
  ["fumbles", "Fumbles"],
  ["kicking", "Kicking"],
  ["punting", "Punting"],
  ["kickReturns", "Kick returns"],
  ["puntReturns", "Punt returns"],
];

/**
 * The game page's team stats, from the summary's `boxscore.teams` (stat name, label). In the order shown; a stat a
 * team lacks leaves its line out. Values are shown as ESPN sends them ("2-8", "19:20"); only plain numbers get a bar.
 */
export const TEAM_GAME_STATS: readonly [name: string, label: string][] = [
  ["totalYards", "Total yards"],
  ["netPassingYards", "Passing yards"],
  ["rushingYards", "Rushing yards"],
  ["firstDowns", "1st downs"],
  ["thirdDownEff", "3rd down"],
  ["fourthDownEff", "4th down"],
  ["redZoneAttempts", "Red zone"],
  ["turnovers", "Turnovers"],
  ["sacksYardsLost", "Sacks allowed"],
  ["totalPenaltiesYards", "Penalties"],
  ["possessionTime", "Time of possession"],
];

/** The leader lines a team's top performer is picked from: whoever gained the most yards. */
export const PERFORMER_CATEGORIES = ["passingYards", "rushingYards", "receivingYards"] as const;

/** Games in each of the team page's lists (recent and upcoming), as for the other leagues. */
export const TEAM_GAMES_SHOWN = 5;

/** A team page column: ESPN's stat group and name on each player ("passing", "passingYards"). */
interface TeamStatColumn {
  key: string;
  label: string;
  group: string;
  name: string;
}

const gamesPlayed: TeamStatColumn = { key: "gamesPlayed", label: "GP", group: "general", name: "gamesPlayed" };
const column = (group: string, name: string, label: string): TeamStatColumn => ({ key: name, label, group, name });

/**
 * The team page's season tables, by ESPN's category (`results[].name`), in the order shown. Each lists the players
 * ESPN puts in that category, in its order (by the category's main stat). Categories not listed are left out.
 */
export const TEAM_STAT_TABLES: readonly { category: string; title: string; columns: readonly TeamStatColumn[] }[] = [
  {
    category: "passing",
    title: "Passing",
    columns: [
      gamesPlayed,
      column("passing", "completions", "CMP"),
      column("passing", "passingAttempts", "ATT"),
      column("passing", "completionPct", "CMP%"),
      column("passing", "passingYards", "YDS"),
      column("passing", "passingTouchdowns", "TD"),
      column("passing", "interceptions", "INT"),
      column("passing", "QBRating", "RTG"),
    ],
  },
  {
    category: "rushing",
    title: "Rushing",
    columns: [
      gamesPlayed,
      column("rushing", "rushingAttempts", "CAR"),
      column("rushing", "rushingYards", "YDS"),
      column("rushing", "yardsPerRushAttempt", "AVG"),
      column("rushing", "rushingTouchdowns", "TD"),
      column("rushing", "longRushing", "LNG"),
    ],
  },
  {
    category: "receiving",
    title: "Receiving",
    columns: [
      gamesPlayed,
      column("receiving", "receptions", "REC"),
      column("receiving", "receivingTargets", "TGTS"),
      column("receiving", "receivingYards", "YDS"),
      column("receiving", "yardsPerReception", "AVG"),
      column("receiving", "receivingTouchdowns", "TD"),
      column("receiving", "longReception", "LNG"),
    ],
  },
  {
    category: "defensive",
    title: "Defence",
    columns: [
      gamesPlayed,
      column("defensive", "totalTackles", "TOT"),
      column("defensive", "soloTackles", "SOLO"),
      column("defensive", "sacks", "SACK"),
      column("defensive", "tacklesForLoss", "TFL"),
      column("defensive", "passesDefended", "PD"),
      // Interceptions are a group of their own on each player.
      column("defensiveInterceptions", "interceptions", "INT"),
    ],
  },
  {
    category: "kicking",
    title: "Kicking",
    columns: [
      gamesPlayed,
      column("kicking", "fieldGoalsMade", "FGM"),
      column("kicking", "fieldGoalAttempts", "FGA"),
      column("kicking", "fieldGoalPct", "FG%"),
      column("kicking", "longFieldGoalMade", "LNG"),
      column("kicking", "extraPointsMade", "XPM"),
      column("kicking", "extraPointAttempts", "XPA"),
      column("kicking", "totalKickingPoints", "PTS"),
    ],
  },
  {
    category: "punting",
    title: "Punting",
    columns: [
      gamesPlayed,
      column("punting", "punts", "PUNTS"),
      column("punting", "puntYards", "YDS"),
      column("punting", "grossAvgPuntYards", "AVG"),
      column("punting", "netAvgPuntYards", "NET"),
      column("punting", "puntsInside20", "IN20"),
      column("punting", "longPunt", "LNG"),
    ],
  },
];
