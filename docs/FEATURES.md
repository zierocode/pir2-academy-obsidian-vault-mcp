# Feature Inventory

## Implemented

- MCPB v0.4 manifest for macOS and Windows Node 20+
- One `approved_vault_root` directory configuration
- Seven stable local MCP tool names and stable result envelope
- Filesystem-direct Thai search, Wikilink resolution, outgoing links, Backlinks, unresolved links and bounded one/two-hop graph
- Core flow works while Obsidian is closed; the app opener is optional
- Safe preview-confirm writes with conflict detection, backup and atomic replacement
- Local deterministic secret scan policy and runner

## Deferred

- Physical clean-host Claude Desktop verification on macOS and Windows
- Course-plugin assembly and learner distribution

## Verification

- Primary source gate: `npm run check`
- Secret gate: `npm run scan:secrets`
- Runtime smoke: `npm run smoke`
