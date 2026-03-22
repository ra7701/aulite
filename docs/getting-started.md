# Getting Started

Aulite is a transparent HTTP proxy that sits between your application and any AI provider. It analyzes every request and response for EU AI Act compliance, logs everything into a tamper-evident audit trail, and provides compliance reports.

## Quick Start (Docker)

```bash
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v aulite-data:/app/data \
  aulite/aulite
```

## Quick Start (npm)

```bash
npx aulite init    # interactive setup wizard
npx aulite start   # start the proxy
```

## Connect Your Application

Change your AI client's base URL to point to Aulite:

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-aulite-key",       # optional, if auth is enabled
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-6",       # auto-routes to Anthropic
    messages=[{"role": "user", "content": "Hello"}]
)
```

That's it. Your application works exactly as before — Aulite transparently proxies all requests while analyzing them for compliance.

## What You Get

- **Dashboard** at `http://localhost:3000` — real-time compliance overview
- **Audit trail** — every request logged with SHA-256 hash chain
- **PDF reports** — Art. 12 audit, Art. 27 FRIA, Art. 73 incident reports
- **Risk scoring** — 0-10 scale mapped to specific EU AI Act articles

## Next Steps

- [Installation](./installation.md) — Docker, npm, and build from source
- [Configuration](./configuration.md) — all config options
- [Providers](./providers.md) — OpenAI, Anthropic, Azure, Ollama setup
- [Domains](./domains.md) — 8 compliance domains explained
