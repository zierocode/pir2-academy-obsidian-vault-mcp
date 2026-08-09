import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({}).strict();

export function createVaultStatusTool(): UnboundToolDefinition {
  return {
    name: "obsidian_vault_status",
    description: TOOL_DEFINITIONS[0]!.description,
    inputSchema,
    handler: async (_input, context) => {
      await context.services.runCli(["vault", "info=name"]);
      return context.success("Obsidian Vault พร้อมใช้งานครับ", { ready: true });
    }
  };
}
