// ESPN NBA responses (raw-types.ts) to domain types. Team ids are ESPN's abbreviations ("BOS", "GS", "UTAH"), the
// same in the scoreboard, standings and leaders.
import type {
  Game,
  GameClock,
  GameDetail,
  GameSide,
  GameStatus,
  LeaderBoard,
  LeaderEntry,
  RecordSplit,
  StandingRow,
  Standings,
  StandingsGroup,
  StatColumn,
  StatRow,
  StatTable,
  Team,
  TeamDetail,
} from "../../domain";
import { LEAGUE, TEAM_GAMES_SHOWN, TEAM_STAT_COLUMNS } from "./constants";
import type {
  RawBoxscoreTeam,
  RawEvent,
  RawLeaders,
  RawScoreboard,
  RawStandings,
  RawStandingsEntry,
  RawSummary,
  RawTeamAthlete,
  RawTeamSchedule,
  RawTeamStats,
} from "./raw-types";

/** Drops undefined fields (minor data that was missing), so results survive the cache's JSON round trip. */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = compact(v);
    return out as T;
  }
  return value;
}

// ---------- Scores ----------

/** "Q1".."Q4", then "OT", "2OT", ... (period 5 is the first overtime). */
export function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `${period - 4}OT`;
}

/** ESPN's status names that mean the game will not be played as scheduled. */
const NOT_PLAYED = new Set(["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_SUSPENDED"]);

/** A game's status as every endpoint sends it (the scoreboard, the summary's header, a team's schedule). */
interface StatusParts {
  name: string;
  state: "pre" | "in" | "post";
  /** 1-4 quarters, 5+ overtimes. */
  period: number;
  displayClock?: string;
}

/** One side of a game, already turned into domain values. */
interface SideParts {
  homeAway: "home" | "away";
  team: Team;
  /** NaN or undefined when there is no score yet. */
  score?: number;
  record?: string;
}

function gameStatus(status: StatusParts): GameStatus {
  if (NOT_PLAYED.has(status.name)) return "postponed";
  switch (status.state) {
    case "pre":
      return "scheduled";
    case "in":
      return "live";
    case "post":
      return "final";
  }
}

/** While live: the quarter and its clock; halftime and the end of a quarter have no running clock. */
function gameClock({ period, displayClock, name }: StatusParts): GameClock {
  const label = periodLabel(period);
  if (name === "STATUS_HALFTIME") return { period, label: "Halftime" };
  if (name === "STATUS_END_PERIOD") return { period, label: `End ${label}` };
  return { period, label, timeRemaining: displayClock };
}

/** The domain game from parts every endpoint has, in its own shape. */
function buildGame(
  id: string,
  date: string,
  status: StatusParts,
  sides: SideParts[],
  venue?: { fullName: string; address?: { city?: string } },
): Game {
  const state = gameStatus(status);
  const side = (homeAway: "home" | "away"): GameSide => {
    const c = sides.find((x) => x.homeAway === homeAway);
    if (!c) throw new Error(`game ${id} has no ${homeAway} team`);
    const score = c.score;
    return {
      team: c.team,
      score:
        state === "scheduled" || state === "postponed" || score === undefined || !Number.isFinite(score) ? null : score,
      record: c.record,
    };
  };
  const game: Game = {
    id,
    league: LEAGUE,
    // "2026-11-22T20:30Z" has no seconds; normalize to the full form the rest of the app expects.
    startTime: new Date(date).toISOString(),
    status: state,
    home: side("home"),
    away: side("away"),
  };
  if (state === "live") game.clock = gameClock(status);
  if (state === "final") game.endedIn = status.period > 4 ? "overtime" : "regulation";
  if (venue) game.venue = { name: venue.fullName, city: venue.address?.city };
  return game;
}

function scoreboardTeam(team: RawEvent["competitions"][number]["competitors"][number]["team"]): Team {
  return {
    id: team.abbreviation,
    league: LEAGUE,
    name: team.displayName,
    abbrev: team.abbreviation,
    logoUrl: team.logo,
  };
}

/** A team from the summary or a schedule, which send a list of logos (the first is the default). */
function logoTeam(team: { abbreviation: string; displayName: string; logos?: { href: string }[] }): Team {
  return {
    id: team.abbreviation,
    league: LEAGUE,
    name: team.displayName,
    abbrev: team.abbreviation,
    logoUrl: team.logos?.[0]?.href,
  };
}

const seasonRecord = (records: { type: string; summary: string }[] | undefined) =>
  records?.find((r) => r.type === "total")?.summary;

export function mapGame(event: RawEvent): Game {
  const competition = event.competitions[0];
  const { type, period, displayClock } = event.status;
  return buildGame(
    event.id,
    event.date,
    { name: type.name, state: type.state, period, displayClock },
    competition.competitors.map((c) => ({
      homeAway: c.homeAway,
      team: scoreboardTeam(c.team),
      score: Number(c.score),
      record: seasonRecord(c.records),
    })),
    competition.venue,
  );
}

