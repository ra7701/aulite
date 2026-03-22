import type { CheckResult } from "../types.js";
import { scoreToLevel } from "../types.js";
import { ANTHROPIC_API_VERSION } from "../../proxy/provider.js";
import { logger } from "../../utils/logger.js";

interface JudgeResponse {
  score: number;
  reasoning: string;
  articles: string[];
  verdict: "pass" | "warn" | "fail";
}

export async function checkLlmJudge(
  text: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  baseUrl = "https://api.anthropic.com",
): Promise<CheckResult | null> {
  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analyze this AI interaction for EU AI Act and anti-discrimination compliance risks:\n\n${text.slice(0, 4000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      logger.warn("LLM Judge API error", { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn("LLM Judge returned non-JSON response");
      return null;
    }

    const judge: JudgeResponse = JSON.parse(jsonMatch[0]);

    if (judge.score <= 0) return null;

    return {
      check: "llm-judge",
      riskScore: Math.min(10, Math.max(0, judge.score)),
      riskLevel: scoreToLevel(judge.score),
      details: judge.reasoning,
      articleRef: judge.articles.join("; "),
    };
  } catch (err) {
    logger.error("LLM Judge failed", { error: String(err) });
    return null;
  }
}
