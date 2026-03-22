# Providers

Aulite supports any AI provider that speaks the OpenAI API format, plus Anthropic's native format. The provider is auto-detected from the model name in each request.

## Auto-Routing

When multiple providers are configured, Aulite routes based on the model prefix:

| Model prefix | Routes to | API format |
|---|---|---|
| `claude-*` | `anthropic` | Anthropic Messages API |
| `gpt-*`, `o1-*`, `o3-*`, `o4-*`, `chatgpt-*` | `openai` | OpenAI Chat Completions |
| Any other model | `provider.default` | Depends on default |

This means you can configure both Anthropic and OpenAI, and your application can use any model through a single proxy endpoint.

## Anthropic

```yaml
provider:
  default: anthropic
  anthropic:
    baseUrl: https://api.anthropic.com
    apiKey: ${ANTHROPIC_API_KEY}
```

Or via env: `ANTHROPIC_API_KEY=sk-ant-...`

Aulite automatically translates between OpenAI and Anthropic formats. Your application always sends OpenAI-format requests — Aulite handles the conversion.

## OpenAI

```yaml
provider:
  default: openai
  openai:
    baseUrl: https://api.openai.com
    apiKey: ${OPENAI_API_KEY}
```

Or via env: `OPENAI_API_KEY=sk-...`

## Azure OpenAI

```yaml
provider:
  default: azure
  azure:
    baseUrl: https://your-resource.openai.azure.com
    apiKey: ${AZURE_OPENAI_API_KEY}
    deploymentId: gpt-4
    apiVersion: "2024-02-01"
```

Or via env:
```bash
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4
```

## Self-Hosted Models (Ollama, vLLM, LocalAI)

Any server that exposes an OpenAI-compatible API works out of the box:

```yaml
provider:
  default: openai
  openai:
    baseUrl: http://localhost:11434   # Ollama
    apiKey: "not-needed"
```

Tested with:
- **Ollama** — `baseUrl: http://localhost:11434`
- **vLLM** — `baseUrl: http://localhost:8000`
- **LocalAI** — `baseUrl: http://localhost:8080`
- **llama.cpp server** — `baseUrl: http://localhost:8080`
- **HuggingFace TGI** — `baseUrl: http://localhost:8080`

No Anthropic, OpenAI, or any external API key needed — traffic stays entirely on your infrastructure.

## Streaming

Aulite supports SSE streaming for all providers. When your application sends `"stream": true`, the response is streamed to the client in real-time. Compliance analysis runs asynchronously after the stream completes — zero latency penalty.

Anthropic streaming events are automatically transformed to OpenAI SSE format, so your application always receives a consistent stream format regardless of the upstream provider.
