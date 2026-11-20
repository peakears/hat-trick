// Raw response shapes for the unofficial NHL web API, as zod schemas.
// The TypeScript types below are inferred from them, so there is one source of truth.
//
// Verified against live responses on 2026-11-17 (season 20262027): /score,
// /gamecenter/{id}/boxscore (live and final), /standings/now, and both
// stats-leaders endpoints.
//
// Core fields (plain schemas) throw on mismatch. Minor fields (`minor()`) are
// dropped with a warning. See validate.ts for the policy.

import { z } from "zod";
import { lenientArray, minor } from "./validate";

const num = (field: string) => minor(z.number(), field);
const str = (field: string) => minor(z.string(), field);
const bool = (field: string) => minor(z.boolean(), field);

export const LocalizedSchema = z.object({
  default: z.string(),
  fr: str("fr"),
});
const localized = (field: string) => minor(LocalizedSchema, field);

// ---------- Games (/score, /gamecenter/{id}/boxscore) ----------

export const RawTeamSchema = z.object({
  abbrev: z.string(),
  score: z.number().optional(), // absent before the game starts
  id: num("team.id"),
  name: localized("team.name"), // /score only, e.g. "Bruins"
  commonName: localized("team.commonName"), // boxscore only, e.g. "Bruins"
  placeName: localized("team.placeName"), // boxscore only, e.g. "Boston"
  sog: num("team.sog"), // absent before the game starts
  logo: str("team.logo"), // light-background SVG
  darkLogo: str("team.darkLogo"), // boxscore only
  record: str("team.record"), // scheduled games in /score only, "8-10-3"
});

export const RawPeriodDescriptorSchema = z.object({
  number: z.number(),
  periodType: z.string(), // "REG" | "OT" | "SO"
  maxRegulationPeriods: num("periodDescriptor.maxRegulationPeriods"),
});

export const RawClockSchema = z.object({
  // During an intermission this counts down the intermission, not the period.
  timeRemaining: str("clock.timeRemaining"), // "03:05"
  secondsRemaining: num("clock.secondsRemaining"),
  running: bool("clock.running"),
  inIntermission: bool("clock.inIntermission"),
});

// One TV listing. "N" national, "H" home team's feed, "A" away team's. Seen countries: "CA", "US".
export const RawBroadcastSchema = z.object({
  network: z.string(), // "SN", "TNT", "NESN", sometimes with a trailing space ("ABTV ")
  countryCode: z.string(),
  market: z.string(),
  sequenceNumber: num("tvBroadcasts.sequenceNumber"),
});

// One goal of the scoring summary in /score (the box score has none). Seen strength: "ev", "pp"
// ("sh" unverified); seen goalModifier: "none", "empty-net" ("penalty-shot" unverified).
export const RawGoalAssistSchema = z.object({
  playerId: z.number(),
  name: LocalizedSchema, // abbreviated, "E. Gustafsson"
});

export const RawGoalSchema = z.object({
  period: z.number(),
  periodDescriptor: minor(RawPeriodDescriptorSchema, "goals.periodDescriptor"),
  timeInPeriod: z.string(), // elapsed, "15:46"
  playerId: z.number(),
  name: LocalizedSchema, // abbreviated scorer, "M. Zuccarello"
  teamAbbrev: z.string(),
  goalModifier: str("goals.goalModifier"),
  strength: str("goals.strength"),
  assists: lenientArray(RawGoalAssistSchema, "goals.assists"),
  homeScore: num("goals.homeScore"),
  awayScore: num("goals.awayScore"),
});

export const RawGameSchema = z.object({
  id: z.number(),
  startTimeUTC: z.string(),
  // Seen: "FUT", "LIVE", "FINAL", "OFF". "PRE", "CRIT" and postponed values unverified.
  gameState: z.string(),
  homeTeam: RawTeamSchema,
  awayTeam: RawTeamSchema,
  season: num("season"), // 20262027
  gameType: num("gameType"), // 1 preseason, 2 regular season, 3 playoffs
  gameDate: str("gameDate"), // league calendar date, YYYY-MM-DD
  venue: localized("venue"), // arena, "TD Garden"
  venueLocation: localized("venueLocation"), // box score only: city, "Boston" (no state or province)
  gameScheduleState: str("gameScheduleState"), // "OK"
  periodDescriptor: minor(RawPeriodDescriptorSchema, "periodDescriptor"),
  clock: minor(RawClockSchema, "clock"),
  // Final games only: "REG" | "OT" | "SO".
  gameOutcome: minor(z.object({ lastPeriodType: z.string() }), "gameOutcome"),
  // A bad listing is dropped on its own, so TV info can never break the scores.
  tvBroadcasts: lenientArray(RawBroadcastSchema, "tvBroadcasts"),
  // /score only, in the order scored. A bad goal is dropped on its own.
  goals: lenientArray(RawGoalSchema, "goals"),
});

export const RawScoreResponseSchema = z.object({
  currentDate: str("currentDate"),
  games: z.array(RawGameSchema).optional(),
});

// ---------- Box score players ----------

export const RawSkaterSchema = z.object({
  playerId: z.number(),
  name: LocalizedSchema, // abbreviated, e.g. "J. Eichel"
  sweaterNumber: num("sweaterNumber"),
  position: str("position"), // "C" | "L" | "R" | "D"
  goals: num("goals"),
  assists: num("assists"),
  points: num("points"),
  plusMinus: num("plusMinus"),
  pim: num("pim"),
  hits: num("hits"),
  sog: num("sog"),
  blockedShots: num("blockedShots"),
  powerPlayGoals: num("powerPlayGoals"),
  faceoffWinningPctg: num("faceoffWinningPctg"), // not always present for defense
  shifts: num("shifts"),
  giveaways: num("giveaways"),
  takeaways: num("takeaways"),
  toi: str("toi"), // "17:36"
});

