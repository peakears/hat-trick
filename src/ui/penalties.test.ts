import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapGoals, mapPenalties } from "../adapters/nhl/mappers";
import { RawLandingSchema, RawScoreResponseSchema } from "../adapters/nhl/raw-types";
import type { Goal, Penalty } from "../domain";
import {
  groupPenaltiesByPeriod,
  penaltyDetailLabel,
  penaltyLengthLabel,
  penaltyMinutesByTeam,
  penaltyPlayerLabel,
  powerPlayGoals,
} from "./penalties";

const fixture = (file: string) =>
  JSON.parse(readFileSync(new URL(`../adapters/nhl/__fixtures__/${file}`, import.meta.url), "utf8"));

// TOR @ CHI on 2026-11-17: Chicago scored two power-play goals, after Rielly's and Matthews' penalties.
const penalties = mapPenalties(RawLandingSchema.parse(fixture("landing-2026020338-final.json")).summary!.penalties)!;
const scores = RawScoreResponseSchema.parse(fixture("score-2026-11-17.json"));
const goals = mapGoals(scores.games!.find((g) => g.id === 2026020338)!.goals)!;

const penalty = (over: Partial<Penalty>): Penalty => ({
  teamId: "TOR",
  period: 1,
  periodLabel: "1st",
  time: "10:00",
  player: "A. Player",
  infraction: "Hooking",
  kind: "minor",
  minutes: 2,
  ...over,
});
const goal = (over: Partial<Goal>): Goal => ({
  teamId: "CHI",
  period: 1,
  periodLabel: "1st",
  time: "11:00",
  scorer: { id: "1", league: "nhl", name: "B. Scorer" },
  assists: [],
  strength: "powerPlay",
  emptyNet: false,
  penaltyShot: false,
  ...over,
});

describe("penalty summary", () => {
  it("groups by period in the order taken", () => {
    expect(groupPenaltiesByPeriod(penalties).map((p) => [p.label, p.penalties.length])).toEqual([
      ["1st", 2],
      ["2nd", 2],
      ["3rd", 2],
    ]);
  });

  it("totals penalty minutes per team", () => {
    expect(penaltyMinutesByTeam(penalties, ["TOR", "CHI"])).toEqual([
      { teamId: "TOR", minutes: 6 },
      { teamId: "CHI", minutes: 6 },
    ]);
  });

  it("labels the player, infraction and length", () => {
    expect(penaltyPlayerLabel(penalties[0])).toBe("T. Blueger");
    expect(penaltyDetailLabel(penalties[0])).toBe("Interference · drawn by W. Kaiser");
    expect(penaltyDetailLabel(penalties[1])).toBe("Delay of game (puck over glass)");
    expect(penaltyLengthLabel(penalties[0])).toBe("2 min");
    expect(penaltyLengthLabel(penalty({ kind: "penaltyShot", minutes: 0 }))).toBe("Penalty shot");
    expect(penaltyPlayerLabel(penalty({ player: undefined }))).toBe("Bench");
  });

  it("matches the recorded power-play goals to the penalties that led to them", () => {
    const matched = powerPlayGoals(penalties, goals).map((g, i) =>
      g ? `${penalties[i].player} -> ${g.scorer.name} ${g.time}` : undefined,
    );
    expect(matched).toEqual([
      undefined,
      undefined,
      undefined,
      "M. Rielly -> F. Nazar 13:17",
      "A. Matthews -> T. Bertuzzi 09:07",
      undefined,
    ]);
  });

  it("only matches the other team's power-play goals while the penalty runs", () => {
    const p = [penalty({})];
    expect(powerPlayGoals(p, [goal({ time: "12:00" })])).toHaveLength(1);
    expect(powerPlayGoals(p, [goal({ time: "12:00" })])[0]).toBeDefined();
    expect(powerPlayGoals(p, [goal({ time: "12:01" })])[0]).toBeUndefined(); // too late
    expect(powerPlayGoals(p, [goal({ time: "10:00" })])[0]).toBeUndefined(); // same second as the call
    expect(powerPlayGoals(p, [goal({ strength: "even" })])[0]).toBeUndefined();
    expect(powerPlayGoals(p, [goal({ teamId: "TOR" })])[0]).toBeUndefined();
    expect(powerPlayGoals([penalty({ kind: "misconduct", minutes: 10 })], [goal({})])[0]).toBeUndefined();
    expect(powerPlayGoals(p, undefined)).toEqual([undefined]);
  });

  it("follows a penalty into the next period and gives each goal to one penalty", () => {
    const late = penalty({ time: "19:30" });
    expect(powerPlayGoals([late], [goal({ period: 2, periodLabel: "2nd", time: "01:00" })])[0]).toBeDefined();
    // Two penalties at once: the first goal ends the first penalty, the second the other.
    const two = [penalty({}), penalty({ time: "10:30" })];
    const result = powerPlayGoals(two, [goal({ time: "10:40" }), goal({ time: "11:10" })]);
    expect(result.map((g) => g?.time)).toEqual(["10:40", "11:10"]);
  });
});
