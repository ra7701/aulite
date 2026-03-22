# Configuration

Aulite is configured via `aulite.config.yml` and/or environment variables. Environment variables take precedence.

## Config File

Create `aulite.config.yml` in the working directory, or run `aulite init` to generate one interactively.

```yaml
server:
  port: 3000
  host: "0.0.0.0"

provider:
  default: anthropic
  anthropic:
    baseUrl: https://api.anthropic.com
    apiKey: ${ANTHROPIC_API_KEY}
  openai:
    baseUrl: https://api.openai.com
    apiKey: ${OPENAI_API_KEY}

analysis:
  mode: advisory          # "advisory" or "enforcing"
  domains:
    - hr
    - finance
  llmJudge:
    enabled: false
    model: claude-sonnet-4-6
    sampleRate: 0.1
  thresholds:
    warn: 4
    block: 7

auth:
  apiKeys:
    - "your-secret-key"

rateLimit:
  requestsPerMinute: 60

logging:
  database: "./aulite-audit.db"
  retentionDays: 365
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | — |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | — |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name | `gpt-4` |
| `AULITE_PORT` | Server port | `3000` |
| `AULITE_HOST` | Server host | `0.0.0.0` |
| `AULITE_DOMAINS` | Comma-separated compliance domains | `hr` |
| `AULITE_API_KEYS` | Comma-separated proxy API keys | — (auth disabled) |
| `AULITE_RATE_LIMIT` | Max requests per minute | — (unlimited) |
| `AULITE_RULES_DIR` | Custom rules directory path | auto-detected |
| `AULITE_LICENSE_KEY` | Pro license key | — (free plan) |
| `AULITE_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `AZURE_OPENAI_API_VERSION` | Azure API version | `2024-02-01` |

## Analysis Modes

**Advisory** (default) — all requests are proxied, compliance risks are logged and flagged but never blocked. Recommended for initial deployment.

**Enforcing** — requests with risk score >= `block` threshold are rejected with HTTP 403 before reaching the AI provider. Use after tuning thresholds.

## Thresholds

| Score | Risk Level | Default Action |
|---|---|---|
| 0 | None | Pass |
| 1-3 | Low | Pass |
| 4-6 | Medium | Warn (logged) |
| 7-8 | High | Warn / Block (enforcing) |
| 9-10 | Critical | Warn / Block (enforcing) |

## LLM Judge

The LLM Judge is a secondary analysis layer that uses Claude to semantically evaluate requests for compliance risks that keyword matching might miss.

- Triggers automatically when Level 1 (keywords + PII) flags something
- Random sampling at `sampleRate` for clean requests
- Adds 200-500ms latency when triggered (async in streaming mode)
- Requires `ANTHROPIC_API_KEY`
- Cost: ~$0.003 per evaluation
