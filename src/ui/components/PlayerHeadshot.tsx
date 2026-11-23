import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Player } from "../../domain";
import { useSettings } from "../settings/settings-context";
import { initials } from "../game/stars";
import { useColors } from "../theme/theme";

/**
 * A player photo loaded from the league API at runtime (never bundled, like team logos). Falls back to
 * the player's initials when there is no URL, the photo fails to load, or "Show logos and photos" is off.
 */
export function PlayerHeadshot({ player, size = 44 }: { player: Player; size?: number }) {
  const colors = useColors();
  const { settings } = useSettings();
  const [failed, setFailed] = useState(false);
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  };

  if (!player.headshotUrl || !settings.showLogos || failed) {
    return (
      <View style={[styles.circle, circle]} accessible={false}>
        <Text style={{ color: colors.muted, fontSize: size * 0.34, fontWeight: "600" }}>{initials(player.name)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.circle, circle]} accessible={false}>
      <Image
        source={{ uri: player.headshotUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="disk"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
