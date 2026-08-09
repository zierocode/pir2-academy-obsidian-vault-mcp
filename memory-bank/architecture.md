# Architecture

## Overview

The local stdio server validates tool input, delegates filesystem safety to the vault layer, and invokes only fixed official Obsidian CLI argument arrays. The MCP never interprets meeting content.

## Components

| Component | Responsibility |
|---|---|
| Contracts | Tool names, stable envelopes, learner-safe messages |
| Vault layer | Canonical root/path checks, bounded reads, preview, backup, atomic write |
| CLI adapter | Fixed `obsidian` command families, bounded output, no shell |
| Stdio server | Zod schemas and six MCP tools |
| Packaging | MCPB archive, secret scan, deterministic verification |

## Safety flow

1. Resolve the configured vault through `realpath`.
2. Resolve a relative Markdown note while denying forbidden/symlink components.
3. Preview a write; require a fresh exact confirmation; recheck source hash; backup and atomically replace.
