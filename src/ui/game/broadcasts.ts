import type { Broadcast, BroadcastMarket, Game, GameStatus } from "../../domain";

/**
 * Which TV channels to show for a game. Pure module: no React Native imports, so it is unit tested.
 * The league lists channels for several countries; the user only gets the ones for their own.
 */

/** "auto" follows the phone's region; the others are a manual override (travelling, VPN, wrong phone region). */
export const TV_REGIONS = ["auto", "CA", "US"] as const;
export type TvRegionPreference = (typeof TV_REGIONS)[number];

/** How many channels fit on a Scores card before the rest collapse into "+N". */
export const MAX_CARD_CHANNELS = 3;

export interface Channel {
  network: string;
  market: BroadcastMarket;
  /** Abbreviation of the team a home or away feed belongs to, e.g. "FLA". Absent for national channels. */
  teamAbbrev?: string;
}

/**
 * Whether a Scores card shows channels: only before and during a game. Once it is over (or called
 * off) they are noise; the game page still lists where it aired.
 */
export function showsChannelsOnCard(status: GameStatus): boolean {
  return status === "scheduled" || status === "live";
}

/** The country code to filter by: the manual choice, or the phone's region, or none when unknown. */
export function resolveRegion(preference: TvRegionPreference, deviceRegion: string | null | undefined): string | null {
  if (preference !== "auto") return preference;
  const region = deviceRegion?.trim().toUpperCase();
  return region ? region : null;
}

const MARKET_ORDER: Record<BroadcastMarket, number> = { national: 0, home: 1, away: 2 };

/**
 * The channels for one country: national first, then the home and away feeds, each in the league's order.
 * A network listed twice (say national and regional) appears once, in its first and most general slot.
 */
export function channelsFor(game: Pick<Game, "broadcasts" | "home" | "away">, region: string | null): Channel[] {
  if (!region || !game.broadcasts) return [];
  const inRegion = game.broadcasts.filter((b: Broadcast) => b.country === region);
  const sorted = inRegion
    .map((b, index) => ({ b, index }))
    .sort((x, y) => MARKET_ORDER[x.b.market] - MARKET_ORDER[y.b.market] || x.index - y.index);
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const { b } of sorted) {
    const key = b.network.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      network: b.network,
      market: b.market,
      teamAbbrev: b.market === "national" ? undefined : game[b.market].team.abbrev,
    });
  }
  return out;
}

/** The first few channels for a Scores card, and how many were left out. */
export function summarizeChannels(
  channels: Channel[],
  max: number = MAX_CARD_CHANNELS,
): { shown: Channel[]; more: number } {
  return { shown: channels.slice(0, max), more: Math.max(0, channels.length - max) };
}

/** What the TV line is called for screen readers: where it aired once over, where to watch before and during. */
export function watchHeading(status: GameStatus): string {
  return status === "final" ? "Aired on" : "Where to watch";
}

/** Plain text for screen readers and tests: "SN, TVAS, SCRIPPS (FLA)". */
export function channelsLabel(channels: Channel[]): string {
  return channels.map((c) => (c.teamAbbrev ? `${c.network} (${c.teamAbbrev})` : c.network)).join(", ");
}
