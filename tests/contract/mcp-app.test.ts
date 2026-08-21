import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RESOURCE_URI = "ui://pir2-academy-obsidian-vault/second-brain-workspace.html";

describe("Second Brain MCP App contract", () => {
  it("adds one Thai-first rendering tool without removing the six safe vault tools", async () => {
    const contracts = await import("../../src/contracts.js");

    expect(contracts.TOOL_NAMES).toEqual([
      "obsidian_vault_status",
      "search_obsidian_notes",
      "read_obsidian_notes",
      "preview_obsidian_note_write",
      "apply_obsidian_note_write",
      "open_obsidian_note",
      "render_second_brain_workspace"
    ]);
    expect(contracts.TOOL_DEFINITIONS.at(-1)).toMatchObject({
      name: "render_second_brain_workspace",
      description: expect.stringMatching(/[ก-๙]/u)
    });
  });

  it("defines five bounded UI states and rejects more than four primary choices", async () => {
    const app = await import("../../src/app/contracts.js");

    expect(app.SECOND_BRAIN_RESOURCE_URI).toBe(RESOURCE_URI);
    for (const kind of ["project_picker", "scope_selector", "intake_review", "result_explorer", "confirmation"]) {
      expect(app.SecondBrainViewSchema.safeParse(app.exampleSecondBrainView(kind)).success).toBe(true);
    }

    const tooMany = app.exampleSecondBrainView("project_picker");
    tooMany.options = Array.from({ length: 5 }, (_, index) => ({
      id: `project-${index}`,
      label: `Project ${index}`,
      message: `เลือก Project ${index}`
    }));
    expect(app.SecondBrainViewSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects absolute note paths and markup-bearing labels from UI payloads", async () => {
    const app = await import("../../src/app/contracts.js");
    const absoluteSource = app.exampleSecondBrainView("result_explorer");
    absoluteSource.sources = [{ label: "Source", locator: "A1", notePath: "/private/client.md" }];
    expect(app.SecondBrainViewSchema.safeParse(absoluteSource).success).toBe(false);

    const markupLabel = app.exampleSecondBrainView("project_picker");
    markupLabel.options[0].label = "<img src=x onerror=alert(1)>";
    expect(app.SecondBrainViewSchema.safeParse(markupLabel).success).toBe(false);
  });

  it("implements choices as host messages and confirmation as the existing safe apply tool", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../ui/app.ts"), "utf8");

    expect(source).toContain("app.sendMessage");
    expect(source).toContain('name: "apply_obsidian_note_write"');
    expect(source).toContain('confirmation: "ยืนยันบันทึก"');
    expect(source).toContain("textContent");
    expect(source).not.toContain("innerHTML");
  });
});
