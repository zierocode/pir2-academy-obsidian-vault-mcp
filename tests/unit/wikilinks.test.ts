import { describe, expect, it } from "vitest";

async function api() {
  return import("../../src/graph/wikilinks.js");
}

describe("Obsidian wikilink parser", () => {
  it("parses links, headings, block references, aliases, and embeds", async () => {
    const { parseWikiLinks } = await api();
    const links = parseWikiLinks("ดู [[โครงการ/ภาพรวม#มติ|มติล่าสุด]] และ ![[90 แหล่งข้อมูล/ภาพ.png]] กับ [[โน้ต^block-1]]");

    expect(links).toEqual([
      { rawTarget: "โครงการ/ภาพรวม#มติ", target: "โครงการ/ภาพรวม", heading: "มติ", alias: "มติล่าสุด", embed: false },
      { rawTarget: "90 แหล่งข้อมูล/ภาพ.png", target: "90 แหล่งข้อมูล/ภาพ.png", embed: true },
      { rawTarget: "โน้ต^block-1", target: "โน้ต", block: "block-1", embed: false }
    ]);
  });

  it("ignores wikilink-shaped text inside fenced and inline code", async () => {
    const { parseWikiLinks } = await api();
    const links = parseWikiLinks("จริง [[A]] `[[B]]`\n```md\n[[C]]\n```\nจริง [[D]]");

    expect(links.map((link) => link.target)).toEqual(["A", "D"]);
  });
});
