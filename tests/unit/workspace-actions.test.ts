import { describe, expect, it } from "vitest";
import { confirmationAction, learnerDescription } from "../../ui/workspace-actions.js";

describe("Second Brain workspace actions", () => {
  it("routes final confirmation back through the Claude conversation", () => {
    expect(confirmationAction()).toEqual({
      id: "confirm",
      label: "ยืนยันบันทึก",
      message: "ยืนยันบันทึก Preview นี้"
    });
  });

  it("removes an implementation path from learner-facing project copy", () => {
    expect(
      learnerDescription(
        "ประเมินทำเล วางงบ และเตรียมเปิดร้านรอบทดลอง — 02 โปรเจกต์/โครงการ-คอมมอนกราวด์-สาขาใหม่.md"
      )
    ).toBe("ประเมินทำเล วางงบ และเตรียมเปิดร้านรอบทดลอง");
  });

  it("keeps ordinary Thai descriptions unchanged", () => {
    expect(learnerDescription("สรุปสถานะ มติ และงานที่ต้องทำข้ามโปรเจกต์")).toBe(
      "สรุปสถานะ มติ และงานที่ต้องทำข้ามโปรเจกต์"
    );
  });
});
