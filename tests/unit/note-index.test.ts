import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type NoteIndexApi = {
  resolveApprovedVault(path: string): Promise<ApprovedVault>;
  buildNoteIndex(vault: ApprovedVault): Promise<{
    paths: string[];
    outgoing(path: string): Array<{ raw: string; target: string; resolved_path?: string }>;
    backlinks(path: string): Array<{ source_path: string; raw: string }>;
    unresolved(path: string): Array<{ raw: string; target: string }>;
    search(query: string, options?: { folder?: string; limit?: number }): Array<{ path: string; excerpt: string }>;
  }>;
};

const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-note-index-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "คลัง ความรู้");
  mkdirSync(resolve(vault, "Projects"), { recursive: true });
  writeFileSync(resolve(vault, "Home.md"), "# Home\nเชื่อม [[Core]] และ [[ยังไม่มี]]\n");
  writeFileSync(resolve(vault, "Projects", "Core.md"), "# Core\nข้อมูลล่าสุดที่ยึดถือ\n");
  return realpathSync(vault);
}

async function loadApi(): Promise<NoteIndexApi | undefined> {
  try {
    const [root, index] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-index.js")
    ]);
    return { ...root, ...index } as NoteIndexApi;
  } catch {
    return undefined;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
describe("filesystem-direct note index", () => {
  it("resolves a basename Wikilink to a nested note and builds its backlink", async () => {
    const api = await loadApi();

    expect(api).toBeDefined();
    const vault = await api!.resolveApprovedVault(createVault());
    const index = await api!.buildNoteIndex(vault);

    expect(index.paths).toEqual(["Home.md", "Projects/Core.md"]);
    expect(index.outgoing("Home.md")).toEqual([
      { raw: "[[Core]]", target: "Core", resolved_path: "Projects/Core.md" },
      { raw: "[[ยังไม่มี]]", target: "ยังไม่มี" }
    ]);
    expect(index.backlinks("Projects/Core.md")).toEqual([
      { source_path: "Home.md", raw: "[[Core]]" }
    ]);
    expect(index.unresolved("Home.md")).toEqual([{ raw: "[[ยังไม่มี]]", target: "ยังไม่มี" }]);
  });

  it("searches Thai note content without Obsidian or a subprocess", async () => {
    const api = await loadApi();

    expect(api).toBeDefined();
    const vault = await api!.resolveApprovedVault(createVault());
    const index = await api!.buildNoteIndex(vault);

    expect(index.search("ข้อมูลล่าสุด", { limit: 5 })).toEqual([
      { path: "Projects/Core.md", excerpt: expect.stringContaining("ข้อมูลล่าสุด") }
    ]);
  });
});
