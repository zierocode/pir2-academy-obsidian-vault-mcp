# Feature Inventory

## Implemented

- MCPB v0.4 manifest for macOS and Windows Node 20+
- One `approved_vault_root` directory configuration
- Fifteen stable local MCP tool names and stable result envelope
- Direct Markdown graph indexing, link/backlink traversal, search, audit, and change scanning
- Preview/confirm/apply knowledge builds with receipt-bound rollback
- Managed source inspection and intake with explicit policy boundaries
- Safe single-note preview/apply and optional Obsidian open action
- Local deterministic secret scan policy and runner

## Deferred

- GitHub release publication for `v0.5.0`
- Clean-machine macOS and Windows learner certification

## Verification

- Primary source gate: `npm run check`
- Secret gate: `npm run scan:secrets`
- Runtime smoke: `npm run smoke`
- Release candidate: `make release`
