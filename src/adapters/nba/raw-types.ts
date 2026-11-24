// Zod schemas for the ESPN NBA responses the adapter reads; the types are inferred from them. Only the fields the
// mappers use are listed (zod drops the rest). Core fields are plain zod (a mismatch fails the response), minor
// ones use minor() and lists of rows lenientArray() (validate.ts). Verified on 2026-11-22 against the fixtures.
import { z } from "zod";
import { lenientArray, minor } from "./validate";

// ---------- Scoreboard: /scoreboard?dates=YYYYMMDD ----------

const RawScoreboardTeamSchema = z.object({
  abbreviation: z.string().min(1),
  displayName: z.string().min(1),
  logo: minor(z.string(), "team.logo"),
});

const RawRecordSchema = z.object({ type: z.string(), summary: z.string() });

/** One quarter's points. Verified on 2026-11-23 live: { value: 25, displayValue: "25", period: 1 }, one per period played. */
const RawLinescoreSchema = z.object({ value: z.number(), period: z.number() });

/**
 * The team's leader in one stat so far. Verified on 2026-11-23 live: `name` "points", "rebounds", "assists" and
 * "rating", whose `displayValue` is a line ("23 PTS, 8 REB"); the others' is the number ("23").
 */
const RawCompetitorLeaderSchema = z.object({
  name: z.string(),
  leaders: lenientArray(
    z.object({ displayValue: z.string(), value: z.number(), athlete: z.object({ shortName: z.string().min(1) }) }),
    "competitor.leaders.leaders",
  ),
});

const RawCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  team: RawScoreboardTeamSchema,
  /** A string ("107"); "0" before tip-off. */
  score: z.string(),
  records: lenientArray(RawRecordSchema, "competitor.records"),
  linescores: lenientArray(RawLinescoreSchema, "competitor.linescores"),
  leaders: lenientArray(RawCompetitorLeaderSchema, "competitor.leaders"),
});

const RawVenueSchema = z.object({
  fullName: z.string(),
  address: minor(z.object({ city: minor(z.string(), "venue.address.city") }), "venue.address"),
});

/**
 * Verified on 2026-11-22: STATUS_SCHEDULED (pre), STATUS_IN_PROGRESS (in), STATUS_FINAL (post, "Final/OT"); on
 * 2026-11-23: STATUS_END_PERIOD (in, `displayClock` "0.1") and a live overtime (period 5, "1:03").
 */
const RawStatusSchema = z.object({
  /** Game clock as shown, "4:06"; "0.0" before tip-off and at the end of a period. */
  displayClock: minor(z.string(), "status.displayClock"),
  /** 1-4 quarters, 5+ overtimes; 0 before tip-off. */
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
  /** "2026-11-22T20:30Z": ISO 8601 without seconds. */
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
 * Each athlete's stats are arrays per category group ("general", "offensive", "defensive"), in the order of the
 * top-level `categories[].names`; the stat a board shows is found by name there.
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
// Verified on 2026-11-23 against a final game in overtime (401910032) and a scheduled one (401909314). The
// fixtures keep only `header`, `boxscore` and `gameInfo` (plays, news and odds are most of the response).

const RawLogoTeamSchema = z.object({
  abbreviation: z.string().min(1),
  displayName: z.string().min(1),
  /** Trimmed to the first (default) logo in the fixtures. */
  logos: lenientArray(z.object({ href: z.string() }), "team.logos"),
});

/**
 * The header's status. A final game's has only `type` (no period or clock: the mapper counts `linescores`); a
 * live game's period and clock are unverified, so both are minor.
 */
const RawSummaryStatusSchema = z.object({
  displayClock: minor(z.string(), "status.displayClock"),
  period: minor(z.number(), "status.period"),
  type: RawStatusSchema.shape.type,
});

const RawSummaryCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  team: RawLogoTeamSchema,
  /** A string ("145"); absent before tip-off. */
  score: minor(z.string(), "competitor.score"),
  /** One entry per period played, so its length is the number of periods (5+ is overtime). */
  linescores: lenientArray(z.object({ displayValue: minor(z.string(), "linescore") }), "competitor.linescores"),
  /** `type: "total"` is the season record. */
  record: lenientArray(RawRecordSchema, "competitor.record"),
});

