import { RefreshControl } from "react-native";
import { refreshHaptic } from "../haptics";
import { useColors } from "../theme";

/**
 * Pull to refresh for a ScrollView, FlatList or SectionList (`refreshControl={<PullToRefresh ... />}`):
 * the spinner in the theme's colours, and a light haptic tap when the pull is let go.
 */
export function PullToRefresh({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const colors = useColors();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        refreshHaptic();
        onRefresh();
      }}
      colors={[colors.accent]}
      progressBackgroundColor={colors.card}
      tintColor={colors.accent}
    />
  );
}
