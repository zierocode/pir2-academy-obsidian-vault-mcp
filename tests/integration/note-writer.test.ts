import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type Preview = {
  previewId: string;
  notePath: string;
  mode: "create" | "replace";
  beforeHash: string | null;
  proposedHash: string;
  proposedContent: string;
  expiresAt: number;
};
type Receipt = {
  notePath: string;
  beforeHash: string | null;
  proposedHash: string;
  backupPath?: string;
};
type Writer = {
  previewWrite(input: { path: string; content: string; mode: "create" | "replace" }): Promise<Preview>;
  applyWrite(previewId: string, confirmation: string): Promise<Receipt>;
};
type PreviewStore = object;
type WriterApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
  WritePreviewStore: new (maxEntries?: number) => PreviewStore;
  createNoteWriter(options: {
    vault: ApprovedVault;
    now?: () => number;
    previewId?: () => string;
    atomicWrite?: (path: string, content: string) => Promise<void>;
    previews?: PreviewStore;
  }): Writer;
};

const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-note-writer-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return vault;
}

async function loadApi(): Promise<WriterApi | undefined> {
  try {
    const [vaultRoot, writer, previewStore] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/vault/write-preview-store.js")
    ]);
    return { ...vaultRoot, ...writer, ...previewStore } as WriterApi;
  } catch {
    return undefined;
  }
}

