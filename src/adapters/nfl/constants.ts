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
