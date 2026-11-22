import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game, Standings } from "../../domain";
import { channelsFor, summarizeChannels } from "../broadcasts";
import { teamRecord, timeLabel } from "../format";
import { countdownLabel, daysAwayLabel, nextGameHeading, nextGamePhase, type NextGamePhase } from "../next-game";
import { useSpoilers } from "../spoiler-context";
import { LEAGUE, useSportsData } from "../sports-data-context";
import { teamGameLine } from "../team";
import { tabular, useColors } from "../theme";
import { usePolled } from "../use-polled";
import { useScoresToday } from "../use-today";
import { useTvRegion } from "../use-tv-region";
import { RevealButton } from "./ShieldUi";
import { FlashScore } from "./FlashScore";
import { TeamLogo } from "./TeamLogo";

/** The current time, updated every `ms` while `active` (for the countdown). */
function useNow(active: boolean, ms = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/**
 * The team's next game at the top of its team page: opponent, time and TV before the game, a countdown on game day,
 * and the score and clock while it is live. Opens the game page.
 */
export function NextGameCard({ game, teamId, standings }: { game: Game; teamId: string; standings?: Standings }) {
  // A live game reads the game page's own entry (`game:{id}`, polled every 20 s while live) for the score and
  // clock; the team's schedule only refreshes every minute and has no clock.
  if (game.status === "live") return <LiveNextGame game={game} teamId={teamId} standings={standings} />;
  return <NextGameView game={game} teamId={teamId} standings={standings} />;
}

function LiveNextGame({ game, teamId, standings }: { game: Game; teamId: string; standings?: Standings }) {
  const sports = useSportsData();
  const detail = usePolled(`game:${game.id}`, (o) => sports.getGameDetail(LEAGUE, game.id, o));
  // Best effort: if the game's own request fails, the schedule's copy still shows.
  return <NextGameView game={detail.data?.game ?? game} teamId={teamId} standings={standings} />;
}

function NextGameView({ game, teamId, standings }: { game: Game; teamId: string; standings?: Standings }) {
  const colors = useColors();
  const router = useRouter();
  const spoilers = useSpoilers();
  const region = useTvRegion();
  const today = useScoresToday();
  // Before puck drop the countdown and "Tonight" move with the clock; after it, the polls re-render.
  const now = useNow(game.status === "scheduled");
  const phase = nextGamePhase(game, now, today);
  const heading = nextGameHeading(game, phase, today);
  const line = teamGameLine(game, teamId, false);
  const hidden = spoilers.isHidden(game);
  const started = phase === "live" || phase === "final";

  const tint: Record<NextGamePhase, string> = {
    later: colors.cardBorder,
    gameDay: colors.accent,
    starting: colors.accent,
    live: colors.live,
    final: colors.cardBorder,
  };
  const titleColor =
    phase === "live" ? colors.live : phase === "gameDay" || phase === "starting" ? colors.accent : colors.muted;
  const { shown, more } = summarizeChannels(channelsFor(game, region));
  const tv = shown.map((c) => c.network).join(", ") + (more > 0 ? ` +${more}` : "");
  const record = teamRecord(standings, line.opponent);
  const open = () => router.push({ pathname: "/game/[id]", params: { id: game.id } });

  const opponent = `${line.home ? "vs" : "@"} ${line.opponent.name}`;
  const spoken = [
    heading.title,
    heading.date,
    opponent,
    started
      ? hidden
        ? "score hidden"
        : `${game.away.team.abbrev} ${game.away.score}, ${game.home.team.abbrev} ${game.home.score}`
      : timeLabel(game.startTime),
    tv && `on ${tv}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${spoken}. Open game`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: tint[phase], opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.headRow}>
        <View style={styles.titleRow}>
          {phase === "live" && <View style={[styles.dot, { backgroundColor: colors.live }]} />}
          <Text style={[styles.title, { color: titleColor }]}>{heading.title}</Text>
        </View>
        <Text style={[styles.headRight, tabular, { color: phase === "live" ? colors.live : colors.muted }]}>
          {started ? spoilers.statusLabel(game) : (heading.date ?? game.venue?.name ?? "")}
        </Text>
      </View>

      {started ? (
        <View style={styles.scoreRow}>
          <Side game={game} side="away" />
          {hidden ? (
            <View style={styles.hiddenBox}>
              <Text style={[styles.hiddenText, { color: colors.muted }]}>Score hidden</Text>
              <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />
            </View>
          ) : (
            <View style={styles.scorePair}>
              <FlashScore
                value={game.away.score}
                live={phase === "live"}
                style={[styles.score, tabular, { color: colors.text }]}
              >
                {game.away.score ?? "-"}
              </FlashScore>
              <Text style={[styles.score, { color: colors.text }]}>–</Text>
              <FlashScore
                value={game.home.score}
                live={phase === "live"}
                style={[styles.score, tabular, { color: colors.text }]}
              >
                {game.home.score ?? "-"}
              </FlashScore>
            </View>
          )}
          <Side game={game} side="home" />
        </View>
      ) : (
        <View style={styles.matchRow}>
          <TeamLogo team={line.opponent} size={44} />
          <View style={styles.matchText}>
            <Text style={[styles.opponent, { color: colors.text }]} numberOfLines={1}>
              {opponent}
            </Text>
            <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
              {[line.home ? "Home" : "Away", phase === "later" ? record : timeLabel(game.startTime)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          {phase === "later" && (
            <View style={styles.when}>
              <Text style={[styles.time, tabular, { color: colors.text }]}>{timeLabel(game.startTime)}</Text>
              {daysAwayLabel(game, today) && (
                <Text style={[styles.sub, { color: colors.muted }]}>{daysAwayLabel(game, today)}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {phase === "gameDay" && (
        <View style={[styles.countdown, { backgroundColor: colors.background }]}>
          <Text style={[styles.countdownLabel, { color: colors.muted }]}>Puck drop in</Text>
          <Text style={[styles.countdownValue, tabular, { color: colors.text }]}>
            {countdownLabel(game.startTime, now)}
          </Text>
        </View>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.sub, { color: colors.muted, flex: 1 }]} numberOfLines={1}>
          {tv ? `TV: ${tv}` : ""}
        </Text>
        <Text style={[styles.link, { color: colors.accent }]}>Game page ›</Text>
      </View>
    </Pressable>
  );
}

/** One team in the live layout: logo and shots on goal (hidden with the score). */
function Side({ game, side }: { game: Game; side: "home" | "away" }) {
  const colors = useColors();
  const spoilers = useSpoilers();
  const s = game[side];
  return (
    <View style={styles.side}>
      <TeamLogo team={s.team} size={44} />
      {s.shotsOnGoal !== undefined && !spoilers.isHidden(game) && (
        <Text style={[styles.sog, tabular, { color: colors.muted }]}>SOG {s.shotsOnGoal}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  headRight: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  matchText: { flex: 1, gap: 2 },
  opponent: { fontSize: 16, fontWeight: "700" },
  sub: { fontSize: 13 },
  when: { alignItems: "flex-end", gap: 2 },
  time: { fontSize: 18, fontWeight: "800" },
  countdown: { borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 2 },
  countdownLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  countdownValue: { fontSize: 28, fontWeight: "800" },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  side: { width: 72, alignItems: "center", gap: 4 },
  sog: { fontSize: 12 },
  scorePair: { flexDirection: "row", alignItems: "center", gap: 6 },
  score: { fontSize: 34, fontWeight: "800" },
  hiddenBox: { alignItems: "center", gap: 6 },
  hiddenText: { fontSize: 15, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  link: { fontSize: 13, fontWeight: "600" },
});
