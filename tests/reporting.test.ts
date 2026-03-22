import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDatabase } from "../src/logging/schema.js";
import { AuditLog } from "../src/logging/audit-log.js";
import { resolveEntitlements, resetLicense } from "../src/license.js";
import { getOverviewStats, getTopCategories, getTimeSeries, getProviderStats, getIncidents, getTopArticleViolations, getFullStats } from "../src/reporting/stats.js";
import { generateAuditReport } from "../src/reporting/audit-report.js";
import { generateFriaReport } from "../src/reporting/fria-report.js";
import { generateIncidentReport } from "../src/reporting/incident-report.js";
import { createServer } from "../src/proxy/server.js";
import type { AuliteConfig } from "../src/config/types.js";

const RANGE = { from: "2020-01-01", to: "2099-12-31" };

function testConfig(): AuliteConfig {
  return {
    server: { port: 3000, host: "0.0.0.0" },
    provider: { default: "anthropic" },
    analysis: {
      mode: "advisory",
      domains: ["hr"],
      llmJudge: { enabled: false, model: "claude-sonnet-4-6", sampleRate: 0 },
      thresholds: { warn: 4, block: 7 },
    },
    logging: { database: ":memory:", retentionDays: 365 },
  };
}

function seedData(auditLog: AuditLog): void {
  // Clean request
  auditLog.append({
    requestBody: '{"messages":[{"role":"user","content":"evaluate python skills"}]}',
    responseBody: '{"choices":[{"message":{"content":"Strong Python skills"}}]}',
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    riskScore: 0,
    riskLevel: "none",
    actionTaken: "pass",
    checksJson: "[]",
    domains: ["hr"],
  });

  // Flagged request (discrimination)
  auditLog.append({
    requestBody: '{"messages":[{"role":"user","content":"reject candidate - too old"}]}',
    responseBody: null,
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    riskScore: 8,
    riskLevel: "high",
    actionTaken: "warn",
    checksJson: JSON.stringify([
      {
        check: "keywords",
        riskScore: 8,
        riskLevel: "high",
        details: "[discrimination_age] Matched pattern: \"too old\". Dir. 2000/78/EC; EU Charter Art. 21",
        articleRef: "Dir. 2000/78/EC; EU Charter Art. 21 — Age discrimination",
      },
    ]),
    domains: ["hr"],
  });

  // Blocked request (prohibited practice)
  auditLog.append({
    requestBody: '{"messages":[{"role":"user","content":"use facial expression analysis"}]}',
    responseBody: null,
    provider: "openai",
    model: "gpt-4",
    riskScore: 10,
    riskLevel: "critical",
    actionTaken: "block",
    checksJson: JSON.stringify([
      {
        check: "keywords",
        riskScore: 10,
        riskLevel: "critical",
        details: "[prohibited_emotion] Matched pattern: \"facial expression analysis\". AI Act Art. 5(1)(f)",
        articleRef: "AI Act Art. 5(1)(f) — Emotion recognition in workplace is PROHIBITED",
      },
    ]),
    domains: ["hr"],
  });

  // Another flagged request (proxy discrimination)
  auditLog.append({
    requestBody: '{"messages":[{"role":"user","content":"not a good culture fit"}]}',
    responseBody: null,
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    riskScore: 6,
    riskLevel: "medium",
    actionTaken: "warn",
    checksJson: JSON.stringify([
      {
        check: "keywords",
        riskScore: 6,
        riskLevel: "medium",
        details: "[proxy_race] Matched pattern: \"culture fit\". Dir. 2000/43/EC",
        articleRef: "Dir. 2000/43/EC — 'Culture fit' functions as proxy for ethnicity/race discrimination",
      },
    ]),
    domains: ["hr"],
  });
}

describe("Stats Queries", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
    seedData(auditLog);
  });

  afterEach(() => {
    db.close();
  });

  it("returns correct overview stats", () => {
    const stats = getOverviewStats(db, RANGE);
    expect(stats.totalRequests).toBe(4);
    expect(stats.flaggedRequests).toBe(3);
    expect(stats.blockedRequests).toBe(1);
    expect(stats.passedRequests).toBe(1);
    expect(stats.maxRiskScore).toBe(10);
    expect(stats.avgRiskScore).toBeGreaterThan(0);
    expect(stats.riskDistribution).toHaveProperty("none");
    expect(stats.riskDistribution).toHaveProperty("critical");
  });

  it("returns top categories from check_details", () => {
    const categories = getTopCategories(db, RANGE);
    expect(categories.length).toBeGreaterThan(0);
    const names = categories.map((c) => c.category);
    expect(names).toContain("prohibited_emotion");
    expect(names).toContain("discrimination_age");
    expect(names).toContain("proxy_race");
  });

  it("returns top article violations", () => {
    const articles = getTopArticleViolations(db, RANGE);
    expect(articles.length).toBeGreaterThan(0);
    const refs = articles.map((a) => a.articleRef);
    expect(refs.some((r) => r.includes("Art. 5"))).toBe(true);
  });

  it("returns time series data", () => {
    const ts = getTimeSeries(db, RANGE);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts[0].totalRequests).toBeGreaterThan(0);
  });

  it("returns provider stats", () => {
    const providers = getProviderStats(db, RANGE);
    expect(providers.length).toBeGreaterThan(0);
    const providerNames = providers.map((p) => p.provider);
    expect(providerNames).toContain("anthropic");
  });

  it("returns incidents (blocked + high score)", () => {
    const incidents = getIncidents(db, RANGE);
    expect(incidents.length).toBe(2); // 1 blocked + 1 score >= 7
    expect(incidents.some((i) => i.actionTaken === "block")).toBe(true);
  });

  it("returns full stats bundle", () => {
    const full = getFullStats(db, RANGE);
    expect(full.overview.totalRequests).toBe(4);
    expect(full.topCategories.length).toBeGreaterThan(0);
    expect(full.timeSeries.length).toBeGreaterThan(0);
    expect(full.providers.length).toBeGreaterThan(0);
    expect(full.incidents.length).toBe(2);
  });
});

