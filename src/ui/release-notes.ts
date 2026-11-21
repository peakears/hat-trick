/**
 * Turns a GitHub release body (the Markdown release-please writes) into plain sections for the
 * "What's new" sheet. Pure, so it is unit tested. Only the shapes release-please produces are
 * understood: `### Heading` lines and `*` or `-` bullets. Anything else is skipped.
 */

export interface ReleaseNoteSection {
  title: string;
  items: string[];
}

/** Longest body kept: the notes are shown in a sheet and stored with the update state. */
export const MAX_NOTES_LENGTH = 20_000;

// release-please's headings, in words that make sense to someone who doesn't read commit types.
const TITLES: Record<string, string> = {
  Features: "New",
  "Bug Fixes": "Fixes",
  "Performance Improvements": "Faster",
  Reverts: "Reverted",
};

/** One bullet as plain text: no scope prefix, no issue or commit links, no Markdown. */
export function cleanNoteItem(text: string): string {
  return (
    text
      // Trailing "([#71](...))" and "([1ee1e41](...))" links.
      .replace(/(\s*\(\[[^\]]*\]\([^)]*\)\))+\s*$/, "")
      // Leading "**app:** " scope.
      .replace(/^\*\*[^*]+:\*\*\s*/, "")
      // Remaining "[text](url)" links keep their text.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim()
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The sections of a release body, in order; sections without items are dropped. */
export function parseReleaseNotes(body: string | undefined): ReleaseNoteSection[] {
  if (!body) return [];
  const sections: ReleaseNoteSection[] = [];
  let current: ReleaseNoteSection | undefined;
  for (const line of body.slice(0, MAX_NOTES_LENGTH).split(/\r?\n/)) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const title = heading[1].trim();
      current = { title: TITLES[title] ?? title, items: [] };
      sections.push(current);
      continue;
    }
    const bullet = /^\s*[*-]\s+(.+)$/.exec(line);
    if (bullet) {
      const item = cleanNoteItem(bullet[1]);
      if (!item) continue;
      if (!current) {
        current = { title: "Changes", items: [] };
        sections.push(current);
      }
      current.items.push(capitalize(item));
    }
  }
  return sections.filter((s) => s.items.length > 0);
}
