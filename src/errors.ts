import type { ToolFailureCode } from "./contracts.js";

export type VaultToolFailure = {
  code: ToolFailureCode;
  message: string;
};