describe("PDF Report Generation", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
    seedData(auditLog);
  });

  afterEach(() => {
    db.close();
  });

  it("generates audit report PDF", async () => {
    const pdf = generateAuditReport(db, RANGE);
    const chunks: Buffer[] = [];
    for await (const chunk of pdf) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF magic bytes
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates FRIA draft PDF", async () => {
    const pdf = generateFriaReport(db, RANGE);
    const chunks: Buffer[] = [];
    for await (const chunk of pdf) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates FRIA with custom description", async () => {
    const pdf = generateFriaReport(db, RANGE, "AI system used for resume screening in HR department");
    const chunks: Buffer[] = [];
    for await (const chunk of pdf) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("generates incident report PDF", async () => {
    const pdf = generateIncidentReport(db, RANGE);
    const chunks: Buffer[] = [];
    for await (const chunk of pdf) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates empty incident report when no incidents", async () => {
    const cleanDb = initDatabase(":memory:");
    const pdf = generateIncidentReport(cleanDb, RANGE);
    const chunks: Buffer[] = [];
    for await (const chunk of pdf) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    cleanDb.close();
  });
});

describe("Reporting API Endpoints", () => {
  let db: Database.Database;
  let auditLog: AuditLog;

  beforeEach(() => {
    resetLicense();
    resolveEntitlements("aulite_pro_eyJwbGFuIjoicHJvIiwiZW1haWwiOiJ0ZXN0QGF1bGl0ZS5kZXYiLCJpc3N1ZWRBdCI6IjIwMjYtMDMtMjIiLCJleHBpcmVzQXQiOiIyMDM2LTAzLTIyIn0.lmzI3YtsJ0yazuw7zxef8s05PRfe02Lozu2KUKmVIXMkoAZbpgzuaCVyvpCUQH4SYv8SAHM7gvy7EOyr9WnUFuaqlZLz91XAWnZg1c-WnP9fOA1N8lhpqQB06IiyPBPqAY5JVYww6KnmnJwNOSpj-IoLrF-V-yOBMoqY6aLW2pOk3ADQtOS9W0ZVpr4BLp6KGKx5hftcpIL85Kx3ePtGbDmdwhvp-mGj9kI1HMUNaIWNXa4AhHswjVY3q7jw6nxGcC2iLi9z71ddqMnVISgHW6uFRXKVs5JWiDcmim5P4_53GEr5hO_8PCW4uEgFFnsvbJJxuRpYxJEPMVE8It9xHw");
    db = initDatabase(":memory:");
    auditLog = new AuditLog(db);
    seedData(auditLog);
  });

  afterEach(() => {
    resetLicense();
    db.close();
  });

  it("GET /api/stats returns JSON stats", async () => {
    const app = createServer(testConfig(), auditLog);
    const res = await app.request("/api/stats");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.totalRequests).toBe(4);
    expect(body.topCategories.length).toBeGreaterThan(0);
    expect(body.timeSeries.length).toBeGreaterThan(0);
  });

  it("GET /api/stats accepts date range", async () => {
    const app = createServer(testConfig(), auditLog);
    const res = await app.request("/api/stats?from=2020-01-01&to=2099-12-31");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.totalRequests).toBe(4);
  });

  it("GET /api/reports/audit returns PDF", async () => {
    const app = createServer(testConfig(), auditLog);
    const res = await app.request("/api/reports/audit?from=2020-01-01&to=2099-12-31");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("GET /api/reports/fria returns PDF", async () => {
    const app = createServer(testConfig(), auditLog);
    const res = await app.request("/api/reports/fria?from=2020-01-01&to=2099-12-31");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("GET /api/reports/incidents returns PDF", async () => {
    const app = createServer(testConfig(), auditLog);
    const res = await app.request("/api/reports/incidents?from=2020-01-01&to=2099-12-31");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
