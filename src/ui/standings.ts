// Pure helpers for the Standings tab (no React Native imports; tested in standings.test.ts).
import type { StandingRow, Standings } from "../domain";

export const STANDINGS_VIEWS = ["division", "conference", "wildcard", "league"] as const;
export type StandingsView = (typeof STANDINGS_VIEWS)[number];

export const STANDINGS_VIEW_LABELS: Record<StandingsView, string> = {
  division: "Division",
  conference: "Conference",
  wildcard: "Wild card",
  league: "League",
};

/** The column row's title in views with no division under the heading (Conference, League). */
export const GROUPLESS_TITLE = "Team";

export interface StandingsItem {
  row: StandingRow;
  /** Position within the section it is shown in. */
  rank: number;
}

export interface StandingsSection {
  key: string;
  title: string;
  /**
   * The accent heading drawn above this section: the conference, on the first division of each conference (and on
   * each conference in Conference view), or "League" in League view.
   */
  conference?: string;
  /** Wild card view: the playoff line is drawn below this many rows of the section. */
  playoffLine?: number;
  data: StandingsItem[];
}

const byName = (a: string | undefined, b: string | undefined) => {
  // Rows with no conference go last.
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b);
};

/** Every row, best first: by the league's own order when it gives one, else by points (ties keep their order). */
export function leagueOrder(standings: Standings): StandingRow[] {
  const rows = standings.groups.flatMap((g) => g.rows);
  if (rows.every((r) => r.leagueRank !== undefined)) {
    return [...rows].sort((a, b) => a.leagueRank! - b.leagueRank!);
  }
  return [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

/**
 * The views worth offering: Conference only if the league has conferences, Wild card only if it also has wild cards,
 * League only if there is more than one group.
 */
export function availableStandingsViews(standings: Standings | undefined): StandingsView[] {
  const rows = standings?.groups.flatMap((g) => g.rows) ?? [];
  const views: StandingsView[] = ["division"];
  const hasConferences = rows.some((r) => r.conferenceName);
  if (hasConferences) views.push("conference");
  if (hasConferences && standings?.wildCardSpots && rows.some((r) => r.wildCardRank !== undefined)) {
    views.push("wildcard");
  }
  if ((standings?.groups.length ?? 0) > 1) views.push("league");
  return views;
}

/** The chosen view, or Division when the chosen one is not available for these standings. */
export function effectiveStandingsView(standings: Standings | undefined, chosen: StandingsView): StandingsView {
  return availableStandingsViews(standings).includes(chosen) ? chosen : "division";
}

/**
 * The sections the Standings list shows.
 * - division: each division, grouped under its conference (conferences and their divisions in alphabetical order:
 *   Eastern then Western, Atlantic then Metropolitan). Leagues without conferences keep the adapter's group order.
 * - conference: one section per conference, ranked within it.
 * - wildcard: per conference, each division's playoff spots (teams with no `wildCardRank`), then a "Wild card"
 *   section of the rest in the league's wild card order, with the playoff line after `wildCardSpots` teams.
 * - league: one section with every team.
 */
export function standingsSections(standings: Standings | undefined, view: StandingsView): StandingsSection[] {
  if (!standings) return [];

  if (view === "league") {
    // The same two levels as Division view: an accent heading, then the column row (here just "Team").
    return [
      {
        key: "league",
        conference: "League",
        title: GROUPLESS_TITLE,
        data: leagueOrder(standings).map((row, i) => ({ row, rank: i + 1 })),
      },
    ];
  }

  if (view === "conference") {
    const conferences = new Map<string | undefined, StandingRow[]>();
    for (const row of leagueOrder(standings)) {
      const rows = conferences.get(row.conferenceName) ?? [];
      rows.push(row);
      conferences.set(row.conferenceName, rows);
    }
    return [...conferences.entries()]
      .sort(([a], [b]) => byName(a, b))
      .map(([name, rows]) => ({
        key: `conference:${name ?? "other"}`,
        // The conference is the accent heading, as in Division and Wild card views; teams with none are "Other".
        ...(name ? { conference: name, title: GROUPLESS_TITLE } : { title: "Other" }),
        data: rows.map((row, i) => ({ row, rank: i + 1 })),
      }));
  }

  if (view === "wildcard") return wildCardSections(standings);

  const divisions = standings.groups.map((g) => ({
    key: `division:${g.name}`,
    title: g.name,
    // Every team in a division shares its conference; take the first one that names it.
    conferenceName: g.rows.find((r) => r.conferenceName)?.conferenceName,
    data: g.rows.map((row) => ({ row, rank: row.rank })),
  }));
  if (divisions.every((d) => d.conferenceName === undefined)) {
    return divisions.map(({ conferenceName: _, ...d }) => d);
  }
  divisions.sort((a, b) => byName(a.conferenceName, b.conferenceName) || a.title.localeCompare(b.title));
  return divisions.map(({ conferenceName, ...d }, i) => ({
    ...d,
    ...(conferenceName && conferenceName !== divisions[i - 1]?.conferenceName ? { conference: conferenceName } : {}),
  }));
}

function wildCardSections(standings: Standings): StandingsSection[] {
  const conferences = new Map<string | undefined, { divisions: Map<string, StandingRow[]>; race: StandingRow[] }>();
  for (const group of standings.groups) {
    for (const row of group.rows) {
      let conference = conferences.get(row.conferenceName);
      if (!conference) {
        conference = { divisions: new Map(), race: [] };
        conferences.set(row.conferenceName, conference);
      }
      if (row.wildCardRank !== undefined) {
        conference.race.push(row);
      } else {
        const name = row.divisionName ?? group.name;
        conference.divisions.set(name, [...(conference.divisions.get(name) ?? []), row]);
      }
    }
  }

  return [...conferences.entries()]
    .sort(([a], [b]) => byName(a, b))
    .flatMap(([name, { divisions, race }]) => {
      const id = name ?? "other";
      const sections: StandingsSection[] = [...divisions.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([division, rows]) => ({
          key: `wildcard:${id}:${division}`,
          title: division,
          data: [...rows].sort((a, b) => a.rank - b.rank).map((row) => ({ row, rank: row.rank })),
        }));
      if (race.length > 0) {
        sections.push({
          key: `wildcard:${id}`,
          title: "Wild card",
          playoffLine: standings.wildCardSpots,
          data: [...race]
            .sort((a, b) => a.wildCardRank! - b.wildCardRank!)
            .map((row) => ({ row, rank: row.wildCardRank! })),
        });
      }
      if (name && sections.length > 0) sections[0] = { ...sections[0], conference: name };
      return sections;
    });
}
