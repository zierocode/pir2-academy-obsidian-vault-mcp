import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-graph-store-"));
  roots.push(parent);
  const root = resolve(parent, "ห้องความรู้");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("persisted graph index", () => {
  it("writes a rebuildable root-bound index without storing an absolute path", async () => {
    const { saveGraphIndex, readGraphIndex } = await import("../../src/graph/graph-store.js");
    const approved = vault();
    const index = {
      schemaVersion: 1 as const,
      nodes: [],
      edges: [],
      outgoing: {},
      backlinks: {}
    };

    await saveGraphIndex(approved, index, () => 1_724_284_800_000);
    const persisted = readFileSync(resolve(approved.realRoot, ".pir-acdm/graph-index.json"), "utf8");

    expect(persisted).not.toContain(approved.realRoot);
    expect(JSON.parse(persisted)).toMatchObject({ schema_version: 1, built_at: "2024-08-22T00:00:00.000Z" });
    await expect(readGraphIndex(approved)).resolves.toEqual({ status: "ready", index });
  });

  it("reports corrupt and wrong-root indexes without trusting their contents", async () => {
    const { readGraphIndex } = await import("../../src/graph/graph-store.js");
    const approved = vault();
    mkdirSync(resolve(approved.realRoot, ".pir-acdm"));
    writeFileSync(resolve(approved.realRoot, ".pir-acdm/graph-index.json"), "not-json");
    await expect(readGraphIndex(approved)).resolves.toEqual({ status: "corrupt" });

    writeFileSync(resolve(approved.realRoot, ".pir-acdm/graph-index.json"), JSON.stringify({
      schema_version: 1,
      root_fingerprint: "0".repeat(64),
      built_at: "2024-08-22T00:00:00.000Z",
      index: { schemaVersion: 1, nodes: [], edges: [], outgoing: {}, backlinks: {} }
    }));
    await expect(readGraphIndex(approved)).resolves.toEqual({ status: "wrong_root" });
  });
});
