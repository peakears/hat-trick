import { isReleaseApkUrl, type Release } from "./updates";

/**
 * Downloads a release's APK and hands it to Android's installer. The steps that touch the phone
 * (download, file size, content link, installer, delete) are passed in as `ports`, so this flow is
 * unit tested without a device; updates-native.ts supplies the real ones.
 *
 * Nothing is left behind: the APK goes to the app's cache folder (never Downloads) and is deleted
 * after a failed or cancelled install, and again on the next launch.
 */

export type InstallState =
  | { kind: "idle" }
  | { kind: "downloading"; /** 0 to 1; undefined until the size is known. */ progress?: number }
  | { kind: "installing" }
  | { kind: "failed"; message: string };

export interface InstallPorts {
  /**
   * Saves the APK under `fileName` in the cache folder and reports progress as bytes. Stops (and
   * rejects) when `signal` aborts.
   */
  download(
    url: string,
    fileName: string,
    onProgress: (written: number, total: number) => void,
    signal: AbortSignal,
  ): Promise<void>;
  /** Size in bytes of the saved file. */
  fileSize(fileName: string): Promise<number>;
  /** SHA-256 of the saved file, lowercase hex. */
  sha256(fileName: string): Promise<string>;
  /** A link the system installer may open (an Android `content://` URI). */
  contentUri(fileName: string): Promise<string>;
  /** Opens the installer. Returns when the user leaves it; if the install worked the app is replaced. */
  openInstaller(contentUri: string): Promise<void>;
  /** Deletes the saved file; never throws. */
  remove(fileName: string): Promise<void>;
}

export const APK_MIME_TYPE = "application/vnd.android.package-archive";

/** A download that sends nothing for this long is given up, so a dead connection cannot keep the update busy. */
export const DOWNLOAD_STALL_MS = 30_000;

export interface InstallOptions {
  /** Aborting it cancels the download (the user tapped Cancel). The flow then ends in "idle". */
  signal?: AbortSignal;
  /** Overrides `DOWNLOAD_STALL_MS` (tests). */
  stallMs?: number;
}

export function updateFileName(version: string): string {
  return `hat-trick-${version}.apk`;
}

/** 0 to 1, or undefined when the total is not known yet. */
export function downloadProgress(written: number, total: number): number | undefined {
  if (!(total > 0) || !(written >= 0)) return undefined;
  return Math.min(1, written / total);
}

/** True when the file has the size GitHub reports (or the size is unknown, so nothing to compare). */
export function sizeMatches(actual: number, expected: number | undefined): boolean {
  return expected === undefined || actual === expected;
}

/** True when the hash matches what GitHub lists (or none is listed, so nothing to compare). */
export function checksumMatches(actual: string, expected: string | undefined): boolean {
  return expected === undefined || actual.trim().toLowerCase() === expected.toLowerCase();
}

/** Text for the banner and Settings, or undefined when there is nothing to show beyond the version. */
export function installStatusText(state: InstallState): string | undefined {
  switch (state.kind) {
    case "downloading":
      return state.progress === undefined
        ? "Downloading update..."
        : `Downloading update... ${Math.round(state.progress * 100)}%`;
    case "installing":
      return "Opening the installer...";
    case "failed":
      return state.message;
    case "idle":
      return undefined;
  }
}

/** True while a download or install is under way (a second tap must do nothing). */
export function isBusy(state: InstallState): boolean {
  return state.kind === "downloading" || state.kind === "installing";
}

/**
 * Runs the whole update. Reports each step through `onState` and ends in "idle" (the user came back from
 * the installer, or cancelled the download) or "failed" (including a download that stalled for
 * `DOWNLOAD_STALL_MS`). Never throws, and always deletes the file unless the installer took over.
 */
export async function installUpdate(
  release: Release,
  ports: InstallPorts,
  onState: (state: InstallState) => void,
  options: InstallOptions = {},
): Promise<void> {
  const url = release.apkUrl;
  if (!url || !isReleaseApkUrl(url)) {
    onState({ kind: "failed", message: "This release has no APK to install." });
    return;
  }
  const fileName = updateFileName(release.version);
  const stallMs = options.stallMs ?? DOWNLOAD_STALL_MS;

  // One controller stops the download, whether the user cancelled or it stalled. `aborted` rejects
  // as soon as that happens, so the flow moves on even if the download itself never settles.
  const controller = new AbortController();
  let stalled = false;
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
  aborted.catch(() => {});
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let downloading = true;
  const watch = () => {
    clearTimeout(timer);
    if (!downloading) return;
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallMs);
  };

  try {
    onState({ kind: "downloading" });
    watch();
    await Promise.race([
      ports.download(
        url,
        fileName,
        (written, total) => {
          if (!downloading) return; // A late progress event must not undo "installing".
          watch();
          onState({ kind: "downloading", progress: downloadProgress(written, total) });
        },
        controller.signal,
      ),
      aborted,
    ]);
    downloading = false;
    clearTimeout(timer);
    if (!sizeMatches(await ports.fileSize(fileName), release.apkSize)) {
      throw new Error("The download was incomplete.");
    }
    if (release.apkSha256 !== undefined && !checksumMatches(await ports.sha256(fileName), release.apkSha256)) {
      throw new Error("The download did not match its checksum.");
    }
    onState({ kind: "installing" });
    await ports.openInstaller(await ports.contentUri(fileName));
    // Back from the installer without being replaced: cancelled or not allowed. Nothing to keep.
    await ports.remove(fileName);
    onState({ kind: "idle" });
  } catch (error) {
    downloading = false;
    clearTimeout(timer);
    await ports.remove(fileName);
    if (controller.signal.aborted && !stalled) {
      onState({ kind: "idle" });
      return;
    }
    const detail = stalled
      ? "The download stopped. Check your connection and try again."
      : error instanceof Error && error.message
        ? error.message
        : "Something went wrong.";
    onState({ kind: "failed", message: `Couldn't install the update. ${detail}` });
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
}
