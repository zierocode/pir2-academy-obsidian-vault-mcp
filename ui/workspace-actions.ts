export type WorkspaceAction = { id: string; label: string; message: string };

export function confirmationAction(): WorkspaceAction {
  return {
    id: "confirm",
    label: "ยืนยันบันทึก",
    message: "ยืนยันบันทึก Preview นี้"
  };
}

export function learnerDescription(description: string): string {
  return description.replace(/\s+—\s+[^—\n]*\/[^\n]*\.md\s*$/iu, "").trim();
}
