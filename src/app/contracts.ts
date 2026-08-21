import { z } from "zod";

export const SECOND_BRAIN_RESOURCE_URI =
  "ui://pir2-academy-obsidian-vault/second-brain-workspace.html";

const safeText = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !/[<>]/u.test(value), "markup is not allowed");

const relativeNotePath = safeText.refine(
  (value) =>
    value.endsWith(".md") &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.split(/[\\/]/u).includes(".."),
  "notePath must be a relative Markdown path"
);

const optionSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/u),
  label: safeText,
  description: safeText.optional(),
  selected: z.boolean().optional(),
  message: safeText
});

const sourceSchema = z.object({
  label: safeText,
  locator: safeText,
  notePath: relativeNotePath
});

const actionSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/u),
  label: safeText,
  message: safeText
});

const baseView = z.object({
  title: safeText,
  subtitle: safeText.optional()
});

const projectPicker = baseView.extend({
  kind: z.literal("project_picker"),
  reasoning: z.array(safeText).max(6).optional(),
  options: z.array(optionSchema).min(1).max(4)
});

const scopeSelector = baseView.extend({
  kind: z.literal("scope_selector"),
  options: z.array(optionSchema).min(1).max(4),
  advanced: z.array(optionSchema).max(4).optional()
});

const intakeReview = baseView.extend({
  kind: z.literal("intake_review"),
  metrics: z.array(z.object({ label: safeText, value: safeText })).max(8),
  proposedNotes: z.array(relativeNotePath).min(1).max(8),
  warnings: z.array(safeText).max(8).optional(),
  actions: z.array(actionSchema).min(1).max(4)
});

const resultExplorer = baseView.extend({
  kind: z.literal("result_explorer"),
  summary: safeText,
  metrics: z.array(z.object({ label: safeText, value: safeText })).max(8).optional(),
  sources: z.array(sourceSchema).max(20),
  actions: z.array(actionSchema).max(4)
});

const confirmation = baseView.extend({
  kind: z.literal("confirmation"),
  previewId: z.string().trim().min(1).max(200),
  target: relativeNotePath,
  changes: z.array(safeText).min(1).max(12)
});

export const SecondBrainViewSchema = z.discriminatedUnion("kind", [
  projectPicker,
  scopeSelector,
  intakeReview,
  resultExplorer,
  confirmation
]);

export type SecondBrainView = z.infer<typeof SecondBrainViewSchema>;

export function exampleSecondBrainView(kind: "project_picker"): z.infer<typeof projectPicker>;
export function exampleSecondBrainView(kind: "scope_selector"): z.infer<typeof scopeSelector>;
export function exampleSecondBrainView(kind: "intake_review"): z.infer<typeof intakeReview>;
export function exampleSecondBrainView(kind: "result_explorer"): z.infer<typeof resultExplorer>;
export function exampleSecondBrainView(kind: "confirmation"): z.infer<typeof confirmation>;
export function exampleSecondBrainView(kind: SecondBrainView["kind"]): SecondBrainView {
  const common = { title: "Second Brain Workspace" };
  switch (kind) {
    case "project_picker":
      return {
        ...common,
        kind,
        reasoning: ["พบชื่อโครงการและสถานที่ตรงกับข้อมูลเดิม"],
        options: [{ id: "project", label: "โปรเจกต์ที่แนะนำ", message: "เลือกโปรเจกต์ที่แนะนำ" }]
      };
    case "scope_selector":
      return {
        ...common,
        kind,
        options: [{ id: "current", label: "ใช้ขอบเขตที่แนะนำ", message: "ใช้ขอบเขตที่แนะนำ" }]
      };
    case "intake_review":
      return {
        ...common,
        kind,
        metrics: [{ label: "Facts", value: "8" }],
        proposedNotes: ["03 Knowledge/Customers/Customer Survey.md"],
        actions: [{ id: "preview", label: "สร้าง Preview", message: "สร้าง Preview" }]
      };
    case "result_explorer":
      return {
        ...common,
        kind,
        summary: "พบคำตอบพร้อมหลักฐานจาก Vault",
        sources: [{ label: "Customer Survey", locator: "Sheet: Summary", notePath: "03 Knowledge/Customers/Customer Survey.md" }],
        actions: [{ id: "agenda", label: "เตรียม Meeting Agenda", message: "เตรียม Meeting Agenda จากผลลัพธ์นี้" }]
      };
    case "confirmation":
      return {
        ...common,
        kind,
        previewId: "preview-1",
        target: "03 Knowledge/Customers/Customer Survey.md",
        changes: ["สร้าง Knowledge Note ใหม่หนึ่งรายการ"]
      };
  }
}
