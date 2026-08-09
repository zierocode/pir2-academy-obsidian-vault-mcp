import { isAbsolute } from "node:path";
import { TOOL_DEFINITIONS } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import { parseSearchOutput } from "../obsidian/cli-parser.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().min(1).max(1_000),
  folder: z.string().min(1).max(1_024).optional(),
  limit: z.number().int().min(1).max(50).optional()
}).strict();

function safeFolder(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  const normalized = folder.replaceAll("\\", "/").replace(/\/+$/u, "");
  const parts = normalized.split("/");
  if (
    !normalized ||
    isAbsolute(normalized) ||
    parts.some((part) => part === "" || part === "." || part === "..") ||
    parts.includes(".obsidian") ||
    parts.includes(".pir2-academy-backups")
  ) {
    throw new VaultToolError("INVALID_NOTE_PATH", "โฟลเดอร์ค้นหาไม่อยู่ในขอบเขต Vault ที่อนุญาต");
  }
  return parts.join("/");
}

export function createSearchNotesTool(): UnboundToolDefinition {
  return {
    name: "search_obsidian_notes",
    description: TOOL_DEFINITIONS[1]!.description,
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const folder = safeFolder(values.folder);
      const receipt = await context.services.runCli([
        "search",
        `query=${values.query}`,
        ...(folder ? [`path=${folder}`] : []),
        `limit=${values.limit ?? 20}`,
        "format=json"
      ]);
      const paths = await parseSearchOutput(receipt.stdout, context.services.vault);
      return context.success("ค้นหาโน้ตใน Obsidian Vault สำเร็จครับ", {
        paths,
        count: paths.length,
        content_is_untrusted_data: true
      });
    }
  };
}
