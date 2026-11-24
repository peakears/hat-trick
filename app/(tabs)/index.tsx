import { useState } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { WeekStrip } from "../../src/ui/components/WeekStrip";
import { GameCard } from "../../src/ui/components/GameCard";
import { LeagueBar } from "../../src/ui/components/LeagueBar";
import { Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ScoresSkeleton } from "../../src/ui/components/Skeleton";
import { ShieldBanner } from "../../src/ui/components/ShieldBanner";
import { UpdateBanner } from "../../src/ui/components/UpdateBanner";
import { addDays, groupGamesForScores } from "../../src/ui/common/format";
import { useSettings } from "../../src/ui/settings/settings-context";
import { useSportsData } from "../../src/ui/data/sports-data-context";
import { useLeague } from "../../src/ui/data/use-league";
import { favoritesFor } from "../../src/ui/team/favorites";
import { useColors, useScheme, DIVIDER } from "../../src/ui/theme/theme";
import type { Game, LeagueId } from "../../src/domain";
import { showLeagueRow, dayCount } from "../../src/ui/leagues/league-row";
import { allLeaguesSections } from "../../src/ui/scores/all-leagues";
import { useLeagueDays, type LeagueDayPolled } from "../../src/ui/scores/use-league-days";
import { leagueTint } from "../../src/ui/theme/palette";

import { useDebounced } from "../../src/ui/common/use-debounced";
import { eventWeekStart, withSpecialEvents } from "../../src/ui/scores/special-events";
import { useDaySwipe } from "../../src/ui/scores/use-swipe";
import { useScoresToday } from "../../src/ui/scores/use-today";

/** How long the date must stay put before its scores are loaded. */
const DAY_SETTLE_MS = 250;

export default function ScoresScreen() {
  const sports = useSportsData();
  const league = useLeague();
  const colors = useColors();
  const scheme = useScheme();
  const { settings, update } = useSettings();
  const today = useScoresToday();
  // null means "follow today", so the list moves on to the new day instead of staying on yesterday.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const go = (d: string) => setPicked(d === today ? null : d);
  // Swiping or tapping through days quickly only loads the day you stop on, not every one passed.
  const settledDate = useDebounced(date, DAY_SETTLE_MS);
  const switching = settledDate !== date;
  const leagues = sports.leagues();
  // Every league's day: the All view lists them, and the league row counts each one's games. Special event tags come
  // from a separate week lookup (the scores do not carry them); best effort, so if it fails the cards have no tag.
  const days = useLeagueDays(leagues, settledDate, eventWeekStart(settledDate));
  const allView = showLeagueRow(leagues) && settings.scoresAllLeagues;
  // The single-league view's day, and what the banners and the footer describe in the All view (the first league
  // that loaded, or an offline one).
  const day = days.find((d) => d.league === league) ?? days[0];
  const shownDays = allView ? days : [day];
  const swipe = useDaySwipe((step) => go(addDays(date, step)));

  // Rebuilt on each render: `days` is new each time, and the lists are a day's games, so this is cheap.
  const sections: ListSection[] | undefined = (() => {
    const withEvents = (d: LeagueDayPolled) => d.scores.data && withSpecialEvents(d.scores.data, d.events.data);
    if (allView) {
      if (days.every((d) => d.scores.loading)) return undefined;
      return allLeaguesSections(
        days.map((d) => ({ league: d.league, games: withEvents(d), failed: d.scores.error !== undefined })),
        settings.favoriteTeams,
      ).map((s) => ({ ...s, mixed: s.key === "favorites" }));
    }
    // Favourite teams' games first, then live games on top and finished ones below, each group under its own
    // header; regrouped on each poll as games start and end.
    const games = withEvents(day);
    return games && groupGamesForScores(games, favoritesFor(day.league, settings.favoriteTeams));
  })();
  const games = sections?.flatMap((s) => s.data);
  const loading = switching || (allView ? sections === undefined : day.scores.loading);
  const failedAll = shownDays.every((d) => !d.scores.data && d.scores.error);
  const offline = shownDays.find((d) => d.scores.meta?.error)?.scores.meta;
  const footer = shownDays.find((d) => d.scores.meta)?.scores.meta;
  const refresh = () => shownDays.forEach((d) => d.scores.refresh());
  const counts = Object.fromEntries(days.map((d) => [d.league, dayCount(d.scores.data)]));

  return (
    <View style={styles.screen} {...swipe.panHandlers}>
      <LeagueBar counts={counts} all={{ selected: allView, onPress: () => update({ scoresAllLeagues: true }) }} />
      <WeekStrip date={date} today={today} onPick={go} onToday={() => setPicked(null)} />
      <UpdateBanner />
      <ShieldBanner games={games} />
      <OfflineBanner meta={offline} />

      {loading ? (
        <ScoresSkeleton />
      ) : failedAll ? (
        <ErrorView
          title="Couldn't load scores"
          error={shownDays.find((d) => d.scores.error)?.scores.error ?? new Error("Unknown error")}
          onRetry={refresh}
        />
      ) : (
        <SectionList<Game, ListSection>
          sections={sections ?? []}
          keyExtractor={(g) => `${g.league}:${g.id}`}
          renderItem={({ item, section }) => <GameCard game={item} showLeague={section.mixed === true} />}
          renderSectionHeader={({ section }) =>
            section.league ? (
              <View style={styles.leagueHeader} accessible accessibilityRole="header">
                <Text style={[styles.leagueTitle, { color: leagueTint(section.league, scheme) }]}>{section.title}</Text>
                {section.summary && (
                  <Text style={[styles.leagueTitle, { color: colors.muted }]}>{section.summary.toUpperCase()}</Text>
                )}
              </View>
            ) : (
              <Text
                style={[styles.sectionTitle, { color: section.key === "live" ? colors.live : colors.muted }]}
                accessibilityRole="header"
              >
                {section.title.toUpperCase()}
              </Text>
            )
          }
          renderSectionFooter={({ section }) =>
            section.note ? <Text style={[styles.note, { color: colors.muted }]}>{section.note}</Text> : null
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={shownDays.some((d) => d.scores.refreshing)}
              onRefresh={refresh}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={<Empty message="No games on this date." />}
          ListFooterComponent={<UpdatedAt meta={footer} />}
        />
      )}
    </View>
  );
}

/** A section of either view: the single league's status groups, or the All view's leagues. */
type ListSection = {
  key: string;
  title: string;
  data: Game[];
  league?: LeagueId;
  summary?: string;
  note?: string;
  /** Games from more than one league: each card names its league. */
  mixed?: boolean;
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingVertical: 3 },
  leagueHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 2,
  },
  leagueTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  note: { fontSize: 14, marginHorizontal: 16, marginVertical: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
  },
});
