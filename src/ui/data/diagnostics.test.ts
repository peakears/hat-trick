import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../data";
import { consoleLine, logForIssue, logLine, logReport, logTime } from "./diagnostics";
import { reportProblemUrl } from "../common/links";

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  kind: "warning",
  league: "nhl",
  key: "nhl:scores:2026-11-17",
  url: "https://api-web.nhle.com/v1/score/2026-11-17",
  message: "goals left out: Network request failed",
  count: 1,
  firstAt: Date.UTC(2026, 10, 22, 15, 0),
  lastAt: Date.UTC(2026, 10, 22, 15, 4),
  ...over,
});

describe("diagnostics text", () => {
  it("writes times in UTC, so a shared log reads the same anywhere", () => {
    expect(logTime(Date.UTC(2026, 10, 22, 15, 4, 59))).toBe("2026-11-22 15:04Z");
  });

  it("puts one entry on one line, with the count only when repeated", () => {
    expect(logLine(entry())).toBe(
      "2026-11-22 15:04Z  warning  nhl:scores:2026-11-17  goals left out: Network request failed (https://api-web.nhle.com/v1/score/2026-11-17)",
    );
    expect(logLine(entry({ kind: "error", count: 3, url: undefined }))).toBe(
      "2026-11-22 15:04Z  error ×3  nhl:scores:2026-11-17  goals left out: Network request failed",
    );
  });

  it("shows each entry as a compact console line with the API path", () => {
    expect(consoleLine(entry())).toEqual({
      time: "11-22 15:04Z",
      level: "W",
      count: "",
      where: "/score/2026-11-17",
      message: "goals left out: Network request failed",
    });
    expect(consoleLine(entry({ kind: "error", count: 3, url: undefined }))).toMatchObject({
      level: "E",
      count: " ×3",
      where: "nhl:scores:2026-11-17",
    });
    expect(consoleLine(entry({ url: "https://example.com/a?b=1" })).where).toBe("/a?b=1");
  });

  it("starts a shared log with what the phone runs", () => {
    const text = logReport([entry()], { version: "1.9.0", platform: "android", osVersion: 35 });
    expect(text.split("\n").slice(0, 3)).toEqual(["Hat Trick 1.9.0, android 35", "1 entries, newest first", ""]);
    expect(text).toContain("goals left out");
  });

  it("fits the newest entries into an issue link and says how many were left out", () => {
    const entries = Array.from({ length: 50 }, (_, i) => entry({ message: `problem ${i}` }));
    const text = logForIssue(entries, 600)!;
    expect(text.length).toBeLessThanOrEqual(600 + 40);
    expect(text.split("\n")[0]).toContain("problem 0");
    expect(text).toMatch(/\(\d+ older not included\)$/);
    expect(logForIssue([])).toBeUndefined();
    expect(logForIssue([entry()], 600)).toBe(logLine(entry()));
  });

  it("adds the log to a problem report in a collapsed section, only when given", () => {
    const info = { version: "1.9.0", platform: "android", osVersion: 35 };
    const body = (url: string) => new URL(url).searchParams.get("body") ?? "";
    expect(body(reportProblemUrl(info))).not.toContain("Diagnostics log");
    const withLog = body(reportProblemUrl(info, "line one"));
    expect(withLog).toContain("<details><summary>Diagnostics log</summary>");
    expect(withLog).toContain("```\nline one\n```");
    expect(withLog).toContain("App version: 1.9.0");
  });
});
