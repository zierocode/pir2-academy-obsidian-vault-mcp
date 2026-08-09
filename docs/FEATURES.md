# Feature Inventory

## Implemented

- MCPB v0.4 manifest for macOS and Windows Node 20+
- One `approved_vault_root` directory configuration
- Six stable local MCP tool names and stable result envelope
- Local deterministic secret scan policy and runner

## Deferred

- Vault boundary, safe writes, Obsidian CLI adapter, stdio server, MCPB archive, CI release certification, and Desktop installation

## Verification

- Primary source gate: `npm run check`
- Secret gate: `npm run scan:secrets`
- Runtime smoke: added with the stdio server
