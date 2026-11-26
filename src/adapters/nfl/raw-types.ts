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

// ---------- Game summary: /summary?event=<id> ----------
// Verified on 2026-11-26 against a final (401873079, GB at LAR), a live game in the 2nd quarter (401873081, CHI at
// DET) and a scheduled one (401873082, KC at BUF). The fixtures keep only `header`, `boxscore`, `gameInfo`,
// `leaders` and `scoringPlays` (plays, drives, news and odds are most of the response).

const RawLogoTeamSchema = z.object({
  abbreviation: z.string().min(1),
  displayName: z.string().min(1),
  /** Trimmed to the first (default) logo in the fixtures. */
  logos: lenientArray(z.object({ href: z.string() }), "team.logos"),
});

/** The header's status: a live game's has `period` and `displayClock`; a final or scheduled one has only `type`. */
const RawSummaryStatusSchema = z.object({
  displayClock: minor(z.string(), "status.displayClock"),
  period: minor(z.number(), "status.period"),
  type: RawStatusSchema.shape.type,
});

const RawSummaryCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  team: RawLogoTeamSchema,
  /** A string ("26"); absent before kickoff. */
  score: minor(z.string(), "competitor.score"),
  /** One per quarter started ("6"), so its length is the number of periods (5 is overtime). */
  linescores: lenientArray(z.object({ displayValue: minor(z.string(), "linescore") }), "competitor.linescores"),
  /** `type: "total"` is the season record. */
  record: lenientArray(RawRecordSchema, "competitor.record"),
});

const RawPlayerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  headshot: minor(z.object({ href: z.string() }), "athlete.headshot"),
  position: minor(z.object({ abbreviation: z.string() }), "athlete.position"),
});

/**
 * One team's players: ten statistics groups by `name` ("passing", "rushing", ..., "punting"), each with `keys`
 * naming its columns ("completions/passingAttempts") and `labels` heading them ("C/ATT"); athletes' `stats` are
 * strings in that order ("17/29"), "--" for none. No starter flag or position here. Absent before kickoff.
 */
const RawBoxscoreTeamSchema = z.object({
  team: z.object({ abbreviation: z.string().min(1) }),
  statistics: lenientArray(
    z.object({
      name: z.string(),
      keys: z.array(z.string()),
      labels: z.array(z.string()),
      athletes: lenientArray(z.object({ athlete: RawPlayerSchema, stats: z.array(z.string()) }), "boxscore.athletes"),
    }),
    "boxscore.statistics",
  ),
});

/** A team's leader in one stat: `name` "passingYards", "rushingYards", "receivingYards", "sacks", "totalTackles". */
const RawTeamLeadersSchema = z.object({
  team: z.object({ abbreviation: z.string().min(1) }),
  leaders: lenientArray(
    z.object({
      name: z.string(),
      leaders: lenientArray(
        z.object({
          /** The player's line: "32 CAR, 184 YDS, 1 TD". */
          displayValue: z.string(),
          /** The stat itself (yards). */
          value: z.number(),
          athlete: RawPlayerSchema,
        }),
        "leaders.leaders",
      ),
    }),
    "leaders.categories",
  ),
});

/** One score: "Kyren Williams 7 Yd Rush (Brandon McManus Kick)", the score after it, and when. */
const RawScoringPlaySchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  awayScore: z.number(),
  homeScore: z.number(),
  period: z.object({ number: z.number() }),
  /** Time left in the quarter, "11:29". */
  clock: z.object({ displayValue: z.string() }),
  team: z.object({ abbreviation: z.string().min(1) }),
  /** "Touchdown", "Field Goal" (and, unseen yet, "Safety"). */
  scoringType: minor(z.object({ displayName: z.string() }), "scoringPlay.scoringType"),
});

export const RawSummarySchema = z.object({
  header: z.object({
    id: z.string().min(1),
    competitions: z
      .array(
        z.object({
          /** "2026-11-26T01:00Z", as in the scoreboard. */
          date: z.string().min(1),
          status: RawSummaryStatusSchema,
          competitors: z.array(RawSummaryCompetitorSchema).length(2),
        }),
      )
      .min(1),
  }),
  /**
   * `teams` is each team's game totals by `name` with a `label` ("thirdDownEff", "3rd down efficiency", "2-8");
   * before kickoff it holds season averages instead (yardsPerGame), which the mapper does not read.
   */
  boxscore: minor(
    z.object({
      players: lenientArray(RawBoxscoreTeamSchema, "boxscore.players"),
      teams: lenientArray(
        z.object({
          team: z.object({ abbreviation: z.string().min(1) }),
          statistics: lenientArray(
            z.object({ name: z.string(), displayValue: z.string() }),
            "boxscore.teams.statistics",
          ),
        }),
        "boxscore.teams",
      ),
    }),
    "boxscore",
  ),
  /** Before kickoff these are season leaders, which the mapper does not read. */
  leaders: lenientArray(RawTeamLeadersSchema, "leaders"),
  /** Empty before the first score. */
  scoringPlays: lenientArray(RawScoringPlaySchema, "scoringPlays"),
  /** `attendance` once the league reports it (on the final; absent live). */
  gameInfo: minor(
    z.object({ venue: minor(RawVenueSchema, "gameInfo.venue"), attendance: minor(z.number(), "gameInfo.attendance") }),
    "gameInfo",
  ),
});
export type RawSummary = z.output<typeof RawSummarySchema>;
export type RawBoxscoreTeam = z.output<typeof RawBoxscoreTeamSchema>;
export type RawTeamLeaders = z.output<typeof RawTeamLeadersSchema>;
