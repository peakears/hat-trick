import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { FetchOptions } from "../../src/data";
import { Segmented } from "../../src/ui/components/Segmented";
import { ErrorView, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ListSkeleton } from "../../src/ui/components/Skeleton";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { statValue } from "../../src/ui/common/format";
import { LEADERS_MAX, leaderSectionKey, leaderValue, visibleLeaders } from "../../src/ui/leaders/leaders";
import { combineFetched } from "../../src/ui/data/polling";
import { useSportsData } from "../../src/ui/data/sports-data-context";
import { useLeague } from "../../src/ui/data/use-league";
import { tabular, useColors, DIVIDER } from "../../src/ui/theme/theme";
import { usePolled } from "../../src/ui/data/use-polled";
import { playerRoute } from "../../src/ui/common/routes";

export default function LeadersScreen() {
  const sports = useSportsData();
  const league = useLeague();
  const colors = useColors();
  const router = useRouter();
  // The league's groups of boards (the NHL's Skaters and Goalies; one group needs no picker).
  const groups = sports.leaderGroups(league);
  const [picked, setPicked] = useState<string>(groups[0].id);
  const group = groups.find((g) => g.id === picked) ?? groups[0];
  const kind = group.id;
  // Categories opened with "Show more". Kept while switching between groups.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const leaders = usePolled(`${league}:leaders:${kind}`, async (o: FetchOptions) => {
    const { categories } = group;
    if (!categories) return sports.getLeaders(league, { limit: LEADERS_MAX }, o);
    const results = await Promise.all(
      categories.map((category) => sports.getLeaders(league, { category, limit: LEADERS_MAX }, o)),
    );
    const combined = combineFetched(results);
    return { data: combined.data.flat(), meta: combined.meta };
  });

  // Only leagues with a player page open one.
  const opensPlayer = sports.supports(league, "player");

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sections = (leaders.data ?? []).map((b) => {
    const key = leaderSectionKey(kind, b.category);
    const isExpanded = expanded.has(key);
    const { shown, hasMore } = visibleLeaders(b.entries, isExpanded);
    return {
      title: b.label,
      key,
      format: b.format,
      decimals: b.decimals,
      data: shown,
      hasMore,
      expanded: isExpanded,
    };
  });

  return (
    <View style={styles.screen}>
      {sports.supports(league, "spotlight") && (
        <Pressable
          onPress={() => router.push("/spotlight")}
          style={({ pressed }) => [styles.spotlight, { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Player spotlight: players the league is featuring right now"
        >
          <Ionicons name="star" size={18} color={colors.accent} />
          <View style={styles.spotlightText}>
            <Text style={[styles.spotlightTitle, { color: colors.text }]}>Player spotlight</Text>
            <Text style={[styles.spotlightDetail, { color: colors.muted }]}>
              Players the league is featuring right now
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      )}
      {groups.length > 1 && (
        <Segmented options={groups.map((g) => ({ value: g.id, label: g.label }))} value={kind} onChange={setPicked} />
      )}
      <OfflineBanner meta={leaders.meta} />
      {leaders.loading ? (
        <ListSkeleton />
      ) : !leaders.data && leaders.error ? (
        <ErrorView title="Couldn't load leaders" error={leaders.error} onRetry={leaders.refresh} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e, i) => `${e.player.id}-${i}`}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={leaders.refreshing} onRefresh={leaders.refresh} colors={[colors.accent]} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.header, { color: colors.text, backgroundColor: colors.background }]}>
              {section.title}
            </Text>
          )}
          renderSectionFooter={({ section }) =>
            section.hasMore ? (
              <Pressable
                onPress={() => toggle(section.key)}
                hitSlop={4}
                style={({ pressed }) => [styles.toggle, { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: section.expanded }}
                accessibilityLabel={`${section.expanded ? "Show fewer" : "Show more"} in ${section.title}`}
              >
                <Text style={[styles.toggleText, { color: colors.accent }]}>
                  {section.expanded ? "Show fewer" : "Show more"}
                </Text>
                <Ionicons name={section.expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.accent} />
              </Pressable>
            ) : null
          }
          renderItem={({ item, section }) => (
            <Pressable
              onPress={opensPlayer ? () => router.push(playerRoute(item.player)) : undefined}
              disabled={!opensPlayer}
              accessibilityRole={opensPlayer ? "button" : undefined}
              accessibilityLabel={`${item.rank}. ${item.player.name}, ${item.team.abbrev}, ${leaderValue(item.value, section.format, statValue, section.decimals)}${opensPlayer ? ". Open player page" : ""}`}
              style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            >
              <Text style={[styles.rank, tabular, { color: colors.muted }]}>{item.rank}</Text>
              <TeamLogo team={item.team} size={24} />
              <View style={styles.who}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15 }}>
                  {item.player.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.team.abbrev}</Text>
              </View>
              <Text style={[styles.value, tabular, { color: colors.text }]}>
                {leaderValue(item.value, section.format, statValue, section.decimals)}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={<UpdatedAt meta={leaders.meta} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  spotlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  spotlightText: { flex: 1 },
  spotlightTitle: { fontSize: 15, fontWeight: "600" },
  spotlightDetail: { fontSize: 12, marginTop: 2 },
  header: { fontSize: 15, fontWeight: "700", paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: DIVIDER,
  },
  rank: { width: 20, textAlign: "right", fontSize: 13 },
  who: { flex: 1 },
  value: { fontSize: 16, fontWeight: "700" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  toggleText: { fontSize: 13, fontWeight: "600" },
});
