import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { access } from "node:fs/promises";
import { z } from "zod";

const inputSchema = z.object({}).strict();

export function createVaultStatusTool(): UnboundToolDefinition {
  return {
    name: "obsidian_vault_status",
    description: toolDescription("obsidian_vault_status"),
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
