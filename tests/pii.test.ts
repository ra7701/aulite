import { describe, it, expect } from "vitest";
import { checkPii } from "../src/analysis/checks/pii.js";

describe("PII Detector", () => {
  it("detects email addresses", () => {
    const results = checkPii("Contact john.doe@example.com for details");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].check).toBe("pii");
    expect(results[0].flaggedContent).toContain("john.doe@example.com");
  });

  it("detects phone numbers", () => {
    const results = checkPii("Call +49 30 12345678 for info");
    expect(results.length).toBeGreaterThan(0);
  });

  it("detects IBAN numbers", () => {
    const results = checkPii("Pay to DE89 3704 0044 0532 0130 00");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].articleRef).toContain("GDPR");
  });

  it("detects SSN", () => {
    const results = checkPii("SSN: 123-45-6789");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].riskScore).toBe(9);
  });

  it("detects date of birth", () => {
    const results = checkPii("Date of birth: 15/03/1990");
    expect(results.length).toBeGreaterThan(0);
  });

  it("detects passport numbers", () => {
    const results = checkPii("Passport number: AB1234567");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty for clean text", () => {
    const results = checkPii("This is a normal job description with no personal data");
    expect(results.length).toBe(0);
  });

  it("detects multiple PII types", () => {
    const results = checkPii(
      "Candidate: john@test.com, SSN: 123-45-6789, born on 01/01/1985",
    );
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
