# Compliance Reports

Aulite generates three types of PDF reports, each mapped to a specific EU AI Act article.

## Audit Report (Art. 12)

**Endpoint:** `GET /api/reports/audit?from=2026-01-01&to=2026-03-31`

Evidence of continuous automated monitoring and record-keeping. Contents:

1. Monitoring overview — total requests, flagged, blocked, detection rate
2. Risk distribution — breakdown by risk level
3. Top violation categories — with occurrence counts and article references
4. EU AI Act article violations — grouped by specific law article
5. Activity timeline — requests and risk scores over time
6. Provider and model usage breakdown
7. Audit trail integrity — hash chain verification status

Use case: show to auditors or regulators as evidence of Art. 12 compliance.

## FRIA Draft (Art. 27)

**Endpoint:** `GET /api/reports/fria?from=2026-01-01&to=2026-03-31`

Pre-filled Fundamental Rights Impact Assessment with the 6 mandatory sections from Art. 27(1)(a-f):

- **(a)** Deployer's processes — [ACTION REQUIRED] or pre-filled via `description` parameter
- **(b)** Period and frequency — auto-filled from monitoring data
- **(c)** Categories of affected persons — [ACTION REQUIRED], with detected discrimination categories listed
- **(d)** Specific risks — auto-filled from detected violations and article references
- **(e)** Human oversight measures — lists Aulite's automated oversight, [ACTION REQUIRED] for organizational measures
- **(f)** Mitigation measures — lists automated mitigation, [ACTION REQUIRED] for organizational measures

Sections marked [ACTION REQUIRED] must be completed by the deployer before submission to the market surveillance authority (Art. 27(3)).

## Incident Report (Art. 73)

**Endpoint:** `GET /api/reports/incidents?from=2026-01-01&to=2026-03-31`

Documents blocked and critical-risk requests. Includes:

- Reporting timeline requirements (15 days standard, 2 days critical, 10 days death)
- Incident summary with severity breakdown
- Per-incident details: timestamp, risk score, action taken, compliance checks, article references
- Required actions checklist for the deployer

Art. 73 requires deployers to report serious incidents to the market surveillance authority of the Member State where the incident occurred.

## Retention Requirements

| Requirement | Duration | Source |
|---|---|---|
| Automatically generated logs | Minimum 6 months | Art. 26(6) |
| Technical documentation | 10 years | Art. 11 |
| Incident reports | Submit within 15 days | Art. 73 |
