import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDatabase } from "../src/logging/schema.js";
import { AuditLog } from "../src/logging/audit-log.js";

describe("AuditLog", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
  });

  afterEach(() => {
    db.close();
  });

  it("appends an entry and returns an id", () => {
    const id = auditLog.append({
      requestBody: '{"model":"gpt-4","messages":[]}',
      responseBody: '{"choices":[]}',
      provider: "openai",
      model: "gpt-4",
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36); // UUID v4
  });

  it("increments sequence numbers", () => {
    auditLog.append({
      requestBody: "req1",
      responseBody: "res1",
      provider: "openai",
      model: null,
    });
    auditLog.append({
      requestBody: "req2",
      responseBody: "res2",
      provider: "openai",
      model: null,
    });

    const stats = auditLog.getStats();
    expect(stats.total).toBe(2);
    expect(stats.lastSequence).toBe(2);
  });

  it("produces a valid hash chain", () => {
    for (let i = 0; i < 5; i++) {
      auditLog.append({
        requestBody: `request-${i}`,
        responseBody: `response-${i}`,
        provider: "openai",
        model: "gpt-4",
      });
    }

    const result = auditLog.verify();
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  it("detects tampering in the hash chain", () => {
    for (let i = 0; i < 3; i++) {
      auditLog.append({
        requestBody: `request-${i}`,
        responseBody: `response-${i}`,
        provider: "openai",
        model: "gpt-4",
      });
    }

    // Tamper with an entry
    db.prepare("UPDATE audit_entries SET request_body = 'TAMPERED' WHERE sequence = 2").run();

    const result = auditLog.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it("handles null response body", () => {
    const id = auditLog.append({
      requestBody: '{"model":"gpt-4"}',
      responseBody: null,
      provider: "openai",
      model: "gpt-4",
      actionTaken: "error",
    });

    expect(id).toBeDefined();
    const result = auditLog.verify();
    expect(result.valid).toBe(true);
  });

  it("recovers chain state after reopening", () => {
    auditLog.append({
      requestBody: "req1",
      responseBody: "res1",
      provider: "openai",
      model: null,
    });

    // Create a new AuditLog instance (simulates restart)
    const auditLog2 = new AuditLog(db);
    auditLog2.append({
      requestBody: "req2",
      responseBody: "res2",
      provider: "openai",
      model: null,
    });

    const result = auditLog2.verify();
    expect(result.valid).toBe(true);
    expect(auditLog2.getStats().total).toBe(2);
  });
});
