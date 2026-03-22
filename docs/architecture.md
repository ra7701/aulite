# Architecture

## Request Flow

1. Client sends OpenAI-format request to `/v1/chat/completions`
2. **Auth check** — validates API key (if configured)
3. **Rate limit check** — sliding window per client key
4. **Pre-analysis** — PII detection + keyword matching (<2ms)
5. If score >= block threshold (enforcing mode) → return 403
6. **Provider routing** — auto-detect provider from model name
7. **Forward** to upstream AI provider (with format conversion if Anthropic)
8. **Post-analysis** — analyze full request + response
9. **Audit log** — write to SQLite with hash chain
10. Return response to client

For streaming requests, steps 8-9 run asynchronously after the stream completes.

## Analysis Pipeline

Two-layer system:

**Level 1 — Deterministic (<2ms):**
- PII detection: 11 EU-specific patterns (email, phone, IBAN, SSN, national IDs)
- Keyword matching: regex patterns from active domain rule packs
- Context-aware: common words require HR-context nearby to trigger

**Level 2 — LLM Judge (200-500ms, optional):**
- Triggers when Level 1 flags something, or on random sample
- Uses Claude with domain-specific system prompt
- Returns structured JSON: score, reasoning, article references, verdict
- Runs asynchronously in streaming mode

## Audit Trail

Append-only SQLite with SHA-256 hash chain:

```
Entry 1: prev_hash = "0",          entry_hash = sha256(...)
Entry 2: prev_hash = entry_hash₁,  entry_hash = sha256(...)
Entry 3: prev_hash = entry_hash₂,  entry_hash = sha256(...)
```

If any entry is modified, the chain breaks. Verification: `GET /verify`.

Two tables:
- `audit_entries` — one row per request (request/response bodies, scores, metadata)
- `check_details` — normalized check results for efficient dashboard queries

## Rule Pack System

```
src/rules/
├── base/           # always loaded (Art. 5, GDPR Art. 9)
├── hr/             # Annex III Point 4
├── finance/        # Annex III Point 5
├── biometrics/     # Annex III Point 1
└── ...
```

Each domain has:
- `rules.yml` — keyword patterns with scores and article references
- `prompt.txt` — system prompt section for the LLM Judge

Adding a new domain = creating a directory with these two files. No code changes.

## Provider Abstraction

Two API formats:
- `openai` — de facto standard (OpenAI, Azure, Ollama, vLLM, any compatible server)
- `anthropic` — Anthropic's Messages API

Auto-routing by model prefix: `claude-*` → Anthropic, `gpt-*` → OpenAI, everything else → default.

Request/response transformation happens transparently. Clients always send and receive OpenAI format.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 22+ |
| HTTP framework | Hono |
| Database | SQLite (better-sqlite3, WAL mode) |
| Dashboard | React 19, Vite, Tailwind, Recharts |
| PDF generation | pdfkit |
| Config | YAML + env vars |
| Build | tsup (backend), Vite (frontend) |
| Tests | Vitest |
