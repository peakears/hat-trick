import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useSettings } from "./settings-context";
import { useColors } from "./theme";
import { isOpenableVideoUrl } from "./videos";
import { openVideo } from "./videos-native";

/**
 * Opens a video the way the user chose in Settings: on the in-app video screen (`app/video.tsx`), or in a browser tab.
 * `title` is the video screen's header ("Recap", "Goal: M. Zuccarello").
 */
export function useOpenVideo(): (url: string, title: string) => void {
  const router = useRouter();
  const colors = useColors();
  const { settings } = useSettings();
  const inApp = settings.playVideosInApp;
  return useCallback(
    (url: string, title: string) => {
      if (!isOpenableVideoUrl(url)) return;
      if (inApp) router.push({ pathname: "/video", params: { url, title } });
      else void openVideo(url, colors.card);
    },
    [inApp, router, colors.card],
  );
}
