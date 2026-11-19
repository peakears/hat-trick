import type { ConfigContext, ExpoConfig } from "expo/config";
import pkg from "./package.json";

// Static settings live in app.json. The version comes from package.json, which release-please
// bumps on every release, so a built APK always reports the release it was built from.

/**
 * Android's internal version number, which must grow with every release or an update will not
 * install over the previous APK: 1.2.3 -> 1_002_003.
 */
export function androidVersionCode(version: string): number {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`package.json version "${version}" is not semver`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 999 || patch > 999) throw new Error(`version ${version}: minor and patch must be below 1000`);
  return major * 1_000_000 + minor * 1_000 + patch;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Sports Scores",
  slug: config.slug ?? "sports-scores",
  version: pkg.version,
  android: { ...config.android, versionCode: androidVersionCode(pkg.version) },
});
