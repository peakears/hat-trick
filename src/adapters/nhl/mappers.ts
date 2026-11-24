import type {
  GamePlays,
  Play,
  PlayKind,
  Broadcast,
  BroadcastMarket,
  Game,
  GameClock,
  GameEnding,
  GameSide,
  GameStar,
  GameStatus,
  GameVideo,
  Goal,
  GoalStrength,
  LeaderBoard,
  SpecialEvents,
  SpotlightEntry,
  Player,
  PlayerDetail,
  PlayerGameLine,
  PlayerSeasonLine,
  RecordSplit,
  StatColumn,
  StatTable,
  Standings,
  StandingsGroup,
  StarStat,
  StatItem,
  Team,
  TeamDetail,
  Penalty,
  PenaltyKind,
  Venue,
} from "../../domain";
import {
  GOALIE_COLUMNS,
  LEADER_LABELS,
  PERCENT_LEADER_CATEGORIES,
  LEAGUE,
  PLAYER_GAME_GOALIE_COLUMNS,
  PLAYER_GAME_SKATER_COLUMNS,
  PLAYER_SEASON_GOALIE_COLUMNS,
  PLAYER_SEASON_SKATER_COLUMNS,
  SEASON_GOALIE_COLUMNS,
  SEASON_SKATER_COLUMNS,
  SKATER_COLUMNS,
  TEAM_GAMES_SHOWN,
  WILD_CARD_SPOTS,
} from "./constants";
import type {
  RawBoxscore,
  RawBroadcast,
  RawClubGoalie,
  RawClubSchedule,
  RawClubSkater,
  RawClubStats,
  RawGame,
  RawGoal,
  RawGoalie,
  RawLanding,
  RawPenalty,
  RawPenaltyPeriod,
  RawSchedule,
  RawLeadersResponse,
  RawPlayerGame,
  RawPlayerLanding,
  RawPlayerSeason,
  RawPlayerStats,
  RawSpotlight,
  RawSideStats,
  RawSkater,
  RawStandingsResponse,
  RawTeam,
  RawThreeStar,
  RawPlay,
  RawPlayByPlay,
} from "./raw-types";

// Team ids are the three-letter abbreviation everywhere, because the
// standings endpoint has no numeric team id.
export function mapTeam(raw: RawTeam): Team {
  return {
    id: raw.abbrev,
    league: LEAGUE,
    name: raw.commonName?.default ?? raw.name?.default ?? raw.abbrev,
    abbrev: raw.abbrev,
    logoUrl: raw.logo,
  };
}

