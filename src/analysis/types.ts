export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface CheckResult {
  check: string;
  riskScore: number;
  riskLevel: RiskLevel;
  details: string;
  flaggedContent?: string;
  articleRef?: string;
}

export interface RiskResult {
  overallScore: number;
  overallLevel: RiskLevel;
  checks: CheckResult[];
  action: "pass" | "warn" | "block";
  timestamp: string;
}

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 0) return "none";
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  if (score <= 8) return "high";
  return "critical";
}
