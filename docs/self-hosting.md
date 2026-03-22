# Self-Hosting

Aulite runs entirely on your infrastructure. No data leaves your network (except to the AI provider you configure).

## Docker

```bash
docker run -d \
  --name aulite \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e AULITE_DOMAINS=hr \
  -e AULITE_API_KEYS=your-secret-key \
  -v aulite-data:/app/data \
  --restart unless-stopped \
  el1ght/aulite
```

## Docker Compose

```yaml
services:
  aulite:
    image: el1ght/aulite
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AULITE_DOMAINS=hr,finance
      - AULITE_API_KEYS=${AULITE_API_KEYS}
      - AULITE_RATE_LIMIT=120
    volumes:
      - aulite-data:/app/data
      - ./aulite.config.yml:/app/aulite.config.yml:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      start_period: 5s

volumes:
  aulite-data:
```

## Behind a Reverse Proxy

Nginx example:

```nginx
server {
    listen 443 ssl;
    server_name ai-compliance.company.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;              # required for SSE streaming
        proxy_read_timeout 300s;          # AI responses can take time
    }
}
```

## Database

Aulite uses SQLite — no external database required.

- **Location:** `./aulite-audit.db` (configurable via `logging.database`)
- **Mode:** WAL (concurrent reads/writes)
- **Integrity:** SHA-256 hash chain — each entry contains the hash of the previous entry
- **Verify:** `GET /verify` or `curl http://localhost:3000/verify`

### Backup

```bash
sqlite3 aulite-audit.db ".backup backup.db"
```

SQLite in WAL mode supports online backups. The backup is crash-safe.

## Data Residency

All data stays on your infrastructure:

- Audit logs → local SQLite file
- Dashboard → served from the same container
- Reports → generated on-demand from local data

The only external network calls are to the AI provider you configure. No telemetry, no phone-home, no external dependencies.

## Monitoring

- `GET /health` — system status, rule count, audit entry count
- `GET /verify` — hash chain integrity check
- Console logs — structured JSON when piped, human-readable in TTY

Docker healthcheck is included in the Dockerfile.

## Scaling

Aulite is designed for single-instance deployment. For most use cases (up to ~1M requests), a single instance is sufficient.

For higher throughput:
- Run multiple Aulite instances behind a load balancer
- Each instance writes to its own SQLite database
- Aggregate stats across instances via the `/api/stats` endpoint
