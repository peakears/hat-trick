import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { FetchOptions } from "../src/data";
import { PlayerHeadshot } from "../src/ui/components/PlayerHeadshot";
import { CrashScreen, Empty, ErrorView, OfflineBanner, UpdatedAt } from "../src/ui/components/States";
import { ListSkeleton } from "../src/ui/components/Skeleton";
import { TeamLogo } from "../src/ui/components/TeamLogo";
import { spotlightDetail } from "../src/ui/leaders";
import { LEAGUE, useSportsData } from "../src/ui/sports-data-context";
import { useColors, DIVIDER } from "../src/ui/theme";
import { usePolled } from "../src/ui/use-polled";

/** A spotlight screen that fails to render keeps the header, so Back still returns to Leaders. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/** The players the league is featuring right now, in its order. Each opens the player page. */
export default function SpotlightScreen() {
  const sports = useSportsData();
  const colors = useColors();
  const router = useRouter();
  const spotlight = usePolled("spotlight", (o: FetchOptions) => sports.getSpotlight(LEAGUE, o));

  if (spotlight.loading) return <ListSkeleton />;
  if (!spotlight.data) {
    return (
      <ErrorView
        title="Couldn't load the spotlight"
        error={spotlight.error ?? new Error("Unknown error")}
        onRetry={spotlight.refresh}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <OfflineBanner meta={spotlight.meta} />
      <FlatList
        data={spotlight.data}
        keyExtractor={(e) => e.player.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={spotlight.refreshing} onRefresh={spotlight.refresh} colors={[colors.accent]} />
        }
        ListHeaderComponent={
          <Text style={[styles.intro, { color: colors.muted }]}>Players the NHL is featuring right now.</Text>
        }
        ListEmptyComponent={<Empty message="The NHL isn't featuring any players right now." />}
        renderItem={({ item, index }) => {
          const detail = spotlightDetail(item);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/player/[id]", params: { id: item.player.id } })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
                index > 0 && { borderTopColor: colors.border, borderTopWidth: DIVIDER },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.player.name}, ${detail}. Open player page`}
            >
              <PlayerHeadshot player={item.player} size={48} />
              <View style={styles.main}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.player.name}
                </Text>
                <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>
                  {detail}
                </Text>
              </View>
              <TeamLogo team={item.team} size={28} />
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        }}
        ListFooterComponent={<UpdatedAt meta={spotlight.meta} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: 16 },
  intro: { fontSize: 13, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  main: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600" },
  detail: { fontSize: 13, marginTop: 2 },
});
