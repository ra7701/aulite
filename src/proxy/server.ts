import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { resolve, dirname as pathDirname } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual, createHash } from "node:crypto";
import type { AuliteConfig } from "../config/types.js";
import type { AuditLog } from "../logging/audit-log.js";
import { forwardRequest } from "./forwarder.js";
import { forwardStreamingRequest } from "./stream.js";
import { runPipeline } from "../analysis/pipeline.js";
import { scoreToLevel } from "../analysis/types.js";
import { loadRulePacks } from "../rules/loader.js";
import { getFullStats, type DateRange } from "../reporting/stats.js";
import { generateAuditReport } from "../reporting/audit-report.js";
import { generateFriaReport } from "../reporting/fria-report.js";
import { generateIncidentReport } from "../reporting/incident-report.js";
import { generateMonitoringReport } from "../reporting/monitoring-report.js";
import { getEntitlements, requirePro } from "../license.js";
import { logger, logRequest } from "../utils/logger.js";

const __serverDir = pathDirname(fileURLToPath(import.meta.url));
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function bufferPdf(pdf: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  return new Promise((resolve) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function resolveAction(pre: string, post: string): string {
  if (post === "block") return "block";
  if (pre === "warn" || post === "warn") return "warn";
  return "pass";
}

export function createServer(config: AuliteConfig, auditLog: AuditLog, version = "0.0.0"): Hono {
  const app = new Hono();
  const domains = config.analysis.domains;
  const ent = getEntitlements();

  function appendAuditError(requestBody: string) {
    auditLog.append({
      requestBody,
      responseBody: null,
      provider: config.provider.default,
      model: null,
      actionTaken: "error",
      domains,
    });
  }

  app.use("*", bodyLimit({ maxSize: 10 * 1024 * 1024 }));

  if (config.auth?.apiKeys?.length) {
    const validateKey = (key: string | undefined): boolean => {
      if (!key) return false;
      return config.auth!.apiKeys.some((valid) => safeCompare(key, valid));
    };

    app.use("/v1/*", async (c, next) => {
      const key = c.req.header("x-api-key") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
      if (!validateKey(key)) {
        return c.json({ error: { message: "Invalid or missing API key", type: "authentication_error" } }, 401);
      }
      return next();
    });

    app.use("/api/*", async (c, next) => {
      const key = c.req.header("x-api-key") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
      if (!validateKey(key)) {
        return c.json({ error: { message: "Invalid or missing API key", type: "authentication_error" } }, 401);
      }
      return next();
    });
  }

  if (config.rateLimit?.requestsPerMinute) {
    const maxRpm = config.rateLimit.requestsPerMinute;

    setInterval(() => {
      const cutoff = Date.now() - 120_000;
      for (const [key, bucket] of rateBuckets) {
        if (bucket.windowStart < cutoff) rateBuckets.delete(key);
      }
    }, 300_000).unref();

    app.use("/v1/*", async (c, next) => {
      const clientKey = c.req.header("x-api-key") ?? "anonymous";
      const now = Date.now();
      const bucket = rateBuckets.get(clientKey);

      if (!bucket || now - bucket.windowStart > 60_000) {
        rateBuckets.set(clientKey, { count: 1, windowStart: now });
      } else if (bucket.count >= maxRpm) {
        return c.json({ error: { message: `Rate limit exceeded (${maxRpm} requests/minute)`, type: "rate_limit_error" } }, 429);
      } else {
        bucket.count++;
      }
      return next();
    });
  }

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
  });

  app.get("/health", (c) => {
    const stats = auditLog.getStats();
    const { rules } = loadRulePacks(domains, config.analysis.rulesDir);
    return c.json({
      status: "ok",
      version,
      plan: ent.plan,
      mode: config.analysis.mode,
      domains,
      rulesLoaded: rules.length,
      auditEntries: stats.total,
      auth: !!config.auth?.apiKeys?.length,
      rateLimit: config.rateLimit?.requestsPerMinute ?? null,
      dashboardPages: ent.dashboardPages,
    });
  });

  app.get("/verify", (c) => {
    const result = auditLog.verify();
    return c.json(result, result.valid ? 200 : (500 as 200));
  });

  app.post("/v1/chat/completions", async (c) => {
    const startTime = performance.now();
    const requestBody = await c.req.text();

    let isStreaming = false;
    try { isStreaming = JSON.parse(requestBody).stream === true; } catch { /* non-JSON */ }

    const preAnalysis = await runPipeline(requestBody, null, config);

    if (preAnalysis.action === "block") {
      logRequest({
        method: "POST", path: "/v1/chat/completions", status: 403,
        elapsed: `${(performance.now() - startTime).toFixed(0)}ms`,
        score: preAnalysis.overallScore, level: preAnalysis.overallLevel,
        action: "block", checks: preAnalysis.checks.length,
      });

      auditLog.append({
        requestBody,
        responseBody: null,
        provider: config.provider.default,
        model: null,
        riskScore: preAnalysis.overallScore,
        riskLevel: preAnalysis.overallLevel,
        actionTaken: "block",
        checksJson: JSON.stringify(preAnalysis.checks),
        domains,
      });

      return c.json({
        error: {
          message: "Request blocked by Aulite compliance proxy",
          type: "compliance_violation",
          details: preAnalysis.checks.map((ch) => ({
            check: ch.check, score: ch.riskScore, details: ch.details, articleRef: ch.articleRef,
          })),
        },
      }, 403);
    }

    if (isStreaming) {
      try {
        const { stream, provider, model, contentPromise } = await forwardStreamingRequest(requestBody, c.req.raw.headers, config);

        contentPromise.then(async (responseText) => {
          const postAnalysis = await runPipeline(requestBody, responseText, config);
          const finalScore = Math.max(preAnalysis.overallScore, postAnalysis.overallScore);
          const finalChecks = [...preAnalysis.checks, ...postAnalysis.checks];
          const finalLevel = scoreToLevel(finalScore);
          const finalAction = resolveAction(preAnalysis.action, postAnalysis.action);

          auditLog.append({
            requestBody, responseBody: responseText, provider, model,
            riskScore: finalScore, riskLevel: finalLevel, actionTaken: finalAction,
            checksJson: JSON.stringify(finalChecks), domains,
          });

          logRequest({
            method: "POST", path: "/v1/chat/completions", status: 200,
            elapsed: `${(performance.now() - startTime).toFixed(0)}ms`,
            score: finalScore, level: finalLevel, action: finalAction, checks: finalChecks.length,
          });
        }).catch((err) => logger.error("Async audit failed", { error: String(err) }));

        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      } catch (err) {
        logger.error("Streaming proxy error", { error: String(err) });
        appendAuditError(requestBody);
        return c.json({ error: { message: "Proxy error", type: "proxy_error" } }, 502);
      }
    }

    try {
      const { responseBody, statusCode, provider, model } = await forwardRequest(requestBody, c.req.raw.headers, config);
      const postAnalysis = await runPipeline(requestBody, responseBody, config);

      const finalScore = Math.max(preAnalysis.overallScore, postAnalysis.overallScore);
      const finalChecks = [...preAnalysis.checks, ...postAnalysis.checks];
      const finalLevel = scoreToLevel(finalScore);
      const finalAction = resolveAction(preAnalysis.action, postAnalysis.action);

      auditLog.append({
        requestBody, responseBody, provider, model,
        riskScore: finalScore, riskLevel: finalLevel, actionTaken: finalAction,
        checksJson: JSON.stringify(finalChecks), domains,
      });

      logRequest({
        method: "POST", path: "/v1/chat/completions", status: statusCode,
        elapsed: `${(performance.now() - startTime).toFixed(0)}ms`,
        score: finalScore, level: finalLevel, action: finalAction, checks: finalChecks.length,
      });

      return c.body(responseBody, statusCode as 200, { "Content-Type": "application/json" });
    } catch (err) {
      logger.error("Proxy error", { error: String(err) });
      appendAuditError(requestBody);
      return c.json({ error: { message: "Proxy error", type: "proxy_error" } }, 502);
    }
  });

  function parseDateRange(c: { req: { query: (key: string) => string | undefined } }): DateRange {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    return {
      from: c.req.query("from") ?? thirtyDaysAgo.toISOString().split("T")[0],
      to: c.req.query("to") ?? now.toISOString().split("T")[0] + "T23:59:59",
    };
  }

  app.get("/api/stats", (c) => {
    const range = parseDateRange(c);
    return c.json(getFullStats(auditLog.getDatabase(), range));
  });

  app.get("/api/reports/:type", async (c) => {
    const check = requirePro("PDF reports");
    if (!check.allowed) {
      return c.json({ error: { message: check.error, type: "license_required" } }, 402);
    }

    const range = parseDateRange(c);
    const type = c.req.param("type");
    const db = auditLog.getDatabase();

    let pdf: PDFKit.PDFDocument;
    let filename: string;

    switch (type) {
      case "audit":
        pdf = generateAuditReport(db, range);
        filename = `aulite-audit-report-${range.from}.pdf`;
        break;
      case "fria":
        pdf = generateFriaReport(db, range, c.req.query("description"));
        filename = `aulite-fria-draft-${range.from}.pdf`;
        break;
      case "incidents":
        pdf = generateIncidentReport(db, range);
        filename = `aulite-incidents-${range.from}.pdf`;
        break;
      case "monitoring":
        pdf = generateMonitoringReport(db, range);
        filename = `aulite-monitoring-${range.from}.pdf`;
        break;
      default:
        return c.json({ error: { message: "Unknown report type", type: "invalid_request_error" } }, 404);
    }

    const buffer = await bufferPdf(pdf);
    return c.body(buffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  });

  app.all("/v1/*", (c) => {
    return c.json({ error: { message: `Unsupported endpoint: ${c.req.method} ${c.req.path}`, type: "invalid_request_error" } }, 404);
  });

  const dashPaths = [
    resolve(__serverDir, "../dashboard/dist"),
    resolve(__serverDir, "dashboard"),
    resolve(process.cwd(), "dashboard/dist"),
  ];
  const dashDir = dashPaths.find((d) => existsSync(resolve(d, "index.html")));

  if (dashDir) {
    const relRoot = dashDir.startsWith(process.cwd())
      ? dashDir.slice(process.cwd().length + 1) + "/"
      : dashDir + "/";

    app.use("/assets/*", serveStatic({ root: relRoot }));
    app.use("*", serveStatic({ root: relRoot }));
    app.get("*", serveStatic({ root: relRoot, path: "/index.html" }));

    logger.debug("Dashboard enabled", { path: dashDir });
  }

  return app;
}
