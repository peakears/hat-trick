import { useLocales } from "expo-localization";
import { useCallback } from "react";
import { spell, spellingForRegion } from "./spelling";

/**
 * `s(text)`: the text in the phone region's spelling (American on US phones, Canadian elsewhere). Follows the phone's
 * region, not the TV channel country, so picking US channels while travelling does not change the spelling.
 */
export function useSpelling(): (text: string) => string {
  const region = useLocales()[0]?.regionCode;
  const spelling = spellingForRegion(region);
  return useCallback((text: string) => spell(text, spelling), [spelling]);
}
