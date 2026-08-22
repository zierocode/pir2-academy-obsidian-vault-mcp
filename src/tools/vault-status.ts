import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { buildNoteIndex } from "../vault/note-index.js";
import { z } from "zod";

const inputSchema = z.object({}).strict();

export function createVaultStatusTool(): UnboundToolDefinition {
  return {
    name: "obsidian_vault_status",
    description: TOOL_DEFINITIONS[0]!.description,
    inputSchema,
    handler: async (_input, context) => {
      const index = await buildNoteIndex(context.services.vault);
      return context.success("Obsidian Vault พร้อมใช้งานครับ", { ready: true, note_count: index.paths.length });
    }
  };
}
