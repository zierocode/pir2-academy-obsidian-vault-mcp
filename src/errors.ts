import type { ToolFailureCode } from "./contracts.js";

export type VaultToolFailure = {
  code: ToolFailureCode;
  message: string;
};

export class VaultToolError extends Error {
  readonly code: ToolFailureCode;

  constructor(code: ToolFailureCode, message: string) {
    super(message);
    this.name = "VaultToolError";
    this.code = code;
  }
}
