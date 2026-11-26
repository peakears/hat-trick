// ESPN NFL responses (raw-types.ts) to domain types. Team ids are ESPN's abbreviations ("BUF", "LAR", "WSH"), the
// same in the scoreboard, standings and leaders.
import type {
  Game,
  GameClock,
  GameSide,
  GameStatus,
  LeaderBoard,
  LeaderEntry,
  PeriodScore,
  RecordSplit,
  StandingRow,
  Standings,
  StandingsGroup,
  Team,
} from "../../domain";
import { periodsMatchingScore, withUpcomingPeriods } from "../periods";
import { CONFERENCE_BANDS, LEAGUE, QUARTERS } from "./constants";
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

/** "Q1".."Q4", then "OT", "2OT", ... (period 5 is the first overtime; the playoffs can have more). */
export function periodLabel(period: number): string {
  if (period <= QUARTERS) return `Q${period}`;
  return period === QUARTERS + 1 ? "OT" : `${period - QUARTERS}OT`;
}

/** ESPN's status names that mean the game will not be played as scheduled. */
const NOT_PLAYED = new Set(["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_SUSPENDED"]);

type RawStatus = RawEvent["status"];
type RawCompetitor = RawEvent["competitions"][number]["competitors"][number];

function gameStatus(status: RawStatus): GameStatus {
  if (NOT_PLAYED.has(status.type.name)) return "postponed";
  switch (status.type.state) {
    case "pre":
      return "scheduled";
    case "in":
      return "live";
    case "post":
      return "final";
  }
}

/** While live: the quarter and its clock; halftime and the end of a quarter have no running clock. */
function gameClock({ period, displayClock, type }: RawStatus): GameClock {
  const label = periodLabel(period);
  if (type.name === "STATUS_HALFTIME") return { period, label: "Halftime" };
  if (type.name === "STATUS_END_PERIOD") return { period, label: `End ${label}` };
  return { period, label, timeRemaining: displayClock };
}

function team(raw: RawCompetitor["team"]): Team {
  return { id: raw.abbreviation, league: LEAGUE, name: raw.displayName, abbrev: raw.abbreviation, logoUrl: raw.logo };
}

/** Each quarter's points, from both teams' linescores, while live or final. */
function periods(game: Game, competitors: RawCompetitor[]): PeriodScore[] | undefined {
  if (game.status !== "live" && game.status !== "final") return undefined;
  const lines = (homeAway: "home" | "away") => competitors.find((c) => c.homeAway === homeAway)?.linescores ?? [];
  const [away, home] = [lines("away"), lines("home")];
  if (away.length !== home.length) return undefined;
  const list = away.map((a, i) => ({ label: periodLabel(a.period), away: a.value, home: home[i].value }));
  const checked = periodsMatchingScore(list, game.away, game.home);
  return checked && game.status === "live" ? withUpcomingPeriods(checked, QUARTERS, periodLabel) : checked;
}

export function mapGame(event: RawEvent): Game {
  const competition = event.competitions[0];
  const status = gameStatus(event.status);
  const side = (homeAway: "home" | "away"): GameSide => {
    const c = competition.competitors.find((x) => x.homeAway === homeAway);
    if (!c) throw new Error(`game ${event.id} has no ${homeAway} team`);
    const score = Number(c.score);
    return {
      team: team(c.team),
      score: status === "scheduled" || status === "postponed" || !Number.isFinite(score) ? null : score,
      record: c.records?.find((r) => r.type === "total")?.summary,
    };
  };
  const game: Game = {
    id: event.id,
    league: LEAGUE,
    // "2026-11-26T01:00Z" has no seconds; normalize to the full form the rest of the app expects.
    startTime: new Date(event.date).toISOString(),
    status,
    home: side("home"),
    away: side("away"),
  };
  if (status === "live") game.clock = gameClock(event.status);
  if (status === "final") game.endedIn = event.status.period > QUARTERS ? "overtime" : "regulation";
  const venue = competition.venue;
  if (venue) game.venue = { name: venue.fullName, city: venue.address?.city };
  const list = periods(game, competition.competitors);
  if (list) game.periods = list;
  return game;
}

export function mapScoreboard(raw: RawScoreboard): Game[] {
  return compact(raw.events.map(mapGame));
}

// ---------- Standings ----------

function stat(entry: RawStandingsEntry, name: string): RawStandingsEntry["stats"][number] | undefined {
  return entry.stats.find((s) => s.name === name);
}

