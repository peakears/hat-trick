// Pure text for Settings › Diagnostics: the log as lines to share, and a short version that fits in a GitHub issue
// link. Tested in diagnostics.test.ts.
import type { LogEntry } from "../data";

/** UTC, so a shared log reads the same in any time zone: "2026-11-22 15:04Z". */
export function logTime(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")}Z`;
}

/** One entry as one line: "2026-11-22 15:04Z  warning ×3  nhl:scores:2026-11-17  savePctg: ... (url)". */
export function logLine(entry: LogEntry): string {
  const count = entry.count > 1 ? ` ×${entry.count}` : "";
  const url = entry.url ? ` (${entry.url})` : "";
  return `${logTime(entry.lastAt)}  ${entry.kind}${count}  ${entry.key}  ${entry.message}${url}`;
}

/** The parts of one console line on the Diagnostics screen. */
export interface ConsoleLine {
  /** "11-22 15:04Z", UTC like the shared log. */
  time: string;
  /** "E" for a failed request, "W" for a warning, as in a device log. */
  level: "E" | "W";
  /** " ×3" when the problem repeated, else "". */
  count: string;
  /** The request: the API path ("/score/2026-12-05") when known, else the cache key. */
  where: string;
  message: string;
}

/** One entry as a compact console line. Pure. */
export function consoleLine(entry: LogEntry): ConsoleLine {
  return {
    time: logTime(entry.lastAt).slice(5),
    level: entry.kind === "error" ? "E" : "W",
    count: entry.count > 1 ? ` ×${entry.count}` : "",
    where: entry.url ? apiPath(entry.url) : entry.key,
    message: entry.message,
  };
}

/** "https://api-web.nhle.com/v1/score/2026-12-05?x=1" as "/score/2026-12-05?x=1": the host is the same every time. */
function apiPath(url: string): string {
  const match = /^https?:\/\/[^/]+(\/v\d+)?(\/.*)?$/.exec(url);
  return match?.[2] ?? url;
}

export interface ReportInfo {
  version: string;
  platform: string;
  osVersion: string | number;
}

/** The whole log for Share, with what the phone was running on top. */
export function logReport(entries: LogEntry[], info: ReportInfo): string {
  const head = [
    `Hat Trick ${info.version}, ${info.platform} ${info.osVersion}`,
    `${entries.length} entries, newest first`,
  ];
  return [...head, "", ...entries.map(logLine)].join("\n");
}

/**
 * The newest entries that fit in `maxChars`, for the body of a new GitHub issue (its link has a length limit),
 * with a note saying how many were left out. Undefined when the log is empty.
 */
export function logForIssue(entries: LogEntry[], maxChars = 1500): string | undefined {
  if (entries.length === 0) return undefined;
  const lines: string[] = [];
  let length = 0;
  for (const entry of entries) {
    const line = logLine(entry);
    if (lines.length > 0 && length + line.length + 1 > maxChars) break;
    lines.push(line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line);
    length += line.length + 1;
  }
  const left = entries.length - lines.length;
  return left > 0 ? [...lines, `(${left} older not included)`].join("\n") : lines.join("\n");
}
