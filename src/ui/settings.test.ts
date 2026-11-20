import { describe, expect, it } from "vitest";
import { MemoryStore, SportsData } from "../data";
import { AdapterRegistry } from "../registry";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  colorSchemeOverride,
  loadSettings,
  parseSettings,
  saveSettings,
} from "./settings";

describe("parseSettings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("has betting off and logos on by default", () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: "system", showLogos: true, showBetting: false });
  });

  it("returns defaults for corrupt JSON or a non-object", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[]")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"dark"')).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and defaults only the bad or missing ones", () => {
    expect(parseSettings(JSON.stringify({ theme: "dark", showLogos: "no" }))).toEqual({
      theme: "dark",
      showLogos: true,
      showBetting: false,
    });
    expect(parseSettings(JSON.stringify({ theme: "purple", showBetting: true }))).toEqual({
      theme: "system",
      showLogos: true,
      showBetting: true,
    });
  });

  it("drops unknown fields", () => {
    expect(parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, old: 1 }))).toEqual(DEFAULT_SETTINGS);
  });
});

describe("loadSettings / saveSettings", () => {
  it("round-trips through a store", async () => {
    const store = new MemoryStore();
    const settings = { theme: "light", showLogos: false, showBetting: true } as const;
    await saveSettings(store, settings);
    expect(await loadSettings(store)).toEqual(settings);
  });

  it("falls back to defaults when the store throws", async () => {
    const store = new MemoryStore();
    store.get = () => Promise.reject(new Error("disk"));
    expect(await loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it("is stored outside the cache, so prune() leaves it alone", async () => {
    const store = new MemoryStore();
    await saveSettings(store, { ...DEFAULT_SETTINGS, theme: "dark" });
    await new SportsData({ registry: new AdapterRegistry(), store }).prune(0);
    expect(await store.get(SETTINGS_KEY)).not.toBeNull();
    expect(SETTINGS_KEY.startsWith("cache:")).toBe(false);
  });
});

describe("colorSchemeOverride", () => {
  it("maps system to auto and passes light/dark through", () => {
    expect(colorSchemeOverride("system")).toBe("auto");
    expect(colorSchemeOverride("light")).toBe("light");
    expect(colorSchemeOverride("dark")).toBe("dark");
  });
});
