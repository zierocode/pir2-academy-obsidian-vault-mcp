import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSC_PATH = resolve(ROOT, "node_modules/typescript/bin/tsc");
const SERVER_PATH = resolve(ROOT, "server/index.js");

function compileServer() {
  const result = spawnSync(process.execPath, [TSC_PATH, "--project", "tsconfig.json"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) throw new Error("build failed");
}

function createReader(stream) {
  let pending = "";
  const waiters = new Map();
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const waiter = waiters.get(message.id);
      if (waiter) {
        waiters.delete(message.id);
        clearTimeout(waiter.timeout);
        waiter.resolve(message);
      }
    }
  });
  return {
    waitFor(id) {
      return new Promise((resolveMessage, reject) => {
        const timeout = setTimeout(() => {
          waiters.delete(id);
          reject(new Error("response timeout"));
        }, 5_000);
        waiters.set(id, { resolve: resolveMessage, timeout });
      });
    }
  };
}

function waitForExit(child) {
  return new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => reject(new Error("shutdown timeout")), 5_000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
    child.once("error", () => {
      clearTimeout(timeout);
      reject(new Error("server start failed"));
    });
  });
}

async function request(child, reader, id, method, params) {
  const response = reader.waitFor(id);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return response;
}

async function main() {
  compileServer();
  const root = mkdtempSync(resolve(tmpdir(), "pir2-academy-obsidian-smoke-"));
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  const approvedVault = realpathSync(vault);
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    env: { ...process.env, APPROVED_VAULT_ROOT: approvedVault },
    shell: false,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const reader = createReader(child.stdout);

  try {
    const initialized = await request(child, reader, 1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.1.0" }
    });
    if (!initialized.result) throw new Error("initialize failed");
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const listed = await request(child, reader, 2, "tools/list", {});
    if (!Array.isArray(listed.result?.tools) || listed.result.tools.length !== 12) throw new Error("tool catalog failed");

    const exited = waitForExit(child);
    child.stdin.end();
    if (await exited !== 0) throw new Error("server shutdown failed");
    process.stdout.write("smoke=pass tools=12\n");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    rmSync(root, { force: true, recursive: true });
  }
}

void main().catch(() => {
  process.stderr.write("smoke=failed\n");
  process.exitCode = 1;
});