/**
 * One team's players: one statistics group, whose `keys` name each column and `labels` head it ("MIN", "PTS",
 * "FG"); each athlete's `stats` are strings in that order ("8-19"), empty for a player who did not play.
 */
const RawBoxscoreTeamSchema = z.object({
  team: z.object({ abbreviation: z.string().min(1) }),
  statistics: z.array(
    z.object({
      keys: z.array(z.string()),
      labels: z.array(z.string()),
      athletes: lenientArray(
        z.object({
          athlete: z.object({
            id: z.string().min(1),
            displayName: z.string().min(1),
            headshot: minor(z.object({ href: z.string() }), "athlete.headshot"),
            position: minor(z.object({ abbreviation: z.string() }), "athlete.position"),
          }),
          starter: minor(z.boolean(), "athlete.starter"),
          didNotPlay: minor(z.boolean(), "athlete.didNotPlay"),
          stats: z.array(z.string()),
        }),
        "boxscore.athletes",
      ),
    }),
  ),
});

export const RawSummarySchema = z.object({
  header: z.object({
    id: z.string().min(1),
    competitions: z
      .array(
        z.object({
          /** "2026-11-23T00:00Z", as in the scoreboard. */
          date: z.string().min(1),
          status: RawSummaryStatusSchema,
          competitors: z.array(RawSummaryCompetitorSchema).length(2),
        }),
      )
      .min(1),
  }),
  /**
   * `players` is absent before tip-off. `teams` is each team's game totals by `name` ("fieldGoalPct": "53",
   * "totalRebounds": "47"; verified on 2026-11-23, final and live); before tip-off it holds season averages instead,
   * which the mapper does not read.
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
  /** `attendance` is 0 or absent until the league reports it (seen on a final game, not a live one). */
  gameInfo: minor(
    z.object({ venue: minor(RawVenueSchema, "gameInfo.venue"), attendance: minor(z.number(), "gameInfo.attendance") }),
    "gameInfo",
  ),
});
export type RawSummary = z.output<typeof RawSummarySchema>;
export type RawBoxscoreTeam = z.output<typeof RawBoxscoreTeamSchema>;

// ---------- Team page: /teams/<abbrev>/athletes/statistics and /teams/<abbrev>/schedule ----------
// Verified on 2026-11-23 against the Nuggets (DEN), 15 games into the season.

/** A stat by `name` ("avgPoints", "fieldGoalPct"); `displayValue` is as ESPN shows it ("24.9"). */
const RawNamedStatSchema = z.object({ name: z.string(), displayValue: minor(z.string(), "stat.displayValue") });

const RawTeamAthleteSchema = z.object({
  athlete: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    headshot: minor(z.object({ href: z.string() }), "athlete.headshot"),
    position: minor(z.object({ abbreviation: z.string() }), "athlete.position"),
  }),
  /** Groups "general", "offensive", "defensive", each a list of stats by name. */
  statistics: z.array(z.object({ name: z.string(), stats: lenientArray(RawNamedStatSchema, "athlete.stats") })),
});

/** `results[0].leaders` is every player on the roster who has played, by points per game. */
export const RawTeamStatsSchema = z.object({
  results: z.array(z.object({ leaders: lenientArray(RawTeamAthleteSchema, "results.leaders") })),
});
export type RawTeamStats = z.output<typeof RawTeamStatsSchema>;
export type RawTeamAthlete = z.output<typeof RawTeamAthleteSchema>;

const RawScheduleCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  team: RawLogoTeamSchema,
  /** Absent before tip-off. */
  score: minor(z.object({ value: z.number() }), "competitor.score"),
});

/** The whole regular season, played and to come. Unlike the scoreboard, the status is on the competition. */
export const RawTeamScheduleSchema = z.object({
  events: lenientArray(
    z.object({
      id: z.string().min(1),
      date: z.string().min(1),
      competitions: z
        .array(
          z.object({
            status: RawStatusSchema,
            competitors: z.array(RawScheduleCompetitorSchema).length(2),
            venue: minor(RawVenueSchema, "competition.venue"),
          }),
        )
        .min(1),
    }),
    "events",
  ),
});
export type RawTeamSchedule = z.output<typeof RawTeamScheduleSchema>;

