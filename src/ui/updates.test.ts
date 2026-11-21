import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../data";
import { reportProblemUrl, REPO_URL } from "./links";
import {
  CHECK_INTERVAL_MS,
  LATEST_RELEASE_URL,
  UPDATE_STATE_KEY,
  checkForUpdate,
  dismissUpdate,
  isNewerVersion,
  isReleaseApkUrl,
  isReleasePageUrl,
  parseRelease,
  parseVersion,
  storedUpdateStatus,
} from "./updates";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const releaseUrl = (v: string) => `${REPO_URL}/releases/tag/v${v}`;
const apkUrl = (v: string) => `${REPO_URL}/releases/download/v${v}/hat-trick-v${v}.apk`;

function releaseJson(version: string, extra: Record<string, unknown> = {}) {
  return {
    tag_name: `v${version}`,
    html_url: releaseUrl(version),
    draft: false,
    prerelease: false,
    assets: [{ name: `hat-trick-v${version}.apk`, browser_download_url: apkUrl(version) }],
    ...extra,
  };
}

function ok(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

describe("parseVersion / isNewerVersion", () => {
  it("parses with or without a leading v and ignores a suffix", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v10.0.1")).toEqual([10, 0, 1]);
    expect(parseVersion("1.2.3-rc.1")).toEqual([1, 2, 3]);
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
  });

  it("compares numerically, not as text", () => {
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
    expect(isNewerVersion("2.0.0", "1.99.99")).toBe(true);
    expect(isNewerVersion("1.1.1", "1.1.0")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.1.0")).toBe(false);
    expect(isNewerVersion("1.0.9", "1.1.0")).toBe(false);
  });

  it("is false when either version is unreadable", () => {
    expect(isNewerVersion("nope", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "")).toBe(false);
  });
});

describe("parseRelease", () => {
  it("reads the version, release page and APK link", () => {
    expect(parseRelease(releaseJson("1.2.0"))).toEqual({
      version: "1.2.0",
      url: releaseUrl("1.2.0"),
      apkUrl: apkUrl("1.2.0"),
    });
  });

  it("keeps the release notes", () => {
    expect(parseRelease(releaseJson("1.2.0", { body: "### Features\n* x" }))?.notes).toBe("### Features\n* x");
    expect(parseRelease(releaseJson("1.2.0", { body: null }))?.notes).toBeUndefined();
  });

  it("works without an APK asset", () => {
    expect(parseRelease(releaseJson("1.2.0", { assets: [] }))?.apkUrl).toBeUndefined();
  });

  it("rejects drafts, prereleases, bad tags, other sites and junk", () => {
    expect(parseRelease(releaseJson("1.2.0", { draft: true }))).toBeNull();
    expect(parseRelease(releaseJson("1.2.0", { prerelease: true }))).toBeNull();
    expect(parseRelease(releaseJson("1.2.0", { tag_name: "nightly" }))).toBeNull();
    expect(parseRelease(releaseJson("1.2.0", { html_url: "https://evil.example/release" }))).toBeNull();
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ tag_name: 5 })).toBeNull();
  });

  it("reads the APK's size and SHA-256 when GitHub lists them", () => {
    const sha = "ab".repeat(32);
    const json = releaseJson("1.2.0", {
      assets: [
        {
          name: "x.apk",
          browser_download_url: apkUrl("1.2.0"),
          size: 61_000_000,
          digest: `sha256:${sha.toUpperCase()}`,
        },
      ],
    });
    expect(parseRelease(json)).toMatchObject({ apkSize: 61_000_000, apkSha256: sha });
  });

  it("leaves the checksum out when the digest is missing or not SHA-256", () => {
    expect(parseRelease(releaseJson("1.2.0"))?.apkSha256).toBeUndefined();
    const json = releaseJson("1.2.0", {
      assets: [{ name: "x.apk", browser_download_url: apkUrl("1.2.0"), digest: "md5:abc" }],
    });
    expect(parseRelease(json)?.apkSha256).toBeUndefined();
  });

  it("ignores an APK link that points outside the repo", () => {
    const json = releaseJson("1.2.0", {
      assets: [{ name: "x.apk", browser_download_url: "https://evil.example/x.apk" }],
    });
    expect(parseRelease(json)?.apkUrl).toBeUndefined();
  });

  it("ignores links that start with the repo URL but climb out of it", () => {
    const json = releaseJson("1.2.0", {
      assets: [{ name: "x.apk", browser_download_url: `${REPO_URL}/../../evil/repo/releases/download/v1.2.0/x.apk` }],
    });
    expect(parseRelease(json)?.apkUrl).toBeUndefined();
    expect(
      parseRelease(releaseJson("1.2.0", { html_url: `${REPO_URL}/../../evil/repo/releases/tag/v1.2.0` })),
    ).toBeNull();
  });
});