/** "4-1", or "4-1-1" with ties, to a record; undefined for anything else. */
export function split(text: string | undefined): RecordSplit | undefined {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(text ?? "");
  if (!m) return undefined;
  return { wins: Number(m[1]), losses: Number(m[2]), ties: Number(m[3] ?? 0) };
}

function standingRow(entry: RawStandingsEntry, rank: number, divisionName: string, conferenceName: string) {
  // raw-types.ts makes wins and losses core: a response without them fails validation.
  const wins = stat(entry, "wins")!.value!;
  const losses = stat(entry, "losses")!.value!;
  const ties = stat(entry, "ties")?.value ?? 0;
  const row: StandingRow = {
    team: {
      id: entry.team.abbreviation,
      league: LEAGUE,
      name: entry.team.displayName,
      abbrev: entry.team.abbreviation,
      logoUrl: entry.team.logos?.[0]?.href,
    },
    rank,
    gamesPlayed: wins + losses + ties,
    wins,
    losses,
    ties,
    winPercent: stat(entry, "winPercent")?.value,
    streak: stat(entry, "streak")?.displayValue,
    home: split(stat(entry, "Home")?.displayValue),
    road: split(stat(entry, "Road")?.displayValue),
    divisionName,
    conferenceName,
  };
  return row;
}

/**
 * Divisions as groups, each in order of `playoffSeed` (the conference seed, with the league's tiebreakers applied:
 * ESPN lists entries unsorted). League rank: by win percentage, then conference seed. Games behind is left out:
 * ESPN's is behind the division leader, not the conference's, as the domain means it.
 */
export function mapStandings(raw: RawStandings, now: Date): Standings {
  const seed = (e: RawStandingsEntry) => stat(e, "playoffSeed")?.value ?? Number.MAX_SAFE_INTEGER;
  const groups: StandingsGroup[] = [];
  const seeds = new Map<string, number>();
  for (const conference of raw.children) {
    for (const division of conference.children) {
      const entries = [...division.standings.entries].sort((a, b) => seed(a) - seed(b));
      groups.push({
        name: division.name,
        rows: entries.map((e, i) => {
          const row = standingRow(e, i + 1, division.name, conference.name);
          const s = seed(e);
          seeds.set(row.team.id, s);
          if (s !== Number.MAX_SAFE_INTEGER) row.conferenceRank = s;
          return row;
        }),
      });
    }
  }
  [...groups.flatMap((g) => g.rows)]
    .sort(
      (a, b) => (b.winPercent ?? 0) - (a.winPercent ?? 0) || (seeds.get(a.team.id) ?? 0) - (seeds.get(b.team.id) ?? 0),
    )
    .forEach((row, i) => (row.leagueRank = i + 1));
  return compact({ league: LEAGUE, groups, conferenceBands: CONFERENCE_BANDS, updatedAt: now.toISOString() });
}

// ---------- Leaders ----------

/**
 * One board from a leaders response sorted by `category` ("passing.passingYards"): the stat is found by name in the
 * response's category list, and each athlete's value at that position. Group names are matched ignoring case (the
 * sort key says "defensiveInterceptions", the response "defensiveinterceptions"). Values are rounded to `decimals`
 * (one when absent), so ties match what is on screen.
 */
export function mapLeaderBoard(
  raw: RawLeaders,
  category: string,
  label: string,
  limit: number,
  decimals?: number,
): LeaderBoard {
  const [group, name] = category.split(".");
  const sameGroup = (c: { name: string }) => c.name.toLowerCase() === group.toLowerCase();
  const index = raw.categories.find(sameGroup)?.names.indexOf(name) ?? -1;
  const scale = 10 ** (decimals ?? 1);
  const entries: LeaderEntry[] = [];
  for (const a of raw.athletes ?? []) {
    const value = a.categories.find(sameGroup)?.values[index];
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
      value: Math.round(value * scale) / scale,
    });
  }
  entries.sort((x, y) => y.value - x.value);
  const shown = entries.slice(0, limit);
  // Competition ranking: ties share a rank, the next distinct value skips ahead (1, 2, 2, 4).
  shown.forEach((e, i) => (e.rank = i > 0 && e.value === shown[i - 1].value ? shown[i - 1].rank : i + 1));
  return compact({ category, label, decimals, entries: shown });
}
