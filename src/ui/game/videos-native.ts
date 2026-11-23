/**
 * The only `expo-web-browser` code: opens a video page in a browser tab over the app (a Chrome Custom Tab on Android),
 * so Back returns to Hat Trick. Falls back to the default browser if no tab can be shown.
 */

import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { isOpenableVideoUrl } from "./videos";

export async function openVideo(url: string, toolbarColor?: string): Promise<void> {
  if (!isOpenableVideoUrl(url)) return;
  try {
    await WebBrowser.openBrowserAsync(url, { toolbarColor, showTitle: true, enableBarCollapsing: true });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
