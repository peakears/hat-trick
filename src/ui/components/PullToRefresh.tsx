import { RefreshControl } from "react-native";
import { useHaptic } from "../haptics/use-haptic";
import { useColors } from "../theme/theme";

/**
 * Pull to refresh for a ScrollView, FlatList or SectionList (`refreshControl={<PullToRefresh ... />}`): the spinner
 * in the accent colour on the card colour (so it matches dark and pure black), and a light tap when the pull is let
 * go. Every screen uses this rather than `RefreshControl`.
 */
export function PullToRefresh({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const colors = useColors();
  const haptic = useHaptic();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        haptic("refresh");
        onRefresh();
      }}
      colors={[colors.accent]}
      progressBackgroundColor={colors.card}
      tintColor={colors.accent}
    />
  );
}
