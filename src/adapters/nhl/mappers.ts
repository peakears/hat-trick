import type {
  Game,
  GameClock,
  GameSide,
  GameStatus,
  LeaderBoard,
  Player,
  StatColumn,
  StatTable,
  Standings,
  StandingsGroup,
  Team,
} from "../../domain";
import { GOALIE_COLUMNS, LEADER_LABELS, LEAGUE, SKATER_COLUMNS } from "./constants";
import type {
  RawGame,
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
  const label =
    pd.periodType === "SO" ? "SO" : pd.periodType === "OT" ? "OT" : ordinal(pd.number);
  return {
    period: pd.number,
    label,
    timeRemaining: raw.clock?.timeRemaining,
    intermission: raw.clock?.inIntermission,
  };
}

function mapSide(raw: RawTeam, status: GameStatus): GameSide {
  return {
    team: mapTeam(raw),
    score: status === "scheduled" ? null : (raw.score ?? 0),
    shotsOnGoal: raw.sog,
  };
}

export function mapGame(raw: RawGame): Game {
  const status = mapStatus(raw.gameState);
  return {
    id: String(raw.id),
    league: LEAGUE,
    startTime: raw.startTimeUTC,
    status,
    clock: status === "live" ? mapClock(raw) : undefined,
    home: mapSide(raw.homeTeam, status),
    away: mapSide(raw.awayTeam, status),
  };
}

function mapPlayer(raw: { playerId: number; name: { default: string }; position?: string }): Player {
  return {
    id: String(raw.playerId),
    league: LEAGUE,
    name: raw.name.default,
    position: raw.position,
  };
}

function statTable<T extends RawSkater | RawGoalie>(
  title: string,
  columns: StatColumn[],
  rows: T[] = [],
): StatTable {
  return {
    title,
    columns,
    rows: rows.map((r) => {
      const record = r as unknown as Record<string, string | number | undefined>;
      return {
        player: mapPlayer(r),
        values: Object.fromEntries(columns.map((c) => [c.key, record[c.key] ?? 0])),
      };
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
        name: s.teamName.default,
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
    });
  }

  return {
    league: LEAGUE,
    groups: [...groups.values()],
    updatedAt: new Date().toISOString(),
  };
}

export function mapLeaders(raw: RawLeadersResponse, categories: string[]): LeaderBoard[] {
  return categories.map((key) => ({
    category: key,
    label: LEADER_LABELS[key] ?? key,
    entries: (raw[key] ?? []).map((l, i) => ({
      rank: i + 1,
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
  }));
}
