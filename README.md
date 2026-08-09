# PiR2 Academy Obsidian Vault MCP

MCP แบบ local สำหรับอ่าน ค้นหา เปิด และเขียน Obsidian Markdown ภายใน Vault ที่ผู้เรียนเลือกเพียงหนึ่งแห่งอย่างปลอดภัย

## ขอบเขต

Bundle นี้มี six tools: status, search, read, preview write, confirmed apply write, และ open. การตีความ meeting, decision/action extraction, และ weekly brief อยู่ใน Skill ของคอร์ส ไม่ใช่ MCP นี้

ทุก read/write ถูกจำกัดอยู่ใน approved vault root เดียว และปฏิเสธ `.obsidian`, `.pir2-academy-backups`, traversal, absolute path, symlink, และไฟล์ที่ไม่ใช่ Markdown. การเขียนต้อง preview ก่อน แล้วใช้ `ยืนยันบันทึก` หรือ `Confirm write` ที่ยังใหม่เท่านั้น

v1 ไม่มี delete, rename, move, bulk write, plugin install, shell command, remote sync, cloud vault, หรือ credential flow

## Requirements

- Node.js 20+
- Obsidian installer 1.12.7+ with Command line interface enabled
- Obsidian app available on the learner machine

## Maintainer commands

```sh
npm ci
npm run check
npm run smoke
npm run scan:secrets
npm run bundle
npm run bundle:verify
make doctor
```

The current verified state is recorded in `docs/LIVE.md`; test evidence is in `docs/TESTING.md`.
