import type { ToolName } from "./contracts.js";

export type ToolLogEvent = {
  tool: ToolName;
  ok: boolean;
  elapsedMs: number;
  count?: number;
  pathHash?: string;
};
