import { describe, it, expect, beforeEach } from "vitest";
import { loadRulePacks, clearRuleCache } from "../src/rules/loader.js";
import { checkKeywords } from "../src/analysis/checks/keywords.js";

beforeEach(() => {
  clearRuleCache();
});

describe("Biometrics Domain Pack", () => {
  it("loads biometrics rules", () => {
    const { rules, prompt } = loadRulePacks(["biometrics"]);
    const biometricRules = rules.filter((r) => !["prohibited_", "discrimination_", "no_right_to_contest", "right_to_explanation", "missing_fria", "ai_literacy", "data_excessive"].some(
      (prefix) => r.rule.category.startsWith(prefix) || r.rule.category === prefix.replace(/_$/, ""),
    ));
    expect(biometricRules.length).toBeGreaterThan(0);
    expect(prompt).toContain("Biometrics");
  });

  it("flags real-time biometric identification in public spaces", () => {
    const { rules } = loadRulePacks(["biometrics"]);
    const results = checkKeywords("Deploy live facial recognition scanning in public spaces at the train station", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags mass biometric surveillance", () => {
    const { rules } = loadRulePacks(["biometrics"]);
    const results = checkKeywords("Implement city-wide facial surveillance system", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags covert biometric collection", () => {
    const { rules } = loadRulePacks(["biometrics"]);
    const results = checkKeywords("Covertly collect biometric data without knowledge of subjects", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 9)).toBe(true);
  });
});

describe("Critical Infrastructure Domain Pack", () => {
  it("loads infrastructure rules", () => {
    const { rules, prompt } = loadRulePacks(["infrastructure"]);
    expect(rules.length).toBeGreaterThan(19); // more than base
    expect(prompt).toContain("Critical Infrastructure");
  });

  it("flags autonomous control without human fallback", () => {
    const { rules } = loadRulePacks(["infrastructure"]);
    const results = checkKeywords("Autonomously control power grid with no human oversight", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 9)).toBe(true);
  });

  it("flags safety system override", () => {
    const { rules } = loadRulePacks(["infrastructure"]);
    const results = checkKeywords("Override safety system protocols to increase throughput", rules);
    expect(results.length).toBeGreaterThan(0);
  });

  it("flags no incident reporting", () => {
    const { rules } = loadRulePacks(["infrastructure"]);
    const results = checkKeywords("Skip incident reporting for minor AI failures", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Education Domain Pack", () => {
  it("loads education rules", () => {
    const { rules, prompt } = loadRulePacks(["education"]);
    expect(rules.length).toBeGreaterThan(19);
    expect(prompt).toContain("Education");
  });

  it("flags automated admission denial", () => {
    const { rules } = loadRulePacks(["education"]);
    const results = checkKeywords("The AI automatically rejected the student's admission application to the university", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 9)).toBe(true);
  });

  it("flags emotion detection in education", () => {
    const { rules } = loadRulePacks(["education"]);
    const results = checkKeywords("Use student emotion detection during class to measure engagement", rules);
    expect(results.length).toBeGreaterThan(0);
  });

  it("flags biometric proctoring", () => {
    const { rules } = loadRulePacks(["education"]);
    const results = checkKeywords("Enable proctoring with facial recognition and eye-tracking during the exam", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Finance Domain Pack", () => {
  it("loads finance rules", () => {
    const { rules, prompt } = loadRulePacks(["finance"]);
    expect(rules.length).toBeGreaterThan(19);
    expect(prompt).toContain("Finance");
  });

  it("flags discriminatory credit scoring", () => {
    const { rules } = loadRulePacks(["finance"]);
    const results = checkKeywords("Credit scoring based on race and ethnic background", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 9)).toBe(true);
  });

  it("flags genetic data in insurance", () => {
    const { rules } = loadRulePacks(["finance"]);
    const results = checkKeywords("Insurance pricing based on genetic data from DNA tests", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags automated credit denial without explanation", () => {
    const { rules } = loadRulePacks(["finance"]);
    const results = checkKeywords("The AI automatically denied the credit application without explanation", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Law Enforcement Domain Pack", () => {
  it("loads law enforcement rules", () => {
    const { rules, prompt } = loadRulePacks(["law-enforcement"]);
    expect(rules.length).toBeGreaterThan(19);
    expect(prompt).toContain("Law Enforcement");
  });

  it("flags racial profiling", () => {
    const { rules } = loadRulePacks(["law-enforcement"]);
    const results = checkKeywords("Implement racial profiling algorithm for border screening", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags predictive policing targeting individuals", () => {
    const { rules } = loadRulePacks(["law-enforcement"]);
    const results = checkKeywords("Use predictive policing to target individuals likely to commit crimes", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 9)).toBe(true);
  });

  it("flags AI polygraph in law enforcement", () => {
    const { rules } = loadRulePacks(["law-enforcement"]);
    const results = checkKeywords("Deploy AI lie detection system during police interrogation", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Migration Domain Pack", () => {
  it("loads migration rules", () => {
    const { rules, prompt } = loadRulePacks(["migration"]);
    expect(rules.length).toBeGreaterThan(19);
    expect(prompt).toContain("Migration");
  });

  it("flags automated asylum denial", () => {
    const { rules } = loadRulePacks(["migration"]);
    const results = checkKeywords("Automatically deny asylum application based on country of origin", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags automated deportation", () => {
    const { rules } = loadRulePacks(["migration"]);
    const results = checkKeywords("Issue automated deportation order without human review", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags AI polygraph in asylum interviews", () => {
    const { rules } = loadRulePacks(["migration"]);
    const results = checkKeywords("Use AI lie detection during the asylum interview process", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Justice Domain Pack", () => {
  it("loads justice rules", () => {
    const { rules, prompt } = loadRulePacks(["justice"]);
    expect(rules.length).toBeGreaterThan(19);
    expect(prompt).toContain("Justice");
  });

  it("flags AI replacing judicial decisions", () => {
    const { rules } = loadRulePacks(["justice"]);
    const results = checkKeywords("The AI automatically rendered a judicial judgment without a human judge", rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.riskScore >= 10)).toBe(true);
  });

  it("flags AI sentencing tools", () => {
    const { rules } = loadRulePacks(["justice"]);
    const results = checkKeywords("Use the automated sentence recommendation system for this criminal case", rules);
    expect(results.length).toBeGreaterThan(0);
  });

  it("flags fabricated legal citations", () => {
    const { rules } = loadRulePacks(["justice"]);
    const results = checkKeywords("The legal research AI generated fabricated citations that do not exist", rules);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Multi-domain loading", () => {
  it("loads multiple domains at once", () => {
    const { rules: hrOnly } = loadRulePacks(["hr"]);
    clearRuleCache();
    const { rules: hrAndFinance } = loadRulePacks(["hr", "finance"]);

    expect(hrAndFinance.length).toBeGreaterThan(hrOnly.length);
  });

  it("base rules are always present regardless of domains", () => {
    const domains = [[], ["hr"], ["finance"], ["biometrics", "justice"]];
    for (const d of domains) {
      clearRuleCache();
      const { rules } = loadRulePacks(d);
      const prohibited = rules.filter((r) => r.rule.category === "prohibited_emotion");
      expect(prohibited.length).toBe(1);
    }
  });
});