export const RawGoalieSchema = z.object({
  playerId: z.number(),
  name: LocalizedSchema,
  sweaterNumber: num("sweaterNumber"),
  position: str("position"), // "G"
  starter: bool("starter"), // final games only
  shotsAgainst: num("shotsAgainst"),
  saves: num("saves"),
  saveShotsAgainst: str("saveShotsAgainst"), // "23/25"
  goalsAgainst: num("goalsAgainst"),
  savePctg: num("savePctg"), // absent for a goalie who did not play
  pim: num("pim"),
  toi: str("toi"), // "00:00" for a goalie who did not play
});

export const RawSideStatsSchema = z.object({
  forwards: lenientArray(RawSkaterSchema, "forwards"),
  defense: lenientArray(RawSkaterSchema, "defense"),
  goalies: lenientArray(RawGoalieSchema, "goalies"),
});

export const RawBoxscoreSchema = RawGameSchema.extend({
  playerByGameStats: minor(
    z.object({
      homeTeam: minor(RawSideStatsSchema, "playerByGameStats.homeTeam"),
      awayTeam: minor(RawSideStatsSchema, "playerByGameStats.awayTeam"),
    }),
    "playerByGameStats",
  ),
});

// ---------- Standings (/standings/now) ----------

export const RawStandingSchema = z.object({
  teamAbbrev: LocalizedSchema,
  teamName: LocalizedSchema, // "Edmonton Oilers"
  gamesPlayed: z.number(),
  wins: z.number(),
  losses: z.number(),
  otLosses: z.number().optional(),
  points: z.number().optional(),
  teamCommonName: localized("teamCommonName"), // "Oilers"
  seasonId: num("seasonId"),
  date: str("date"),
  teamLogo: str("teamLogo"),
  conferenceName: str("conferenceName"),
  conferenceAbbrev: str("conferenceAbbrev"),
  divisionName: str("divisionName"),
  divisionAbbrev: str("divisionAbbrev"),
  // Rank within each grouping, 1-based. The response is sorted by leagueSequence.
  leagueSequence: num("leagueSequence"),
  conferenceSequence: num("conferenceSequence"),
  divisionSequence: num("divisionSequence"),
  wildcardSequence: num("wildcardSequence"), // 0 for teams in a division top-3 spot
  pointPctg: num("pointPctg"),
  regulationWins: num("regulationWins"),
  goalFor: num("goalFor"),
  goalAgainst: num("goalAgainst"),
  goalDifferential: num("goalDifferential"),
  streakCode: str("streakCode"), // "W" | "L" | "OT"
  streakCount: num("streakCount"),
  clinchIndicator: str("clinchIndicator"), // not present early in the season; unverified
  // Home, road and last-10 splits (all verified against the 2026-11-17 fixture).
  homeWins: num("homeWins"),
  homeLosses: num("homeLosses"),
  homeOtLosses: num("homeOtLosses"),
  homeGoalsFor: num("homeGoalsFor"),
  homeGoalsAgainst: num("homeGoalsAgainst"),
  roadWins: num("roadWins"),
  roadLosses: num("roadLosses"),
  roadOtLosses: num("roadOtLosses"),
  roadGoalsFor: num("roadGoalsFor"),
  roadGoalsAgainst: num("roadGoalsAgainst"),
  l10Wins: num("l10Wins"),
  l10Losses: num("l10Losses"),
  l10OtLosses: num("l10OtLosses"),
  l10GoalsFor: num("l10GoalsFor"),
  l10GoalsAgainst: num("l10GoalsAgainst"),
});

export const RawStandingsResponseSchema = z.object({
  standingsDateTimeUtc: str("standingsDateTimeUtc"),
  wildCardIndicator: bool("wildCardIndicator"),
  standings: z.array(RawStandingSchema).optional(),
});

// ---------- Leaders (/{skater,goalie}-stats-leaders/current) ----------

export const RawLeaderSchema = z.object({
  id: z.number(),
  firstName: LocalizedSchema,
  lastName: LocalizedSchema,
  teamAbbrev: z.string(),
  value: z.number(), // integer for counts, decimal for savePctg (0.939759) and GAA (1.4236)
  sweaterNumber: num("sweaterNumber"),
  headshot: str("headshot"),
  teamName: localized("teamName"),
  teamLogo: str("teamLogo"),
  position: str("position"),
});

// Keyed by category name, e.g. { goals: [...], assists: [...] }.
export const RawLeadersResponseSchema = z.record(z.string(), z.array(RawLeaderSchema));

// ---------- Inferred types ----------

export type Localized = z.output<typeof LocalizedSchema>;
export type RawTeam = z.output<typeof RawTeamSchema>;
export type RawBroadcast = z.output<typeof RawBroadcastSchema>;
export type RawGoal = z.output<typeof RawGoalSchema>;
export type RawGame = z.output<typeof RawGameSchema>;
export type RawScoreResponse = z.output<typeof RawScoreResponseSchema>;
export type RawSkater = z.output<typeof RawSkaterSchema>;
export type RawGoalie = z.output<typeof RawGoalieSchema>;
export type RawSideStats = z.output<typeof RawSideStatsSchema>;
export type RawBoxscore = z.output<typeof RawBoxscoreSchema>;
export type RawStanding = z.output<typeof RawStandingSchema>;
export type RawStandingsResponse = z.output<typeof RawStandingsResponseSchema>;
export type RawLeader = z.output<typeof RawLeaderSchema>;
export type RawLeadersResponse = z.output<typeof RawLeadersResponseSchema>;