describe("isReleasePageUrl / isReleaseApkUrl", () => {
  it("accepts this repo's release pages and APKs, with or without a tag suffix", () => {
    expect(isReleasePageUrl(releaseUrl("1.5.0"))).toBe(true);
    expect(isReleasePageUrl(releaseUrl("1.6.0-dev0"))).toBe(true);
    expect(isReleaseApkUrl(apkUrl("1.5.0"))).toBe(true);
    expect(isReleaseApkUrl(`${REPO_URL}/releases/download/v1.6.0-dev0/hat-trick-v1.6.0-dev0.apk`)).toBe(true);
  });

  it("rejects links that only start with the repo URL", () => {
    const escapes = [
      // The HTTP client resolves these to github.com/evil/repo.
      `${REPO_URL}/../../evil/repo/releases/download/v9.0.0/x.apk`,
      `${REPO_URL}/releases/download/v9.0.0/../../../../evil/repo/releases/download/v9.0.0/x.apk`,
      `${REPO_URL}/releases/download/v9.0.0/%2e%2e/x.apk`,
      `${REPO_URL}/releases/download/v9.0.0/..\\x.apk`,
      `${REPO_URL}/releases/download/v9.0.0/x.apk?redirect=https://evil.example`,
      `${REPO_URL}-evil/releases/download/v9.0.0/x.apk`,
      `${REPO_URL}/issues/1/x.apk`,
      `http://github.com/peakears/hat-trick/releases/download/v9.0.0/x.apk`,
      `https://github.com.evil.example/peakears/hat-trick/releases/download/v9.0.0/x.apk`,
      `${REPO_URL}/releases/download/v9.0.0/x.zip`,
    ];
    for (const url of escapes) expect(isReleaseApkUrl(url), url).toBe(false);
    expect(isReleasePageUrl(`${REPO_URL}/../../evil/repo/releases/tag/v9.0.0`)).toBe(false);
    expect(isReleasePageUrl(`${REPO_URL}/releases/tag/v9.0.0/../../../../../evil/repo`)).toBe(false);
    expect(isReleasePageUrl(apkUrl("1.5.0"))).toBe(false);
  });

  it("matches the repo in links.ts", () => {
    expect(REPO_URL).toBe("https://github.com/peakears/hat-trick");
  });
});

describe("storedUpdateStatus", () => {
  it("drops stored links that fail the release link check", async () => {
    const store = new MemoryStore();
    const stored = (latest: Record<string, unknown>) =>
      store.set(UPDATE_STATE_KEY, JSON.stringify({ checkedAt: NOW, latest }));
    const escape = `${REPO_URL}/../../evil/repo/releases/download/v1.2.0/x.apk`;

    await stored({ version: "1.2.0", url: releaseUrl("1.2.0"), apkUrl: escape });
    const status = await storedUpdateStatus(store, "1.1.0");
    expect(status).toMatchObject({ kind: "available", release: { url: releaseUrl("1.2.0") } });
    expect(status.kind === "available" && status.release.apkUrl).toBeUndefined();

    await stored({ version: "1.2.0", url: `${REPO_URL}/../../evil/repo/releases/tag/v1.2.0` });
    expect(await storedUpdateStatus(store, "1.1.0")).toMatchObject({ kind: "up-to-date" });
  });
});

