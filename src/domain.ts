// Domain model + adapter contract for the sports app.
// Nothing in here knows about any league's raw API shapes.

export type LeagueId = "nhl" | (string & {});

// ---------- Core entities ----------

export interface Team {
  id: string;
  league: LeagueId;
  name: string;
  abbrev: string;
  logoUrl?: string;
}

export interface Player {
  id: string;
  league: LeagueId;
  name: string;
  teamId?: string;
  position?: string;
  headshotUrl?: string;
}

// ---------- Games ----------

export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export interface GameClock {
  period: number;
  label: string; // "2nd", "OT", "SO" - adapter formats it
  timeRemaining?: string; // period clock, "12:34"; undefined during an intermission
  intermission?: boolean; // true between periods; `period` is the one just finished
  intermissionRemaining?: string; // intermission countdown, "03:05"
}

/** How a final game was decided. */
export type GameEnding = "regulation" | "overtime" | "shootout";

export interface GameSide {
  team: Team;
  score: number | null; // null before puck drop
  shotsOnGoal?: number;
  /** Season record before the game, "13-7-1" (W-L-OT in hockey). Only sent for games that have not started. */
  record?: string;
}

/** Who a TV feed is for: everyone in a country, or only fans of the home or away team. */
export type BroadcastMarket = "national" | "home" | "away";

export interface Broadcast {
  network: string; // "SN", "TNT", "NESN" - as the league names it, trimmed
  country: string; // ISO 3166 alpha-2, "CA" or "US"
  market: BroadcastMarket;
}

/** Where a game is played. `city` is only known for some responses (the NHL box score has it, the scores list does not). */
export interface Venue {
  name: string; // arena, "TD Garden"
  city?: string; // "Boston"
}

export interface Game {
  id: string;
  league: LeagueId;
  startTime: string; // ISO 8601, UTC
  status: GameStatus;
  clock?: GameClock; // only while live
  endedIn?: GameEnding; // only when final
  home: GameSide;
  away: GameSide;
  /** TV listings in every country the league reports, in the league's order. Empty or absent when none are known. */
  broadcasts?: Broadcast[];
  venue?: Venue;
  /** The league's name for a special game or series it is part of: "Winter Classic", "Original 6 Series". */
  specialEvent?: string;
  /**
   * Each team's score in each period, in order (a shootout is one more, worth one to the winner). A live game lists
   * every regulation period, the ones not played yet with null scores; overtime appears once it is played. Live and
   * final games only; absent when the league does not say, or when the periods do not add up to the score.
   */
  periods?: PeriodScore[];
  /** The game's standout player so far (most points), worded by the adapter. Live and final games only. */
  standout?: GameStandout;
  /** Where play stands right now (football's down and distance). Live games only, while play is on. */
  situation?: GameSituation;
}

export interface GameSituation {
  /** Worded by the adapter: "2nd & 8 at DET 22". */
  text: string;
  /** The team with the ball, when the league says. */
  possessionTeamId?: string;
  /** Inside the opponent's 20-yard line. */
  redZone?: boolean;
}

export interface PeriodScore {
  label: string; // "Q1", "2nd", "OT", "SO" - adapter formats it
  /** Null for a regulation period not played yet: a live game lists all of them, shown as "-". */
  away: number | null;
  home: number | null;
}

export interface GameStandout {
  /** Short form, "J. Brunson". */
  name: string;
  teamId: string;
  /** What they did, worded by the adapter: "31 PTS, 8 REB", "2 G, 1 A". */
  line: string;
}

// ---------- Generic stat tables ----------
// Lets the UI render any sport's stats without knowing the columns.

export interface StatColumn {
  key: string;
  label: string; // "G", "A", "SOG"
  align?: "left" | "right";
}

export interface StatRow {
  player: Player;
  /** Keyed by StatColumn.key. A missing key means the stat is not available (show "-"), not zero. */
  values: Record<string, string | number>;
}

