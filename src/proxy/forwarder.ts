import type { AuliteConfig } from "../config/types.js";
import { buildUpstreamRequest } from "./provider.js";
import { logger } from "../utils/logger.js";

export interface ForwardResult {
  responseBody: string;
  statusCode: number;
  provider: string;
  model: string | null;
}

export async function forwardRequest(
  requestBody: string,
  _headers: Headers,
  config: AuliteConfig,
): Promise<ForwardResult> {
  const upstream = buildUpstreamRequest(requestBody, config, false);

  logger.debug("Forwarding request", { provider: upstream.provider, model: upstream.model });

  const response = await fetch(upstream.url, {
    method: "POST",
    headers: upstream.headers,
    body: upstream.body,
  });

  let responseBody = await response.text();

  if (upstream.format === "anthropic" && response.ok) {
    responseBody = fromAnthropicResponse(responseBody, upstream.model);
  }

  return {
    responseBody,
    statusCode: response.status,
    provider: upstream.provider,
    model: upstream.model,
  };
}

function fromAnthropicResponse(body: string, model: string | null): string {
  try {
    const src = JSON.parse(body);
    const text = (src.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    const stopMap: Record<string, string> = {
      end_turn: "stop", max_tokens: "length", stop_sequence: "stop", tool_use: "tool_calls",
    };

    return JSON.stringify({
      id: src.id ?? "chatcmpl-aulite",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: src.model ?? model ?? "unknown",
      choices: [{
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: stopMap[src.stop_reason] ?? "stop",
      }],
      usage: {
        prompt_tokens: src.usage?.input_tokens ?? 0,
        completion_tokens: src.usage?.output_tokens ?? 0,
        total_tokens: (src.usage?.input_tokens ?? 0) + (src.usage?.output_tokens ?? 0),
      },
    });
  } catch {
    return body;
  }
}
