import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { scoresToday } from "../common/format";

/**
 * The Scores tab's "Today" (see scoresToday), kept current while the app stays open or sits in
 * the background overnight: checked every minute and whenever the app comes back to the foreground.
 */
export function useScoresToday(): string {
  const [today, setToday] = useState(scoresToday);

  useEffect(() => {
    const check = () => setToday(scoresToday()); // same string: React skips the re-render
    const interval = setInterval(check, 60_000);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return today;
}
