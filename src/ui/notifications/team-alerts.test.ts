import { describe, expect, it } from "vitest";
import { alertsOn, favoritesWithAlert, pruneAlerts, setAlert } from "./team-alerts";

describe("team alerts", () => {
  const favorites = ["nhl:TOR", "nhl:MTL", "nba:BOS"];

  it("covers every favourite unless it was switched off", () => {
    expect(favoritesWithAlert(favorites, {}, "reminders")).toEqual(favorites);
    const alerts = { "nhl:MTL": { live: false as const } };
    expect(favoritesWithAlert(favorites, alerts, "live")).toEqual(["nhl:TOR", "nba:BOS"]);
    expect(favoritesWithAlert(favorites, alerts, "reminders")).toEqual(favorites);
    expect(alertsOn(alerts, "nhl:MTL", "live")).toBe(false);
  });

  it("stores only what is switched off, and nothing once a team is back on", () => {
    let alerts = setAlert({}, "nhl:TOR", "live", false);
    expect(alerts).toEqual({ "nhl:TOR": { live: false } });
    alerts = setAlert(alerts, "nhl:TOR", "reminders", false);
    expect(alerts).toEqual({ "nhl:TOR": { live: false, reminders: false } });
    alerts = setAlert(alerts, "nhl:TOR", "live", true);
    expect(alerts).toEqual({ "nhl:TOR": { reminders: false } });
    expect(setAlert(alerts, "nhl:TOR", "reminders", true)).toEqual({});
  });

  it("forgets teams that are no longer favourites", () => {
    expect(pruneAlerts({ "nhl:TOR": { live: false }, "nba:BOS": { reminders: false } }, ["nba:BOS"])).toEqual({
      "nba:BOS": { reminders: false },
    });
  });
});