export interface StatTable {
  title: string; // "Forwards", "Defence", "Goalies"
  columns: StatColumn[];
  rows: StatRow[];
}

/** Strength of a goal. Even strength is the default and has no tag. */
export type GoalStrength = "even" | "powerPlay" | "shortHanded";

export interface Goal {
  /** Team that scored. */
  teamId: string;
  period: number;
  periodLabel: string; // "1st", "OT", "2OT", "SO" - adapter formats it
  time: string; // elapsed in the period, "15:46"
  scorer: Player;
  /** The scorer's season goals including this one; undefined when unknown and on shootout goals. */
  scorerSeasonGoals?: number;
  assists: Player[]; // empty for an unassisted goal
  strength: GoalStrength;
  emptyNet: boolean;
  penaltyShot: boolean;
  /** Score right after this goal. */
  homeScore?: number;
  awayScore?: number;
  /** A web page with the goal's video, opened in the browser. Absent when the league has none. */
  videoUrl?: string;
}

/** A video of a whole game, on the league's website. */
export interface GameVideo {
  kind: "recap" | "condensed";
  /** A web page that plays the video, opened in the browser. */
  url: string;
}

/** One stat as value and label: "1" + "G", "29" + "saves", ".912" + "SV%". */
export interface StatItem {
  value: string;
  label: string;
}

/** A stat shown with one of the three stars. */
export type StarStat = StatItem;

/** One of the players the league named as a game's three stars. */
export interface GameStar {
  /** 1 is the first star. */
  rank: number;
  /** `teamId`, `position` and `headshotUrl` are filled in when the league sends them. */
  player: Player;
  sweaterNumber?: number;
  /** The player's game in a few stats, in display order. Empty when none are known. */
  stats: StarStat[];
}

/** How a penalty is served. "other" covers kinds the league sends that the app does not name. */
export type PenaltyKind =
  "minor" | "doubleMinor" | "major" | "misconduct" | "gameMisconduct" | "match" | "penaltyShot" | "other";

export interface Penalty {
  /** Team that took the penalty. */
  teamId: string;
  period: number;
  periodLabel: string; // "1st", "OT" - adapter formats it, as for goals
  time: string; // elapsed in the period, "18:31"
  /** Abbreviated name, "M. Geekie". Absent for a team (bench) penalty. */
  player?: string;
  sweaterNumber?: number;
  /** The infraction, "Roughing", "Delay of game (puck over glass)". */
  infraction: string;
  kind: PenaltyKind;
  /** Penalty minutes; 0 for a penalty shot. */
  minutes: number;
  /** Abbreviated name of the player who drew it, when known. */
  drawnBy?: string;
}

export interface GameDetail {
  game: Game;
  boxscore: { home: StatTable[]; away: StatTable[] };
  /** In the order scored. Absent when the league has no goal list for this game (yet); empty when no goals. */
  goals?: Goal[];
  /**
   * Every score in order, as plays of kind "score", for a league whose scores are not goals (football's
   * touchdowns and field goals). Absent for a league that sends `goals`, and before the first score.
   */
  scoringPlays?: Play[];
  /** First star first. Absent when the league has not named them (before and during the game) or they could not be loaded. */
  threeStars?: GameStar[];
  /** In the order taken. Absent when the league has no penalty list for this game (yet); empty when there were none. */
  penalties?: Penalty[];
  /** Recap first. Absent or empty until the league posts them (after the game) or when they could not be loaded. */
  videos?: GameVideo[];
  /** The teams side by side (shooting, rebounds, ...), in the league's order. Absent when the league has none. */
  teamStats?: TeamStatLine[];
  /** Each team's top performer so far, away first. Absent when the league names its own (three stars). */
  performers?: GamePerformer[];
  /** Fans in the building, once the league reports it (usually after the game). */
  attendance?: number;
}

