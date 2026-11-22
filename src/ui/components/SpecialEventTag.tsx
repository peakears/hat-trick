import { StyleSheet, Text } from "react-native";
import { useSettings } from "../settings-context";
import { shownSpecialEvent } from "../special-events";
import { useColors } from "../theme";

/** The game's special event name as the user wants it shown (Settings can hide the Original 6 Series tag). */
export function useShownSpecialEvent(name: string | undefined): string | undefined {
  const { settings } = useSettings();
  return shownSpecialEvent(name, settings.showOriginalSixTags);
}

/** A small text tag naming a game's special event: "Winter Classic", "Original 6 Series". */
export function SpecialEventTag({ name: raw, style }: { name: string | undefined; style?: object }) {
  const colors = useColors();
  const name = useShownSpecialEvent(raw);
  if (!name) return null;
  return (
    <Text
      numberOfLines={1}
      style={[styles.tag, { color: colors.accent }, style]}
      accessibilityLabel={`Special event: ${name}`}
    >
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
});
