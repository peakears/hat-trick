import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import type { Team } from "../../domain";
import { useColors } from "../theme";

/**
 * A team logo loaded from the league API at runtime (never bundled: see the README disclaimer).
 * expo-image is used because NHL logos are SVGs, which React Native's Image cannot draw.
 * Falls back to the abbreviation when there is no URL.
 */
export function TeamLogo({ team, size = 32 }: { team: Team; size?: number }) {
  const colors = useColors();
  if (!team.logoUrl) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderColor: colors.border }]}>
        <Text style={{ color: colors.muted, fontSize: size * 0.28, fontWeight: "600" }}>{team.abbrev}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: team.logoUrl }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="disk"
      accessibilityLabel={`${team.name} logo`}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
