import type {
  Broadcast,
  BroadcastMarket,
  Game,
  GameClock,
  GameEnding,
  GameSide,
  GameStatus,
  Goal,
  GoalStrength,
  LeaderBoard,
  Player,
  RecordSplit,
  StatColumn,
  StatTable,
  Standings,
  StandingsGroup,
  Team,
  TeamDetail,
  Venue,
} from "../../domain";
import {
  GOALIE_COLUMNS,
  LEADER_LABELS,
  LEAGUE,
  SEASON_GOALIE_COLUMNS,
  SEASON_SKATER_COLUMNS,
  SKATER_COLUMNS,
  TEAM_GAMES_SHOWN,
} from "./constants";
import type {
  RawBroadcast,
  RawClubGoalie,
  RawClubSchedule,
  RawClubSkater,
  RawClubStats,
  RawGame,
  RawGoal,
  RawGoalie,
  RawLeadersResponse,
  RawSideStats,
  RawSkater,
  RawStandingsResponse,
  RawTeam,
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
  };
}

const STRENGTHS: Record<string, GoalStrength> = { pp: "powerPlay", sh: "shortHanded" };

function goalPeriodLabel(raw: RawGoal): string {
  const pd = raw.periodDescriptor;
  if (pd?.periodType === "SO") return "SO";
  if (pd?.periodType === "OT") {
    // Playoff overtimes carry on from the regulation count: period 4 is OT, 5 is 2OT.
    const n = raw.period - (pd.maxRegulationPeriods ?? 3);
    return n > 1 ? `${n}OT` : "OT";
  }
  return ordinal(raw.period);
}

/** Goals in the order the API lists them (the order scored). */
export function mapGoals(raw: RawGoal[] | undefined): Goal[] | undefined {
  if (!raw) return undefined;
  return raw.map((g) => ({
    teamId: g.teamAbbrev,
    period: g.period,
    periodLabel: goalPeriodLabel(g),
    time: g.timeInPeriod,
    scorer: { id: String(g.playerId), league: LEAGUE, name: g.name.default, teamId: g.teamAbbrev },
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
  }));
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
    statTable("Defense", SKATER_COLUMNS, stats?.defense),
    statTable("Goalies", GOALIE_COLUMNS, stats?.goalies),
  ];
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
    });
  }

  return {
    league: LEAGUE,
    groups: [...groups.values()],
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
      "Defense",
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
export function mapTeamSchedule(raw: RawClubSchedule): Pick<TeamDetail, "recent" | "upcoming"> {
  const games = (raw.games ?? [])
    .filter((g) => g.gameType !== 1) // 1 is preseason
    .map(mapGame)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return {
    recent: games
      .filter((g) => g.status === "final" || g.status === "live")
      .slice(-TEAM_GAMES_SHOWN)
      .reverse(),
    upcoming: games.filter((g) => g.status === "scheduled").slice(0, TEAM_GAMES_SHOWN),
  };
}
