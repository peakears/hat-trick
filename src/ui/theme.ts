import { useColorScheme } from "react-native";
import { colorsFor, schemeFor, type Colors, type Scheme } from "./palette";
import { useSettings } from "./settings-context";

export type { Colors } from "./palette";

/**
 * The palette in use: light or dark from the phone (or the Appearance setting, applied through
 * `Appearance.setColorScheme`), dark turned pure black by "Pure black", and the chosen accent.
 */
export function useScheme(): Scheme {
  const { settings } = useSettings();
  return schemeFor(useColorScheme() === "dark", settings.pureBlack);
}

export function useColors(): Colors {
  const { settings } = useSettings();
  return colorsFor(useScheme(), settings.accent);
}

/** Numbers that line up in columns. */
export const tabular = { fontVariant: ["tabular-nums" as const] };
