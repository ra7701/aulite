# Installation

## Docker (recommended)

```bash
docker run -d \
  --name aulite \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e AULITE_DOMAINS=hr \
  -e AULITE_API_KEYS=your-secret-key \
  -v aulite-data:/app/data \
  el1ght/aulite
```

### Docker Compose

```yaml
services:
  aulite:
    image: el1ght/aulite
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AULITE_DOMAINS=hr,finance
      - AULITE_API_KEYS=your-secret-key
    volumes:
      - aulite-data:/app/data
      - ./aulite.config.yml:/app/aulite.config.yml:ro
    restart: unless-stopped

volumes:
  aulite-data:
```

## Build from Source

```bash
git clone https://github.com/el1ght/aulite.git
cd aulite
npm install
cd dashboard && npm install && cd ..
npm run build
npm start
```

## Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# { "status": "ok", "version": "0.3.0", "domains": ["hr"], ... }
```

Open `http://localhost:3000` in a browser to access the dashboard.
