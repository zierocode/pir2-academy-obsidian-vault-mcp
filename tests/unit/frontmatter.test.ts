import { describe, expect, it } from "vitest";

async function api() {
  return import("../../src/graph/frontmatter.js");
}

describe("Obsidian frontmatter parser", () => {
  it("returns normalized scalar and list properties without treating tags as executable values", async () => {
    const { parseFrontmatter } = await api();
    const parsed = parseFrontmatter(`---
id: req-001
status: ยืนยันแล้ว
aliases:
  - ข้อกำหนดล่าสุด
  - Current Requirement
relations:
  - "[[ฟีดแบ็กรอบ-3]]"
unsafe: !!js/function "function () { return 1 }"
---
# ข้อกำหนด
เนื้อหา
`);

    expect(parsed.properties).toEqual({
      id: "req-001",
      status: "ยืนยันแล้ว",
      aliases: ["ข้อกำหนดล่าสุด", "Current Requirement"],
      relations: ["[[ฟีดแบ็กรอบ-3]]"]
    });
    expect(parsed.body).toBe("# ข้อกำหนด\nเนื้อหา\n");
    expect(JSON.stringify(parsed)).not.toContain("function ()");
  });

  it("treats malformed or non-object frontmatter as untrusted body instead of throwing", async () => {
    const { parseFrontmatter } = await api();
    const source = "---\n[not: valid\n---\nbody\n";

    expect(parseFrontmatter(source)).toEqual({ properties: {}, body: source });
  });
});
