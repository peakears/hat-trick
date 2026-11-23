// ESPN NBA responses (raw-types.ts) to domain types. Team ids are ESPN's abbreviations ("BOS", "GS", "UTAH"), the
// same in the scoreboard, standings and leaders.
import type {
  Game,
  GameClock,
  GameSide,
  GameStatus,
  LeaderBoard,
  LeaderEntry,
  RecordSplit,
  StandingRow,
  Standings,
  StandingsGroup,
  Team,
} from "../../domain";
import { LEAGUE } from "./constants";
import type { RawEvent, RawLeaders, RawScoreboard, RawStandings, RawStandingsEntry } from "./raw-types";

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

function gameStatus(event: RawEvent): GameStatus {
  if (NOT_PLAYED.has(event.status.type.name)) return "postponed";
  switch (event.status.type.state) {
    case "pre":
      return "scheduled";
    case "in":
      return "live";
    case "post":
      return "final";
  }
}

/** While live: the quarter and its clock; halftime and the end of a quarter have no running clock. */
function gameClock(event: RawEvent): GameClock {
  const { period, displayClock, type } = event.status;
  const label = periodLabel(period);
  if (type.name === "STATUS_HALFTIME") return { period, label: "Halftime" };
  if (type.name === "STATUS_END_PERIOD") return { period, label: `End ${label}` };
  return { period, label, timeRemaining: displayClock };
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

export function mapGame(event: RawEvent): Game {
  const competition = event.competitions[0];
  const status = gameStatus(event);
  const side = (homeAway: "home" | "away"): GameSide => {
    const c = competition.competitors.find((x) => x.homeAway === homeAway);
    if (!c) throw new Error(`game ${event.id} has no ${homeAway} team`);
    const score = Number(c.score);
    return {
      team: scoreboardTeam(c.team),
      score: status === "scheduled" || status === "postponed" || !Number.isFinite(score) ? null : score,
      record: c.records?.find((r) => r.type === "total")?.summary,
    };
  };
  const game: Game = {
    id: event.id,
    league: LEAGUE,
    // "2026-11-22T20:30Z" has no seconds; normalize to the full form the rest of the app expects.
    startTime: new Date(event.date).toISOString(),
    status,
    home: side("home"),
    away: side("away"),
  };
  if (status === "live") game.clock = gameClock(event);
  if (status === "final") game.endedIn = event.status.period > 4 ? "overtime" : "regulation";
  const venue = competition.venue;
  if (venue) game.venue = { name: venue.fullName, city: venue.address?.city };
  return game;
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
