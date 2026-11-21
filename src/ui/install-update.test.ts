import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_STALL_MS,
  checksumMatches,
  downloadProgress,
  installStatusText,
  installUpdate,
  isBusy,
  sizeMatches,
  updateFileName,
  type InstallPorts,
  type InstallState,
} from "./install-update";
import { REPO_URL } from "./links";
import type { Release } from "./updates";

const SHA = "cd".repeat(32);
const release = (over: Partial<Release> = {}): Release => ({
  version: "1.5.0",
  url: `${REPO_URL}/releases/tag/v1.5.0`,
  apkUrl: `${REPO_URL}/releases/download/v1.5.0/hat-trick-v1.5.0.apk`,
  apkSize: 1000,
  apkSha256: SHA,
  ...over,
});

/** Ports that succeed, recording what was called. Any can be replaced to simulate a failure. */
function ports(over: Partial<InstallPorts> = {}) {
  const calls: string[] = [];
  const p: InstallPorts = {
    download: vi.fn(async (_url, _name, onProgress) => {
      calls.push("download");
      onProgress(500, 1000);
      onProgress(1000, 1000);
    }),
    fileSize: vi.fn(async () => 1000),
    sha256: vi.fn(async () => SHA),
    contentUri: vi.fn(async (name) => `content://x/${name}`),
    openInstaller: vi.fn(async () => {
      calls.push("installer");
    }),
    remove: vi.fn(async () => {
      calls.push("remove");
    }),
    ...over,
  };
  return { p, calls };
}

async function run(r: Release, p: InstallPorts, options?: Parameters<typeof installUpdate>[3]) {
  const states: InstallState[] = [];
  await installUpdate(r, p, (s) => states.push(s), options);
  return states;
}

/** A download that never finishes on its own; it rejects when its signal aborts, like the real one. */
const hangingDownload = (onStart?: (onProgress: (w: number, t: number) => void) => void) =>
  vi.fn(
    (_url: string, _name: string, onProgress: (w: number, t: number) => void, signal: AbortSignal) =>
      new Promise<void>((_, reject) => {
        onStart?.(onProgress);
        signal.addEventListener("abort", () => reject(new Error("AbortError")));
      }),
  );

