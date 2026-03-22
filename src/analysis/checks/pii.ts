import type { CheckResult } from "../types.js";
import { scoreToLevel } from "../types.js";

interface PiiPattern {
  name: string;
  pattern: RegExp;
  score: number;
  articleRef: string;
}

// Patterns tuned to avoid false positives on code examples, JSON responses, and model IDs
const PII_PATTERNS: PiiPattern[] = [
  {
    name: "email address",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    score: 7,
    articleRef: "GDPR Art. 5(1)(c), Art. 25",
  },
  {
    name: "phone number",
    pattern:
      /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b(?:tel|phone|fax|mobile|call)\s*:?\s*\d[\d\s\-().]{7,18}\d\b/gi,
    score: 7,
    articleRef: "GDPR Art. 5(1)(c), Art. 25",
  },
  {
    name: "IBAN",
    pattern: /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?(?:[\dA-Z]{4}[\s]?){2,7}[\dA-Z]{1,4}\b/g,
    score: 9,
    articleRef: "GDPR Art. 9, Art. 5(1)(c)",
  },
  {
    name: "credit card number",
    pattern: /\b\d{4}-\d{4}-\d{4}-\d{4}\b|\b(?:card|visa|mastercard|amex|credit)\s*(?:no|number|#|:)?\s*\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
    score: 9,
    articleRef: "GDPR Art. 5(1)(c)",
  },
  {
    name: "SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    score: 9,
    articleRef: "GDPR Art. 9, Art. 5(1)(c)",
  },
  {
    name: "German ID number",
    pattern:
      /(?:personalausweis|ausweis|identity\s*card|national\s*id|id[- ]?(?:number|nr|no))\s*:?\s*[CFGHJKLMNPRTVWXYZ][CFGHJKLMNPRTVWXYZ0-9]{8}\b/gi,
    score: 8,
    articleRef: "GDPR Art. 5(1)(c)",
  },
  {
    name: "Dutch BSN",
    pattern: /(?:BSN|burgerservicenummer|sofi\s*nummer)\s*:?\s*\d{9}\b/gi,
    score: 7,
    articleRef: "GDPR Art. 5(1)(c)",
  },
  {
    name: "French NIR",
    pattern: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
    score: 8,
    articleRef: "GDPR Art. 5(1)(c)",
  },
  {
    name: "passport number",
    pattern: /\bpassport\s*(?:no|number|#|:)?\s*[A-Z0-9]{6,9}\b/gi,
    score: 9,
    articleRef: "GDPR Art. 5(1)(c)",
  },
  {
    name: "date of birth",
    pattern:
      /\b(?:dob|date\s*of\s*birth|born\s*on|birthdate)\s*:?\s*\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}\b/gi,
    score: 8,
    articleRef: "GDPR Art. 5(1)(c); Dir. 2000/78/EC (age)",
  },
  {
    name: "physical address",
    pattern:
      /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Strasse|Straße|Rue|Via|Calle)\b/gi,
    score: 6,
    articleRef: "GDPR Art. 5(1)(c)",
  },
];

export function checkPii(text: string): CheckResult[] {
  const results: CheckResult[] = [];

  for (const { name, pattern, score, articleRef } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);

    if (matches && matches.length > 0) {
      const significantMatches = matches.filter((m) => m.length > 4);
      if (significantMatches.length === 0) continue;

      results.push({
        check: "pii",
        riskScore: score,
        riskLevel: scoreToLevel(score),
        details: `Found ${significantMatches.length} potential ${name}(s) in text. PII should be anonymized before sending to external AI providers.`,
        flaggedContent: significantMatches.slice(0, 3).join(", "),
        articleRef,
      });
    }
  }

  return results;
}
