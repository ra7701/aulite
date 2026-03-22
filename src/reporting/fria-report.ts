import type Database from "better-sqlite3";
import { createDoc, header, sectionTitle, paragraph, keyValue, table, footer } from "./pdf.js";
import { getOverviewStats, getTopCategories, getTopArticleViolations, type DateRange } from "./stats.js";

/**
 * Generate an EU AI Act Art. 27 Fundamental Rights Impact Assessment (FRIA) draft.
 * Pre-fills the 6 mandatory sections (Art. 27(1)(a-f)) with data from the audit trail.
 * Sections requiring human input are marked with [ACTION REQUIRED].
 */
export function generateFriaReport(db: Database.Database, range: DateRange, systemDescription?: string): PDFKit.PDFDocument {
  const overview = getOverviewStats(db, range);
  const topCategories = getTopCategories(db, range, 20);
  const topArticles = getTopArticleViolations(db, range);

  const doc = createDoc();

  header(
    doc,
    "Fundamental Rights Impact Assessment",
    `EU AI Act Art. 27 — FRIA Draft | Based on monitoring data: ${range.from} to ${range.to}`,
  );

  paragraph(doc,
    "This document provides a draft Fundamental Rights Impact Assessment as required by " +
    "Art. 27 of the EU AI Act (Regulation 2024/1689). Sections marked [ACTION REQUIRED] " +
    "must be completed by the deployer before submission. Data-driven sections are " +
    "pre-populated from Aulite's monitoring audit trail.",
  );

  paragraph(doc,
    "Art. 27(2): This assessment must be performed BEFORE first use of the high-risk AI system. " +
    "It must be updated when circumstances substantially change.",
  );

  sectionTitle(doc, "Section (a) — Deployer's Processes (Art. 27(1)(a))");
  paragraph(doc, "Description of the deployer's processes in which the AI system will be used, in line with its intended purpose.");
  doc.moveDown(0.3);

  if (systemDescription) {
    paragraph(doc, systemDescription);
  } else {
    paragraph(doc, "[ACTION REQUIRED] Describe the specific business processes where this AI system is deployed. Include:");
    paragraph(doc, "  • The intended purpose of the AI system in your organization");
    paragraph(doc, "  • The specific workflows and decision-making processes where AI output is used");
    paragraph(doc, "  • How the system integrates with existing processes");
    paragraph(doc, "  • Whether the system makes, supports, or informs decisions");
  }

  sectionTitle(doc, "Section (b) — Period and Frequency of Use (Art. 27(1)(b))");
  paragraph(doc, "Description of the period of time and frequency with which the AI system is intended to be used.");
  doc.moveDown(0.3);

  keyValue(doc, "Monitoring Period (observed)", `${range.from} — ${range.to}`);
  keyValue(doc, "Total Interactions Recorded", overview.totalRequests);

  if (overview.totalRequests > 0) {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000));
    keyValue(doc, "Average Interactions per Day", Math.round(overview.totalRequests / days));
  }

  doc.moveDown(0.3);
  paragraph(doc, "[ACTION REQUIRED] Confirm intended deployment period and expected usage frequency.");

  sectionTitle(doc, "Section (c) — Categories of Affected Persons (Art. 27(1)(c))");
  paragraph(doc, "Categories of natural persons and groups likely to be affected by the system's use.");
  doc.moveDown(0.3);

  paragraph(doc, "[ACTION REQUIRED] Identify and list all categories of natural persons affected. Consider:");
  paragraph(doc, "  • Direct subjects of AI decisions (e.g., job applicants, loan applicants, students)");
  paragraph(doc, "  • Vulnerable groups (persons under 18, elderly, disabled, economically disadvantaged)");
  paragraph(doc, "  • Workers interacting with or monitored by the system");
  paragraph(doc, "  • Third parties indirectly affected");

  if (topCategories.length > 0) {
    doc.moveDown(0.3);
    paragraph(doc, "Detected risk categories from monitoring data (may indicate affected groups):");
    const catRows = topCategories
      .filter((c) => c.category.startsWith("discrimination_") || c.category.startsWith("proxy_"))
      .slice(0, 10)
      .map((c) => [c.category.replace(/^(discrimination_|proxy_)/, ""), String(c.count), c.articleRef ?? "—"]);

    if (catRows.length > 0) {
      table(doc, ["Protected Characteristic", "Detections", "Legal Basis"], catRows, [200, 100, 195]);
    }
  }

  sectionTitle(doc, "Section (d) — Specific Risks of Harm (Art. 27(1)(d))");
  paragraph(doc, "Specific risks of harm likely to impact the identified categories of persons or groups.");
  doc.moveDown(0.3);

  paragraph(doc, "Risks identified from automated monitoring:");

  keyValue(doc, "Compliance Flags Detected", overview.flaggedRequests);
  keyValue(doc, "Critical/Prohibited Practice Detections", overview.riskDistribution["critical"] ?? 0);
  keyValue(doc, "High-Risk Detections", overview.riskDistribution["high"] ?? 0);
  keyValue(doc, "Requests Blocked", overview.blockedRequests);

  if (topArticles.length > 0) {
    doc.moveDown(0.5);
    paragraph(doc, "Specific EU law articles triggered by detected risks:");
    const artRows = topArticles.slice(0, 10).map((a) => [a.articleRef, String(a.count), String(a.avgScore)]);
    table(doc, ["Article Violated", "Occurrences", "Avg Severity"], artRows, [280, 110, 105]);
  }

  doc.moveDown(0.3);
  paragraph(doc, "[ACTION REQUIRED] Assess likelihood, severity, and reversibility of each identified risk.");

  sectionTitle(doc, "Section (e) — Human Oversight Measures (Art. 27(1)(e))");
  paragraph(doc, "Description of the implementation of human oversight measures, according to the instructions for use.");
  doc.moveDown(0.3);

  paragraph(doc, "Automated oversight provided by Aulite:");
  paragraph(doc, "  • Real-time compliance screening of all AI interactions (Art. 14)");
  paragraph(doc, "  • Automated detection of prohibited practices (Art. 5)");
  paragraph(doc, "  • PII/special category data detection (GDPR Art. 9)");
  paragraph(doc, "  • Tamper-evident audit trail with hash chain verification (Art. 12)");

  const humanOversightChecks = topCategories.filter(
    (c) => c.category.includes("human_oversight") || c.category.includes("no_right_to_contest"),
  );
  if (humanOversightChecks.length > 0) {
    doc.moveDown(0.3);
    paragraph(doc, "WARNING: Human oversight violations detected in monitoring data:");
    for (const c of humanOversightChecks) {
      paragraph(doc, `  • ${c.category}: ${c.count} occurrences (${c.articleRef})`);
    }
  }

  doc.moveDown(0.3);
  paragraph(doc, "[ACTION REQUIRED] Describe additional human oversight measures implemented:");
  paragraph(doc, "  • Who reviews AI outputs before they affect natural persons?");
  paragraph(doc, "  • What authority do human reviewers have to override AI decisions?");
  paragraph(doc, "  • What training have oversight staff received (Art. 4 — AI Literacy)?");

  sectionTitle(doc, "Section (f) — Mitigation Measures (Art. 27(1)(f))");
  paragraph(doc, "Measures to be taken in case of risk materialisation, including arrangements for internal governance and complaint mechanisms.");
  doc.moveDown(0.3);

  paragraph(doc, "Automated mitigation provided by Aulite:");
  paragraph(doc, "  • Advisory mode: all risks logged and flagged for human review");
  paragraph(doc, "  • Enforcing mode: high-risk requests blocked before reaching AI provider");
  paragraph(doc, "  • Continuous post-market monitoring (Art. 72)");
  paragraph(doc, "  • Incident detection and reporting support (Art. 73)");

  doc.moveDown(0.3);
  paragraph(doc, "[ACTION REQUIRED] Describe organizational measures:");
  paragraph(doc, "  • Internal governance structure for AI compliance");
  paragraph(doc, "  • Complaint mechanism for affected persons");
  paragraph(doc, "  • Escalation procedures when risks materialize");
  paragraph(doc, "  • Corrective action protocols");

  sectionTitle(doc, "Art. 27(3) — Notification Requirement");
  paragraph(doc,
    "The results of this assessment must be notified to the relevant market surveillance " +
    "authority. The AI Office will provide a notification template (Art. 27(5)).",
  );

  footer(doc, `DRAFT — Generated by Aulite | ${new Date().toISOString()} | Requires deployer review and completion`);

  doc.end();
  return doc;
}