// ---------- Player page: common/v3/.../athletes/<id>[/stats|/gamelog]?region=us&lang=en ----------
// Verified on 2026-11-23 against Jamal Murray (3936299: ten seasons, playoffs) and Alpha Diallo (4065813: a rookie,
// undrafted, no playoffs). `region=us` matters: it makes `displayDOB` month first ("2/23/1997"); without it the
// order follows ESPN's guess at the reader's locale.

export const RawAthleteSchema = z.object({
  athlete: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    /** "27"; absent for a player without a number. */
    jersey: minor(z.string(), "athlete.jersey"),
    /** `name` is ESPN's ("Guard", "Center"); `abbreviation` is the code shown in tables ("G"). */
    position: minor(z.object({ name: z.string(), abbreviation: z.string() }), "athlete.position"),
    team: minor(RawLogoTeamSchema, "athlete.team"),
    headshot: minor(z.object({ href: z.string() }), "athlete.headshot"),
    active: minor(z.boolean(), "athlete.active"),
    /** "2/23/1997", month first (see above). */
    displayDOB: minor(z.string(), "athlete.displayDOB"),
    /** "Kitchener, ON", "Sombor, Serbia", "New York, NY". */
    displayBirthPlace: minor(z.string(), "athlete.displayBirthPlace"),
    /** `6' 4"` */
    displayHeight: minor(z.string(), "athlete.displayHeight"),
    /** "215 lbs" */
    displayWeight: minor(z.string(), "athlete.displayWeight"),
    /** "2016: Rd 1, Pk 7 (DEN)", the pick counted overall; absent for an undrafted player. */
    displayDraft: minor(z.string(), "athlete.displayDraft"),
    /** This regular season's headline averages (PTS, REB, AST, FG%), each with its `displayValue`. */
    statsSummary: minor(
      z.object({
        /** "2026-27 regular season stats" */
        displayName: minor(z.string(), "statsSummary.displayName"),
        statistics: lenientArray(
          z.object({ abbreviation: z.string(), displayValue: z.string() }),
          "statsSummary.statistics",
        ),
      }),
      "athlete.statsSummary",
    ),
  }),
});
export type RawAthlete = z.output<typeof RawAthleteSchema>;

/**
 * Season-by-season stats for one season type (`seasontype=2` regular season, `3` playoffs). Each category
 * ("averages", "totals") has the columns' `names` and one line per season and team, with `stats` in that order, and
 * the career line in `totals`. A player with no playoff games gets the **regular season** for `seasontype=3`: the
 * `seasontype` filter's `value` says which type was sent, and its `options` which types the player has.
 */
export const RawAthleteStatsSchema = z.object({
  filters: lenientArray(
    z.object({
      name: z.string(),
      value: z.string(),
      options: lenientArray(z.object({ value: z.string() }), "filter.options"),
    }),
    "filters",
  ),
  /** By slug ("denver-nuggets"), as each season line names its team. */
  teams: minor(z.record(z.string(), z.object({ shortDisplayName: z.string() })), "teams"),
  categories: z.array(
    z.object({
      name: z.string(),
      names: z.array(z.string()),
      statistics: lenientArray(
        z.object({
          teamSlug: z.string(),
          season: z.object({ displayName: z.string() }),
          stats: z.array(z.string()),
        }),
        "category.statistics",
      ),
      totals: minor(z.array(z.string()), "category.totals"),
    }),
  ),
});
export type RawAthleteStats = z.output<typeof RawAthleteStatsSchema>;

/**
 * Every game this season, by event id in `events` (opponent, home or away, date), with each game's stats in
 * `seasonTypes[].categories[].events[]` in the order of the top-level `names`. Preseason games are a season type of
 * their own.
 */
export const RawGamelogSchema = z.object({
  names: z.array(z.string()),
  events: z.record(
    z.string(),
    z.object({
      id: z.string(),
      atVs: z.string(),
      /** "2026-11-23T00:00:00.000+00:00" */
      gameDate: z.string(),
      opponent: z.object({ abbreviation: z.string().min(1) }),
      team: minor(z.object({ abbreviation: z.string() }), "event.team"),
    }),
  ),
  seasonTypes: lenientArray(
    z.object({
      displayName: z.string(),
      categories: z.array(
        z.object({ events: lenientArray(z.object({ eventId: z.string(), stats: z.array(z.string()) }), "events") }),
      ),
    }),
    "seasonTypes",
  ),
});
export type RawGamelog = z.output<typeof RawGamelogSchema>;
