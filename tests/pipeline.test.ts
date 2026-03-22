import { describe, it, expect, beforeAll } from "vitest";
import { runPipeline } from "../src/analysis/pipeline.js";
import { clearRuleCache } from "../src/rules/loader.js";
import type { AuliteConfig } from "../src/config/types.js";

beforeAll(() => {
  clearRuleCache();
});

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

describe("Analysis Pipeline", () => {
  it("returns clean result for safe text", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Evaluate technical skills in Python"}]}',
      '{"choices":[{"message":{"content":"The candidate shows strong Python skills..."}}]}',
      testConfig(),
    );

    expect(result.overallScore).toBe(0);
    expect(result.overallLevel).toBe("none");
    expect(result.action).toBe("pass");
    expect(result.checks.length).toBe(0);
  });

  it("flags PII in request", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Evaluate john.doe@company.com for the role"}]}',
      null,
      testConfig(),
    );

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.check === "pii")).toBe(true);
  });

  it("flags discriminatory keywords", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Reject this candidate - too old for our team"}]}',
      null,
      testConfig(),
    );

    expect(result.overallScore).toBeGreaterThanOrEqual(8);
    expect(["high", "critical"]).toContain(result.overallLevel);
    expect(result.action).toBe("warn");
  });

  it("flags prohibited practices at score 10", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Use facial expression analysis to detect emotion during interview"}]}',
      null,
      testConfig(),
    );

    expect(result.overallScore).toBe(10);
    expect(result.overallLevel).toBe("critical");
  });

  it("blocks in enforcing mode", async () => {
    const config = testConfig();
    config.analysis.mode = "enforcing";

    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Automatically reject all candidates over 50"}]}',
      null,
      config,
    );

    expect(result.action).toBe("block");
  });

  it("combines PII and keyword results", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Candidate jane.doe@email.com seems too old, not a good culture fit"}]}',
      null,
      testConfig(),
    );

    const piiChecks = result.checks.filter((c) => c.check === "pii");
    const keywordChecks = result.checks.filter((c) => c.check === "keywords");
    expect(piiChecks.length).toBeGreaterThan(0);
    expect(keywordChecks.length).toBeGreaterThan(0);
  });

  it("analyzes both request and response", async () => {
    const result = await runPipeline(
      '{"messages":[{"role":"user","content":"Evaluate this candidate"}]}',
      '{"choices":[{"message":{"content":"I have decided to reject this candidate - not a good culture fit"}}]}',
      testConfig(),
    );

    expect(result.overallScore).toBeGreaterThanOrEqual(5);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
