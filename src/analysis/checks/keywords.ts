import type { KeywordRule } from "../../rules/types.js";
import type { CheckResult } from "../types.js";
import { scoreToLevel } from "../types.js";

// Standalone common English words that need HR context nearby to avoid false positives.
// "single" in "single-threaded" ≠ "single" in "are you single?"
const CONTEXT_REQUIRED_WORDS = new Set([
  "single", "married", "divorced", "blind", "deaf", "pregnant",
  "exotic", "nationality", "foreigner", "immigrant", "noble",
  "aggressive", "dominant", "dominate", "competitive", "autonomous",
  "ambitious", "decisive", "assertive", "superior", "hierarchical",
]);

// If the match is a common word, require an HR-context word within ±100 chars
const HR_CONTEXT_PATTERN = /\b(?:candidate|applicant|employee|worker|hire|hiring|recruit|interview|resume|CV|job|role|position|staff|team\s*member|apply|qualified|disqualif|reject|shortlist|assess|evaluat|screened?|onboard)\b/i;

function isCommonWordMatch(matchText: string): boolean {
  const word = matchText.trim().toLowerCase();
  return CONTEXT_REQUIRED_WORDS.has(word);
}

function hasHrContextNearby(text: string, matchText: string): boolean {
  const idx = text.toLowerCase().indexOf(matchText.toLowerCase());
  if (idx === -1) return false;

  const windowStart = Math.max(0, idx - 100);
  const windowEnd = Math.min(text.length, idx + matchText.length + 100);
  const window = text.slice(windowStart, windowEnd);

  return HR_CONTEXT_PATTERN.test(window);
}

export function checkKeywords(
  text: string,
  rules: Array<{ regex: RegExp; rule: KeywordRule }>,
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const { regex, rule } of rules) {
    regex.lastIndex = 0;
    const matches = text.match(regex);

    if (matches && matches.length > 0) {
      if (isCommonWordMatch(matches[0]) && !hasHrContextNearby(text, matches[0])) {
        continue;
      }

      results.push({
        check: "keywords",
        riskScore: rule.score,
        riskLevel: scoreToLevel(rule.score),
        details: `[${rule.category}] Matched pattern: "${matches[0]}". ${rule.articleRef}`,
        flaggedContent: matches.slice(0, 3).join(", "),
        articleRef: rule.articleRef,
      });
    }
  }

  return results;
}
