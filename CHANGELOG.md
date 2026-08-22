# Changelog

## 0.2.0 - 2026-08-22

- Replaced app-dependent reads with a filesystem-direct index that works while Obsidian is closed.
- Added Thai/Windows-safe Wikilink parsing, nested-note resolution, Backlinks, unresolved links and bounded linked context.
- Added `get_obsidian_linked_context` as the seventh safe MCP tool.
- Preserved preview-confirm writes and added pinned `@bitbonsai/mcpvault@0.15.0` MIT attribution.
- Prepared the runtime for bundling with the PiR2 Academy course Skill as one learner plugin.

## 0.1.0 - 2026-08-09

- Added the local source contract for `pir2-academy-obsidian-vault@0.1.0`.
- Added manifest, six-tool contract, stable result envelope, and local secret scan.
- Added safe vault transactions, shell-free Obsidian CLI adapter, and stdio MCP server.
- Added deterministic MCPB packaging and verification for the public `v0.1.0` release candidate.
- Reused the sanitized course-owned PiR2 icon (SHA-256 `d79748c26865b1b3d2b45810874648b73e7eecc4c887bbff30baffdaf5cf54c7`).
