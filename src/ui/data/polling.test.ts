import { describe, expect, it } from "vitest";
import type { DataMeta } from "../../data";
import { POLL, REFRESH_COOLDOWN_MS, canManualRefresh, combineFetched, nextPollDelay, shouldPoll } from "./polling";

const NOW = Date.parse("2026-11-17T23:00:00Z");

function meta(overrides: Partial<DataMeta> = {}): DataMeta {
  return {
    league: "nhl",
    key: "nhl:scores:2026-11-17",
    source: "network",
    fetchedAt: new Date(NOW).toISOString(),
    staleAt: new Date(NOW + 20_000).toISOString(),
    stale: false,
    warnings: [],
    ...overrides,
  };
}

describe("manual refresh limit", () => {
  const at = (msAgo: number, over: Partial<DataMeta> = {}) =>
    meta({ fetchedAt: new Date(NOW - msAgo).toISOString(), ...over });

  it("ignores a pull when the data on screen is newer than the cooldown", () => {
    expect(canManualRefresh(at(5_000), NOW)).toBe(false);
    expect(canManualRefresh(at(REFRESH_COOLDOWN_MS - 1), NOW)).toBe(false);
  });

  it("allows it once the cooldown has passed", () => {
    expect(canManualRefresh(at(REFRESH_COOLDOWN_MS), NOW)).toBe(true);
    expect(canManualRefresh(at(3 * 86_400_000, { source: "cache" }), NOW)).toBe(true);
  });

  it("always allows it when nothing loaded, or the data is an offline fallback", () => {
    expect(canManualRefresh(undefined, NOW)).toBe(true);
    expect(canManualRefresh(at(1_000, { stale: true, error: "offline", source: "cache" }), NOW)).toBe(true);
  });
});

describe("polling", () => {
  it("polls only the screen shown, with the app in the foreground", () => {
    expect(shouldPoll("active", true)).toBe(true);
    expect(shouldPoll("inactive", true)).toBe(true); // iOS app switcher or a system sheet: still on screen
    expect(shouldPoll("active", false)).toBe(false); // another tab, or a screen pushed on top
    expect(shouldPoll("background", true)).toBe(false);
    expect(shouldPoll(null, true)).toBe(true); // state not known yet at startup
  });

  it("polls just after the data goes stale", () => {
    expect(nextPollDelay(meta(), NOW)).toBe(20_000 + POLL.margin);
  });

  it("never polls faster than the minimum", () => {
    expect(nextPollDelay(meta({ staleAt: new Date(NOW - 5_000).toISOString() }), NOW)).toBe(POLL.minDelay);
  });

  it("caps long TTLs so the timer stays reliable", () => {
    expect(nextPollDelay(meta({ staleAt: new Date(NOW + 7 * 86_400_000).toISOString() }), NOW)).toBe(POLL.maxDelay);
  });

  it("retries on a schedule after a failed refresh, with or without cached data", () => {
    expect(nextPollDelay(undefined, NOW)).toBe(POLL.retry);
    expect(nextPollDelay(meta({ source: "cache", stale: true, error: "offline" }), NOW)).toBe(POLL.retry);
  });

  it("combines results using the most urgent meta", () => {
    const combined = combineFetched([
      { data: "a", meta: meta({ source: "cache", staleAt: new Date(NOW + 60_000).toISOString(), warnings: ["w1"] }) },
      { data: "b", meta: meta({ source: "network", key: "k2", error: "offline", warnings: ["w2"] }) },
    ]);
    expect(combined.data).toEqual(["a", "b"]);
    expect(combined.meta).toMatchObject({
      source: "network",
      staleAt: new Date(NOW + 20_000).toISOString(),
      warnings: ["w1", "w2"],
      error: "offline",
    });
  });
});
