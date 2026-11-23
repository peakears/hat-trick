import { describe, expect, it } from "vitest";
import { MemoryStore, SportsData } from "../../data";
import { AdapterRegistry } from "../../registry";
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

  it("has betting off, logos on, no favourite teams, reminders off, update checks on and TV region auto by default", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: "system",
      pureBlack: false,
      accent: "blue",
      showLogos: true,
      showBetting: false,
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      liveScores: false,
      goalAlerts: true,
      checkForUpdates: true,
      tvRegion: "auto",
      spoilerShield: false,
      standingsView: "division",
      onboardingComplete: false,
      league: "nhl",
    });
  });

  it("returns defaults for corrupt JSON or a non-object, with setup done (something was stored)", () => {
    const returning = { ...DEFAULT_SETTINGS, onboardingComplete: true };
    expect(parseSettings("{not json")).toEqual(returning);
    expect(parseSettings("[]")).toEqual(returning);
    expect(parseSettings("null")).toEqual(returning);
    expect(parseSettings('"dark"')).toEqual(returning);
  });

  it("treats stored settings from before first-run setup as having done it", () => {
    expect(parseSettings(JSON.stringify({ theme: "dark" })).onboardingComplete).toBe(true);
    expect(parseSettings(JSON.stringify({ onboardingComplete: "no" })).onboardingComplete).toBe(true);
    expect(parseSettings(JSON.stringify({ onboardingComplete: false })).onboardingComplete).toBe(false);
    expect(parseSettings(null).onboardingComplete).toBe(false);
  });

  it("keeps valid fields and defaults only the bad or missing ones", () => {
    expect(parseSettings(JSON.stringify({ theme: "dark", showLogos: "no" }))).toEqual({
      theme: "dark",
      pureBlack: false,
      accent: "blue",
      showLogos: true,
      showBetting: false,
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      liveScores: false,
      goalAlerts: true,
      checkForUpdates: true,
      tvRegion: "auto",
      spoilerShield: false,
      standingsView: "division",
      onboardingComplete: true,
      league: "nhl",
    });
    expect(parseSettings(JSON.stringify({ theme: "purple", showBetting: true }))).toEqual({
      theme: "system",
      pureBlack: false,
      accent: "blue",
      showLogos: true,
      showBetting: true,
      favoriteTeams: [],
      remindersEnabled: false,
      reminderLeadMinutes: 30,
      liveScores: false,
      goalAlerts: true,
      checkForUpdates: true,
      tvRegion: "auto",
      spoilerShield: false,
      standingsView: "division",
      onboardingComplete: true,
      league: "nhl",
    });
  });

  it("keeps pure black and the accent, and defaults unknown values", () => {
    expect(parseSettings(JSON.stringify({ pureBlack: true, accent: "teal" }))).toMatchObject({
      pureBlack: true,
      accent: "teal",
    });
    expect(parseSettings(JSON.stringify({ pureBlack: "yes", accent: "chartreuse" }))).toMatchObject({
      pureBlack: false,
      accent: "blue",
    });
  });

  it("keeps a valid reminder lead and defaults an unknown one to 30 minutes", () => {
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: 60 })).reminderLeadMinutes).toBe(60);
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: 7 })).reminderLeadMinutes).toBe(30);
    expect(parseSettings(JSON.stringify({ reminderLeadMinutes: "15" })).reminderLeadMinutes).toBe(30);
    expect(parseSettings(JSON.stringify({ liveScores: "yes", goalAlerts: 0 }))).toMatchObject({
      liveScores: false,
      goalAlerts: true,
    });
  });

  it("keeps stored favourite teams, drops duplicates, and defaults a bad value to none", () => {
    expect(parseSettings(JSON.stringify({ favoriteTeams: ["TOR", "MTL", "TOR"] })).favoriteTeams).toEqual([
      "TOR",
      "MTL",
    ]);
    expect(parseSettings(JSON.stringify({ favoriteTeams: "TOR" })).favoriteTeams).toEqual([]);
    expect(parseSettings(JSON.stringify({ favoriteTeams: ["TOR", 7] })).favoriteTeams).toEqual([]);
  });

  it("keeps a valid TV region and defaults an unknown one to auto", () => {
    expect(DEFAULT_SETTINGS.tvRegion).toBe("auto");
    expect(parseSettings(JSON.stringify({ tvRegion: "CA" })).tvRegion).toBe("CA");
    expect(parseSettings(JSON.stringify({ tvRegion: "US" })).tvRegion).toBe("US");
    expect(parseSettings(JSON.stringify({ tvRegion: "GB" })).tvRegion).toBe("auto");
    expect(parseSettings(JSON.stringify({ tvRegion: 1 })).tvRegion).toBe("auto");
  });

  it("has the spoiler shield off by default and keeps a stored value", () => {
    expect(DEFAULT_SETTINGS.spoilerShield).toBe(false);
    expect(parseSettings(JSON.stringify({ spoilerShield: true })).spoilerShield).toBe(true);
    expect(parseSettings(JSON.stringify({ spoilerShield: "yes" })).spoilerShield).toBe(false);
  });

  it("defaults the standings view to Division and keeps a stored one", () => {
    expect(parseSettings(JSON.stringify({ standingsView: "league" })).standingsView).toBe("league");
    expect(parseSettings(JSON.stringify({ standingsView: "wild" })).standingsView).toBe("division");
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
      pureBlack: true,
      accent: "purple",
      showLogos: false,
      showBetting: true,
      favoriteTeams: ["TOR"],
      remindersEnabled: true,
      reminderLeadMinutes: 15,
      liveScores: true,
      goalAlerts: false,
      checkForUpdates: false,
      tvRegion: "CA",
      spoilerShield: true,
      standingsView: "conference",
      onboardingComplete: true,
      league: "nba",
    };
    await saveSettings(store, settings);
    expect(await loadSettings(store)).toEqual(settings);
  });

  it("falls back to defaults, with setup done, when the store throws", async () => {
    const store = new MemoryStore();
    store.get = () => Promise.reject(new Error("disk"));
    expect(await loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, onboardingComplete: true });
  });

  it("shows first-run setup only on a fresh install", async () => {
    expect((await loadSettings(new MemoryStore())).onboardingComplete).toBe(false);
  });

  it("skips first-run setup for someone who used the app but never changed a setting", async () => {
    const store = new MemoryStore();
    await store.set("cache:v3:standings", "{}");
    expect(await loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, onboardingComplete: true });
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
