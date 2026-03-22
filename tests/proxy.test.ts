import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDatabase } from "../src/logging/schema.js";
import { AuditLog } from "../src/logging/audit-log.js";
import { createServer } from "../src/proxy/server.js";
import { resolveEntitlements, resetLicense } from "../src/license.js";
import type { AuliteConfig } from "../src/config/types.js";

function createTestConfig(overrides?: Partial<AuliteConfig>): AuliteConfig {
  return {
    server: { port: 3000, host: "0.0.0.0" },
    provider: {
      default: "openai",
      openai: {
        baseUrl: "http://localhost:9999", // Non-existent, for error testing
        apiKey: "test-key",
      },
    },
    analysis: {
      mode: "advisory",
      domains: ["hr"],
      llmJudge: { enabled: false, model: "claude-sonnet-4-6", sampleRate: 0.1 },
      thresholds: { warn: 4, block: 7 },
    },
    logging: { database: ":memory:", retentionDays: 365 },
    ...overrides,
  };
}

describe("Proxy Server", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
  });

  afterEach(() => {
    db.close();
  });

  it("responds to health check", async () => {
    const app = createServer(createTestConfig(), auditLog);
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(body.auditEntries).toBe(0);
    expect(body.domains).toEqual(["hr"]);
  });

  it("responds to verify endpoint", async () => {
    const app = createServer(createTestConfig(), auditLog);
    const res = await app.request("/verify");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.entriesChecked).toBe(0);
  });

  it("returns 404 for unknown endpoints", async () => {
    const app = createServer(createTestConfig(), auditLog);
    const res = await app.request("/v1/unknown");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.type).toBe("invalid_request_error");
  });

  it("returns 502 when upstream is unreachable", async () => {
    const app = createServer(createTestConfig(), auditLog);
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.type).toBe("proxy_error");
  });

  it("logs failed requests to audit trail", async () => {
    const app = createServer(createTestConfig(), auditLog);

    await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4", messages: [] }),
    });

    const stats = auditLog.getStats();
    expect(stats.total).toBe(1);
  });
});

describe("API Key Auth", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    resetLicense();
    resolveEntitlements("aulite_pro_eyJwbGFuIjoicHJvIiwiZW1haWwiOiJ0ZXN0QGF1bGl0ZS5kZXYiLCJpc3N1ZWRBdCI6IjIwMjYtMDMtMjIiLCJleHBpcmVzQXQiOiIyMDM2LTAzLTIyIn0.lmzI3YtsJ0yazuw7zxef8s05PRfe02Lozu2KUKmVIXMkoAZbpgzuaCVyvpCUQH4SYv8SAHM7gvy7EOyr9WnUFuaqlZLz91XAWnZg1c-WnP9fOA1N8lhpqQB06IiyPBPqAY5JVYww6KnmnJwNOSpj-IoLrF-V-yOBMoqY6aLW2pOk3ADQtOS9W0ZVpr4BLp6KGKx5hftcpIL85Kx3ePtGbDmdwhvp-mGj9kI1HMUNaIWNXa4AhHswjVY3q7jw6nxGcC2iLi9z71ddqMnVISgHW6uFRXKVs5JWiDcmim5P4_53GEr5hO_8PCW4uEgFFnsvbJJxuRpYxJEPMVE8It9xHw");
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
  });

  afterEach(() => {
    resetLicense();
    db.close();
  });

  it("rejects requests without API key when auth is enabled", async () => {
    const app = createServer(
      createTestConfig({ auth: { apiKeys: ["secret-key-123"] } }),
      auditLog,
    );
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.type).toBe("authentication_error");
  });

  it("rejects requests with wrong API key", async () => {
    const app = createServer(
      createTestConfig({ auth: { apiKeys: ["secret-key-123"] } }),
      auditLog,
    );
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "wrong-key",
      },
      body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] }),
    });

    expect(res.status).toBe(401);
  });

  it("accepts requests with valid x-api-key header", async () => {
    const app = createServer(
      createTestConfig({ auth: { apiKeys: ["secret-key-123"] } }),
      auditLog,
    );
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "secret-key-123",
      },
      body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] }),
    });

    // 502 because upstream is unreachable — but auth passed
    expect(res.status).toBe(502);
  });

  it("accepts requests with valid Bearer token", async () => {
    const app = createServer(
      createTestConfig({ auth: { apiKeys: ["secret-key-123"] } }),
      auditLog,
    );
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer secret-key-123",
      },
      body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] }),
    });

    expect(res.status).toBe(502); // auth passed, upstream unreachable
  });

  it("does not require auth for health endpoint", async () => {
    const app = createServer(
      createTestConfig({ auth: { apiKeys: ["secret-key-123"] } }),
      auditLog,
    );
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auth).toBe(true);
  });

  it("allows requests when no auth is configured", async () => {
    const app = createServer(createTestConfig(), auditLog);
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] }),
    });

    // No 401 — goes straight to upstream (which fails with 502)
    expect(res.status).toBe(502);
  });
});

describe("Rate Limiting", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    resetLicense();
    resolveEntitlements("aulite_pro_eyJwbGFuIjoicHJvIiwiZW1haWwiOiJ0ZXN0QGF1bGl0ZS5kZXYiLCJpc3N1ZWRBdCI6IjIwMjYtMDMtMjIiLCJleHBpcmVzQXQiOiIyMDM2LTAzLTIyIn0.lmzI3YtsJ0yazuw7zxef8s05PRfe02Lozu2KUKmVIXMkoAZbpgzuaCVyvpCUQH4SYv8SAHM7gvy7EOyr9WnUFuaqlZLz91XAWnZg1c-WnP9fOA1N8lhpqQB06IiyPBPqAY5JVYww6KnmnJwNOSpj-IoLrF-V-yOBMoqY6aLW2pOk3ADQtOS9W0ZVpr4BLp6KGKx5hftcpIL85Kx3ePtGbDmdwhvp-mGj9kI1HMUNaIWNXa4AhHswjVY3q7jw6nxGcC2iLi9z71ddqMnVISgHW6uFRXKVs5JWiDcmim5P4_53GEr5hO_8PCW4uEgFFnsvbJJxuRpYxJEPMVE8It9xHw");
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
  });

  afterEach(() => {
    resetLicense();
    db.close();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const app = createServer(
      createTestConfig({ rateLimit: { requestsPerMinute: 2 } }),
      auditLog,
    );

    const body = JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hi" }] });
    const headers = { "Content-Type": "application/json" };

    // First 2 requests pass (get 502 because upstream is unreachable)
    const r1 = await app.request("/v1/chat/completions", { method: "POST", headers, body });
    expect(r1.status).toBe(502);

    const r2 = await app.request("/v1/chat/completions", { method: "POST", headers, body });
    expect(r2.status).toBe(502);

    // Third request is rate limited
    const r3 = await app.request("/v1/chat/completions", { method: "POST", headers, body });
    expect(r3.status).toBe(429);

    const err = await r3.json();
    expect(err.error.type).toBe("rate_limit_error");
  });
});
