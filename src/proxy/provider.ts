import type { AuliteConfig, ProviderConfig } from "../config/types.js";

export const ANTHROPIC_API_VERSION = "2023-06-01";
type ApiFormat = "openai" | "anthropic";

export interface UpstreamRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  provider: string;
  model: string | null;
  format: ApiFormat;
}

const MODEL_PREFIXES: Record<string, string> = {
  "claude-": "anthropic",
  "gpt-": "openai",
  "o1-": "openai",
  "o3-": "openai",
  "o4-": "openai",
  "chatgpt-": "openai",
};

function detectProvider(model: string | null, config: AuliteConfig): string {
  if (model) {
    for (const [prefix, provider] of Object.entries(MODEL_PREFIXES)) {
      if (model.startsWith(prefix) && config.provider[provider as keyof typeof config.provider]) {
        return provider;
      }
    }
  }
  return config.provider.default;
}

function getFormat(providerName: string): ApiFormat {
  return providerName === "anthropic" ? "anthropic" : "openai";
}

export function buildUpstreamRequest(
  requestBody: string,
  config: AuliteConfig,
  stream: boolean,
): UpstreamRequest {
  let parsed: Record<string, unknown> = {};
  let model: string | null = null;
  try {
    parsed = JSON.parse(requestBody);
    model = (parsed.model as string) ?? null;
  } catch {
    // non-JSON passthrough
  }

  const providerName = detectProvider(model, config);
  const providerConfig = config.provider[providerName as keyof typeof config.provider] as ProviderConfig | undefined;

  if (!providerConfig) {
    throw new Error(
      `No provider configured for model "${model ?? "unknown"}". ` +
      `Set ${providerName.toUpperCase()}_API_KEY or configure provider.${providerName} in config.`,
    );
  }

  const format = getFormat(providerName);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string;
  let body: string;

  if (format === "anthropic") {
    url = `${providerConfig.baseUrl}/v1/messages`;
    headers["x-api-key"] = providerConfig.apiKey;
    headers["anthropic-version"] = ANTHROPIC_API_VERSION;
    body = toAnthropicBody(parsed, stream);
  } else if (providerName === "azure") {
    const azure = config.provider.azure!;
    const apiVersion = azure.apiVersion ?? "2024-02-01";
    url = `${azure.baseUrl}/openai/deployments/${azure.deploymentId}/chat/completions?api-version=${apiVersion}`;
    headers["api-key"] = azure.apiKey;
    parsed.stream = stream;
    body = JSON.stringify(parsed);
  } else {
    url = `${providerConfig.baseUrl}/v1/chat/completions`;
    headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
    parsed.stream = stream;
    body = JSON.stringify(parsed);
  }

  return { url, headers, body, provider: providerName, model, format };
}

// Anthropic doesn't accept "system" role in messages — it's a top-level field
function toAnthropicBody(openai: Record<string, unknown>, stream: boolean): string {
  const messages = (openai.messages as Array<{ role: string; content: string }>) ?? [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: openai.model ?? "claude-sonnet-4-6",
    max_tokens: openai.max_tokens ?? 1024,
    messages: nonSystemMessages,
    stream,
  };

  if (systemMessages.length > 0) {
    body.system = systemMessages.map((m) => m.content).join("\n");
  }
  if (openai.temperature !== undefined) body.temperature = openai.temperature;
  if (openai.top_p !== undefined) body.top_p = openai.top_p;

  return JSON.stringify(body);
}