export function mapScoreboard(raw: RawScoreboard): Game[] {
  return compact(raw.events.map(mapGame));
}

// ---------- Standings ----------

function stat(entry: RawStandingsEntry, name: string): RawStandingsEntry["stats"][number] | undefined {
  return entry.stats.find((s) => s.name === name);
}

/** "12-4" to a record; undefined for anything else. */
function split(text: string | undefined): RecordSplit | undefined {
  const m = /^(\d+)-(\d+)$/.exec(text ?? "");
  return m ? { wins: Number(m[1]), losses: Number(m[2]) } : undefined;
}

function standingRow(
  entry: RawStandingsEntry,
  rank: number,
  divisionName: string,
  conferenceName: string,
): StandingRow {
  // raw-types.ts makes wins and losses core: a response without them fails validation.
  const wins = stat(entry, "wins")!.value!;
  const losses = stat(entry, "losses")!.value!;
  const row: StandingRow = {
    team: {
      id: entry.team.abbreviation,
      league: LEAGUE,
      name: entry.team.displayName,
      abbrev: entry.team.abbreviation,
      logoUrl: entry.team.logos?.[0]?.href,
    },
    rank,
    gamesPlayed: wins + losses,
    wins,
    losses,
    winPercent: stat(entry, "winPercent")?.value,
    gamesBehind: stat(entry, "gamesBehind")?.value,
    streak: stat(entry, "streak")?.displayValue,
    home: split(stat(entry, "Home")?.displayValue),
    road: split(stat(entry, "Road")?.displayValue),
    last10: split(stat(entry, "Last Ten Games")?.displayValue),
    divisionName,
    conferenceName,
  };
  return row;
}

/**
 * Divisions as groups, each in the league's own order: ESPN lists entries unsorted, so they are put in order of
 * `playoffSeed` (the conference seed, with the league's tiebreakers applied). League rank: by win percentage, then
 * conference seed.
 */
export function mapStandings(raw: RawStandings, now: Date): Standings {
  const seed = (e: RawStandingsEntry) => stat(e, "playoffSeed")?.value ?? Number.MAX_SAFE_INTEGER;
  const groups: StandingsGroup[] = [];
  for (const conference of raw.children) {
    for (const division of conference.children) {
      const entries = [...division.standings.entries].sort((a, b) => seed(a) - seed(b));
      groups.push({
        name: division.name,
        rows: entries.map((e, i) => standingRow(e, i + 1, division.name, conference.name)),
      });
    }
  }
  const all = groups.flatMap((g) => g.rows);
  const seedOf = new Map(
    raw.children.flatMap((c) =>
      c.children.flatMap((d) => d.standings.entries.map((e) => [e.team.abbreviation, seed(e)] as const)),
    ),
  );
  [...all]
    .sort(
      (a, b) =>
        (b.winPercent ?? 0) - (a.winPercent ?? 0) || (seedOf.get(a.team.id) ?? 0) - (seedOf.get(b.team.id) ?? 0),
    )
    .forEach((row, i) => (row.leagueRank = i + 1));
  return compact({ league: LEAGUE, groups, updatedAt: now.toISOString() });
}

// ---------- Leaders ----------

/**
 * One board from a leaders response sorted by `category` ("offensive.avgPoints"): the stat is found by name in
 * the response's category list, and each athlete's value at that position. Values are rounded to one decimal, as
 * ESPN shows them, so ties match what is on screen.
 */
export function mapLeaderBoard(raw: RawLeaders, category: string, label: string, limit: number): LeaderBoard {
  const [group, name] = category.split(".");
  const index = raw.categories.find((c) => c.name === group)?.names.indexOf(name) ?? -1;
  const entries: LeaderEntry[] = [];
  for (const a of raw.athletes ?? []) {
    const value = a.categories.find((c) => c.name === group)?.values[index];
    if (index < 0 || value === undefined || !Number.isFinite(value)) continue;
    const teamId = a.athlete.teamShortName;
    entries.push({
      rank: 0,
      player: {
        id: a.athlete.id,
        league: LEAGUE,
        name: a.athlete.displayName,
        teamId,
        position: a.athlete.position?.abbreviation,
        headshotUrl: a.athlete.headshot?.href,
      },
      team: { id: teamId, league: LEAGUE, name: teamId, abbrev: teamId, logoUrl: a.athlete.teamLogos?.[0]?.href },
      value: Math.round(value * 10) / 10,
    });
  }
  entries.sort((x, y) => y.value - x.value);
  const shown = entries.slice(0, limit);
  // Competition ranking: ties share a rank, the next distinct value skips ahead (1, 2, 2, 4).
  shown.forEach((e, i) => (e.rank = i > 0 && e.value === shown[i - 1].value ? shown[i - 1].rank : i + 1));
  return compact({ category, label, decimals: 1, entries: shown });
}

