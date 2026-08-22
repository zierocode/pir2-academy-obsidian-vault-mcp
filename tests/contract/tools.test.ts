import { describe, expect, it } from "vitest";

const EXPECTED_TOOLS = [
  "obsidian_vault_status",
  "scan_obsidian_changes",
  "search_obsidian_knowledge",
  "explore_obsidian_graph",
  "read_obsidian_notes",
  "inspect_obsidian_sources",
  "preview_obsidian_source_intake",
  "apply_obsidian_source_intake",
  "preview_obsidian_knowledge_build",
  "apply_obsidian_knowledge_build",
  "preview_obsidian_note_write",
  "apply_obsidian_note_write",
  "audit_obsidian_graph",
  "rollback_obsidian_change",
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
  it("exposes exactly the fifteen graph-native Obsidian tools", async () => {
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
