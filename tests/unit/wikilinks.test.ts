import { describe, expect, it } from "vitest";

type ParsedLink = {
  raw: string;
  target: string;
  display?: string;
  heading?: string;
  block?: string;
  embed: boolean;
};

type WikilinkApi = {
  normalizeIndexedPath(path: string): string;
  parseWikilinks(content: string): ParsedLink[];
};

async function loadApi(): Promise<WikilinkApi | undefined> {
  try {
    return (await import("../../src/vault/wikilinks.js")) as WikilinkApi;
  } catch {
    return undefined;
  }
}

describe("Obsidian Wikilinks", () => {
  it("normalizes Windows index paths before resolving nested basename links", async () => {
    const api = await loadApi();

    expect(api).toBeDefined();
    expect(api?.normalizeIndexedPath("Projects\\Core.md")).toBe("Projects/Core.md");
  });

  it("parses Thai targets, aliases, headings, blocks and embeds", async () => {
    const api = await loadApi();

    expect(api).toBeDefined();
    expect(
      api?.parseWikilinks(
        "[[02 โปรเจกต์/สาขาใหม่|โปรเจกต์]] [[มติล่าสุด#อนุมัติ]] [[ประชุม#^decision-1]] ![[ภาพ.png]]"
      )
    ).toEqual([
      {
        raw: "[[02 โปรเจกต์/สาขาใหม่|โปรเจกต์]]",
        target: "02 โปรเจกต์/สาขาใหม่",
        display: "โปรเจกต์",
        embed: false
      },
      {
        raw: "[[มติล่าสุด#อนุมัติ]]",
        target: "มติล่าสุด",
        heading: "อนุมัติ",
        embed: false
      },
      {
        raw: "[[ประชุม#^decision-1]]",
        target: "ประชุม",
        block: "decision-1",
        embed: false
      },
      { raw: "![[ภาพ.png]]", target: "ภาพ.png", embed: true }
    ]);
  });
});

