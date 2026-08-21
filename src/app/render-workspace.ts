import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";
import { SecondBrainViewSchema } from "./contracts.js";

export function createRenderSecondBrainWorkspaceTool(): UnboundToolDefinition {
  return {
    name: "render_second_brain_workspace",
    description: "แสดงตัวเลือก รีวิว ผลลัพธ์ และการยืนยันของ Second Brain แบบโต้ตอบ",
    inputSchema: z.object({ view: SecondBrainViewSchema }),
    uiResourceUri: "ui://pir2-academy-obsidian-vault/second-brain-workspace.html",
    handler: async (input, context) => {
      const parsed = input as { view: unknown };
      const view = SecondBrainViewSchema.parse(parsed.view);
      return context.success(`เปิด ${view.title} แล้วครับ`, { view });
    }
  };
}
