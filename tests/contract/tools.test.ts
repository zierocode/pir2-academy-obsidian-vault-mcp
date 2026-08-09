import { describe, expect, it } from "vitest";

const EXPECTED_TOOLS = [
  "obsidian_vault_status",
  "search_obsidian_notes",
  "read_obsidian_notes",
  "preview_obsidian_note_write",
  "apply_obsidian_note_write",
  "open_obsidian_note"
];

async function loadToolContracts(): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import("../../src/contracts.js")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

describe("tool contract", () => {
  it("exposes exactly the six safe Obsidian tools", async () => {
    const contracts = await loadToolContracts();

    expect(contracts).toBeDefined();
    expect(contracts?.TOOL_NAMES).toEqual(EXPECTED_TOOLS);
  });

  it("uses Thai-first descriptions without destructive or arbitrary command tools", async () => {
    const contracts = await loadToolContracts();
    const definitions = contracts?.TOOL_DEFINITIONS as Array<{ name: string; description: string }> | undefined;

    expect(definitions?.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
    expect(definitions?.every((tool) => /[\u0E00-\u0E7F]/u.test(tool.description))).toBe(true);
    expect(definitions?.map((tool) => tool.name)).not.toContain("delete_obsidian_note");
    expect(definitions?.map((tool) => tool.name)).not.toContain("rename_obsidian_note");
    expect(definitions?.map((tool) => tool.name)).not.toContain("run_obsidian_command");
  });
});
