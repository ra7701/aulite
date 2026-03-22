import { createHash } from "node:crypto";

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function hashAuditEntry(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return sha256(canonical);
}
