import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { scanVaultChanges } from "../vault/change-scanner.js";
import { readSourceRegistry } from "../vault/source-registry.js";
import { z } from "zod";

const inputSchema = z.object({
  mode: z.enum(["preflight", "full"]).default("preflight")
}).strict();

export function createScanChangesTool(): UnboundToolDefinition {
  return {
    name: "scan_obsidian_changes",
    description: toolDescription("scan_obsidian_changes"),
    inputSchema,
    handler: async (_input, context) => {
      const registry = await readSourceRegistry(context.services.vault);
      const result = await scanVaultChanges(context.services.vault, registry);
      const state = registry.records.length === 0
        ? "uninitialized"
        : result.changes.length > 0 ? "dirty" : "clean";
      return context.success("ตรวจการเปลี่ยนแปลงใน Vault แล้วครับ", {
        state,
        changes: result.changes,
        count: result.changes.length,
        content_is_untrusted_data: true
      });
    }
  };
}
