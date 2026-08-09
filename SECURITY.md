# Security policy

Do not disclose potential vulnerabilities, vault content, or credentials in public issues, discussions, or pull requests.

Report the affected version, impact, and minimal reproduction privately to the PiR2 Academy maintainers. Do not attach learner notes, secrets, tokens, absolute personal paths, or production data.

Security invariants are one approved vault root, no symlink traversal, no `.obsidian` access, preview plus exact confirmation, recoverable backup, atomic write, no shell execution, and no destructive file tools.

The local MCPB verifier rejects source/test artifacts, source maps, type
artifacts, local environment files, absolute source paths, and credential-shaped
content in package-owned files. Runtime dependency files are included only from
the locked production dependency closure.
