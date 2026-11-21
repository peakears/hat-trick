// Pure helpers for the Standings tab (no React Native imports; tested in standings.test.ts).
import type { StandingRow, Standings } from "../domain";

export const STANDINGS_VIEWS = ["division", "conference", "league"] as const;
export type StandingsView = (typeof STANDINGS_VIEWS)[number];

export const STANDINGS_VIEW_LABELS: Record<StandingsView, string> = {
  division: "Division",
  conference: "Conference",
  league: "League",
};

export interface StandingsItem {
  row: StandingRow;
  /** Position within the section it is shown in. */
  rank: number;
}

export interface StandingsSection {
  key: string;
  title: string;
  /** A conference heading drawn above this section: set on the first division of each conference. */
  conference?: string;
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

/** The views worth offering: Conference only if the league has conferences, League only if there is more than one group. */
export function availableStandingsViews(standings: Standings | undefined): StandingsView[] {
  const rows = standings?.groups.flatMap((g) => g.rows) ?? [];
  const views: StandingsView[] = ["division"];
  if (rows.some((r) => r.conferenceName)) views.push("conference");
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
 * - league: one section with every team.
 */
export function standingsSections(standings: Standings | undefined, view: StandingsView): StandingsSection[] {
  if (!standings) return [];

  if (view === "league") {
    return [{ key: "league", title: "League", data: leagueOrder(standings).map((row, i) => ({ row, rank: i + 1 })) }];
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
        title: name ?? "Other",
        data: rows.map((row, i) => ({ row, rank: i + 1 })),
      }));
  }

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
