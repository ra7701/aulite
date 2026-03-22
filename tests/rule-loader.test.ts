import { describe, it, expect, beforeEach } from "vitest";
import { loadRulePacks, clearRuleCache } from "../src/rules/loader.js";

beforeEach(() => {
  clearRuleCache();
});

describe("Rule Loader", () => {
  it("loads base rules when no domains specified", () => {
    const { rules, prompt } = loadRulePacks([]);
    expect(rules.length).toBeGreaterThan(0);
    expect(prompt.length).toBeGreaterThan(0);
    // Base should have prohibited practices
    const prohibited = rules.filter((r) => r.rule.category.startsWith("prohibited_"));
    expect(prohibited.length).toBeGreaterThanOrEqual(7);
  });

  it("loads base + hr rules when hr domain specified", () => {
    const baseOnly = loadRulePacks([]);
    clearRuleCache();
    const withHr = loadRulePacks(["hr"]);

    expect(withHr.rules.length).toBeGreaterThan(baseOnly.rules.length);
    // HR should add discrimination rules
    const discrimination = withHr.rules.filter((r) => r.rule.category.startsWith("discrimination_"));
    expect(discrimination.length).toBeGreaterThan(0);
  });

  it("merges prompts from base and domain packs", () => {
    const { prompt } = loadRulePacks(["hr"]);
    // Should contain base preamble
    expect(prompt).toContain("PROHIBITED PRACTICES");
    // Should contain HR-specific sections
    expect(prompt).toContain("HR/Employment");
    expect(prompt).toContain("DISCRIMINATION");
  });

  it("base-only prompt does not contain HR content", () => {
    const { prompt } = loadRulePacks([]);
    expect(prompt).toContain("PROHIBITED PRACTICES");
    expect(prompt).not.toContain("HR/Employment");
  });

  it("throws for unknown domain", () => {
    expect(() => loadRulePacks(["nonexistent"])).toThrow('Unknown domain: "nonexistent"');
  });

  it("caches results for same domains", () => {
    const first = loadRulePacks(["hr"]);
    const second = loadRulePacks(["hr"]);
    expect(first).toBe(second); // Same reference
  });

  it("base rules include Art. 5 prohibited patterns", () => {
    const { rules } = loadRulePacks([]);
    const categories = rules.map((r) => r.rule.category);
    expect(categories).toContain("prohibited_emotion");
    expect(categories).toContain("prohibited_biometric");
    expect(categories).toContain("prohibited_social_scoring");
    expect(categories).toContain("prohibited_manipulation");
    expect(categories).toContain("prohibited_exploitation");
    expect(categories).toContain("prohibited_criminal_prediction");
    expect(categories).toContain("prohibited_facial_scraping");
  });

  it("base rules include GDPR Art. 9 special categories", () => {
    const { rules } = loadRulePacks([]);
    const categories = rules.map((r) => r.rule.category);
    expect(categories).toContain("discrimination_genetic");
    expect(categories).toContain("discrimination_orientation");
    expect(categories).toContain("discrimination_political");
    expect(categories).toContain("discrimination_belief");
    expect(categories).toContain("discrimination_sex_life");
  });

  it("hr rules include employment-specific patterns", () => {
    const { rules } = loadRulePacks(["hr"]);
    const categories = rules.map((r) => r.rule.category);
    expect(categories).toContain("human_oversight");
    expect(categories).toContain("discrimination_age");
    expect(categories).toContain("proxy_age");
    expect(categories).toContain("proxy_gender");
    expect(categories).toContain("proxy_race");
    expect(categories).toContain("platform_work_directive");
  });

  it("total rule count matches original (base + hr = 52)", () => {
    const { rules } = loadRulePacks(["hr"]);
    expect(rules.length).toBe(52);
  });
});
