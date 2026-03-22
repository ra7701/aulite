import type Database from "better-sqlite3";
import { createDoc, header, sectionTitle, paragraph, keyValue, table, footer } from "./pdf.js";
import { getOverviewStats, getTopCategories, getTopArticleViolations, getTimeSeries, getProviderStats, type DateRange } from "./stats.js";

/**
 * EU AI Act Art. 72 — Post-Market Monitoring Report.
 * Demonstrates continuous lifecycle monitoring of the AI system.
 */
export function generateMonitoringReport(db: Database.Database, range: DateRange): PDFKit.PDFDocument {
  const overview = getOverviewStats(db, range);
  const topCategories = getTopCategories(db, range, 20);
  const topArticles = getTopArticleViolations(db, range, 20);
  const timeSeries = getTimeSeries(db, range);
  const providers = getProviderStats(db, range);

  const doc = createDoc();

  header(
    doc,
    "Post-Market Monitoring Report",
    `EU AI Act Art. 72 — Continuous Lifecycle Monitoring | Period: ${range.from} to ${range.to}`,
  );

  paragraph(doc,
    "This report documents the continuous post-market monitoring of the AI system " +
    "in accordance with Art. 72 of the EU AI Act (Regulation 2024/1689). Providers of " +
    "high-risk AI systems must establish and document a post-market monitoring system " +
    "to actively collect, document, and analyze performance data throughout the system's lifetime.",
  );

  sectionTitle(doc, "1. Monitoring System Overview");

  paragraph(doc,
    "The monitoring system operates as a transparent compliance proxy, analyzing all " +
    "AI interactions in real time. Data is collected automatically without manual intervention.",
  );

  keyValue(doc, "Monitoring Period", `${range.from} — ${range.to}`);
  keyValue(doc, "Total Interactions Monitored", overview.totalRequests);
  keyValue(doc, "Compliance Flags Raised", overview.flaggedRequests);
  keyValue(doc, "Requests Blocked (Enforcing Mode)", overview.blockedRequests);
  keyValue(doc, "Average Risk Score", `${overview.avgRiskScore} / 10`);
  keyValue(doc, "Peak Risk Score", `${overview.maxRiskScore} / 10`);

  sectionTitle(doc, "2. Performance Trends (Art. 72(2))");
  paragraph(doc,
    "Art. 72(2) requires the post-market monitoring system to be proportionate to the " +
    "nature of AI technologies and risks. The following trends show system performance over time.",
  );

  if (timeSeries.length > 0) {
    const tsRows = timeSeries.slice(-30).map((t) => [
      t.period,
      String(t.totalRequests),
      String(t.flaggedRequests),
      String(t.avgRiskScore),
    ]);
    table(doc, ["Period", "Requests", "Flagged", "Avg Risk"], tsRows, [160, 100, 100, 135]);

    const firstPeriod = timeSeries[0];
    const lastPeriod = timeSeries[timeSeries.length - 1];
    const trendDirection = lastPeriod.avgRiskScore > firstPeriod.avgRiskScore ? "increasing" : "stable or decreasing";
    doc.moveDown(0.3);
    keyValue(doc, "Risk Trend", `${trendDirection} over the monitoring period`);
  } else {
    paragraph(doc, "No monitoring data available for this period.");
  }

  sectionTitle(doc, "3. Identified Risks and Patterns");
  paragraph(doc,
    "Categories of compliance risks detected during the monitoring period, " +
    "ranked by frequency of occurrence.",
  );

  if (topCategories.length > 0) {
    const catRows = topCategories.map((c) => [
      c.category,
      String(c.count),
      String(c.avgScore),
      String(c.maxScore),
      c.articleRef ?? "—",
    ]);
    table(doc, ["Category", "Count", "Avg", "Max", "Article"], catRows, [120, 55, 45, 45, 230]);
  } else {
    paragraph(doc, "No compliance risks detected during this period.");
  }

  sectionTitle(doc, "4. Legal Article Mapping");
  paragraph(doc,
    "Detected risks mapped to specific articles of the EU AI Act, " +
    "EU anti-discrimination directives, and GDPR.",
  );

  if (topArticles.length > 0) {
    const artRows = topArticles.map((a) => [
      a.articleRef,
      String(a.count),
      String(a.avgScore),
    ]);
    table(doc, ["Article / Directive", "Occurrences", "Avg Severity"], artRows, [300, 100, 95]);
  } else {
    paragraph(doc, "No article-specific violations detected.");
  }

  sectionTitle(doc, "5. AI Provider and Model Performance");

  if (providers.length > 0) {
    const provRows = providers.map((p) => [
      p.provider,
      p.model ?? "—",
      String(p.count),
      String(p.avgRiskScore),
    ]);
    table(doc, ["Provider", "Model", "Requests", "Avg Risk"], provRows, [120, 160, 80, 135]);
  } else {
    paragraph(doc, "No provider data available.");
  }

  sectionTitle(doc, "6. Risk Distribution");

  const riskRows = Object.entries(overview.riskDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([level, count]) => {
      const pct = overview.totalRequests > 0
        ? Math.round((count / overview.totalRequests) * 100)
        : 0;
      return [level.toUpperCase(), String(count), `${pct}%`];
    });

  if (riskRows.length > 0) {
    table(doc, ["Risk Level", "Count", "Percentage"], riskRows, [160, 160, 175]);
  }

  sectionTitle(doc, "7. Data Collection Methodology (Art. 72(3))");
  paragraph(doc, "Data is collected through the following automated mechanisms:");
  paragraph(doc, "  1. Real-time interception of all AI requests and responses via HTTP proxy");
  paragraph(doc, "  2. Deterministic keyword matching against 143 compliance rules (<2ms per request)");
  paragraph(doc, "  3. PII detection using 11 EU-specific patterns");
  paragraph(doc, "  4. Optional LLM-based semantic analysis for complex compliance scenarios");
  paragraph(doc, "  5. All data stored in tamper-evident hash-chained audit trail (SHA-256)");

  keyValue(doc, "Hash Algorithm", "SHA-256");
  keyValue(doc, "Storage", "Append-only SQLite with WAL mode");
  keyValue(doc, "Chain Integrity", "Verifiable via /verify endpoint");

  sectionTitle(doc, "8. Corrective Actions and Recommendations");
  paragraph(doc, "[ACTION REQUIRED] Based on the monitoring data above, the deployer should:");
  paragraph(doc, "  1. Review all critical/prohibited practice detections and take corrective action");
  paragraph(doc, "  2. Assess whether identified risks require updates to the risk management system (Art. 9)");
  paragraph(doc, "  3. Update the Fundamental Rights Impact Assessment if new risk patterns emerge (Art. 27)");
  paragraph(doc, "  4. Report any serious incidents to the market surveillance authority (Art. 73)");
  paragraph(doc, "  5. Consider whether additional human oversight measures are needed (Art. 14)");

  footer(doc, `Generated by Aulite — EU AI Act Compliance Proxy | ${new Date().toISOString()}`);

  doc.end();
  return doc;
}
