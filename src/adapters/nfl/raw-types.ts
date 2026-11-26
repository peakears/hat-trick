// Zod schemas for the ESPN NFL responses the adapter reads; the types are inferred from them. Only the fields the
// mappers use are listed (zod drops the rest). Core fields are plain zod (a mismatch fails the response), minor
// ones use minor() and lists of rows lenientArray() (validate.ts). Verified on 2026-11-26 against the fixtures.
import { z } from "zod";
import { lenientArray, minor } from "./validate";

// ---------- Scoreboard: /scoreboard?dates=YYYYMMDD ----------

const RawScoreboardTeamSchema = z.object({
  abbreviation: z.string().min(1),
  displayName: z.string().min(1),
  logo: minor(z.string(), "team.logo"),
});

/** Verified on 2026-11-26: `type` "total" (the season record, "7-4" or "6-4-1"), "home" and "road". */
const RawRecordSchema = z.object({ type: z.string(), summary: z.string() });

/** One quarter's points. Verified on 2026-11-26 final: { value: 6, period: 1 }, one per quarter played. */
const RawLinescoreSchema = z.object({ value: z.number(), period: z.number() });

const RawCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  team: RawScoreboardTeamSchema,
  /** A string ("26"); "0" before kickoff. */
  score: z.string(),
  records: lenientArray(RawRecordSchema, "competitor.records"),
  linescores: lenientArray(RawLinescoreSchema, "competitor.linescores"),
});

const RawVenueSchema = z.object({
  fullName: z.string(),
  address: minor(z.object({ city: minor(z.string(), "venue.address.city") }), "venue.address"),
});

/**
 * Verified on 2026-11-26: STATUS_SCHEDULED (pre, period 0), STATUS_IN_PROGRESS (in, period 1, "8:31") and
 * STATUS_FINAL (post, period 4). Halftime and the end of a quarter are the NBA's by name, not yet seen here.
 */
const RawStatusSchema = z.object({
  /** Game clock as shown, "4:06"; "0:00" before kickoff and at the end of a quarter. */
  displayClock: minor(z.string(), "status.displayClock"),
  /** 1-4 quarters, 5+ overtimes; 0 before kickoff. */
  period: z.number(),
  type: z.object({
    name: z.string(),
    state: z.enum(["pre", "in", "post"]),
    completed: z.boolean(),
  }),
});

const RawCompetitionSchema = z.object({
  competitors: z.array(RawCompetitorSchema).length(2),
  venue: minor(RawVenueSchema, "competition.venue"),
});

const RawEventSchema = z.object({
  id: z.string().min(1),
  /** "2026-11-26T01:00Z": ISO 8601 without seconds. */
  date: z.string().min(1),
  status: RawStatusSchema,
  competitions: z.array(RawCompetitionSchema).min(1),
});

export const RawScoreboardSchema = z.object({ events: z.array(RawEventSchema) });
export type RawScoreboard = z.output<typeof RawScoreboardSchema>;
export type RawEvent = z.output<typeof RawEventSchema>;

// ---------- Standings: apis/v2/.../standings?level=3 (conferences, then divisions) ----------

const RawStatSchema = z.object({
  name: z.string(),
  value: minor(z.number(), "stat.value"),
  displayValue: minor(z.string(), "stat.displayValue"),
});

/**
 * Verified on 2026-11-26: stats by name, among them `wins`, `losses`, `ties`, `winPercent`, `playoffSeed` (1-16 in
 * the conference), `streak` ("W6"), `Home` and `Road` ("4-1", or "4-1-1" with a tie).
 */
const RawStandingsEntrySchema = z.object({
  team: z.object({
    abbreviation: z.string().min(1),
    displayName: z.string().min(1),
    logos: lenientArray(z.object({ href: z.string() }), "team.logos"),
  }),
  stats: z
    .array(RawStatSchema)
    .refine(
      (stats) => ["wins", "losses"].every((n) => typeof stats.find((s) => s.name === n)?.value === "number"),
      "wins and losses",
    ),
});

const RawDivisionSchema = z.object({
  name: z.string().min(1),
  standings: z.object({ entries: z.array(RawStandingsEntrySchema) }),
});

const RawConferenceSchema = z.object({
  name: z.string().min(1),
  children: z.array(RawDivisionSchema).min(1),
});

export const RawStandingsSchema = z.object({ children: z.array(RawConferenceSchema).min(1) });
export type RawStandings = z.output<typeof RawStandingsSchema>;
export type RawStandingsEntry = z.output<typeof RawStandingsEntrySchema>;

// ---------- Leaders: common/v3/.../statistics/byathlete?sort=<group>.<stat>:desc ----------

/**
 * Each athlete's stats are arrays per category group ("passing", "defensive", ...), in the order of the top-level
 * `categories[].names`; the stat a board shows is found by name there. Verified on 2026-11-26.
 */
const RawLeaderAthleteSchema = z.object({
  athlete: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    teamShortName: z.string().min(1),
    headshot: minor(z.object({ href: z.string() }), "athlete.headshot"),
    position: minor(z.object({ abbreviation: z.string() }), "athlete.position"),
    /** Trimmed to the first (default) logo in the fixtures; see CLAUDE.md. */
    teamLogos: lenientArray(z.object({ href: z.string() }), "athlete.teamLogos"),
  }),
  categories: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
});

export const RawLeadersSchema = z.object({
  categories: z.array(z.object({ name: z.string(), names: z.array(z.string()) })),
  athletes: lenientArray(RawLeaderAthleteSchema, "athletes"),
});
export type RawLeaders = z.output<typeof RawLeadersSchema>;