export function mapStatus(state: string): GameStatus {
  switch (state) {
    case "LIVE":
    case "CRIT":
      return "live";
    case "FINAL":
    case "OFF":
      return "final";
    case "PPD":
    case "SUSP":
      return "postponed";
    default:
      return "scheduled"; // FUT, PRE, and anything new
  }
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function mapClock(raw: RawGame): GameClock | undefined {
  const pd = raw.periodDescriptor;
  if (!pd) return undefined;
  const label = pd.periodType === "SO" ? "SO" : pd.periodType === "OT" ? "OT" : ordinal(pd.number);
  // During an intermission the API's timeRemaining is the intermission countdown.
  const intermission = raw.clock?.inIntermission ?? false;
  return {
    period: pd.number,
    label,
    timeRemaining: intermission ? undefined : raw.clock?.timeRemaining,
    intermission,
    intermissionRemaining: intermission ? raw.clock?.timeRemaining : undefined,
  };
}

function mapEnding(raw: RawGame): GameEnding | undefined {
  switch (raw.gameOutcome?.lastPeriodType) {
    case "REG":
      return "regulation";
    case "OT":
      return "overtime";
    case "SO":
      return "shootout";
    default:
      return undefined;
  }
}

function mapSide(raw: RawTeam, status: GameStatus): GameSide {
  return {
    team: mapTeam(raw),
    score: status === "scheduled" ? null : (raw.score ?? 0),
    shotsOnGoal: raw.sog,
    record: raw.record,
  };
}

const MARKETS: Record<string, BroadcastMarket> = { N: "national", H: "home", A: "away" };

/** Keeps the league's order, drops listings with an unknown market or no name, and drops repeats. */
function mapBroadcasts(raw: RawBroadcast[] | undefined): Broadcast[] | undefined {
  if (!raw) return undefined;
  const seen = new Set<string>();
  const out: Broadcast[] = [];
  for (const b of raw) {
    const market = MARKETS[b.market];
    const network = b.network.trim();
    const country = b.countryCode.trim().toUpperCase();
    if (!market || !network || !country) continue;
    const key = `${country}|${market}|${network.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ network, country, market });
  }
  return out;
}

function mapVenue(raw: RawGame): Venue | undefined {
  const name = raw.venue?.default.trim();
  if (!name) return undefined;
  return { name, city: raw.venueLocation?.default.trim() || undefined };
}

export function mapGame(raw: RawGame): Game {
  const status = mapStatus(raw.gameState);
  return {
    id: String(raw.id),
    league: LEAGUE,
    startTime: raw.startTimeUTC,
    status,
    clock: status === "live" ? mapClock(raw) : undefined,
    endedIn: status === "final" ? mapEnding(raw) : undefined,
    home: mapSide(raw.homeTeam, status),
    away: mapSide(raw.awayTeam, status),
    broadcasts: mapBroadcasts(raw.tvBroadcasts),
    venue: mapVenue(raw),
    specialEvent: specialEventName(raw.specialEvent),
  };
}

function specialEventName(raw: { name: { default: string } } | undefined): string | undefined {
  return raw?.name.default.trim() || undefined;
}

/** Special event names by game id for a week of the schedule. */
export function mapSpecialEvents(raw: RawSchedule): SpecialEvents {
  const events: SpecialEvents = {};
  for (const day of raw.gameWeek ?? []) {
    for (const game of day.games ?? []) {
      const name = specialEventName(game.specialEvent);
      if (name) events[String(game.id)] = name;
    }
  }
  return events;
}

/** The landing's special event, for a game whose box score has none. */
export function landingSpecialEvent(raw: RawLanding): string | undefined {
  return specialEventName(raw.specialEvent);
}

const STRENGTHS: Record<string, GoalStrength> = { pp: "powerPlay", sh: "shortHanded" };

function periodLabel(period: number, pd: { periodType: string; maxRegulationPeriods?: number } | undefined): string {
  if (pd?.periodType === "SO") return "SO";
  if (pd?.periodType === "OT") {
    // Playoff overtimes carry on from the regulation count: period 4 is OT, 5 is 2OT.
    const n = period - (pd.maxRegulationPeriods ?? 3);
    return n > 1 ? `${n}OT` : "OT";
  }
  return ordinal(period);
}

function goalPeriodLabel(raw: RawGoal): string {
  return periodLabel(raw.period, raw.periodDescriptor);
}

/** Goals in the order the API lists them (the order scored). */
export function mapGoals(raw: RawGoal[] | undefined): Goal[] | undefined {
  if (!raw) return undefined;
  return raw.map((g) => {
    // Shootout goals do not count toward a player's season, so they get no total.
    const shootout = g.periodDescriptor?.periodType === "SO";
    return {
      teamId: g.teamAbbrev,
      period: g.period,
      periodLabel: goalPeriodLabel(g),
      time: g.timeInPeriod,
      scorer: { id: String(g.playerId), league: LEAGUE, name: g.name.default, teamId: g.teamAbbrev },
      scorerSeasonGoals: shootout ? undefined : g.goalsToDate,
      assists: (g.assists ?? []).map((a) => ({
        id: String(a.playerId),
        league: LEAGUE,
        name: a.name.default,
        teamId: g.teamAbbrev,
      })),
      strength: STRENGTHS[g.strength ?? ""] ?? "even",
      emptyNet: g.goalModifier === "empty-net",
      penaltyShot: g.goalModifier === "penalty-shot",
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      videoUrl: nhlVideoUrl(g.highlightClipSharingUrl),
    };
  });
}

// A video page on nhl.com: the whole URL must match, so a link can never lead anywhere else.
const VIDEO_PATH = /^\/video\/[a-z0-9-]+$/;
const VIDEO_URL = /^https:\/\/(www\.)?nhl\.com\/video\/[a-z0-9-]+$/;

/**
 * An nhl.com video page from a full URL (goal clips) or a site path (recaps), or undefined for anything else.
 * Exported for tests.
 */
export function nhlVideoUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (VIDEO_URL.test(raw)) return raw;
  return VIDEO_PATH.test(raw) ? `https://www.nhl.com${raw}` : undefined;
}

/** A finished game's recap and condensed game, from its entry in /score. */
export function mapGameVideos(raw: RawGame | undefined): GameVideo[] {
  const videos: GameVideo[] = [];
  const recap = nhlVideoUrl(raw?.threeMinRecap);
  const condensed = nhlVideoUrl(raw?.condensedGame);
  if (recap) videos.push({ kind: "recap", url: recap });
  if (condensed) videos.push({ kind: "condensed", url: condensed });
  return videos;
}

// Seen: "MIN", "PS". The others are the codes the league is known to use, unverified (see raw-types.ts).
const PENALTY_KINDS: Record<string, PenaltyKind> = {
  MIN: "minor",
  BEN: "minor", // bench minor
  MAJ: "major",
  MIS: "misconduct",
  GAM: "gameMisconduct",
  MAT: "match",
  PS: "penaltyShot",
};

function penaltyKind(raw: RawPenalty): PenaltyKind {
  const kind = PENALTY_KINDS[raw.type] ?? "other";
  return kind === "minor" && raw.duration === 4 ? "doubleMinor" : kind;
}

// descKeys whose words do not read right with the hyphens turned into spaces. Others become "Holding the stick".
const INFRACTIONS: Record<string, string> = {
  "cross-checking": "Cross-checking",
  "high-sticking": "High-sticking",
  "hi-sticking": "High-sticking",
  "interference-goalkeeper": "Goaltender interference",
  "goalie-interference": "Goaltender interference",
  "delaying-game": "Delay of game",
  "delaying-game-puck-over-glass": "Delay of game (puck over glass)",
  "delaying-game-unsuccessful-challenge": "Delay of game (failed challenge)",
  "delaying-game-face-off-violation": "Delay of game (faceoff violation)",
  "too-many-men-on-the-ice": "Too many men on the ice",
  "unsportsmanlike-conduct": "Unsportsmanlike conduct",
  "game-misconduct": "Game misconduct",
};

/** "Roughing", "Delay of game (puck over glass)"; a penalty shot's "ps-hooking-on-breakaway" is "Hooking on a breakaway". */
export function infractionLabel(descKey: string): string {
  const shot = /^ps-(.+)-on-breakaway$/.exec(descKey);
  if (shot) return `${infractionLabel(shot[1])} on a breakaway`;
  const known = INFRACTIONS[descKey];
  if (known) return known;
  const words = descKey.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "M. Geekie", the same short form the goals use. */
function shortName(raw: { firstName: { default: string }; lastName: { default: string } } | undefined) {
  if (!raw) return undefined;
  const first = raw.firstName.default.trim();
  return first ? `${first.charAt(0)}. ${raw.lastName.default}` : raw.lastName.default;
}

/** The landing's penalties, flattened from per-period groups into the order taken. Undefined when it has no list. */
export function mapPenalties(raw: RawPenaltyPeriod[] | undefined): Penalty[] | undefined {
  if (!raw) return undefined;
  return raw.flatMap((period) =>
    (period.penalties ?? []).map((p) => ({
      teamId: p.teamAbbrev.default,
      period: period.periodDescriptor.number,
      periodLabel: periodLabel(period.periodDescriptor.number, period.periodDescriptor),
      time: p.timeInPeriod,
      player: shortName(p.committedByPlayer),
      sweaterNumber: p.committedByPlayer?.sweaterNumber,
      infraction: infractionLabel(p.descKey),
      kind: penaltyKind(p),
      minutes: p.duration,
      drawnBy: shortName(p.drawnBy),
    })),
  );
}

function mapPlayer(raw: { playerId: number; name: { default: string }; position?: string }): Player {
  return {
    id: String(raw.playerId),
    league: LEAGUE,
    name: raw.name.default,
    position: raw.position,
  };
}

function statTable<T extends RawSkater | RawGoalie>(title: string, columns: StatColumn[], rows: T[] = []): StatTable {
  return {
    title,
    columns,
    rows: rows.map((r) => {
      const record = r as unknown as Record<string, string | number | undefined>;
      const values: Record<string, string | number> = {};
      for (const c of columns) {
        const v = record[c.key];
        // Leave missing stats out instead of showing 0 (e.g. a backup goalie has no savePctg).
        if (v !== undefined && v !== null) values[c.key] = v;
      }
      return { player: mapPlayer(r), values };
    }),
  };
}

export function mapBoxscoreSide(stats?: RawSideStats): StatTable[] {
  return [
    statTable("Forwards", SKATER_COLUMNS, stats?.forwards),
    statTable("Defence", SKATER_COLUMNS, stats?.defense),
    statTable("Goalies", GOALIE_COLUMNS, stats?.goalies),
  ];
}

// ---------- Three stars ----------

/** ".905", or "1.000" for a perfect game (hockey writes save percentage without the leading zero). */
export function savePctLabel(value: number): string {
  return value >= 1 ? "1.000" : value.toFixed(3).replace(/^0/, "");
}

function starStats(star: RawThreeStar, skater?: RawSkater, goalie?: RawGoalie): StarStat[] {
  const stats: StarStat[] = [];
  const add = (value: string | number | undefined, label: string) => {
    if (value !== undefined) stats.push({ value: String(value), label });
  };
  if (star.position === "G" || goalie) {
    // The landing only has GAA and SV%; the box score adds the saves.
    add(goalie?.saves, goalie?.saves === 1 ? "save" : "saves");
    const pct = star.savePctg ?? goalie?.savePctg;
    add(pct === undefined ? undefined : savePctLabel(pct), "SV%");
  } else {
    add(star.goals ?? skater?.goals, "G");
    add(star.assists ?? skater?.assists, "A");
    add(skater?.toi, "TOI");
  }
  return stats;
}

/**
 * The three stars from the landing response, first star first, with saves and ice time from the
 * box score (matched by player id). Undefined until the league names them.
 */
export function mapThreeStars(landing: RawLanding, boxscore?: RawBoxscore): GameStar[] | undefined {
  const stars = landing.summary?.threeStars;
  if (!stars || stars.length === 0) return undefined;
  const sides = [boxscore?.playerByGameStats?.homeTeam, boxscore?.playerByGameStats?.awayTeam];
  const skaters = sides.flatMap((s) => [...(s?.forwards ?? []), ...(s?.defense ?? [])]);
  const goalies = sides.flatMap((s) => s?.goalies ?? []);
  return [...stars]
    .sort((a, b) => a.star - b.star)
    .map((star) => ({
      rank: star.star,
      player: {
        id: String(star.playerId),
        league: LEAGUE,
        name: star.name.default,
        teamId: star.teamAbbrev,
        position: star.position,
        headshotUrl: star.headshot,
      },
      sweaterNumber: star.sweaterNo,
      stats: starStats(
        star,
        skaters.find((p) => p.playerId === star.playerId),
        goalies.find((p) => p.playerId === star.playerId),
      ),
    }));
}

type RawStanding = NonNullable<RawStandingsResponse["standings"]>[number];

/** One of the home/road/last-10 splits, or undefined if the response lacks its wins or losses. */
function mapSplit(s: RawStanding, prefix: "home" | "road" | "l10"): RecordSplit | undefined {
  const wins = s[`${prefix}Wins`];
  const losses = s[`${prefix}Losses`];
  if (wins === undefined || losses === undefined) return undefined;
  return {
    wins,
    losses,
    otLosses: s[`${prefix}OtLosses`],
    goalsFor: s[`${prefix}GoalsFor`],
    goalsAgainst: s[`${prefix}GoalsAgainst`],
  };
}

export function mapStandings(raw: RawStandingsResponse): Standings {
  const groups = new Map<string, StandingsGroup>();

  // The API returns teams sorted by points, so index order is rank order.
  for (const s of raw.standings ?? []) {
    const name = s.divisionName ?? s.divisionAbbrev ?? "League";
    let group = groups.get(name);
    if (!group) {
      group = { name, rows: [] };
      groups.set(name, group);
    }
    group.rows.push({
      team: {
        id: s.teamAbbrev.default,
        league: LEAGUE,
        // Match the other endpoints, which use the common name ("Oilers", not "Edmonton Oilers").
        name: s.teamCommonName?.default ?? s.teamName.default,
        abbrev: s.teamAbbrev.default,
        logoUrl: s.teamLogo,
      },
      rank: group.rows.length + 1,
      gamesPlayed: s.gamesPlayed,
      wins: s.wins,
      losses: s.losses,
      otLosses: s.otLosses,
      points: s.points,
      streak: s.streakCode && s.streakCount ? `${s.streakCode}${s.streakCount}` : undefined,
      goalsFor: s.goalFor,
      goalsAgainst: s.goalAgainst,
      goalDifferential: s.goalDifferential,
      last10: mapSplit(s, "l10"),
      home: mapSplit(s, "home"),
      road: mapSplit(s, "road"),
      divisionName: s.divisionName,
      conferenceName: s.conferenceName ? `${s.conferenceName} Conference` : undefined,
      leagueRank: s.leagueSequence,
      // 0 means the team holds a division spot.
      wildCardRank: s.wildcardSequence || undefined,
    });
  }

  const rows = [...groups.values()].flatMap((g) => g.rows);
  const hasWildCards = raw.wildCardIndicator !== false && rows.some((r) => r.wildCardRank !== undefined);
  return {
    league: LEAGUE,
    groups: [...groups.values()],
    ...(hasWildCards ? { wildCardSpots: WILD_CARD_SPOTS } : {}),
    updatedAt: new Date().toISOString(),
  };
}

// Standard competition ranking: tied values share a rank (1, 2, 2, 4).
// The API returns each list already sorted best-first.
function competitionRanks(values: number[]): number[] {
  return values.map((v, i) => {
    let first = i;
    while (first > 0 && values[first - 1] === v) first--;
    return first + 1;
  });
}

export function mapLeaders(raw: RawLeadersResponse, categories: string[]): LeaderBoard[] {
  return categories.map((key) => {
    const list = raw[key] ?? [];
    const ranks = competitionRanks(list.map((l) => l.value));
    return {
      category: key,
      label: LEADER_LABELS[key] ?? key,
      ...(PERCENT_LEADER_CATEGORIES.includes(key) ? { format: "percent" as const } : {}),
      entries: list.map((l, i) => ({
        rank: ranks[i],
        player: {
          id: String(l.id),
          league: LEAGUE,
          name: `${l.firstName.default} ${l.lastName.default}`,
          teamId: l.teamAbbrev,
          position: l.position,
          headshotUrl: l.headshot,
        },
        team: {
          id: l.teamAbbrev,
          league: LEAGUE,
          name: l.teamName?.default ?? l.teamAbbrev,
          abbrev: l.teamAbbrev,
          logoUrl: l.teamLogo,
        },
        value: l.value,
      })),
    };
  });
}

// ---------- Team page ----------

/** Seconds as "17:16" (minutes are not wrapped, so a goalie's season total reads "838:22"). */
function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

type SeasonRow = RawClubSkater | RawClubGoalie;

function seasonPlayer(raw: SeasonRow, position?: string): Player {
  return {
    id: String(raw.playerId),
    league: LEAGUE,
    name: `${raw.firstName.default} ${raw.lastName.default}`,
    position,
    headshotUrl: raw.headshot,
  };
}

/** A season table: values come from the raw fields named by the column keys (missing ones are left out). */
function seasonTable<T extends SeasonRow>(
  title: string,
  columns: StatColumn[],
  rows: T[],
  extra: (raw: T) => Record<string, string | number>,
  position: (raw: T) => string | undefined,
  rank: (a: T, b: T) => number,
): StatTable {
  const sorted = [...rows].sort((a, b) => rank(a, b) || seasonPlayer(a).name.localeCompare(seasonPlayer(b).name));
  return {
    title,
    columns,
    rows: sorted.map((r) => {
      const record = { ...(r as unknown as Record<string, string | number | undefined>), ...extra(r) };
      const values: Record<string, string | number> = {};
      for (const c of columns) {
        const v = record[c.key];
        if (v !== undefined && v !== null) values[c.key] = v;
      }
      return { player: seasonPlayer(r, position(r)), values };
    }),
  };
}

const num0 = (n: number | undefined) => n ?? 0;

/** Forwards and defensemen ranked by points (then goals), goalies by games started. Empty tables are left out. */
export function mapClubStats(raw: RawClubStats): StatTable[] {
  const skaters = raw.skaters ?? [];
  const isDefense = (s: RawClubSkater) => s.positionCode === "D";
  const bySkaterScoring = (a: RawClubSkater, b: RawClubSkater) =>
    num0(b.points) - num0(a.points) || num0(b.goals) - num0(a.goals);
  const skaterExtra = (s: RawClubSkater): Record<string, string> =>
    s.avgTimeOnIcePerGame === undefined ? {} : { toi: clock(s.avgTimeOnIcePerGame) };

  const tables = [
    seasonTable(
      "Forwards",
      SEASON_SKATER_COLUMNS,
      skaters.filter((s) => !isDefense(s)),
      skaterExtra,
      (s) => s.positionCode,
      bySkaterScoring,
    ),
    seasonTable(
      "Defence",
      SEASON_SKATER_COLUMNS,
      skaters.filter(isDefense),
      skaterExtra,
      (s) => s.positionCode,
      bySkaterScoring,
    ),
    seasonTable(
      "Goalies",
      SEASON_GOALIE_COLUMNS,
      raw.goalies ?? [],
      () => ({}),
      () => "G",
      (a, b) => num0(b.gamesStarted) - num0(a.gamesStarted) || num0(b.gamesPlayed) - num0(a.gamesPlayed),
    ),
  ];
  return tables.filter((t) => t.rows.length > 0);
}

/**
 * The games around now from a team's season schedule: the last few that started (newest first) and the
 * next few still to play (soonest first). Preseason games and postponed ones are left out.
 */
/** The venue used by most of the team's home games, so a one-off outdoor or neutral-site game does not win. */
function homeArena(games: Game[], teamId: string): string | undefined {
  const counts = new Map<string, number>();
  for (const g of games) {
    if (g.home.team.id === teamId && g.venue) counts.set(g.venue.name, (counts.get(g.venue.name) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [name, n] of counts) if (best === undefined || n > (counts.get(best) ?? 0)) best = name;
  return best;
}

export function mapTeamSchedule(
  raw: RawClubSchedule,
  teamId: string,
): Pick<TeamDetail, "recent" | "upcoming" | "arena"> {
  const games = (raw.games ?? [])
    .filter((g) => g.gameType !== 1) // 1 is preseason
    .map(mapGame)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return {
    arena: homeArena(games, teamId),
    recent: games
      .filter((g) => g.status === "final" || g.status === "live")
      .slice(-TEAM_GAMES_SHOWN)
      .reverse(),
    upcoming: games.filter((g) => g.status === "scheduled").slice(0, TEAM_GAMES_SHOWN),
  };
}

// ---------- Player page ----------

/** 20262027 as "2026-27". */
export function seasonLabel(season: number): string {
  const start = Math.floor(season / 10000);
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Values for the given columns, leaving out stats the response does not have. */
function pick(record: Record<string, unknown>, columns: { key: string }[]): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const { key } of columns) {
    const v = record[key];
    if (typeof v === "number" || typeof v === "string") values[key] = v;
  }
  return values;
}

/** Stats as value/label pairs in the given order; missing ones are left out. */
function items(
  stats: RawPlayerStats | undefined,
  fields: [keyof RawPlayerStats, string, (n: number) => string][],
): StatItem[] {
  if (!stats) return [];
  return fields.flatMap(([key, label, format]) => {
    const v = stats[key];
    return typeof v === "number" ? [{ value: format(v), label }] : [];
  });
}

const whole = (n: number) => String(n);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const gaa = (n: number) => n.toFixed(2);

const SKATER_SEASON: [keyof RawPlayerStats, string, (n: number) => string][] = [
  ["gamesPlayed", "GP", whole],
  ["goals", "G", whole],
  ["assists", "A", whole],
  ["points", "PTS", whole],
  ["plusMinus", "+/-", signed],
  ["pim", "PIM", whole],
  ["powerPlayPoints", "PPP", whole],
  ["shootingPctg", "S%", pct],
];

const GOALIE_SEASON: [keyof RawPlayerStats, string, (n: number) => string][] = [
  ["gamesPlayed", "GP", whole],
  ["wins", "W", whole],
  ["losses", "L", whole],
  ["otLosses", "OTL", whole],
  ["goalsAgainstAvg", "GAA", gaa],
  ["savePctg", "SV%", savePctLabel],
  ["shutouts", "SO", whole],
];

function playerGame(raw: RawPlayerGame, columns: { key: string }[]): PlayerGameLine {
  return {
    gameId: String(raw.gameId),
    date: raw.gameDate,
    teamId: raw.teamAbbrev,
    opponentId: raw.opponentAbbrev,
    home: raw.homeRoadFlag === undefined ? undefined : raw.homeRoadFlag === "H",
    values: pick(raw, columns),
  };
}

function playerSeason(raw: RawPlayerSeason, columns: { key: string }[]): PlayerSeasonLine {
  const inLeague = raw.leagueAbbrev === "NHL";
  return {
    season: seasonLabel(raw.season),
    team: (inLeague ? raw.teamCommonName?.default : undefined) ?? raw.teamName.default,
    league: raw.leagueAbbrev,
    inLeague,
    playoffs: raw.gameTypeId === 3,
    values: pick(raw, columns),
  };
}

/** "London, Ontario, CAN", skipping parts that are missing. */
function birthPlace(raw: RawPlayerLanding): string | undefined {
  const parts = [raw.birthCity?.default, raw.birthStateProvince?.default, raw.birthCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** The NHL's position codes in words. */
const POSITION_NAMES: Record<string, string> = {
  C: "Centre",
  L: "Left wing",
  R: "Right wing",
  D: "Defence",
  G: "Goalie",
};

export function mapPlayerDetail(raw: RawPlayerLanding): PlayerDetail {
  const goalie = raw.position === "G";
  const teamId = raw.currentTeamAbbrev;
  const gameColumns = goalie ? PLAYER_GAME_GOALIE_COLUMNS : PLAYER_GAME_SKATER_COLUMNS;
  const seasonColumns = goalie ? PLAYER_SEASON_GOALIE_COLUMNS : PLAYER_SEASON_SKATER_COLUMNS;
  const seasonFields = goalie ? GOALIE_SEASON : SKATER_SEASON;
  // Career lines are shorter than a season's: the headline numbers only.
  const careerFields = goalie
    ? GOALIE_SEASON.filter(([k]) => ["gamesPlayed", "wins", "goalsAgainstAvg", "savePctg", "shutouts"].includes(k))
    : SKATER_SEASON.filter(([k]) => ["gamesPlayed", "goals", "assists", "points"].includes(k));
  const featured = raw.featuredStats;
  // The API lists seasons oldest first, so reversed they are newest first. Within a season this puts
  // the team a player joined last first. (`sequence` is not a usable order: outside the NHL it holds
  // large ids.) The sort is stable, so it only fixes seasons the API sent out of order.
  const seasons = [...(raw.seasonTotals ?? [])]
    .reverse()
    .sort((a, b) => b.season - a.season)
    .map((r) => playerSeason(r, seasonColumns));
  const draft = raw.draftDetails;

  return {
    player: {
      id: String(raw.playerId),
      league: LEAGUE,
      name: `${raw.firstName.default} ${raw.lastName.default}`,
      teamId,
      position: raw.position,
      headshotUrl: raw.headshot,
    },
    positionName: raw.position === undefined ? undefined : (POSITION_NAMES[raw.position] ?? raw.position),
    sweaterNumber: raw.sweaterNumber,
    team: teamId
      ? { id: teamId, league: LEAGUE, name: raw.fullTeamName?.default ?? teamId, abbrev: teamId, logoUrl: raw.teamLogo }
      : undefined,
    active: raw.isActive ?? teamId !== undefined,
    goalie,
    bio: {
      birthDate: raw.birthDate,
      birthPlace: birthPlace(raw),
      heightCm: raw.heightInCentimeters,
      heightIn: raw.heightInInches,
      weightKg: raw.weightInKilograms,
      weightLb: raw.weightInPounds,
      handedness: raw.shootsCatches,
      draft: draft && {
        year: draft.year,
        teamId: draft.teamAbbrev,
        round: draft.round,
        overallPick: draft.overallPick,
      },
    },
    seasonLabel: featured ? seasonLabel(featured.season) : undefined,
    season: items(featured?.regularSeason?.subSeason, seasonFields),
    career: {
      regularSeason: items(raw.careerTotals?.regularSeason, careerFields),
      playoffs: items(raw.careerTotals?.playoffs, careerFields),
    },
    lastGames: { columns: gameColumns, games: (raw.last5Games ?? []).map((g) => playerGame(g, gameColumns)) },
    seasons: { columns: seasonColumns, rows: seasons },
  };
}

// ---------- Player spotlight ----------

/** The featured players in the league's order (`sortId`); any without one go last, as sent. */
export function mapSpotlight(raw: RawSpotlight): SpotlightEntry[] {
  const list = (raw ?? []).map((p, i) => ({ p, i }));
  list.sort((a, b) => (a.p.sortId ?? Infinity) - (b.p.sortId ?? Infinity) || a.i - b.i);
  return list.map(({ p }) => ({
    player: {
      id: String(p.playerId),
      league: LEAGUE,
      name: p.name.default,
      teamId: p.teamTriCode,
      position: p.position,
      headshotUrl: p.headshot,
    },
    // The response has the team's code and logo but not its name.
    team: { id: p.teamTriCode, league: LEAGUE, name: p.teamTriCode, abbrev: p.teamTriCode, logoUrl: p.teamLogo },
    sweaterNumber: p.sweaterNumber,
  }));
}

// ---------- Play-by-play ----------

/** Shot types as the play-by-play words them; others have their hyphens turned into spaces. */
const SHOT_TYPES: Record<string, string> = {
  wrist: "wrist shot",
  snap: "snap shot",
  slap: "slapshot",
  backhand: "backhand",
  "tip-in": "tip-in",
  deflected: "deflection",
  "wrap-around": "wraparound",
  poke: "poke",
  bat: "batted puck",
  "between-legs": "between-the-legs shot",
  cradle: "lacrosse-style shot",
};

/** Why a shot missed or play stopped, where the words need more than the hyphens turned into spaces. */
const REASONS: Record<string, string> = {
  "hit-crossbar": "hit the crossbar",
  "hit-left-post": "hit the left post",
  "hit-right-post": "hit the right post",
  "above-crossbar": "over the crossbar",
  "goalie-stopped-after-sog": "goalie froze the puck",
  "puck-in-netting": "puck in the netting",
  "puck-in-crowd": "puck in the crowd",
  "puck-in-benches": "puck in the bench",
  "puck-frozen": "puck frozen",
  "tv-timeout": "TV timeout",
  "home-timeout": "home team timeout",
  "visitor-timeout": "away team timeout",
  "net-dislodged-defensive-skater": "net dislodged",
  "net-dislodged-offensive-skater": "net dislodged",
};

const words = (key: string) => key.replace(/-/g, " ").trim();
const shotLabel = (key: string | undefined) => (key ? (SHOT_TYPES[key] ?? words(key)) : "shot");
const reasonLabel = (key: string) => REASONS[key] ?? words(key);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * How a goal was scored, when not at even strength, from the play's situation code (away goalie, away skaters,
 * home skaters, home goalie; "1451" is the home team on a 5 on 4 power play).
 */
export function goalTag(situation: string | undefined, scoredByHome: boolean): string | undefined {
  const m = /^(\d)(\d)(\d)(\d)$/.exec(situation ?? "");
  if (!m) return undefined;
  const [awayGoalie, awaySkaters, homeSkaters, homeGoalie] = m.slice(1).map(Number);
  const [own, other, otherGoalie] = scoredByHome
    ? [homeSkaters, awaySkaters, awayGoalie]
    : [awaySkaters, homeSkaters, homeGoalie];
  if (otherGoalie === 0) return "Empty net";
  if (own > other) return "Power play";
  if (own < other) return "Short-handed";
  return undefined;
}

/**
 * A game's plays in the order they happened, worded for the play-by-play screen. Period markers are left out (the
 * screen groups plays by period); an unknown kind of play is kept, named after its type.
 */
export function mapPlayByPlay(raw: RawPlayByPlay): GamePlays {
  const game = mapGame(raw);
  const names = new Map<number, string>();
  for (const r of raw.rosterSpots ?? []) names.set(r.playerId, shortName(r) ?? r.lastName.default);
  const name = (id: number | undefined) => (id === undefined ? undefined : names.get(id));
  const teams = new Map<number, string>();
  if (raw.homeTeam.id !== undefined) teams.set(raw.homeTeam.id, raw.homeTeam.abbrev);
  if (raw.awayTeam.id !== undefined) teams.set(raw.awayTeam.id, raw.awayTeam.abbrev);

  const plays: Play[] = [];
  for (const p of [...(raw.plays ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const worded = playText(p, name, teams);
    if (!worded) continue;
    const d = p.details;
    const teamId = d?.eventOwnerTeamId === undefined ? undefined : teams.get(d.eventOwnerTeamId);
    const play: Play = {
      id: String(p.eventId),
      period: p.periodDescriptor.number,
      periodLabel: periodLabel(p.periodDescriptor.number, p.periodDescriptor),
      time: p.timeInPeriod,
      kind: worded.kind,
      text: worded.text,
    };
    // Optional fields only when known, so the plays survive the cache's JSON round trip unchanged.
    if (teamId !== undefined) play.teamId = teamId;
    if (worded.kind === "score") {
      if (d?.homeScore !== undefined) play.homeScore = d.homeScore;
      if (d?.awayScore !== undefined) play.awayScore = d.awayScore;
      const tag =
        p.periodDescriptor.periodType === "SO" ? undefined : goalTag(p.situationCode, teamId === raw.homeTeam.abbrev);
      if (tag) play.tag = tag;
    }
    plays.push(play);
  }
  return { game, plays };
}

const MARKERS = new Set(["period-start", "period-end", "game-end", "shootout-complete"]);

function playText(
  p: RawPlay,
  name: (id: number | undefined) => string | undefined,
  teams: Map<number, string>,
): { kind: PlayKind; text: string } | undefined {
  if (MARKERS.has(p.typeDescKey)) return undefined;
  const d = p.details ?? {};
  const team = d.eventOwnerTeamId === undefined ? undefined : teams.get(d.eventOwnerTeamId);
  const who = (id: number | undefined) => name(id) ?? "Unknown player";
  const total = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);
  switch (p.typeDescKey) {
    case "goal": {
      const assists = [
        d.assist1PlayerId === undefined ? undefined : `${who(d.assist1PlayerId)}${total(d.assist1PlayerTotal)}`,
        d.assist2PlayerId === undefined ? undefined : `${who(d.assist2PlayerId)}${total(d.assist2PlayerTotal)}`,
      ].filter((a): a is string => a !== undefined);
      const how = d.shotType ? `, ${shotLabel(d.shotType)}` : "";
      const help =
        p.periodDescriptor.periodType === "SO"
          ? ""
          : assists.length
            ? `. Assists: ${assists.join(", ")}`
            : ". Unassisted";
      return { kind: "score", text: `Goal: ${who(d.scoringPlayerId)}${total(d.scoringPlayerTotal)}${how}${help}` };
    }
    case "shot-on-goal": {
      const saved = name(d.goalieInNetId);
      return {
        kind: "shot",
        text: `${capital(shotLabel(d.shotType))} by ${who(d.shootingPlayerId)}${saved ? `, saved by ${saved}` : ""}`,
      };
    }
    case "missed-shot":
      return {
        kind: "shot",
        text: `Missed shot by ${who(d.shootingPlayerId)}${d.reason ? ` (${reasonLabel(d.reason)})` : ""}`,
      };
    case "blocked-shot": {
      // The play is the shooting team's; "teammate-blocked" means the shot hit one of their own.
      const teammate = d.reason === "teammate-blocked" ? "teammate " : "";
      return {
        kind: "shot",
        text: `Shot by ${who(d.shootingPlayerId)} blocked by ${teammate}${who(d.blockingPlayerId)}`,
      };
    }
    case "failed-shot-attempt":
      return { kind: "shot", text: `Shootout attempt by ${who(d.shootingPlayerId)}, no goal` };
    case "penalty": {
      const infraction = d.descKey ? infractionLabel(d.descKey) : "Penalty";
      const minutes = d.duration ? `, ${d.duration} min` : "";
      const by = name(d.committedByPlayerId) ?? team ?? "Unknown player";
      const drawn = name(d.drawnByPlayerId);
      return { kind: "penalty", text: `${by}: ${infraction}${minutes}${drawn ? `, drawn by ${drawn}` : ""}` };
    }
    case "delayed-penalty":
      return { kind: "other", text: team ? `Delayed penalty on ${team}` : "Delayed penalty" };
    case "hit":
      return { kind: "other", text: `${who(d.hittingPlayerId)} hit ${who(d.hitteePlayerId)}` };
    case "faceoff":
      return { kind: "other", text: `${who(d.winningPlayerId)} won the faceoff against ${who(d.losingPlayerId)}` };
    case "giveaway":
      return { kind: "other", text: `Giveaway by ${who(d.playerId)}` };
    case "takeaway":
      return { kind: "other", text: `Takeaway by ${who(d.playerId)}` };
    case "stoppage":
      return { kind: "other", text: d.reason ? `Stoppage: ${reasonLabel(d.reason)}` : "Stoppage" };
    default:
      return { kind: "other", text: capital(words(p.typeDescKey)) };
  }
}
