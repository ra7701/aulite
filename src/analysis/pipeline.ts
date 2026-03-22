import type { AuliteConfig } from "../config/types.js";
import type { CheckResult, RiskResult } from "./types.js";
import { scoreToLevel } from "./types.js";
import { checkPii } from "./checks/pii.js";
import { checkKeywords } from "./checks/keywords.js";
import { checkLlmJudge } from "./checks/llm-judge.js";
import { loadRulePacks } from "../rules/loader.js";
import { getEntitlements } from "../license.js";
import { logger } from "../utils/logger.js";

export async function runPipeline(
  requestText: string,
  responseText: string | null,
  config: AuliteConfig,
): Promise<RiskResult> {
  const allChecks: CheckResult[] = [];
  const fullText = responseText ? `${requestText}\n---\n${responseText}` : requestText;

  const { rules, prompt } = loadRulePacks(config.analysis.domains, config.analysis.rulesDir);

  const piiResults = checkPii(fullText);
  const keywordResults = checkKeywords(fullText, rules);
  allChecks.push(...piiResults, ...keywordResults);

  const level1MaxScore = Math.max(0, ...allChecks.map((c) => c.riskScore));
  const shouldJudge = shouldTriggerLlmJudge(level1MaxScore, config);

  if (shouldJudge) {
    const anthropicConfig = config.provider.anthropic;
    if (anthropicConfig) {
      logger.debug("Triggering LLM Judge", { reason: level1MaxScore > 0 ? "level1_flag" : "sample" });

      const judgeResult = await checkLlmJudge(
        fullText,
        anthropicConfig.apiKey,
        config.analysis.llmJudge.model,
        prompt,
        anthropicConfig.baseUrl,
      );

      if (judgeResult) {
        allChecks.push(judgeResult);
      }
    }
  }

  const overallScore = allChecks.length > 0 ? Math.max(...allChecks.map((c) => c.riskScore)) : 0;

  let action: "pass" | "warn" | "block" = "pass";
  if (overallScore >= config.analysis.thresholds.block && config.analysis.mode === "enforcing") {
    action = "block";
  } else if (overallScore >= config.analysis.thresholds.warn) {
    action = "warn";
  }

  return {
    overallScore,
    overallLevel: scoreToLevel(overallScore),
    checks: allChecks,
    action,
    timestamp: new Date().toISOString(),
  };
}

function shouldTriggerLlmJudge(level1MaxScore: number, config: AuliteConfig): boolean {
  if (!config.analysis.llmJudge.enabled) return false;
  if (!getEntitlements().llmJudge) return false;

  if (level1MaxScore > 0) return true;

  return Math.random() < config.analysis.llmJudge.sampleRate;
}
