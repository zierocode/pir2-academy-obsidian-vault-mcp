import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { failure, success, type ToolFailureCode, type ToolName, type ToolResult } from "./contracts.js";
import { VaultToolError } from "./errors.js";
import { hashPath, writeDiagnostic, type ToolLogEvent } from "./logging.js";
import { runObsidianCli, type CliReceipt } from "./obsidian/cli-runner.js";
import { createApplyNoteWriteTool } from "./tools/apply-note-write.js";
import { createOpenNoteTool } from "./tools/open-note.js";
import { createPreviewNoteWriteTool } from "./tools/preview-note-write.js";
import { createReadNotesTool } from "./tools/read-notes.js";
import { createSearchNotesTool } from "./tools/search-notes.js";
import { createVaultStatusTool } from "./tools/vault-status.js";
import { createNoteWriter, type NoteWriter } from "./vault/note-writer.js";
import { resolveApprovedVault, type ApprovedVault } from "./vault/vault-root.js";

const SAFE_ERROR_MESSAGES: Record<ToolFailureCode, string> = {
  VAULT_NOT_READY: "Obsidian Vault ยังไม่พร้อมครับ โปรดตรวจโฟลเดอร์ Vault ที่อนุญาตแล้วลองใหม่ครับ",
  INVALID_NOTE_PATH: "พาธโน้ตไม่ถูกต้องครับ โปรดระบุไฟล์ Markdown ภายใน Vault ที่อนุญาตครับ",
  NOTE_NOT_FOUND: "ไม่พบโน้ตที่ระบุครับ โปรดตรวจชื่อและพาธโน้ตแล้วลองใหม่ครับ",
  WRITE_PREVIEW_REQUIRED: "ยังไม่มีตัวอย่างสำหรับบันทึกครับ โปรดสร้างตัวอย่างใหม่ก่อนครับ",
  WRITE_PREVIEW_EXPIRED: "ตัวอย่างหมดอายุแล้วครับ โปรดสร้างตัวอย่างใหม่ก่อนครับ",
  WRITE_CONFLICT: "โน้ตเปลี่ยนหลังสร้างตัวอย่างครับ โปรดตรวจและสร้างตัวอย่างใหม่ครับ",
  WRITE_NOT_CONFIRMED: "ยังไม่ได้ยืนยันการบันทึกครับ โปรดส่ง ยืนยันบันทึก หรือ Confirm write ครับ",
  OBSIDIAN_CLI_ERROR: "ยังใช้ Obsidian CLI ไม่ได้ครับ โปรดเปิด Obsidian และเปิดใช้ CLI แล้วลองใหม่ครับ"
};

export type ToolServices = {
  vault: ApprovedVault;
  writer: NoteWriter;
  runCli(args: readonly string[]): Promise<CliReceipt>;
};

export type ToolCallResult = {
  content: [{ type: "text"; text: string }];
  structuredContent: ToolResult<unknown>;
  isError?: true;
};

export type ToolExecutionContext = {
  services: ToolServices;
  success(message: string, data: unknown): ToolCallResult;
  failure(error: unknown): ToolCallResult;
};

export type UnboundToolDefinition = {
  name: ToolName;
  description: string;
  inputSchema: z.ZodType;
  handler(input: unknown, context: ToolExecutionContext): Promise<ToolCallResult>;
};

export type ToolCatalogOptions = {
  diagnostic?: (event: ToolLogEvent) => void;
};

export function buildServerIdentity(): { name: string; version: string } {
  return { name: "pir2-academy-obsidian-vault", version: "0.1.0" };
}

