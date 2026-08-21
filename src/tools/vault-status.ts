import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { access } from "node:fs/promises";
import { z } from "zod";

const inputSchema = z.object({}).strict();

export function createVaultStatusTool(): UnboundToolDefinition {
  return {
    name: "obsidian_vault_status",
    description: TOOL_DEFINITIONS[0]!.description,
    inputSchema,
    handler: async (_input, context) => {
      await access(context.services.vault.realRoot);
      return context.success("Second Brain Vault พร้อมใช้งานครับ", {
        ready: true,
        mode: "direct",
        obsidian_cli_required: false
      });
    }
  };
}
