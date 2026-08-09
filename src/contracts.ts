export type ToolCode =
  | "OK"
  | "VAULT_NOT_READY"
  | "INVALID_NOTE_PATH"
  | "NOTE_NOT_FOUND"
  | "WRITE_PREVIEW_REQUIRED"
  | "WRITE_PREVIEW_EXPIRED"
  | "WRITE_CONFLICT"
  | "WRITE_NOT_CONFIRMED"
  | "OBSIDIAN_CLI_ERROR";

export type ToolFailureCode = Exclude<ToolCode, "OK">;

export type ToolResult<T> =
  | { ok: true; code: "OK"; message: string; data: T }
  | { ok: false; code: ToolFailureCode; message: string };

export const TOOL_NAMES = [
  "obsidian_vault_status",
  "search_obsidian_notes",
  "read_obsidian_notes",
  "preview_obsidian_note_write",
  "apply_obsidian_note_write",
  "open_obsidian_note"
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolDefinition = {
  name: ToolName;
  description: string;
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  { name: "obsidian_vault_status", description: "ตรวจว่า Obsidian Vault ที่อนุญาตพร้อมใช้งานหรือยัง" },
  { name: "search_obsidian_notes", description: "ค้นหาโน้ต Markdown ภายใน Obsidian Vault ที่อนุญาต" },
  { name: "read_obsidian_notes", description: "อ่านโน้ต Markdown ที่ระบุภายในขนาดปลอดภัย" },
  { name: "preview_obsidian_note_write", description: "สร้างตัวอย่างการเขียนโน้ตโดยยังไม่แก้ไฟล์จริง" },
  { name: "apply_obsidian_note_write", description: "บันทึกตัวอย่างล่าสุดหลังยืนยันด้วยข้อความที่กำหนด" },
  { name: "open_obsidian_note", description: "เปิดโน้ตที่ระบุในแอป Obsidian โดยไม่แก้เนื้อหา" }
];

export function success<T>(message: string, data: T): ToolResult<T> {
  return { ok: true, code: "OK", message, data };
}

export function failure(code: ToolFailureCode, message: string): ToolResult<never> {
  return { ok: false, code, message };
}
