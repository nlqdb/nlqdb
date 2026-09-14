// `DbCreateError` → registry code (SK-ERR-001). The orchestrator's typed union
// keeps every internal reason for the OTel span; only the closed params the
// registry declares reach the wire. The create path always runs on the free
// chain (even for BYOLLM callers — see the `x-nlq-byollm-key` note in
// `apps/api/src/index.ts`), so an `llm_failed` here is honestly `lane: "free"`.

import type { PipelineError } from "../error-envelope.ts";
import type { DbCreateError } from "./types.ts";

export function createWireError(error: DbCreateError): PipelineError {
  switch (error.kind) {
    case "infer_failed":
      return error.reason === "llm_failed"
        ? { code: "llm_failed", lane: "free" }
        : { code: "infer_failed", reason: error.reason };
    case "compile_failed":
      return { code: "compile_failed" };
    case "ddl_invalid":
      return { code: "ddl_invalid" };
    case "provision_failed":
      return { code: "provision_failed", rolled_back: error.rolled_back };
    case "embed_failed":
      return { code: "embed_failed", dbId: error.dbId };
  }
}
