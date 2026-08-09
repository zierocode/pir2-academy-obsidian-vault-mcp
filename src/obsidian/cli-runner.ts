import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "../vault/vault-root.js";

export const DEFAULT_CLI_TIMEOUT_MS = 10_000;
export const DEFAULT_CLI_MAX_OUTPUT_BYTES = 200_000;

export type CliReceipt = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CliSpawn = (
  command: string,
  args: readonly string[],
  options: Record<string, unknown>
) => ChildProcess;

export type CliOptions = {
  vault: ApprovedVault;
  timeoutMs?: number;
  maxOutputBytes?: number;
  spawn?: CliSpawn;
};

function parameterNames(args: readonly string[]): string[] {
  return args.map((argument) => argument.split("=", 1)[0]);
}

function isAllowedCommand(args: readonly string[]): boolean {
  if (args.length === 0 || args.some((argument) => !argument || argument.includes("\0") || /[\r\n]/u.test(argument))) return false;
  const [command, ...parameters] = args;
  const names = parameterNames(parameters);

  if (command === "vault") {
    return parameters.length <= 1 && (parameters.length === 0 || /^info=(?:name|path|files|folders|size)$/u.test(parameters[0]!));
  }
  if (command === "search") {
    return names.includes("query") && names.every((name) => ["query", "path", "limit", "format", "case"].includes(name));
  }
  if (command === "read" || command === "open") {
    return parameters.length === 1 && names[0] === "path";
  }
  return false;
}

function cliFailure(message: string): VaultToolError {
  return new VaultToolError("OBSIDIAN_CLI_ERROR", message);
}

export function runObsidianCli(args: readonly string[], options: CliOptions): Promise<CliReceipt> {
  if (!isAllowedCommand(args)) {
    return Promise.reject(cliFailure("คำสั่ง Obsidian นี้ไม่ได้รับอนุญาต"));
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_CLI_MAX_OUTPUT_BYTES;
  const spawn = options.spawn ?? ((command, commandArgs, spawnOptions) => nodeSpawn(command, commandArgs, spawnOptions));

  return new Promise<CliReceipt>((resolve, reject) => {
    let child: ChildProcess | undefined;
    let settled = false;
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    const timeout = setTimeout(() => fail("Obsidian ใช้เวลานานเกิน 10 วินาที", true), timeoutMs);

    function fail(message: string, terminate = false): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (terminate) child?.kill();
      reject(cliFailure(message));
    }

    function append(target: "stdout" | "stderr", chunk: Buffer | string): void {
      if (settled) return;
      const text = chunk.toString();
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > maxOutputBytes) {
        fail("ผลลัพธ์จาก Obsidian มีขนาดเกินขอบเขตปลอดภัย", true);
        return;
      }
      if (target === "stdout") stdout += text;
      else stderr += text;
    }

    try {
      child = spawn("obsidian", [...args], {
        cwd: options.vault.realRoot,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.stdout?.on("data", (chunk: Buffer | string) => append("stdout", chunk));
      child.stderr?.on("data", (chunk: Buffer | string) => append("stderr", chunk));
      child.on("error", () => fail("ไม่สามารถเรียก Obsidian CLI ได้"));
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          reject(cliFailure("Obsidian CLI ทำงานไม่สำเร็จ"));
          return;
        }
        resolve({ stdout, stderr, exitCode: 0 });
      });
    } catch {
      fail("ไม่สามารถเรียก Obsidian CLI ได้");
    }
  });
}
