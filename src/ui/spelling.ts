/**
 * Canadian or American spelling of the few words the app uses that differ (favourite, colour, centre, defence,
 * travelling). Phones set to the US get American spelling; every other region keeps the Canadian spelling the app is
 * written in. Pure, tested in spelling.test.ts. A full translation (#86) would replace this.
 */

export type Spelling = "canadian" | "american";

/** Canadian form, American form. Lower case; plurals and a capital first letter are handled by `spell`. */
const WORDS: [string, string][] = [
  ["favourite", "favorite"],
  ["colour", "color"],
  ["centre", "center"],
  ["defence", "defense"],
  ["travelling", "traveling"],
];

const PATTERN = new RegExp(`\\b(${WORDS.flat().join("|")})(s?)\\b`, "gi");
const TO: Record<Spelling, Map<string, string>> = {
  canadian: new Map(
    WORDS.flatMap(
      ([ca, us]) =>
        [
          [ca, ca],
          [us, ca],
        ] as [string, string][],
    ),
  ),
  american: new Map(
    WORDS.flatMap(
      ([ca, us]) =>
        [
          [ca, us],
          [us, us],
        ] as [string, string][],
    ),
  ),
};

/** American for a US phone region ("US"), Canadian for any other or an unknown region. */
export function spellingForRegion(region: string | null | undefined): Spelling {
  return region?.toUpperCase() === "US" ? "american" : "canadian";
}

/** `text` with each listed word in the chosen spelling, keeping a capital first letter and a plural "s". */
export function spell(text: string, spelling: Spelling): string {
  return text.replace(PATTERN, (_match, word: string, plural: string) => {
    const target = TO[spelling].get(word.toLowerCase()) ?? word;
    const cased = word[0] === word[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target;
    return cased + plural;
  });
}
