# Changelog

## 0.2.6 - 2026-08-21

- Accept Thai-first option and action identifiers emitted by Sonnet so valid workspace views do not fail before rendering.

## 0.2.5 - 2026-08-21

- ส่งการยืนยันบันทึกกลับเข้า Claude/Cowork เพื่อให้การเขียนไฟล์ใช้ native file tools ตามสิทธิ์โฟลเดอร์ของ task
- ตัด path Markdown ภายในออกจากคำอธิบายการ์ดโปรเจกต์ เพื่อให้ UI ภาษาไทยอ่านง่ายขึ้น

## 0.2.4 - 2026-08-21

- Opens the interactive Second Brain workspace in Claude fullscreen when the host supports it.
- Adds a Thai-first five-step workspace shell, project cards, live status and safe inline fallback.
- Keeps a visible full-screen toggle because the Claude host has final control over display mode.

## 0.2.3 - 2026-08-21

- เปลี่ยนชื่อพื้นที่ทำงานและตัวอย่าง UI ให้เป็นภาษาไทยก่อน พร้อมรักษาคำว่า Second Brain เป็นชื่อแนวคิด
- คงการรองรับ payload alias ของ Claude Desktop และ direct-filesystem runtime จาก 0.2.2

## 0.2.2 - 2026-08-21

- Accept the safe `type` alias for Second Brain UI views and normalize it to
  `kind` before the existing bounded view validation.
- Preserve the direct-filesystem macOS and Windows runtime from 0.2.1.

## 0.2.1 - 2026-08-21

- Make approved-folder filesystem access the cross-platform core for status, search, read, preview, and write.
- Keep opening a note in Obsidian optional so Claude Desktop works without launching Obsidian on macOS or Windows.

## 0.2.0 - 2026-08-21

- Added the inline Second Brain Workspace MCP App with five bounded view states.
- Preserved the six existing vault tools and Preview/Confirm write boundary.

## 0.1.0 - 2026-08-09

- Added the local source contract for `pir2-academy-obsidian-vault@0.1.0`.
- Added manifest, six-tool contract, stable result envelope, and local secret scan.
- Added safe vault transactions, shell-free Obsidian CLI adapter, and stdio MCP server.
- Added deterministic MCPB packaging and verification for the public `v0.1.0` release candidate.
- Reused the sanitized course-owned PiR2 icon (SHA-256 `d79748c26865b1b3d2b45810874648b73e7eecc4c887bbff30baffdaf5cf54c7`).
