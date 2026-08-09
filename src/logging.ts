import { createHash } from "node:crypto";
import type { ToolName } from "./contracts.js";

export type ToolLogEvent = {
  tool: ToolName;
  status: "success" | "failure";
  elapsedMs: number;
  count?: number;
  pathHash?: string;
};

export function hashPath(path: string): string {
  return createHash("sha256").update(path, "utf8").digest("hex").slice(0, 16);
}

export function writeDiagnostic(event: ToolLogEvent, write: (message: string) => unknown = process.stderr.write.bind(process.stderr)): void {
  const record = {
    tool: event.tool,
    status: event.status,
    elapsed_ms: Math.max(0, Math.round(event.elapsedMs)),
    ...(typeof event.count === "number" ? { count: event.count } : {}),
    ...(event.pathHash ? { path_hash: event.pathHash } : {})
  };
  write(`${JSON.stringify(record)}\n`);
}
