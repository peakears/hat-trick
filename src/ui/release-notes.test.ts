import { describe, expect, it } from "vitest";
import { cleanNoteItem, MAX_NOTES_LENGTH, parseReleaseNotes } from "./release-notes";

// The body release-please wrote for v1.5.0.
const V150 = `## [1.5.0](https://github.com/peakears/hat-trick/compare/v1.4.0...v1.5.0) (2026-11-21)


### Features

* **app:** season stats and recent and upcoming games on the team page ([#71](https://github.com/peakears/hat-trick/issues/71)) ([1ee1e41](https://github.com/peakears/hat-trick/commit/1ee1e41bfe5b11d8ce9f52a77f50b7c6e095017b))
* **app:** team page with record, rank and splits ([#70](https://github.com/peakears/hat-trick/issues/70)) ([b059ce6](https://github.com/peakears/hat-trick/commit/b059ce6315842b98d6b5c988da575edf7b358076))
`;

describe("parseReleaseNotes", () => {
  it("reads a release-please body as plain sections", () => {
    expect(parseReleaseNotes(V150)).toEqual([
      {
        title: "New",
        items: [
          "Season stats and recent and upcoming games on the team page",
          "Team page with record, rank and splits",
        ],
      },
    ]);
  });

  it("renames known headings, keeps unknown ones and drops empty sections", () => {
    const body = "### Bug Fixes\n\n* fix one\n\n### Performance Improvements\n\n### Docs\n\n- docs item\r\n";
    expect(parseReleaseNotes(body)).toEqual([
      { title: "Fixes", items: ["Fix one"] },
      { title: "Docs", items: ["Docs item"] },
    ]);
  });

  it("puts bullets before any heading under Changes", () => {
    expect(parseReleaseNotes("* something\nplain text")).toEqual([{ title: "Changes", items: ["Something"] }]);
  });

  it("returns nothing for an empty or missing body", () => {
    expect(parseReleaseNotes(undefined)).toEqual([]);
    expect(parseReleaseNotes("")).toEqual([]);
    expect(parseReleaseNotes("Just a paragraph.")).toEqual([]);
  });

  it("ignores anything past the length limit", () => {
    const body = `### Features\n* kept\n${" ".repeat(MAX_NOTES_LENGTH)}\n* dropped`;
    expect(parseReleaseNotes(body)).toEqual([{ title: "New", items: ["Kept"] }]);
  });
});

describe("cleanNoteItem", () => {
  it("strips links, scope and Markdown", () => {
    expect(cleanNoteItem("**nhl:** handle `null` in [standings](https://x.example) ([#1](https://x.example/1))")).toBe(
      "handle null in standings",
    );
    expect(cleanNoteItem("a **bold** word")).toBe("a bold word");
  });
});
