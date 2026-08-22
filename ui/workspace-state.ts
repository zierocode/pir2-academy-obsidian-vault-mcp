export type WorkspaceKind =
  | "project_picker"
  | "scope_selector"
  | "intake_review"
  | "result_explorer"
  | "confirmation";

const WORKFLOW_STEPS = [
  "เลือกโปรเจกต์",
  "เลือกงาน",
  "ตรวจข้อมูล",
  "ดูผลลัพธ์",
  "ยืนยันบันทึก"
] as const;

const STEP_INDEX: Record<WorkspaceKind, number> = {
  project_picker: 0,
  scope_selector: 1,
  intake_review: 2,
  result_explorer: 3,
  confirmation: 4
};

export function getWorkspaceState(kind: WorkspaceKind): {
  currentIndex: number;
  currentLabel: string;
  steps: string[];
} {
  const currentIndex = STEP_INDEX[kind];
  return {
    currentIndex,
    currentLabel: WORKFLOW_STEPS[currentIndex],
    steps: [...WORKFLOW_STEPS]
  };
}
