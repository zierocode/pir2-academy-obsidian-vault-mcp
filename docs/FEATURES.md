# Feature Inventory

## Implemented

- MCPB v0.4 manifest for macOS and Windows Node 20+
- Configuration-free Cowork companion: no duplicate Vault directory setting
- One learner production tool: `render_second_brain_workspace`
- Previously hardened local Vault modules retained as tested library code, not exposed to learners
- Local deterministic secret scan policy and runner

## Deferred

- Public release and clean-machine Windows/macOS installation certification

## Verification

- Primary source gate: `npm run check`
- Secret gate: `npm run scan:secrets`
- Runtime smoke: added with the stdio server
