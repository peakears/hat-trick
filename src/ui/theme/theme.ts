import { PixelRatio, useColorScheme } from "react-native";
import { colorsFor, schemeFor, type Colors, type Scheme } from "./palette";
import { useSettings } from "../settings/settings-context";

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

/**
 * Width of a line between rows. Not `StyleSheet.hairlineWidth`: that is one physical pixel, and on Android a
 * one-pixel border whose edge falls between pixels (row heights are rarely whole pixels) is sometimes not drawn,
 * so some rows lost their divider depending on where they sat. Two physical pixels always cover a whole one.
 */
export const DIVIDER = Math.min(1, 2 / PixelRatio.get());
