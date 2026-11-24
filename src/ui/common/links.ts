/** The project's own links, in one place. Pure, so the report-a-problem URL is unit tested. */

export const REPO_URL = "https://github.com/peakears/hat-trick";
export const RELEASES_URL = `${REPO_URL}/releases`;

/**
 * A new-issue page with the app version and device filled in, so reports say what they ran. `log` (from
 * `logForIssue`) is added in a collapsed section when the user chose to include the diagnostics log.
 */
export function reportProblemUrl(
  info: { version: string; platform: string; osVersion: string | number },
  log?: string,
): string {
  const body = [
    "**What happened?**",
    "",
    "",
    "**What did you expect?**",
    "",
    "",
    "---",
    `App version: ${info.version}`,
    `${info.platform}: ${info.osVersion}`,
    ...(log ? ["", "<details><summary>Diagnostics log</summary>", "", "```", log, "```", "", "</details>"] : []),
  ].join("\n");
  return `${REPO_URL}/issues/new?body=${encodeURIComponent(body)}`;
}
