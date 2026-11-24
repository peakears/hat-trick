import { ScrollView, StyleSheet } from "react-native";
import { FavoriteTeamsList } from "../src/ui/components/FavoriteTeamsList";

/** Settings › Favourite teams: each favourite with its own reminders and live scores switches (FavoriteTeamsList). */
export default function FavoritesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FavoriteTeamsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4 },
});