export function createToolCatalog(services: ToolServices, options: ToolCatalogOptions = {}): UnboundToolDefinition[] {
  const diagnostic = options.diagnostic ?? writeDiagnostic;
  const definitions = [
    createVaultStatusTool(),
    createSearchNotesTool(),
    createReadNotesTool(),
    createPreviewNoteWriteTool(),
    createApplyNoteWriteTool(),
    createOpenNoteTool()
  ];

  return definitions.map((definition) => ({
    ...definition,
    handler: async (input, _context) => {
      const startedAt = Date.now();
      let result: ToolCallResult;
      const context: ToolExecutionContext = {
        services,
        success: successResult,
        failure: failureResult
      };

      try {
        const parsed = definition.inputSchema.safeParse(input);
        result = parsed.success
          ? await definition.handler(parsed.data, context)
          : failureResult(new VaultToolError("INVALID_NOTE_PATH", "ข้อมูลเครื่องมือไม่ถูกต้อง"));
      } catch (error) {
        result = failureResult(error);
      }

      writeSafeDiagnostic(diagnostic, definition.name, input, Date.now() - startedAt, result);
      return result;
    }
  }));
}

export function createMcpServer(services: ToolServices, options: ToolCatalogOptions = {}): Server {
  const catalog = createToolCatalog(services, options);
  const server = new Server(buildServerIdentity(), { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: catalog.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema)
    }))
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = catalog.find((candidate) => candidate.name === request.params.name);
    return tool
      ? tool.handler(request.params.arguments ?? {}, undefined as never)
      : failureResult(new VaultToolError("OBSIDIAN_CLI_ERROR", "ไม่รู้จักเครื่องมือ"));
  });
  return server;
}

export async function createProductionToolServices(environment: NodeJS.ProcessEnv = process.env): Promise<ToolServices> {
  const configuredRoot = environment.APPROVED_VAULT_ROOT?.trim();
  if (!configuredRoot) {
    throw new VaultToolError("VAULT_NOT_READY", "ยังไม่ได้กำหนด Obsidian Vault ที่อนุญาต");
  }
  const vault = await resolveApprovedVault(configuredRoot);
  return {
    vault,
    writer: createNoteWriter({ vault }),
    runCli: (args) => runObsidianCli(args, { vault })
  };
}

export async function createProductionMcpServer(environment: NodeJS.ProcessEnv = process.env): Promise<Server> {
  return createMcpServer(await createProductionToolServices(environment));
}

export async function runStdioServer(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const server = await createProductionMcpServer(environment);
  const transport = new StdioServerTransport();
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= server.close();
    return closing;
  };
  const closeOnInput = (): void => {
    void close();
  };
  const closeOnSignal = (): void => {
    void close().finally(() => {
      process.exitCode = 0;
    });
  };

  process.stdin.once("end", closeOnInput);
  process.stdin.once("close", closeOnInput);
  process.once("SIGINT", closeOnSignal);
  process.once("SIGTERM", closeOnSignal);
  transport.onclose = () => {
    process.stdin.off("end", closeOnInput);
    process.stdin.off("close", closeOnInput);
    process.off("SIGINT", closeOnSignal);
    process.off("SIGTERM", closeOnSignal);
  };
  await server.connect(transport);
}

function successResult(message: string, data: unknown): ToolCallResult {
  const envelope = success(message, data);
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope
  };
}

function failureResult(error: unknown): ToolCallResult {
  const code = error instanceof VaultToolError ? error.code : "OBSIDIAN_CLI_ERROR";
  const envelope = failure(code, SAFE_ERROR_MESSAGES[code]);
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope,
    isError: true
  };
}

function writeSafeDiagnostic(
  diagnostic: (event: ToolLogEvent) => void,
  tool: ToolName,
  input: unknown,
  elapsedMs: number,
  result: ToolCallResult
): void {
  const data = result.structuredContent.ok ? result.structuredContent.data : undefined;
  const event: ToolLogEvent = {
    tool,
    status: result.structuredContent.ok ? "success" : "failure",
    elapsedMs,
    ...(countOf(data) === undefined ? {} : { count: countOf(data) }),
    ...(pathOf(input) ? { pathHash: hashPath(pathOf(input)!) } : {})
  };
  try {
    diagnostic(event);
  } catch {
    // Diagnostics cannot interfere with an MCP response.
  }
}

function countOf(data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const count = (data as { count?: unknown }).count;
  return typeof count === "number" && Number.isFinite(count) ? count : undefined;
}

function pathOf(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as { path?: unknown; paths?: unknown };
  if (typeof record.path === "string") return record.path;
  return Array.isArray(record.paths) && typeof record.paths[0] === "string" ? record.paths[0] : undefined;
}
