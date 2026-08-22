# PiR-ACDM — Obsidian Second Brain MCP

MCP แบบ local สำหรับสร้าง ตรวจ รีเฟรช ค้นหา และย้อนคืน Knowledge Graph ภายใน Obsidian Vault ที่ผู้เรียนเลือกเพียงหนึ่งแห่งอย่างปลอดภัย

## ขอบเขต

Bundle นี้มี 15 tools: status, change scan, graph-native search, graph explore,
read, source inspect/intake preview/apply, knowledge-build preview/apply, single-note preview/apply, graph audit,
receipt-bound rollback และ open. MCP จัดการไฟล์ กราฟ ลิงก์ แบ็กลิงก์
ธุรกรรม และหลักฐานเชิงโครงสร้าง แต่ไม่อ่านความหมายของ Word, Excel,
PowerPoint, PDF, รูป หรือเสียง การอ่านและตีความ meeting, requirement,
decision, weekly brief และงานเฉพาะโดเมนอยู่ใน Skill ไม่ได้ hardcode ใน MCP

ทุก read/write ถูกจำกัดอยู่ใน approved Vault root เดียว และปฏิเสธ
`.obsidian`, `.pir-acdm`, `.pir2-academy-backups`, traversal, absolute path,
symlink และ path ที่กำกวมบน Windows. การเขียนต้อง preview ก่อน แล้วใช้
`ยืนยันบันทึก` หรือ `Confirm write` ที่ยังใหม่เท่านั้น ธุรกรรมหลายไฟล์ตรวจ
hash ทุก target ก่อนเขียน สร้าง backup และหยุดทั้งชุดเมื่อพบ conflict

รุ่นนี้ไม่มีการลบ ย้าย หรือเปลี่ยนชื่อไฟล์ตามคำสั่งทั่วไป ไม่มี shell command,
remote sync, cloud Vault หรือ credential flow การลบไฟล์อนุญาตเฉพาะ rollback
ของไฟล์ที่ transaction receipt ระบุว่า MCP เป็นผู้สร้าง และต้องไม่มีการแก้ไขภายหลัง

## Requirements

- Claude Desktop/Cowork ที่รองรับ MCPB
- macOS หรือ Windows ตาม `manifest.json`
- Obsidian เป็นทางเลือกสำหรับ Graph View, Backlinks และการแก้โน้ตด้วยตนเอง

MCPB ใช้ Node runtime ที่ Claude Desktop จัดให้ ผู้เรียนไม่ต้องติดตั้ง Node หรือ
เปิด Obsidian CLI เพื่อใช้ status, scan, search, read, build, audit หรือ rollback

## Maintainer commands

```sh
npm ci
npm run check
npm run smoke
npm run scan:secrets
npm run bundle
npm run bundle:verify
make status
make release
make deploy
make rollback
make doctor
```

`npm run bundle` writes the local deterministic release candidate to
`dist/pir-acdm-obsidian-vault-0.5.0.mcpb` and prints its SHA-256 checksum.
`npm run bundle:verify` validates its MCPB v0.4 metadata, runtime dependency
closure, executable entry point, and exclusions. These commands do not publish,
install, or upload the bundle.

`make release` is the local secret-scan/build/verify gate. `make deploy` records
that this project has no deployed service—the `.mcpb` is distributed only as a
GitHub Release asset. `make rollback` reports the protected owner boundary for
reverting a published release.

The package icon is the unchanged PiR2 Academy course-owned icon reused from
`course-assets/create-mcp/sheets-reader-workshop/assets/icons/icon.png`
(SHA-256 `d79748c26865b1b3d2b45810874648b73e7eecc4c887bbff30baffdaf5cf54c7`).

The current verified state is recorded in `docs/LIVE.md`; test evidence is in `docs/TESTING.md`.
