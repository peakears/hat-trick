import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game, GameSide } from "../../domain";
import { useSportsData } from "../data/sports-data-context";
import { favoritesFor, isFavorite } from "../team/favorites";
import { winner } from "../common/format";
import { gameRoute } from "../common/routes";
import { channelsFor, channelsLabel, showsChannelsOnCard } from "../game/broadcasts";
import { useSettings } from "../settings/settings-context";
import { useSpoilers } from "../spoilers/spoiler-context";
import { tabular, useColors, useScheme } from "../theme/theme";
import { leagueTint } from "../theme/palette";
import { scoreFont } from "../theme/fonts";
import { useTvRegion } from "../game/use-tv-region";
import { showLiveDetail, standoutText } from "../scores/game-card";
import { ChannelLine } from "./ChannelLine";
import { FlashScore } from "./FlashScore";
import { PeriodTable } from "./PeriodTable";
import { RevealButton } from "./ShieldUi";
import { SpecialEventTag } from "./SpecialEventTag";
import { TeamLogo } from "./TeamLogo";

/**
 * One game in the scores list: away team on top, home below, status on the right. `showLeague` names the league
 * above the teams, for a list that mixes leagues ("Your teams" in the All view).
 */
export function GameCard({ game, showLeague = false }: { game: Game; showLeague?: boolean }) {
  const colors = useColors();
  const scheme = useScheme();
  const router = useRouter();
  const { settings } = useSettings();
  const sports = useSportsData();
  const favorites = favoritesFor(game.league, settings.favoriteTeams);
  // Only leagues with a game page open one.
  const opens = sports.supports(game.league, "gameDetail");
  const spoilers = useSpoilers();
  const hidden = spoilers.isHidden(game);
  const statusLabel = spoilers.statusLabel(game);
  // A hidden game must not give the winner away through bold or dimmed names either.
  const won = hidden ? undefined : winner(game);
  const live = game.status === "live";
  // The colour alone says "favourite", so say it in words for screen readers too.
  const favoriteNames = [game.away, game.home]
    .filter((side) => isFavorite(favorites, side.team.id))
    .map((side) => side.team.name);
  const favoriteNote = favoriteNames.length > 0 ? `. Favourite: ${favoriteNames.join(", ")}` : "";
  const region = useTvRegion();
  const channels = showsChannelsOnCard(game.status) ? channelsFor(game, region) : [];
  const showScores = game.status !== "scheduled" && game.status !== "postponed";
  const detail = showLiveDetail(game, hidden);
  const standout = detail && game.standout ? standoutText(game.standout) : undefined;

  const row = (side: GameSide, which: "home" | "away") => {
    const dim = won !== undefined && won !== which;
    const favorite = isFavorite(favorites, side.team.id);
    return (
      <View style={styles.teamRow}>
        <TeamLogo team={side.team} size={28} />
        <Text
          numberOfLines={1}
          // A favourite team's name is drawn in the accent colour, even when it lost and the rest is dimmed.
          style={[
            styles.teamName,
            { color: favorite ? colors.accent : dim ? colors.muted : colors.text },
            (favorite || (!dim && won)) && styles.bold,
          ]}
        >
          {side.team.name}
        </Text>
        {!showScores && side.record && (
          // Before puck drop there is no score, so the season record takes that spot.
          <Text style={[styles.record, tabular, { color: colors.muted }]} accessibilityLabel={`Record ${side.record}`}>
            {side.record}
          </Text>
        )}
        {showScores && (
          <FlashScore
            value={side.score}
            live={live && !hidden}
            containerStyle={styles.scoreBox}
            style={[styles.score, scoreFont, { color: dim || hidden ? colors.muted : colors.text }]}
          >
            {hidden ? "•" : (side.score ?? "-")}
          </FlashScore>
        )}
      </View>
    );
  };

  return (
    // Not <Link asChild>: its Slot merges styles by spreading them, which drops a style function
    // like the one below (pressed state), so the card would lose all of its styling.
    <Pressable
      onPress={opens ? () => router.push(gameRoute(game)) : undefined}
      disabled={!opens}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole={opens ? "button" : undefined}
      accessibilityLabel={`${game.specialEvent ? `${game.specialEvent}. ` : ""}${game.away.team.name} at ${game.home.team.name}, ${statusLabel}${hidden ? ". Score hidden" : ""}${favoriteNote}${standout ? `. ${standout.spoken}` : ""}${channels.length > 0 ? `. On TV: ${channelsLabel(channels)}` : ""}`}
    >
      <View style={styles.main}>
        <View style={styles.teams}>
          {showLeague && (
            <Text style={[styles.league, { color: leagueTint(game.league, scheme) }]}>{game.league.toUpperCase()}</Text>
          )}
          <SpecialEventTag name={game.specialEvent} />
          {row(game.away, "away")}
          {row(game.home, "home")}
        </View>
        <View style={[styles.status, { borderLeftColor: colors.border }]}>
          {live && <Text style={[styles.liveDot, { color: colors.live }]}>● LIVE</Text>}
          <Text style={[styles.statusText, tabular, { color: live ? colors.text : colors.muted }]}>{statusLabel}</Text>
          {hidden && <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />}
        </View>
      </View>
      {detail && (
        // Each period's score and the standout, live only. Part of the card's spoken label, so hidden from readers.
        <View style={styles.detail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <PeriodTable game={game} compact />
          {standout && (
            <Text numberOfLines={1} style={[styles.standout, { color: colors.text }]}>
              <Text style={{ color: colors.muted }}>Top performer · </Text>
              {standout.shown}
            </Text>
          )}
        </View>
      )}
      <ChannelLine channels={channels} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    // A visible outline plus a wide gap keeps each game apart, even when the card is close to the
    // background (dark mode).
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 9,
  },
  main: { flexDirection: "row", paddingVertical: 12, paddingLeft: 14 },
  teams: { flex: 1, gap: 8 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamName: { flex: 1, fontSize: 16 },
  bold: { fontWeight: "700" },
  record: { fontSize: 13, fontWeight: "600", marginRight: 12 },
  // Room for two digits keeps the scores lined up; the number sits at the right and the flash glow hugs it.
  scoreBox: { marginRight: 12, minWidth: 28, alignItems: "flex-end" },
  score: { fontSize: 22, textAlign: "right" },
  status: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  liveDot: { fontSize: 11, fontWeight: "700" },
  league: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: -4 },
  detail: { gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  standout: { fontSize: 13 },
  statusText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
