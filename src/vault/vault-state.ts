import { auditGraph } from "../graph/audit.js";
import { readGraphIndex } from "../graph/graph-store.js";
import { scanVaultChanges, type SourceChange } from "./change-scanner.js";
import { readSourceRegistry } from "./source-registry.js";
import type { ApprovedVault } from "./vault-root.js";

export type VaultState = "empty" | "uninitialized" | "ready_clean" | "ready_dirty" | "conflicted" | "broken_graph" | "root_changed";

export type VaultStateReceipt = {
  state: VaultState;
  pendingChanges: number;
  changes: SourceChange[];
  graph: { status: "missing" | "ready" | "corrupt" | "wrong_root"; nodes: number; edges: number; issues: number };
};

export async function classifyVaultState(vault: ApprovedVault): Promise<VaultStateReceipt> {
  const [registry, stored] = await Promise.all([readSourceRegistry(vault), readGraphIndex(vault)]);
  const scan = await scanVaultChanges(vault, registry);
  if (stored.status !== "ready") {
    if (stored.status === "wrong_root") return receipt("root_changed", scan.changes, stored.status);
    if (stored.status === "corrupt") return receipt("broken_graph", scan.changes, stored.status);
    return receipt(scan.changes.length === 0 ? "empty" : "uninitialized", scan.changes, stored.status);
  }

  const audit = auditGraph(stored.index);
  if (!audit.healthy) {
    return {
      state: "broken_graph",
      pendingChanges: scan.changes.length,
      changes: scan.changes,
      graph: { status: "ready", nodes: stored.index.nodes.length, edges: stored.index.edges.length, issues: audit.issues.length }
    };
  }
  const state = scan.changes.some((change) => change.kind === "manual_edit")
    ? "conflicted"
    : scan.changes.length > 0 ? "ready_dirty" : "ready_clean";
  return {
    state,
    pendingChanges: scan.changes.length,
    changes: scan.changes,
    graph: { status: "ready", nodes: stored.index.nodes.length, edges: stored.index.edges.length, issues: 0 }
  };
}

function receipt(state: VaultState, changes: SourceChange[], status: "missing" | "corrupt" | "wrong_root"): VaultStateReceipt {
  return { state, pendingChanges: changes.length, changes, graph: { status, nodes: 0, edges: 0, issues: 0 } };
}
