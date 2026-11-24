import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";
import type { Team } from "../../domain";
import { isFavorite } from "../team/favorites";
import { useSettings } from "../settings/settings-context";
import { useColors } from "../theme/theme";

/** A star that adds a team to the favourites, or removes it. */
export function FavoriteStar({ team, size = 22 }: { team: Team; size?: number }) {
  const colors = useColors();
  const { settings, toggleFavoriteTeam } = useSettings();
  const favorite = isFavorite(settings.favoriteTeams, team.id);

  return (
    <Pressable
      onPress={() => toggleFavoriteTeam(team.id)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={favorite ? `Remove ${team.name} from favourites` : `Add ${team.name} to favourites`}
      accessibilityState={{ selected: favorite }}
    >
      <Ionicons name={favorite ? "star" : "star-outline"} size={size} color={favorite ? colors.accent : colors.muted} />
    </Pressable>
  );
}
