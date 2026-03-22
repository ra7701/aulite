# API Reference

All endpoints are served on a single port (default: 3000).

## Proxy

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint. Forwards requests to the configured AI provider with compliance analysis.

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <key>` or `Authorization: Bearer <key>` (if auth enabled)

**Request body:** Standard OpenAI chat completions format.

**Streaming:** Set `"stream": true` in the request body for SSE streaming. Response uses OpenAI SSE format regardless of upstream provider.

**Responses:**
- `200` — proxied successfully
- `403` — blocked by compliance check (enforcing mode)
- `401` — invalid or missing API key
- `429` — rate limit exceeded
- `502` — upstream provider error

### Blocked Response (403)

```json
{
  "error": {
    "message": "Request blocked by Aulite compliance proxy",
    "type": "compliance_violation",
    "details": [
      {
        "check": "keywords",
        "score": 10,
        "details": "[prohibited_emotion] Matched: \"facial expression analysis\"",
        "articleRef": "AI Act Art. 5(1)(f)"
      }
    ]
  }
}
```

## Monitoring

### GET /health

Returns system status.

```json
{
  "status": "ok",
  "version": "0.3.0",
  "plan": "pro",
  "mode": "advisory",
  "domains": ["hr", "finance"],
  "rulesLoaded": 65,
  "auditEntries": 1247,
  "auth": true,
  "rateLimit": 60,
  "dashboardPages": ["overview", "requests", "compliance", "reports", "settings"]
}
```

### GET /verify

Verifies the integrity of the hash-chained audit trail.

```json
{
  "valid": true,
  "entriesChecked": 1247
}
```

## Statistics

### GET /api/stats

Returns compliance statistics for the dashboard.

**Query parameters:**
- `from` — start date (ISO format, default: 30 days ago)
- `to` — end date (ISO format, default: today)

**Response:** JSON with `overview`, `topCategories`, `topArticles`, `timeSeries`, `providers`, `incidents`.

## Reports

All report endpoints accept `from` and `to` query parameters.

### GET /api/reports/audit

Generates an Art. 12 Compliance Audit Report (PDF).

### GET /api/reports/fria

Generates an Art. 27 Fundamental Rights Impact Assessment draft (PDF).

**Additional parameter:** `description` — optional system description to pre-fill Section (a).

### GET /api/reports/incidents

Generates an Art. 73 Incident Report (PDF) for blocked and high-risk requests.

## Dashboard

### GET /

Serves the embedded compliance dashboard (React SPA). Available when the dashboard is built.

Pages: Overview, Requests, Compliance, Reports, Settings.
