# Testing Contract

Use strict TDD: each consumer-visible behavior has a focused failing test before implementation.

| Lane | Command | Evidence |
| --- | --- | --- |
| Focused contract | `npm test -- tests/contract/manifest.test.ts tests/contract/tools.test.ts tests/unit/contracts.test.ts` | Package, manifest, tool names, envelope |
| Focused safety | `npm test -- tests/unit/vault-root.test.ts tests/unit/note-path.test.ts tests/unit/note-reader.test.ts tests/integration/note-writer.test.ts` | Vault boundary and write transaction |
| Focused graph | `npm test -- tests/unit/graph-builder.test.ts tests/unit/graph-search.test.ts tests/unit/graph-traversal.test.ts tests/integration/graph-query.test.ts` | Graph indexing, search, links, and backlinks |
| Managed intake | `npm test -- tests/contract/source-intake-tools.test.ts tests/integration/source-intake-writer.test.ts` | Source policy, preview, apply, and registry |
| Transaction recovery | `npm test -- tests/integration/knowledge-writer.test.ts tests/integration/rollback.test.ts` | Atomic knowledge builds and receipt-bound rollback |
| Runtime | `npm run smoke` | Stdio server startup and MCP flow |
| Source gate | `npm run check` | Lint, types, all tests |
| Release candidate | `npm run scan:secrets && npm run bundle && npm run bundle:verify` | Credential exclusion and deterministic MCPB |
| Release contract | `make release && make status && make deploy && make rollback` | Auditable local artifact, distribution boundary, and rollback instruction |

No local source gate proves Claude Desktop installation, real personal-vault behavior, clean-machine OS parity, or release publication.
