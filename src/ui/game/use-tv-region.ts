import { useLocales } from "expo-localization";
import { resolveRegion } from "./broadcasts";
import { useSettings } from "../settings/settings-context";

/** The country whose TV channels to show: the Settings choice, or the phone's region (no permission, no network). */
export function useTvRegion(): string | null {
  const { settings } = useSettings();
  const locales = useLocales();
  return resolveRegion(settings.tvRegion, locales[0]?.regionCode);
}
