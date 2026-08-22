import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { failure, success, type ToolFailureCode, type ToolName, type ToolResult } from "./contracts.js";
import { VaultToolError } from "./errors.js";
import { hashPath, writeDiagnostic, type ToolLogEvent } from "./logging.js";
import { openObsidianViewer } from "./obsidian/viewer-opener.js";
import { createApplyNoteWriteTool } from "./tools/apply-note-write.js";
import { createGetLinkedContextTool } from "./tools/get-linked-context.js";
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
  INTERNAL_ERROR: "ระบบยังทำรายการนี้ไม่สำเร็จครับ โปรดลองใหม่อีกครั้งครับ"
};

export type ToolServices = {
  vault: ApprovedVault;
  writer: NoteWriter;
  openViewer(uri: string): Promise<void>;
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

export type ToolServicesProvider = () => Promise<ToolServices>;

export function buildServerIdentity(): { name: string; version: string } {
  return { name: "pir2-academy-obsidian-vault", version: "0.2.0" };
}

export function createToolCatalog(services: ToolServices | ToolServicesProvider, options: ToolCatalogOptions = {}): UnboundToolDefinition[] {
  const diagnostic = options.diagnostic ?? writeDiagnostic;
  const definitions = [
    createVaultStatusTool(),
    createSearchNotesTool(),
    createReadNotesTool(),
    createGetLinkedContextTool(),
    createPreviewNoteWriteTool(),
    createApplyNoteWriteTool(),
    createOpenNoteTool()
  ];

  return definitions.map((definition) => ({
    ...definition,
    handler: async (input, _context) => {
      const startedAt = Date.now();
      let result: ToolCallResult;

      try {
        const resolvedServices = typeof services === "function" ? await services() : services;
        const context: ToolExecutionContext = {
          services: resolvedServices,
          success: successResult,
          failure: failureResult
        };
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

export function createMcpServer(services: ToolServices | ToolServicesProvider, options: ToolCatalogOptions = {}): Server {
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
      : failureResult(new VaultToolError("INTERNAL_ERROR", "ไม่รู้จักเครื่องมือ"));
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
    openViewer: openObsidianViewer
  };
}

export function createProductionMcpServer(environment: NodeJS.ProcessEnv = process.env): Server {
  const configuredRoot = environment.APPROVED_VAULT_ROOT?.trim();
  let services: Promise<ToolServices> | undefined;
  const resolveServices = (): Promise<ToolServices> => {
    services ??= configuredRoot
      ? createProductionToolServices(environment)
      : createProductionToolServicesFromRoots(server);
    return services;
  };
  const server = createMcpServer(resolveServices);
  return server;
}

export async function runStdioServer(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const server = createProductionMcpServer(environment);
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

async function createProductionToolServicesFromRoots(server: Server): Promise<ToolServices> {
  if (!server.getClientCapabilities()?.roots) {
    throw new VaultToolError("VAULT_NOT_READY", "MCP client ไม่ได้ส่ง Cowork project root");
  }
  const roots = (await server.listRoots(undefined, { timeout: 5_000 })).roots
    .filter((root) => root.uri.startsWith("file:"))
    .map((root) => fileURLToPath(root.uri));
  const markedRoots = (await Promise.all(roots.map(async (root) => {
    try {
      const marker = JSON.parse(await readFile(resolvePath(root, ".pir2-obsidian-vault.json"), "utf8")) as { kind?: unknown };
      return marker.kind === "pir2-academy-obsidian-vault" ? root : undefined;
    } catch {
      return undefined;
    }
  }))).filter((root): root is string => root !== undefined);
  const selectedRoot = markedRoots.length === 1 ? markedRoots[0] : roots.length === 1 ? roots[0] : undefined;
  if (!selectedRoot) {
    throw new VaultToolError("VAULT_NOT_READY", "ระบุ Obsidian Vault ไม่ได้จาก Cowork project roots");
  }
  const vault = await resolveApprovedVault(selectedRoot);
  return {
    vault,
    writer: createNoteWriter({ vault }),
    openViewer: openObsidianViewer
  };
}

function successResult(message: string, data: unknown): ToolCallResult {
  const envelope = success(message, data);
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope
  };
}

function failureResult(error: unknown): ToolCallResult {
  const code = error instanceof VaultToolError ? error.code : "INTERNAL_ERROR";
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
