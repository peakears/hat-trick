import { StyleSheet, Text } from "react-native";
import { useColors } from "../theme";

/** A small text tag naming a game's special event: "Winter Classic", "Original 6 Series". */
export function SpecialEventTag({ name, style }: { name: string | undefined; style?: object }) {
  const colors = useColors();
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
