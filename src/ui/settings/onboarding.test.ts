import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapStandings } from "../../adapters/nhl/mappers";
import { RawStandingsResponseSchema } from "../../adapters/nhl/raw-types";
import type { Standings } from "../../domain";
import {
  ONBOARDING_STEPS,
  followedLeagues,
  leaguesSentence,
  liveHint,
  nextStep,
  previousStep,
  reminderHint,
  shouldShowOnboarding,
  stepProgress,
  stepsFor,
  teamsByDivision,
  toggleFollowedLeague,
} from "./onboarding";

// The recorded NHL standings (2026-11-17), through the real mapper.
const nhl: Standings = mapStandings(
  RawStandingsResponseSchema.parse(
    JSON.parse(readFileSync(new URL("../../adapters/nhl/__fixtures__/standings-now.json", import.meta.url), "utf8")),
  ),
);

describe("steps", () => {
  it("starts with the welcome page and ends with done", () => {
    expect(ONBOARDING_STEPS[0]).toBe("welcome");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe("done");
  });

  it("walks forward and back through every step", () => {
    const forward = [];
    for (let s: (typeof ONBOARDING_STEPS)[number] | null = "welcome"; s; s = nextStep(s)) forward.push(s);
    expect(forward).toEqual([...ONBOARDING_STEPS]);
    expect(previousStep("welcome")).toBeNull();
    expect(previousStep("teams")).toBe("leagues");
    expect(nextStep("done")).toBeNull();
  });

  it("skips the league step when the app has a single league", () => {
    const one = stepsFor(1);
    expect(one).toEqual(["welcome", "teams", "look", "options", "done"]);
    expect(nextStep("welcome", one)).toBe("teams");
    expect(previousStep("teams", one)).toBe("welcome");
    expect(stepsFor(2)).toEqual([...ONBOARDING_STEPS]);
  });

  it("counts progress only over the steps with choices", () => {
    expect(stepProgress("welcome")).toBeNull();
    expect(stepProgress("done")).toBeNull();
    expect(stepProgress("leagues")).toEqual({ index: 0, total: 4 });
    expect(stepProgress("options")).toEqual({ index: 3, total: 4 });
    expect(stepProgress("teams", stepsFor(1))).toEqual({ index: 0, total: 3 });
  });
});

describe("shouldShowOnboarding", () => {
  it("waits for settings to load, then shows only until setup is done", () => {
    expect(shouldShowOnboarding(false, false)).toBe(false);
    expect(shouldShowOnboarding(true, false)).toBe(true);
    expect(shouldShowOnboarding(true, true)).toBe(false);
  });
});

describe("reminderHint", () => {
  it("asks for a favourite first, and explains a refused permission", () => {
    expect(reminderHint(0, false)).toMatch(/favourite team first/);
    expect(reminderHint(1, false)).toBe("A notification before your team's games.");
    expect(reminderHint(3, false)).toBe("A notification before your 3 teams' games.");
    expect(reminderHint(2, true)).toMatch(/blocked/);
  });
});

describe("teamsByDivision", () => {
  it("lists all 32 NHL teams once, in their divisions, Eastern first", () => {
    const groups = teamsByDivision(nhl);
    expect(groups.map((g) => [g.conference, g.title])).toEqual([
      ["Eastern Conference", "Atlantic"],
      ["Eastern Conference", "Metropolitan"],
      ["Western Conference", "Central"],
      ["Western Conference", "Pacific"],
    ]);
    const ids = groups.flatMap((g) => g.teams.map((t) => t.id));
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it("sorts teams A to Z within a division", () => {
    for (const g of teamsByDivision(nhl)) {
      const names = g.teams.map((t) => t.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  it("uses the group name for a league without divisions, and is empty with no standings", () => {
    const team = (id: string) => ({ id, league: "test", name: id, abbrev: id });
    const row = (id: string) => ({ team: team(id), rank: 1, gamesPlayed: 0, wins: 0, losses: 0 });
    const plain: Standings = {
      league: "test",
      updatedAt: "2026-11-21T00:00:00Z",
      groups: [
        { name: "South", rows: [row("ZZZ"), row("BBB")] },
        { name: "North", rows: [row("AAA"), row("BBB")] },
      ],
    };
    expect(teamsByDivision(plain).map((g) => [g.title, g.teams.map((t) => t.id)])).toEqual([
      ["North", ["AAA"]],
      ["South", ["BBB", "ZZZ"]],
    ]);
    expect(teamsByDivision(undefined)).toEqual([]);
  });
});

describe("leagues", () => {
  const both = ["nhl", "nba"];

  it("names the app's leagues in the welcome text", () => {
    expect(leaguesSentence(["NHL"])).toBe("NHL");
    expect(leaguesSentence(["NHL", "NBA"])).toBe("NHL and NBA");
    expect(leaguesSentence(["NHL", "NBA", "MLB"])).toBe("NHL, NBA and MLB");
  });

  it("shows every league as followed while Scores shows All, else the one it shows", () => {
    expect(followedLeagues({ scoresAllLeagues: true }, "nhl", both)).toEqual(both);
    expect(followedLeagues({ scoresAllLeagues: false }, "nba", both)).toEqual(["nba"]);
  });

  it("turns All on with more than one league, off with one, and never leaves none", () => {
    // Following the NHL alone, tap the NBA: both, so All.
    expect(toggleFollowedLeague(["nhl"], "nba", both, "nhl")).toEqual({ league: "nhl", scoresAllLeagues: true });
    // Following both, drop the NHL: the NBA alone, and the tabs move to it.
    expect(toggleFollowedLeague(both, "nhl", both, "nhl")).toEqual({ league: "nba", scoresAllLeagues: false });
    // The last one cannot be turned off.
    expect(toggleFollowedLeague(["nba"], "nba", both, "nba")).toEqual({ league: "nba", scoresAllLeagues: false });
  });

  it("explains the live scores switch: the installed app, the permission, a favourite first", () => {
    expect(liveHint(2, false, false)).toMatch(/installed Android app/);
    expect(liveHint(2, true, true)).toMatch(/blocked/);
    expect(liveHint(0, true, false)).toMatch(/favourite team first/);
    expect(liveHint(1, true, false)).toMatch(/scoring alerts/);
  });
});
