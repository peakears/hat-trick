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
  type Settings,
} from "./settings";

describe("parseSettings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("has betting off, logos on, no favourite teams, reminders off and update checks on by default", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: "system",
      showLogos: true,
      showBetting: false,
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      checkForUpdates: true,
    });
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
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      checkForUpdates: true,
    });
    expect(parseSettings(JSON.stringify({ theme: "purple", showBetting: true }))).toEqual({
      theme: "system",
      showLogos: true,
      showBetting: true,
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      checkForUpdates: true,
    });
  });

  it("keeps a valid reminder lead and defaults an unknown one to 30 minutes", () => {
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: 60 })).reminderLeadMinutes).toBe(60);
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: 7 })).reminderLeadMinutes).toBe(30);
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: "15" })).reminderLeadMinutes).toBe(30);
  });

  it("keeps stored favourite teams, drops duplicates, and defaults a bad value to none", () => {
    expect(parseSettings(JSON.stringify({ favoriteTeams: ["TOR", "MTL", "TOR"] })).favoriteTeams).toEqual([
      "TOR",
      "MTL",
    ]);
    expect(parseSettings(JSON.stringify({ favoriteTeams: "TOR" })).favoriteTeams).toEqual([]);
    expect(parseSettings(JSON.stringify({ favoriteTeams: ["TOR", 7] })).favoriteTeams).toEqual([]);
  });

  it("drops unknown fields", () => {
    expect(parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, old: 1 }))).toEqual(DEFAULT_SETTINGS);
  });
});

describe("loadSettings / saveSettings", () => {
  it("round-trips through a store", async () => {
    const store = new MemoryStore();
    const settings: Settings = {
      theme: "light",
      showLogos: false,
      showBetting: true,
      favoriteTeams: ["TOR"],
      remindersEnabled: true,
      reminderLeadMinutes: 15,
      checkForUpdates: false,
    };
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