describe("installUpdate", () => {
  it("downloads, checks, opens the installer, then cleans up", async () => {
    const { p, calls } = ports();
    const states = await run(release(), p);
    expect(p.download).toHaveBeenCalledWith(
      release().apkUrl,
      "hat-trick-1.5.0.apk",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(p.openInstaller).toHaveBeenCalledWith("content://x/hat-trick-1.5.0.apk");
    expect(states.map((s) => s.kind)).toEqual(["downloading", "downloading", "downloading", "installing", "idle"]);
    expect(states[1]).toEqual({ kind: "downloading", progress: 0.5 });
    expect(calls).toEqual(["download", "installer", "remove"]);
  });

  it("refuses a release without an APK or with a link outside the repo, touching nothing", async () => {
    for (const r of [
      release({ apkUrl: undefined }),
      release({ apkUrl: "https://evil.example/a.apk" }),
      release({ apkUrl: "https://github.com/peakears/hat-trick/../../evil/repo/releases/download/v1.5.0/a.apk" }),
    ]) {
      const { p } = ports();
      const states = await run(r, p);
      expect(states).toEqual([{ kind: "failed", message: "This release has no APK to install." }]);
      expect(p.download).not.toHaveBeenCalled();
    }
  });

  it("deletes the file and fails when the download is cut short", async () => {
    const { p } = ports({ fileSize: vi.fn(async () => 400) });
    const states = await run(release(), p);
    expect(states.at(-1)).toEqual({
      kind: "failed",
      message: "Couldn't install the update. The download was incomplete.",
    });
    expect(p.remove).toHaveBeenCalledWith("hat-trick-1.5.0.apk");
    expect(p.openInstaller).not.toHaveBeenCalled();
  });

  it("deletes the file and fails when the checksum does not match", async () => {
    const { p } = ports({ sha256: vi.fn(async () => "00".repeat(32)) });
    const states = await run(release(), p);
    expect(states.at(-1)).toMatchObject({ kind: "failed" });
    expect((states.at(-1) as { message: string }).message).toContain("checksum");
    expect(p.remove).toHaveBeenCalled();
    expect(p.openInstaller).not.toHaveBeenCalled();
  });

  it("skips the checks it has nothing to compare with (an older release)", async () => {
    const { p } = ports();
    const states = await run(release({ apkSize: undefined, apkSha256: undefined }), p);
    expect(p.sha256).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual({ kind: "idle" });
  });

  it("fails and cleans up when the download or the installer throws", async () => {
    const offline = ports({
      download: vi.fn(async () => {
        throw new Error("Network request failed");
      }),
    });
    expect((await run(release(), offline.p)).at(-1)).toEqual({
      kind: "failed",
      message: "Couldn't install the update. Network request failed",
    });
    expect(offline.p.remove).toHaveBeenCalled();

    const blocked = ports({
      openInstaller: vi.fn(async () => {
        throw new Error("Installing is not allowed for this app.");
      }),
    });
    expect((await run(release(), blocked.p)).at(-1)).toMatchObject({ kind: "failed" });
    expect(blocked.p.remove).toHaveBeenCalled();
  });

  it("never throws, even if cleanup misbehaves in the usual ways", async () => {
    const { p } = ports({ fileSize: vi.fn(async () => Promise.reject("not an Error")) });
    const states = await run(release(), p);
    expect(states.at(-1)).toEqual({ kind: "failed", message: "Couldn't install the update. Something went wrong." });
  });
});

describe("installUpdate: stalls and cancelling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives up on a download that sends nothing for the stall time, and cleans up", async () => {
    vi.useFakeTimers();
    const { p } = ports({ download: hangingDownload() });
    const done = run(release(), p);
    await vi.advanceTimersByTimeAsync(DOWNLOAD_STALL_MS);
    const states = await done;
    expect(states.at(-1)).toEqual({
      kind: "failed",
      message: "Couldn't install the update. The download stopped. Check your connection and try again.",
    });
    expect((p.download as ReturnType<typeof vi.fn>).mock.calls[0][3].aborted).toBe(true);
    expect(p.remove).toHaveBeenCalledWith("hat-trick-1.5.0.apk");
    expect(p.openInstaller).not.toHaveBeenCalled();
  });

  it("gives up even if the download ignores its signal", async () => {
    vi.useFakeTimers();
    const { p } = ports({ download: vi.fn(() => new Promise<void>(() => {})) });
    const done = run(release(), p);
    await vi.advanceTimersByTimeAsync(DOWNLOAD_STALL_MS);
    expect((await done).at(-1)).toMatchObject({ kind: "failed" });
  });

  it("keeps waiting while progress arrives", async () => {
    vi.useFakeTimers();
    let progress: (w: number, t: number) => void = () => {};
    const { p } = ports({ download: hangingDownload((onProgress) => (progress = onProgress)) });
    const states: InstallState[] = [];
    const done = installUpdate(release(), p, (s) => states.push(s));
    for (let i = 1; i <= 4; i++) {
      await vi.advanceTimersByTimeAsync(DOWNLOAD_STALL_MS - 1000);
      progress(i * 100, 1000);
    }
    expect(states.at(-1)).toEqual({ kind: "downloading", progress: 0.4 });
    await vi.advanceTimersByTimeAsync(DOWNLOAD_STALL_MS);
    await done;
    expect(states.at(-1)).toMatchObject({ kind: "failed" });
  });

  it("goes back to idle and deletes the file when the user cancels", async () => {
    const controller = new AbortController();
    const { p } = ports({ download: hangingDownload(() => queueMicrotask(() => controller.abort())) });
    const states = await run(release(), p, { signal: controller.signal });
    expect(states.at(-1)).toEqual({ kind: "idle" });
    expect(p.remove).toHaveBeenCalledWith("hat-trick-1.5.0.apk");
    expect(p.openInstaller).not.toHaveBeenCalled();
  });

  it("does nothing past the start when cancelled before it begins", async () => {
    const controller = new AbortController();
    controller.abort();
    const { p } = ports({ download: hangingDownload() });
    const states = await run(release(), p, { signal: controller.signal });
    expect(states.at(-1)).toEqual({ kind: "idle" });
    expect(p.openInstaller).not.toHaveBeenCalled();
  });

  it("ignores a progress event that arrives after the download finished", async () => {
    let late: (w: number, t: number) => void = () => {};
    const { p } = ports({
      download: vi.fn(async (_url, _name, onProgress) => {
        late = onProgress;
      }),
      openInstaller: vi.fn(async () => late(10, 1000)),
    });
    const states = await run(release(), p);
    expect(states.map((s) => s.kind)).toEqual(["downloading", "installing", "idle"]);
  });
});

describe("install helpers", () => {
  it("names the file after the version", () => {
    expect(updateFileName("1.5.0")).toBe("hat-trick-1.5.0.apk");
  });

  it("turns bytes into a 0-1 progress, or nothing before the total is known", () => {
    expect(downloadProgress(250, 1000)).toBe(0.25);
    expect(downloadProgress(2000, 1000)).toBe(1);
    expect(downloadProgress(10, 0)).toBeUndefined();
    expect(downloadProgress(10, -1)).toBeUndefined();
  });

  it("compares size and checksum only when the expected value is known", () => {
    expect(sizeMatches(1000, 1000)).toBe(true);
    expect(sizeMatches(999, 1000)).toBe(false);
    expect(sizeMatches(5, undefined)).toBe(true);
    expect(checksumMatches(SHA.toUpperCase() + "\n", SHA)).toBe(true);
    expect(checksumMatches("00", SHA)).toBe(false);
    expect(checksumMatches("anything", undefined)).toBe(true);
  });

  it("describes each state", () => {
    expect(installStatusText({ kind: "idle" })).toBeUndefined();
    expect(installStatusText({ kind: "downloading" })).toBe("Downloading update...");
    expect(installStatusText({ kind: "downloading", progress: 0.426 })).toBe("Downloading update... 43%");
    expect(installStatusText({ kind: "installing" })).toBe("Opening the installer...");
    expect(installStatusText({ kind: "failed", message: "Nope." })).toBe("Nope.");
  });

  it("is busy while downloading or installing only", () => {
    expect(isBusy({ kind: "idle" })).toBe(false);
    expect(isBusy({ kind: "downloading" })).toBe(true);
    expect(isBusy({ kind: "installing" })).toBe(true);
    expect(isBusy({ kind: "failed", message: "x" })).toBe(false);
  });
});
