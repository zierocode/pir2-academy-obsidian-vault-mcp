import { describe, expect, it } from "vitest";
import { getWorkspaceState } from "../../ui/workspace-state.js";

describe("Second Brain workspace navigation", () => {
  it("marks the project picker as the first step and exposes all Thai workflow labels", () => {
    expect(getWorkspaceState("project_picker")).toEqual({
      currentIndex: 0,
      currentLabel: "เลือกโปรเจกต์",
      steps: ["เลือกโปรเจกต์", "เลือกงาน", "ตรวจข้อมูล", "ดูผลลัพธ์", "ยืนยันบันทึก"]
    });
  });

  it("marks confirmation as the final workflow step", () => {
    expect(getWorkspaceState("confirmation")).toMatchObject({
      currentIndex: 4,
      currentLabel: "ยืนยันบันทึก"
    });
  });
});
