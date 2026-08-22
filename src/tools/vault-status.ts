import { TOOL_DEFINITIONS } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";
import { access, constants } from "node:fs/promises";
import { z } from "zod";

const inputSchema = z.object({}).strict();

export function createVaultStatusTool(): UnboundToolDefinition {
  return {
    name: "obsidian_vault_status",
    description: TOOL_DEFINITIONS[0]!.description,
    inputSchema,
    handler: async (_input, context) => {
      try {
        await access(context.services.vault.realRoot, constants.R_OK | constants.W_OK);
      } catch {
        throw new VaultToolError("VAULT_NOT_READY", "approved Vault folder อ่านหรือเขียนไม่ได้");
      }
      return context.success("Obsidian Vault พร้อมใช้งานผ่าน approved folder ครับ", {
        ready: true,
        access: "direct-filesystem",
        obsidian_app_required: false
      });
    }
  };
}
