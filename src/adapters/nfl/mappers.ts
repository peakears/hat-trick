// ESPN NFL responses (raw-types.ts) to domain types. Team ids are ESPN's abbreviations ("BUF", "LAR", "WSH"), the
// same in the scoreboard, standings and leaders.
import type {
  Game,
  GameClock,
  GameDetail,
  GamePerformer,
  GameSide,
  GameStatus,
  LeaderBoard,
  LeaderEntry,
  PeriodScore,
  Play,
  Player,
  RecordSplit,
  StandingRow,
  Standings,
  StandingsGroup,
  StatColumn,
  StatRow,
  StatTable,
  Team,
  TeamStatLine,
} from "../../domain";
import { periodsMatchingScore, withUpcomingPeriods } from "../periods";
import {
  BOX_SCORE_TABLES,
  CONFERENCE_BANDS,
  LEAGUE,
  PERFORMER_CATEGORIES,
  QUARTERS,
  TEAM_GAME_STATS,
} from "./constants";
import type {
  RawBoxscoreTeam,
  RawEvent,
  RawLeaders,
  RawScoreboard,
  RawStandings,
  RawStandingsEntry,
  RawSummary,
  RawTeamLeaders,
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

/** "Q1".."Q4", then "OT", "2OT", ... (period 5 is the first overtime; the playoffs can have more). */
export function periodLabel(period: number): string {
  if (period <= QUARTERS) return `Q${period}`;
  return period === QUARTERS + 1 ? "OT" : `${period - QUARTERS}OT`;
}

/** ESPN's status names that mean the game will not be played as scheduled. */
const NOT_PLAYED = new Set(["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_SUSPENDED"]);

/** A status as the scoreboard sends it; the summary's header has the same, with period and clock only while live. */
type RawStatus = Pick<RawEvent["status"], "type"> & { period?: number; displayClock?: string };
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
function gameClock({ period = 0, displayClock, type }: RawStatus): GameClock {
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

// ---------- Game page ----------

type RawSummaryCompetitor = RawSummary["header"]["competitions"][number]["competitors"][number];

function player(
  a: { id: string; displayName: string; headshot?: { href: string }; position?: { abbreviation: string } },
  teamId: string,
): Player {
  return {
    id: a.id,
    league: LEAGUE,
    name: a.displayName,
    teamId,
    position: a.position?.abbreviation,
    headshotUrl: a.headshot?.href,
  };
}

/**
 * One team's box score: a table per stat group (BOX_SCORE_TABLES), ESPN's columns in its order. "--" is ESPN's
 * blank and is left out (shown as "-"); a table with nobody in it is left out.
 */
export function mapBoxscoreTeam(raw: RawBoxscoreTeam | undefined): StatTable[] {
  if (!raw) return [];
  const tables: StatTable[] = [];
  for (const [group, title] of BOX_SCORE_TABLES) {
    const stats = raw.statistics?.find((g) => g.name === group);
    if (!stats) continue;
    const columns: StatColumn[] = stats.keys.map((key, i) => ({ key, label: stats.labels[i] ?? key }));
    const rows: StatRow[] = (stats.athletes ?? []).map((a) => {
      const values: Record<string, string> = {};
      stats.keys.forEach((key, i) => {
        const v = a.stats[i];
        if (v !== undefined && v !== "" && v !== "--") values[key] = v;
      });
      return { player: player(a.athlete, raw.team.abbreviation), values };
    });
    if (rows.length > 0) tables.push({ title, columns, rows });
  }
  return tables;
}

type RawSummaryTeamStats = NonNullable<NonNullable<RawSummary["boxscore"]>["teams"]>[number];

/** The teams side by side, live or final (before kickoff the summary has season averages there instead). */
function teamGameStats(away: RawSummaryTeamStats | undefined, home: RawSummaryTeamStats | undefined): TeamStatLine[] {
  if (!away || !home) return [];
  const value = (t: RawSummaryTeamStats, name: string) => t.statistics?.find((s) => s.name === name)?.displayValue;
  const lines: TeamStatLine[] = [];
  for (const [name, label] of TEAM_GAME_STATS) {
    const [a, h] = [value(away, name), value(home, name)];
    if (a === undefined || h === undefined) continue;
    // Only plain numbers compare with a bar: "2-8" and "19:20" are shown as they are.
    const numeric = /^\d+$/.test(a) && /^\d+$/.test(h);
    lines.push({ label, away: a, home: h, ...(numeric ? { awayValue: Number(a), homeValue: Number(h) } : {}) });
  }
  return lines;
}

/** A team's top performer: of its passing, rushing and receiving leaders, whoever gained the most yards. */
function topPerformer(raw: RawTeamLeaders | undefined): GamePerformer | undefined {
  if (!raw) return undefined;
  let best: { line: string; value: number; athlete: Parameters<typeof player>[0] } | undefined;
  for (const name of PERFORMER_CATEGORIES) {
    const leader = raw.leaders?.find((c) => c.name === name)?.leaders?.[0];
    if (leader && (!best || leader.value > best.value)) {
      best = { line: leader.displayValue, value: leader.value, athlete: leader.athlete };
    }
  }
  if (!best) return undefined;
  const teamId = raw.team.abbreviation;
  return { teamId, player: player(best.athlete, teamId), line: best.line };
}

/** "Field Goal" to "Field goal": the scoring type as a tag. */
function scoringTag(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function scoringPlays(raw: RawSummary): Play[] {
  return (raw.scoringPlays ?? []).map((p) => ({
    id: p.id,
    period: p.period.number,
    periodLabel: periodLabel(p.period.number),
    time: p.clock.displayValue,
    kind: "score",
    teamId: p.team.abbreviation,
    text: p.text.trim(),
    tag: scoringTag(p.scoringType?.displayName),
    awayScore: p.awayScore,
    homeScore: p.homeScore,
  }));
}

/** Each quarter's points, from the header's linescores (one per quarter started), while live or final. */
function summaryPeriods(game: Game, competitors: RawSummaryCompetitor[]): PeriodScore[] | undefined {
  if (game.status !== "live" && game.status !== "final") return undefined;
  const lines = (homeAway: "home" | "away") => competitors.find((c) => c.homeAway === homeAway)?.linescores ?? [];
  const [away, home] = [lines("away"), lines("home")];
  if (away.length !== home.length) return undefined;
  const list = away.map((a, i) => ({
    label: periodLabel(i + 1),
    away: Number(a.displayValue),
    home: Number(home[i].displayValue),
  }));
  if (list.some((p) => !Number.isFinite(p.away) || !Number.isFinite(p.home))) return undefined;
  const checked = periodsMatchingScore(list, game.away, game.home);
  return checked && game.status === "live" ? withUpcomingPeriods(checked, QUARTERS, periodLabel) : checked;
}

/** The game page from one summary: score card, box score, team stats, top performers and scoring plays. */
export function mapSummary(raw: RawSummary): GameDetail {
  const competition = raw.header.competitions[0];
  const status: RawStatus = {
    ...competition.status,
    // A final game's header has no period: count the quarters played (5 is overtime).
    period: competition.status.period ?? Math.max(0, ...competition.competitors.map((c) => c.linescores?.length ?? 0)),
  };
  const state = gameStatus(status);
  const side = (homeAway: "home" | "away"): GameSide => {
    const c = competition.competitors.find((x) => x.homeAway === homeAway);
    if (!c) throw new Error(`game ${raw.header.id} has no ${homeAway} team`);
    const score = c.score === undefined ? NaN : Number(c.score);
    return {
      team: {
        id: c.team.abbreviation,
        league: LEAGUE,
        name: c.team.displayName,
        abbrev: c.team.abbreviation,
        logoUrl: c.team.logos?.[0]?.href,
      },
      score: state === "scheduled" || state === "postponed" || !Number.isFinite(score) ? null : score,
      // As in the domain: the record before the game, so only while it has not started.
      record: state === "scheduled" ? c.record?.find((r) => r.type === "total")?.summary : undefined,
    };
  };
  const game: Game = {
    id: raw.header.id,
    league: LEAGUE,
    startTime: new Date(competition.date).toISOString(),
    status: state,
    home: side("home"),
    away: side("away"),
  };
  if (state === "live") game.clock = gameClock(status);
  if (state === "final") game.endedIn = (status.period ?? 0) > QUARTERS ? "overtime" : "regulation";
  const venue = raw.gameInfo?.venue;
  if (venue) game.venue = { name: venue.fullName, city: venue.address?.city };
  const periods = summaryPeriods(game, competition.competitors);
  if (periods) game.periods = periods;

  const started = state === "live" || state === "final";
  const players = (id: string) => raw.boxscore?.players?.find((p) => p.team.abbreviation === id);
  const totals = (id: string) => raw.boxscore?.teams?.find((t) => t.team.abbreviation === id);
  const leaders = (id: string) => raw.leaders?.find((l) => l.team.abbreviation === id);
  const [awayId, homeId] = [game.away.team.id, game.home.team.id];
  // Before kickoff the totals and leaders are the season's, not this game's: left out.
  const teamStats = started ? teamGameStats(totals(awayId), totals(homeId)) : [];
  const performers = started
    ? [topPerformer(leaders(awayId)), topPerformer(leaders(homeId))].filter((p): p is GamePerformer => !!p)
    : [];
  const scores = started ? scoringPlays(raw) : [];
  const attendance = raw.gameInfo?.attendance;
  return compact({
    game,
    boxscore: { away: mapBoxscoreTeam(players(awayId)), home: mapBoxscoreTeam(players(homeId)) },
    scoringPlays: scores.length > 0 ? scores : undefined,
    teamStats: teamStats.length > 0 ? teamStats : undefined,
    performers: performers.length > 0 ? performers : undefined,
    attendance: attendance && attendance > 0 ? attendance : undefined,
  });
}