export interface TeamStatLine {
  label: string; // "Field goal %", "Rebounds" - adapter words it
  /** As shown: "53%", "47". */
  away: string;
  home: string;
  /** The same as numbers, for the bar that compares them. Absent when they do not compare as numbers. */
  awayValue?: number;
  homeValue?: number;
}

export interface GamePerformer {
  teamId: string;
  player: Player;
  /** What they did, worded by the adapter: "45 PTS, 5 REB, 7 AST". */
  line: string;
}

// ---------- Play-by-play ----------

/** What a play is, as far as the play-by-play screen cares: scores and penalties are the key plays. */
export type PlayKind = "score" | "penalty" | "shot" | "other";

/** One thing that happened in a game, worded by the adapter. */
export interface Play {
  /** Unique within the game. */
  id: string;
  period: number;
  periodLabel: string; // "1st", "OT", "SO" - adapter formats it, as for goals
  /** The period's clock as the league shows it: elapsed in hockey ("03:22"), time left in football ("9:55"). */
  time: string;
  kind: PlayKind;
  /** The team the play belongs to (the scorer's, the shooter's, the one penalized). Absent for a stoppage. */
  teamId?: string;
  /** "C. Cowan (8) snap shot, assists: A. Matthews (18), M. Rielly (12)", in the league's terms. */
  text: string;
  /** "Power play", "Empty net": how a score was scored, when it was not the usual way. */
  tag?: string;
  /** The score right after a scoring play. */
  homeScore?: number;
  awayScore?: number;
}

/** A game's plays, in the order they happened, with the game they belong to (for its state and score). */
export interface GamePlays {
  game: Game;
  plays: Play[];
}

// ---------- Team page ----------

/** A team's season stats and nearby games, for its team page. */
export interface TeamDetail {
  teamId: string;
  /** Season stat tables in display order, best first ("Forwards", "Defence", "Goalies"). Empty before any games. */
  stats: StatTable[];
  /** Up to 5 games that have started or finished, newest first. Absent when the schedule could not be loaded. */
  recent?: Game[];
  /** Up to 5 games still to play, soonest first. Absent when the schedule could not be loaded. */
  upcoming?: Game[];
  /** The team's home arena: the venue most of its home games in the schedule use. Absent when unknown. */
  arena?: string;
}

// ---------- Player page ----------

/** Where a player is from and how they came into the league. Each field is absent when unknown. */
export interface PlayerBio {
  birthDate?: string; // YYYY-MM-DD
  /** "London, Ontario, CAN": as specific as the league reports. */
  birthPlace?: string;
  heightCm?: number;
  heightIn?: number;
  weightKg?: number;
  weightLb?: number;
  /** Shoots (skaters) or catches (goalies): "L" or "R". */
  handedness?: string;
  draft?: { year: number; teamId: string; round: number; overallPick: number };
}

/** One of the player's recent games. `values` are keyed by the table's column keys. */
export interface PlayerGameLine {
  gameId: string;
  date: string; // YYYY-MM-DD
  teamId: string;
  opponentId: string;
  home?: boolean;
  values: Record<string, string | number>;
}

/** One season with one team (a player who changed teams has one line per team). */
export interface PlayerSeasonLine {
  season: string; // "2026-27"
  team: string; // short name for this league's teams ("Kings"), full name elsewhere
  league: string; // as the league names it: "NHL", "AHL", "OHL"
  /** True for seasons in this app's league (the NHL for the NHL adapter). */
  inLeague: boolean;
  playoffs: boolean;
  values: Record<string, string | number>;
}

export interface PlayerDetail {
  /** Full name, current team, position and photo. */
  player: Player;
  /** The position in words, as the league names it in Canadian spelling: "Defence", "Point guard". Absent when unknown. */
  positionName?: string;
  sweaterNumber?: number;
  /** The current team, when the player has one. */
  team?: Team;
  active: boolean;
  goalie: boolean;
  bio: PlayerBio;
  /** "2026-27": the season `season` is for. */
  seasonLabel?: string;
  /** This regular season in a few stats, in display order. Empty before the player's first game. */
  season: StatItem[];
  career: { regularSeason: StatItem[]; playoffs: StatItem[] };
  /** Most recent first, up to 5. */
  lastGames: { columns: StatColumn[]; games: PlayerGameLine[] };
  /** Newest first, every league the player has played in. */
  seasons: { columns: StatColumn[]; rows: PlayerSeasonLine[] };
}