function ids(...values: string[]): () => string {
  const pending = [...values];
  return () => pending.shift() ?? "unexpected-preview-id";
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("safe note write transaction", () => {
  it("creates a preview without mutating an existing note", async () => {
    const vault = createVault();
    mkdirSync(resolve(vault, "notes"));
    const note = resolve(vault, "notes/meeting.md");
    writeFileSync(note, "before\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, now: () => 1_000, previewId: ids("preview-1") });
    await expect(writer.previewWrite({ path: "notes/meeting.md", content: "after\n", mode: "replace" })).resolves.toMatchObject({
      previewId: "preview-1",
      notePath: "notes/meeting.md",
      mode: "replace",
      proposedContent: "after\n",
      expiresAt: 601_000
    });
    expect(readFileSync(note, "utf8")).toBe("before\n");
  });

  it("requires exact Thai confirmation before applying a preview", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, previewId: ids("preview-1") });
    await writer.previewWrite({ path: "new.md", content: "created\n", mode: "create" });
    await expect(writer.applyWrite("preview-1", "โอเค")).rejects.toMatchObject({ code: "WRITE_NOT_CONFIRMED" });
    expect(existsSync(resolve(vault, "new.md"))).toBe(false);
    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).resolves.toMatchObject({ notePath: "new.md" });
    expect(readFileSync(resolve(vault, "new.md"), "utf8")).toBe("created\n");
  });

  it("accepts the exact English confirmation", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, previewId: ids("preview-1") });
    await writer.previewWrite({ path: "new.md", content: "created\n", mode: "create" });
    await writer.applyWrite("preview-1", "Confirm write");
    expect(readFileSync(resolve(vault, "new.md"), "utf8")).toBe("created\n");
  });

  it("expires a preview after ten minutes using the injected clock", async () => {
    const vault = createVault();
    let clock = 1_000;
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, now: () => clock, previewId: ids("preview-1") });
    await writer.previewWrite({ path: "new.md", content: "created\n", mode: "create" });
    clock += 600_001;
    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_PREVIEW_EXPIRED" });
    expect(existsSync(resolve(vault, "new.md"))).toBe(false);
  });

  it("detects a source change after preview and leaves the newer source intact", async () => {
    const vault = createVault();
    const note = resolve(vault, "meeting.md");
    writeFileSync(note, "before\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, previewId: ids("preview-1") });
    await writer.previewWrite({ path: "meeting.md", content: "proposal\n", mode: "replace" });
    writeFileSync(note, "changed by sync\n");
    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
    expect(readFileSync(note, "utf8")).toBe("changed by sync\n");
  });

  it("backs up old content before atomic replacement without leaking an absolute path", async () => {
    const vault = createVault();
    const note = resolve(vault, "meeting.md");
    writeFileSync(note, "before\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, now: () => 1_721_000_000_000, previewId: ids("preview-1") });
    await writer.previewWrite({ path: "meeting.md", content: "after\n", mode: "replace" });
    const receipt = await writer.applyWrite("preview-1", "ยืนยันบันทึก");

    expect(receipt.backupPath).toMatch(/^\.pir2-academy-backups\/[A-Z0-9]+\/meeting\.md$/);
    expect(readFileSync(resolve(approved.realRoot, receipt.backupPath!), "utf8")).toBe("before\n");
    expect(readFileSync(note, "utf8")).toBe("after\n");
    expect(JSON.stringify(receipt)).not.toContain(approved.realRoot);
  });

  it("keeps the source intact when the injected atomic write fails", async () => {
    const vault = createVault();
    const note = resolve(vault, "meeting.md");
    writeFileSync(note, "before\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({
      vault: approved,
      previewId: ids("preview-1"),
      atomicWrite: async () => Promise.reject(new Error("simulated atomic failure"))
    });
    await writer.previewWrite({ path: "meeting.md", content: "after\n", mode: "replace" });
    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
    expect(readFileSync(note, "utf8")).toBe("before\n");
  });

  it("rejects a stale second preview for the same note", async () => {
    const vault = createVault();
    const note = resolve(vault, "meeting.md");
    writeFileSync(note, "before\n");
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved, previewId: ids("preview-1", "preview-2") });
    await writer.previewWrite({ path: "meeting.md", content: "first\n", mode: "replace" });
    await writer.previewWrite({ path: "meeting.md", content: "second\n", mode: "replace" });
    await writer.applyWrite("preview-1", "ยืนยันบันทึก");
    await expect(writer.applyWrite("preview-2", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
    expect(readFileSync(note, "utf8")).toBe("first\n");
  });

  it("requires a known preview id", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({ vault: approved });
    await expect(writer.applyWrite("missing-preview", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_PREVIEW_REQUIRED" });
  });

  it("consumes a preview before a concurrent confirmed apply can write", async () => {
    const vault = createVault();
    const api = await loadApi();
    let writes = 0;
    let signalFirstWrite!: () => void;
    let releaseFirstWrite!: () => void;
    const firstWriteStarted = new Promise<void>((resolve) => {
      signalFirstWrite = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({
      vault: approved,
      previewId: ids("preview-1"),
      atomicWrite: async (path, content) => {
        writes += 1;
        if (writes > 1) throw new Error("a second apply reached the atomic writer");
        signalFirstWrite();
        await release;
        writeFileSync(path, content);
      }
    });
    await writer.previewWrite({ path: "new.md", content: "created\n", mode: "create" });

    const firstApply = writer.applyWrite("preview-1", "ยืนยันบันทึก");
    await firstWriteStarted;
    const secondError = await writer.applyWrite("preview-1", "ยืนยันบันทึก").then(
      () => undefined,
      (error: unknown) => error
    );
    releaseFirstWrite();

    await expect(firstApply).resolves.toMatchObject({ notePath: "new.md" });
    expect(secondError).toMatchObject({ code: "WRITE_PREVIEW_REQUIRED" });
    expect(writes).toBe(1);
    expect(readFileSync(resolve(vault, "new.md"), "utf8")).toBe("created\n");
  });

  it("evicts the oldest active preview when a bounded preview store is full", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({
      vault: approved,
      previewId: ids("preview-1", "preview-2", "preview-3"),
      previews: new api!.WritePreviewStore(2)
    });
    await writer.previewWrite({ path: "one.md", content: "one\n", mode: "create" });
    await writer.previewWrite({ path: "two.md", content: "two\n", mode: "create" });
    await writer.previewWrite({ path: "three.md", content: "three\n", mode: "create" });

    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_PREVIEW_REQUIRED" });
    await expect(writer.applyWrite("preview-2", "ยืนยันบันทึก")).resolves.toMatchObject({ notePath: "two.md" });
    expect(existsSync(resolve(vault, "one.md"))).toBe(false);
    expect(readFileSync(resolve(vault, "two.md"), "utf8")).toBe("two\n");
  });

  it("prunes an expired preview when a later preview is created", async () => {
    const vault = createVault();
    let clock = 1_000;
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    const writer = api!.createNoteWriter({
      vault: approved,
      now: () => clock,
      previewId: ids("preview-1", "preview-2"),
      previews: new api!.WritePreviewStore(2)
    });
    await writer.previewWrite({ path: "expired.md", content: "expired\n", mode: "create" });
    clock = 601_001;
    await writer.previewWrite({ path: "fresh.md", content: "fresh\n", mode: "create" });

    await expect(writer.applyWrite("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "WRITE_PREVIEW_REQUIRED" });
    await expect(writer.applyWrite("preview-2", "ยืนยันบันทึก")).resolves.toMatchObject({ notePath: "fresh.md" });
  });
});
