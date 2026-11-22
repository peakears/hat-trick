// An on-device log of API problems (adapter warnings and failed requests), shown in Settings › Diagnostics and
// shared only when the user chooses to. League-agnostic: it never sees raw API shapes.

import type { LeagueId } from "../domain";
import type { KeyValueStore } from "./store";

/** Stored outside the `cache:` prefix, so `prune()` and CACHE_VERSION bumps never clear it. */
export const LOG_KEY = "diagnostics:v1";
/** Entries kept; the oldest are dropped first. */
export const LOG_MAX = 200;

export interface LogEntry {
  kind: "warning" | "error";
  league: LeagueId;
  /** The cache key of the request ("nhl:scores:2026-11-17"). */
  key: string;
  url?: string;
  message: string;
  /** Times the same problem was seen, folded into this one entry. */
  count: number;
  firstAt: number;
  lastAt: number;
}

export type NewLogEntry = Pick<LogEntry, "kind" | "league" | "key" | "url" | "message">;

const sameProblem = (a: NewLogEntry, b: NewLogEntry) =>
  a.kind === b.kind && a.key === b.key && a.url === b.url && a.message === b.message;

/**
 * The log with `add` recorded at `now`, newest first. A problem already in the log is folded into its entry (count
 * up, moved to the top), so a drifted field polled every 20 seconds is one line, not hundreds. Pure.
 */
export function addToLog(entries: LogEntry[], add: NewLogEntry, now: number, max = LOG_MAX): LogEntry[] {
  const existing = entries.find((e) => sameProblem(e, add));
  const entry: LogEntry = existing
    ? { ...existing, count: existing.count + 1, lastAt: now }
    : { ...add, count: 1, firstAt: now, lastAt: now };
  return [entry, ...entries.filter((e) => e !== existing)].slice(0, max);
}

/** Reads a stored log, dropping anything that does not look like an entry. Pure. */
export function parseLog(text: string | null): LogEntry[] {
  if (!text) return [];
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (e): e is LogEntry =>
        typeof e === "object" &&
        e !== null &&
        (e.kind === "warning" || e.kind === "error") &&
        typeof e.key === "string" &&
        typeof e.message === "string" &&
        typeof e.count === "number" &&
        typeof e.lastAt === "number",
    );
  } catch {
    return [];
  }
}

/**
 * The log, kept in memory after the first read and written back after each change. Writes run one after another,
 * so problems recorded at the same moment are never lost. Storage failures are ignored: the log is a debugging aid
 * and must never break loading data.
 */
export class DiagnosticsLog {
  private entries: LogEntry[] | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(entries: LogEntry[]) => void>();

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a problem. Resolves once it is written; callers that must not wait can ignore the promise. */
  record(add: NewLogEntry): Promise<void> {
    return this.change((entries) => addToLog(entries, add, this.now()));
  }

  clear(): Promise<void> {
    return this.change(() => []);
  }

  /** The log, newest first. */
  async list(): Promise<LogEntry[]> {
    await this.queue;
    return this.load();
  }

  /** Calls `listener` with the new log after every change. Returns the unsubscribe function. */
  subscribe(listener: (entries: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private change(update: (entries: LogEntry[]) => LogEntry[]): Promise<void> {
    this.queue = this.queue.then(async () => {
      const next = update(await this.load());
      this.entries = next;
      try {
        await this.store.set(LOG_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable: keep the log in memory for this session.
      }
      for (const listener of this.listeners) listener(next);
    });
    return this.queue;
  }

  private async load(): Promise<LogEntry[]> {
    if (this.entries) return this.entries;
    try {
      this.entries = parseLog(await this.store.get(LOG_KEY));
    } catch {
      this.entries = [];
    }
    return this.entries;
  }
}