// ---------- Standings ----------

/** A team's results over some stretch of the season: all of it, home games, road games, the last 10. */
export interface RecordSplit {
  wins: number;
  losses: number;
  otLosses?: number; // hockey only
  ties?: number; // football only
  goalsFor?: number;
  goalsAgainst?: number;
}

export interface StandingRow {
  team: Team;
  /** Position within the group the row sits in (the division for the NHL). */
  rank: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses?: number; // hockey only
  ties?: number; // football only
  points?: number;
  /** Share of games won, 0-1 (basketball standings sort by it). */
  winPercent?: number;
  /** Games behind the conference leader; 0 for the leader. */
  gamesBehind?: number;
  streak?: string; // "W3"
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifferential?: number;
  last10?: RecordSplit;
  home?: RecordSplit;
  road?: RecordSplit;
  divisionName?: string;
  /** "Eastern Conference"; undefined for leagues without conferences. */
  conferenceName?: string;
  /** Position in the whole league (the league's own tiebreakers), 1-based. */
  leagueRank?: number;
  /** Position in the conference (the league's own seeding and tiebreakers), 1-based. */
  conferenceRank?: number;
  /**
   * Position in the conference wild card race (the league's own tiebreakers), 1-based. Undefined for a team that
   * holds one of its division's playoff spots, and for leagues without wild cards.
   */
  wildCardRank?: number;
}

export interface StandingsGroup {
  name: string; // "Atlantic", "Eastern Conference", or "League"
  rows: StandingRow[];
}

export interface StandingsBand {
  label: string;
  /** The last conference position in the band; absent on the last band, which holds the rest. */
  through?: number;
}

export interface Standings {
  league: LeagueId;
  groups: StandingsGroup[];
  /** Wild card playoff spots per conference (2 in the NHL); undefined for leagues without wild cards. */
  wildCardSpots?: number;
  /**
   * What a conference position means, best first: each band holds the positions up to its `through` (the last one
   * holds the rest). The NBA's: "Playoffs" through 6, "Play-in" through 10, then "Out". Undefined for leagues whose
   * conference rank decides nothing on its own (the NHL's playoff spots are by division and wild card).
   */
  conferenceBands?: StandingsBand[];
  updatedAt: string;
}

// ---------- Leaders ----------

export interface LeaderEntry {
  rank: number; // tied values share a rank: 1, 2, 2, 4
  player: Player;
  team: Team;
  value: number;
}

export interface LeaderBoard {
  category: string; // "goals", "assists", "points"
  label: string;
  /** "percent": values are 0-1 fractions, shown as "64.0%". Absent: show values as they are. */
  format?: "percent";
  /** Show values with this many decimals (1 for per-game averages). Absent: as the app shows any stat value. */
  decimals?: number;
  entries: LeaderEntry[];
}

// ---------- Player spotlight ----------

/** One of the players the league is featuring right now. */
export interface SpotlightEntry {
  player: Player;
  team: Team;
  sweaterNumber?: number;
}

/** Special event names by game id ("Original 6 Series"), for games that are part of one. */
export type SpecialEvents = Record<string, string>;

// ---------- Adapter contract ----------

/** Leader boards shown together under one choice on the Leaders tab (the NHL's Skaters and Goalies). */
export interface LeaderGroup {
  id: string;
  label: string;
  /** The categories to ask for, one board each; absent: the adapter's default boards (`getLeaders()`). */
  categories?: string[];
}

export interface LeaderQuery {
  category?: string;
  limit?: number;
}

