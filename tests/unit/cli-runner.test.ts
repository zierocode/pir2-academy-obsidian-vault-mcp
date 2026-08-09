import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  killed: boolean;
  kill(): void;
};
type CliApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
  runObsidianCli(
    args: readonly string[],
    options: {
      vault: ApprovedVault;
      timeoutMs?: number;
      maxOutputBytes?: number;
      spawn?: (command: string, args: readonly string[], options: Record<string, unknown>) => FakeChild;
    }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-cli-runner-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return realpathSync(vault);
}

function child(): FakeChild {
  const result = new EventEmitter() as FakeChild;
  result.stdout = new EventEmitter();
  result.stderr = new EventEmitter();
  result.killed = false;
  result.kill = () => {
    result.killed = true;
    queueMicrotask(() => result.emit("close", null));
  };
  return result;
}

function closingChild({ stdout = "", stderr = "", code = 0 }: { stdout?: string; stderr?: string; code?: number } = {}): FakeChild {
  const result = child();
  queueMicrotask(() => {
    if (stdout) result.stdout.emit("data", Buffer.from(stdout));
    if (stderr) result.stderr.emit("data", Buffer.from(stderr));
    result.emit("close", code);
  });
  return result;
}

async function loadApi(): Promise<CliApi | undefined> {
  try {
    const [vaultRoot, cliRunner] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/obsidian/cli-runner.js")
    ]);
    return { ...vaultRoot, ...cliRunner } as CliApi;
  } catch {
    return undefined;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("runObsidianCli", () => {
  it("spawns the official CLI with an argument array, canonical vault cwd, and no shell", async () => {
    const vault = createVault();
    const api = await loadApi();
    const calls: Array<{ command: string; args: readonly string[]; options: Record<string, unknown> }> = [];

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const receipt = await api!.runObsidianCli(["vault", "info=files"], {
      vault: approved,
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return closingChild({ stdout: "3\n" });
      }
    });

    expect(receipt).toEqual({ stdout: "3\n", stderr: "", exitCode: 0 });
    expect(calls).toEqual([
      {
        command: "obsidian",
        args: ["vault", "info=files"],
        options: expect.objectContaining({ cwd: approved.realRoot, shell: false })
      }
    ]);
  });

  it("maps a non-zero CLI exit to a stable failure", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(
      api?.runObsidianCli(["read", "path=note.md"], { vault: approved, spawn: () => closingChild({ stderr: "not ready", code: 1 }) })
    ).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
  });

  it("kills a CLI process that exceeds the bounded timeout", async () => {
    const vault = createVault();
    const api = await loadApi();
    const hanging = child();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.runObsidianCli(["vault", "info=files"], { vault: approved, timeoutMs: 1, spawn: () => hanging })).rejects.toMatchObject({
      code: "OBSIDIAN_CLI_ERROR"
    });
    expect(hanging.killed).toBe(true);
  });

  it("kills a CLI process when output exceeds the configured cap", async () => {
    const vault = createVault();
    const api = await loadApi();
    let noisy: FakeChild | undefined;

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(
      api?.runObsidianCli(["search", "query=plan", "format=json"], {
        vault: approved,
        maxOutputBytes: 5,
        spawn: () => {
          noisy = closingChild({ stdout: "0123456789" });
          return noisy;
        }
      })
    ).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
    expect(noisy?.killed).toBe(true);
  });

  it("rejects command families outside the four fixed official CLI operations", async () => {
    const vault = createVault();
    const api = await loadApi();
    let spawned = false;

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(
      api?.runObsidianCli(["delete", "path=note.md"], {
        vault: approved,
        spawn: () => {
          spawned = true;
          return closingChild();
        }
      })
    ).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
    expect(spawned).toBe(false);
  });
});
