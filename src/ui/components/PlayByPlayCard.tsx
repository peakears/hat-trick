import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { cardPlays, playPeriodLabels, shownPeriod } from "../game/plays";
import { NHL, useSportsData } from "../data/sports-data-context";
import { usePolled } from "../data/use-polled";
import { useColors, DIVIDER } from "../theme/theme";
import { PlayRow } from "./PlayRow";
import { Segmented } from "./Segmented";
import { Bone } from "./Skeleton";

/**
 * The game page's play-by-play: a tab per period played, a few of that period's plays (the latest first while the
 * game is live, following it into each new period until a tab is picked), and "See all plays" for the full page.
 * Its own request, so a failure here never hides the rest of the game page; the full page shares its cache entry.
 * The game page leaves it out while the spoiler shield hides the game.
 */
export function PlayByPlayCard({ game }: { game: Game }) {
  const sports = useSportsData();
  const colors = useColors();
  const router = useRouter();
  const plays = usePolled(`plays:${game.id}`, (o) => sports.getPlays(NHL, game.id, o));
  const [picked, setPicked] = useState<string>();
  const live = game.status === "live";

  const open = () => router.push({ pathname: "/game/[id]/plays", params: { id: game.id } });

  let body;
  if (!plays.data) {
    body = plays.loading ? (
      <View style={styles.loading} accessibilityLabel="Loading the play-by-play">
        {[78, 62, 70].map((w, i) => (
          <Bone key={i} width={`${w}%`} height={13} />
        ))}
      </View>
    ) : (
      <View style={styles.message}>
        <Text style={[styles.messageText, { color: colors.text }]}>Couldn't load the play-by-play.</Text>
        <Pressable onPress={plays.refresh} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: colors.accent }]}>Try again</Text>
        </Pressable>
      </View>
    );
  } else {
    const labels = playPeriodLabels(plays.data.plays);
    const period = shownPeriod(labels, picked, live);
    const { shown } = cardPlays(plays.data.plays, period, live);
    body = (
      <>
        {labels.length > 1 && (
          <View style={styles.tabs}>
            <Segmented
              options={labels.map((l) => ({ value: l, label: l }))}
              value={period ?? labels[0]}
              onChange={setPicked}
            />
          </View>
        )}
        {shown.length === 0 ? (
          <Text style={[styles.messageText, styles.message, { color: colors.muted }]}>No plays yet.</Text>
        ) : (
          <View>
            {shown.map((p, i) => (
              <PlayRow key={p.id} play={p} game={plays.data!.game} first={i === 0} />
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]} accessibilityRole="header">
        Play-by-play
      </Text>
      {body}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="See all plays"
        style={[styles.all, { borderTopColor: colors.border }]}
        hitSlop={4}
      >
        <Text style={[styles.link, { color: colors.accent }]}>See all plays ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginHorizontal: 12, marginTop: 8, marginBottom: 4, paddingHorizontal: 12 },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingTop: 12, paddingBottom: 6 },
  // Segmented brings its own 12-point margins for full-width use; inside the card, undo most of them.
  tabs: { marginHorizontal: -12, marginTop: -10, marginBottom: -6 },
  loading: { gap: 12, paddingVertical: 10 },
  message: { paddingVertical: 10, gap: 6 },
  messageText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "700" },
  all: { alignItems: "center", paddingVertical: 10, borderTopWidth: DIVIDER },
});
