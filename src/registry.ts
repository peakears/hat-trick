import type { LeagueAdapter, LeagueId } from "./domain";

export class AdapterRegistry {
  private adapters = new Map<LeagueId, LeagueAdapter>();

  register(adapter: LeagueAdapter): void {
    this.adapters.set(adapter.league, adapter);
  }

  get(league: LeagueId): LeagueAdapter {
    const adapter = this.adapters.get(league);
    if (!adapter) throw new Error(`Unknown league: ${league}`);
    return adapter;
  }

  leagues(): LeagueId[] {
    return [...this.adapters.keys()];
  }
}
