import { z } from "zod";
import type { KeyValueStore } from "../data";

/**
 * Update checks for the sideloaded APK: ask GitHub for the latest release and compare it with the
 * running version. Installing is in install-update.ts. No React Native imports (the HTTP client is
 * passed in), so it is unit tested.
 */

export const LATEST_RELEASE_URL = "https://api.github.com/repos/peakears/hat-trick/releases/latest";
/** Checks at most this often unless the user asks. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 10_000;
/** Outside `cache:`, so pruning never drops it. */
export const UPDATE_STATE_KEY = "update:state:v1";

export interface Release {
  /** "1.2.0" (no leading "v"). */
  version: string;
  /** The release page. */
  url: string;
  /** Direct link to the APK, when the release has one. */
  apkUrl?: string;
  /** The APK's size in bytes, to catch a cut-off download. */
  apkSize?: number;
  /** The APK's SHA-256 (lowercase hex) as GitHub lists it for the asset. Absent on older releases. */
  apkSha256?: string;
}

export type UpdateStatus =
  | { kind: "unknown" }
  | { kind: "up-to-date"; checkedAt: number }
  | { kind: "available"; release: Release; checkedAt: number; dismissed: boolean }
  | { kind: "error"; message: string };

type Version = [number, number, number];

/** "v1.2.3" or "1.2.3" (anything after the patch number, like "-rc.1", is ignored). */
export function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** True only if both parse and `candidate` is strictly newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  assets: z
    .array(
      z.object({
        name: z.string(),
        browser_download_url: z.string(),
        size: z.number().optional().catch(undefined),
        digest: z.string().optional().catch(undefined), // "sha256:<hex>"
      }),
    )
    .catch([]),
});

// Only this project's release pages and APKs are ever opened, whatever the response (or the stored
// state) says. Each link must match its whole shape, not just start with the repo URL: a prefix check
// accepts ".../hat-trick/../../other/repo/...", which the HTTP client resolves to another repo.
// No part below can hold "/", "%" or "\", so a link can never leave the repo. The tag allows a
// suffix like "-dev0". Kept in step with REPO_URL by a test.
const RELEASE_PAGE = /^https:\/\/github\.com\/peakears\/hat-trick\/releases\/tag\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const RELEASE_APK =
  /^https:\/\/github\.com\/peakears\/hat-trick\/releases\/download\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?\/[\w.-]+\.apk$/;

/** True only for a release page of this repo: `.../releases/tag/v1.2.3`. */
export const isReleasePageUrl = (url: string) => RELEASE_PAGE.test(url);
/** True only for an APK attached to a release of this repo: `.../releases/download/v1.2.3/<name>.apk`. */
export const isReleaseApkUrl = (url: string) => RELEASE_APK.test(url);

/** The release described by a GitHub "latest release" response, or null if it is unusable. */
export function parseRelease(json: unknown): Release | null {
  const parsed = releaseSchema.safeParse(json);
  if (!parsed.success) return null;
  const { tag_name, html_url, draft, prerelease, assets } = parsed.data;
  const version = tag_name.replace(/^v/, "");
  if (draft || prerelease || !parseVersion(version) || !isReleasePageUrl(html_url)) return null;
  const apk = assets.find((a) => a.name.endsWith(".apk") && isReleaseApkUrl(a.browser_download_url));
  const sha256 = /^sha256:([0-9a-f]{64})$/i.exec(apk?.digest ?? "")?.[1]?.toLowerCase();
  return { version, url: html_url, apkUrl: apk?.browser_download_url, apkSize: apk?.size, apkSha256: sha256 };
}

// ---------- Stored state ----------

interface StoredState {
  checkedAt: number;
  /** The newest release seen at the last check. */
  latest?: Release;
  /** The version whose banner the user closed. */
  dismissedVersion?: string;
}

const storedSchema = z.object({
  checkedAt: z.number(),
  // Links are checked again on read: state saved by an older version passed only a prefix check.
  latest: z
    .object({
      version: z.string(),
      url: z.string().refine(isReleasePageUrl),
      apkUrl: z.string().refine(isReleaseApkUrl).optional().catch(undefined),
      apkSize: z.number().optional().catch(undefined),
      apkSha256: z.string().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  dismissedVersion: z.string().optional().catch(undefined),
});

async function loadState(store: KeyValueStore): Promise<StoredState | null> {
  try {
    const raw = await store.get(UPDATE_STATE_KEY);
    if (raw == null) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveState(store: KeyValueStore, state: StoredState): Promise<void> {
  return store.set(UPDATE_STATE_KEY, JSON.stringify(state)).catch(() => {});
}

function statusFrom(state: StoredState, currentVersion: string): UpdateStatus {
  const { latest, checkedAt, dismissedVersion } = state;
  if (latest && isNewerVersion(latest.version, currentVersion)) {
    return { kind: "available", release: latest, checkedAt, dismissed: dismissedVersion === latest.version };
  }
  return { kind: "up-to-date", checkedAt };
}

/** The status from the last stored check, without any network request. */
export async function storedUpdateStatus(store: KeyValueStore, currentVersion: string): Promise<UpdateStatus> {
  const state = await loadState(store);
  return state ? statusFrom(state, currentVersion) : { kind: "unknown" };
}

/** Remembers that the user closed the banner for this version (a newer release shows it again). */
export async function dismissUpdate(store: KeyValueStore, version: string): Promise<void> {
  const state = await loadState(store);
  if (state) await saveState(store, { ...state, dismissedVersion: version });
}

export interface CheckOptions {
  currentVersion: string;
  store: KeyValueStore;
  /** The HTTP client; `fetch` in the app. */
  fetchFn: typeof fetch;
  now: number;
  /** Skip the once-a-day limit (the "Check for updates" button). */
  force?: boolean;
}

/**
 * Asks GitHub whether a newer release exists. Within a day of the last check the stored answer is
 * used and nothing is sent, unless `force` is set. Never throws: failures come back as an error status.
 */
export async function checkForUpdate({
  currentVersion,
  store,
  fetchFn,
  now,
  force = false,
}: CheckOptions): Promise<UpdateStatus> {
  const stored = await loadState(store);
  if (!force && stored && now - stored.checkedAt >= 0 && now - stored.checkedAt < CHECK_INTERVAL_MS) {
    return statusFrom(stored, currentVersion);
  }

  const controller = new AbortController();
  // Hermes has no AbortSignal.timeout, so the timer is set up by hand.
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchFn(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    // 404 means the project has no published release yet: nothing to update to.
    if (response.status === 404) {
      const state = { checkedAt: now, dismissedVersion: stored?.dismissedVersion };
      await saveState(store, state);
      return statusFrom(state, currentVersion);
    }
    if (!response.ok) return { kind: "error", message: `GitHub answered ${response.status}` };
    const latest = parseRelease(await response.json());
    if (!latest) return { kind: "error", message: "Unexpected response from GitHub" };
    const state = { checkedAt: now, latest, dismissedVersion: stored?.dismissedVersion };
    await saveState(store, state);
    return statusFrom(state, currentVersion);
  } catch {
    return { kind: "error", message: "Couldn't reach GitHub" };
  } finally {
    clearTimeout(timer);
  }
}
