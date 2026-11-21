import { Directory, File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import { Platform } from "react-native";
import { APK_MIME_TYPE, type InstallPorts } from "./install-update";

/**
 * The only code that touches the file system and Android's installer for updates. The flow
 * itself is in install-update.ts. Android only: Expo Go and iOS cannot install an APK, so the
 * caller falls back to opening the release in the browser when this fails.
 */

export const CAN_INSTALL_IN_APP = Platform.OS === "android";

const FLAG_GRANT_READ_URI_PERMISSION = 1;

// The app's cache folder, which Android may clear and the user never sees (not Downloads).
const updatesDir = () => new Directory(Paths.cache, "updates");
const apkFile = (fileName: string) => new File(updatesDir(), fileName);

export const nativeInstallPorts: InstallPorts = {
  async download(url, fileName, onProgress, signal) {
    updatesDir().create({ idempotent: true, intermediates: true });
    // A leftover file of the same name (an earlier try) would make the download fail.
    await nativeInstallPorts.remove(fileName);
    const task = File.createDownloadTask(url, apkFile(fileName), {
      onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes),
    });
    const cancel = () => task.cancel();
    signal.addEventListener("abort", cancel);
    try {
      if (signal.aborted) throw new Error("Cancelled.");
      await task.downloadAsync();
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  },

  async fileSize(fileName) {
    return apkFile(fileName).size;
  },

  sha256(fileName) {
    return apkFile(fileName).digest("SHA-256");
  },

  // The installer is another app, so it gets a content:// link (expo-file-system's FileProvider
  // already covers the cache folder) instead of a file path.
  contentUri(fileName) {
    return getContentUriAsync(apkFile(fileName).uri);
  },

  async openInstaller(contentUri) {
    await startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: APK_MIME_TYPE,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  },

  async remove(fileName) {
    try {
      const file = apkFile(fileName);
      if (file.exists) file.delete();
    } catch {
      // Nothing useful to do; the folder is cleared on the next launch.
    }
  },
};

/** Deletes every downloaded update. Called on launch, before any new download can start. */
export function clearUpdateFiles(): void {
  try {
    const dir = updatesDir();
    if (dir.exists) dir.delete();
  } catch {
    // Best effort.
  }
}
