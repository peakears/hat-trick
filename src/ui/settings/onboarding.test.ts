import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapStandings } from "../../adapters/nhl/mappers";
import { RawStandingsResponseSchema } from "../../adapters/nhl/raw-types";
import type { Standings } from "../../domain";
import {
  ONBOARDING_STEPS,
  nextStep,
  previousStep,
  reminderHint,
  shouldShowOnboarding,
  stepProgress,
  teamsByDivision,
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
    expect(previousStep("teams")).toBe("welcome");
    expect(nextStep("done")).toBeNull();
  });

  it("counts progress only over the steps with choices", () => {
    expect(stepProgress("welcome")).toBeNull();
    expect(stepProgress("done")).toBeNull();
    expect(stepProgress("teams")).toEqual({ index: 0, total: 3 });
    expect(stepProgress("options")).toEqual({ index: 2, total: 3 });
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
