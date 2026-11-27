// ESPN NFL responses (raw-types.ts) to domain types. Team ids are ESPN's abbreviations ("BUF", "LAR", "WSH"), the
// same in the scoreboard, standings and leaders.
import type {
  Game,
  GameClock,
  GameDetail,
  GamePerformer,
  GameSide,
  GameSituation,
  GameStatus,
  LeaderBoard,
  LeaderEntry,
  PeriodScore,
  Play,
  Player,
  PlayerBio,
  PlayerDetail,
  PlayerGameLine,
  PlayerSeasonLine,
  RecordSplit,
  StandingRow,
  Standings,
  StandingsGroup,
  StatColumn,
  StatRow,
  StatItem,
  StatTable,
  Team,
  TeamDetail,
  TeamStatLine,
} from "../../domain";
import { periodsMatchingScore, withUpcomingPeriods } from "../periods";
import {
  BOX_SCORE_TABLES,
  CONFERENCE_BANDS,
  LEAGUE,
  PERFORMER_CATEGORIES,
  PLAYER_COLUMNS,
  PLAYER_LAST_GAMES,
  QUARTERS,
  TEAM_GAME_STATS,
  TEAM_GAMES_SHOWN,
  TEAM_STAT_TABLES,
} from "./constants";
import type {
  RawAthlete,
  RawAthleteStats,
  RawBoxscoreTeam,
  RawGamelog,
  RawEvent,
  RawLeaders,
  RawScoreboard,
  RawStandings,
  RawStandingsEntry,
  RawSummary,
  RawTeamLeaders,
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

/**
 * Where play stands, while the clock is running in a live game (not at halftime or between quarters) and only with a
 * real down (1-4): around a kickoff or a timeout ESPN sends down -1 and text like " & Goal at CHI 35".
 */
function situation(event: RawEvent): GameSituation | undefined {
  const competition = event.competitions[0];
  const raw = competition.situation;
  if (event.status.type.name !== "STATUS_IN_PROGRESS" || !raw) return undefined;
  const text = raw.downDistanceText?.trim();
  if (!text || raw.down === undefined || raw.down < 1 || raw.down > 4) return undefined;
  const possession = competition.competitors.find((c) => c.team.id !== undefined && c.team.id === raw.possession);
  return { text, possessionTeamId: possession?.team.abbreviation, redZone: raw.isRedZone };
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
  const now = situation(event);
  if (now) game.situation = now;
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

// ---------- Team page ----------

type RawTeamStatsPlayer = NonNullable<NonNullable<RawTeamStats["results"]>[number]["leaders"]>[number];

function athleteStat(a: RawTeamStatsPlayer, group: string, name: string): string | undefined {
  return a.statistics?.find((g) => g.name === group)?.stats?.find((s) => s.name === name)?.displayValue;
}

/** The roster's season stats: a table per category (TEAM_STAT_TABLES), its players in ESPN's order. */
export function mapTeamStats(raw: RawTeamStats, teamId: string): StatTable[] {
  const tables: StatTable[] = [];
  for (const { category, title, columns } of TEAM_STAT_TABLES) {
    const players = raw.results?.find((r) => r.name === category)?.leaders ?? [];
    const rows: StatRow[] = players.map((a) => {
      const values: Record<string, string> = {};
      for (const c of columns) {
        const v = athleteStat(a, c.group, c.name);
        if (v !== undefined) values[c.key] = v;
      }
      return { player: player(a.athlete, teamId), values };
    });
    if (rows.length > 0) tables.push({ title, columns: columns.map(({ key, label }) => ({ key, label })), rows });
  }
  return compact(tables);
}

/** The venue most of the team's home games in the schedule use. */
function homeStadium(games: Game[], teamId: string): string | undefined {
  const counts = new Map<string, number>();
  for (const g of games) {
    if (g.home.team.id === teamId && g.venue) counts.set(g.venue.name, (counts.get(g.venue.name) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [name, n] of counts) if (best === undefined || n > (counts.get(best) ?? 0)) best = name;
  return best;
}

type RawScheduleEvent = NonNullable<RawTeamSchedule["events"]>[number];

function scheduleGame(e: RawScheduleEvent): Game {
  const c = e.competitions[0];
  const status = gameStatus(c.status);
  const side = (homeAway: "home" | "away"): GameSide => {
    const x = c.competitors.find((y) => y.homeAway === homeAway);
    if (!x) throw new Error(`game ${e.id} has no ${homeAway} team`);
    const score = x.score?.value;
    return {
      team: {
        id: x.team.abbreviation,
        league: LEAGUE,
        name: x.team.displayName,
        abbrev: x.team.abbreviation,
        logoUrl: x.team.logos?.[0]?.href,
      },
      score: status === "scheduled" || status === "postponed" || score === undefined ? null : score,
    };
  };
  const game: Game = {
    id: e.id,
    league: LEAGUE,
    startTime: new Date(e.date).toISOString(),
    status,
    home: side("home"),
    away: side("away"),
  };
  if (status === "live") game.clock = gameClock(c.status);
  if (status === "final") game.endedIn = c.status.period > QUARTERS ? "overtime" : "regulation";
  if (c.venue) game.venue = { name: c.venue.fullName, city: c.venue.address?.city };
  return game;
}

/** The team page's games: the last few played (newest first) and the next few (soonest first), and its stadium. */
export function mapTeamSchedule(
  raw: RawTeamSchedule,
  teamId: string,
): Pick<TeamDetail, "recent" | "upcoming" | "arena"> {
  const games = (raw.events ?? []).map(scheduleGame).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return compact({
    arena: homeStadium(games, teamId),
    recent: games
      .filter((g) => g.status === "final" || g.status === "live")
      .slice(-TEAM_GAMES_SHOWN)
      .reverse(),
    upcoming: games.filter((g) => g.status === "scheduled").slice(0, TEAM_GAMES_SHOWN),
  });
}

// ---------- Player page ----------

/** ESPN's position name in Canadian spelling and sentence case: "Center" as "Centre", "Running Back" as "Running back". */
export function positionName(name: string): string {
  const text = name.replace(/Center/g, "Centre").replace(/Defense/g, "Defence");
  return text.charAt(0) + text.slice(1).toLowerCase();
}

/** "2/7/1988" (month first, as sent for region=us) as "1988-02-07"; undefined for anything else. */
export function birthDate(display: string | undefined): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display ?? "");
  if (!m) return undefined;
  const [month, day] = [Number(m[1]), Number(m[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Height and weight in both systems: `6' 3"` is 75 in (191 cm), "214 lbs" is 214 lb (97 kg). */
function size(height: string | undefined, weight: string | undefined): Partial<PlayerBio> {
  const bio: Partial<PlayerBio> = {};
  const h = /^(\d+)' (\d+)"$/.exec(height ?? "");
  if (h) {
    bio.heightIn = Number(h[1]) * 12 + Number(h[2]);
    bio.heightCm = Math.round(bio.heightIn * 2.54);
  }
  const w = /^(\d+) lbs$/.exec(weight ?? "");
  if (w) {
    bio.weightLb = Number(w[1]);
    bio.weightKg = Math.round(bio.weightLb * 0.45359237);
  }
  return bio;
}

/** "2009: Rd 1, Pk 1 (DET)" (the pick counted overall); undefined for anything else. */
export function draft(display: string | undefined): PlayerBio["draft"] {
  const m = /^(\d{4}): Rd (\d+), Pk (\d+) \(([A-Z]+)\)$/.exec(display ?? "");
  return m ? { year: Number(m[1]), round: Number(m[2]), overallPick: Number(m[3]), teamId: m[4] } : undefined;
}

/** The season type a stats response holds: "2" regular season, "3" playoffs. */
function seasonType(raw: RawAthleteStats | undefined): string | undefined {
  return raw?.filters?.find((f) => f.name === "seasontype")?.value;
}

/** Whether the player has playoff stats to ask for (the regular season response lists the types they have). */
export function hasPlayoffStats(regular: RawAthleteStats): boolean {
  return !!regular.filters?.find((f) => f.name === "seasontype")?.options?.some((o) => o.value === "3");
}

/** The player's main stat category: the first ESPN lists that the page has columns for ("passing", "defensive"). */
function mainCategory(raw: RawAthleteStats | undefined): string | undefined {
  return raw?.categories.find((c) => PLAYER_COLUMNS[c.name])?.name;
}

/** The category's columns that `names` has, in the table's order. */
function columnsIn(category: string, names: readonly string[]): StatColumn[] {
  return (PLAYER_COLUMNS[category]?.columns ?? [])
    .filter((c) => names.includes(c.key))
    .map(({ key, label }) => ({ key, label }));
}

/** Values by key from a line of strings in the order of `names`, for the given columns. */
function pickStats(names: readonly string[], stats: readonly string[] | undefined, keys: readonly string[]) {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const i = names.indexOf(key);
    const v = i < 0 ? undefined : stats?.[i];
    if (v !== undefined && v !== "") values[key] = v;
  }
  return values;
}

/** Season lines in `category`, newest first (ESPN lists them oldest first), and its career line. */
function seasonLines(
  raw: RawAthleteStats | undefined,
  category: string,
  playoffs: boolean,
): { rows: PlayerSeasonLine[]; career: StatItem[]; columns: StatColumn[] } {
  const stats = raw?.categories.find((c) => c.name === category);
  if (!raw || !stats) return { rows: [], career: [], columns: [] };
  const columns = columnsIn(category, stats.names);
  const keys = columns.map((c) => c.key);
  const rows = [...(stats.statistics ?? [])].reverse().map((line): PlayerSeasonLine => ({
    season: line.season.displayName,
    team: raw.teams?.[line.teamSlug]?.shortDisplayName ?? line.teamSlug,
    league: "NFL",
    inLeague: true,
    playoffs,
    values: pickStats(stats.names, line.stats, keys),
  }));
  const totals = pickStats(stats.names, stats.totals, PLAYER_COLUMNS[category].career);
  const career = PLAYER_COLUMNS[category].career.flatMap((key) => {
    const value = totals[key];
    const label = PLAYER_COLUMNS[category].columns.find((c) => c.key === key)!.label;
    return value === undefined ? [] : [{ value, label }];
  });
  return { rows, career, columns };
}

/** The league's calendar date (US Eastern) of a game starting at `time`: NFL games start between 9:30 am and 8:20 pm ET. */
function gameDay(time: string): string {
  return new Date(Date.parse(time) - 6 * 3_600_000).toISOString().slice(0, 10);
}

/** The latest games outside the preseason, newest first, with the category's columns the game log has. */
function lastGames(
  raw: RawGamelog | undefined,
  category: string | undefined,
  teamId: string | undefined,
): PlayerDetail["lastGames"] {
  if (!raw || !category) return { columns: [], games: [] };
  const columns = columnsIn(category, raw.names);
  const keys = columns.map((c) => c.key);
  const lines: (PlayerGameLine & { time: number })[] = [];
  for (const type of raw.seasonTypes ?? []) {
    if (/preseason/i.test(type.displayName)) continue;
    for (const c of type.categories) {
      for (const g of c.events ?? []) {
        const event = raw.events[g.eventId];
        const time = event ? Date.parse(event.gameDate) : NaN;
        if (!event || !Number.isFinite(time)) continue;
        lines.push({
          gameId: g.eventId,
          date: gameDay(event.gameDate),
          teamId: event.team?.abbreviation ?? teamId ?? "",
          opponentId: event.opponent.abbreviation,
          home: event.atVs !== "@",
          values: pickStats(raw.names, g.stats, keys),
          time,
        });
      }
    }
  }
  const games = lines
    .sort((a, b) => b.time - a.time)
    .slice(0, PLAYER_LAST_GAMES)
    .map(({ time: _time, ...line }) => line);
  return { columns, games };
}

/**
 * The player page from the athlete (bio, team, this season's headline stats) plus, each optional (an extra that
 * failed, or no playoffs), the regular season and playoff stats and the game log. Every table follows the player's
 * main stat category: passing for a quarterback, defence for a safety, kicking for a kicker.
 */
export function mapPlayer(
  raw: RawAthlete,
  extras: { regular?: RawAthleteStats; playoffs?: RawAthleteStats; gamelog?: RawGamelog },
): PlayerDetail {
  const a = raw.athlete;
  const team: Team | undefined = a.team
    ? {
        id: a.team.abbreviation,
        league: LEAGUE,
        name: a.team.displayName,
        abbrev: a.team.abbreviation,
        logoUrl: a.team.logos?.[0]?.href,
      }
    : undefined;
  const jersey = Number(a.jersey);
  const regularStats = seasonType(extras.regular) === "2" ? extras.regular : undefined;
  // ESPN answers a playoffs request for a player without any with the regular season: keep it only if it says so.
  const playoffStats = seasonType(extras.playoffs) === "3" ? extras.playoffs : undefined;
  const category = mainCategory(regularStats);
  const regular = category ? seasonLines(regularStats, category, false) : undefined;
  const playoffs = category ? seasonLines(playoffStats, category, true) : undefined;
  return compact({
    player: {
      id: a.id,
      league: LEAGUE,
      name: a.displayName,
      teamId: team?.id,
      position: a.position?.abbreviation,
      headshotUrl: a.headshot?.href,
    },
    positionName: a.position ? positionName(a.position.name) : undefined,
    sweaterNumber: a.jersey !== undefined && a.jersey !== "" && Number.isInteger(jersey) ? jersey : undefined,
    team,
    active: a.active ?? team !== undefined,
    goalie: false,
    bio: {
      birthDate: birthDate(a.displayDOB),
      birthPlace: a.displayBirthPlace,
      ...size(a.displayHeight, a.displayWeight),
      draft: draft(a.displayDraft),
    },
    // "2026 regular season stats": the season the headline numbers are for.
    seasonLabel: /^(\d{4}(?:-\d{2})?) /.exec(a.statsSummary?.displayName ?? "")?.[1],
    season: (a.statsSummary?.statistics ?? []).map((s) => ({ value: s.displayValue, label: s.abbreviation })),
    career: { regularSeason: regular?.career ?? [], playoffs: playoffs?.career ?? [] },
    lastGames: lastGames(extras.gamelog, category, team?.id),
    seasons: {
      columns: regular?.columns ?? [],
      // Newest season first, its regular season before its playoffs (the sort keeps that order within a season).
      rows: [...(regular?.rows ?? []), ...(playoffs?.rows ?? [])].sort((x, y) => y.season.localeCompare(x.season)),
    },
  });
}