// ---------- Game page ----------

/**
 * One team's box score as two tables, starters then bench, with ESPN's columns in its order. Players who did not
 * play are left out (their stats are empty), as is a table with nobody in it.
 */
export function mapBoxscoreTeam(raw: RawBoxscoreTeam | undefined): StatTable[] {
  const group = raw?.statistics[0];
  if (!raw || !group) return [];
  const columns: StatColumn[] = group.keys.map((key, i) => ({ key, label: group.labels[i] ?? key }));
  const starters: StatRow[] = [];
  const bench: StatRow[] = [];
  for (const a of group.athletes ?? []) {
    if (a.didNotPlay || a.stats.length === 0) continue;
    const values: Record<string, string> = {};
    // "--" is ESPN's blank (a starter's +/- before any minutes); leave the stat out, shown as "-".
    group.keys.forEach((key, i) => {
      const v = a.stats[i];
      if (v !== undefined && v !== "" && v !== "--") values[key] = v;
    });
    const row: StatRow = {
      player: {
        id: a.athlete.id,
        league: LEAGUE,
        name: a.athlete.displayName,
        teamId: raw.team.abbreviation,
        position: a.athlete.position?.abbreviation,
        headshotUrl: a.athlete.headshot?.href,
      },
      values,
    };
    (a.starter ? starters : bench).push(row);
  }
  return [
    { title: "Starters", columns, rows: starters },
    { title: "Bench", columns, rows: bench },
  ].filter((t) => t.rows.length > 0);
}

export function mapSummary(raw: RawSummary): GameDetail {
  const competition = raw.header.competitions[0];
  const { status } = competition;
  // A final game's header has no period: count the periods played instead.
  const periods = Math.max(0, ...competition.competitors.map((c) => c.linescores?.length ?? 0));
  const state = status.type.state;
  const game = buildGame(
    raw.header.id,
    competition.date,
    { name: status.type.name, state, period: status.period ?? periods, displayClock: status.displayClock },
    competition.competitors.map((c) => ({
      homeAway: c.homeAway,
      team: logoTeam(c.team),
      score: c.score === undefined ? undefined : Number(c.score),
      // As in the domain: the record before the game, so only while it has not started.
      record: state === "pre" ? seasonRecord(c.record) : undefined,
    })),
    raw.gameInfo?.venue,
  );
  const team = (id: string) => raw.boxscore?.players?.find((p) => p.team.abbreviation === id);
  return compact({
    game,
    boxscore: { home: mapBoxscoreTeam(team(game.home.team.id)), away: mapBoxscoreTeam(team(game.away.team.id)) },
  });
}

// ---------- Team page ----------

function athleteStat(a: RawTeamAthlete, group: string, name: string): string | undefined {
  return a.statistics.find((g) => g.name === group)?.stats?.find((s) => s.name === name)?.displayValue;
}

/** The roster's season stats as one table, in ESPN's order (by points per game). */
export function mapTeamStats(raw: RawTeamStats): StatTable[] {
  const rows: StatRow[] = (raw.results[0]?.leaders ?? []).map((a) => {
    const values: Record<string, string> = {};
    for (const c of TEAM_STAT_COLUMNS) {
      const v = athleteStat(a, c.group, c.name);
      if (v !== undefined) values[c.key] = v;
    }
    return {
      player: {
        id: a.athlete.id,
        league: LEAGUE,
        name: a.athlete.displayName,
        position: a.athlete.position?.abbreviation,
        headshotUrl: a.athlete.headshot?.href,
      },
      values,
    };
  });
  if (rows.length === 0) return [];
  const columns: StatColumn[] = TEAM_STAT_COLUMNS.map(({ key, label }) => ({ key, label }));
  return compact([{ title: "Players", columns, rows }]);
}

/** The venue most of the team's home games use. */
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
  raw: RawTeamSchedule,
  teamId: string,
): Pick<TeamDetail, "recent" | "upcoming" | "arena"> {
  const games = (raw.events ?? [])
    .map((e) => {
      const c = e.competitions[0];
      const { type, period, displayClock } = c.status;
      return buildGame(
        e.id,
        e.date,
        { name: type.name, state: type.state, period, displayClock },
        c.competitors.map((x) => ({ homeAway: x.homeAway, team: logoTeam(x.team), score: x.score?.value })),
        c.venue,
      );
    })
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return compact({
    arena: homeArena(games, teamId),
    recent: games
      .filter((g) => g.status === "final" || g.status === "live")
      .slice(-TEAM_GAMES_SHOWN)
      .reverse(),
    upcoming: games.filter((g) => g.status === "scheduled").slice(0, TEAM_GAMES_SHOWN),
  });
}
