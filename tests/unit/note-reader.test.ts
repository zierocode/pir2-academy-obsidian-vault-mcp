import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type NoteReaderApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
  readNotes(vault: ApprovedVault, paths: string[]): Promise<{ notes: Array<{ path: string; content: string }> }>;
};

const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-note-reader-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return realpathSync(vault);
}

async function loadApi(): Promise<NoteReaderApi | undefined> {
  try {
    const [vaultRoot, reader] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-reader.js")
    ]);
    return { ...vaultRoot, ...reader } as NoteReaderApi;
  } catch {
    return undefined;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("readNotes", () => {
  it("returns bounded content with only relative paths", async () => {
    const vault = createVault();
    mkdirSync(resolve(vault, "notes"));
    writeFileSync(resolve(vault, "notes/meeting.md"), "# Meeting\nDecision: ship\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.readNotes(approved, ["notes/meeting.md"])).resolves.toEqual({
      notes: [{ path: "notes/meeting.md", content: "# Meeting\nDecision: ship\n" }]
    });
  });

  it("rejects a request with more than 20 notes", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.readNotes(approved, Array.from({ length: 21 }, () => "note.md"))).rejects.toMatchObject({
      code: "INVALID_NOTE_PATH"
    });
  });

  it("rejects a read whose UTF-8 content exceeds 200,000 bytes", async () => {
    const vault = createVault();
    writeFileSync(resolve(vault, "large.md"), "a".repeat(200_001));
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.readNotes(approved, ["large.md"])).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });

  it("returns NOTE_NOT_FOUND for an absent but otherwise valid note", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.readNotes(approved, ["missing.md"])).rejects.toMatchObject({ code: "NOTE_NOT_FOUND" });
  });
});
