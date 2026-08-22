# Testing Contract

Use strict TDD: each consumer-visible behavior has a focused failing test before implementation.

| Lane | Command | Evidence |
| --- | --- | --- |
| Focused contract | `npm test -- tests/contract/manifest.test.ts tests/contract/tools.test.ts tests/unit/contracts.test.ts` | Package, manifest, tool names, envelope |
| Focused safety | `npm test -- tests/unit/vault-root.test.ts tests/unit/note-path.test.ts tests/unit/note-reader.test.ts tests/integration/note-writer.test.ts` | Vault boundary and write transaction |
| Graph | `npm test -- tests/unit/wikilinks.test.ts tests/unit/note-index.test.ts tests/integration/no-obsidian-runtime.test.ts` | Thai/Windows paths, Wikilinks, Backlinks and depth bounds without Obsidian |
| Runtime | `npm run smoke` | Stdio server startup and MCP flow |
| Source gate | `npm run check` | Lint, types, all tests |
| Release candidate | `npm run scan:secrets && npm run bundle && npm run bundle:verify` | Credential exclusion and deterministic MCPB |
| Release contract | `make release && make status && make deploy && make rollback` | Auditable local artifact, distribution boundary, and rollback instruction |

No local source gate proves Claude Desktop installation, physical macOS/Windows behavior, or release publication.
