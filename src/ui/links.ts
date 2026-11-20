/** The project's own links, in one place. Pure, so the report-a-problem URL is unit tested. */

export const REPO_URL = "https://github.com/peakears/hat-trick";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const KOFI_URL = "https://ko-fi.com/peakears";

/** A new-issue page with the app version and device filled in, so reports say what they ran. */
export function reportProblemUrl(info: { version: string; platform: string; osVersion: string | number }): string {
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
  ].join("\n");
  return `${REPO_URL}/issues/new?body=${encodeURIComponent(body)}`;
}