/** A minor problem in an API response that the adapter worked around (see the adapter's validation). */
export interface AdapterWarning {
  url: string;
  message: string; // savePctg: unexpected value ".905" (string), ignored
}

export interface RequestOptions {
  /** Receives warnings for this request only. Overrides the adapter's default handler. */
  onWarning?: (warning: AdapterWarning) => void;
}

/**
 * Parts of the app a league may not have. An adapter leaves out the method for a feature it does not support
 * (see FEATURE_METHODS), and the UI hides what leads there: a second league can start with scores, standings and
 * leaders only.
 */
export type LeagueFeature = "specialEvents" | "spotlight" | "gameDetail" | "plays" | "team" | "player";

/** The adapter method behind each optional feature. */
export const FEATURE_METHODS = {
  specialEvents: "getSpecialEvents",
  spotlight: "getSpotlight",
  gameDetail: "getGameDetail",
  plays: "getPlays",
  team: "getTeam",
  player: "getPlayer",
} as const satisfies Record<LeagueFeature, keyof LeagueAdapter>;

/** Whether `adapter` has the method for `feature`. */
export function adapterSupports(adapter: LeagueAdapter, feature: LeagueFeature): boolean {
  return typeof adapter[FEATURE_METHODS[feature]] === "function";
}

/**
 * Every league has scores, standings and leaders; the other methods are optional (LeagueFeature). An optional
 * method, when present, behaves as described here.
 */
/**
 * What a league's live score notifications announce, besides the final.
 * - eachScore: every score, with the scorer from the game page's goal list (hockey's goals).
 * - lateLeadChanges: a change of lead from the last regulation period on, and the start of each overtime (for a
 *   sport that scores too often to announce each score). Read from the scores alone, so no game page is loaded.
 */
export type LiveAlertRule = { kind: "eachScore" } | { kind: "lateLeadChanges"; regulationPeriods: number };

export interface LeagueAdapter {
  readonly league: LeagueId;
  /** The league's full name, read out for its button in the league row ("National Hockey League"). */
  readonly name: string;
  /**
   * The sport's word for the start of a game, capitalized, as a reminder's title begins: "Puck drop", "Tip-off".
   * Absent: "Game start".
   */
  readonly gameStartTerm?: string;
  /** Which moments of a followed game get a notification (LiveAlertRule). Absent: each score. */
  readonly liveAlerts?: LiveAlertRule;

  /** All games on a league calendar date, YYYY-MM-DD. */
  getScores(date: string, options?: RequestOptions): Promise<Game[]>;

  getStandings(options?: RequestOptions): Promise<Standings>;

  getLeaders(query?: LeaderQuery, options?: RequestOptions): Promise<LeaderBoard[]>;

  /** How the Leaders tab groups boards. Absent: one group, the default boards, with no choice to make. */
  readonly leaderGroups?: readonly LeaderGroup[];

  /**
   * Special event names for the games in the week starting on `date` (YYYY-MM-DD), by game id. Empty when there are
   * none or the league has no such thing. The scores do not always carry them, so the UI asks for these separately.
   */
  getSpecialEvents?(date: string, options?: RequestOptions): Promise<SpecialEvents>;

  /** The players the league is featuring, in its order. Empty when the league has no such list. */
  getSpotlight?(options?: RequestOptions): Promise<SpotlightEntry[]>;

  getGameDetail?(gameId: string, options?: RequestOptions): Promise<GameDetail>;

  /** Every play of a game so far, in order. Empty before the game starts. */
  getPlays?(gameId: string, options?: RequestOptions): Promise<GamePlays>;

  /** A team's season stats and its recent and upcoming games. `teamId` is a Team.id. */
  getTeam?(teamId: string, options?: RequestOptions): Promise<TeamDetail>;

  /** A player's bio, stats and recent games. `playerId` is a Player.id. */
  getPlayer?(playerId: string, options?: RequestOptions): Promise<PlayerDetail>;
}