describe("checkForUpdate", () => {
  it("reports an available update and remembers the check", async () => {
    const store = new MemoryStore();
    const fetchFn = vi.fn(() => ok(releaseJson("1.2.0")));
    const status = await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW });
    expect(status).toMatchObject({ kind: "available", dismissed: false, release: { version: "1.2.0" } });
    expect(fetchFn).toHaveBeenCalledWith(LATEST_RELEASE_URL, expect.anything());
    expect(await storedUpdateStatus(store, "1.1.0")).toMatchObject({ kind: "available" });
  });

  it("says up to date when the latest release is the running version or older", async () => {
    const fetchFn = () => ok(releaseJson("1.1.0"));
    expect(await checkForUpdate({ currentVersion: "1.1.0", store: new MemoryStore(), fetchFn, now: NOW })).toEqual({
      kind: "up-to-date",
      checkedAt: NOW,
    });
    const older = () => ok(releaseJson("1.0.0"));
    expect(
      (await checkForUpdate({ currentVersion: "1.1.0", store: new MemoryStore(), fetchFn: older, now: NOW })).kind,
    ).toBe("up-to-date");
  });

  it("does not hit the network again within a day, unless forced", async () => {
    const store = new MemoryStore();
    const fetchFn = vi.fn(() => ok(releaseJson("1.2.0")));
    await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW });
    await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW + CHECK_INTERVAL_MS - 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW + 1000, force: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW + 1000 + CHECK_INTERVAL_MS });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("treats a 404 (no release yet) as up to date", async () => {
    const status = await checkForUpdate({
      currentVersion: "1.1.0",
      store: new MemoryStore(),
      fetchFn: () => ok({ message: "Not Found" }, 404),
      now: NOW,
    });
    expect(status.kind).toBe("up-to-date");
  });

  it("returns an error status, and stores nothing, for HTTP errors, network failures and junk", async () => {
    const store = new MemoryStore();
    const run = (fetchFn: typeof fetch) => checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW });
    expect((await run(() => ok({}, 500))).kind).toBe("error");
    expect((await run(() => Promise.reject(new Error("offline")))).kind).toBe("error");
    expect((await run(() => ok({ nope: true }))).kind).toBe("error");
    expect(await store.get(UPDATE_STATE_KEY)).toBeNull();
  });

  it("falls back to the stored answer shape when the stored data is corrupt", async () => {
    const store = new MemoryStore();
    await store.set(UPDATE_STATE_KEY, "{not json");
    const fetchFn = vi.fn(() => ok(releaseJson("1.2.0")));
    const status = await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn, now: NOW });
    expect(status.kind).toBe("available");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("dismissUpdate", () => {
  it("hides the banner for that version and survives later checks, but not a newer release", async () => {
    const store = new MemoryStore();
    await checkForUpdate({ currentVersion: "1.1.0", store, fetchFn: () => ok(releaseJson("1.2.0")), now: NOW });
    await dismissUpdate(store, "1.2.0");
    expect(await storedUpdateStatus(store, "1.1.0")).toMatchObject({ kind: "available", dismissed: true });

    const again = await checkForUpdate({
      currentVersion: "1.1.0",
      store,
      fetchFn: () => ok(releaseJson("1.2.0")),
      now: NOW + 1000,
      force: true,
    });
    expect(again).toMatchObject({ kind: "available", dismissed: true });

    const newer = await checkForUpdate({
      currentVersion: "1.1.0",
      store,
      fetchFn: () => ok(releaseJson("1.3.0")),
      now: NOW + 2000,
      force: true,
    });
    expect(newer).toMatchObject({ kind: "available", dismissed: false, release: { version: "1.3.0" } });
  });

  it("does nothing when there is no stored check", async () => {
    const store = new MemoryStore();
    await dismissUpdate(store, "1.2.0");
    expect(await store.get(UPDATE_STATE_KEY)).toBeNull();
  });
});

describe("reportProblemUrl", () => {
  it("opens a new issue with the app version and device filled in", () => {
    const url = new URL(reportProblemUrl({ version: "1.1.0", platform: "android", osVersion: 35 }));
    expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("App version: 1.1.0");
    expect(body).toContain("android: 35");
  });
});
