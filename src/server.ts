import { formatRuntimeReadyDiagnostic, parseRuntimeConfig, type RuntimeConfig } from "./config/runtime-config.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { failure, success, type ToolFailureCode, type ToolName, type ToolResult } from "./contracts.js";
import { VaultToolError } from "./errors.js";
import { hashPath, writeDiagnostic, type ToolLogEvent } from "./logging.js";
import { runObsidianCli, type CliReceipt } from "./obsidian/cli-runner.js";
import { createApplyNoteWriteTool } from "./tools/apply-note-write.js";
import {
  createApplyKnowledgeBuildTool,
  createAuditGraphTool,
  createExploreGraphTool,
  createPreviewKnowledgeBuildTool,
  createRollbackChangeTool
} from "./tools/graph-contract.js";
import { createOpenNoteTool } from "./tools/open-note.js";
import { createPreviewNoteWriteTool } from "./tools/preview-note-write.js";
import { createReadNotesTool } from "./tools/read-notes.js";
import { createScanChangesTool } from "./tools/scan-changes.js";
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
  GRAPH_UNINITIALIZED: "Vault นี้ยังไม่ได้สร้าง Knowledge Graph ครับ โปรดตรวจแผนเริ่มต้นก่อนครับ",
  GRAPH_STALE: "Knowledge Graph มีข้อมูลใหม่ที่ยังไม่ได้รีเฟรชครับ",
  GRAPH_CONFLICT: "Knowledge Graph มีข้อมูลขัดแย้งครับ โปรดตรวจตัวเลือกแก้ไขก่อนครับ",
  GRAPH_LIMIT_EXCEEDED: "Knowledge Graph เกินขอบเขตปลอดภัยของงานนี้ครับ",
  BUILD_PREVIEW_REQUIRED: "ยังไม่มีตัวอย่างการสร้าง Knowledge Graph ครับ โปรดสร้างตัวอย่างก่อนครับ",
  BUILD_PREVIEW_EXPIRED: "ตัวอย่างการสร้าง Knowledge Graph หมดอายุแล้วครับ โปรดสร้างใหม่ครับ",
  ROLLBACK_NOT_FOUND: "ไม่พบรายการเปลี่ยนแปลงที่ย้อนคืนได้ครับ",
  ROLLBACK_CONFLICT: "มีข้อมูลใหม่หลังรายการเดิม จึงยังย้อนคืนอย่างปลอดภัยไม่ได้ครับ",
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

export type RootAwareMcpServerOptions = ToolCatalogOptions & {
  createServices?: (vaultRoot: string) => Promise<ToolServices>;
};

export function buildServerIdentity(): { name: string; version: string } {
  return { name: "pir-acdm-obsidian-vault", version: "0.4.0" };
}

function createToolCatalog(resolveServices: () => Promise<ToolServices>, options: ToolCatalogOptions = {}): UnboundToolDefinition[] {
  const diagnostic = options.diagnostic ?? writeDiagnostic;
  const definitions = [
    createVaultStatusTool(),
    createScanChangesTool(),
    createSearchNotesTool(),
    createExploreGraphTool(),
    createReadNotesTool(),
    createPreviewKnowledgeBuildTool(),
    createApplyKnowledgeBuildTool(),
    createPreviewNoteWriteTool(),
    createApplyNoteWriteTool(),
    createAuditGraphTool(),
    createRollbackChangeTool(),
    createOpenNoteTool()
  ];

  return definitions.map((definition) => ({
    ...definition,
    handler: async (input, _context) => {
      const startedAt = Date.now();
      let result: ToolCallResult;

      try {
        const context: ToolExecutionContext = {
          services: await resolveServices(),
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

export function createMcpServer(services: ToolServices, options: ToolCatalogOptions = {}): Server {
  return createMcpServerWithResolver(async () => services, options);
}

function createMcpServerWithResolver(
  resolveServices: () => Promise<ToolServices>,
  options: ToolCatalogOptions = {}
): Server {
  const catalog = createToolCatalog(resolveServices, options);
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

export function createRootAwareMcpServer(options: RootAwareMcpServerOptions = {}): Server {
  let services: Promise<ToolServices> | undefined;
  const createServices = options.createServices ?? createProductionToolServicesForRoot;
  const resolveServices = (): Promise<ToolServices> => {
    services ??= (async () => {
      let roots: Awaited<ReturnType<Server["listRoots"]>>["roots"];
      try {
        ({ roots } = await server.listRoots());
      } catch {
        throw new VaultToolError("VAULT_NOT_READY", "Cowork ไม่ได้ส่งโฟลเดอร์ Project หลักให้ MCP");
      }
      if (roots.length !== 1) {
        throw new VaultToolError("VAULT_NOT_READY", "ต้องเลือก Vault หลักเพียงหนึ่งโฟลเดอร์ใน Cowork");
      }
      try {
        const uri = new URL(roots[0]!.uri);
        if (uri.protocol !== "file:") throw new Error("unsupported root URI");
        return await createServices(fileURLToPath(uri));
      } catch (error) {
        if (error instanceof VaultToolError) throw error;
        throw new VaultToolError("VAULT_NOT_READY", "Cowork ส่งโฟลเดอร์ Project หลักที่ใช้ไม่ได้");
      }
    })();
    return services;
  };
  const server = createMcpServerWithResolver(resolveServices, options);
  return server;
}

export async function createProductionToolServices(
  environment: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2)
): Promise<ToolServices> {
  const runtimeConfig = runtimeConfigForProcess(environment, argv);
  const vault = await resolveApprovedVault(runtimeConfig.vaultRoot);
  process.stderr.write(`${formatRuntimeReadyDiagnostic(runtimeConfig, vault.realRoot)}\n`);
  return {
    vault,
    writer: createNoteWriter({ vault }),
    runCli: (args) => runObsidianCli(args, { vault })
  };
}

async function createProductionToolServicesForRoot(vaultRoot: string): Promise<ToolServices> {
  const vault = await resolveApprovedVault(vaultRoot);
  const runtimeConfig = { vaultRoot, pluginData: "" };
  process.stderr.write(`${formatRuntimeReadyDiagnostic(runtimeConfig, vault.realRoot)}\n`);
  return {
    vault,
    writer: createNoteWriter({ vault }),
    runCli: (args) => runObsidianCli(args, { vault })
  };
}

export async function createProductionMcpServer(
  environment: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2)
): Promise<Server> {
  if (argv.length > 0 || environment.APPROVED_VAULT_ROOT?.trim()) {
    return createMcpServer(await createProductionToolServices(environment, argv));
  }
  return createRootAwareMcpServer();
}

export async function runStdioServer(
  environment: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2)
): Promise<void> {
  const server = await createProductionMcpServer(environment, argv);
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

function runtimeConfigForProcess(environment: NodeJS.ProcessEnv, argv: readonly string[]): RuntimeConfig {
  if (argv.length > 0) return parseRuntimeConfig(argv);

  // Keep the pre-Plugin smoke harness working while the bundled Plugin supplies argv.
  const configuredRoot = environment.APPROVED_VAULT_ROOT?.trim();
  if (!configuredRoot) {
    throw new VaultToolError("VAULT_NOT_READY", "ยังไม่ได้กำหนด Obsidian Vault ที่อนุญาต");
  }
  return { vaultRoot: configuredRoot, pluginData: environment.CLAUDE_PLUGIN_DATA?.trim() ?? "" };
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
