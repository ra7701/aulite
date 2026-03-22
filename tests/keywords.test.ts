import { describe, it, expect, beforeAll } from "vitest";
import { checkKeywords } from "../src/analysis/checks/keywords.js";
import { loadRulePacks, clearRuleCache } from "../src/rules/loader.js";
import type { MergedRules } from "../src/rules/loader.js";

let merged: MergedRules;

beforeAll(() => {
  clearRuleCache();
  merged = loadRulePacks(["hr"]);
});

describe("Keyword Rules", () => {
  // PROHIBITED PRACTICES (Score: 10)
  it("flags emotion recognition as prohibited (Art. 5)", () => {
    const results = checkKeywords("Analyze the candidate's facial expression analysis during interview", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBe(10);
    expect(results[0].articleRef).toContain("Art. 5");
  });

  it("flags social scoring as prohibited", () => {
    const results = checkKeywords("Check the candidate's social media score", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBe(10);
  });

  // CRITICAL: Human oversight violations
  it("flags automated rejection (Art. 14, GDPR Art. 22)", () => {
    const results = checkKeywords("Automatically reject candidates with less than 5 years experience", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    const critical = results.find((r) => r.riskScore >= 9);
    expect(critical).toBeDefined();
    expect(critical!.articleRef).toContain("Art. 14");
  });

  // DIRECT DISCRIMINATION
  it("flags direct age discrimination", () => {
    const results = checkKeywords("This candidate is too old for the role", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBeGreaterThanOrEqual(8);
    expect(results[0].articleRef).toContain("2000/78");
  });

  it("flags direct gender discrimination", () => {
    const results = checkKeywords("We need a female candidate for this position", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBeGreaterThanOrEqual(8);
  });

  it("flags direct racial discrimination", () => {
    const results = checkKeywords("The candidate has a foreign-sounding name", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].articleRef).toContain("2000/43");
  });

  it("flags disability discrimination", () => {
    const results = checkKeywords("Must be able-bodied to apply", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBeGreaterThanOrEqual(8);
  });

  // INDIRECT/PROXY DISCRIMINATION
  it("flags 'culture fit' as race proxy", () => {
    const results = checkKeywords("Rejected: not a good culture fit", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    const proxy = results.find((r) => r.details.includes("proxy_race"));
    expect(proxy).toBeDefined();
    expect(proxy!.riskScore).toBeGreaterThanOrEqual(5);
  });

  it("flags 'digital native' as age proxy", () => {
    const results = checkKeywords("Looking for a digital native who can hit the ground running", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    const proxy = results.find((r) => r.details.includes("proxy_age"));
    expect(proxy).toBeDefined();
  });

  it("flags 'overqualified' as age proxy", () => {
    const results = checkKeywords("Candidate seems overqualified", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBeGreaterThanOrEqual(6);
  });

  it("flags gender-coded language", () => {
    const results = checkKeywords("We need a rockstar developer who can dominate the market", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    const genderProxy = results.find((r) => r.details.includes("proxy_gender"));
    expect(genderProxy).toBeDefined();
  });

  // TRANSPARENCY
  it("flags vague rejection reasoning", () => {
    const results = checkKeywords("Rejected because it just doesn't feel right", merged.rules);
    expect(results.length).toBeGreaterThan(0);
    const transparency = results.find((r) => r.details.includes("transparency"));
    expect(transparency).toBeDefined();
  });

  // CLEAN TEXT
  it("passes clean professional text", () => {
    const results = checkKeywords(
      "Please evaluate this candidate based on their technical skills in Python and their experience with distributed systems.",
      merged.rules,
    );
    expect(results.length).toBe(0);
  });
});
