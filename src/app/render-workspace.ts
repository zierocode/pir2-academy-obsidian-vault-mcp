import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";
import { SecondBrainViewSchema } from "./contracts.js";

export function createRenderSecondBrainWorkspaceTool(): UnboundToolDefinition {
  return {
    name: "render_second_brain_workspace",
    description: "แสดงตัวเลือก รีวิว ผลลัพธ์ และการยืนยันของ Second Brain แบบโต้ตอบ",
    // Hosts and models sometimes use `type` for discriminated UI payloads even
    // when the published JSON schema says `kind`. Keep the public boundary
    // bounded, then normalize that single safe alias before strict view
    // validation. Unknown view fields are stripped by the object schemas.
    inputSchema: z.object({ view: z.record(z.string(), z.unknown()) }),
    uiResourceUri: "ui://pir2-academy-obsidian-vault/second-brain-workspace.html",
    handler: async (input, context) => {
      const parsed = input as { view: Record<string, unknown> };
      const rawView = parsed.view;
      const view = SecondBrainViewSchema.parse({
        ...rawView,
        kind: rawView.kind ?? rawView.type
      });
      return context.success(`เปิด ${view.title} แล้วครับ`, { view });
    }
  };
}
