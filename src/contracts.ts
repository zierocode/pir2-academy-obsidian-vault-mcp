export type ToolCode =
  | "OK"
  | "VAULT_NOT_READY"
  | "INVALID_NOTE_PATH"
  | "NOTE_NOT_FOUND"
  | "WRITE_PREVIEW_REQUIRED"
  | "WRITE_PREVIEW_EXPIRED"
  | "WRITE_CONFLICT"
  | "WRITE_NOT_CONFIRMED"
  | "GRAPH_UNINITIALIZED"
  | "GRAPH_STALE"
  | "GRAPH_CONFLICT"
  | "GRAPH_LIMIT_EXCEEDED"
  | "BUILD_PREVIEW_REQUIRED"
  | "BUILD_PREVIEW_EXPIRED"
  | "ROLLBACK_NOT_FOUND"
  | "ROLLBACK_CONFLICT"
  | "SOURCE_NOT_ACCESSIBLE"
  | "SOURCE_UNSUPPORTED"
  | "SOURCE_LIMIT_EXCEEDED"
  | "SOURCE_PREVIEW_REQUIRED"
  | "SOURCE_PREVIEW_EXPIRED"
  | "SOURCE_CHANGED"
  | "SOURCE_COPY_CONFLICT"
  | "OBSIDIAN_CLI_ERROR";

export type ToolFailureCode = Exclude<ToolCode, "OK">;

export type ToolResult<T> =
  | { ok: true; code: "OK"; message: string; data: T }
  | { ok: false; code: ToolFailureCode; message: string };

export const TOOL_NAMES = [
  "obsidian_vault_status",
  "scan_obsidian_changes",
  "search_obsidian_knowledge",
  "explore_obsidian_graph",
  "read_obsidian_notes",
  "inspect_obsidian_sources",
  "preview_obsidian_source_intake",
  "apply_obsidian_source_intake",
  "preview_obsidian_knowledge_build",
  "apply_obsidian_knowledge_build",
  "preview_obsidian_note_write",
  "apply_obsidian_note_write",
  "audit_obsidian_graph",
  "rollback_obsidian_change",
  "open_obsidian_note"
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolDefinition = {
  name: ToolName;
  description: string;
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  { name: "obsidian_vault_status", description: "ตรวจว่า Obsidian Vault ที่อนุญาตพร้อมใช้งานหรือยัง" },
  { name: "scan_obsidian_changes", description: "ตรวจหาไฟล์ใหม่ ไฟล์เปลี่ยน และสถานะกราฟภายใน Vault โดยไม่แก้ข้อมูล" },
  { name: "search_obsidian_knowledge", description: "ค้นหาความรู้พร้อมเส้นทางความสัมพันธ์จากลิงก์และแบ็กลิงก์ใน Vault" },
  { name: "explore_obsidian_graph", description: "สำรวจโน้ตที่เชื่อมโยงกันในกราฟ Obsidian แบบจำกัดขอบเขต" },
  { name: "read_obsidian_notes", description: "อ่านโน้ต Markdown ที่ระบุภายในขนาดปลอดภัย" },
  { name: "inspect_obsidian_sources", description: "ตรวจชนิด ขนาด hash และสถานะไฟล์ต้นทางก่อนให้ Cowork ทำความเข้าใจเนื้อหา" },
  { name: "preview_obsidian_source_intake", description: "สร้างตัวอย่างการนำไฟล์ต้นทางและความรู้เข้า Vault โดยยังไม่เขียนไฟล์" },
  { name: "apply_obsidian_source_intake", description: "นำเข้าไฟล์ต้นทางและความรู้ตามตัวอย่างล่าสุดหลังได้รับคำยืนยัน" },
  { name: "preview_obsidian_knowledge_build", description: "สร้างตัวอย่างการสร้างหรือรีเฟรช Knowledge Graph โดยยังไม่เขียนไฟล์" },
  { name: "apply_obsidian_knowledge_build", description: "ใช้แผน Knowledge Graph ที่ตรวจแล้วหลังได้รับคำยืนยันที่ถูกต้อง" },
  { name: "preview_obsidian_note_write", description: "สร้างตัวอย่างการเขียนโน้ตโดยยังไม่แก้ไฟล์จริง" },
  { name: "apply_obsidian_note_write", description: "บันทึกตัวอย่างล่าสุดหลังยืนยันด้วยข้อความที่กำหนด" },
  { name: "audit_obsidian_graph", description: "ตรวจสุขภาพลิงก์ แบ็กลิงก์ แหล่งข้อมูล และดัชนีกราฟโดยไม่แก้ไฟล์" },
  { name: "rollback_obsidian_change", description: "ย้อนคืนธุรกรรมที่รู้จักอย่างปลอดภัยโดยไม่ลบงานที่เกิดภายหลัง" },
  { name: "open_obsidian_note", description: "เปิดโน้ตที่ระบุในแอป Obsidian โดยไม่แก้เนื้อหา" }
];

export function toolDescription(name: ToolName): string {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name);
  if (!definition) throw new Error(`missing tool definition: ${name}`);
  return definition.description;
}

export function success<T>(message: string, data: T): ToolResult<T> {
  return { ok: true, code: "OK", message, data };
}

export function failure(code: ToolFailureCode, message: string): ToolResult<never> {
  return { ok: false, code, message };
}
