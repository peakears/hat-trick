import { describe, expect, it } from "vitest";
import type { Broadcast, Game } from "../domain";
import {
  channelsFor,
  channelsLabel,
  resolveRegion,
  showsChannelsOnCard,
  summarizeChannels,
  watchHeading,
} from "./broadcasts";

const team = (abbrev: string) => ({ id: abbrev, league: "nhl", name: abbrev, abbrev });

function game(broadcasts?: Broadcast[]): Pick<Game, "broadcasts" | "home" | "away"> {
  return { broadcasts, home: { team: team("FLA"), score: null }, away: { team: team("EDM"), score: null } };
}

const b = (network: string, country: string, market: Broadcast["market"]): Broadcast => ({ network, country, market });

describe("resolveRegion", () => {
  it("uses the manual choice over the phone's region", () => {
    expect(resolveRegion("CA", "US")).toBe("CA");
    expect(resolveRegion("US", null)).toBe("US");
  });

  it("follows the phone's region in auto, upper-cased", () => {
    expect(resolveRegion("auto", "CA")).toBe("CA");
    expect(resolveRegion("auto", "us")).toBe("US");
  });

  it("is null when auto and the phone has no region", () => {
    expect(resolveRegion("auto", null)).toBeNull();
    expect(resolveRegion("auto", undefined)).toBeNull();
    expect(resolveRegion("auto", " ")).toBeNull();
  });
});

describe("channelsFor", () => {
  const g = game([
    b("SCRIPPS", "US", "home"),
    b("SN", "CA", "national"),
    b("RDS", "CA", "away"),
    b("TVAS", "CA", "national"),
    b("TSN3", "CA", "home"),
    b("ESPN+", "US", "national"),
  ]);

  it("keeps only the user's country, national first, then home, then away", () => {
    expect(channelsFor(g, "CA")).toEqual([
      { network: "SN", market: "national", teamAbbrev: undefined },
      { network: "TVAS", market: "national", teamAbbrev: undefined },
      { network: "TSN3", market: "home", teamAbbrev: "FLA" },
      { network: "RDS", market: "away", teamAbbrev: "EDM" },
    ]);
    expect(channelsFor(g, "US").map((c) => c.network)).toEqual(["ESPN+", "SCRIPPS"]);
  });

  it("lists a network once, in its most general slot", () => {
    const twice = game([b("TNT", "US", "home"), b("TNT", "US", "national"), b("tnt", "US", "away")]);
    expect(channelsFor(twice, "US")).toEqual([{ network: "TNT", market: "national", teamAbbrev: undefined }]);
  });

  it("is empty with no region, no broadcasts, or none for that country", () => {
    expect(channelsFor(g, null)).toEqual([]);
    expect(channelsFor(game(undefined), "CA")).toEqual([]);
    expect(channelsFor(game([]), "CA")).toEqual([]);
    expect(channelsFor(game([b("TNT", "US", "national")]), "CA")).toEqual([]);
    expect(channelsFor(g, "GB")).toEqual([]);
  });
});

describe("showsChannelsOnCard", () => {
  it("shows channels before and during a game only", () => {
    expect(showsChannelsOnCard("scheduled")).toBe(true);
    expect(showsChannelsOnCard("live")).toBe(true);
    expect(showsChannelsOnCard("final")).toBe(false);
    expect(showsChannelsOnCard("postponed")).toBe(false);
  });
});

describe("summarizeChannels", () => {
  const channels = ["A", "B", "C", "D", "E"].map((network) => ({ network, market: "national" as const }));

  it("shows the first three and counts the rest", () => {
    const { shown, more } = summarizeChannels(channels);
    expect(shown.map((c) => c.network)).toEqual(["A", "B", "C"]);
    expect(more).toBe(2);
  });

  it("has no overflow at exactly three or fewer", () => {
    expect(summarizeChannels(channels.slice(0, 3))).toEqual({ shown: channels.slice(0, 3), more: 0 });
    expect(summarizeChannels(channels.slice(0, 1))).toEqual({ shown: channels.slice(0, 1), more: 0 });
    expect(summarizeChannels([])).toEqual({ shown: [], more: 0 });
  });

  it("takes another limit", () => {
    expect(summarizeChannels(channels, 1).more).toBe(4);
  });
});

describe("channelsLabel", () => {
  it("names the team of a home or away feed", () => {
    expect(
      channelsLabel([
        { network: "SN", market: "national" },
        { network: "SCRIPPS", market: "home", teamAbbrev: "FLA" },
      ]),
    ).toBe("SN, SCRIPPS (FLA)");
  });
});

describe("watchHeading", () => {
  it("says where a finished game aired, and where to watch any other", () => {
    expect(watchHeading("final")).toBe("Aired on");
    expect(watchHeading("scheduled")).toBe("Where to watch");
    expect(watchHeading("live")).toBe("Where to watch");
  });
});
